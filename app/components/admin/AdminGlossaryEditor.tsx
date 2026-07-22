"use client";

import {
  CarePlandGlossaryPage,
  useGlossaryDraft,
} from "../personal/glossary/CarePlandGlossary";

type AdminGlossaryEditorProps = {
  appContentBody: string;
  setAppContentBody: (value: string) => void;
};

export function AdminGlossaryEditor({
  appContentBody,
  setAppContentBody,
}: AdminGlossaryEditorProps) {
  const {
    addEntry,
    draft,
    removeEntry,
    updateDraft,
    updateEntry,
    validationErrors,
  } = useGlossaryDraft(appContentBody, setAppContentBody);

  return (
    <section className="mt-5 space-y-5">
      <div className="rounded-lg border border-blue-200 bg-[#f4faff] p-4 text-sm font-medium text-blue-950">
        Edit the draft here, then use Publish new version below. User-facing
        glossary surfaces continue using the current published version until
        publication succeeds.
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(24rem,0.9fr)]">
        <div className="space-y-4">
          <label className="block text-sm font-medium text-slate-700">
            Glossary title
            <input
              className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2 text-base"
              maxLength={60}
              onChange={(event) =>
                updateDraft({ ...draft, title: event.target.value })
              }
              value={draft.title}
            />
          </label>

          <label className="block text-sm font-medium text-slate-700">
            Intro text
            <textarea
              className="mt-2 min-h-24 w-full rounded-md border border-slate-300 px-3 py-2 text-base leading-7"
              maxLength={220}
              onChange={(event) =>
                updateDraft({ ...draft, intro: event.target.value })
              }
              value={draft.intro}
            />
          </label>

          <div className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-lg font-semibold text-slate-900">
                Glossary entries
              </h3>
              <button
                className="rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700"
                onClick={addEntry}
                type="button"
              >
                Add entry
              </button>
            </div>

            {draft.entries.map((entry, index) => (
              <article
                className="rounded-lg border border-slate-200 bg-white p-4"
                key={index}
              >
                <div className="grid gap-3 sm:grid-cols-[4.5rem_5rem_minmax(0,1fr)_auto]">
                  <label className="block text-sm font-medium text-slate-700">
                    Order
                    <input
                      className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2 text-base"
                      onChange={(event) =>
                        updateEntry(index, {
                          order: Number(event.target.value) || 0,
                        })
                      }
                      type="number"
                      value={entry.order}
                    />
                  </label>
                  <label className="block text-sm font-medium text-slate-700">
                    Icon
                    <input
                      className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2 text-base"
                      maxLength={8}
                      onChange={(event) =>
                        updateEntry(index, { icon: event.target.value })
                      }
                      value={entry.icon}
                    />
                  </label>
                  <label className="block text-sm font-medium text-slate-700">
                    Term
                    <input
                      className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2 text-base"
                      maxLength={40}
                      onChange={(event) =>
                        updateEntry(index, { term: event.target.value })
                      }
                      value={entry.term}
                    />
                  </label>
                  <label className="mt-8 flex items-center gap-2 text-sm font-semibold text-slate-700">
                    <input
                      checked={entry.active}
                      className="h-4 w-4"
                      onChange={(event) =>
                        updateEntry(index, { active: event.target.checked })
                      }
                      type="checkbox"
                    />
                    Active
                  </label>
                </div>
                <label className="mt-3 block text-sm font-medium text-slate-700">
                  Description
                  <textarea
                    className="mt-2 min-h-28 w-full rounded-md border border-slate-300 px-3 py-2 text-base leading-7"
                    maxLength={260}
                    onChange={(event) =>
                      updateEntry(index, { description: event.target.value })
                    }
                    value={entry.description}
                  />
                </label>
                <div className="mt-3 flex justify-end">
                  <button
                    className="rounded-md border border-rose-200 px-3 py-2 text-sm font-semibold text-rose-700"
                    onClick={() => removeEntry(index)}
                    type="button"
                  >
                    Remove
                  </button>
                </div>
              </article>
            ))}
          </div>

          {validationErrors.length ? (
            <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm font-medium text-amber-950">
              {validationErrors.map((error) => (
                <p key={error}>{error}</p>
              ))}
            </div>
          ) : (
            <p className="rounded-md border border-blue-200 bg-[#f4faff] p-3 text-sm font-medium text-blue-950">
              Ready to publish.
            </p>
          )}

          <details className="rounded-lg border border-slate-200 bg-slate-50 p-4">
            <summary className="cursor-pointer text-sm font-semibold text-slate-700">
              JSON body
            </summary>
            <textarea
              className="mt-3 min-h-64 w-full rounded-md border border-slate-300 px-3 py-2 font-mono text-sm"
              onChange={(event) => setAppContentBody(event.target.value)}
              value={appContentBody}
            />
          </details>
        </div>

        <aside className="rounded-lg border border-slate-200 bg-white p-4">
          <h3 className="text-lg font-semibold text-slate-900">Preview</h3>
          <div className="mt-4 h-[640px] overflow-hidden rounded-2xl bg-white shadow-2xl ring-1 ring-[#d6e3f2]">
            <div className="flex h-full flex-col">
              <header className="bg-[#f8fbff] px-7 pt-5">
                <div className="border-b border-[#d6e3f2] pb-4">
                  <p className="text-[11px] font-black uppercase leading-tight tracking-normal text-[#5f6e84]">
                    CarePland Personal Setup
                  </p>
                  <span className="mt-3 inline-block rounded-full bg-[#2f6f9f] px-4 py-2 text-center text-sm font-black text-white">
                    Glossary
                  </span>
                </div>
              </header>
              <div className="flex-1 px-7 py-6">
                <CarePlandGlossaryPage content={draft} />
              </div>
            </div>
          </div>
        </aside>
      </div>
    </section>
  );
}
