export default function Home() {
  return (
    <main className="min-h-screen bg-slate-50 px-6 py-10 text-slate-900">
      <section className="mx-auto max-w-3xl">
        <p className="text-sm font-semibold uppercase tracking-wide text-blue-700">
          CarePland Personal
        </p>

        <h1 className="mt-3 text-4xl font-bold">
          Appointment memory, rebuilt cleanly.
        </h1>

        <p className="mt-4 text-lg text-slate-700">
          This is the first CarePland rebuild shell. Next step: connect
          Supabase and show appointments from the new data model.
        </p>

        <div className="mt-8 rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-xl font-semibold">Current milestone</h2>
          <ul className="mt-3 list-disc space-y-2 pl-6 text-slate-700">
            <li>Next.js app created</li>
            <li>GitHub connected</li>
            <li>Vercel deployed</li>
            <li>Supabase environment variables added</li>
          </ul>
        </div>
      </section>
    </main>
  );
}
