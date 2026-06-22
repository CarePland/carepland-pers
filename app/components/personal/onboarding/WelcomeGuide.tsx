import Image from "next/image";

export type WelcomeExistingAppointmentsVariant = "firstActions" | "returnHome";

type WelcomeActionsMode = "firstActions" | "returnHome";

type WelcomePanel = {
  alt: string;
  body: string;
  emphasis?: string;
  src: string;
};

const welcomePanels: WelcomePanel[] = [
  {
    alt: "Appointment notes feeding CarePrep and context",
    body: "Important context is often lost over time.",
    emphasis: "We all live in this gap.",
    src: "/welcome/panel1.png",
  },
  {
    alt: "CarePrep questions and missed appointment context",
    body: "Context is what connects one visit to the next.",
    src: "/welcome/panel2.png",
  },
  {
    alt: "CarePrep created from appointment notes",
    body:
      "Visit Notes help CarePland create CarePrep and carry forward context into future visits.",
    src: "/welcome/panel3.jpg",
  },
];

export const welcomeGuidePanelCount = welcomePanels.length;

type WelcomeGuideProps = {
  actionsMode: WelcomeActionsMode;
  gentlePrimaryButtonClass: string;
  gentleSecondaryButtonClass: string;
  hasExistingWelcomeAppointments: boolean;
  isAdmin: boolean;
  onAddExamples: () => void;
  onAddFirstAppointment: () => void;
  onChangeExistingAppointmentsVariant: (
    variant: WelcomeExistingAppointmentsVariant
  ) => void;
  onImportAppointments: () => void;
  onNeedHelp: () => void;
  onNextPanel: () => void;
  onPreviousPanel: () => void;
  onReturnHome: () => void;
  panelIndex: number;
  sampleDataSeededAt: string | null;
  seedingSampleData: boolean;
  welcomeExistingAppointmentsVariant: WelcomeExistingAppointmentsVariant;
};

export function WelcomeGuide({
  actionsMode,
  gentlePrimaryButtonClass,
  gentleSecondaryButtonClass,
  hasExistingWelcomeAppointments,
  isAdmin,
  onAddExamples,
  onAddFirstAppointment,
  onChangeExistingAppointmentsVariant,
  onImportAppointments,
  onNeedHelp,
  onNextPanel,
  onPreviousPanel,
  onReturnHome,
  panelIndex,
  sampleDataSeededAt,
  seedingSampleData,
  welcomeExistingAppointmentsVariant,
}: WelcomeGuideProps) {
  const panel = welcomePanels[panelIndex] ?? welcomePanels[0];
  const isFirstPanel = panelIndex === 0;
  const isLastPanel = panelIndex === welcomePanels.length - 1;

  return (
    <section className="py-6">
      <div className="mx-auto mt-5 w-full max-w-[720px] overflow-hidden rounded-lg border-4 border-black bg-black shadow-sm">
        <iframe
          allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture;"
          allowFullScreen
          className="aspect-video w-full border-0"
          src="https://player.mux.com/Ypm2KjtOwCsiE6Kb6vexjyJFm7jpSI005jadJyOHW4VU?autoplay=muted&muted=true&playsinline=true&loop=false&controls=false&poster=https%3A%2F%2Fimage.mux.com%2FYpm2KjtOwCsiE6Kb6vexjyJFm7jpSI005jadJyOHW4VU%2Fthumbnail.png%3Fwidth%3D214%26height%3D121%26time%3D0"
          title="CarePland - The Gap"
        />
      </div>

      <p className="mx-auto mt-5 max-w-2xl text-center text-lg leading-8 text-slate-700">
        CarePland helps carry forward important context between appointments,
        helping you remember what changed, what mattered, and what comes next.
      </p>

      <div className="mx-auto mt-8 max-w-4xl">
        <h2 className="mb-4 text-center text-xl font-semibold text-[#2B6198]">
          Continuity, shown through just three slides
        </h2>
        <article className="text-center">
          <div className="relative aspect-[3/2] w-full overflow-hidden rounded-xl">
            <Image
              alt={panel.alt}
              className="object-contain"
              fill
              sizes="(min-width: 768px) 672px, 100vw"
              src={panel.src}
            />
            <button
              aria-label="Previous welcome panel"
              className={`absolute left-2 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/25 text-4xl font-light leading-none text-[#2B6198]/60 hover:bg-white/40 hover:text-[#2B6198]/80 ${
                isFirstPanel ? "opacity-25" : ""
              }`}
              disabled={isFirstPanel}
              onClick={onPreviousPanel}
              type="button"
            >
              ‹
            </button>
            <button
              aria-label="Next welcome panel"
              className={`absolute right-2 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/25 text-4xl font-light leading-none text-[#2B6198]/60 hover:bg-white/40 hover:text-[#2B6198]/80 ${
                isLastPanel ? "opacity-25" : ""
              }`}
              disabled={isLastPanel}
              onClick={onNextPanel}
              type="button"
            >
              ›
            </button>
          </div>
          <div className="mx-auto mt-4 flex min-h-28 max-w-4xl flex-col items-center justify-start sm:min-h-24">
            <p className="text-lg leading-8 text-slate-700">{panel.body}</p>
            {panel.emphasis ? (
              <p className="mt-1 text-xl font-semibold text-[#2B6198]">
                {panel.emphasis}
              </p>
            ) : null}
          </div>
        </article>
      </div>

      <div className="mx-auto mt-1 h-0.5 w-40 max-w-[48%] rounded-full bg-blue-200 sm:w-52" />

      {actionsMode === "firstActions" ? (
        <p className="mt-7 text-center text-xl font-semibold text-[#2B6198]">
          Let&apos;s start building your context
        </p>
      ) : null}

      <div
        className={`relative mx-auto flex max-w-4xl flex-wrap items-center justify-center gap-3 md:min-h-12 ${
          actionsMode === "firstActions" ? "mt-4" : "mt-7"
        }`}
      >
        {actionsMode === "returnHome" ? (
          <button
            className={`${gentlePrimaryButtonClass} px-5 py-2.5 text-sm`}
            onClick={onReturnHome}
            type="button"
          >
            Return home
          </button>
        ) : (
          <>
            <div className="flex flex-wrap items-center justify-center gap-3">
              <button
                className={`${gentlePrimaryButtonClass} px-5 py-2.5 text-sm`}
                onClick={onAddFirstAppointment}
                type="button"
              >
                Add your first appointment
              </button>
              <button
                className={`${gentleSecondaryButtonClass} px-5 py-2.5 text-sm text-[#2B6198]`}
                onClick={onImportAppointments}
                type="button"
              >
                Import appointments
              </button>
            </div>
            {sampleDataSeededAt ? (
              <button
                className="text-sm font-semibold text-[#2B6198] underline decoration-blue-200 underline-offset-4 transition hover:text-blue-800 hover:decoration-blue-400 md:absolute md:right-0 md:top-1/2 md:-translate-y-1/2"
                onClick={onNeedHelp}
                type="button"
              >
                Need help?
              </button>
            ) : null}
          </>
        )}
      </div>

      {actionsMode === "firstActions" && !sampleDataSeededAt ? (
        <div className="relative mx-auto mt-3 flex max-w-4xl flex-wrap items-center justify-center gap-x-5 gap-y-2 text-sm text-slate-600 md:min-h-11">
          <div className="flex flex-wrap items-center justify-center gap-2">
            <span>Not sure?</span>
            <button
              className="rounded-full border border-blue-100 bg-white/60 px-3.5 py-1.5 text-sm font-medium text-slate-500 shadow-sm transition hover:bg-blue-50 hover:text-[#2B6198] disabled:text-slate-400"
              disabled={seedingSampleData}
              onClick={onAddExamples}
              type="button"
            >
              {seedingSampleData
                ? "Adding..."
                : "We'll add examples for you to explore"}
            </button>
          </div>
          <button
            className="text-sm font-semibold text-[#2B6198] underline decoration-blue-200 underline-offset-4 transition hover:text-blue-800 hover:decoration-blue-400 md:absolute md:right-0 md:top-1/2 md:-translate-y-1/2"
            onClick={onNeedHelp}
            type="button"
          >
            Need help?
          </button>
        </div>
      ) : null}

      {isAdmin && hasExistingWelcomeAppointments ? (
        <div className="mx-auto mt-5 flex max-w-4xl justify-start">
          <div className="flex items-center rounded-full border border-slate-200 bg-white/70 p-0.5 text-[11px] font-semibold text-slate-400 shadow-sm">
            <button
              aria-pressed={welcomeExistingAppointmentsVariant === "firstActions"}
              className={`rounded-full px-2.5 py-1 transition ${
                welcomeExistingAppointmentsVariant === "firstActions"
                  ? "bg-blue-50 text-blue-800"
                  : "hover:text-blue-700"
              }`}
              onClick={() => onChangeExistingAppointmentsVariant("firstActions")}
              type="button"
            >
              First time
            </button>
            <button
              aria-pressed={welcomeExistingAppointmentsVariant === "returnHome"}
              className={`rounded-full px-2.5 py-1 transition ${
                welcomeExistingAppointmentsVariant === "returnHome"
                  ? "bg-blue-50 text-blue-800"
                  : "hover:text-blue-700"
              }`}
              onClick={() => onChangeExistingAppointmentsVariant("returnHome")}
              type="button"
            >
              Returning users
            </button>
          </div>
        </div>
      ) : null}
    </section>
  );
}
