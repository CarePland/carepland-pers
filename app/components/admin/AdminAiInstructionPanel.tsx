"use client";

import { FormEvent } from "react";

export type AiInstructionVersion = {
  id: string;
  version_number: number;
  system_prompt: string;
  user_prompt_template: string;
  output_schema: unknown;
  model: string | null;
  temperature: number | null;
  is_current: boolean;
  change_note: string | null;
  content_hash: string | null;
  copied_from_version_id: string | null;
  created_at: string;
};

type AdminAiInstructionPanelProps = {
  draftSourceVersion: AiInstructionVersion | null;
  formatDate: (value: string | null) => string;
  instructionChangeNote: string;
  instructionModel: string;
  instructionOutputSchema: string;
  instructionSystemPrompt: string;
  instructionUserPrompt: string;
  instructionVersions: AiInstructionVersion[];
  onLoadVersion: (version: AiInstructionVersion) => void;
  onRevertVersion: (version: AiInstructionVersion) => void;
  onSave: (event: FormEvent<HTMLFormElement>) => void;
  revertingInstructionForId: string | null;
  saving: boolean;
  setInstructionChangeNote: (value: string) => void;
  setInstructionModel: (value: string) => void;
  setInstructionOutputSchema: (value: string) => void;
  setInstructionSystemPrompt: (value: string) => void;
  setInstructionUserPrompt: (value: string) => void;
  workflowLabel: string;
};

export function AdminAiInstructionPanel({
  draftSourceVersion,
  formatDate,
  instructionChangeNote,
  instructionModel,
  instructionOutputSchema,
  instructionSystemPrompt,
  instructionUserPrompt,
  instructionVersions,
  onLoadVersion,
  onRevertVersion,
  onSave,
  revertingInstructionForId,
  saving,
  setInstructionChangeNote,
  setInstructionModel,
  setInstructionOutputSchema,
  setInstructionSystemPrompt,
  setInstructionUserPrompt,
  workflowLabel,
}: AdminAiInstructionPanelProps) {
  return (
    <>
      <form className="mt-5 space-y-4" onSubmit={onSave}>
        {draftSourceVersion ? (
          <p className="rounded-md bg-slate-100 p-3 text-sm text-slate-600">
            Editing from v{draftSourceVersion.version_number}
            {draftSourceVersion.content_hash
              ? ` · ${draftSourceVersion.content_hash.slice(0, 12)}`
              : ""}
          </p>
        ) : null}

        <label className="block text-sm font-medium text-slate-700">
          Model
          <input
            className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2 text-base"
            onChange={(event) => setInstructionModel(event.target.value)}
            value={instructionModel}
          />
        </label>

        <label className="block text-sm font-medium text-slate-700">
          System prompt
          <textarea
            className="mt-2 min-h-40 w-full rounded-md border border-slate-300 px-3 py-2 font-mono text-sm"
            onChange={(event) =>
              setInstructionSystemPrompt(event.target.value)
            }
            placeholder={`Paste the ${workflowLabel} system instructions here.`}
            value={instructionSystemPrompt}
          />
        </label>

        <label className="block text-sm font-medium text-slate-700">
          User prompt template
          <textarea
            className="mt-2 min-h-40 w-full rounded-md border border-slate-300 px-3 py-2 font-mono text-sm"
            onChange={(event) => setInstructionUserPrompt(event.target.value)}
            placeholder="Optional context template for the user message."
            value={instructionUserPrompt}
          />
        </label>

        <label className="block text-sm font-medium text-slate-700">
          Output schema JSON
          <textarea
            className="mt-2 min-h-40 w-full rounded-md border border-slate-300 px-3 py-2 font-mono text-sm"
            onChange={(event) => setInstructionOutputSchema(event.target.value)}
            value={instructionOutputSchema}
          />
        </label>

        <label className="block text-sm font-medium text-slate-700">
          Change note
          <input
            className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2 text-base"
            onChange={(event) => setInstructionChangeNote(event.target.value)}
            placeholder="What changed in this version?"
            value={instructionChangeNote}
          />
        </label>

        <button
          className="rounded-md bg-slate-900 px-4 py-2 font-semibold text-white disabled:bg-slate-400"
          disabled={saving}
          type="submit"
        >
          {saving ? "Saving..." : "Save new version"}
        </button>
      </form>

      {instructionVersions.length > 0 ? (
        <section className="mt-6 border-t border-slate-200 pt-5">
          <h3 className="text-lg font-semibold text-slate-900">
            Version history
          </h3>
          <div className="mt-3 space-y-3">
            {instructionVersions.map((version) => (
              <article
                className="rounded-md border border-slate-200 p-4"
                key={version.id}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-slate-900">
                      v{version.version_number}
                      {version.is_current ? " · current" : ""}
                    </p>
                    <p className="mt-1 text-sm text-slate-500">
                      {formatDate(version.created_at)}
                      {version.model ? ` · ${version.model}` : ""}
                    </p>
                    {version.content_hash ? (
                      <p className="mt-1 font-mono text-xs text-slate-500">
                        {version.content_hash}
                      </p>
                    ) : null}
                    {version.change_note ? (
                      <p className="mt-2 text-sm text-slate-700">
                        {version.change_note}
                      </p>
                    ) : null}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      className="rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700"
                      onClick={() => onLoadVersion(version)}
                      type="button"
                    >
                      View
                    </button>
                    {!version.is_current ? (
                      <button
                        className="rounded-md border border-blue-300 px-3 py-2 text-sm font-semibold text-blue-700 disabled:text-slate-400"
                        disabled={revertingInstructionForId === version.id}
                        onClick={() => onRevertVersion(version)}
                        type="button"
                      >
                        {revertingInstructionForId === version.id
                          ? "Reverting..."
                          : "Revert"}
                      </button>
                    ) : null}
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>
      ) : null}
    </>
  );
}
