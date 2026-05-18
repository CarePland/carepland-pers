"use client";

import { createClient } from "@supabase/supabase-js";
import { FormEvent, useEffect, useMemo, useState } from "react";

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
  med_review?: unknown;
  since_last_visit?: unknown;
  next_steps?: unknown;
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

function DetailList({
  emptyLabel,
  items,
}: {
  emptyLabel: string;
  items: string[];
}) {
  if (items.length === 0) {
    return <p className="mt-2 text-sm text-slate-500">{emptyLabel}</p>;
  }

  return (
    <ul className="mt-2 space-y-2 text-slate-700">
      {items.map((item) => (
        <li className="flex gap-2" key={item}>
          <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-blue-500" />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

export default function Home() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [newAppointmentTitle, setNewAppointmentTitle] = useState("");
  const [newAppointmentReason, setNewAppointmentReason] = useState("");
  const [newAppointmentStartsAt, setNewAppointmentStartsAt] = useState("");
  const [loading, setLoading] = useState(false);
  const [creatingAppointment, setCreatingAppointment] = useState(false);
  const [message, setMessage] = useState("");
  const [signedInEmail, setSignedInEmail] = useState<string | null>(null);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [notes, setNotes] = useState<AppointmentNote[]>([]);
  const [guidance, setGuidance] = useState<CarePrepGuidance[]>([]);

  const notesByAppointment = useMemo(() => {
    return new Map(notes.map((note) => [note.appointment_id, note]));
  }, [notes]);

  const guidanceByAppointment = useMemo(() => {
    return new Map(guidance.map((item) => [item.appointment_id, item]));
  }, [guidance]);

  useEffect(() => {
    async function restoreSession() {
      const { data } = await supabase.auth.getSession();
      const sessionEmail = data.session?.user.email ?? null;

      if (sessionEmail) {
        setSignedInEmail(sessionEmail);
        setEmail(sessionEmail);
      }
    }

    restoreSession();
  }, []);

  async function getPrimaryCareContext() {
    const { data: userData, error: userError } = await supabase.auth.getUser();

    if (userError) {
      throw userError;
    }

    const userId = userData.user?.id;

    if (!userId) {
      throw new Error("Please sign in before adding an appointment.");
    }

    const { data: memberships, error: membershipsError } = await supabase
      .from("care_circle_memberships")
      .select("care_circle_id")
      .limit(1);

    if (membershipsError) {
      throw membershipsError;
    }

    const careCircleId = memberships?.[0]?.care_circle_id;

    if (!careCircleId) {
      throw new Error("No care circle membership found for this user.");
    }

    const { data: subjects, error: subjectsError } = await supabase
      .from("care_subjects")
      .select("id")
      .eq("care_circle_id", careCircleId)
      .limit(1);

    if (subjectsError) {
      throw subjectsError;
    }

    return {
      careCircleId,
      careSubjectId: subjects?.[0]?.id ?? null,
      userId,
    };
  }

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
          .select(
            "id,appointment_id,summary,key_questions,bring_list,watchouts,med_review,since_last_visit,next_steps"
          )
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

      setSignedInEmail(email);
      await loadAppointments();
    } catch (error) {
      setMessage(getErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }

  async function handleRefresh() {
    setLoading(true);
    setMessage("");

    try {
      await loadAppointments();
    } catch (error) {
      setMessage(getErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }

  async function handleSignOut() {
    await supabase.auth.signOut();
    setSignedInEmail(null);
    setPassword("");
    setAppointments([]);
    setNotes([]);
    setGuidance([]);
    setMessage("Signed out.");
  }

  async function handleCreateAppointment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setCreatingAppointment(true);
    setMessage("");

    try {
      if (!newAppointmentTitle.trim()) {
        throw new Error("Please enter an appointment title.");
      }

      const { careCircleId, careSubjectId, userId } = await getPrimaryCareContext();

      const startsAt = newAppointmentStartsAt
        ? new Date(newAppointmentStartsAt).toISOString()
        : null;

      const { error } = await supabase.from("appointments").insert({
        care_circle_id: careCircleId,
        care_subject_id: careSubjectId,
        owner_user_id: userId,
        title: newAppointmentTitle.trim(),
        reason: newAppointmentReason.trim() || null,
        starts_at: startsAt,
        status: "scheduled",
        source: "manual",
      });

      if (error) {
        throw error;
      }

      setNewAppointmentTitle("");
      setNewAppointmentReason("");
      setNewAppointmentStartsAt("");
      await loadAppointments();
      setMessage("Appointment added.");
    } catch (error) {
      setMessage(getErrorMessage(error));
    } finally {
      setCreatingAppointment(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-50 px-6 py-10 text-slate-900">
      <section className="mx-auto max-w-6xl">
        <p className="text-sm font-semibold uppercase tracking-wide text-blue-700">
          CarePland Personal
        </p>

        <h1 className="mt-3 max-w-4xl text-4xl font-bold">
          Appointment memory, rebuilt cleanly.
        </h1>

        <p className="mt-4 max-w-3xl text-lg text-slate-700">
          A first live dashboard for the new CP Pers data spine: appointments,
          visit notes, and CarePrep from Supabase.
        </p>

        <div className="mt-8 grid gap-6 lg:grid-cols-[320px_1fr]">
          <aside className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            {signedInEmail ? (
              <div>
                <h2 className="text-xl font-semibold">Signed in</h2>
                <p className="mt-2 break-words text-slate-600">{signedInEmail}</p>
                <div className="mt-5 space-y-3">
                  <button
                    className="w-full rounded-md bg-blue-700 px-4 py-2 font-semibold text-white disabled:bg-slate-400"
                    disabled={loading}
                    onClick={handleRefresh}
                    type="button"
                  >
                    {loading ? "Refreshing..." : "Refresh appointments"}
                  </button>
                  <button
                    className="w-full rounded-md border border-slate-300 px-4 py-2 font-semibold text-slate-700"
                    onClick={handleSignOut}
                    type="button"
                  >
                    Sign out
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSignIn}>
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
              </form>
            )}

            <div className="mt-6 rounded-md bg-slate-100 p-4 text-sm text-slate-700">
              <p className="font-semibold">Current slice</p>
              <p className="mt-1">
                Create appointments and view note synthesis plus CarePrep
                guidance.
              </p>
            </div>

            {signedInEmail ? (
              <form
                className="mt-6 border-t border-slate-200 pt-6"
                onSubmit={handleCreateAppointment}
              >
                <h2 className="text-xl font-semibold">Add appointment</h2>
                <label className="mt-4 block text-sm font-medium text-slate-700">
                  Title
                  <input
                    className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2 text-base"
                    onChange={(event) => setNewAppointmentTitle(event.target.value)}
                    placeholder="e.g. Follow-up with Dr. Smith"
                    type="text"
                    value={newAppointmentTitle}
                  />
                </label>
                <label className="mt-4 block text-sm font-medium text-slate-700">
                  Date & time
                  <input
                    className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2 text-base"
                    onChange={(event) =>
                      setNewAppointmentStartsAt(event.target.value)
                    }
                    type="datetime-local"
                    value={newAppointmentStartsAt}
                  />
                </label>
                <label className="mt-4 block text-sm font-medium text-slate-700">
                  Reason
                  <textarea
                    className="mt-2 min-h-24 w-full rounded-md border border-slate-300 px-3 py-2 text-base"
                    onChange={(event) => setNewAppointmentReason(event.target.value)}
                    placeholder="What is this appointment for?"
                    value={newAppointmentReason}
                  />
                </label>
                <button
                  className="mt-4 w-full rounded-md bg-slate-900 px-4 py-2 font-semibold text-white disabled:bg-slate-400"
                  disabled={creatingAppointment}
                  type="submit"
                >
                  {creatingAppointment ? "Adding..." : "+ Add appointment"}
                </button>
              </form>
            ) : null}

            {message ? (
              <p className="mt-4 rounded-md bg-slate-100 p-3 text-sm text-slate-700">
                {message}
              </p>
            ) : null}
          </aside>

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
                const followups = asTextList(note?.followups);
                const bringList = asTextList(prep?.bring_list);
                const questions = asTextList(prep?.key_questions);
                const watchouts = asTextList(prep?.watchouts);
                const medReview = asTextList(prep?.med_review);
                const sinceLastVisit = asTextList(prep?.since_last_visit);

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
                      <section className="mt-5">
                        <h3 className="font-semibold text-slate-900">Reason</h3>
                        <p className="mt-1 text-slate-700">{appointment.reason}</p>
                      </section>
                    ) : null}

                    {note?.summary_short ? (
                      <section className="mt-5">
                        <h3 className="font-semibold text-blue-800">Visit summary</h3>
                        <p className="mt-1 text-slate-700">{note.summary_short}</p>
                      </section>
                    ) : null}

                    <div className="mt-5 grid gap-4 md:grid-cols-2">
                      <section className="rounded-md border border-slate-200 p-4">
                        <h3 className="font-semibold text-blue-800">Takeaways</h3>
                        <DetailList
                          emptyLabel="No takeaways saved yet."
                          items={takeaways}
                        />
                      </section>

                      <section className="rounded-md border border-slate-200 p-4">
                        <h3 className="font-semibold text-blue-800">Follow-ups</h3>
                        <DetailList
                          emptyLabel="No follow-ups saved yet."
                          items={followups}
                        />
                      </section>
                    </div>

                    {prep?.summary ? (
                      <section className="mt-5 rounded-md bg-blue-50 p-4">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <h3 className="text-lg font-semibold text-blue-900">
                            CarePrep
                          </h3>
                          <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold uppercase tracking-wide text-blue-700">
                            Prep for visit
                          </span>
                        </div>
                        <p className="mt-2 text-slate-700">{prep.summary}</p>

                        <div className="mt-5 grid gap-4 lg:grid-cols-3">
                          <section className="rounded-md bg-white p-4">
                            <h4 className="font-semibold text-slate-900">Bring</h4>
                            <DetailList
                              emptyLabel="No bring-list items saved yet."
                              items={bringList}
                            />
                          </section>

                          <section className="rounded-md bg-white p-4">
                            <h4 className="font-semibold text-slate-900">Ask</h4>
                            <DetailList
                              emptyLabel="No questions saved yet."
                              items={questions}
                            />
                          </section>

                          <section className="rounded-md bg-white p-4">
                            <h4 className="font-semibold text-slate-900">
                              Watch for
                            </h4>
                            <DetailList
                              emptyLabel="No watchouts saved yet."
                              items={watchouts}
                            />
                          </section>
                        </div>

                        {(medReview.length > 0 || sinceLastVisit.length > 0) && (
                          <div className="mt-4 grid gap-4 md:grid-cols-2">
                            <section className="rounded-md bg-white p-4">
                              <h4 className="font-semibold text-slate-900">
                                Medication review
                              </h4>
                              <DetailList
                                emptyLabel="No medication review items saved yet."
                                items={medReview}
                              />
                            </section>

                            <section className="rounded-md bg-white p-4">
                              <h4 className="font-semibold text-slate-900">
                                Since last visit
                              </h4>
                              <DetailList
                                emptyLabel="No prior-visit context saved yet."
                                items={sinceLastVisit}
                              />
                            </section>
                          </div>
                        )}
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
