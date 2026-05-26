import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Terms of Service | CarePland",
  description:
    "CarePland terms of service for Early Access users and public website visitors.",
};

export default function TermsOfServicePage() {
  return (
    <main className="min-h-screen bg-slate-50 px-5 py-10 text-slate-800">
      <article className="mx-auto max-w-3xl rounded-lg border border-slate-200 bg-white p-6 shadow-sm md:p-10">
        <Link
          className="text-sm font-semibold text-blue-700 hover:text-blue-800"
          href="/"
        >
          CarePland
        </Link>
        <h1 className="mt-6 text-3xl font-semibold tracking-tight text-slate-950">
          Terms of Service
        </h1>
        <p className="mt-3 text-sm text-slate-500">
          Effective date: May 26, 2026
        </p>

        <div className="mt-8 space-y-7 text-base leading-7 text-slate-700">
          <section>
            <h2 className="text-xl font-semibold text-slate-950">
              Early Access Service
            </h2>
            <p className="mt-3">
              CarePland is an Early Access appointment memory and preparation
              service. Features may change as the product develops, and access
              may be updated, limited, paused, or discontinued as needed during
              this stage.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-950">
              Not Medical Advice
            </h2>
            <p className="mt-3">
              CarePland helps users organize appointment information and prepare
              for visits. It does not provide medical advice, diagnosis, or
              treatment. Users should consult qualified healthcare professionals
              for medical decisions and urgent concerns.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-950">
              User Responsibilities
            </h2>
            <p className="mt-3">
              Users are responsible for the information they enter, import, or
              upload; for keeping account access secure; and for using CarePland
              lawfully and respectfully. Users should not submit information
              they do not have permission to store or use.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-950">
              Account and Access
            </h2>
            <p className="mt-3">
              CarePland may require account setup, profile information, and
              Early Access acknowledgements before the app can be used. Access
              may be removed or restricted if an account is misused, creates
              operational risk, or violates these terms.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-950">
              AI-Assisted Features
            </h2>
            <p className="mt-3">
              Some workflows use AI-assisted interpretation or generation.
              AI-assisted outputs may be incomplete or incorrect and should be
              reviewed by the user. CarePland is designed to support memory and
              preparation, not to replace user judgment or clinician guidance.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-950">
              Availability and Changes
            </h2>
            <p className="mt-3">
              CarePland may change features, pricing, plans, limits, workflows,
              or availability over time. During Early Access, some services may
              be experimental, manually supported, or unavailable while the
              product is improved.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-950">
              Privacy
            </h2>
            <p className="mt-3">
              Use of CarePland is also governed by the CarePland Privacy Policy,
              which explains the basic handling of account, appointment, support,
              and operational information.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-950">
              Contact
            </h2>
            <p className="mt-3">
              Questions about these terms can be sent through CarePland support
              or by contacting CarePland through the public website.
            </p>
          </section>
        </div>
      </article>
    </main>
  );
}
