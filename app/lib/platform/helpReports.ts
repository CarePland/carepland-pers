export const helpReportPacketSchemaVersion = 1;
export const helpReportMaxPayloadBytes = 256 * 1024;
export const helpReportMaxUserTextLength = 1200;

export const helpReportStatuses = [
  "new",
  "reviewing",
  "needs_follow_up",
  "resolved",
  "dismissed",
] as const;

export const helpReportResolutionCategories = [
  "code_defect",
  "deployment_configuration",
  "network_device",
  "session_authentication",
  "permission_access",
  "user_confusion",
  "expected_behavior",
  "duplicate",
  "insufficient_information",
  "other",
] as const;

export type HelpReportStatus = (typeof helpReportStatuses)[number];
export type HelpReportResolutionCategory =
  (typeof helpReportResolutionCategories)[number];

export type HelpReportLikelyCategory =
  | "authentication/session issue"
  | "authorization issue"
  | "failed API request"
  | "frontend exception"
  | "navigation/routing issue"
  | "network/offline issue"
  | "stale or mismatched build"
  | "timeout or slow response"
  | "unknown"
  | "validation/user-input issue";

export type HelpReportSeverity = "info" | "medium" | "low";

export type HelpReportPacket = {
  apiCalls?: Array<Record<string, unknown>>;
  app?: Record<string, unknown>;
  breadcrumbs?: Array<Record<string, unknown>>;
  createdAt?: string;
  device?: Record<string, unknown>;
  logs?: Array<Record<string, unknown>>;
  navigation?: Array<Record<string, unknown>>;
  screen?: Record<string, unknown>;
  session?: Record<string, unknown>;
  version?: unknown;
};

export type HelpReportUserInput = {
  happenedInstead?: unknown;
  tryingToDo?: unknown;
};

export type HelpReportDerivedSummary = {
  errorCount: number;
  failedRequestCount: number;
  firstDetectedFailureAt: string | null;
  hasFrontendErrors: boolean;
  hasFailedApiCalls: boolean;
  lastFailedEndpoint: string | null;
  lastMeaningfulUserAction: string | null;
  likelyCategory: HelpReportLikelyCategory;
  mostRecentExceptionMessage: string | null;
  slowRequestCount: number;
  warningCount: number;
};

export type HelpReportTimelineItem = {
  at: string;
  detail: string;
  kind: "api" | "error" | "navigation" | "system" | "user" | "warning";
  title: string;
};

export type HelpReportValidatedSubmission = {
  derivedSummary: HelpReportDerivedSummary;
  featureArea: string;
  packet: HelpReportPacket;
  packetSchemaVersion: 1;
  route: string;
  userHappenedInstead: string;
  userTryingToDo: string;
};

const secretPattern = /(authorization|bearer|cookie|password|secret|session|token|apikey|api_key|access[_-]?token|refresh[_-]?token)/i;
const slowRequestMs = 5000;

export function generateHelpReportReference(date = new Date(), random = Math.random()) {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  const suffixNumber = Math.floor(random * 36 ** 4);
  const suffix = suffixNumber.toString(36).toUpperCase().padStart(4, "0");

  return `HELP-${year}${month}${day}-${suffix}`;
}

export function validateAndPrepareHelpReportSubmission(input: {
  packet: unknown;
  userInput?: HelpReportUserInput;
}): HelpReportValidatedSubmission {
  const packet = sanitizeDiagnosticPacket(input.packet);

  if (packet.version !== helpReportPacketSchemaVersion) {
    throw new Error("Unsupported help report packet version.");
  }

  const userTryingToDo = boundedText(input.userInput?.tryingToDo);
  const userHappenedInstead = boundedText(input.userInput?.happenedInstead);
  const route = stringValue(packet.screen?.path) || latestNavigationPath(packet) || "";
  const featureArea = featureAreaFromRoute(route);
  const derivedSummary = deriveHelpReportSummary(packet);

  return {
    derivedSummary,
    featureArea,
    packet,
    packetSchemaVersion: helpReportPacketSchemaVersion,
    route,
    userHappenedInstead,
    userTryingToDo,
  };
}

export function sanitizeDiagnosticPacket(input: unknown): HelpReportPacket {
  const raw = isRecord(input) ? input : {};

  return {
    apiCalls: arrayOfRecords(raw.apiCalls).slice(-60).map(sanitizeRecord),
    app: sanitizeRecord(recordValue(raw.app)),
    breadcrumbs: arrayOfRecords(raw.breadcrumbs).slice(-60).map(sanitizeRecord),
    createdAt: stringValue(raw.createdAt),
    device: sanitizeRecord(recordValue(raw.device)),
    logs: arrayOfRecords(raw.logs).slice(-60).map(sanitizeRecord),
    navigation: arrayOfRecords(raw.navigation).slice(-60).map(sanitizeRecord),
    screen: sanitizeScreen(recordValue(raw.screen)),
    session: sanitizeRecord(recordValue(raw.session)),
    version: raw.version,
  };
}

export function deriveHelpReportSummary(packet: HelpReportPacket): HelpReportDerivedSummary {
  const logs = arrayOfRecords(packet.logs);
  const apiCalls = arrayOfRecords(packet.apiCalls);
  const breadcrumbs = arrayOfRecords(packet.breadcrumbs);
  const navigation = arrayOfRecords(packet.navigation);

  const errorLogs = logs.filter((log) => stringValue(log.level) === "error");
  const warningLogs = logs.filter((log) => stringValue(log.level) === "warn");
  const failedRequests = apiCalls.filter((call) => {
    const status = numberValue(call.status);
    return Boolean(call.error) || (status !== null && status >= 400);
  });
  const slowRequests = apiCalls.filter((call) => {
    const duration = numberValue(call.durationMs);
    return duration !== null && duration >= slowRequestMs;
  });
  const mostRecentExceptionMessage =
    stringValue(lastItem(errorLogs)?.message).slice(0, 500) || null;
  const lastFailedEndpoint =
    stringValue(lastItem(failedRequests)?.url).slice(0, 300) || null;
  const failureTimes = errorLogs.concat(failedRequests)
    .map((item) => stringValue(item.at))
    .filter(Boolean)
    .sort();
  const lastMeaningfulUserAction = readableUserAction(lastItem(breadcrumbs)) || null;

  return {
    errorCount: errorLogs.length,
    failedRequestCount: failedRequests.length,
    firstDetectedFailureAt: failureTimes[0] ?? null,
    hasFrontendErrors: errorLogs.length > 0,
    hasFailedApiCalls: failedRequests.length > 0,
    lastFailedEndpoint,
    lastMeaningfulUserAction,
    likelyCategory: likelyCategory({
      apiCalls,
      breadcrumbs,
      failedRequests,
      logs,
      navigation,
      slowRequests,
    }),
    mostRecentExceptionMessage,
    slowRequestCount: slowRequests.length,
    warningCount: warningLogs.length,
  };
}

export function buildHelpReportTimeline(packet: HelpReportPacket): HelpReportTimelineItem[] {
  const items: HelpReportTimelineItem[] = [];

  arrayOfRecords(packet.navigation).forEach((entry) => {
    const to = stringValue(entry.to);
    items.push({
      at: stringValue(entry.at),
      detail: to,
      kind: "navigation",
      title: "Navigated",
    });
  });

  arrayOfRecords(packet.breadcrumbs).forEach((entry) => {
    const title = readableUserAction(entry);
    if (!title) return;
    items.push({
      at: stringValue(entry.at),
      detail: stringValue(recordValue(entry.detail).path),
      kind: "user",
      title,
    });
  });

  arrayOfRecords(packet.apiCalls).forEach((entry) => {
    const status = numberValue(entry.status);
    const failed = Boolean(entry.error) || (status !== null && status >= 400);
    const duration = numberValue(entry.durationMs);
    items.push({
      at: stringValue(entry.at),
      detail: [
        stringValue(entry.method) || "GET",
        stringValue(entry.url),
        stringValue(entry.requestId),
        status ? String(status) : stringValue(entry.error),
        duration !== null ? `${duration}ms` : "",
      ]
        .filter(Boolean)
        .join(" · "),
      kind: failed ? "error" : duration !== null && duration >= slowRequestMs ? "warning" : "api",
      title: failed ? "API request failed" : "API request",
    });
  });

  arrayOfRecords(packet.logs).forEach((entry) => {
    const level = stringValue(entry.level);
    items.push({
      at: stringValue(entry.at),
      detail: stringValue(entry.message),
      kind: level === "error" ? "error" : level === "warn" ? "warning" : "system",
      title: level === "error" ? "Frontend error" : level === "warn" ? "Console warning" : "Console log",
    });
  });

  return dedupeTimeline(
    items
      .filter((item) => item.at || item.detail || item.title)
      .sort((a, b) => Date.parse(a.at || "0") - Date.parse(b.at || "0"))
  );
}

export function groupedHelpReportLogs(packet: HelpReportPacket) {
  const grouped = new Map<
    string,
    { count: number; firstAt: string; lastAt: string; level: string; message: string }
  >();

  arrayOfRecords(packet.logs).forEach((entry) => {
    const level = stringValue(entry.level) || "info";
    const message = stringValue(entry.message);
    const at = stringValue(entry.at);
    const key = `${level}:${message}`;
    const current = grouped.get(key);

    if (!current) {
      grouped.set(key, { count: 1, firstAt: at, lastAt: at, level, message });
      return;
    }

    current.count += 1;
    current.lastAt = at || current.lastAt;
  });

  return Array.from(grouped.values());
}

export function isHelpReportStatus(value: unknown): value is HelpReportStatus {
  return typeof value === "string" && helpReportStatuses.includes(value as HelpReportStatus);
}

export function isHelpReportResolutionCategory(
  value: unknown
): value is HelpReportResolutionCategory {
  return (
    typeof value === "string" &&
    helpReportResolutionCategories.includes(value as HelpReportResolutionCategory)
  );
}

export function featureAreaFromRoute(route: string) {
  if (!route) return "unknown";
  if (route.startsWith("/connect/receiver")) return "Receiver";
  if (route.startsWith("/connect")) return "Messages";
  if (route.startsWith("/family")) return "Family";
  if (route.startsWith("/admin")) return "Admin";
  if (route.includes("appointments")) return "Appointments";
  if (route.includes("profile")) return "Profile";
  if (route.includes("ask")) return "Ask";
  return "Personal";
}

function likelyCategory(input: {
  apiCalls: Record<string, unknown>[];
  breadcrumbs: Record<string, unknown>[];
  failedRequests: Record<string, unknown>[];
  logs: Record<string, unknown>[];
  navigation: Record<string, unknown>[];
  slowRequests: Record<string, unknown>[];
}): HelpReportLikelyCategory {
  const combinedText = [
    ...input.logs.map((item) => stringValue(item.message)),
    ...input.failedRequests.map((item) => `${stringValue(item.url)} ${stringValue(item.error)} ${stringValue(item.status)}`),
    ...input.breadcrumbs.map((item) => `${stringValue(item.kind)} ${stringValue(item.label)}`),
  ]
    .join(" ")
    .toLowerCase();

  if (/\b(401|jwt|session|sign.?in|authenticat|logged out)\b/.test(combinedText)) {
    return "authentication/session issue";
  }
  if (/\b(403|forbidden|permission|not allowed|access denied)\b/.test(combinedText)) {
    return "authorization issue";
  }
  if (/\b(offline|network|failed to fetch|internet|connectivity)\b/.test(combinedText)) {
    return "network/offline issue";
  }
  if (/\b(timeout|timed out|abort)\b/.test(combinedText)) {
    return "timeout or slow response";
  }
  if (/\b(validation|required|invalid|malformed)\b/.test(combinedText)) {
    return "validation/user-input issue";
  }
  if (input.slowRequests.length > 0) return "timeout or slow response";
  if (input.failedRequests.length > 0) return "failed API request";
  if (input.logs.some((item) => stringValue(item.level) === "error")) {
    return "frontend exception";
  }
  if (input.navigation.length > 1 && /route|navigation|redirect/.test(combinedText)) {
    return "navigation/routing issue";
  }

  return "unknown";
}

function sanitizeScreen(screen: Record<string, unknown>) {
  const sanitized = sanitizeRecord(screen);
  return {
    ...sanitized,
    html: redactSecrets(stringValue(sanitized.html)).slice(0, 80000),
    visibleText: redactSecrets(stringValue(sanitized.visibleText)).slice(0, 5000),
  };
}

function sanitizeRecord(record: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(record).map(([key, value]) => [
      key,
      secretPattern.test(key) ? "[redacted]" : sanitizeValue(value),
    ])
  );
}

function sanitizeValue(value: unknown): unknown {
  if (typeof value === "string") return redactSecrets(value).slice(0, 5000);
  if (typeof value === "number" || typeof value === "boolean" || value === null) {
    return value;
  }
  if (Array.isArray(value)) return value.slice(0, 80).map(sanitizeValue);
  if (isRecord(value)) return sanitizeRecord(value);
  return "";
}

function redactSecrets(value: string) {
  return value
    .replace(/Bearer\s+[A-Za-z0-9._~+/=-]+/gi, "Bearer [redacted]")
    .replace(/(password|token|secret|session|authorization|api[_-]?key)=([^&\s"']+)/gi, "$1=[redacted]");
}

function boundedText(value: unknown) {
  return redactSecrets(String(value ?? "").trim()).slice(0, helpReportMaxUserTextLength);
}

function readableUserAction(entry: Record<string, unknown> | undefined) {
  if (!entry) return "";
  const kind = stringValue(entry.kind);
  const label = stringValue(entry.label);
  const detail = recordValue(entry.detail);
  const control = recordValue(detail.control);
  const controlText =
    stringValue(control.ariaLabel) ||
    stringValue(control.text) ||
    stringValue(control.testId) ||
    stringValue(control.role);

  if (kind === "diagnostic") return label;
  if (kind === "ui" && label === "click" && controlText) return `Pressed ${controlText}`;
  if (kind === "ui" && controlText) return `Changed ${controlText}`;
  if (label) return `${kind}: ${label}`;
  return "";
}

function latestNavigationPath(packet: HelpReportPacket) {
  return stringValue(lastItem(arrayOfRecords(packet.navigation))?.to);
}

function dedupeTimeline(items: HelpReportTimelineItem[]) {
  const grouped: HelpReportTimelineItem[] = [];

  items.forEach((item) => {
    const last = lastItem(grouped);
    if (last && last.kind === item.kind && last.title === item.title && last.detail === item.detail) {
      last.title = `${item.title} (repeated)`;
      return;
    }
    grouped.push(item);
  });

  return grouped;
}

function arrayOfRecords(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value) ? value.filter(isRecord) : [];
}

function recordValue(value: unknown): Record<string, unknown> {
  return isRecord(value) ? value : {};
}

function stringValue(value: unknown): string {
  return typeof value === "string" ? value : value == null ? "" : String(value);
}

function numberValue(value: unknown): number | null {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function lastItem<T>(items: T[]): T | undefined {
  return items.length ? items[items.length - 1] : undefined;
}
