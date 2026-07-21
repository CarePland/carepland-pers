"use client";

import { useEffect, useMemo, useState } from "react";
import { browserSupabase as supabase } from "../../lib/platform/browserSupabase";

type AdminRecommendationsCareSubject = {
  careCircleId: string;
  displayName: string;
  id: string;
  unreviewedCount?: number;
};

type AdminRecommendationsAccount = {
  email?: string | null;
  groupIds: string[];
  id: string;
  label: string;
  subjectCount: number;
  unreviewedCount: number;
};

type AdminRecommendationsGroup = {
  careCircleId: string;
  createdAt?: string | null;
  label: string;
  memberUserIds?: string[];
  ownerLabel?: string | null;
  ownerUserId?: string | null;
  subjects: AdminRecommendationsCareSubject[];
  unreviewedCount?: number;
};

type RecommendationEvidence = {
  confidence?: number | null;
  evidence_text?: string | null;
  occurred_at?: string | null;
  source_label?: string | null;
  source_table?: string | null;
  source_type?: string | null;
};

type RecommendationReviewRow = {
  care_subject_id?: string | null;
  careSubjectLabel?: string | null;
  confidence?: number | null;
  created_at?: string | null;
  description?: string | null;
  evidence?: RecommendationEvidence[];
  id: string;
  priority?: string | null;
  reason?: string | null;
  source_table?: string | null;
  source_type?: string | null;
  status?: string | null;
  structured_payload?: Record<string, unknown> | null;
  title?: string | null;
};

type RecommendationScanResult = {
  candidatesGenerated: number;
  created: number;
  recommendations: RecommendationReviewRow[];
  sourcesScanned: number;
  suppressed: number;
  updated: number;
};

type RecommendationReviewAction = "approve" | "convert_to_focus" | "dismiss";
type RecommendationDismissalType =
  | "permanent"
  | "snooze_until_new_evidence"
  | "temporary";
type RecommendationReviewFilter =
  | "queue"
  | "approved"
  | "written_to_focus"
  | "dismissed"
  | "expired"
  | "all";

export type AdminRecommendationsReviewDraftSummary = {
  hasReviewNote: boolean;
  selectedCount: number;
};

type AdminRecommendationsReviewStoredDraft = {
  dismissalType?: RecommendationDismissalType;
  recommendations?: RecommendationReviewRow[];
  reviewFilter?: RecommendationReviewFilter;
  reviewNote?: string;
  reviewScope?: "all_unreviewed" | "group" | "user";
  selectedGroupId?: string;
  selectedIds?: string[];
  selectedSubjectIds?: string[];
  selectedUserId?: string;
  subjectMode?: "all" | "specific";
};

type AdminRecommendationsReviewPanelProps = {
  careSubjects: AdminRecommendationsCareSubject[];
  formatDate: (value: string | null | undefined) => string;
  onDraftSummaryChange?: (
    summary: AdminRecommendationsReviewDraftSummary | null
  ) => void;
};

const GLOBAL_CARE_VIP_GROUP_ID = "all-care-vips";
const adminRecommendationsReviewDraftStorageKey =
  "carepland-admin-todays-focus-review-draft:v1";
const reviewFilterOptions: Array<{
  label: string;
  value: RecommendationReviewFilter;
}> = [
  { label: "Review queue", value: "queue" },
  { label: "Approved", value: "approved" },
  { label: "Written to Focus", value: "written_to_focus" },
  { label: "Dismissed", value: "dismissed" },
  { label: "Expired", value: "expired" },
  { label: "All", value: "all" },
];

export function clearAdminRecommendationsReviewDraftStorage() {
  if (typeof window === "undefined") {
    return;
  }

  window.sessionStorage.removeItem(adminRecommendationsReviewDraftStorageKey);
}

export function AdminRecommendationsReviewPanel({
  careSubjects,
  formatDate,
  onDraftSummaryChange,
}: AdminRecommendationsReviewPanelProps) {
  const [storedDraft] = useState<AdminRecommendationsReviewStoredDraft | null>(
    () => readStoredReviewDraft()
  );
  const [adminAccounts, setAdminAccounts] = useState<AdminRecommendationsAccount[]>(
    []
  );
  const [adminGroups, setAdminGroups] = useState<AdminRecommendationsGroup[]>([]);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [dismissalType, setDismissalType] =
    useState<RecommendationDismissalType>(
      storedDraft?.dismissalType ?? "temporary"
    );
  const [message, setMessage] = useState("");
  const [recommendations, setRecommendations] = useState<RecommendationReviewRow[]>(
    storedDraft?.recommendations ?? []
  );
  const [reviewFilter, setReviewFilter] = useState<RecommendationReviewFilter>(
    storedDraft?.reviewFilter ?? "queue"
  );
  const [reviewNote, setReviewNote] = useState(storedDraft?.reviewNote ?? "");
  const [rowActionNotices, setRowActionNotices] = useState<
    Record<string, string>
  >({});
  const [reviewScope, setReviewScope] = useState<
    "all_unreviewed" | "group" | "user"
  >(storedDraft?.reviewScope ?? "all_unreviewed");
  const [selectedGroupId, setSelectedGroupId] = useState(
    storedDraft?.selectedGroupId ?? ""
  );
  const [selectedIds, setSelectedIds] = useState<Set<string>>(
    new Set(storedDraft?.selectedIds ?? [])
  );
  const [selectedSubjectIds, setSelectedSubjectIds] = useState<Set<string>>(
    new Set(storedDraft?.selectedSubjectIds ?? [])
  );
  const [selectedUserId, setSelectedUserId] = useState(
    storedDraft?.selectedUserId ?? ""
  );
  const [subjectMode, setSubjectMode] = useState<"all" | "specific">(
    storedDraft?.subjectMode ?? "all"
  );

  const fallbackGroups = useMemo<AdminRecommendationsGroup[]>(
    () =>
      careSubjects.length > 0
        ? [
            {
              careCircleId: "accessible-care-vips",
              label: "Accessible Care VIPs",
              subjects: careSubjects,
            },
          ]
        : [],
    [careSubjects]
  );
  const groups = adminGroups.length > 0 ? adminGroups : fallbackGroups;
  const accounts = adminAccounts;
  const selectedAccount =
    accounts.find((account) => account.id === selectedUserId) ??
    accounts[0] ??
    null;
  const groupsForScope = useMemo(() => {
    if (reviewScope !== "user") {
      return groups;
    }

    const accountGroupIds = new Set(selectedAccount?.groupIds ?? []);
    return groups.filter((group) => accountGroupIds.has(group.careCircleId));
  }, [groups, reviewScope, selectedAccount]);
  const selectedGroup =
    groupsForScope.find((group) => group.careCircleId === selectedGroupId) ??
    groupsForScope[0] ??
    null;
  const targetSubjects = useMemo(() => {
    if (reviewScope === "all_unreviewed") {
      const globalGroup = groups.find(
        (group) => group.careCircleId === GLOBAL_CARE_VIP_GROUP_ID
      );

      return uniqueSubjects(
        globalGroup?.subjects ?? groups.flatMap((group) => group.subjects)
      );
    }

    if (reviewScope === "user" && subjectMode === "all") {
      return uniqueSubjects(groupsForScope.flatMap((group) => group.subjects));
    }

    if (!selectedGroup) {
      return [];
    }

    if (subjectMode === "all") {
      return selectedGroup.subjects;
    }

    return selectedGroup.subjects.filter((subject) =>
      selectedSubjectIds.has(subject.id)
    );
  }, [
    groups,
    groupsForScope,
    reviewScope,
    selectedGroup,
    selectedSubjectIds,
    subjectMode,
  ]);
  const selectableIds = useMemo(
    () =>
      filteredRecommendations(recommendations, reviewFilter)
        .filter((recommendation) => isReviewableStatus(recommendation.status))
        .map((recommendation) => recommendation.id),
    [recommendations, reviewFilter]
  );
  const visibleRecommendations = useMemo(
    () => filteredRecommendations(recommendations, reviewFilter),
    [recommendations, reviewFilter]
  );
  const allSelected =
    selectableIds.length > 0 &&
    selectableIds.every((id) => selectedIds.has(id));
  const selectedCount = selectableIds.filter((id) => selectedIds.has(id)).length;
  const totalUnreviewedCount = groups.reduce(
    (total, group) => total + (group.unreviewedCount ?? 0),
    0
  );
  const selectedGroupUnreviewedCount = selectedGroup?.unreviewedCount ?? 0;
  const selectedAccountUnreviewedCount = selectedAccount?.unreviewedCount ?? 0;

  useEffect(() => {
    void loadAdminGroups();
  }, []);

  useEffect(() => {
    writeStoredReviewDraft({
      dismissalType,
      recommendations,
      reviewFilter,
      reviewNote,
      reviewScope,
      selectedGroupId,
      selectedIds: Array.from(selectedIds),
      selectedSubjectIds: Array.from(selectedSubjectIds),
      selectedUserId,
      subjectMode,
    });
  }, [
    dismissalType,
    recommendations,
    reviewFilter,
    reviewNote,
    reviewScope,
    selectedGroupId,
    selectedIds,
    selectedSubjectIds,
    selectedUserId,
    subjectMode,
  ]);

  useEffect(() => {
    const summary =
      selectedCount > 0 || reviewNote.trim()
        ? {
            hasReviewNote: Boolean(reviewNote.trim()),
            selectedCount,
          }
        : null;

    onDraftSummaryChange?.(summary);
  }, [onDraftSummaryChange, reviewNote, selectedCount]);

  useEffect(() => {
    if (!selectedUserId && accounts[0]?.id) {
      setSelectedUserId(accounts[0].id);
    }
  }, [accounts, selectedUserId]);

  useEffect(() => {
    if (
      (!selectedGroupId ||
        !groupsForScope.some((group) => group.careCircleId === selectedGroupId)) &&
      groupsForScope[0]?.careCircleId
    ) {
      setSelectedGroupId(groupsForScope[0].careCircleId);
    }
  }, [groupsForScope, selectedGroupId]);

  useEffect(() => {
    if (subjectMode !== "specific" || selectedSubjectIds.size > 0) {
      return;
    }

    const firstSubjectId = selectedGroup?.subjects[0]?.id;
    if (firstSubjectId) {
      setSelectedSubjectIds(new Set([firstSubjectId]));
    }
  }, [selectedGroup, selectedSubjectIds.size, subjectMode]);

  async function authHeaders() {
    const {
      data: { session },
      error,
    } = await supabase.auth.getSession();

    if (error) {
      throw error;
    }

    const accessToken = session?.access_token;

    if (!accessToken) {
      throw new Error("Please sign in before reviewing recommendations.");
    }

    return {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    };
  }

  async function loadAdminGroups() {
    setBusyAction("groups");

    try {
      const headers = await authHeaders();
      const response = await fetch("/api/admin/todays-focus-review/context", {
        headers,
      });
      const body = (await response.json().catch(() => ({}))) as {
        accounts?: AdminRecommendationsAccount[];
        error?: string;
        groups?: AdminRecommendationsGroup[];
        ok?: boolean;
      };

      if (!response.ok || body.ok === false) {
        throw new Error(body.error ?? "Care VIP groups could not be loaded.");
      }

      setAdminAccounts(body.accounts ?? []);
      setAdminGroups(body.groups ?? []);
    } catch (error) {
      setAdminAccounts([]);
      setAdminGroups([]);
      setMessage(
        error instanceof Error
          ? error.message
          : "Care VIP groups could not be loaded."
      );
    } finally {
      setBusyAction(null);
    }
  }

  async function loadRecommendations() {
    if (targetSubjects.length === 0) {
      setRecommendations([]);
      setSelectedIds(new Set());
      setMessage("Choose at least one Care VIP before loading recommendations.");
      return;
    }

    setBusyAction("load");
    setMessage("");

    try {
      const headers = await authHeaders();
      const loaded = await Promise.all(
        targetSubjects.map(async (subject) => {
          const response = await fetch(
            `/api/personal/recommendations?personId=${encodeURIComponent(
              subject.id
            )}&status=all`,
            { headers }
          );
          const body = (await response.json().catch(() => ({}))) as {
            error?: string;
            ok?: boolean;
            recommendations?: RecommendationReviewRow[];
          };

          if (!response.ok || body.ok === false) {
            throw new Error(
              body.error ??
                `Recommendations could not be loaded for ${subject.displayName}.`
            );
          }

          return (body.recommendations ?? []).map((recommendation) => ({
            ...recommendation,
            careSubjectLabel: subject.displayName,
          }));
        })
      );
      const rows = loaded.flat();

      setRecommendations(rows);
      setRowActionNotices({});
      setSelectedIds(new Set());
      await loadAdminGroups();
      setMessage(
        rows.length
          ? `Loaded ${rows.length} recommendations across ${targetSubjects.length} Care VIP(s).`
          : "No recommendations found yet."
      );
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Recommendations could not be loaded."
      );
    } finally {
      setBusyAction(null);
    }
  }

  async function scanRecommendations() {
    if (targetSubjects.length === 0) {
      setMessage("Choose at least one Care VIP before finding new candidates.");
      return;
    }

    setBusyAction("scan");
    setMessage(
      `Finding new candidates across ${targetSubjects.length} Care VIP(s)...`
    );

    try {
      const headers = await authHeaders();
      const scanned: RecommendationScanResult[] = [];
      const failures: string[] = [];

      for (const [index, subject] of targetSubjects.entries()) {
        setMessage(
          `Finding new candidates ${index + 1} of ${
            targetSubjects.length
          }: ${subject.displayName}`
        );

        try {
          const response = await fetch("/api/personal/recommendations", {
            body: JSON.stringify({ personId: subject.id }),
            headers,
            method: "POST",
          });
          const body = (await response.json().catch(() => ({}))) as {
            candidatesGenerated?: number;
            created?: number;
            error?: string;
            ok?: boolean;
            recommendations?: RecommendationReviewRow[];
            sourcesScanned?: number;
            suppressed?: number;
            updated?: number;
          };

          if (!response.ok || body.ok === false) {
            throw new Error(
              body.error ??
                `Recommendations could not be scanned for ${subject.displayName}.`
            );
          }

          scanned.push({
            candidatesGenerated: body.candidatesGenerated ?? 0,
            created: body.created ?? 0,
            recommendations: (body.recommendations ?? []).map((recommendation) => ({
              ...recommendation,
              careSubjectLabel: subject.displayName,
            })),
            sourcesScanned: body.sourcesScanned ?? 0,
            suppressed: body.suppressed ?? 0,
            updated: body.updated ?? 0,
          });
        } catch (error) {
          failures.push(
            `${subject.displayName}: ${
              error instanceof Error ? error.message : "scan failed"
            }`
          );
        }
      }
      const rows = scanned.flatMap((result) => result.recommendations);

      setRecommendations(rows);
      setRowActionNotices({});
      setSelectedIds(new Set());
      await loadAdminGroups();
      setMessage(formatScanStatus(scanned, targetSubjects.length, failures));
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "New candidates could not be found."
      );
    } finally {
      setBusyAction(null);
    }
  }

  async function reviewRecommendation(
    recommendationId: string,
    action: RecommendationReviewAction
  ) {
    await reviewRecommendations([recommendationId], action);
  }

  async function reviewSelected(action: RecommendationReviewAction) {
    await reviewRecommendations(
      selectableIds.filter((id) => selectedIds.has(id)),
      action
    );
  }

  async function reviewRecommendations(
    recommendationIds: string[],
    action: RecommendationReviewAction
  ) {
    if (recommendationIds.length === 0) {
      setMessage("Select at least one recommendation first.");
      return;
    }

    if (action === "dismiss" && !reviewNote.trim()) {
      setMessage("Add a short dismissal reason before dismissing.");
      return;
    }

    setBusyAction(action);
    setMessage("");

    try {
      const headers = await authHeaders();
      const recommendationsById = new Map(
        recommendations.map((recommendation) => [recommendation.id, recommendation])
      );
      let completed = 0;
      const completedIds: string[] = [];

      for (const recommendationId of recommendationIds) {
        const recommendation = recommendationsById.get(recommendationId);
        const personId = recommendation?.care_subject_id;

        if (!personId) {
          throw new Error("Recommendation is missing its Care VIP.");
        }

        const response = await fetch("/api/personal/recommendations", {
          body: JSON.stringify({
            action,
            dismissalType: action === "dismiss" ? dismissalType : undefined,
            personId,
            recommendationId,
            reviewNote,
          }),
          headers,
          method: "PATCH",
        });
        const body = (await response.json().catch(() => ({}))) as {
          error?: string;
          ok?: boolean;
        };

        if (!response.ok || body.ok === false) {
          throw new Error(
            body.error ?? "Recommendation review could not be saved."
          );
        }

        completed += 1;
        completedIds.push(recommendationId);
      }

      const nextStatus = statusForReviewAction(action);
      const notice = noticeForReviewAction(action);

      setRecommendations((current) =>
        current.map((recommendation) =>
          completedIds.includes(recommendation.id)
            ? { ...recommendation, status: nextStatus }
            : recommendation
        )
      );
      setRowActionNotices((current) => {
        const next = { ...current };

        for (const id of completedIds) {
          next[id] = notice;
        }

        return next;
      });
      setMessage(`${actionLabel(action)} saved for ${completed} recommendation(s).`);
      setReviewNote("");
      setSelectedIds(new Set());
      clearAdminRecommendationsReviewDraftStorage();
      await loadAdminGroups();

      if (action === "convert_to_focus" || action === "dismiss") {
        window.setTimeout(() => {
          setRecommendations((current) =>
            current.filter(
              (recommendation) => !completedIds.includes(recommendation.id)
            )
          );
          setRowActionNotices((current) => {
            const next = { ...current };

            for (const id of completedIds) {
              delete next[id];
            }

            return next;
          });
        }, 2500);
      }
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Recommendation review could not be saved."
      );
    } finally {
      setBusyAction(null);
    }
  }

  function resetSelectionAfterScopeChange() {
    setRecommendations([]);
    setSelectedIds(new Set());
    setMessage("");
  }

  function changeScope(nextScope: "all_unreviewed" | "group" | "user") {
    setReviewScope(nextScope);
    setSelectedSubjectIds(new Set());
    setSubjectMode("all");
    resetSelectionAfterScopeChange();
  }

  function toggleSelected(id: string) {
    setSelectedIds((current) => {
      const next = new Set(current);

      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }

      return next;
    });
  }

  function toggleAllSelected() {
    setSelectedIds((current) => {
      if (allSelected) {
        return new Set(
          Array.from(current).filter((id) => !selectableIds.includes(id))
        );
      }

      return new Set([...Array.from(current), ...selectableIds]);
    });
  }

  function toggleSubject(subjectId: string) {
    setSelectedSubjectIds((current) => {
      const next = new Set(current);

      if (next.has(subjectId)) {
        next.delete(subjectId);
      } else {
        next.add(subjectId);
      }

      return next;
    });
    resetSelectionAfterScopeChange();
  }

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-slate-900">
            Today&apos;s Focus Review
          </h3>
          <p className="mt-1 text-sm text-slate-600">
            Find candidates from existing CarePland context, review them, and write
            approved items to Today&apos;s Focus.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <div className="rounded-md bg-slate-100 px-3 py-2 text-sm font-semibold text-slate-700">
            {totalUnreviewedCount} unreviewed
          </div>
          <button
            className="rounded-md border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 disabled:text-slate-400"
            disabled={Boolean(busyAction) || targetSubjects.length === 0}
            onClick={loadRecommendations}
            type="button"
          >
            {busyAction === "load" ? "Loading..." : "Review"}
          </button>
          <button
            className="rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:bg-slate-400"
            disabled={Boolean(busyAction) || targetSubjects.length === 0}
            onClick={scanRecommendations}
            type="button"
          >
            {busyAction === "scan" ? "Finding..." : "Find New"}
          </button>
        </div>
      </div>

      <div className="mt-5 grid gap-3">
        <div className="grid gap-3 lg:grid-cols-[220px_minmax(0,1fr)_240px]">
          <label className="block text-sm font-medium text-slate-700">
            Review scope
            <select
              className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2 text-base"
              disabled={busyAction === "groups"}
              onChange={(event) =>
                changeScope(
                  event.target.value as "all_unreviewed" | "group" | "user"
                )
              }
              value={reviewScope}
            >
              <option value="all_unreviewed">
                All Care VIPs ({totalUnreviewedCount} unreviewed)
              </option>
              <option value="user">User / account</option>
              <option value="group">Care VIP group</option>
            </select>
          </label>

          {reviewScope === "user" ? (
            <label className="block text-sm font-medium text-slate-700">
              User / account
              <select
                className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2 text-base"
                disabled={busyAction === "groups"}
                onChange={(event) => {
                  setSelectedUserId(event.target.value);
                  setSelectedGroupId("");
                  setSelectedSubjectIds(new Set());
                  setSubjectMode("all");
                  resetSelectionAfterScopeChange();
                }}
                value={selectedAccount?.id ?? ""}
              >
                {accounts.length === 0 ? (
                  <option value="">No users available</option>
                ) : null}
                {accounts.map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.label}
                    {account.email ? ` / ${account.email}` : ""}
                    {` - ${account.subjectCount} Care VIP(s), ${account.unreviewedCount} unreviewed`}
                  </option>
                ))}
              </select>
            </label>
          ) : reviewScope === "group" ? (
            <label className="block text-sm font-medium text-slate-700">
              Care VIP group
              <select
                className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2 text-base"
                disabled={busyAction === "groups"}
                onChange={(event) => {
                  setSelectedGroupId(event.target.value);
                  setSelectedSubjectIds(new Set());
                  setSubjectMode("all");
                  resetSelectionAfterScopeChange();
                }}
                value={selectedGroup?.careCircleId ?? ""}
              >
                {groups.length === 0 ? (
                  <option value="">No Care VIP groups available</option>
                ) : null}
                {groups.map((group) => (
                  <option key={group.careCircleId} value={group.careCircleId}>
                    {group.label}
                    {group.subjects.length ? ` (${group.subjects.length})` : ""}
                    {group.unreviewedCount
                      ? ` - ${group.unreviewedCount} unreviewed`
                      : ""}
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <div className="self-end rounded-md bg-slate-50 px-3 py-2 text-sm text-slate-600">
              Queue includes every active Care VIP visible to Admin.
            </div>
          )}

          {reviewScope === "user" ? (
            <label className="block text-sm font-medium text-slate-700">
              Care VIP group
              <select
                className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2 text-base"
                disabled={busyAction === "groups" || groupsForScope.length === 0}
                onChange={(event) => {
                  setSelectedGroupId(event.target.value);
                  setSelectedSubjectIds(new Set());
                  setSubjectMode("all");
                  resetSelectionAfterScopeChange();
                }}
                value={selectedGroup?.careCircleId ?? ""}
              >
                {groupsForScope.length === 0 ? (
                  <option value="">No Care VIP groups available</option>
                ) : null}
                {groupsForScope.map((group) => (
                  <option key={group.careCircleId} value={group.careCircleId}>
                    {group.label}
                    {group.subjects.length ? ` (${group.subjects.length})` : ""}
                    {group.unreviewedCount
                      ? ` - ${group.unreviewedCount} unreviewed`
                      : ""}
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <div className="self-end rounded-md bg-slate-100 px-3 py-2 text-sm text-slate-600">
              {targetSubjects.length} Care VIP(s) selected
            </div>
          )}
        </div>

        {reviewScope === "user" ? (
          <div className="rounded-md bg-slate-100 px-3 py-2 text-sm text-slate-600">
            {selectedAccount
              ? `${selectedAccount.label}: ${selectedAccount.subjectCount} Care VIP(s), ${selectedAccountUnreviewedCount} unreviewed${selectedAccount.subjectCount === 0 ? " - no recommendation targets yet" : ""}`
              : "Choose a user/account"}
          </div>
        ) : null}

        {reviewScope !== "all_unreviewed" && selectedGroup ? (
          <div className="grid gap-3 lg:grid-cols-[1fr_220px]">
            <div className="rounded-md bg-slate-100 px-3 py-2 text-sm text-slate-600">
              {targetSubjects.length} Care VIP(s) selected;{" "}
              {selectedGroupUnreviewedCount} unreviewed in group
            </div>
          </div>
        ) : null}

        {reviewScope !== "all_unreviewed" && selectedGroup ? (
          <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
            <div className="flex flex-wrap gap-3">
              <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                <input
                  checked={subjectMode === "all"}
                  name="todays-focus-subject-mode"
                  onChange={() => {
                    setSubjectMode("all");
                    setSelectedSubjectIds(new Set());
                    resetSelectionAfterScopeChange();
                  }}
                  type="radio"
                />
                <span>
                  {reviewScope === "user"
                    ? "All Care VIPs for user"
                    : "All Care VIPs in group"}
                </span>
              </label>
              <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                <input
                  checked={subjectMode === "specific"}
                  name="todays-focus-subject-mode"
                  onChange={() => {
                    setSubjectMode("specific");
                    setSelectedSubjectIds(
                      selectedGroup.subjects[0]?.id
                        ? new Set([selectedGroup.subjects[0].id])
                        : new Set()
                    );
                    resetSelectionAfterScopeChange();
                  }}
                  type="radio"
                />
                <span>Specific Care VIPs</span>
              </label>
            </div>

            {subjectMode === "specific" ? (
              <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {selectedGroup.subjects.map((subject) => (
                  <label
                    className="flex items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700"
                    key={subject.id}
                  >
                    <input
                      checked={selectedSubjectIds.has(subject.id)}
                      onChange={() => toggleSubject(subject.id)}
                      type="checkbox"
                    />
                    <span>
                      {subject.displayName}
                      {subject.unreviewedCount
                        ? ` (${subject.unreviewedCount} unreviewed)`
                        : ""}
                    </span>
                  </label>
                ))}
              </div>
            ) : null}
          </div>
        ) : null}
      </div>

      {message ? (
        <div className="mt-4 whitespace-pre-line rounded-md bg-slate-100 p-3 text-sm text-slate-700">
          {message}
        </div>
      ) : null}

      <div className="mt-5 flex flex-wrap items-center gap-2">
        <span className="text-sm font-semibold text-slate-700">Show</span>
        {reviewFilterOptions.map((option) => (
          <button
            className={`rounded-md border px-3 py-2 text-sm font-semibold transition ${
              reviewFilter === option.value
                ? "border-slate-900 bg-slate-900 text-white"
                : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
            }`}
            key={option.value}
            onClick={() => {
              setReviewFilter(option.value);
              setSelectedIds(new Set());
            }}
            type="button"
          >
            {option.label}
          </button>
        ))}
      </div>

      <div className="mt-5 grid gap-3 rounded-md border border-slate-200 bg-slate-50 p-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
            <input
              checked={allSelected}
              disabled={selectableIds.length === 0 || Boolean(busyAction)}
              onChange={toggleAllSelected}
              type="checkbox"
            />
            <span>Select all</span>
          </label>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm text-slate-600">
              {selectedCount} selected
            </span>
            <button
              className="rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 disabled:text-slate-400"
              disabled={Boolean(busyAction) || selectedCount === 0}
              onClick={() => reviewSelected("approve")}
              type="button"
            >
              Approve
            </button>
            <button
              className="rounded-md bg-slate-900 px-3 py-2 text-sm font-semibold text-white disabled:bg-slate-400"
              disabled={Boolean(busyAction) || selectedCount === 0}
              onClick={() => reviewSelected("convert_to_focus")}
              type="button"
            >
              Write to Focus
            </button>
            <button
              className="rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 disabled:text-slate-400"
              disabled={Boolean(busyAction) || selectedCount === 0}
              onClick={() => reviewSelected("dismiss")}
              type="button"
            >
              Dismiss
            </button>
          </div>
        </div>

        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_260px]">
          <label className="block text-sm font-medium text-slate-700">
            Review note
            <textarea
              className="mt-2 min-h-20 w-full rounded-md border border-slate-300 px-3 py-2 text-base"
              onChange={(event) => setReviewNote(event.target.value)}
              placeholder="Required when dismissing. Optional context for approvals or writes."
              value={reviewNote}
            />
          </label>
          <label className="block text-sm font-medium text-slate-700">
            Dismissal type
            <select
              className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2 text-base"
              onChange={(event) =>
                setDismissalType(event.target.value as RecommendationDismissalType)
              }
              value={dismissalType}
            >
              <option value="temporary">Temporary - not today</option>
              <option value="snooze_until_new_evidence">
                Snooze until new evidence
              </option>
              <option value="permanent">
                Permanent - do not suggest from same evidence
              </option>
            </select>
          </label>
        </div>
      </div>

      <div className="mt-4 grid gap-3">
        {visibleRecommendations.length === 0 ? (
          <div className="rounded-md border border-dashed border-slate-300 p-4 text-sm text-slate-600">
            {recommendations.length === 0
              ? "Review or find new to see recommendation candidates."
              : "No recommendations match this view."}
          </div>
        ) : null}

        {visibleRecommendations.map((recommendation) => {
          const reviewable = isReviewableStatus(recommendation.status);
          const trace = recommendationTrace(recommendation);
          const rowNotice = rowActionNotices[recommendation.id] ?? "";

          return (
            <article
              className="rounded-lg border border-slate-200 p-4"
              key={recommendation.id}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <label className="flex min-w-0 flex-1 items-start gap-3">
                  <input
                    checked={selectedIds.has(recommendation.id)}
                    className="mt-1"
                    disabled={!reviewable || Boolean(busyAction)}
                    onChange={() => toggleSelected(recommendation.id)}
                    type="checkbox"
                  />
                  <span className="min-w-0">
                    <span className="block text-base font-semibold text-slate-900">
                      {recommendation.title || "Untitled recommendation"}
                    </span>
                    <span className="mt-1 block text-xs font-semibold uppercase text-slate-500">
                      Care VIP: {recommendation.careSubjectLabel ?? "Unknown"}
                    </span>
                    {recommendation.description ? (
                      <span className="mt-1 block text-sm text-slate-600">
                        {recommendation.description}
                      </span>
                    ) : null}
                  </span>
                </label>
                <div className="flex flex-wrap gap-2 text-xs font-semibold">
                  <span className="rounded-full bg-slate-100 px-2 py-1 text-slate-700">
                    {priorityLabel(recommendation.priority)}
                  </span>
                  <span className="rounded-full bg-slate-100 px-2 py-1 text-slate-700">
                    {statusLabel(recommendation.status)}
                  </span>
                  <span className="rounded-full bg-slate-100 px-2 py-1 text-slate-700">
                    {confidenceLabel(recommendation.confidence)}
                  </span>
                </div>
              </div>

              {trace.returnedFromSnoozeRationale ? (
                <div className="mt-3 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                  <p className="font-semibold">Why it is back</p>
                  <p className="mt-1">{trace.returnedFromSnoozeRationale}</p>
                </div>
              ) : null}

              <div className="mt-3 grid gap-3 text-sm text-slate-700 lg:grid-cols-2">
                <div>
                  <p className="font-semibold text-slate-900">Why it exists</p>
                  <p className="mt-1">{recommendation.reason || "No reason saved."}</p>
                  <p className="mt-2 text-xs text-slate-500">
                    Source: {recommendation.source_type ?? "unknown"}
                    {recommendation.source_table
                      ? ` / ${recommendation.source_table}`
                      : ""}
                  </p>
                </div>
                <div>
                  <p className="font-semibold text-slate-900">Decision trace</p>
                  <p className="mt-1">
                    {trace.priorityRationale || "No ranking rationale saved."}
                  </p>
                  {trace.confidenceRationale ? (
                    <p className="mt-1 text-xs text-slate-500">
                      {trace.confidenceRationale}
                    </p>
                  ) : null}
                  {trace.keywords.length > 0 ? (
                    <p className="mt-1 text-xs text-slate-500">
                      Keywords: {trace.keywords.join(", ")}
                    </p>
                  ) : null}
                </div>
              </div>

              <div className="mt-3 rounded-md bg-slate-50 p-3 text-sm text-slate-700">
                <p className="font-semibold text-slate-900">Evidence</p>
                {recommendation.evidence?.length ? (
                  <ul className="mt-2 grid gap-2">
                    {recommendation.evidence.slice(0, 3).map((item, index) => (
                      <li key={`${recommendation.id}-evidence-${index}`}>
                        <span className="text-xs font-semibold uppercase text-slate-500">
                          {item.source_label ||
                            item.source_type ||
                            item.source_table ||
                            "source"}
                          {item.occurred_at ? ` - ${formatDate(item.occurred_at)}` : ""}
                        </span>
                        <span className="block">{item.evidence_text}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-1">No evidence rows saved.</p>
                )}
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  className="rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 disabled:text-slate-400"
                  disabled={!reviewable || Boolean(busyAction)}
                  onClick={() => reviewRecommendation(recommendation.id, "approve")}
                  type="button"
                >
                  Approve
                </button>
                <button
                  className="rounded-md bg-slate-900 px-3 py-2 text-sm font-semibold text-white disabled:bg-slate-400"
                  disabled={!reviewable || Boolean(busyAction)}
                  onClick={() =>
                    reviewRecommendation(recommendation.id, "convert_to_focus")
                  }
                  type="button"
                >
                  Write to Focus
                </button>
                <button
                  className="rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 disabled:text-slate-400"
                  disabled={!reviewable || Boolean(busyAction)}
                  onClick={() => reviewRecommendation(recommendation.id, "dismiss")}
                  type="button"
                >
                  Dismiss
                </button>
                {rowNotice ? (
                  <span className="inline-flex items-center rounded-md bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-800">
                    {rowNotice}
                  </span>
                ) : null}
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

function isReviewableStatus(status: string | null | undefined) {
  return !status || status === "candidate" || status === "approved";
}

function filteredRecommendations(
  recommendations: RecommendationReviewRow[],
  filter: RecommendationReviewFilter
) {
  return recommendations.filter((recommendation) => {
    const status = recommendation.status || "candidate";

    switch (filter) {
      case "queue":
        return status === "candidate" || status === "approved";
      case "approved":
        return status === "approved";
      case "written_to_focus":
        return status === "converted_to_focus";
      case "dismissed":
        return status === "dismissed";
      case "expired":
        return status === "expired";
      case "all":
      default:
        return true;
    }
  });
}

function statusForReviewAction(action: RecommendationReviewAction) {
  switch (action) {
    case "approve":
      return "approved";
    case "convert_to_focus":
      return "converted_to_focus";
    case "dismiss":
      return "dismissed";
  }
}

function noticeForReviewAction(action: RecommendationReviewAction) {
  switch (action) {
    case "approve":
      return "Approved";
    case "convert_to_focus":
      return "Written to Focus";
    case "dismiss":
      return "Dismissed";
  }
}

function statusLabel(status: string | null | undefined) {
  switch (status || "candidate") {
    case "approved":
      return "Approved";
    case "converted_to_focus":
      return "Written to Focus";
    case "dismissed":
      return "Dismissed";
    case "expired":
      return "Expired";
    case "candidate":
    default:
      return "Candidate";
  }
}

function actionLabel(action: RecommendationReviewAction) {
  switch (action) {
    case "approve":
      return "Approval";
    case "convert_to_focus":
      return "Focus write";
    case "dismiss":
      return "Dismissal";
  }
}

function confidenceLabel(confidence: number | null | undefined) {
  if (typeof confidence !== "number" || !Number.isFinite(confidence)) {
    return "confidence n/a";
  }

  return `${Math.round(confidence * 100)}% confidence`;
}

function priorityLabel(priority: string | null | undefined) {
  switch (priority) {
    case "strong":
    case "critical":
      return "Strong recommendation";
    case "high":
      return "High importance";
    case "low":
      return "Low importance";
    case "normal":
    default:
      return "Normal importance";
  }
}

function recommendationTrace(recommendation: RecommendationReviewRow) {
  const trace = recommendation.structured_payload?.recommendationTrace;
  const snoozeReturn = recommendation.structured_payload?.snoozeReturn;

  if (!trace || typeof trace !== "object") {
    return {
      confidenceRationale: "",
      keywords: [] as string[],
      priorityRationale: "",
      returnedFromSnoozeRationale: snoozeReturnRationale(snoozeReturn),
    };
  }

  const traceRecord = trace as Record<string, unknown>;
  const priorityDecision = traceRecord.priorityDecision as
    | Record<string, unknown>
    | undefined;
  const confidenceDecision = traceRecord.confidenceDecision as
    | Record<string, unknown>
    | undefined;
  const matchedKeywords = traceRecord.matchedKeywords;

  return {
    confidenceRationale:
      typeof confidenceDecision?.rationale === "string"
        ? confidenceDecision.rationale
        : "",
    keywords: Array.isArray(matchedKeywords)
      ? matchedKeywords.filter((value): value is string => typeof value === "string")
      : [],
    priorityRationale:
      typeof priorityDecision?.rationale === "string"
        ? recommendationPriorityRationaleLabel(priorityDecision.rationale)
        : "",
    returnedFromSnoozeRationale: snoozeReturnRationale(snoozeReturn),
  };
}

function recommendationPriorityRationaleLabel(rationale: string) {
  return rationale
    .replace(/\bcritical\b/gi, "strong")
    .replace(/\burgent\b/gi, "strong")
    .replace(/\bemergency\b/gi, "high-importance");
}

function snoozeReturnRationale(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return "";
  }

  const record = value as Record<string, unknown>;
  return typeof record.rationale === "string" ? record.rationale : "";
}

function uniqueSubjects(subjects: AdminRecommendationsCareSubject[]) {
  return Array.from(
    subjects
      .reduce<Map<string, AdminRecommendationsCareSubject>>((unique, subject) => {
        if (!unique.has(subject.id)) {
          unique.set(subject.id, subject);
        }

        return unique;
      }, new Map())
      .values()
  );
}

function sumBy<T, K extends keyof T>(items: T[], key: K) {
  return items.reduce((total, item) => {
    const value = item[key];
    return total + (typeof value === "number" ? value : 0);
  }, 0);
}

function formatScanStatus(
  scanned: RecommendationScanResult[],
  targetCount: number,
  failures: string[]
) {
  const summary =
    scanned.length > 0
      ? `Found candidates from ${sumBy(
          scanned,
          "sourcesScanned"
        )} sources across ${scanned.length} of ${targetCount} Care VIP(s). Generated ${sumBy(
          scanned,
          "candidatesGenerated"
        )} candidates, created ${sumBy(scanned, "created")}, updated ${sumBy(
          scanned,
          "updated"
        )}, suppressed ${sumBy(scanned, "suppressed")}.`
      : `No candidates were generated. Checked ${targetCount} Care VIP(s).`;

  if (failures.length === 0) {
    return summary;
  }

  return `${summary}\n\nSkipped ${failures.length} issue(s):\n${failures
    .map((failure) => `- ${failure}`)
    .join("\n")}`;
}

function readStoredReviewDraft(): AdminRecommendationsReviewStoredDraft | null {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const rawValue = window.sessionStorage.getItem(
      adminRecommendationsReviewDraftStorageKey
    );

    if (!rawValue) {
      return null;
    }

    const parsed = JSON.parse(rawValue) as AdminRecommendationsReviewStoredDraft;
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}

function writeStoredReviewDraft(draft: AdminRecommendationsReviewStoredDraft) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.sessionStorage.setItem(
      adminRecommendationsReviewDraftStorageKey,
      JSON.stringify(draft)
    );
  } catch {
    // Session draft persistence is helpful, not required for review actions.
  }
}
