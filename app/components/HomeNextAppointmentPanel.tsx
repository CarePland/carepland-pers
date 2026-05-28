"use client";

type HomeAppointment = {
  id: string;
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
  formatDate: (value: string | null) => string;
  generationError: string | null | undefined;
  guidance: HomeCarePrepGuidance | null;
  highlights: HomeCarePrepHighlight[];
  isGenerating: boolean;
  mapsLink: string | null;
  nextSubject: string;
  onAddAppointment: () => void;
  onGenerateCarePrep: () => void;
  onOpenAppointment: () => void;
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

function RefreshCircleIcon({ className = "h-4 w-4" }: { className?: string }) {
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
      <path d="M21 12a9 9 0 0 1-15.2 6.5" />
      <path d="M3 12A9 9 0 0 1 18.2 5.5" />
      <path d="M18 2v4h-4" />
      <path d="M6 22v-4h4" />
    </svg>
  );
}

const primaryButtonClass =
  "rounded-full bg-blue-700 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-800 disabled:bg-slate-400";

const openAreaButtonClass =
  "block w-full rounded-md text-left transition hover:bg-blue-50/50 focus:outline-none focus:ring-2 focus:ring-blue-200";

export function HomeNextAppointmentPanel({
  appointment,
  formatDate,
  generationError,
  guidance,
  highlights,
  isGenerating,
  mapsLink,
  nextSubject,
  onAddAppointment,
  onGenerateCarePrep,
  onOpenAppointment,
  practiceLabel,
}: HomeNextAppointmentPanelProps) {
  return (
    <section className="overflow-hidden rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_auto]">
        <div className="min-w-0">
          {appointment ? (
            <button
              aria-label="Open appointment"
              className={openAreaButtonClass}
              onClick={onOpenAppointment}
              title="Open appointment"
              type="button"
            >
              <span className="block text-sm font-semibold text-blue-700">
                Next appointment
              </span>
              <span className="block text-2xl font-semibold text-slate-950">
                {appointment.title || "Untitled appointment"}
              </span>
            </button>
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
              <p className="text-lg font-medium text-slate-700">
                {formatDate(appointment.starts_at)}
              </p>
              {practiceLabel ? (
                <div className="mt-1 text-sm text-slate-600">
                  {mapsLink ? (
                    <a
                      className="inline-flex items-center gap-1 text-left font-medium text-slate-700 hover:text-blue-800 md:justify-end md:text-right"
                      href={mapsLink}
                      rel="noreferrer"
                      target="_blank"
                    >
                      <MapPinMiniIcon />
                      <span>{practiceLabel}</span>
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

      {appointment ? (
        <section className="mt-6">
          <div className="flex items-start justify-between gap-3">
            <button
              aria-label="Open appointment"
              className={`min-w-0 text-sm leading-6 text-slate-700 ${openAreaButtonClass}`}
              onClick={onOpenAppointment}
              title="Open appointment"
              type="button"
            >
              {guidance?.summary ||
                "Generate a short prep view for your next appointment."}
            </button>
            <button
              aria-label={
                guidance
                  ? "Refresh appointment preparation"
                  : "Prepare for this visit"
              }
              className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-blue-700 transition hover:bg-blue-50 hover:text-blue-800 disabled:text-slate-400"
              disabled={isGenerating}
              onClick={onGenerateCarePrep}
              title={guidance ? "Refresh" : "Prepare"}
              type="button"
            >
              <RefreshCircleIcon />
            </button>
          </div>
          {guidance ? (
            <>
              {highlights.length > 0 ? (
                <div className="mt-7 grid gap-5 md:grid-cols-3">
                  {highlights.map((section) => (
                    <section key={section.label}>
                      <h4 className="font-semibold text-slate-900">
                        {section.label}
                      </h4>
                      <ul className="mt-2 space-y-1 text-sm text-slate-700">
                        {section.items.map((item, index) => (
                          <li key={`${section.label}-${index}`}>{item}</li>
                        ))}
                      </ul>
                    </section>
                  ))}
                </div>
              ) : null}
            </>
          ) : null}
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

          {appointment.provider_name || nextSubject ? (
            <div className="mt-5 flex flex-wrap items-center justify-between gap-x-4 gap-y-1 text-xs font-medium text-[#767676]">
              <span>{appointment.provider_name || ""}</span>
              {nextSubject ? <span>for {nextSubject}</span> : null}
            </div>
          ) : null}
        </section>
      ) : null}
    </section>
  );
}
