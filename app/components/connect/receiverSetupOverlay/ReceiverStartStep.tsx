import type { ReactNode } from "react";

import type { ReceiverSetupStepProps } from "./types";

export function ReceiverStartStep({
  installModeLock,
  setDraft,
}: Pick<ReceiverSetupStepProps, "setDraft"> & {
  installModeLock?: "android";
}) {
  const chooseAndroid = () =>
    setDraft((current) => ({
      ...current,
      installMode: "android",
      installViewed: true,
      section: "install",
    }));
  const chooseWeb = () =>
    setDraft((current) => ({
      ...current,
      installMode: "web",
      installViewed: true,
      section: "install",
    }));

  return (
    <section className="mx-auto grid w-full max-w-5xl gap-6 pt-10 pb-4">
      <div>
        <p className="mx-auto max-w-4xl text-center text-lg font-semibold leading-relaxed text-[#5f6e84] sm:text-xl">
          Receiver provides an uncluttered, straightforward experience for those who need
          simplicity.
        </p>
      </div>

      <div>
        <p className="text-center text-xl font-black text-[#172f49] sm:text-2xl">
          Choose how you&apos;d like to install Receiver
        </p>
        <div
          className={`mt-5 grid gap-4 ${
            installModeLock ? "mx-auto max-w-xl" : "lg:grid-cols-2"
          }`}
        >
          <SetupChoicePanel recommended>
            <SetupChoiceCard
              advantages={[
                "Always-on feel",
                "Feels like a kiosk or appliance",
                "Automatic restart*",
                "Better remote management",
              ]}
              bestFor={[
                "Dedicated devices",
              ]}
              footnote="* Automatic restart depends on hardware and configuration."
              icon="📱"
              title="Dedicated Android App"
            >
              Receiver runs as its own app.
            </SetupChoiceCard>
          </SetupChoicePanel>

          {!installModeLock ? (
            <SetupChoicePanel>
              <SetupChoiceCard
                advantages={[
                  "No installation required",
                  "Always up to date",
                  "Access from almost any device",
                ]}
                bestFor={[
                  "iPad/iOS devices",
                  "Windows and Mac computers",
                  "Chromebooks",
                  "Trying Receiver before installing",
                ]}
                icon="🌐"
                title="Web Browser"
              >
                Receiver runs in your web browser.
              </SetupChoiceCard>
            </SetupChoicePanel>
          ) : null}
          <SetupChoiceButton onChoose={chooseAndroid}>
            Start Android Setup
          </SetupChoiceButton>
          {!installModeLock ? (
            <SetupChoiceButton onChoose={chooseWeb}>
              Start Web Setup
            </SetupChoiceButton>
          ) : null}
        </div>
      </div>
    </section>
  );
}

function SetupChoicePanel({
  children,
  recommended = false,
}: {
  children: ReactNode;
  recommended?: boolean;
}) {
  return (
    <div className="grid gap-3 pt-1">
      {recommended ? (
        <span className="mx-auto block w-fit rounded-full bg-[#e5f7ee] px-3 py-1 text-sm font-black text-[#176342]">
          <span aria-hidden="true">★ </span>
          Recommended
        </span>
      ) : (
        <span className="h-7" aria-hidden="true" />
      )}
      {children}
    </div>
  );
}

function SetupChoiceCard({
  advantages,
  bestFor,
  children,
  footnote,
  icon,
  title,
}: {
  advantages: string[];
  bestFor: string[];
  children: string;
  footnote?: string;
  icon: string;
  title: string;
}) {
  return (
    <article className="grid h-full content-start gap-5 rounded-xl bg-[#f8fbff] p-5 sm:p-6">
      <div>
        <div className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-3">
          <span
            aria-hidden="true"
            className="grid h-12 w-12 place-items-center rounded-full bg-white text-2xl shadow-[inset_0_0_0_1px_#d6e3f2]"
          >
            {icon}
          </span>
          <div className="min-w-0">
            <h3 className="text-2xl font-black leading-tight text-[#172f49]">
              {title}
            </h3>
          </div>
        </div>
        <p className="mt-3 text-base font-semibold leading-relaxed text-[#5f6e84]">
          {children}
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <ChoiceList title="Best for" values={bestFor} />
        <ChoiceList title="Advantages" values={advantages} />
      </div>
      {footnote ? (
        <p className="-mt-2 text-xs italic leading-snug text-[#5f6e84]">
          {footnote}
        </p>
      ) : null}
    </article>
  );
}

function SetupChoiceButton({
  children,
  onChoose,
}: {
  children: string;
  onChoose: () => void;
}) {
  return (
    <div className="grid justify-items-center">
      <button
        className="min-h-14 w-full max-w-[300px] rounded-lg bg-[#2f6f9f] px-5 text-base font-black text-white hover:bg-[#285f89] focus:outline-none focus:ring-2 focus:ring-[#4e84b2]"
        onClick={onChoose}
        type="button"
      >
        {children}
      </button>
    </div>
  );
}

function ChoiceList({ title, values }: { title: string; values: string[] }) {
  return (
    <div>
      <p className="text-sm font-black uppercase tracking-normal text-[#5f6e84]">{title}</p>
      <ul className="mt-2 grid gap-1.5 text-sm font-bold leading-snug text-[#172f49]">
        {values.map((value) => (
          <li key={value}>{value}</li>
        ))}
      </ul>
    </div>
  );
}
