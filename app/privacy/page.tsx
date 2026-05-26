import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy Policy | CarePland",
  description:
    "CarePland privacy policy for Early Access users and public website visitors.",
};

export default function PrivacyPolicyPage() {
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
          Privacy Policy
        </h1>
        <p className="mt-3 text-sm text-slate-500">
          Effective date: May 26, 2026
        </p>

        <div className="mt-8 space-y-7 text-base leading-7 text-slate-700">
          <section>
            <h2 className="text-xl font-semibold text-slate-950">
              CarePland in Early Access
            </h2>
            <p className="mt-3">
              CarePland helps people organize appointment details, visit notes,
              and preparation context. During Early Access, the product is still
              developing, and this policy explains the basic privacy practices
              for the website and app.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-950">
              Information We Collect
            </h2>
            <p className="mt-3">
              CarePland may collect account details such as name, email, phone,
              ZIP code, and time zone; appointment details users enter or
              import; visit notes and CarePrep context; support questions; Early
              Access intake information; and basic technical information needed
              to operate, secure, and improve the service.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-950">
              How We Use Information
            </h2>
            <p className="mt-3">
              CarePland uses information to provide appointment memory and
              preparation features, support account setup, respond to support
              requests, improve reliability and product quality, monitor usage
              and operational costs, and maintain security and audit trails.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-950">
              AI-Assisted Features
            </h2>
            <p className="mt-3">
              Some CarePland features use AI services to interpret notes,
              extract appointment details, generate CarePrep, or help route
              support questions. CarePland sends only the context needed for the
              relevant workflow and keeps AI use focused on helping users
              organize and prepare. CarePland is not a medical advice service.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-950">
              Admin Access and Data Dignity
            </h2>
            <p className="mt-3">
              CarePland treats user data as borrowed context. Admin views are
              designed to limit sensitive visibility by default where practical.
              Certain sensitive access or contact-detail changes may require a
              reason and may be recorded in an audit trail.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-950">
              Service Providers
            </h2>
            <p className="mt-3">
              CarePland may use service providers for hosting, authentication,
              database storage, AI workflows, email delivery, maps or address
              lookup, analytics, security, and operational support. These
              providers help run the service and are not intended to use
              CarePland data for their own unrelated purposes.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-950">
              Your Choices
            </h2>
            <p className="mt-3">
              Users can update account profile details in the app. Early Access
              participants may contact CarePland to ask questions about their
              account, request corrections, or discuss deletion of account data
              where applicable.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-950">
              Contact
            </h2>
            <p className="mt-3">
              Questions about this policy can be sent through CarePland support
              or by contacting CarePland through the public website.
            </p>
          </section>
        </div>
      </article>
    </main>
  );
}
