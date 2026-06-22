"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";

const setupItems = [
  "Mobile phone.",
  "Landline phone.",
  "Smart speakers.",
  "Smart camera with talkback.",
];

const heroPanel = {
  alt: "Comic panel of a caregiving superhero proudly presenting phones, cameras, speakers, boosters, and monitors for checking in on Mom.",
  height: 1188,
  src: "/connect/caregiving-hero.png",
  width: 1324,
};

const narrativePanels = [
  {
    actionLabel: "TV",
    alt: "Comic panel of Mom happily watching television while music, applause, and booming sound effects fill the room.",
    body: "Mom watches TV, perhaps louder than she did 20 years ago.",
    height: 1184,
    src: "/connect/mom-tv.png",
    width: 1328,
  },
  {
    actionLabel: "Signals",
    alt: "Comic close-up of an elaborate communication system showing active feeds, active connections, a depleted communicator, and a checklist ending with still can't get through.",
    body: "The phone is off the hook. The cell phone was unplugged and has a dead battery. The TV drowns out your voice calling out across the speaker or camera.",
    height: 1183,
    src: "/connect/system-active.png",
    width: 1330,
  },
  {
    actionLabel: "No Way Through",
    alt: "Comic reveal of Mom happily watching loud television while the caregiving hero appears in a small live-feed monitor trying to reach her.",
    body: "All efforts for naught. There's no way to reach Mom. Even if it's urgent.",
    height: 1189,
    src: "/connect/reveal.png",
    width: 1323,
  },
];

const receiverTypes = [
  "Smart speakers",
  "Smart displays",
  "Tablets",
  "Mobile phones",
  "Traditional phone calls",
  "Future CarePland receivers",
];

const trustPromises = [
  "No hidden listening.",
  "No recording by default.",
  "Every request is named, authorized, and logged.",
];

export function CarePlandConnectWebsite() {
  const [selectedNarrativePanelIndex, setSelectedNarrativePanelIndex] =
    useState(0);
  const selectedNarrativePanel =
    narrativePanels[selectedNarrativePanelIndex] ?? narrativePanels[0];

  return (
    <main className="min-h-screen bg-[#fbfaf6] text-[#182421]">
      <a
        className="fixed left-3 top-3 z-[100] -translate-y-24 rounded-md bg-[#182421] px-3 py-2 text-sm font-bold text-white transition focus:translate-y-0"
        href="#main-content"
      >
        Skip to main content
      </a>

      <header className="sticky top-0 z-50 grid min-h-[76px] grid-cols-[auto_1fr_auto] items-center gap-5 border-b border-[#d8e0dc]/85 bg-[#fbfaf6] px-5 py-3 md:px-[5vw]">
        <Link
          aria-label="CarePland home"
          className="flex items-center gap-2.5 font-bold"
          href="/"
        >
          <Image
            alt=""
            className="h-11 w-11 object-contain"
            height={44}
            priority
            src="/carepland-loop-mark.png"
            width={44}
          />
          <span>CarePland</span>
        </Link>
        <nav
          aria-label="CarePland Connect navigation"
          className="hidden justify-center gap-8 text-[0.95rem] text-[#596864] md:flex"
        >
          <a className="hover:text-[#256d85]" href="#origin">
            Origin
          </a>
          <a className="hover:text-[#256d85]" href="#how-it-works">
            How it works
          </a>
          <a className="hover:text-[#256d85]" href="#trust">
            Trust
          </a>
          <Link className="hover:text-[#256d85]" href="/connect/dashboard">
            Dashboard
          </Link>
        </nav>
        <a
          className="inline-flex min-h-11 items-center justify-center rounded-md bg-[#256d85] px-4 font-bold text-white"
          href="#early-access"
        >
          Follow Connect
        </a>
      </header>

      <div id="main-content">
        <section className="grid items-center gap-10 px-5 py-12 md:grid-cols-[minmax(420px,1.08fr)_minmax(0,0.92fr)] md:px-[5vw] md:py-16 lg:gap-20">
          <figure
            aria-label="CarePland Connect failed-contact scene"
            className="overflow-hidden rounded-lg border border-[#d8e0dc] bg-white shadow-[0_22px_60px_rgba(24,36,33,0.12)]"
          >
            <Image
              alt={heroPanel.alt}
              className="aspect-[1.115/1] w-full bg-[#f2f6f4] object-contain"
              height={heroPanel.height}
              priority
              src={heroPanel.src}
              width={heroPanel.width}
            />
            <figcaption className="grid gap-3 border-t border-[#d8e0dc] p-5">
              {setupItems.map((item) => (
                <div
                  className="min-h-12 rounded-md border border-[#d8e0dc] bg-[#fbfaf6] px-4 py-3"
                  key={item}
                >
                  <p className="m-0 font-semibold text-[#596864]">{item}</p>
                </div>
              ))}
            </figcaption>
          </figure>

          <div className="max-w-[900px]">
            <p className="mb-5 text-lg font-extrabold uppercase tracking-normal text-[#39735a]">
              CarePland Connect
            </p>
            <h1 className="max-w-[920px] text-[clamp(3.3rem,7vw,7.6rem)] font-black leading-[0.92] tracking-normal">
              Talk to Mom?
            </h1>
            <p className="mt-6 max-w-[720px] text-[clamp(1.55rem,3vw,2.55rem)] font-extrabold leading-[1.08] text-[#256d85]">
              You can do everything right and still not reach your loved one.
            </p>
            <p className="mt-6 max-w-[740px] text-xl font-semibold leading-relaxed text-[#596864]">
              You can set up all the things. All the tech. Failsafes,
              backups. And then you can look through the webcam at all those
              systems failing in real time. And Mom still can&apos;t hear you.
            </p>
          </div>
        </section>

        <section
          className="border-y border-[#d8e0dc]/90 bg-[#f7f5ef] px-5 py-16 md:px-[5vw] md:py-24"
          id="comic-sequence"
        >
          <div className="mb-8 max-w-[860px]">
            <h2 className="text-[clamp(2rem,4vw,4.2rem)] font-black leading-[1.02]">
              Have you ever been here?
            </h2>
            <p className="mt-5 text-xl font-semibold leading-relaxed text-[#596864]">
              Explore this narrative and see if it sounds familiar.
            </p>
          </div>

          <div className="grid gap-5">
            <div
              aria-label="Select a narrative panel"
              className="flex flex-wrap gap-2"
              role="tablist"
            >
              {narrativePanels.map((panel, index) => (
                <button
                  aria-controls="connect-narrative-panel"
                  aria-selected={selectedNarrativePanelIndex === index}
                  className={`min-h-11 rounded-md border px-4 font-bold transition ${
                    selectedNarrativePanelIndex === index
                      ? "border-[#256d85] bg-[#256d85] text-white"
                      : "border-[#bfd0ca] bg-white text-[#263a36] hover:border-[#256d85]"
                  }`}
                  id={`connect-narrative-tab-${index}`}
                  key={panel.actionLabel}
                  onClick={() => setSelectedNarrativePanelIndex(index)}
                  role="tab"
                  type="button"
                >
                  {panel.actionLabel}
                </button>
              ))}
            </div>

            <figure
              aria-labelledby={`connect-narrative-tab-${selectedNarrativePanelIndex}`}
              className="overflow-hidden rounded-lg border border-[#d8e0dc] bg-white shadow-[0_18px_44px_rgba(24,36,33,0.1)]"
              id="connect-narrative-panel"
              role="tabpanel"
            >
              <Image
                alt={selectedNarrativePanel.alt}
                className="aspect-[1.115/1] w-full bg-[#f2f6f4] object-contain"
                height={selectedNarrativePanel.height}
                src={selectedNarrativePanel.src}
                width={selectedNarrativePanel.width}
              />
              <figcaption className="border-t border-[#d8e0dc] p-5">
                <p className="max-w-[900px] text-lg font-semibold leading-relaxed text-[#596864]">
                  {selectedNarrativePanel.body}
                </p>
              </figcaption>
            </figure>
          </div>

          <div className="mt-8 max-w-[900px] rounded-lg bg-[#263a36] px-6 py-5 text-white">
            <p className="m-0 text-lg font-semibold leading-relaxed text-[#d8e0dc]">
              The problem is not that the technology failed. The problem is
              that communication failed despite the technology working.
            </p>
          </div>
        </section>

        <section
          className="border-y border-[#d8e0dc]/90 bg-[#f0ede5] px-5 py-16 md:px-[5vw] md:py-24"
          id="origin"
        >
          <div className="grid gap-10 lg:grid-cols-[minmax(0,0.92fr)_minmax(320px,0.68fr)] lg:gap-20">
            <div className="max-w-[850px]">
              <h2 className="text-[clamp(2rem,4vw,4.35rem)] font-black leading-[1.02]">
                We didn&apos;t set out to build a communication platform.
              </h2>
              <div className="mt-7 grid gap-5 text-xl font-semibold leading-relaxed text-[#596864]">
                <p>We were trying to reach our parents.</p>
                <p>
                  We had the mobile phone, the landline, the smart speaker, the
                  camera, and the backups. It all seemed reasonable. It all
                  should have worked.
                </p>
                <p>
                  That scene is not hypothetical. It is lived experience, and
                  it reveals a strange truth about caregiving technology: there
                  are more devices than ever, and still no reliable way to know
                  a conversation can actually begin.
                </p>
              </div>
            </div>
            <aside className="grid content-start gap-4 rounded-lg border border-[#d8e0dc] bg-white/75 p-5">
              <p className="text-sm font-extrabold uppercase tracking-normal text-[#39735a]">
                The actual job
              </p>
              <p className="text-2xl font-black leading-tight">
                Modern communication assumes the other person is participating.
              </p>
              <p className="text-[#596864]">
                They have to hear it, notice it, understand it, and respond to
                it. When any of those break down, communication becomes noise.
              </p>
            </aside>
          </div>
        </section>

        <section
          className="bg-[#fcfbf7] px-5 py-16 md:px-[5vw] md:py-24"
          id="how-it-works"
        >
          <div className="mb-8 max-w-[830px]">
            <h2 className="text-[clamp(2rem,4vw,4.2rem)] font-black leading-[1.02]">
              One trusted request. Many possible receivers.
            </h2>
            <p className="mt-5 text-lg text-[#596864]">
              CarePland Connect starts with the caregiver reality, then works
              backward toward contact. The receiver might be a smart display,
              tablet, speaker, phone bridge, or future dedicated device. The
              product is the trusted orchestration layer.
            </p>
          </div>

          <div className="grid gap-5 lg:grid-cols-3">
            {[
              [
                "Request",
                "A named caregiver starts a Connect Request for an approved loved one.",
                "#256d85",
              ],
              [
                "Reach",
                "CarePland tries approved receivers without assuming one device is nearby, charged, or heard.",
                "#b78b28",
              ],
              [
                "Connect",
                "The loved one accepts, and a live conversation begins.",
                "#39735a",
              ],
            ].map(([title, body, borderColor]) => (
              <article
                className="min-h-[250px] rounded-lg border border-[#d8e0dc] bg-white/70 p-6"
                key={title}
                style={{ borderTop: `5px solid ${borderColor}` }}
              >
                <h3 className="mb-3 text-xl font-bold">{title}</h3>
                <p className="text-[#596864]">{body}</p>
              </article>
            ))}
          </div>

          <div className="mt-10 grid gap-3 rounded-lg border border-[#d8e0dc] bg-[#edf3f0] p-5 md:grid-cols-3">
            {receiverTypes.map((receiver) => (
              <p
                className="m-0 rounded-md bg-white/70 px-4 py-3 font-bold text-[#263a36]"
                key={receiver}
              >
                {receiver}
              </p>
            ))}
          </div>
        </section>

        <section
          className="border-y border-[#d8e0dc] bg-[#182421] px-5 py-16 text-white md:px-[5vw] md:py-24"
          id="trust"
        >
          <div className="grid gap-10 lg:grid-cols-[minmax(0,0.9fr)_minmax(360px,1.1fr)] lg:gap-16">
            <div className="max-w-[760px]">
              <h2 className="text-[clamp(2rem,4vw,4.2rem)] font-black leading-[1.02]">
                Built for trust, not surveillance.
              </h2>
              <p className="mt-6 text-xl font-semibold leading-relaxed text-[#d8e0dc]">
                CarePland Connect is for initiating a conversation. It is not a
                hidden monitoring system, passive listening tool, or casual
                shortcut around consent.
              </p>
            </div>

            <div className="grid content-start gap-4">
              {trustPromises.map((promise) => (
                <div
                  className="rounded-lg border border-white/14 bg-white/[0.06] p-5"
                  key={promise}
                >
                  <p className="m-0 text-xl font-extrabold text-white">
                    {promise}
                  </p>
                </div>
              ))}
              <p className="text-sm leading-relaxed text-[#b8c7c2]">
                Every Connect Request should be attributable to a named
                caregiver, limited to authorized relationships, and visible in
                an audit trail.
              </p>
            </div>
          </div>
        </section>

        <section
          className="border-t border-[#d8e0dc] bg-[#edf3f0] px-5 py-16 md:px-[5vw] md:py-24"
          id="early-access"
        >
          <h2 className="max-w-[980px] text-[clamp(2rem,4vw,4.2rem)] font-black leading-[1.02]">
            CarePland Connect is part of the same care continuity mission.
          </h2>
          <p className="mt-5 max-w-[760px] text-xl font-semibold leading-relaxed text-[#39735a]">
            It extends CarePland beyond appointment readiness into the messy,
            ordinary moments when families need to reach each other.
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Link
              className="inline-flex min-h-12 items-center justify-center rounded-md bg-[#256d85] px-5 font-bold text-white"
              href="/#early-access"
            >
              Join Early Access
            </Link>
            <Link
              className="inline-flex min-h-12 items-center justify-center rounded-md border border-[#bfd0ca] bg-white px-5 font-bold text-[#263a36]"
              href="/connect/dashboard"
            >
              Open Dashboard
            </Link>
            <Link
              className="inline-flex min-h-12 items-center justify-center rounded-md border border-[#bfd0ca] bg-white px-5 font-bold text-[#263a36]"
              href="/"
            >
              Back to CarePland
            </Link>
          </div>
        </section>
      </div>

      <footer className="flex flex-wrap items-center justify-between gap-4 border-t border-[#d8e0dc] px-5 py-7 text-sm text-[#596864] md:px-[5vw]">
        <span className="text-xs font-semibold text-[#687672]">
          © 2026 CarePland.
        </span>
        <nav
          aria-label="Footer navigation"
          className="flex flex-wrap items-center gap-5"
        >
          <Link className="hover:text-[#256d85]" href="/">
            CarePland
          </Link>
          <a className="hover:text-[#256d85]" href="#trust">
            Trust
          </a>
          <a className="hover:text-[#256d85]" href="#early-access">
            Early Access
          </a>
        </nav>
      </footer>
    </main>
  );
}
