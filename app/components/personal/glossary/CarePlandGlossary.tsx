"use client";

import Image from "next/image";
import { ReactNode, useEffect, useId, useState } from "react";

import {
  normalizeCarePlandGlossaryContent,
  parseCarePlandGlossaryBody,
  serializeCarePlandGlossaryContent,
  validateCarePlandGlossaryContent,
  type CarePlandGlossaryContent,
  type CarePlandGlossaryEntry,
} from "../../../lib/platform/content/carePlandGlossary";

export {
  carePlandGlossaryContentKey,
  defaultCarePlandGlossaryBody,
  defaultCarePlandGlossaryContent,
  normalizeCarePlandGlossaryContent,
  parseCarePlandGlossaryBody,
  serializeCarePlandGlossaryContent,
  validateCarePlandGlossaryContent,
  type CarePlandGlossaryContent,
  type CarePlandGlossaryEntry,
} from "../../../lib/platform/content/carePlandGlossary";

function glossaryEntriesForDisplay(content: CarePlandGlossaryContent) {
  return normalizeCarePlandGlossaryContent(content).entries
    .filter((entry) => entry.active)
    .sort((a, b) => a.order - b.order || a.term.localeCompare(b.term));
}

function compactDescription(description: string) {
  return description.replace(/\n{2,}/g, "\n").trim();
}

export function CarePlandGlossaryPage({
  content,
  footer,
}: {
  content: CarePlandGlossaryContent;
  footer?: ReactNode;
}) {
  const normalized = normalizeCarePlandGlossaryContent(content);
  const entries = glossaryEntriesForDisplay(normalized);

  return (
    <section className="flex h-full items-center">
      <div className="w-full max-w-3xl">
        {normalized.intro.trim() ? (
          <p className="max-w-2xl text-xl font-semibold leading-relaxed text-[#4d6074]">
            {normalized.intro}
          </p>
        ) : null}

        <div className={normalized.intro.trim() ? "mt-5 space-y-3" : "space-y-3"}>
          {entries.map((entry) => (
            <article
              className="flex items-start gap-4 py-1.5"
              key={`${entry.order}-${entry.term}`}
            >
              <span
                aria-hidden="true"
                className="w-12 shrink-0 text-3xl leading-tight"
              >
                {entry.icon}
              </span>
              <div className="min-w-0">
                <h3 className="text-2xl font-black leading-tight text-[#2B6198]">
                  {entry.term}
                </h3>
                <p className="mt-1 whitespace-pre-line text-base font-semibold leading-snug text-[#4d6074]">
                  {compactDescription(entry.description)}
                </p>
              </div>
            </article>
          ))}
        </div>

        {footer ? <div className="mt-8">{footer}</div> : null}
      </div>
    </section>
  );
}

export function CarePlandGlossaryDialog({
  content,
  onClose,
}: {
  content: CarePlandGlossaryContent;
  onClose: () => void;
}) {
  const titleId = useId();

  useEffect(() => {
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    document.addEventListener("keydown", closeOnEscape);

    return () => {
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [onClose]);

  return (
    <div
      aria-labelledby={titleId}
      aria-modal="true"
      className="fixed inset-0 z-[90] grid place-items-center bg-[#173150]/25 px-3 py-5"
      role="dialog"
    >
      <button
        aria-label="Close glossary"
        className="absolute inset-0 cursor-default"
        onClick={onClose}
        type="button"
      />
      <section className="relative flex h-[min(640px,calc(100vh-2.5rem))] w-full max-w-[1024px] flex-col overflow-hidden rounded-2xl bg-white shadow-2xl ring-1 ring-[#d6e3f2]">
        <header className="bg-[#f8fbff] px-8 pb-0 pt-5 sm:px-12 sm:pt-6 lg:px-14">
          <div className="relative border-b border-[#d6e3f2] pb-4">
            <button
              aria-label="Close glossary"
              className="absolute right-0 top-0 grid h-11 w-11 place-items-center rounded-lg bg-transparent text-xl font-black text-[#173150] hover:bg-[#edf5fc] focus:outline-none focus:ring-2 focus:ring-[#4e84b2]"
              onClick={onClose}
              type="button"
            >
              ×
            </button>
            <div className="flex min-h-12 items-center gap-3 pr-14">
              <Image
                alt=""
                aria-hidden="true"
                className="h-11 w-11 shrink-0 rounded-full"
                height={44}
                src="/carepland-loop-mark.png"
                width={44}
              />
              <h2 className="text-2xl font-black leading-tight text-[#172f49]">
                Glossary
              </h2>
            </div>
          </div>
        </header>
        <div className="flex-1 px-8 py-6 sm:px-12 lg:px-14">
          <div id={titleId}>
            <CarePlandGlossaryPage content={content} />
          </div>
        </div>
        <footer className="sticky bottom-0 bg-white/95 px-8 backdrop-blur sm:px-12 lg:px-14">
          <div className="flex justify-end border-t border-[#d6e3f2] py-4">
            <button
              className="min-h-11 rounded-lg bg-[#2f6f9f] px-5 text-sm font-black text-white hover:bg-[#285f89] focus:outline-none focus:ring-2 focus:ring-[#4e84b2]"
              onClick={onClose}
              type="button"
            >
              Done
            </button>
          </div>
        </footer>
      </section>
    </div>
  );
}

export function useGlossaryDraft(
  body: string,
  onChangeBody: (value: string) => void
) {
  const [draft, setDraft] = useState(() => parseCarePlandGlossaryBody(body));

  useEffect(() => {
    setDraft(parseCarePlandGlossaryBody(body));
  }, [body]);

  function updateDraft(nextDraft: CarePlandGlossaryContent) {
    setDraft(nextDraft);
    onChangeBody(serializeCarePlandGlossaryContent(nextDraft));
  }

  function updateEntry(
    index: number,
    patch: Partial<CarePlandGlossaryEntry>
  ) {
    updateDraft({
      ...draft,
      entries: draft.entries.map((entry, entryIndex) =>
        entryIndex === index ? { ...entry, ...patch } : entry
      ),
    });
  }

  function addEntry() {
    const nextOrder =
      Math.max(0, ...draft.entries.map((entry) => entry.order || 0)) + 10;
    updateDraft({
      ...draft,
      entries: [
        ...draft.entries,
        {
          active: true,
          description: "",
          icon: "",
          order: nextOrder,
          term: "",
        },
      ],
    });
  }

  function removeEntry(index: number) {
    updateDraft({
      ...draft,
      entries: draft.entries.filter((_, entryIndex) => entryIndex !== index),
    });
  }

  return {
    addEntry,
    draft,
    removeEntry,
    updateDraft,
    updateEntry,
    validationErrors: validateCarePlandGlossaryContent(draft),
  };
}
