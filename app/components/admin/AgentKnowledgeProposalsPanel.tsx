import { FormEvent, useState } from "react";

export type AgentKnowledgeProposalStatus =
  | "archived"
  | "approved"
  | "draft"
  | "needs_review"
  | "published"
  | "rejected";

export type AgentKnowledgeProposalItemReviewStatus =
  | "accepted"
  | "edited"
  | "needs_later_review"
  | "pending"
  | "rejected";

export type AgentKnowledgeProposal = {
  id: string;
  created_at: string;
  published_at: string | null;
  review_note: string | null;
  reviewed_at: string | null;
  source_type: string;
  status: AgentKnowledgeProposalStatus;
  summary: string;
  title: string;
  updated_at: string;
};

export type AgentKnowledgeProposalItem = {
  id: string;
  admin_final_body: string | null;
  admin_note: string | null;
  ai_proposed_body: string;
  confidence: number;
  content_key: string;
  content_label: string;
  created_at: string;
  evidence: unknown;
  justification: string;
  original_body: string;
  proposal_id: string;
  review_status: AgentKnowledgeProposalItemReviewStatus;
  risk_category: string;
  source_version_id: string | null;
  source_version_number: number | null;
  updated_at: string;
};

export type AgentKnowledgeAutomationSettings = {
  settings_key: string;
  auto_generation_enabled: boolean;
  software_update_checks_enabled: boolean;
  scheduled_checks_enabled: boolean;
  background_generation_period_days: number;
  feedback_clustering_enabled: boolean;
  feedback_push_to_proposal_enabled: boolean;
  feedback_min_not_helpful_count: number;
  feedback_min_admin_flags: number;
  feedback_window_days: number;
  severity_threshold: "high" | "low" | "medium" | "urgent";
  updated_at: string;
};

export type AgentKnowledgeCheckRun = {
  id: string;
  completed_at: string | null;
  created_at: string;
  error_message: string | null;
  proposal_id: string | null;
  run_type: "feedback_cluster" | "manual" | "scheduled" | "software_update";
  status: "cancelled" | "completed" | "failed" | "queued" | "running";
};

type Props = {
  automationSettings: AgentKnowledgeAutomationSettings;
  checkRuns: AgentKnowledgeCheckRun[];
  drafts: Record<string, string>;
  formatDate: (value: string | null) => string;
  loading: boolean;
  notes: Record<string, string>;
  proposals: AgentKnowledgeProposal[];
  publishableCount: number;
  publishingProposalId: string | null;
  publishNote: string;
  queueingRun: boolean;
  savingAutomationSettings: boolean;
  savingItemId: string | null;
  selectedItems: AgentKnowledgeProposalItem[];
  selectedProposal: AgentKnowledgeProposal | null;
  onDraftChange: (itemId: string, value: string) => void;
  onNoteChange: (itemId: string, value: string) => void;
  onPublish: (event: FormEvent<HTMLFormElement>) => void;
  onPublishNoteChange: (value: string) => void;
  onQueueManualCheck: () => void;
  onReviewItem: (
    item: AgentKnowledgeProposalItem,
    reviewStatus: AgentKnowledgeProposalItemReviewStatus
  ) => void;
  onSaveAutomationSettings: (event: FormEvent<HTMLFormElement>) => void;
  onSelectProposal: (proposalId: string) => void;
  onSettingsChange: (
    patch: Partial<AgentKnowledgeAutomationSettings>
  ) => void;
};

export function AgentKnowledgeProposalsPanel({
  automationSettings,
  checkRuns,
  drafts,
  formatDate,
  loading,
  notes,
  onDraftChange,
  onNoteChange,
  onPublish,
  onPublishNoteChange,
  onQueueManualCheck,
  onReviewItem,
  onSaveAutomationSettings,
  onSelectProposal,
  onSettingsChange,
  proposals,
  publishableCount,
  publishingProposalId,
  publishNote,
  queueingRun,
  savingAutomationSettings,
  savingItemId,
  selectedItems,
  selectedProposal,
}: Props) {
  const [panelTab, setPanelTab] = useState<"review" | "settings">("settings");

  return (
    <section className="space-y-5">
      <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="text-lg font-semibold text-slate-900">
              Agent Knowledge proposals
            </h3>
            <p className="mt-1 text-sm text-slate-600">
              Review suggested assistant knowledge updates before publishing them
              into the versioned knowledge blocks.
            </p>
          </div>
          <p className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-600">
            {proposals.length} proposals
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {[
          ["settings", "Settings"],
          ["review", "Review Queue"],
        ].map(([tabKey, label]) => (
          <button
            className={`rounded-md border px-3 py-2 text-sm font-semibold ${
              panelTab === tabKey
                ? "border-blue-300 bg-blue-50 text-blue-950"
                : "border-slate-300 bg-white text-slate-700"
            }`}
            key={tabKey}
            onClick={() => setPanelTab(tabKey as "review" | "settings")}
            type="button"
          >
            {label}
          </button>
        ))}
      </div>

      {panelTab === "settings" ? (
        <>
      <form
        className="rounded-md border border-slate-200 p-4"
        onSubmit={onSaveAutomationSettings}
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h4 className="font-semibold text-slate-900">
              Proposal generation controls
            </h4>
            <p className="mt-1 text-sm text-slate-600">
              These settings guide background checks and feedback clustering.
              Proposals still require review before publication.
            </p>
          </div>
          {automationSettings.updated_at ? (
            <p className="text-xs text-slate-500">
              Updated {formatDate(automationSettings.updated_at)}
            </p>
          ) : null}
        </div>

        <div className="mt-4 grid gap-3 lg:grid-cols-2">
          {[
            [
              "auto_generation_enabled",
              "Background auto-generation",
              "Allow background checks to create reviewable proposals.",
            ],
            [
              "software_update_checks_enabled",
              "Software-update checks",
              "Create proposal candidates after product or release changes.",
            ],
            [
              "scheduled_checks_enabled",
              "Scheduled safety sweeps",
              "Allow periodic beta QA checks as a backup.",
            ],
            [
              "feedback_clustering_enabled",
              "Cluster user feedback",
              "Group similar low-quality answer signals before proposing changes.",
            ],
            [
              "feedback_push_to_proposal_enabled",
              "Push severe feedback to proposals",
              "Create proposals automatically when feedback crosses thresholds.",
            ],
          ].map(([key, label, description]) => (
            <label
              className="flex gap-3 rounded-md border border-slate-200 p-3 text-sm"
              key={key}
            >
              <input
                checked={Boolean(
                  automationSettings[
                    key as keyof AgentKnowledgeAutomationSettings
                  ]
                )}
                className="mt-1 h-4 w-4"
                onChange={(event) =>
                  onSettingsChange({
                    [key]: event.target.checked,
                  } as Partial<AgentKnowledgeAutomationSettings>)
                }
                type="checkbox"
              />
              <span>
                <span className="block font-semibold text-slate-900">
                  {label}
                </span>
                <span className="mt-1 block text-slate-600">{description}</span>
              </span>
            </label>
          ))}
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-4">
          <label className="block text-sm font-medium text-slate-700">
            Auto-generation period
            <input
              className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2"
              min={1}
              onChange={(event) =>
                onSettingsChange({
                  background_generation_period_days: Number(event.target.value),
                })
              }
              type="number"
              value={automationSettings.background_generation_period_days}
            />
          </label>
        </div>

        <div className="mt-5 border-t border-slate-200 pt-4">
          <h4 className="font-semibold text-slate-900">
            Proposal Generation Thresholds
          </h4>
          <p className="mt-1 text-sm text-slate-600">
            These thresholds decide when clustered feedback becomes a proposal
            candidate.
          </p>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-4">
          <label className="block text-sm font-medium text-slate-700">
            Not-helpful count
            <input
              className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2"
              min={1}
              onChange={(event) =>
                onSettingsChange({
                  feedback_min_not_helpful_count: Number(event.target.value),
                })
              }
              type="number"
              value={automationSettings.feedback_min_not_helpful_count}
            />
          </label>
          <label className="block text-sm font-medium text-slate-700">
            Admin flags
            <input
              className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2"
              min={1}
              onChange={(event) =>
                onSettingsChange({
                  feedback_min_admin_flags: Number(event.target.value),
                })
              }
              type="number"
              value={automationSettings.feedback_min_admin_flags}
            />
          </label>
          <label className="block text-sm font-medium text-slate-700">
            Window days
            <input
              className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2"
              min={1}
              onChange={(event) =>
                onSettingsChange({
                  feedback_window_days: Number(event.target.value),
                })
              }
              type="number"
              value={automationSettings.feedback_window_days}
            />
          </label>
          <label className="block text-sm font-medium text-slate-700">
            Severity
            <select
              className="mt-2 w-full rounded-md border border-slate-300 bg-white px-3 py-2"
              onChange={(event) =>
                onSettingsChange({
                  severity_threshold: event.target
                    .value as AgentKnowledgeAutomationSettings["severity_threshold"],
                })
              }
              value={automationSettings.severity_threshold}
            >
              {["low", "medium", "high", "urgent"].map((severity) => (
                <option key={severity} value={severity}>
                  {severity}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <button
            className="rounded-md bg-slate-900 px-4 py-2 font-semibold text-white disabled:bg-slate-400"
            disabled={savingAutomationSettings}
            type="submit"
          >
            {savingAutomationSettings ? "Saving..." : "Save settings"}
          </button>
          <button
            className="rounded-md border border-blue-300 px-4 py-2 font-semibold text-blue-700 disabled:text-slate-400"
            disabled={queueingRun}
            onClick={onQueueManualCheck}
            type="button"
          >
            {queueingRun ? "Queueing..." : "Queue manual check"}
          </button>
        </div>
      </form>

      {checkRuns.length > 0 ? (
        <section className="rounded-md border border-slate-200 p-4">
          <h4 className="font-semibold text-slate-900">Recent check runs</h4>
          <div className="mt-3 grid gap-2 md:grid-cols-2">
            {checkRuns.slice(0, 6).map((run) => (
              <p
                className="rounded-md bg-slate-50 p-3 text-sm text-slate-700"
                key={run.id}
              >
                {run.run_type.replaceAll("_", " ")} · {run.status} ·{" "}
                {formatDate(run.created_at)}
              </p>
            ))}
          </div>
        </section>
      ) : null}
        </>
      ) : null}

      {panelTab === "review" ? (
        <>
      {proposals.length === 0 ? (
        <p className="rounded-md bg-slate-100 p-3 text-sm text-slate-600">
          {loading
            ? "Loading Agent Knowledge proposals..."
            : "No Agent Knowledge proposals yet. Drift checks, assistant feedback review, or manual proposal creation can add items here."}
        </p>
      ) : (
        <div className="grid gap-5 xl:grid-cols-[18rem_minmax(0,1fr)]">
          <aside className="space-y-2">
            {proposals.map((proposal) => {
              const isSelected = proposal.id === selectedProposal?.id;

              return (
                <button
                  className={`w-full rounded-md border px-3 py-3 text-left transition ${
                    isSelected
                      ? "border-blue-300 bg-blue-50 text-blue-950"
                      : "border-slate-200 bg-white text-slate-700 hover:border-blue-200 hover:bg-blue-50"
                  }`}
                  key={proposal.id}
                  onClick={() => onSelectProposal(proposal.id)}
                  type="button"
                >
                  <span className="block font-semibold">{proposal.title}</span>
                  <span className="mt-1 block text-xs text-slate-500">
                    {proposal.status.replaceAll("_", " ")} ·{" "}
                    {proposal.source_type.replaceAll("_", " ")}
                  </span>
                  <span className="mt-1 block text-xs text-slate-500">
                    {formatDate(proposal.created_at)}
                  </span>
                </button>
              );
            })}
          </aside>

          <div className="space-y-5">
            {selectedProposal ? (
              <>
                <section className="rounded-md border border-slate-200 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h4 className="text-base font-semibold text-slate-900">
                        {selectedProposal.title}
                      </h4>
                      <p className="mt-1 text-sm text-slate-600">
                        {selectedProposal.summary || "No proposal summary provided."}
                      </p>
                      <p className="mt-2 text-xs text-slate-500">
                        {selectedProposal.status.replaceAll("_", " ")} ·{" "}
                        {selectedProposal.source_type.replaceAll("_", " ")} ·
                        created {formatDate(selectedProposal.created_at)}
                      </p>
                    </div>
                    {selectedProposal.published_at ? (
                      <p className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                        Published {formatDate(selectedProposal.published_at)}
                      </p>
                    ) : null}
                  </div>
                </section>

                <div className="space-y-4">
                  {selectedItems.map((item) => {
                    const draftText =
                      drafts[item.id] ??
                      item.admin_final_body ??
                      item.ai_proposed_body;
                    const noteText = notes[item.id] ?? item.admin_note ?? "";
                    const isSaving = savingItemId === item.id;

                    return (
                      <article
                        className="rounded-md border border-slate-200 p-4"
                        key={item.id}
                      >
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <h4 className="font-semibold text-slate-900">
                              {item.content_label}
                            </h4>
                            <p className="mt-1 text-xs text-slate-500">
                              {item.content_key}
                              {item.source_version_number
                                ? ` · source v${item.source_version_number}`
                                : ""}{" "}
                              · {item.risk_category} · confidence{" "}
                              {Math.round(Number(item.confidence ?? 0) * 100)}%
                            </p>
                          </div>
                          <p className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                            {item.review_status.replaceAll("_", " ")}
                          </p>
                        </div>

                        {item.justification ? (
                          <p className="mt-3 rounded-md bg-amber-50 p-3 text-sm text-amber-900">
                            {item.justification}
                          </p>
                        ) : null}

                        <div className="mt-4 grid gap-3 xl:grid-cols-3">
                          <label className="block text-sm font-medium text-slate-700">
                            Current
                            <textarea
                              className="mt-2 min-h-48 w-full rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600"
                              readOnly
                              value={item.original_body}
                            />
                          </label>
                          <label className="block text-sm font-medium text-slate-700">
                            Suggested
                            <textarea
                              className="mt-2 min-h-48 w-full rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600"
                              readOnly
                              value={item.ai_proposed_body}
                            />
                          </label>
                          <label className="block text-sm font-medium text-slate-700">
                            Your version
                            <textarea
                              className="mt-2 min-h-48 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                              onChange={(event) =>
                                onDraftChange(item.id, event.target.value)
                              }
                              value={draftText}
                            />
                          </label>
                        </div>

                        <label className="mt-3 block text-sm font-medium text-slate-700">
                          Admin note
                          <input
                            className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                            onChange={(event) =>
                              onNoteChange(item.id, event.target.value)
                            }
                            placeholder="Optional review note"
                            value={noteText}
                          />
                        </label>

                        <div className="mt-4 flex flex-wrap gap-2">
                          <button
                            className="rounded-md border border-emerald-300 px-3 py-2 text-sm font-semibold text-emerald-700 disabled:text-slate-400"
                            disabled={isSaving}
                            onClick={() => onReviewItem(item, "accepted")}
                            type="button"
                          >
                            Accept suggested
                          </button>
                          <button
                            className="rounded-md border border-blue-300 px-3 py-2 text-sm font-semibold text-blue-700 disabled:text-slate-400"
                            disabled={isSaving}
                            onClick={() => onReviewItem(item, "edited")}
                            type="button"
                          >
                            Accept your version
                          </button>
                          <button
                            className="rounded-md border border-amber-300 px-3 py-2 text-sm font-semibold text-amber-700 disabled:text-slate-400"
                            disabled={isSaving}
                            onClick={() => onReviewItem(item, "needs_later_review")}
                            type="button"
                          >
                            Defer
                          </button>
                          <button
                            className="rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 disabled:text-slate-400"
                            disabled={isSaving}
                            onClick={() => onReviewItem(item, "rejected")}
                            type="button"
                          >
                            Reject
                          </button>
                        </div>
                      </article>
                    );
                  })}
                </div>

                <form
                  className="rounded-md border border-slate-200 p-4"
                  onSubmit={onPublish}
                >
                  <h4 className="font-semibold text-slate-900">
                    Publish reviewed changes
                  </h4>
                  <p className="mt-1 text-sm text-slate-600">
                    Publishing creates new current Agent Knowledge versions for
                    accepted or edited items only.
                  </p>
                  <label className="mt-3 block text-sm font-medium text-slate-700">
                    Publish note
                    <input
                      className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                      onChange={(event) =>
                        onPublishNoteChange(event.target.value)
                      }
                      placeholder="Why are these knowledge updates being published?"
                      value={publishNote}
                    />
                  </label>
                  <button
                    className="mt-3 rounded-md bg-slate-900 px-4 py-2 font-semibold text-white disabled:bg-slate-400"
                    disabled={
                      publishableCount === 0 ||
                      publishingProposalId === selectedProposal.id
                    }
                    type="submit"
                  >
                    {publishingProposalId === selectedProposal.id
                      ? "Publishing..."
                      : `Publish ${publishableCount} reviewed change${
                          publishableCount === 1 ? "" : "s"
                        }`}
                  </button>
                </form>
              </>
            ) : null}
          </div>
        </div>
      )}
        </>
      ) : null}
    </section>
  );
}
