"use client";

import { FormEvent } from "react";

export type AppContentVersion = {
  id: string;
  body: string;
  change_note: string | null;
  content_hash: string | null;
  content_key: string;
  copied_from_version_id: string | null;
  created_at: string;
  description: string | null;
  is_current: boolean;
  label: string;
  superseded_at: string | null;
  superseded_by_version_id: string | null;
  version_number: number;
};

type AppContentCategory = {
  description: string;
  key: string;
  label: string;
};

type AppContentOption = {
  category: string;
  contentKey: string;
  description: string;
  label: string;
};

type AppContentSaveMessage = {
  text: string;
  tone: "error" | "success";
};

type AdminContentPanelProps = {
  appContentBody: string;
  appContentCategories: readonly AppContentCategory[];
  appContentChangeNote: string;
  appContentDescription: string;
  appContentLabel: string;
  appContentOptions: readonly AppContentOption[];
  appContentSaveMessage: AppContentSaveMessage | null;
  appContentVersions: AppContentVersion[];
  filteredAppContentOptions: AppContentOption[];
  formatDate: (value: string | null) => string;
  handleChangeAppContentCategory: (categoryKey: string) => void;
  handleChangeAppContentKey: (contentKey: string) => void;
  handleRevertAppContent: (version: AppContentVersion) => void;
  handleSaveAppContent: (event: FormEvent<HTMLFormElement>) => void;
  loadAppContent: () => void;
  loadingAppContent: boolean;
  resetAppContentEditor: (version: AppContentVersion | null) => void;
  revertingAppContentForId: string | null;
  savingAppContent: boolean;
  selectedAppContent: AppContentVersion | null;
  selectedAppContentCategory: string;
  selectedAppContentCategoryConfig: AppContentCategory;
  selectedAppContentKey: string;
  setAppContentBody: (value: string) => void;
  setAppContentChangeNote: (value: string) => void;
  setAppContentDescription: (value: string) => void;
  setAppContentLabel: (value: string) => void;
};

export function AdminContentPanel({
  appContentBody,
  appContentCategories,
  appContentChangeNote,
  appContentDescription,
  appContentLabel,
  appContentOptions,
  appContentSaveMessage,
  appContentVersions,
  filteredAppContentOptions,
  formatDate,
  handleChangeAppContentCategory,
  handleChangeAppContentKey,
  handleRevertAppContent,
  handleSaveAppContent,
  loadAppContent,
  loadingAppContent,
  resetAppContentEditor,
  revertingAppContentForId,
  savingAppContent,
  selectedAppContent,
  selectedAppContentCategory,
  selectedAppContentCategoryConfig,
  selectedAppContentKey,
  setAppContentBody,
  setAppContentChangeNote,
  setAppContentDescription,
  setAppContentLabel,
}: AdminContentPanelProps) {
  const selectedVersions = appContentVersions.filter(
    (version) => version.content_key === selectedAppContentKey
  );

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold">Dynamic Text</h2>
          <p className="mt-1 text-slate-600">
            Edit beta, legal, support, and other app text without a code change.
            {selectedAppContent
              ? ` · current v${selectedAppContent.version_number}`
              : " · no current version"}
          </p>
        </div>
        <button
          className="rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700"
          disabled={loadingAppContent}
          onClick={() => loadAppContent()}
          type="button"
        >
          {loadingAppContent ? "Loading..." : "Reload"}
        </button>
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-[16rem_minmax(0,1fr)]">
        <aside className="space-y-2">
          <p className="text-sm font-medium text-slate-700">Text area</p>
          <div className="space-y-2">
            {appContentCategories.map((category) => {
              const count = appContentOptions.filter(
                (item) => item.category === category.key
              ).length;
              const isSelected = selectedAppContentCategory === category.key;

              return (
                <button
                  className={`w-full rounded-md border px-3 py-3 text-left transition ${
                    isSelected
                      ? "border-blue-300 bg-blue-50 text-blue-950"
                      : "border-slate-200 bg-white text-slate-700 hover:border-blue-200 hover:bg-blue-50"
                  }`}
                  key={category.key}
                  onClick={() => void handleChangeAppContentCategory(category.key)}
                  type="button"
                >
                  <span className="block font-semibold">{category.label}</span>
                  <span className="mt-1 block text-xs text-slate-500">
                    {count
                      ? `${count} editable item${count === 1 ? "" : "s"}`
                      : "Planned"}
                  </span>
                </button>
              );
            })}
          </div>
        </aside>

        <div>
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
            <p className="text-sm font-semibold text-slate-900">
              {selectedAppContentCategoryConfig.label}
            </p>
            <p className="mt-1 text-sm text-slate-600">
              {selectedAppContentCategoryConfig.description}
            </p>
          </div>

          {filteredAppContentOptions.length ? (
            <label className="mt-5 block max-w-xl text-sm font-medium text-slate-700">
              Text block
              <select
                className="mt-2 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-base"
                disabled={loadingAppContent}
                onChange={(event) =>
                  handleChangeAppContentKey(event.target.value)
                }
                value={selectedAppContentKey}
              >
                {filteredAppContentOptions.map((item) => (
                  <option key={item.contentKey} value={item.contentKey}>
                    {item.label}
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <div className="mt-5 rounded-md border border-dashed border-slate-300 bg-white p-4 text-sm text-slate-600">
              No managed content blocks are in this area yet. We can promote
              these strings when the app text is ready to be managed here.
            </div>
          )}

          {filteredAppContentOptions.length ? (
            <>
              <form className="mt-5 space-y-4" onSubmit={handleSaveAppContent}>
                <label className="block text-sm font-medium text-slate-700">
                  Label
                  <input
                    className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2 text-base"
                    onChange={(event) => setAppContentLabel(event.target.value)}
                    value={appContentLabel}
                  />
                </label>

                <label className="block text-sm font-medium text-slate-700">
                  Admin description
                  <input
                    className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2 text-base"
                    onChange={(event) =>
                      setAppContentDescription(event.target.value)
                    }
                    value={appContentDescription}
                  />
                </label>

                <label className="block text-sm font-medium text-slate-700">
                  {selectedAppContentCategory === "health_focus"
                    ? "Text shown in the app. Format: canonical = label_full;label_short"
                    : "Text shown in the app"}
                  <textarea
                    className="mt-2 min-h-64 w-full rounded-md border border-slate-300 px-3 py-2 text-base leading-7"
                    onChange={(event) => setAppContentBody(event.target.value)}
                    value={appContentBody}
                  />
                </label>

                <label className="block text-sm font-medium text-slate-700">
                  Change note
                  <input
                    className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2 text-base"
                    onChange={(event) =>
                      setAppContentChangeNote(event.target.value)
                    }
                    placeholder="What changed and why?"
                    value={appContentChangeNote}
                  />
                </label>

                <button
                  className="rounded-md bg-slate-900 px-4 py-2 font-semibold text-white disabled:bg-slate-400"
                  disabled={savingAppContent}
                  type="submit"
                >
                  {savingAppContent ? "Saving..." : "Save new version"}
                </button>
                {appContentSaveMessage ? (
                  <p
                    className={`rounded-md border px-3 py-2 text-sm font-medium ${
                      appContentSaveMessage.tone === "success"
                        ? "border-blue-200 bg-[#f4faff] text-blue-950"
                        : "border-rose-200 bg-rose-50 text-rose-900"
                    }`}
                  >
                    {appContentSaveMessage.text}
                  </p>
                ) : null}
              </form>

              <section className="mt-6 border-t border-slate-200 pt-5">
                <h3 className="text-lg font-semibold text-slate-900">
                  Version history
                </h3>
                <div className="mt-3 space-y-3">
                  {selectedVersions.map((version) => (
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
                            onClick={() => resetAppContentEditor(version)}
                            type="button"
                          >
                            View
                          </button>
                          {!version.is_current ? (
                            <button
                              className="rounded-md border border-blue-300 px-3 py-2 text-sm font-semibold text-blue-700 disabled:text-slate-400"
                              disabled={revertingAppContentForId === version.id}
                              onClick={() => handleRevertAppContent(version)}
                              type="button"
                            >
                              {revertingAppContentForId === version.id
                                ? "Reverting..."
                                : "Revert"}
                            </button>
                          ) : null}
                        </div>
                      </div>
                    </article>
                  ))}
                  {selectedVersions.length === 0 ? (
                    <p className="rounded-md bg-slate-100 p-3 text-sm text-slate-600">
                      No saved versions found yet. Saving will create version 1.
                    </p>
                  ) : null}
                </div>
              </section>
            </>
          ) : null}
        </div>
      </div>
    </section>
  );
}
