"use client";

import type { ReactNode } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { browserSupabase as supabase } from "../../lib/platform/browserSupabase";

import type { HealthFocusTopicSummary } from "@/app/components/personal/healthTopics/HealthFocusCard";
import {
  HealthFocusTopicDetail,
  type HealthFocusTopicDetailData,
} from "@/app/components/personal/healthTopics/HealthFocusTopicDetail";

type CheckpointAccount = {
  careSubjects: CheckpointCareSubject[];
  email?: string | null;
  id: string;
  label: string;
};

type CheckpointCareSubject = {
  careCircleId: string;
  displayName: string;
  id: string;
  subjectType: string;
};

type CheckpointAppointment = {
  id: string;
  label: string;
  providerName?: string | null;
  startsAt?: string | null;
  status?: string | null;
  title: string;
};

type CheckpointRun = {
  accountUserId: string;
  appointmentId: string | null;
  appointmentLabel: string;
  careSubjectId: string | null;
  checkpointDecision: string | null;
  createdAt: string;
  decisionTrace?: Record<string, unknown>;
  effectiveEvidenceRange: Record<string, unknown>;
  evaluatedAt: string | null;
  evaluationTags: string[];
  evaluatorNotes: string;
  evidencePacket: Record<string, unknown>;
  generatedAt: string;
  id: string;
  modelMetadata: Record<string, unknown>;
  promptKey: string | null;
  promptVersion: string | null;
  proposedOutput: Record<string, unknown>;
  scope: {
    careVipName: string;
    startsAt?: string | null;
    status?: string | null;
  };
  structuredInterpretation: {
    decisionQualityReviews?: Array<{
      category?: string;
      checkpointReview?: string;
      decision?: string;
      evidence?: string[];
      itemText?: string;
      suggestedBetterDecision?: string;
      userWorkOutcome?: string;
    }>;
    evaluationQuestion?: string;
    platformRule?: string;
    observations?: Array<{
      category?: string;
      confidence?: number;
      kind?: string;
      observation?: string;
      reasonsItMightMislead?: string[];
      supportingEvidenceRefs?: string[];
    }>;
    usefulnessFocus?: string[];
  };
};

type DecisionQualityReview = NonNullable<
  CheckpointRun["structuredInterpretation"]["decisionQualityReviews"]
>[number];

type CheckpointReviewType = "careprep" | "health_stories";

const decisions = [
  { label: "Proceed", value: "proceed" },
  { label: "Needs Work", value: "needs_work" },
  { label: "Needs More Evidence", value: "needs_more_evidence" },
  { label: "Hold", value: "hold" },
  { label: "Suppress", value: "suppress" },
];

const evaluationTags = [
  ["grounded", "Grounded"],
  ["useful", "Useful"],
  ["specific", "Specific"],
  ["appropriately_cautious", "Appropriately cautious"],
  ["eliminated_user_work", "Eliminated user work"],
  ["connected_existing_knowledge", "Connected existing knowledge"],
  ["saved_interpretation_work", "Saved interpretation work"],
  ["appointment_specific_usefulness", "Appointment-specific"],
  ["reduced_interpretation_work", "Reduced interpretation work"],
  ["appropriate_information_request", "Appropriate information request"],
  ["generic", "Generic"],
  ["requested_known_information", "Requested known information"],
  ["duplicated_existing_evidence", "Duplicated existing evidence"],
  ["reassigned_work_to_user", "Reassigned work to user"],
  ["merely_restated_evidence", "Merely restated evidence"],
  ["decision_stopped_one_step_too_early", "Decision stopped one step too early"],
  ["unsupported_conclusion", "Unsupported conclusion"],
  ["missed_important_evidence", "Missed important evidence"],
  ["missing_preparation", "Missing preparation"],
  ["unnecessary_preparation", "Unnecessary preparation"],
  ["irrelevant_emphasis", "Irrelevant emphasis"],
  ["too_verbose", "Too verbose"],
  ["too_vague", "Too vague"],
  ["technically_true_not_useful", "Technically true, not useful"],
] as const;

export function AdminCheckpointPanel({
  formatDate,
}: {
  formatDate: (value: string | null | undefined) => string;
}) {
  const [accounts, setAccounts] = useState<CheckpointAccount[]>([]);
  const [appointments, setAppointments] = useState<CheckpointAppointment[]>([]);
  const [busy, setBusy] = useState("");
  const [decision, setDecision] = useState("needs_work");
  const [healthStories, setHealthStories] = useState<HealthFocusTopicSummary[]>([]);
  const [healthStoryDetail, setHealthStoryDetail] =
    useState<HealthFocusTopicDetailData | null>(null);
  const [history, setHistory] = useState<CheckpointRun[]>([]);
  const [message, setMessage] = useState("");
  const messageRef = useRef<HTMLDivElement | null>(null);
  const [notes, setNotes] = useState("");
  const [reviewType, setReviewType] = useState<CheckpointReviewType>("careprep");
  const [run, setRun] = useState<CheckpointRun | null>(null);
  const [selectedAccountId, setSelectedAccountId] = useState("");
  const [selectedAppointmentId, setSelectedAppointmentId] = useState("");
  const [selectedCareSubjectId, setSelectedCareSubjectId] = useState("");
  const [selectedHealthStoryKey, setSelectedHealthStoryKey] = useState("");
  const [selectedTags, setSelectedTags] = useState<Set<string>>(new Set());

  const selectedAccount = useMemo(
    () =>
      accounts.find((account) => account.id === selectedAccountId) ??
      accounts[0] ??
      null,
    [accounts, selectedAccountId]
  );
  const careSubjects = useMemo(
    () => selectedAccount?.careSubjects ?? [],
    [selectedAccount]
  );
  const selectedCareSubject = useMemo(
    () =>
      careSubjects.find((subject) => subject.id === selectedCareSubjectId) ??
      careSubjects[0] ??
      null,
    [careSubjects, selectedCareSubjectId]
  );

  useEffect(() => {
    void loadContext();
  }, []);

  // The status/error banner renders at the top of a long panel, while the
  // actions that can produce it (Generate CarePrep Checkpoint, Save
  // Decision, etc.) live further down. Without this, a failure can produce
  // a real, correctly-worded banner that's simply off-screen from wherever
  // the admin's scroll position and attention already are -- the same
  // "feedback exists but you can't see it" failure mode as the appointment
  // delete confirmation. Scroll it into view whenever it appears so a
  // click never reads as having done nothing.
  useEffect(() => {
    if (message) {
      messageRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [message]);

  useEffect(() => {
    if (selectedAccount?.id && selectedCareSubject?.id) {
      void loadAppointments(selectedAccount.id, selectedCareSubject.id);
      void loadHealthStories(selectedAccount.id, selectedCareSubject.id);
      void loadHistory(selectedAccount.id, selectedCareSubject.id);
    }
  }, [selectedAccount?.id, selectedCareSubject?.id]);

  useEffect(() => {
    if (
      reviewType === "health_stories" &&
      selectedHealthStory &&
      !healthStoryDetail &&
      !busy.startsWith("health_story:")
    ) {
      void openHealthStory(selectedHealthStory);
    }
    // openHealthStory intentionally uses current selected account and Care VIP.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reviewType, selectedHealthStoryKey]);

  const proposedSections = useMemo(
    () => [
      ["Today's Visit", textValue(run?.proposedOutput.intro)],
      ["Before the Visit", textList(run?.proposedOutput.beforeVisit)],
      ["During the Visit", textList(run?.proposedOutput.duringVisit)],
    ],
    [run]
  );
  const decisionReviews =
    run?.structuredInterpretation.decisionQualityReviews ?? [];
  const suggestedImprovementReviews = decisionReviews.filter(isSuggestedImprovement);
  const goodDecisionReviews = decisionReviews.filter(isGoodDecision);
  const reviewSummary = summarizeRun(run, suggestedImprovementReviews, goodDecisionReviews);
  const selectedHealthStory =
    healthStories.find(
      (story) =>
        `${story.careSubjectId}:${story.topicSlug}` === selectedHealthStoryKey
    ) ??
    healthStories[0] ??
    null;
  const healthStoryEvidenceQuality = healthStoryDetail
    ? evidenceQualityLabel(healthStoryDetail)
    : "Select Story";

  async function checkpointFetch(path: string, init?: RequestInit) {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const token = session?.access_token;

    if (!token) {
      throw new Error("Please sign in before using Checkpoint.");
    }

    const response = await fetch(path, {
      ...init,
      headers: {
        ...(init?.headers ?? {}),
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    });
    const result = await response.json();

    if (!response.ok || result?.ok === false) {
      throw new Error(result?.error ?? "Checkpoint request failed.");
    }

    return result;
  }

  async function loadContext() {
    setBusy("context");
    setMessage("");

    try {
      const result = await checkpointFetch("/api/admin/checkpoint?mode=context");
      const nextAccounts = (result.accounts ?? []) as CheckpointAccount[];
      const nextSelectedAccount =
        nextAccounts.find((account) => account.id === selectedAccountId) ??
        nextAccounts[0] ??
        null;

      setAccounts(nextAccounts);
      setSelectedAccountId(nextSelectedAccount?.id ?? "");
      setSelectedCareSubjectId((current) =>
        current &&
        nextSelectedAccount?.careSubjects.some((subject) => subject.id === current)
          ? current
          : nextSelectedAccount?.careSubjects[0]?.id ?? ""
      );
      setHistory(result.recentRuns ?? []);
    } catch (error) {
      setMessage(errorMessage(error));
    } finally {
      setBusy("");
    }
  }

  async function loadAppointments(accountUserId: string, careSubjectId: string) {
    setBusy("appointments");

    try {
      const params = new URLSearchParams({
        accountUserId,
        careSubjectId,
        mode: "appointments",
      });
      const result = await checkpointFetch(`/api/admin/checkpoint?${params}`);
      const rows = result.appointments ?? [];
      setAppointments(rows);
      setSelectedAppointmentId(rows[0]?.id ?? "");
    } catch (error) {
      setMessage(errorMessage(error));
      setAppointments([]);
    } finally {
      setBusy("");
    }
  }

  async function loadHealthStories(accountUserId: string, careSubjectId: string) {
    setBusy((current) => (current ? current : "health_stories"));

    try {
      const params = new URLSearchParams({
        accountUserId,
        careSubjectId,
        mode: "health_stories",
      });
      const result = await checkpointFetch(`/api/admin/checkpoint?${params}`);
      const stories = (result.stories ?? []) as HealthFocusTopicSummary[];
      const nextSelectedKey = stories[0]
        ? `${stories[0].careSubjectId}:${stories[0].topicSlug}`
        : "";

      setHealthStories(stories);
      setSelectedHealthStoryKey((current) =>
        current &&
        stories.some((story) => `${story.careSubjectId}:${story.topicSlug}` === current)
          ? current
          : nextSelectedKey
      );
      if (!stories.length) {
        setHealthStoryDetail(null);
      }
    } catch (error) {
      setMessage(errorMessage(error));
      setHealthStories([]);
      setHealthStoryDetail(null);
    } finally {
      setBusy((current) => (current === "health_stories" ? "" : current));
    }
  }

  async function openHealthStory(story: HealthFocusTopicSummary | null) {
    if (!selectedAccount || !selectedCareSubject || !story) return;

    const storyKey = `${story.careSubjectId}:${story.topicSlug}`;
    setBusy(`health_story:${storyKey}`);
    setMessage("");
    setSelectedHealthStoryKey(storyKey);
    setHealthStoryDetail(null);

    try {
      const params = new URLSearchParams({
        accountUserId: selectedAccount.id,
        careSubjectId: selectedCareSubject.id,
        mode: "health_story_detail",
        topicSlug: story.topicSlug,
      });
      const result = await checkpointFetch(`/api/admin/checkpoint?${params}`);
      setHealthStoryDetail(result.detail ?? null);
    } catch (error) {
      setMessage(errorMessage(error));
    } finally {
      setBusy("");
    }
  }

  async function loadHistory(accountUserId?: string, careSubjectId?: string) {
    try {
      const params = new URLSearchParams({ mode: "history" });
      if (accountUserId) params.set("accountUserId", accountUserId);
      if (careSubjectId) params.set("careSubjectId", careSubjectId);
      const result = await checkpointFetch(`/api/admin/checkpoint?${params}`);
      setHistory(result.runs ?? []);
    } catch (error) {
      setMessage(errorMessage(error));
    }
  }

  async function generateRun() {
    if (!selectedAccount || !selectedCareSubject || !selectedAppointmentId) {
      setMessage("Select an account, Care VIP, and appointment first.");
      return;
    }

    setBusy("generate");
    setMessage("");

    try {
      const result = await checkpointFetch("/api/admin/checkpoint", {
        body: JSON.stringify({
          accountUserId: selectedAccount.id,
          action: "generate_careprep",
          appointmentId: selectedAppointmentId,
          careSubjectId: selectedCareSubject.id,
        }),
        method: "POST",
      });
      setRun(result.run);
      setDecision(result.run?.checkpointDecision ?? "needs_work");
      setNotes(result.run?.evaluatorNotes ?? "");
      setSelectedTags(new Set(result.run?.evaluationTags ?? []));
      await loadHistory(selectedAccount.id, selectedCareSubject.id);
    } catch (error) {
      setMessage(errorMessage(error));
    } finally {
      setBusy("");
    }
  }

  async function openRun(runId: string) {
    setBusy(`run:${runId}`);
    setMessage("");

    try {
      const params = new URLSearchParams({ mode: "run", runId });
      const result = await checkpointFetch(`/api/admin/checkpoint?${params}`);
      setRun(result.run);
      setDecision(result.run?.checkpointDecision ?? "needs_work");
      setNotes(result.run?.evaluatorNotes ?? "");
      setSelectedTags(new Set(result.run?.evaluationTags ?? []));
    } catch (error) {
      setMessage(errorMessage(error));
    } finally {
      setBusy("");
    }
  }

  async function saveDecision() {
    if (!run) return;

    setBusy("decision");
    setMessage("");

    try {
      const result = await checkpointFetch("/api/admin/checkpoint", {
        body: JSON.stringify({
          action: "save_decision",
          decision,
          notes,
          runId: run.id,
          tags: Array.from(selectedTags),
        }),
        method: "POST",
      });
      setRun(result.run);
      setMessage("Checkpoint Decision saved.");
      await loadHistory(selectedAccount?.id, selectedCareSubject?.id);
    } catch (error) {
      setMessage(errorMessage(error));
    } finally {
      setBusy("");
    }
  }

  function applyReviewAction(
    nextDecision: "needs_work" | "proceed" | "suppress",
    review?: DecisionQualityReview
  ) {
    setDecision(nextDecision);
    const tag = review ? tagForReview(review) : null;
    if (!tag) return;

    setSelectedTags((current) => {
      const next = new Set(current);
      next.add(tag);
      return next;
    });
  }

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold">Checkpoint</h2>
          <p className="mt-1 max-w-3xl text-slate-600">
            Evaluate CarePrep against real evidence before outputs are trusted for
            broader user release.
          </p>
        </div>
        <button
          className="rounded-md border border-slate-300 px-4 py-2 font-semibold text-slate-700 disabled:text-slate-400"
          disabled={Boolean(busy)}
          onClick={() => void loadContext()}
          type="button"
        >
          {busy === "context" ? "Refreshing..." : "Refresh"}
        </button>
      </div>

      {message ? (
        <div
          className="mt-4 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900"
          ref={messageRef}
        >
          {message}
        </div>
      ) : null}

      <div className="mt-5 grid gap-4 lg:grid-cols-[minmax(260px,360px)_1fr]">
        <div className="space-y-4">
          <div>
            <label className="text-sm font-semibold text-slate-700" htmlFor="checkpoint-account">
              Account
            </label>
            <select
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2"
              id="checkpoint-account"
              onChange={(event) => {
                const nextAccountId = event.target.value;
                const nextAccount = accounts.find(
                  (account) => account.id === nextAccountId
                );
                setSelectedAccountId(nextAccountId);
                setSelectedCareSubjectId(nextAccount?.careSubjects[0]?.id ?? "");
                setRun(null);
              }}
              value={selectedAccount?.id ?? ""}
            >
              {accounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {accountOptionLabel(account)}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-sm font-semibold text-slate-700" htmlFor="checkpoint-care-vip">
              Care VIP
            </label>
            <select
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2"
              id="checkpoint-care-vip"
              onChange={(event) => {
                setSelectedCareSubjectId(event.target.value);
                setRun(null);
              }}
              value={selectedCareSubject?.id ?? ""}
            >
              {careSubjects.map((subject) => (
                <option key={subject.id} value={subject.id}>
                  {subject.displayName}
                </option>
              ))}
            </select>
          </div>

          <div>
            <p className="text-sm font-semibold text-slate-700">Review Type</p>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <button
                aria-pressed={reviewType === "careprep"}
                className={`rounded-md border px-3 py-2 text-sm font-semibold ${
                  reviewType === "careprep"
                    ? "border-blue-300 bg-blue-50 text-blue-900"
                    : "border-slate-200 text-slate-700 hover:border-blue-200"
                }`}
                onClick={() => {
                  setReviewType("careprep");
                  setMessage("");
                }}
                type="button"
              >
                CarePrep
              </button>
              <button
                aria-pressed={reviewType === "health_stories"}
                className={`rounded-md border px-3 py-2 text-sm font-semibold ${
                  reviewType === "health_stories"
                    ? "border-blue-300 bg-blue-50 text-blue-900"
                    : "border-slate-200 text-slate-700 hover:border-blue-200"
                }`}
                onClick={() => {
                  setReviewType("health_stories");
                  setRun(null);
                  setMessage("");
                }}
                type="button"
              >
                Health Stories
              </button>
            </div>
          </div>

          {reviewType === "careprep" ? (
            <>
              <div>
                <label className="text-sm font-semibold text-slate-700" htmlFor="checkpoint-appointment">
                  Appointment
                </label>
                <select
                  className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2"
                  id="checkpoint-appointment"
                  onChange={(event) => setSelectedAppointmentId(event.target.value)}
                  value={selectedAppointmentId}
                >
                  {appointments.map((appointment) => (
                    <option key={appointment.id} value={appointment.id}>
                      {appointment.label}
                    </option>
                  ))}
                </select>
              </div>

              <button
                className="w-full rounded-md bg-blue-700 px-4 py-2 font-semibold text-white disabled:bg-slate-300"
                disabled={busy === "generate" || !selectedAppointmentId}
                onClick={() => void generateRun()}
                type="button"
              >
                {busy === "generate" ? "Generating CarePrep..." : "Generate CarePrep Checkpoint"}
              </button>
            </>
          ) : (
            <div className="border-t border-slate-200 pt-4">
              <div className="flex items-center justify-between gap-3">
                <h3 className="font-semibold text-slate-900">Health Stories</h3>
                <button
                  className="text-xs font-semibold text-blue-700 underline-offset-2 hover:underline disabled:text-slate-400"
                  disabled={Boolean(busy)}
                  onClick={() =>
                    selectedAccount?.id && selectedCareSubject?.id
                      ? void loadHealthStories(
                          selectedAccount.id,
                          selectedCareSubject.id
                        )
                      : undefined
                  }
                  type="button"
                >
                  Refresh
                </button>
              </div>
              <div className="mt-2 max-h-96 space-y-2 overflow-auto pr-1">
                {healthStories.length === 0 ? (
                  <p className="text-sm text-slate-500">
                    No generated Health Stories for this Care VIP yet.
                  </p>
                ) : (
                  healthStories.map((story) => {
                    const key = `${story.careSubjectId}:${story.topicSlug}`;
                    const selected = key === selectedHealthStoryKey;

                    return (
                      <button
                        aria-pressed={selected}
                        className={`w-full rounded-md border px-3 py-2 text-left text-sm hover:border-blue-300 disabled:opacity-60 ${
                          selected
                            ? "border-blue-300 bg-blue-50"
                            : "border-slate-200 bg-white"
                        }`}
                        disabled={busy === `health_story:${key}`}
                        key={key}
                        onClick={() => void openHealthStory(story)}
                        type="button"
                      >
                        <span className="block font-semibold text-slate-800">
                          {story.displayName}
                        </span>
                        <span className="block text-slate-500">
                          {story.mentionCount} mentions · {formatDate(story.latestMentionAt)}
                        </span>
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          )}

          {reviewType === "careprep" ? (
          <div className="border-t border-slate-200 pt-4">
            <h3 className="font-semibold text-slate-900">History</h3>
            <div className="mt-2 max-h-96 space-y-2 overflow-auto pr-1">
              {history.length === 0 ? (
                <p className="text-sm text-slate-500">No Checkpoint runs yet.</p>
              ) : (
                history.map((item) => (
                  <button
                    className="w-full rounded-md border border-slate-200 px-3 py-2 text-left text-sm hover:border-blue-300 disabled:opacity-60"
                    disabled={busy === `run:${item.id}`}
                    key={item.id}
                    onClick={() => void openRun(item.id)}
                    type="button"
                  >
                    <span className="block font-semibold text-slate-800">
                      {item.appointmentLabel}
                    </span>
                    <span className="block text-slate-500">
                      {formatDate(item.generatedAt)} · {decisionLabel(item.checkpointDecision)}
                    </span>
                  </button>
                ))
              )}
            </div>
          </div>
          ) : null}
        </div>

        {reviewType === "health_stories" ? (
          <HealthStoryCheckpointReview
            busy={busy}
            detail={healthStoryDetail}
            evidenceQuality={healthStoryEvidenceQuality}
            formatDate={formatDate}
            selectedStory={selectedHealthStory}
          />
        ) : run ? (
          <div className="space-y-5">
            <Panel title="Overall Assessment">
              <div className="grid gap-4 md:grid-cols-[1.15fr_1fr]">
                <div>
                  <p className="text-sm font-semibold text-slate-500">Appointment</p>
                  <p className="mt-1 text-xl font-semibold text-slate-950">
                    {run.appointmentLabel}
                  </p>
                  <p className="mt-1 text-sm text-slate-600">
                    {run.scope.careVipName} · {formatDate(run.generatedAt)}
                  </p>
                </div>
                <div className="grid gap-3 sm:grid-cols-3">
                  <AssessmentStat label="Status" tone={reviewSummary.tone} value={reviewSummary.status} />
                  <AssessmentStat label="Decision Quality" value={reviewSummary.goodDecisions} />
                  <AssessmentStat label="Primary Action" value={reviewSummary.primaryAction} />
                </div>
              </div>
            </Panel>

            <Panel title="Suggested Improvements">
              {suggestedImprovementReviews.length === 0 ? (
                <div className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
                  No suggested improvements were found for this appointment.
                </div>
              ) : (
                <div className="space-y-3">
                  {suggestedImprovementReviews.map((review, index) => (
                    <ImprovementCard
                      key={`${review.category}-${review.itemText}-${index}`}
                      onDecision={applyReviewAction}
                      review={review}
                    />
                  ))}
                </div>
              )}
            </Panel>

            <Panel title="Proposed User Experience">
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                <div className="mx-auto max-w-2xl rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="space-y-5">
                    {proposedSections.map(([label, value]) => (
                      <OutputSection key={String(label)} label={String(label)} value={value} />
                    ))}
                  </div>
                </div>
              </div>
            </Panel>

            <Panel title="Good Decisions">
              {goodDecisionReviews.length === 0 ? (
                <p className="text-sm text-slate-500">
                  No positive decision review was captured for this run.
                </p>
              ) : (
                <div className="grid gap-2 sm:grid-cols-2">
                  {goodDecisionReviews.map((review, index) => (
                    <GoodDecisionCard
                      key={`${review.category}-${review.itemText}-${index}`}
                      review={review}
                    />
                  ))}
                </div>
              )}
            </Panel>

            <Panel title="Checkpoint Decision">
              <div className="grid gap-4 lg:grid-cols-[220px_1fr]">
                <div>
                  <label className="text-sm font-semibold text-slate-700" htmlFor="checkpoint-decision">
                    Decision
                  </label>
                  <select
                    className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2"
                    id="checkpoint-decision"
                    onChange={(event) => setDecision(event.target.value)}
                    value={decision}
                  >
                    {decisions.map((item) => (
                      <option key={item.value} value={item.value}>
                        {item.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-700">Tags</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {evaluationTags.map(([value, label]) => (
                      <label className="inline-flex items-center gap-2 rounded-md border border-slate-200 px-2 py-1 text-sm" key={value}>
                        <input
                          checked={selectedTags.has(value)}
                          onChange={() =>
                            setSelectedTags((current) => {
                              const next = new Set(current);
                              if (next.has(value)) next.delete(value);
                              else next.add(value);
                              return next;
                            })
                          }
                          type="checkbox"
                        />
                        {label}
                      </label>
                    ))}
                  </div>
                </div>
              </div>
              <label className="mt-4 block text-sm font-semibold text-slate-700" htmlFor="checkpoint-notes">
                Notes
              </label>
              <textarea
                className="mt-1 min-h-28 w-full rounded-md border border-slate-300 px-3 py-2"
                id="checkpoint-notes"
                onChange={(event) => setNotes(event.target.value)}
                value={notes}
              />
              <button
                className="mt-3 rounded-md border border-slate-300 px-4 py-2 font-semibold text-slate-700 disabled:text-slate-400"
                disabled={busy === "decision"}
                onClick={() => void saveDecision()}
                type="button"
              >
                {busy === "decision" ? "Saving..." : "Save Checkpoint Decision"}
              </button>
            </Panel>

            <details className="rounded-lg border border-slate-200 bg-slate-50 p-4">
              <summary className="cursor-pointer text-lg font-semibold text-slate-900">
                Show Analysis
              </summary>
              <div className="mt-4 space-y-5">
                <Panel title="Evidence">
                  <JsonBlock value={run.evidencePacket} />
                </Panel>

                <Panel title="Structured Interpretation">
                  <p className="text-sm font-semibold text-slate-700">
                    {run.structuredInterpretation.evaluationQuestion}
                  </p>
                  {run.structuredInterpretation.platformRule ? (
                    <p className="mt-2 rounded-md bg-white px-3 py-2 text-sm text-slate-700">
                      {run.structuredInterpretation.platformRule}
                    </p>
                  ) : null}
                  <div className="mt-3 space-y-3">
                    {(run.structuredInterpretation.observations ?? []).map(
                      (observation, index) => (
                        <div className="border-l-2 border-slate-200 pl-3" key={`${observation.category}-${index}`}>
                          <p className="text-sm font-semibold text-slate-900">
                            {observation.observation}
                          </p>
                          <p className="mt-1 text-xs uppercase tracking-wide text-slate-500">
                            {observation.category} · {observation.kind} · {confidenceLabel(observation.confidence)}
                          </p>
                          {observation.supportingEvidenceRefs?.length ? (
                            <p className="mt-1 text-xs text-slate-500">
                              Evidence: {observation.supportingEvidenceRefs.join(", ")}
                            </p>
                          ) : null}
                        </div>
                      )
                    )}
                  </div>
                </Panel>

                <Panel title="Decision Quality Review">
                  <div className="space-y-3">
                    {decisionReviews.map((review, index) => (
                      <ReviewAnalysisCard
                        key={`${review.category}-${review.itemText}-${index}`}
                        review={review}
                      />
                    ))}
                  </div>
                </Panel>

                <Panel title="Decision Trace">
                  <JsonBlock value={run.decisionTrace ?? {}} />
                </Panel>

                <Panel title="Prompt Metadata">
                  <dl className="grid gap-3 text-sm sm:grid-cols-2">
                    <ScopeItem label="Prompt" value={run.promptVersion ?? "Unknown"} />
                    <ScopeItem label="Prompt key" value={run.promptKey ?? "Unknown"} />
                    <ScopeItem label="Model" value={textValue(run.modelMetadata.model)} />
                    <ScopeItem label="Run time" value={formatDate(run.generatedAt)} />
                  </dl>
                </Panel>

                <Panel title="Raw Contracts">
                  <JsonBlock
                    value={{
                      effectiveEvidenceRange: run.effectiveEvidenceRange,
                      modelMetadata: run.modelMetadata,
                      proposedOutput: run.proposedOutput,
                      structuredInterpretation: run.structuredInterpretation,
                    }}
                  />
                </Panel>
              </div>
            </details>
          </div>
        ) : (
          <div className="flex min-h-96 items-center justify-center rounded-lg border border-dashed border-slate-300 text-center text-slate-500">
            <p>Select an appointment and generate a CarePrep Checkpoint run, or reopen one from history.</p>
          </div>
        )}
      </div>
    </section>
  );
}

function Panel({ children, title }: { children: ReactNode; title: string }) {
  return (
    <section className="rounded-lg border border-slate-200 p-4">
      <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
      <div className="mt-3">{children}</div>
    </section>
  );
}

function accountOptionLabel(account: CheckpointAccount) {
  const label = account.label.trim();
  const email = account.email?.trim();

  if (!email || label === email) {
    return label || email || "Unnamed account";
  }

  return `${label} (${email})`;
}

function CollapsiblePanel({
  children,
  title,
}: {
  children: ReactNode;
  title: string;
}) {
  return (
    <details className="rounded-lg border border-slate-200 bg-slate-50 p-4">
      <summary className="cursor-pointer text-lg font-semibold text-slate-900">
        {title}
      </summary>
      <div className="mt-3">{children}</div>
    </details>
  );
}

function HealthStoryCheckpointReview({
  busy,
  detail,
  evidenceQuality,
  formatDate,
  selectedStory,
}: {
  busy: string;
  detail: HealthFocusTopicDetailData | null;
  evidenceQuality: string;
  formatDate: (value: string | null | undefined) => string;
  selectedStory: HealthFocusTopicSummary | null;
}) {
  if (!selectedStory) {
    return (
      <div className="flex min-h-96 items-center justify-center rounded-lg border border-dashed border-slate-300 text-center text-slate-500">
        <p>Select an account and Care VIP with generated Health Stories.</p>
      </div>
    );
  }

  const loading = busy.startsWith("health_story:");
  const suggestedImprovements = healthStorySuggestedImprovements(detail);

  return (
    <div className="space-y-5">
      <Panel title="Overall Assessment">
        <div className="grid gap-4 md:grid-cols-[1.15fr_1fr]">
          <div>
            <p className="text-sm font-semibold text-slate-500">
              Health Story
            </p>
            <p className="mt-1 text-xl font-semibold text-slate-950">
              {selectedStory.displayName}
            </p>
            <p className="mt-1 text-sm text-slate-600">
              {selectedStory.mentionCount} mentions ·{" "}
              {formatDate(selectedStory.latestMentionAt)}
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <AssessmentStat label="Status" tone="attention" value="Needs Review" />
            <AssessmentStat label="Evidence Quality" value={evidenceQuality} />
            <AssessmentStat label="Decision Quality" value="Needs Review" />
          </div>
        </div>
      </Panel>

      <Panel title="Display Preview">
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
          <div className="mx-auto max-w-3xl rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <HealthFocusTopicDetail
              detail={detail}
              isLoading={loading}
              onClose={() => undefined}
              variant="inline"
            />
          </div>
        </div>
      </Panel>

      <CollapsiblePanel title="Suggested Improvements">
        {suggestedImprovements.length === 0 ? (
          <p className="text-sm text-slate-600">
            No automatic suggestions were found. Editorial review is still
            required before this story becomes user-facing.
          </p>
        ) : (
          <ul className="space-y-2 text-sm leading-6 text-slate-700">
            {suggestedImprovements.map((item) => (
              <li className="flex gap-2" key={item}>
                <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        )}
      </CollapsiblePanel>

      <CollapsiblePanel title="Good Decisions">
        <ul className="space-y-2 text-sm leading-6 text-slate-700">
          {healthStoryGoodDecisions(detail).map((item) => (
            <li className="flex gap-2" key={item}>
              <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </CollapsiblePanel>

      <CollapsiblePanel title="Evidence">
        <JsonBlock
          value={{
            mentions: detail?.mentions ?? [],
            providerNames: detail?.providerNames ?? [],
            relatedTopics: detail?.relatedTopics ?? [],
            separateRelatedTopics: detail?.separateRelatedTopics ?? [],
          }}
        />
      </CollapsiblePanel>

      <CollapsiblePanel title="Structured Interpretation">
        <JsonBlock
          value={{
            contextSignature: detail?.contextSignature ?? null,
            latestMentionAt: detail?.latestMentionAt ?? null,
            mentionCount: detail?.mentionCount ?? 0,
            narrativeSummary: detail?.narrativeSummary ?? "",
            topicSlug: detail?.topicSlug ?? selectedStory.topicSlug,
          }}
        />
      </CollapsiblePanel>

      <CollapsiblePanel title="Decision Quality">
        <JsonBlock
          value={{
            displayPreviewReady: Boolean(detail?.narrativeSummary?.trim()),
            evidenceQuality,
            hasTimeline: (detail?.mentions.length ?? 0) >= 2,
            relatedTopicCount: detail?.relatedTopics.length ?? 0,
            reviewStatus: "needs_review",
          }}
        />
      </CollapsiblePanel>

      <CollapsiblePanel title="Decision Trace">
        <JsonBlock
          value={{
            checkpointUseKey: "health_stories",
            pipeline:
              "Evidence -> Interpretation -> Checkpoint Review -> Display Preview -> Human Approval -> User Experience",
            source: "existing Health Focus topic mentions and Health Story display composition",
          }}
        />
      </CollapsiblePanel>

      <CollapsiblePanel title="Prompt Metadata">
        <JsonBlock
          value={{
            promptMetadata: "Not generated in this Checkpoint view.",
            scope: "Existing Health Story generation and persistence are unchanged.",
          }}
        />
      </CollapsiblePanel>
    </div>
  );
}

function AssessmentStat({
  label,
  tone = "neutral",
  value,
}: {
  label: string;
  tone?: "attention" | "good" | "neutral";
  value: string;
}) {
  const toneClass =
    tone === "attention"
      ? "border-amber-200 bg-amber-50 text-amber-950"
      : tone === "good"
        ? "border-emerald-200 bg-emerald-50 text-emerald-950"
        : "border-slate-200 bg-slate-50 text-slate-900";

  return (
    <div className={`rounded-md border px-3 py-2 ${toneClass}`}>
      <p className="text-xs font-semibold uppercase tracking-wide opacity-70">{label}</p>
      <p className="mt-1 text-sm font-semibold">{value}</p>
    </div>
  );
}

function ImprovementCard({
  onDecision,
  review,
}: {
  onDecision: (
    decision: "needs_work" | "proceed" | "suppress",
    review?: DecisionQualityReview
  ) => void;
  review: DecisionQualityReview;
}) {
  return (
    <article className="rounded-lg border border-amber-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-amber-900">
            {reviewTitle(review)}
          </p>
          <p className="mt-1 text-xs uppercase tracking-wide text-slate-500">
            {sectionLabel(review.category)} · {formatOutcome(review.userWorkOutcome)}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            className="rounded-md border border-slate-300 px-3 py-1 text-xs font-semibold text-slate-700"
            onClick={() => onDecision("proceed", review)}
            type="button"
          >
            Proceed
          </button>
          <button
            className="rounded-md border border-amber-300 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-900"
            onClick={() => onDecision("needs_work", review)}
            type="button"
          >
            Needs Work
          </button>
          <button
            className="rounded-md border border-slate-300 px-3 py-1 text-xs font-semibold text-slate-700"
            onClick={() => onDecision("suppress", review)}
            type="button"
          >
            Suppress
          </button>
        </div>
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-3">
        <ReviewField
          label="Current"
          value={review.itemText || review.decision || "No current item captured."}
        />
        <ReviewField
          label="Why this matters"
          value={review.checkpointReview || "No review rationale was captured."}
        />
        <ReviewField
          label="Suggested improvement"
          value={review.suggestedBetterDecision ?? "Keep only if this asks for new or changed information."}
        />
      </div>
    </article>
  );
}

function GoodDecisionCard({ review }: { review: DecisionQualityReview }) {
  return (
    <article className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3">
      <p className="text-sm font-semibold text-emerald-950">
        {goodDecisionText(review)}
      </p>
      {review.evidence?.length ? (
        <p className="mt-1 text-xs text-emerald-800">
          Support: {review.evidence.slice(0, 2).join("; ")}
        </p>
      ) : null}
    </article>
  );
}

function ReviewAnalysisCard({ review }: { review: DecisionQualityReview }) {
  return (
    <div className="rounded-md border border-slate-200 bg-white p-3">
      <p className="text-sm font-semibold text-slate-900">{review.decision}</p>
      <p className="mt-1 text-xs uppercase tracking-wide text-slate-500">
        {sectionLabel(review.category)} · {formatOutcome(review.userWorkOutcome)}
      </p>
      <p className="mt-2 text-sm text-slate-700">{review.checkpointReview}</p>
      {review.evidence?.length ? (
        <p className="mt-2 text-xs text-slate-500">
          Evidence: {review.evidence.join("; ")}
        </p>
      ) : null}
      {review.suggestedBetterDecision ? (
        <p className="mt-2 text-sm text-slate-700">
          <span className="font-semibold">Suggested better decision: </span>
          {review.suggestedBetterDecision}
        </p>
      ) : null}
    </div>
  );
}

function ReviewField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </p>
      <p className="mt-1 text-sm leading-6 text-slate-800">{value || "None captured."}</p>
    </div>
  );
}

function ScopeItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-slate-500">{label}</dt>
      <dd className="mt-1 font-medium text-slate-900">{value || "Unknown"}</dd>
    </div>
  );
}

function JsonBlock({ value }: { value: unknown }) {
  return (
    <pre className="max-h-96 overflow-auto rounded-md bg-slate-50 p-3 text-xs leading-relaxed text-slate-700">
      {JSON.stringify(value, null, 2)}
    </pre>
  );
}

function OutputSection({
  label,
  value,
}: {
  label: string;
  value: string | string[];
}) {
  if (Array.isArray(value)) {
    return (
      <div>
        <h4 className="text-sm font-semibold text-slate-700">{label}</h4>
        {value.length ? (
          <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-slate-700">
            {value.map((item, index) => (
              <li key={`${item}-${index}`}>{item}</li>
            ))}
          </ul>
        ) : (
          <p className="mt-1 text-sm text-slate-500">No output.</p>
        )}
      </div>
    );
  }

  return (
    <div>
      <h4 className="text-sm font-semibold text-slate-700">{label}</h4>
      <p className="mt-1 text-sm text-slate-700">{value || "No output."}</p>
    </div>
  );
}

function summarizeRun(
  run: CheckpointRun | null,
  suggestedImprovements: DecisionQualityReview[],
  goodDecisions: DecisionQualityReview[]
) {
  if (!run) {
    return {
      goodDecisions: "No Run",
      primaryAction: "Generate Checkpoint",
      status: "Not Started",
      tone: "neutral" as const,
    };
  }

  const suppressions = run.checkpointDecision === "suppress" ? 1 : 0;
  const improvementText =
    suggestedImprovements.length === 1
      ? "1 Suggested Improvement"
      : `${suggestedImprovements.length} Suggested Improvements`;

  if (suggestedImprovements.length > 0) {
    return {
      goodDecisions:
        `${goodDecisions.length} Good ${goodDecisions.length === 1 ? "Decision" : "Decisions"} · ${improvementText}`,
      primaryAction: "Review Suggested Improvements",
      status: "Needs Review",
      tone: "attention" as const,
    };
  }

  return {
    goodDecisions:
      `${goodDecisions.length} Good ${goodDecisions.length === 1 ? "Decision" : "Decisions"} · ${suppressions ? "Suppressed" : "No Suppressed Items"}`,
    primaryAction:
      run.checkpointDecision === "proceed" ? "Ready to Proceed" : "Confirm Decision",
    status: run.checkpointDecision ? decisionLabel(run.checkpointDecision) : "Looks Good",
    tone: "good" as const,
  };
}

function isSuggestedImprovement(review: DecisionQualityReview) {
  return Boolean(review.suggestedBetterDecision) || negativeOutcomes.has(review.userWorkOutcome ?? "");
}

function isGoodDecision(review: DecisionQualityReview) {
  return !isSuggestedImprovement(review);
}

const negativeOutcomes = new Set([
  "duplicated_existing_evidence",
  "requested_information_already_known",
  "sent_user_to_rediscover_known_information",
  "unnecessary_preparation",
]);

function reviewTitle(review: DecisionQualityReview) {
  switch (review.userWorkOutcome) {
    case "requested_information_already_known":
    case "sent_user_to_rediscover_known_information":
      return "Requested Known Information";
    case "duplicated_existing_evidence":
      return "Duplicated Existing Evidence";
    case "unnecessary_preparation":
      return "Unnecessary Preparation";
    default:
      return review.suggestedBetterDecision ? "Could Be More Useful" : "Review Suggested Improvement";
  }
}

function goodDecisionText(review: DecisionQualityReview) {
  switch (review.userWorkOutcome) {
    case "connected_information":
      return `Connected existing context: ${review.itemText}`;
    case "eliminated_user_work":
      return `Reduced user work: ${review.itemText}`;
    case "organized_information":
      return `Organized known information: ${review.itemText}`;
    case "reduced_interpretation":
      return `Helped focus the visit: ${review.itemText}`;
    case "appropriately_requested_new_information":
      return `Asked for new or changed information: ${review.itemText}`;
    default:
      return review.itemText || review.decision || "Useful appointment-specific decision.";
  }
}

function tagForReview(review: DecisionQualityReview) {
  switch (review.userWorkOutcome) {
    case "duplicated_existing_evidence":
      return "duplicated_existing_evidence";
    case "requested_information_already_known":
    case "sent_user_to_rediscover_known_information":
      return "requested_known_information";
    case "unnecessary_preparation":
      return "unnecessary_preparation";
    case "reduced_interpretation":
      return "reduced_interpretation_work";
    case "connected_information":
      return "connected_existing_knowledge";
    case "eliminated_user_work":
      return "eliminated_user_work";
    case "organized_information":
      return "saved_interpretation_work";
    case "appropriately_requested_new_information":
      return "appropriate_information_request";
    default:
      return null;
  }
}

function sectionLabel(value: string | null | undefined) {
  switch (value) {
    case "before_visit":
      return "Before the Visit";
    case "during_visit":
      return "During the Visit";
    case "intro":
      return "Today's Visit";
    default:
      return value ? formatOutcome(value) : "CarePrep";
  }
}

function confidenceLabel(value: number | null | undefined) {
  const confidence = typeof value === "number" ? value : 0;
  if (confidence >= 0.8) return `High Support (${Math.round(confidence * 100)}%)`;
  if (confidence >= 0.6) return `Moderate Support (${Math.round(confidence * 100)}%)`;
  return `Limited Support (${Math.round(confidence * 100)}%)`;
}

function textValue(value: unknown) {
  return typeof value === "string" ? value : value == null ? "" : String(value);
}

function textList(value: unknown) {
  return Array.isArray(value)
    ? value.map((item) => textValue(item)).filter(Boolean)
    : [];
}

function decisionLabel(value: string | null) {
  return decisions.find((decision) => decision.value === value)?.label ?? "Not decided";
}

function formatOutcome(value: string | null | undefined) {
  return value ? value.replaceAll("_", " ") : "not classified";
}

function evidenceQualityLabel(detail: HealthFocusTopicDetailData) {
  const mentionCount = detail.mentions.length;
  const providerCount = detail.providerNames.length;
  const datedMentionCount = detail.mentions.filter((mention) =>
    Boolean(mention.appointmentStartsAt)
  ).length;

  if (mentionCount >= 3 && providerCount >= 2 && datedMentionCount >= 2) {
    return "Strong";
  }

  if (mentionCount >= 2 && datedMentionCount >= 1) {
    return "Moderate";
  }

  return "Limited";
}

function healthStorySuggestedImprovements(
  detail: HealthFocusTopicDetailData | null
) {
  if (!detail) return ["Open the story to inspect the Display Preview."];

  const suggestions: string[] = [];

  if (!detail.narrativeSummary.trim()) {
    suggestions.push("Add or regenerate a plain-language story summary.");
  }

  if (detail.mentions.length < 2) {
    suggestions.push(
      "Confirm whether one mention is enough to present this as a Health Story."
    );
  }

  if (detail.relatedTopics.length === 0) {
    suggestions.push("Review whether related topics should be connected or omitted.");
  }

  if (detail.mentions.some((mention) => !mention.appointmentStartsAt)) {
    suggestions.push("Check undated evidence before relying on timeline placement.");
  }

  return suggestions;
}

function healthStoryGoodDecisions(detail: HealthFocusTopicDetailData | null) {
  if (!detail) return ["Display Preview is separated from raw evidence."];

  return [
    detail.narrativeSummary.trim()
      ? "Plain-language summary is available for production-style review."
      : "",
    detail.mentions.length >= 2
      ? "Timeline can show how this topic appears across visits."
      : "",
    detail.relatedTopics.length > 0
      ? "Related topics are available for the caregiver-facing experience."
      : "",
    "Evidence and internal review data remain outside Display Preview.",
  ].filter(Boolean);
}

function errorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  if (error && typeof error === "object" && "message" in error) {
    return String(error.message);
  }
  return String(error || "Something went wrong.");
}
