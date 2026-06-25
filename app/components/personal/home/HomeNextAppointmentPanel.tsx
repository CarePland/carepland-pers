"use client";

import { useState, type ReactNode } from "react";

import { PersonChip } from "../../shared/PersonAvatar";
import {
  ChevronDownIcon,
  ChevronRightIcon,
  PencilSquareIcon,
} from "../../shared/icons";
import type { AvatarPerson } from "../../../lib/platform/avatar";

type HomeAppointment = {
  id: string;
  is_sample_data?: boolean | null;
  location_address?: string | null;
  provider_name?: string | null;
  starts_at: string | null;
  title: string | null;
};

type HomeCarePrepGuidance = {
  summary: string | null;
};

type HomeCarePrepHighlight = {
  items: string[];
  label: string;
};

type HomeNextAppointmentPanelProps = {
  appointment: HomeAppointment | null;
  addNotesOpen?: boolean;
  children?: ReactNode;
  formatDate: (value: string | null) => string;
  generationError: string | null | undefined;
  guidance: HomeCarePrepGuidance | null;
  highlights: HomeCarePrepHighlight[];
  isGenerating: boolean;
  isCarePrepEligible: boolean;
  mapsLink: string | null;
  nextSubject: string;
  nextSubjectAvatar?: AvatarPerson | null;
  onAddAppointment: () => void;
  onAddNotes?: () => void;
  practiceLabel: string;
};

function MapPinMiniIcon({ className = "h-3.5 w-3.5" }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
      viewBox="0 0 24 24"
    >
      <path d="M12 21s7-4.4 7-11a7 7 0 1 0-14 0c0 6.6 7 11 7 11Z" />
      <circle cx="12" cy="10" r="2.5" />
    </svg>
  );
}

function formatMobileAppointmentDate(value: string | null) {
  if (!value) {
    return { date: "Date TBD", time: "" };
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return { date: "Date TBD", time: "" };
  }

  return {
    date: date.toLocaleDateString(undefined, {
      day: "numeric",
      month: "long",
    }),
    time: date.toLocaleTimeString(undefined, {
      hour: "numeric",
      minute: "2-digit",
    }),
  };
}

const primaryButtonClass =
  "rounded-full bg-blue-700 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-800 disabled:bg-slate-400";

function DemoPill() {
  return (
    <span className="whitespace-nowrap rounded-full border border-slate-200 bg-slate-100 px-2.5 py-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
      Demo
    </span>
  );
}

function HomeCarePrepPreview({
  guidance,
  highlights,
}: {
  guidance: HomeCarePrepGuidance;
  highlights: HomeCarePrepHighlight[];
}) {
  const highlightGridClassName =
    highlights.length === 1
      ? "mt-5 grid gap-5"
      : highlights.length === 2
        ? "mt-5 grid gap-5 md:grid-cols-2"
        : "mt-5 grid gap-5 md:grid-cols-3";

  return (
    <div>
      <p className="text-base leading-7 text-slate-700">{guidance.summary}</p>
      {highlights.length > 0 ? (
        <div className={highlightGridClassName}>
          {highlights.map((section) => (
            <section key={section.label}>
              <h4 className="font-semibold text-slate-900">{section.label}</h4>
              <ul className="mt-2 space-y-1 text-sm text-slate-700">
                {section.items.map((item, index) => (
                  <li key={`${section.label}-${index}`}>{item}</li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function HomeNextAppointmentPanel({
  addNotesOpen = false,
  appointment,
  children,
  formatDate,
  generationError,
  guidance,
  highlights,
  isGenerating,
  isCarePrepEligible,
  mapsLink,
  nextSubject,
  nextSubjectAvatar,
  onAddAppointment,
  onAddNotes,
  practiceLabel,
}: HomeNextAppointmentPanelProps) {
  const [carePrepOpen, setCarePrepOpen] = useState(false);
  const mobileDate = formatMobileAppointmentDate(appointment?.starts_at ?? null);
  const canShowCarePrep = Boolean(
    appointment && (guidance || isGenerating || isCarePrepEligible)
  );
  const canShowNotes = Boolean(appointment && onAddNotes);
  const carePrepSelected = carePrepOpen && !addNotesOpen;
  const toggleCarePrep = () => {
    if (addNotesOpen) {
      onAddNotes?.();
    }
    setCarePrepOpen((isOpen) => !isOpen);
  };
  const toggleAddNotes = () => {
    setCarePrepOpen(false);
    onAddNotes?.();
  };

  return (
    <section className="overflow-hidden px-1 pb-2 pt-1">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-4">
        <div className="min-w-0">
          {appointment ? (
            <div>
              <span className="block text-sm font-semibold text-blue-700">
                Next appointment
              </span>
              <span className="mt-1 flex flex-wrap items-center gap-2">
                <span className="min-w-0 truncate text-4xl font-semibold text-slate-950">
                  {appointment.title || "Untitled appointment"}
                </span>
                {canShowCarePrep ? (
                  <button
                    aria-expanded={carePrepSelected}
                    className="inline-flex items-center gap-1.5 rounded-lg px-1 py-1 text-xl font-semibold leading-none text-blue-900 transition hover:text-blue-700 disabled:opacity-60"
                    disabled={isGenerating}
                    onClick={toggleCarePrep}
                    title={
                      carePrepSelected
                        ? "Close What to Know"
                        : "Open What to Know"
                    }
                    type="button"
                  >
                    <span>✓ What to Know</span>
                    {carePrepSelected ? (
                      <ChevronDownIcon className="h-5 w-5" />
                    ) : (
                      <ChevronRightIcon className="h-5 w-5" />
                    )}
                  </button>
                ) : null}
                {appointment.is_sample_data ? <DemoPill /> : null}
              </span>
              {appointment.provider_name ? (
                <p className="mt-3 text-xl text-[#767676]">
                  {appointment.provider_name}
                </p>
              ) : null}
            </div>
          ) : (
            <>
              <p className="text-sm font-semibold text-blue-700">
                Next appointment
              </p>
              <h2 className="mt-2 text-2xl font-semibold text-slate-950">
                Nothing scheduled
              </h2>
            </>
          )}
          {!appointment ? (
            <p className="mt-2 text-slate-600">
              Add an appointment when something is coming up.
            </p>
          ) : null}
        </div>
        <div className="text-left md:min-w-64 md:text-right">
          {appointment ? (
            <>
              <div className="flex flex-wrap items-center gap-3 text-2xl font-medium text-slate-700 md:justify-end">
                {canShowNotes ? (
                  <button
                    aria-expanded={addNotesOpen}
                    className="inline-flex items-center gap-1.5 rounded-md px-1 py-1 text-sm font-semibold text-blue-800 transition hover:bg-blue-50 hover:text-blue-950"
                    onClick={toggleAddNotes}
                    title={addNotesOpen ? "Close notes" : "Add notes"}
                    type="button"
                  >
                    <PencilSquareIcon className="h-4 w-4" />
                    <span>Add Notes</span>
                  </button>
                ) : null}
                <span className="hidden md:inline">
                  {formatDate(appointment.starts_at)}
                </span>
                <span className="block text-right leading-tight md:hidden">
                  <span className="block">{mobileDate.date}</span>
                  {mobileDate.time ? <span className="block">{mobileDate.time}</span> : null}
                </span>
              </div>
              {practiceLabel ? (
                <div className="mt-3 text-base text-[#767676]">
                  {mapsLink ? (
                    <a
                      className="inline-flex items-center gap-1 text-left font-medium text-[#767676] hover:text-blue-800 md:justify-end md:text-right"
                      href={mapsLink}
                      rel="noreferrer"
                      target="_blank"
                    >
                      <MapPinMiniIcon />
                      <span className="md:hidden">Show map</span>
                      <span className="hidden md:inline">{practiceLabel}</span>
                    </a>
                  ) : (
                    <span>{practiceLabel}</span>
                  )}
                </div>
              ) : null}
            </>
          ) : (
            <button
              className={primaryButtonClass}
              onClick={onAddAppointment}
              type="button"
            >
              Add appointment
            </button>
          )}
        </div>
      </div>

      {carePrepSelected ? (
        <section className="mt-5">
          {guidance ? (
            <HomeCarePrepPreview
              key={`${appointment?.id}:${guidance.summary ?? ""}`}
              guidance={guidance}
              highlights={highlights}
            />
          ) : (
            <p className="min-w-0 text-sm leading-6 text-slate-700">
              {isGenerating
                ? "Preparing a short CarePrep view for this appointment..."
                : "CarePrep will appear here when it is available for this appointment."}
            </p>
          )}
          {isGenerating ? (
            <span className="mt-4 inline-flex rounded-full bg-blue-100 px-3 py-1 text-sm font-semibold text-blue-900">
              Generating...
            </span>
          ) : null}
          {generationError ? (
            <p className="mt-3 rounded-md border border-blue-200 bg-[#f4faff] px-3 py-2 text-sm font-medium text-blue-950">
              {generationError}
            </p>
          ) : null}
        </section>
      ) : null}

      {addNotesOpen && children ? <div className="mt-4">{children}</div> : null}

      {appointment && (appointment.provider_name || nextSubject) ? (
        <div className="mt-4 flex flex-wrap items-center justify-end gap-x-4 gap-y-1 text-xs font-medium text-[#767676]">
          <PersonChip
            person={nextSubjectAvatar ?? { displayName: nextSubject }}
            size="xs"
          />
        </div>
      ) : null}
    </section>
  );
}
