"use client";

import Image from "next/image";
import { FormEvent, useState } from "react";

const publicWebsiteSlides = [
  {
    alt: "Diagram showing a person in the gap between appointments, where notes, CarePrep, and context need to carry forward.",
    caption:
      "Important context is often lost over time. We all live in this gap.",
    src: "/welcome/panel1.png",
    title: "Important context is often lost over time.",
  },
  {
    alt: "Diagram showing CarePrep questions connected to appointment context so the next visit starts with what matters.",
    caption: "Context is what connects one visit to the next.",
    src: "/welcome/panel2.png",
    title: "Context is what connects one visit to the next.",
  },
  {
    alt: "Diagram showing Visit Notes moving into CarePland, creating CarePrep, and carrying context forward to future appointments.",
    caption:
      "Visit Notes help CarePland create CarePrep. Context carries forward into future visits.",
    src: "/welcome/panel3.jpg",
    title: "Visit Notes help CarePland create CarePrep.",
  },
];

function errorMessage(error: unknown) {
  return error instanceof Error
    ? error.message
    : "Early Access signup is temporarily unavailable.";
}

export function PublicWebsite({ onOpenApp }: { onOpenApp: () => void }) {
  const [selectedSlideIndex, setSelectedSlideIndex] = useState<number | null>(
    null
  );
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [earlyAccessEmail, setEarlyAccessEmail] = useState("");
  const [interestContext, setInterestContext] = useState("");
  const [communicationConsent, setCommunicationConsent] = useState(false);
  const [signupStatus, setSignupStatus] = useState<
    "error" | "idle" | "saving" | "success"
  >("idle");
  const [signupMessage, setSignupMessage] = useState("");
  const selectedSlide =
    selectedSlideIndex === null ? null : publicWebsiteSlides[selectedSlideIndex];

  async function handleEarlyAccessSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSignupStatus("saving");
    setSignupMessage("");

    try {
      const response = await fetch("/api/early-access", {
        body: JSON.stringify({
          communicationConsent,
          email: earlyAccessEmail,
          firstName,
          interestContext,
          lastName,
        }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      const result = (await response.json()) as { error?: string; ok?: boolean };

      if (!response.ok || result.error) {
        throw new Error(result.error || "Unable to save your request.");
      }

      setSignupStatus("success");
      setSignupMessage("Thanks. Your Early Access interest has been saved.");
      setFirstName("");
      setLastName("");
      setEarlyAccessEmail("");
      setInterestContext("");
      setCommunicationConsent(false);
    } catch (error) {
      setSignupStatus("error");
      setSignupMessage(errorMessage(error));
    }
  }

  return (
    <main className="min-h-screen bg-[#fbfaf6] text-[#182421]">
      <a
        className="fixed left-3 top-3 z-[100] -translate-y-24 rounded-md bg-[#182421] px-3 py-2 text-sm font-bold text-white transition focus:translate-y-0"
        href="#main-content"
      >
        Skip to main content
      </a>

      <header className="sticky top-0 z-50 grid min-h-[76px] grid-cols-[auto_1fr_auto] items-center gap-5 border-b border-[#d8e0dc]/85 bg-[#fbfaf6] px-5 py-3 md:px-[5vw]">
        <a
          aria-label="CarePland home"
          className="flex items-center gap-2.5 font-bold"
          href="#main-content"
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
        </a>
        <nav
          aria-label="Primary navigation"
          className="hidden justify-center gap-8 text-[0.95rem] text-[#596864] md:flex"
        >
          <a className="hover:text-[#256d85]" href="#continuity">
            The Gap
          </a>
          <a className="hover:text-[#256d85]" href="#continuity-panels">
            Continuity
          </a>
          <a className="hover:text-[#256d85]" href="#how-it-works">
            Complete the Loop
          </a>
        </nav>
        <div className="flex items-center justify-end gap-2">
          <button
            className="hidden min-h-11 rounded-md px-3 font-semibold text-[#596864] hover:text-[#256d85] sm:inline-flex sm:items-center"
            onClick={onOpenApp}
            type="button"
          >
            Sign in
          </button>
          <a
            className="inline-flex min-h-11 items-center justify-center rounded-md bg-[#256d85] px-4 font-bold text-white"
            href="#early-access"
          >
            Find out more
          </a>
        </div>
      </header>

      <div id="main-content">
        <section className="grid items-center gap-10 px-5 py-12 md:grid-cols-[minmax(0,1.02fr)_minmax(360px,0.78fr)] md:px-[5vw] md:py-16 lg:gap-20">
          <div className="max-w-[820px]">
            <h1 className="max-w-[880px] text-[clamp(3rem,6.8vw,6.8rem)] font-black leading-[0.94] tracking-normal">
              Complete the appointment loop.
            </h1>
            <p className="mt-6 max-w-[720px] text-[clamp(1.55rem,3vw,2.35rem)] font-extrabold leading-[1.08] text-[#39735a]">
              CarePland helps you and your loved ones bring the context that
              matters to your next visit.
            </p>
          </div>

          <div
            aria-label="CarePland appointment loop preview"
            className="overflow-hidden rounded-lg border border-[#d8e0dc] bg-white shadow-[0_22px_60px_rgba(24,36,33,0.12)]"
          >
            <div className="grid gap-1 border-b border-[#d8e0dc] bg-[#f2f6f4] p-5">
              <span className="text-xs font-extrabold uppercase tracking-[0.08em] text-[#596864]">
                Next appointment
              </span>
              <strong className="text-xl">Primary care follow-up</strong>
            </div>
            <div className="grid px-5 py-2">
              {["What changed?", "What feels unresolved?", "What do I ask?"].map(
                (question) => (
                  <div
                    className="grid min-h-16 grid-cols-[22px_1fr] items-center gap-3 border-b border-[#d8e0dc] last:border-b-0"
                    key={question}
                  >
                    <span
                      aria-hidden="true"
                      className="h-3 w-3 rounded-full bg-[#39735a] shadow-[0_0_0_5px_rgba(57,115,90,0.12)]"
                    />
                    <p className="m-0 text-[#596864]">{question}</p>
                  </div>
                )
              )}
            </div>
            <div className="m-5 rounded-lg bg-[#263a36] px-5 py-4 text-white">
              <h2 className="m-0 text-[clamp(1.2rem,2vw,1.55rem)] font-extrabold leading-tight">
                Arrive with an organized story.
              </h2>
            </div>
          </div>
        </section>

        <section
          className="bg-[#f7f5ef] px-5 py-16 md:px-[5vw] md:py-24"
          id="continuity"
        >
          <div className="mb-8 max-w-[760px]">
            <h2 className="mb-5 text-[clamp(2rem,4vw,4.2rem)] font-black leading-[1.02]">
              We all live in the gap between appointments.
            </h2>
            <p className="text-lg text-[#596864]">
              CarePland helps carry forward important context, helping you
              remember what changed, what mattered, and what comes next.
            </p>
          </div>
          <div className="max-w-[900px] overflow-hidden rounded-lg border border-[#d8e0dc] bg-[#182421] shadow-[0_22px_60px_rgba(24,36,33,0.12)]">
            <iframe
              allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture;"
              allowFullScreen
              className="block aspect-video w-full border-0"
              src="https://player.mux.com/Ypm2KjtOwCsiE6Kb6vexjyJFm7jpSI005jadJyOHW4VU?muted=true&playsinline=true&loop=false&controls=true&poster=https%3A%2F%2Fimage.mux.com%2FYpm2KjtOwCsiE6Kb6vexjyJFm7jpSI005jadJyOHW4VU%2Fthumbnail.png%3Fwidth%3D1280%26height%3D720%26time%3D0"
              title="CarePland orientation video about the gap between medical appointments"
            />
          </div>
        </section>

        <section
          className="border-y border-[#d8e0dc]/90 bg-[#f0ede5] px-5 py-16 md:px-[5vw] md:py-24"
          id="continuity-panels"
        >
          <div className="max-w-[1180px]">
            <div className="mb-8 grid gap-3 md:flex md:items-end md:justify-between">
              <div className="max-w-[760px]">
                <h2 className="mb-5 text-[clamp(2rem,4vw,4.2rem)] font-black leading-[1.02]">
                  Why continuity breaks down
                </h2>
                <p className="text-lg text-[#596864]">
                  Continuity, shown through just three slides.
                </p>
              </div>
              <p
                className="text-sm font-semibold text-[#69736f]"
                id="panel-hint"
              >
                Click slides to enlarge.
              </p>
            </div>
            <div
              aria-describedby="panel-hint"
              aria-label="CarePland continuity panels"
              className="grid gap-6 lg:grid-cols-3"
            >
              {publicWebsiteSlides.map((slide, index) => (
                <figure
                  className="grid gap-4 rounded-lg border border-[#d8e0dc] bg-white/70 p-3 pb-5 transition hover:scale-[1.03] hover:shadow-[0_22px_48px_rgba(24,36,33,0.16)] focus-within:scale-[1.03] focus-within:shadow-[0_22px_48px_rgba(24,36,33,0.16)]"
                  key={slide.src}
                >
                  <button
                    aria-label={`Enlarge slide ${index + 1}: ${slide.title}`}
                    className="rounded-md bg-transparent focus:outline-none focus:ring-4 focus:ring-[#256d85]/45"
                    onClick={() => setSelectedSlideIndex(index)}
                    type="button"
                  >
                    <Image
                      alt={slide.alt}
                      className="aspect-[1.48/1] w-full rounded-md bg-[#fbfaf6] object-contain"
                      height={520}
                      src={slide.src}
                      width={770}
                    />
                  </button>
                  <figcaption className="grid gap-1 px-1 text-[0.98rem] leading-relaxed text-[#596864]">
                    <strong className="text-[#182421]">{slide.title}</strong>
                    {index === 0 ? <span>We all live in this gap.</span> : null}
                    {index === 2 ? (
                      <span>Context carries forward into future visits.</span>
                    ) : null}
                  </figcaption>
                </figure>
              ))}
            </div>
          </div>
        </section>

        <section
          className="grid gap-10 border-y border-[#d8e0dc] bg-[#fcfbf7] px-5 py-16 md:grid-cols-[minmax(0,1fr)_minmax(280px,0.6fr)] md:px-[5vw] md:py-24 lg:gap-20"
          id="approach"
        >
          <div>
            <h2 className="text-[clamp(2rem,4vw,4.2rem)] font-black leading-[1.02]">
              Healthcare asks patients to be active participants, then gives
              them tools built around everyone else.
            </h2>
          </div>
          <div className="grid content-start gap-5 text-lg text-[#596864]">
            <p>
              Everyone else in the appointment loop — from schedulers to
              clinicians — has tools designed to organize and carry forward
              context.
            </p>
            <p>
              When patients are given tools, they are usually extensions of
              systems built for providers.
            </p>
          </div>
          <p className="mx-auto mt-2 max-w-[820px] text-center text-[clamp(1.55rem,2.6vw,2.65rem)] font-extrabold leading-tight text-[#39735a] md:col-span-2">
            CarePland is built for you.
          </p>
        </section>

        <section
          className="bg-[#f5f8f5] px-5 py-16 md:px-[5vw] md:py-24"
          id="how-it-works"
        >
          <div className="mb-8 max-w-[760px]">
            <h2 className="text-[clamp(2rem,4vw,4.2rem)] font-black leading-[1.02]">
              Using care history
              <br />
              for appointment readiness.
            </h2>
          </div>
          <div className="grid gap-5 lg:grid-cols-3">
            {[
              [
                "Gather the past",
                "Bring together previous visits, notes, medication changes, symptoms, questions, and care history.",
                "#256d85",
              ],
              [
                "Understand the present",
                "What has changed, what feels unclear, and what do I bring to my next visit.",
                "#b78b28",
              ],
              [
                "Prepare for what is next",
                "Create guidance for the next visit so you are prepared.",
                "#39735a",
              ],
            ].map(([title, body, borderColor]) => (
              <article
                className="min-h-[260px] rounded-lg border border-[#d8e0dc] bg-white/70 p-6"
                key={title}
                style={{ borderTop: `5px solid ${borderColor}` }}
              >
                <h3 className="mb-3 text-xl font-bold">{title}</h3>
                <p className="text-[#596864]">{body}</p>
              </article>
            ))}
          </div>
        </section>

        <section
          className="border-t border-[#d8e0dc] bg-[#edf3f0] px-5 py-16 md:px-[5vw] md:py-24"
          id="early-access"
        >
          <h2 className="max-w-[980px] text-[clamp(2rem,4vw,4.2rem)] font-black leading-[1.02]">
            Give your next appointment the context you&apos;ve always needed.
          </h2>
          <p className="mt-5 max-w-[760px] text-xl font-semibold leading-relaxed text-[#39735a]">
            <button
              className="font-extrabold text-[#256d85] underline decoration-[#256d85]/35 underline-offset-4 hover:text-[#182421]"
              onClick={onOpenApp}
              type="button"
            >
              Try CarePland today
            </button>
            , or use this form to stay connected.
          </p>
          <form
            className="mt-6 grid max-w-[760px] gap-4 rounded-lg border border-[#d8e0dc] bg-white p-6"
            onSubmit={handleEarlyAccessSubmit}
          >
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="sr-only" htmlFor="marketing-first-name">
                First name
              </label>
              <input
                autoComplete="given-name"
                className="min-h-12 rounded-lg border border-[#d8e0dc] bg-[#fbfaf6] px-3 text-[#182421]"
                id="marketing-first-name"
                onChange={(event) => setFirstName(event.target.value)}
                placeholder="First name"
                required
                value={firstName}
              />
              <label className="sr-only" htmlFor="marketing-last-name">
                Last name
              </label>
              <input
                autoComplete="family-name"
                className="min-h-12 rounded-lg border border-[#d8e0dc] bg-[#fbfaf6] px-3 text-[#182421]"
                id="marketing-last-name"
                onChange={(event) => setLastName(event.target.value)}
                placeholder="Last name"
                required
                value={lastName}
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
              <label className="sr-only" htmlFor="marketing-email">
                Email address
              </label>
              <input
                autoComplete="email"
                className="min-h-12 rounded-lg border border-[#d8e0dc] bg-[#fbfaf6] px-3 text-[#182421]"
                id="marketing-email"
                onChange={(event) => setEarlyAccessEmail(event.target.value)}
                placeholder="Email address"
                required
                type="email"
                value={earlyAccessEmail}
              />
              <button
                className="inline-flex min-h-12 items-center justify-center rounded-lg bg-[#256d85] px-5 font-bold text-white disabled:bg-slate-400"
                disabled={signupStatus === "saving"}
                type="submit"
              >
                {signupStatus === "saving" ? "Saving..." : "Stay in the Loop"}
              </button>
            </div>
            <label className="sr-only" htmlFor="marketing-interest-context">
              What interests you about CarePland?
            </label>
            <textarea
              className="min-h-24 rounded-lg border border-[#d8e0dc] bg-[#fbfaf6] px-3 py-3 text-[#182421]"
              id="marketing-interest-context"
              onChange={(event) => setInterestContext(event.target.value)}
              placeholder="Optional: What interests you about CarePland?"
              value={interestContext}
            />
            <label className="flex gap-3 text-sm text-[#596864]">
              <input
                checked={communicationConsent}
                className="mt-1 h-4 w-4"
                onChange={(event) =>
                  setCommunicationConsent(event.target.checked)
                }
                required
                type="checkbox"
              />
              <span>
                CarePland may contact me about Early Access using the email I
                provided.
              </span>
            </label>
            {signupMessage ? (
              <p
                className={`rounded-md px-3 py-2 text-sm font-semibold ${
                  signupStatus === "success"
                    ? "bg-emerald-50 text-emerald-800"
                    : "bg-amber-50 text-amber-900"
                }`}
              >
                {signupMessage}
              </p>
            ) : null}
          </form>
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
          <a className="hover:text-[#256d85]" href="#early-access">
            Early Access
          </a>
          <button
            className="font-semibold hover:text-[#256d85]"
            onClick={onOpenApp}
            type="button"
          >
            Sign in
          </button>
        </nav>
      </footer>

      {selectedSlide ? (
        <div
          aria-label="CarePland continuity slide viewer"
          aria-modal="true"
          className="fixed inset-0 z-[80] flex items-center justify-center p-4"
          role="dialog"
        >
          <button
            aria-label="Close slide viewer"
            className="absolute inset-0 bg-[#182421]/75"
            onClick={() => setSelectedSlideIndex(null)}
            type="button"
          />
          <div className="relative z-10 w-full max-w-5xl rounded-lg bg-[#fbfaf6] p-4 shadow-2xl md:p-6">
            <button
              aria-label="Close slide viewer"
              className="absolute right-3 top-3 z-10 flex h-11 w-11 items-center justify-center rounded-full bg-white/90 text-3xl leading-none text-[#182421] shadow"
              onClick={() => setSelectedSlideIndex(null)}
              type="button"
            >
              ×
            </button>
            <figure>
              <Image
                alt={selectedSlide.alt}
                className="max-h-[70vh] w-full rounded-md bg-white object-contain"
                height={720}
                src={selectedSlide.src}
                width={1040}
              />
              <figcaption className="mt-4 text-center text-[#596864]">
                {selectedSlide.caption}
              </figcaption>
            </figure>
            <div className="mt-4 flex justify-center gap-3">
              <button
                className="rounded-md border border-[#d8e0dc] bg-white px-4 py-2 font-semibold text-[#182421] disabled:opacity-30"
                disabled={selectedSlideIndex === 0}
                onClick={() =>
                  setSelectedSlideIndex((currentIndex) =>
                    currentIndex === null ? 0 : Math.max(0, currentIndex - 1)
                  )
                }
                type="button"
              >
                Previous
              </button>
              <button
                className="rounded-md border border-[#d8e0dc] bg-white px-4 py-2 font-semibold text-[#182421] disabled:opacity-30"
                disabled={selectedSlideIndex === publicWebsiteSlides.length - 1}
                onClick={() =>
                  setSelectedSlideIndex((currentIndex) =>
                    currentIndex === null
                      ? 0
                      : Math.min(
                          publicWebsiteSlides.length - 1,
                          currentIndex + 1
                        )
                  )
                }
                type="button"
              >
                Next
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}
