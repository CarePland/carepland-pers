"use client";

import { FormEvent } from "react";

import { AppContentVersion } from "./AdminContentPanel";

type AdminAgentKnowledgePanelProps = {
  agentEscalationGuidance: string;
  agentKnowledgeChangeNote: string;
  agentKnowledgeVersions: AppContentVersion[];
  agentKnownLimitations: string;
  agentProductFacts: string;
  agentVoiceGuidance: string;
  formatDate: (value: string | null) => string;
  onSave: (event: FormEvent<HTMLFormElement>) => void;
  saving: boolean;
  setAgentEscalationGuidance: (value: string) => void;
  setAgentKnowledgeChangeNote: (value: string) => void;
  setAgentKnownLimitations: (value: string) => void;
  setAgentProductFacts: (value: string) => void;
  setAgentVoiceGuidance: (value: string) => void;
};

export function AdminAgentKnowledgePanel({
  agentEscalationGuidance,
  agentKnowledgeChangeNote,
  agentKnowledgeVersions,
  agentKnownLimitations,
  agentProductFacts,
  agentVoiceGuidance,
  formatDate,
  onSave,
  saving,
  setAgentEscalationGuidance,
  setAgentKnowledgeChangeNote,
  setAgentKnownLimitations,
  setAgentProductFacts,
  setAgentVoiceGuidance,
}: AdminAgentKnowledgePanelProps) {
  return (
    <section className="space-y-5">
      <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
        <h3 className="text-lg font-semibold text-slate-900">
          Agent Knowledge
        </h3>
        <p className="mt-1 text-sm text-slate-600">
          These facts are injected into the support assistant so it can answer
          with current product context.
        </p>
      </div>

      <form className="space-y-4" onSubmit={onSave}>
        <label className="block text-sm font-medium text-slate-700">
          Product facts
          <textarea
            className="mt-2 min-h-36 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            onChange={(event) => setAgentProductFacts(event.target.value)}
            value={agentProductFacts}
          />
        </label>
        <label className="block text-sm font-medium text-slate-700">
          Known limitations
          <textarea
            className="mt-2 min-h-28 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            onChange={(event) => setAgentKnownLimitations(event.target.value)}
            value={agentKnownLimitations}
          />
        </label>
        <label className="block text-sm font-medium text-slate-700">
          Escalation guidance
          <textarea
            className="mt-2 min-h-28 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            onChange={(event) =>
              setAgentEscalationGuidance(event.target.value)
            }
            value={agentEscalationGuidance}
          />
        </label>
        <label className="block text-sm font-medium text-slate-700">
          Voice guidance
          <textarea
            className="mt-2 min-h-28 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            onChange={(event) => setAgentVoiceGuidance(event.target.value)}
            value={agentVoiceGuidance}
          />
        </label>
        <label className="block text-sm font-medium text-slate-700">
          Change note
          <input
            className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2 text-base"
            onChange={(event) => setAgentKnowledgeChangeNote(event.target.value)}
            placeholder="What changed and why?"
            value={agentKnowledgeChangeNote}
          />
        </label>
        <button
          className="rounded-md bg-slate-900 px-4 py-2 font-semibold text-white disabled:bg-slate-400"
          disabled={saving}
          type="submit"
        >
          {saving ? "Saving..." : "Save agent knowledge"}
        </button>
      </form>

      <section className="border-t border-slate-200 pt-5">
        <h3 className="text-lg font-semibold text-slate-900">
          Knowledge version history
        </h3>
        {agentKnowledgeVersions.length === 0 ? (
          <p className="mt-3 rounded-md bg-slate-100 p-3 text-sm text-slate-600">
            No saved agent knowledge versions yet. The assistant will use the
            default knowledge text until this is saved.
          </p>
        ) : (
          <div className="mt-3 space-y-3">
            {agentKnowledgeVersions.slice(0, 12).map((version) => (
              <article
                className="rounded-md border border-slate-200 p-4"
                key={version.id}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-slate-900">
                      {version.label} · v{version.version_number}
                      {version.is_current ? " · current" : ""}
                    </p>
                    <p className="mt-1 text-sm text-slate-500">
                      {formatDate(version.created_at)}
                    </p>
                    {version.change_note ? (
                      <p className="mt-2 text-sm text-slate-700">
                        {version.change_note}
                      </p>
                    ) : null}
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </section>
  );
}
