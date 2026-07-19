export type AdminPriorityCategory =
  | "needs_attention"
  | "review"
  | "watch"
  | "deferred";

export type AdminPrioritySeverity = "critical" | "high" | "medium" | "low";

export type AdminPriorityStatus =
  | "open"
  | "acknowledged"
  | "in_progress"
  | "deferred"
  | "resolved"
  | "dismissed";

export type AdminPrioritySort = "severity" | "newest" | "oldest" | "last_activity";

export type AdminPrioritySourceType =
  | "checkpoint_review"
  | "help_report"
  | "interaction_failure"
  | "operational_failure"
  | "session_loss";

export type AdminPriorityRecommendedAction = {
  actionType?: string;
  destination?: string;
  label: string;
};

export type AdminPriorityCandidate = {
  affectedLabel?: string;
  affectedPersonId?: string;
  category: Exclude<AdminPriorityCategory, "deferred">;
  explanation: string;
  firstObservedAt: string;
  incidentKey: string;
  lastObservedAt: string;
  occurrenceCount: number;
  reason: string;
  recommendedAction?: AdminPriorityRecommendedAction;
  receiverId?: string;
  severity: AdminPrioritySeverity;
  sourceRecordIds: string[];
  sourceType: AdminPrioritySourceType;
  summary: string;
  title: string;
};

export type AdminPriorityState = {
  acknowledgedAt?: string | null;
  assignedAdminUserId?: string | null;
  deferredUntil?: string | null;
  dismissedAt?: string | null;
  incidentKey: string;
  lastActionAt?: string | null;
  lastActionByUserId?: string | null;
  note?: string | null;
  resolvedAt?: string | null;
  status: AdminPriorityStatus;
};

export type AdminPriority = Omit<AdminPriorityCandidate, "category"> & {
  acknowledgedAt: string | null;
  assignedAdminUserId: string | null;
  category: AdminPriorityCategory;
  deferredUntil: string | null;
  id: string;
  lastActionAt: string | null;
  lastActionByUserId: string | null;
  note: string;
  status: AdminPriorityStatus;
};

export type AdminPrioritySummary = {
  activeCount: number;
  deferredCount: number;
  needsAttentionCount: number;
  recoveredCount: number;
  reviewCount: number;
  watchCount: number;
};

const severityRank: Record<AdminPrioritySeverity, number> = {
  critical: 4,
  high: 3,
  medium: 2,
  low: 1,
};

const statusRank: Record<AdminPriorityStatus, number> = {
  open: 6,
  acknowledged: 5,
  in_progress: 4,
  deferred: 3,
  resolved: 2,
  dismissed: 1,
};

const sourceLabelByType: Record<AdminPrioritySourceType, string> = {
  checkpoint_review: "Checkpoint",
  help_report: "Help Reports",
  interaction_failure: "Interaction Traces",
  operational_failure: "Operations",
  session_loss: "Session",
};

export const adminPriorityLifecycleStatuses: AdminPriorityStatus[] = [
  "open",
  "acknowledged",
  "in_progress",
  "deferred",
  "resolved",
  "dismissed",
];

export const adminPriorityActiveStatuses: AdminPriorityStatus[] = [
  "open",
  "acknowledged",
  "in_progress",
];

export function buildAdminPriorities({
  candidates,
  now = new Date(),
  states = [],
}: {
  candidates: AdminPriorityCandidate[];
  now?: Date;
  states?: AdminPriorityState[];
}): AdminPriority[] {
  const statesByKey = new Map(states.map((state) => [state.incidentKey, state]));

  return candidates
    .map((candidate) => mergePriorityState(candidate, statesByKey.get(candidate.incidentKey), now))
    .filter((priority) => shouldShowPriority(priority, now))
    .sort(comparePriorities);
}

export function buildAdminPrioritySummary(priorities: AdminPriority[]): AdminPrioritySummary {
  const activePriorities = priorities.filter((priority) =>
    adminPriorityActiveStatuses.includes(priority.status)
  );

  return {
    activeCount: activePriorities.length,
    deferredCount: priorities.filter((priority) => priority.status === "deferred").length,
    needsAttentionCount: activePriorities.filter(
      (priority) => priority.category === "needs_attention"
    ).length,
    recoveredCount: priorities.filter((priority) => priority.status === "resolved").length,
    reviewCount: activePriorities.filter((priority) => priority.category === "review").length,
    watchCount: activePriorities.filter((priority) => priority.category === "watch").length,
  };
}

export function filterAdminPriorities(
  priorities: AdminPriority[],
  filter: "active" | AdminPriorityCategory | AdminPriorityStatus
): AdminPriority[] {
  if (filter === "active") {
    return priorities.filter((priority) =>
      adminPriorityActiveStatuses.includes(priority.status)
    );
  }

  if (filter === "deferred") {
    return priorities.filter((priority) => priority.status === "deferred");
  }

  if (adminPriorityLifecycleStatuses.includes(filter as AdminPriorityStatus)) {
    return priorities.filter((priority) => priority.status === filter);
  }

  return priorities.filter(
    (priority) =>
      adminPriorityActiveStatuses.includes(priority.status) &&
      priority.category === filter
  );
}

export function sortAdminPriorities(
  priorities: AdminPriority[],
  sort: AdminPrioritySort
): AdminPriority[] {
  const sorted = [...priorities];
  if (sort === "newest") {
    return sorted.sort((left, right) => compareIsoDesc(left.firstObservedAt, right.firstObservedAt));
  }
  if (sort === "oldest") {
    return sorted.sort((left, right) => compareIsoAsc(left.firstObservedAt, right.firstObservedAt));
  }
  if (sort === "last_activity") {
    return sorted.sort((left, right) => compareIsoDesc(left.lastObservedAt, right.lastObservedAt));
  }
  return sorted.sort(comparePriorities);
}

export function groupedRepeatedFailures({
  destination,
  failureCountThreshold = 3,
  failures,
  groupKey,
  sourceType,
  successWindowHours = 24,
  title,
}: {
  destination: string;
  failureCountThreshold?: number;
  failures: Array<{
    affectedLabel?: string;
    affectedPersonId?: string;
    id: string;
    occurredAt: string;
    receiverId?: string;
    succeeded?: boolean;
  }>;
  groupKey: (failure: { affectedPersonId?: string; receiverId?: string }) => string;
  sourceType: "interaction_failure" | "operational_failure" | "session_loss";
  successWindowHours?: number;
  title: string;
}): AdminPriorityCandidate[] {
  const groups = new Map<string, typeof failures>();

  failures.forEach((failure) => {
    const key = groupKey(failure);
    groups.set(key, [...(groups.get(key) ?? []), failure]);
  });

  return Array.from(groups.entries()).flatMap(([key, rows]) => {
    const sorted = [...rows].sort((left, right) =>
      compareIsoAsc(left.occurredAt, right.occurredAt)
    );
    const failureRows = sorted.filter((row) => row.succeeded !== true);
    const successRows = sorted.filter((row) => row.succeeded === true);
    const lastFailure = failureRows.at(-1);
    const lastSuccess = successRows.at(-1);

    if (!lastFailure || failureRows.length < failureCountThreshold) {
      return [];
    }

    if (
      lastSuccess &&
      Date.parse(lastSuccess.occurredAt) > Date.parse(lastFailure.occurredAt)
    ) {
      return [];
    }

    const firstFailure = failureRows[0];
    const spanMinutes = Math.max(
      1,
      Math.round(
        (Date.parse(lastFailure.occurredAt) - Date.parse(firstFailure.occurredAt)) /
          60000
      )
    );
    const spanHours =
      (Date.parse(lastFailure.occurredAt) - Date.parse(firstFailure.occurredAt)) /
      3600000;
    const severity: AdminPrioritySeverity =
      failureRows.length >= 6 || spanHours >= successWindowHours ? "high" : "medium";
    const affectedLabel =
      firstFailure.affectedLabel ||
      firstFailure.receiverId ||
      firstFailure.affectedPersonId ||
      "CarePland user";

    return [
      {
        affectedLabel,
        affectedPersonId: firstFailure.affectedPersonId,
        category: severity === "high" ? "needs_attention" : "watch",
        explanation: `${failureRows.length} related failures occurred without a later successful recovery signal.`,
        firstObservedAt: firstFailure.occurredAt,
        incidentKey: `${sourceType}:${key}`,
        lastObservedAt: lastFailure.occurredAt,
        occurrenceCount: failureRows.length,
        reason: `${failureRows.length} failed attempts in ${spanMinutes} minutes.`,
        receiverId: firstFailure.receiverId,
        recommendedAction: {
          destination,
          label:
            sourceType === "session_loss"
              ? "Review session history"
              : "Open diagnostics",
        },
        severity,
        sourceRecordIds: failureRows.map((row) => row.id),
        sourceType,
        summary: `${affectedLabel} · ${failureRows.length} failed attempts in ${spanMinutes} minutes`,
        title,
      },
    ];
  });
}

export function helpReportPriorityCandidate(row: {
  assignedAdminUserId?: string | null;
  featureArea?: string | null;
  id: string;
  referenceId: string;
  severity?: string | null;
  status: string;
  submittedAt: string;
  submittedByUserId?: string | null;
  updatedAt?: string | null;
  userLabel?: string | null;
}): AdminPriorityCandidate | null {
  if (row.status === "resolved" || row.status === "dismissed") {
    return null;
  }

  const severity: AdminPrioritySeverity =
    row.status === "needs_follow_up" || row.severity === "medium" ? "high" : "medium";
  const userLabel = row.userLabel || row.submittedByUserId || "Unknown user";

  return {
    affectedLabel: userLabel,
    affectedPersonId: row.submittedByUserId ?? undefined,
    category: "needs_attention",
    explanation:
      row.status === "new"
        ? "A person submitted a Help report and no administrator has acknowledged it yet."
        : "A Help report remains open and needs administrator follow-up.",
    firstObservedAt: row.submittedAt,
    incidentKey: `help_report:${row.id}`,
    lastObservedAt: row.updatedAt || row.submittedAt,
    occurrenceCount: 1,
    reason:
      row.status === "new"
        ? "Submitted Help report is waiting for review."
        : "Help report remains open after initial review.",
    recommendedAction: {
      destination: `/admin?tab=helpReports&id=${encodeURIComponent(row.id)}`,
      label: "Open report",
    },
    severity,
    sourceRecordIds: [row.id],
    sourceType: "help_report",
    summary: `${userLabel} · ${row.featureArea || "Unknown area"} · ${row.referenceId}`,
    title: row.status === "new" ? "Help report awaiting review" : "Help report needs follow-up",
  };
}

export function checkpointBacklogPriorityCandidate(rows: Array<{
  accountUserId?: string | null;
  createdAt: string;
  id: string;
}>): AdminPriorityCandidate | null {
  if (rows.length === 0) return null;

  const sorted = [...rows].sort((left, right) =>
    compareIsoAsc(left.createdAt, right.createdAt)
  );
  const oldest = sorted[0];
  const newest = sorted.at(-1) ?? oldest;
  const severity: AdminPrioritySeverity = rows.length >= 10 ? "high" : "medium";

  return {
    category: "review",
    explanation: `${rows.length} Checkpoint run${rows.length === 1 ? "" : "s"} have no saved reviewer decision.`,
    firstObservedAt: oldest.createdAt,
    incidentKey: "checkpoint_review:unreviewed",
    lastObservedAt: newest.createdAt,
    occurrenceCount: rows.length,
    reason: `${rows.length} generated output${rows.length === 1 ? " is" : "s are"} waiting for human review.`,
    recommendedAction: {
      destination: "/admin?tab=checkpoint",
      label: "Open Checkpoint",
    },
    severity,
    sourceRecordIds: rows.map((row) => row.id),
    sourceType: "checkpoint_review",
    summary: `Oldest item: ${oldest.createdAt}`,
    title: "Checkpoint review waiting",
  };
}

export function prioritySourceLabel(sourceType: AdminPrioritySourceType): string {
  return sourceLabelByType[sourceType];
}

function mergePriorityState(
  candidate: AdminPriorityCandidate,
  state: AdminPriorityState | undefined,
  now: Date
): AdminPriority {
  const deferredUntil = state?.deferredUntil ?? null;
  const status =
    state?.status === "deferred" && deferredUntil && Date.parse(deferredUntil) <= now.getTime()
      ? "open"
      : state?.status ?? "open";

  return {
    ...candidate,
    acknowledgedAt: state?.acknowledgedAt ?? null,
    assignedAdminUserId: state?.assignedAdminUserId ?? null,
    category: status === "deferred" ? "deferred" : candidate.category,
    deferredUntil,
    id: candidate.incidentKey,
    lastActionAt: state?.lastActionAt ?? null,
    lastActionByUserId: state?.lastActionByUserId ?? null,
    note: state?.note ?? "",
    status,
  };
}

function shouldShowPriority(priority: AdminPriority, now: Date): boolean {
  if (priority.status === "dismissed") {
    return false;
  }

  if (priority.status !== "deferred") {
    return true;
  }

  return Boolean(priority.deferredUntil && Date.parse(priority.deferredUntil) > now.getTime());
}

function comparePriorities(left: AdminPriority, right: AdminPriority): number {
  return (
    statusRank[right.status] - statusRank[left.status] ||
    severityRank[right.severity] - severityRank[left.severity] ||
    compareIsoAsc(left.firstObservedAt, right.firstObservedAt) ||
    compareIsoDesc(left.lastObservedAt, right.lastObservedAt)
  );
}

function compareIsoAsc(left: string, right: string): number {
  return Date.parse(left) - Date.parse(right);
}

function compareIsoDesc(left: string, right: string): number {
  return Date.parse(right) - Date.parse(left);
}
