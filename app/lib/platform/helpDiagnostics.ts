"use client";

import { generatedBuildDttm, generatedBuildNumber } from "../../build-info";
import { createClient } from "@supabase/supabase-js";

const maxEntries = 60;
const maxVisibleTextLength = 5000;
const maxScreenHtmlLength = 80000;
const helpDiagnosticsEndpoint = "/api/platform/help-diagnostics";
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
const supabase = createClient(supabaseUrl, supabaseAnonKey);

type Breadcrumb = {
  at: string;
  detail?: Record<string, unknown>;
  kind: string;
  label: string;
};

type ApiCallEntry = {
  at: string;
  durationMs?: number;
  error?: string;
  method: string;
  requestId: string;
  status?: number;
  url: string;
};

type LogEntry = {
  at: string;
  level: "error" | "info" | "warn";
  message: string;
};

type NavigationEntry = {
  at: string;
  from: string;
  to: string;
  type: "initial" | "popstate" | "pushState" | "replaceState";
};

export type HelpDiagnosticsPacket = {
  apiCalls: ApiCallEntry[];
  app: {
    buildDttm: string;
    buildNumber: string;
    environment: string;
  };
  breadcrumbs: Breadcrumb[];
  createdAt: string;
  device: {
    language: string;
    network: {
      downlink: number | null;
      effectiveType: string;
      rtt: number | null;
      saveData: boolean | null;
    };
    online: boolean;
    platform: string;
    screen: string;
    touchPoints: number;
    userAgent: string;
    viewport: string;
  };
  logs: LogEntry[];
  navigation: NavigationEntry[];
  screen: {
    html: string;
    path: string;
    title: string;
    visibleText: string;
  };
  session: {
    referrer: string;
    storageAvailable: boolean;
    timezone: string;
    visibilityState: string;
  };
  version: 1;
};

export type HelpDiagnosticsUserInput = {
  happenedInstead?: string;
  tryingToDo?: string;
};

export type HelpDiagnosticsSubmissionResult = {
  includedSummary: string;
  referenceId: string;
  reportId: string;
  submittedAt: string;
};

declare global {
  interface Window {
    CarePlandHelpDiagnostics?: {
      createPacket: () => HelpDiagnosticsPacket;
      record: (kind: string, label: string, detail?: Record<string, unknown>) => void;
      submit: (
        userInput?: HelpDiagnosticsUserInput,
        packet?: HelpDiagnosticsPacket
      ) => Promise<HelpDiagnosticsSubmissionResult>;
    };
  }
}

const state = {
  apiCalls: [] as ApiCallEntry[],
  breadcrumbs: [] as Breadcrumb[],
  installed: false,
  logs: [] as LogEntry[],
  navigation: [] as NavigationEntry[],
};

export function installHelpDiagnosticsRecorder() {
  if (typeof window === "undefined" || state.installed) return;

  state.installed = true;
  recordNavigation("initial", "", currentPath());
  patchHistoryMethod("pushState");
  patchHistoryMethod("replaceState");
  patchFetch();
  patchConsole("error");
  patchConsole("info");
  patchConsole("warn");

  window.addEventListener("popstate", () => {
    recordNavigation("popstate", "", currentPath());
  });
  document.addEventListener("click", recordUiEvent, true);
  document.addEventListener("change", recordUiEvent, true);
  document.addEventListener("input", recordUiEvent, true);
  window.addEventListener("offline", () => record("diagnostic", "client_lost_connectivity"));
  window.addEventListener("online", () => record("diagnostic", "client_connectivity_restored"));
  window.addEventListener("error", (event) => {
    record("diagnostic", "runtime_exception", {
      message: event.message,
      source: event.filename,
    });
  });
  window.addEventListener("unhandledrejection", (event) => {
    record("diagnostic", "unhandled_rejection", {
      reason: formatLogArg(event.reason),
    });
  });
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") {
      record("diagnostic", "action_abandoned_or_hidden", {
        path: currentPath(),
      });
    }
  });

  window.CarePlandHelpDiagnostics = {
    createPacket,
    record,
    submit: submitHelpDiagnostics,
  };
}

export async function submitHelpDiagnostics(
  userInput: HelpDiagnosticsUserInput = {},
  packet = createPacket()
) {
  record("diagnostic", "help_report_submit_started", {
    path: currentPath(),
  });
  const response = await fetch(helpDiagnosticsEndpoint, {
    body: JSON.stringify({ packet, userInput }),
    headers: {
      ...(await authHeaders()),
      "Content-Type": "application/json",
    },
    method: "POST",
  });

  if (!response.ok) {
    record("diagnostic", "help_report_submit_failed", {
      path: currentPath(),
      status: response.status,
    });
    throw new Error("CarePland could not send diagnostics right now.");
  }

  const result = (await response.json()) as HelpDiagnosticsSubmissionResult;
  record("diagnostic", "help_report_submit_succeeded", {
    path: currentPath(),
    referenceId: result.referenceId,
  });
  return result;
}

export function recordHelpDiagnosticsEvent(
  label: string,
  detail?: Record<string, unknown>
) {
  if (typeof window === "undefined") return;
  record("diagnostic", label, {
    path: currentPath(),
    ...detail,
  });
}

function createPacket(): HelpDiagnosticsPacket {
  return {
    apiCalls: [...state.apiCalls],
    app: {
      buildDttm: generatedBuildDttm,
      buildNumber: generatedBuildNumber,
      environment: process.env.NODE_ENV || "unknown",
    },
    breadcrumbs: [...state.breadcrumbs],
    createdAt: new Date().toISOString(),
    device: deviceSnapshot(),
    logs: [...state.logs],
    navigation: [...state.navigation],
    screen: screenSnapshot(),
    session: sessionSnapshot(),
    version: 1,
  };
}

function patchFetch() {
  const originalFetch = window.fetch.bind(window);

  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const startedAt = performance.now();
    const method = fetchMethod(input, init);
    const url = sanitizeUrl(fetchUrl(input));
    const requestId = createClientRequestId();

    try {
      const response = await originalFetch(input, init);
      recordApiCall({
        at: new Date().toISOString(),
        durationMs: Math.round(performance.now() - startedAt),
        method,
        requestId,
        status: response.status,
        url,
      });
      return response;
    } catch (error) {
      const aborted =
        error instanceof DOMException
          ? error.name === "AbortError" || error.name === "TimeoutError"
          : /abort|timeout/i.test(errorMessage(error));
      recordApiCall({
        at: new Date().toISOString(),
        durationMs: Math.round(performance.now() - startedAt),
        error: errorMessage(error),
        method,
        requestId,
        url,
      });
      if (aborted) {
        record("diagnostic", "request_timed_out", {
          method,
          requestId,
          url,
        });
      }
      throw error;
    }
  };
}

function patchConsole(level: LogEntry["level"]) {
  const original = console[level].bind(console);

  console[level] = (...args: unknown[]) => {
    pushBounded(state.logs, {
      at: new Date().toISOString(),
      level,
      message: args.map(formatLogArg).join(" ").slice(0, 1000),
    });
    original(...args);
  };
}

function patchHistoryMethod(type: "pushState" | "replaceState") {
  const original = window.history[type].bind(window.history);

  window.history[type] = (
    data: unknown,
    unused: string,
    url?: string | URL | null
  ) => {
    const from = currentPath();
    const result = original(data, unused, url);
    recordNavigation(type, from, currentPath());
    return result;
  };
}

function recordUiEvent(event: Event) {
  const target = event.target;
  if (!(target instanceof Element)) return;

  record("ui", event.type, {
    control: elementLabel(target),
    path: currentPath(),
  });
}

async function authHeaders(): Promise<Record<string, string>> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const accessToken = session?.access_token;

  return accessToken ? { Authorization: `Bearer ${accessToken}` } : {};
}

function record(kind: string, label: string, detail?: Record<string, unknown>) {
  pushBounded(state.breadcrumbs, {
    at: new Date().toISOString(),
    detail,
    kind,
    label,
  });
}

function recordApiCall(entry: ApiCallEntry) {
  if (entry.url === helpDiagnosticsEndpoint) return;
  pushBounded(state.apiCalls, entry);
}

function recordNavigation(
  type: NavigationEntry["type"],
  from: string,
  to: string
) {
  pushBounded(state.navigation, {
    at: new Date().toISOString(),
    from,
    to,
    type,
  });
}

function screenSnapshot() {
  const main = document.querySelector("main");
  const root = main instanceof HTMLElement ? main : document.body;
  const clonedRoot = root.cloneNode(true);
  const html =
    clonedRoot instanceof HTMLElement
      ? redactScreenHtml(clonedRoot).slice(0, maxScreenHtmlLength)
      : "";

  return {
    html,
    path: currentPath(),
    title: document.title || "CarePland",
    visibleText: visibleText(root).slice(0, maxVisibleTextLength),
  };
}

function redactScreenHtml(root: HTMLElement) {
  root.querySelectorAll("script, style, svg, img").forEach((element) => {
    element.remove();
  });
  root.querySelectorAll("input, textarea, select").forEach((element) => {
    element.setAttribute("data-diagnostic-redacted", "true");
    element.removeAttribute("value");
    element.textContent = "";
  });

  return root.outerHTML;
}

function visibleText(root: Element) {
  return (root.textContent || "").replace(/\s+/g, " ").trim();
}

function deviceSnapshot(): HelpDiagnosticsPacket["device"] {
  return {
    language: navigator.language || "",
    network: networkSnapshot(),
    online: navigator.onLine,
    platform: navigator.platform || "",
    screen:
      typeof screen === "undefined"
        ? ""
        : `${screen.width}x${screen.height}@${window.devicePixelRatio || 1}`,
    touchPoints: navigator.maxTouchPoints || 0,
    userAgent: navigator.userAgent || "",
    viewport: `${window.innerWidth}x${window.innerHeight}`,
  };
}

function networkSnapshot(): HelpDiagnosticsPacket["device"]["network"] {
  const connection =
    "connection" in navigator
      ? (navigator as Navigator & {
          connection?: {
            downlink?: number;
            effectiveType?: string;
            rtt?: number;
            saveData?: boolean;
          };
        }).connection
      : undefined;

  return {
    downlink:
      typeof connection?.downlink === "number" ? connection.downlink : null,
    effectiveType:
      typeof connection?.effectiveType === "string"
        ? connection.effectiveType
        : "",
    rtt: typeof connection?.rtt === "number" ? connection.rtt : null,
    saveData:
      typeof connection?.saveData === "boolean" ? connection.saveData : null,
  };
}

function sessionSnapshot(): HelpDiagnosticsPacket["session"] {
  return {
    referrer: document.referrer || "",
    storageAvailable: storageAvailable(),
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "",
    visibilityState: document.visibilityState || "",
  };
}

function storageAvailable() {
  try {
    const key = "carepland-diagnostics-storage-check";
    window.sessionStorage.setItem(key, "1");
    window.sessionStorage.removeItem(key);
    return true;
  } catch {
    return false;
  }
}

function fetchMethod(input: RequestInfo | URL, init?: RequestInit) {
  return String(
    init?.method || (input instanceof Request ? input.method : "GET")
  ).toUpperCase();
}

function fetchUrl(input: RequestInfo | URL) {
  if (typeof input === "string") return input;
  if (input instanceof URL) return input.toString();
  return input.url;
}

function sanitizeUrl(value: string) {
  try {
    const url = new URL(value, window.location.origin);
    url.searchParams.forEach((_paramValue, key) => {
      if (/(token|code|secret|password|key|session|auth)/i.test(key)) {
        url.searchParams.set(key, "[redacted]");
      }
    });

    return url.origin === window.location.origin
      ? `${url.pathname}${url.search}`
      : `${url.origin}${url.pathname}`;
  } catch {
    return value.slice(0, 300);
  }
}

function elementLabel(element: Element) {
  const text = (element.textContent || "").replace(/\s+/g, " ").trim();
  return {
    ariaLabel: element.getAttribute("aria-label") || "",
    id: element.id || "",
    role: element.getAttribute("role") || element.tagName.toLowerCase(),
    testId: element.getAttribute("data-testid") || "",
    text: text.slice(0, 120),
  };
}

function formatLogArg(arg: unknown) {
  if (arg instanceof Error) return `${arg.name}: ${arg.message}`;
  if (typeof arg === "string") return arg;

  try {
    return JSON.stringify(arg);
  } catch {
    return String(arg);
  }
}

function currentPath() {
  return `${window.location.pathname}${window.location.search}`;
}

function createClientRequestId() {
  return `REQ-${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 8)}`.toUpperCase();
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function pushBounded<T>(entries: T[], entry: T) {
  entries.push(entry);
  if (entries.length > maxEntries) {
    entries.splice(0, entries.length - maxEntries);
  }
}
