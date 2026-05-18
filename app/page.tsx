"use client";

import { createClient } from "@supabase/supabase-js";
import { FormEvent, useMemo, useState } from "react";

type Appointment = {
  id: string;
  title: string | null;
  reason: string | null;
  starts_at: string | null;
  status: string;
};

type AppointmentNote = {
  id: string;
  appointment_id: string;
  summary_short: string | null;
  takeaways: unknown;
  followups: unknown;
};

type CarePrepGuidance = {
  id: string;
  appointment_id: string;
  summary: string | null;
  key_questions: unknown;
  bring_list: unknown;
  watchouts: unknown;
};

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

const supabase = createClient(supabaseUrl, supabaseAnonKey);

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  if (error && typeof error === "object") {
    const possibleMessage = "message" in error ? String(error.message) : "";
    const possibleCode = "code" in error ? String(error.code) : "";

    if (possibleMessage || possibleCode) {
      return [possibleCode, possibleMessage].filter(Boolean).join(": ");
    }

    return JSON.stringify(error);
  }

  return String(error || "Something went wrong.");
}

function asTextList(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => {
      if (typeof item === "string") {
        return item;
      }

      if (item && typeof item === "object" && "text" in item) {
        return String(item.text);
      }

      return "";
    })
    .filter(Boolean);
}

function formatDate(value: string | null): string {
  if (!value) {
    return "Date not set";
  }

  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export default function Home() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [notes, setNotes] = useState<AppointmentNote[]>([]);
  const [guidance, setGuidance] = useState<CarePrepGuidance[]>([]);

  const notesByAppointment = useMemo(() => {
    return new Map(notes.map((note) => [note.appointment_id, note]));
  }, [notes]);

  const guidanceByAppointment = useMemo(() => {
    return new Map(guidance.map((item) => [item.appointment_id, item]));
  }, [guidance]);

  async function loadAppointments() {
    const { data: memberships, error: membershipsError } = await supabase
      .from("care_circle_memberships")
      .select("care_circle_id");

    if (membershipsError) {
      throw membershipsError;
    }

    const circleIds = memberships?.map((row) => row.care_circle_id) ?? [];

    if (circleIds.length === 0) {
      setAppointments([]);
      setNotes([]);
      setGuidance([]);
      setMessage("Signed in, but no care circle membership was found.");
      return;
    }

    const { data: appointmentRows, error: appointmentsError } = await supabase
      .from("appointments")
      .select("id,title,reason,starts_at,status")
      .in("care_circle_id", circleIds)
      .order("starts_at", { ascending: true });

    if (appointmentsError) {
      throw appointmentsError;
    }

    const appointmentIds = appointmentRows?.map((item) => item.id) ?? [];
    setAppointments(appointmentRows ?? []);

    if (appointmentIds.length === 0) {
      setNotes([]);
      setGuidance([]);
      setMessage("Signed in. No appointments found yet.");
      return;
    }

    const [{ data: noteRows, error: notesError }, { data: guidanceRows, error: guidanceError }] =
      await Promise.all([
        supabase
          .from("appointment_notes")
          .select("id,appointment_id,summary_short,takeaways,followups")
          .in("appointment_id", appointmentIds),
        supabase
          .from("careprep_guidance")
          .select("id,appointment_id,summary,key_questions,bring_list,watchouts")
          .in("appointment_id", appointmentIds),
      ]);

    if (notesError) {
      throw notesError;
    }

    if (guidanceError) {
      throw guidanceError;
    }

    setNotes(noteRows ?? []);
    setGuidance(guidanceRows ?? []);
    setMessage(`Loaded ${appointmentRows?.length ?? 0} appointment(s).`);
  }

  async function handleSignIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setMessage("");

    try {
      if (!supabaseUrl || !supabaseAnonKey) {
        throw new Error(
          "Missing Supabase environment variables. Check NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in Vercel."
        );
      }

      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        throw error;
      }

      await loadAppointments();
    } catch (error) {
      setMessage(getErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-50 px-6 py-10 text-slate-900">
      <section className="mx-auto max-w-4xl">
        <p className="text-sm font-semibold uppercase tracking-wide text-blue-700">
          CarePland Personal
        </p>

        <h1 className="mt-3 text-4xl font-bold">
          Appointment memory, now reading from Supabase.
        </h1>

        <p className="mt-4 text-lg text-slate-700">
          Sign in with your test user to load appointments, notes, and CarePrep
          from the clean rebuild schema.
        </p>

        <div className="mt-8 grid gap-6 lg:grid-cols-[320px_1fr]">
          <form
            onSubmit={handleSignIn}
            className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm"
          >
            <h2 className="text-xl font-semibold">Test sign in</h2>
            <label className="mt-5 block text-sm font-medium text-slate-700">
              Email
              <input
                className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2 text-base"
                onChange={(event) => setEmail(event.target.value)}
                type="email"
                value={email}
              />
            </label>
            <label className="mt-4 block text-sm font-medium text-slate-700">
              Password
              <input
                className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2 text-base"
                onChange={(event) => setPassword(event.target.value)}
                type="password"
                value={password}
              />
            </label>
            <button
              className="mt-5 w-full rounded-md bg-blue-700 px-4 py-2 font-semibold text-white disabled:bg-slate-400"
              disabled={loading}
              type="submit"
            >
              {loading ? "Loading..." : "Load appointments"}
            </button>

            {message ? (
              <p className="mt-4 rounded-md bg-slate-100 p-3 text-sm text-slate-700">
                {message}
              </p>
            ) : null}
          </form>

          <div className="space-y-4">
            {appointments.length === 0 ? (
              <div className="rounded-lg border border-dashed border-slate-300 bg-white p-6 text-slate-600">
                No appointments loaded yet.
              </div>
            ) : (
              appointments.map((appointment) => {
                const note = notesByAppointment.get(appointment.id);
                const prep = guidanceByAppointment.get(appointment.id);
                const takeaways = asTextList(note?.takeaways);
                const questions = asTextList(prep?.key_questions);

                return (
                  <article
                    className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm"
                    key={appointment.id}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <h2 className="text-2xl font-semibold">
                          {appointment.title || "Untitled appointment"}
                        </h2>
                        <p className="mt-1 text-slate-600">
                          {formatDate(appointment.starts_at)}
                        </p>
                      </div>
                      <span className="rounded-full bg-blue-50 px-3 py-1 text-sm font-medium text-blue-700">
                        {appointment.status}
                      </span>
                    </div>

                    {appointment.reason ? (
                      <p className="mt-4 text-slate-700">{appointment.reason}</p>
                    ) : null}

                    {note?.summary_short ? (
                      <section className="mt-5">
                        <h3 className="font-semibold text-blue-800">Visit summary</h3>
                        <p className="mt-1 text-slate-700">{note.summary_short}</p>
                      </section>
                    ) : null}

                    {takeaways.length > 0 ? (
                      <section className="mt-5">
                        <h3 className="font-semibold text-blue-800">Takeaways</h3>
                        <ol className="mt-2 list-decimal space-y-1 pl-5 text-slate-700">
                          {takeaways.map((takeaway) => (
                            <li key={takeaway}>{takeaway}</li>
                          ))}
                        </ol>
                      </section>
                    ) : null}

                    {prep?.summary ? (
                      <section className="mt-5 rounded-md bg-blue-50 p-4">
                        <h3 className="font-semibold text-blue-900">CarePrep</h3>
                        <p className="mt-1 text-slate-700">{prep.summary}</p>
                        {questions.length > 0 ? (
                          <ul className="mt-3 list-disc space-y-1 pl-5 text-slate-700">
                            {questions.map((question) => (
                              <li key={question}>{question}</li>
                            ))}
                          </ul>
                        ) : null}
                      </section>
                    ) : null}
                  </article>
                );
              })
            )}
          </div>
        </div>
      </section>
    </main>
  );
}
