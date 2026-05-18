"use client";

import { createClient } from "@supabase/supabase-js";
import { FormEvent, useEffect, useMemo, useState } from "react";

type Appointment = {
  id: string;
  care_subject_id: string | null;
  title: string | null;
  reason: string | null;
  starts_at: string | null;
  status: string;
  archived_at?: string | null;
};

type CareSubject = {
  id: string;
  care_circle_id: string;
  display_name: string;
  subject_type: string;
  is_default: boolean;
  is_active: boolean;
};

type CareCircleEntitlement = {
  max_active_subjects: number;
  plan_id: string;
  plan_name: string;
};

type AppointmentNote = {
  id: string;
  appointment_id: string;
  summary_short: string | null;
  takeaways: unknown;
  followups: unknown;
  is_current: boolean;
  version_number: number;
  superseded_at: string | null;
  superseded_by_note_id: string | null;
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

type AppointmentView = "active" | "archived";

const ALL_SUBJECTS = "all";

const defaultEntitlement: CareCircleEntitlement = {
  max_active_subjects: 1,
  plan_id: "personal",
  plan_name: "Personal",
};

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

const supabase = createClient(supabaseUrl, supabaseAnonKey);

const emptyNoteDraft = {
  followups: "",
  summary: "",
  takeaways: "",
};

const emptyAppointmentDraft = {
  reason: "",
  startsAt: "",
  status: "scheduled",
  title: "",
};

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

function linesToList(value: string): string[] {
  return value
    .split("\n")
    .map((line) => line.trim())
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

function toDatetimeLocalValue(value: string | null): string {
  if (!value) {
    return "";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return localDate.toISOString().slice(0, 16);
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
  const [newAppointmentSubjectId, setNewAppointmentSubjectId] = useState("");
  const [newCareVipName, setNewCareVipName] = useState("");
  const [managingCareVips, setManagingCareVips] = useState(false);
  const [noteDrafts, setNoteDrafts] = useState<
    Record<
      string,
      {
        followups: string;
        summary: string;
        takeaways: string;
      }
    >
  >({});
  const [appointmentDrafts, setAppointmentDrafts] = useState<
    Record<string, typeof emptyAppointmentDraft>
  >({});
  const [editingAppointmentIds, setEditingAppointmentIds] = useState<
    Record<string, boolean>
  >({});
  const [editingNoteIds, setEditingNoteIds] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(false);
  const [creatingAppointment, setCreatingAppointment] = useState(false);
  const [creatingCareVip, setCreatingCareVip] = useState(false);
  const [appointmentView, setAppointmentView] =
    useState<AppointmentView>("active");
  const [selectedSubjectId, setSelectedSubjectId] = useState(ALL_SUBJECTS);
  const [savingAppointmentForId, setSavingAppointmentForId] = useState<
    string | null
  >(null);
  const [archivingAppointmentForId, setArchivingAppointmentForId] = useState<
    string | null
  >(null);
  const [savingNoteForId, setSavingNoteForId] = useState<string | null>(null);
  const [restoringAppointmentForId, setRestoringAppointmentForId] = useState<
    string | null
  >(null);
  const [message, setMessage] = useState("");
  const [signedInEmail, setSignedInEmail] = useState<string | null>(null);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [careSubjects, setCareSubjects] = useState<CareSubject[]>([]);
  const [entitlement, setEntitlement] =
    useState<CareCircleEntitlement>(defaultEntitlement);
  const [notes, setNotes] = useState<AppointmentNote[]>([]);
  const [guidance, setGuidance] = useState<CarePrepGuidance[]>([]);

  const notesByAppointment = useMemo(() => {
    return new Map(notes.map((note) => [note.appointment_id, note]));
  }, [notes]);

  const guidanceByAppointment = useMemo(() => {
    return new Map(guidance.map((item) => [item.appointment_id, item]));
  }, [guidance]);

  const subjectsById = useMemo(() => {
    return new Map(careSubjects.map((subject) => [subject.id, subject]));
  }, [careSubjects]);

  const careVipLimit = Math.max(entitlement.max_active_subjects, 5);
  const canUseMultipleCareVips = careVipLimit > 1;
  const canAddCareVip = careSubjects.length < careVipLimit;

  useEffect(() => {
    async function restoreSession() {
      const { data } = await supabase.auth.getSession();
      const sessionEmail = data.session?.user.email ?? null;

      if (sessionEmail) {
        setSignedInEmail(sessionEmail);
        setEmail(sessionEmail);
        setLoading(true);

        try {
          await loadAppointments();
        } catch (error) {
          setMessage(getErrorMessage(error));
        } finally {
          setLoading(false);
        }
      }
    }

    restoreSession();
    // This runs once on page load to restore Supabase session state.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function getPrimaryCareContext(preferredSubjectId?: string) {
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
      .select("id,is_default")
      .eq("care_circle_id", careCircleId)
      .eq("is_active", true)
      .order("is_default", { ascending: false });

    if (subjectsError) {
      throw subjectsError;
    }

    const careSubjectId =
      preferredSubjectId && preferredSubjectId !== ALL_SUBJECTS
        ? preferredSubjectId
        : subjects?.find((subject) => subject.is_default)?.id ??
          subjects?.[0]?.id ??
          null;

    return {
      careCircleId,
      careSubjectId,
      userId,
    };
  }

  async function loadAppointments(
    view: AppointmentView = appointmentView,
    subjectId: string = selectedSubjectId
  ) {
    const { data: memberships, error: membershipsError } = await supabase
      .from("care_circle_memberships")
      .select("care_circle_id");

    if (membershipsError) {
      throw membershipsError;
    }

    const circleIds = memberships?.map((row) => row.care_circle_id) ?? [];

    if (circleIds.length === 0) {
      setAppointments([]);
      setCareSubjects([]);
      setEntitlement(defaultEntitlement);
      setNotes([]);
      setGuidance([]);
      setMessage("Signed in, but no care circle membership was found.");
      return;
    }

    const { data: entitlementRows, error: entitlementError } = await supabase
      .from("care_circle_entitlements")
      .select("care_circle_id,plan_id,status")
      .in("care_circle_id", circleIds)
      .eq("status", "active");

    if (entitlementError) {
      throw entitlementError;
    }

    const planId = entitlementRows?.[0]?.plan_id ?? defaultEntitlement.plan_id;

    const { data: planRows, error: planError } = await supabase
      .from("plans")
      .select("id,name,max_active_subjects")
      .eq("id", planId)
      .limit(1);

    if (planError) {
      throw planError;
    }

    const plan = planRows?.[0];
    const currentEntitlement = plan
      ? {
          max_active_subjects: plan.max_active_subjects,
          plan_id: plan.id,
          plan_name: plan.name,
        }
      : defaultEntitlement;

    setEntitlement(currentEntitlement);

    const { data: subjectRows, error: subjectsError } = await supabase
      .from("care_subjects")
      .select("id,care_circle_id,display_name,subject_type,is_default,is_active")
      .in("care_circle_id", circleIds)
      .eq("is_active", true)
      .order("is_default", { ascending: false })
      .order("display_name", { ascending: true });

    if (subjectsError) {
      throw subjectsError;
    }

    const subjects = subjectRows ?? [];
    const canUseMultipleSubjects = currentEntitlement.max_active_subjects > 1;
    const defaultSubjectId =
      subjects.find((subject) => subject.is_default)?.id ?? subjects[0]?.id ?? "";
    let effectiveSubjectId = defaultSubjectId || ALL_SUBJECTS;

    if (canUseMultipleSubjects) {
      effectiveSubjectId =
        subjectId === ALL_SUBJECTS ||
        subjects.some((subject) => subject.id === subjectId)
          ? subjectId
          : ALL_SUBJECTS;
    }

    setCareSubjects(subjects);
    setSelectedSubjectId(effectiveSubjectId);
    setNewAppointmentSubjectId((currentSubjectId) => {
      if (currentSubjectId && subjects.some((subject) => subject.id === currentSubjectId)) {
        return currentSubjectId;
      }

      return effectiveSubjectId !== ALL_SUBJECTS
        ? effectiveSubjectId
        : defaultSubjectId;
    });

    let appointmentQuery = supabase
      .from("appointments")
      .select("id,care_subject_id,title,reason,starts_at,status")
      .in("care_circle_id", circleIds)
      .order("starts_at", { ascending: true });

    if (effectiveSubjectId !== ALL_SUBJECTS) {
      appointmentQuery = appointmentQuery.eq("care_subject_id", effectiveSubjectId);
    }

    const { data: appointmentRows, error: appointmentsError } =
      await appointmentQuery;

    if (appointmentsError) {
      throw appointmentsError;
    }

    const visibleAppointments =
      appointmentRows?.filter((item) =>
        view === "archived"
          ? item.status === "archived"
          : item.status !== "archived"
      ) ?? [];
    const appointmentIds = visibleAppointments.map((item) => item.id);
    setAppointments(visibleAppointments);

    if (appointmentIds.length === 0) {
      setNotes([]);
      setGuidance([]);
      setMessage(
        view === "archived"
          ? "No archived appointments found."
          : "Signed in. No appointments found yet."
      );
      return;
    }

    const [{ data: noteRows, error: notesError }, { data: guidanceRows, error: guidanceError }] =
      await Promise.all([
        supabase
          .from("appointment_notes")
          .select(
            "id,appointment_id,summary_short,takeaways,followups,is_current,version_number,superseded_at,superseded_by_note_id"
          )
          .in("appointment_id", appointmentIds)
          .eq("is_current", true),
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
    setMessage(`Loaded ${visibleAppointments.length} appointment(s).`);
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

  async function handleChangeAppointmentView(view: AppointmentView) {
    setAppointmentView(view);
    setLoading(true);
    setMessage("");

    try {
      await loadAppointments(view);
    } catch (error) {
      setMessage(getErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }

  async function handleChangeSubject(subjectId: string) {
    setSelectedSubjectId(subjectId);

    if (subjectId !== ALL_SUBJECTS) {
      setNewAppointmentSubjectId(subjectId);
    }

    setLoading(true);
    setMessage("");

    try {
      await loadAppointments(appointmentView, subjectId);
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
    setCareSubjects([]);
    setEntitlement(defaultEntitlement);
    setNotes([]);
    setGuidance([]);
    setSelectedSubjectId(ALL_SUBJECTS);
    setNewAppointmentSubjectId("");
    setNewCareVipName("");
    setManagingCareVips(false);
    setMessage("Signed out.");
  }

  async function handleCreateCareVip(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setCreatingCareVip(true);
    setMessage("");

    try {
      const displayName = newCareVipName.trim();

      if (!displayName) {
        throw new Error("Please enter a Care VIP name.");
      }

      if (!canAddCareVip) {
        throw new Error(
          `${entitlement.plan_name} allows ${entitlement.max_active_subjects} active Care VIP.`
        );
      }

      const { careCircleId } = await getPrimaryCareContext();
      const isFirstCareVip = careSubjects.length === 0;

      const { data: newSubject, error } = await supabase
        .from("care_subjects")
        .insert({
          care_circle_id: careCircleId,
          display_name: displayName,
          is_active: true,
          is_default: isFirstCareVip,
          subject_type: "other",
        })
        .select("id")
        .single();

      if (error) {
        throw error;
      }

      setNewCareVipName("");
      setSelectedSubjectId(newSubject.id);
      setNewAppointmentSubjectId(newSubject.id);
      setManagingCareVips(false);
      await loadAppointments(appointmentView, newSubject.id);
      setMessage("Care VIP added.");
    } catch (error) {
      setMessage(getErrorMessage(error));
    } finally {
      setCreatingCareVip(false);
    }
  }

  async function handleCreateAppointment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setCreatingAppointment(true);
    setMessage("");

    try {
      if (!newAppointmentTitle.trim()) {
        throw new Error("Please enter an appointment title.");
      }

      const targetSubjectId =
        newAppointmentSubjectId ||
        (selectedSubjectId !== ALL_SUBJECTS ? selectedSubjectId : "");

      const { careCircleId, careSubjectId, userId } =
        await getPrimaryCareContext(targetSubjectId);

      if (!careSubjectId) {
        throw new Error("Please choose who this appointment is for.");
      }

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
      setNewAppointmentSubjectId(careSubjectId);
      await loadAppointments();
      setMessage("Appointment added.");
    } catch (error) {
      setMessage(getErrorMessage(error));
    } finally {
      setCreatingAppointment(false);
    }
  }

  function startEditingAppointment(appointment: Appointment) {
    setAppointmentDrafts((currentDrafts) => ({
      ...currentDrafts,
      [appointment.id]: {
        reason: appointment.reason ?? "",
        startsAt: toDatetimeLocalValue(appointment.starts_at),
        status: appointment.status,
        title: appointment.title ?? "",
      },
    }));
    setEditingAppointmentIds((currentIds) => ({
      ...currentIds,
      [appointment.id]: true,
    }));
  }

  function cancelEditingAppointment(appointmentId: string) {
    setEditingAppointmentIds((currentIds) => ({
      ...currentIds,
      [appointmentId]: false,
    }));
    setAppointmentDrafts((currentDrafts) => ({
      ...currentDrafts,
      [appointmentId]: emptyAppointmentDraft,
    }));
  }

  function updateAppointmentDraft(
    appointmentId: string,
    field: "reason" | "startsAt" | "status" | "title",
    value: string
  ) {
    setAppointmentDrafts((currentDrafts) => ({
      ...currentDrafts,
      [appointmentId]: {
        ...emptyAppointmentDraft,
        ...currentDrafts[appointmentId],
        [field]: value,
      },
    }));
  }

  async function handleSaveAppointment(
    event: FormEvent<HTMLFormElement>,
    appointment: Appointment
  ) {
    event.preventDefault();
    setSavingAppointmentForId(appointment.id);
    setMessage("");

    try {
      const draft = appointmentDrafts[appointment.id] ?? emptyAppointmentDraft;

      if (!draft.title.trim()) {
        throw new Error("Please enter an appointment title.");
      }

      const startsAt = draft.startsAt
        ? new Date(draft.startsAt).toISOString()
        : null;

      const { error } = await supabase
        .from("appointments")
        .update({
          reason: draft.reason.trim() || null,
          starts_at: startsAt,
          status: draft.status,
          title: draft.title.trim(),
        })
        .eq("id", appointment.id);

      if (error) {
        throw error;
      }

      setAppointmentDrafts((currentDrafts) => ({
        ...currentDrafts,
        [appointment.id]: emptyAppointmentDraft,
      }));
      setEditingAppointmentIds((currentIds) => ({
        ...currentIds,
        [appointment.id]: false,
      }));
      await loadAppointments();
      setMessage("Appointment updated.");
    } catch (error) {
      setMessage(getErrorMessage(error));
    } finally {
      setSavingAppointmentForId(null);
    }
  }

  async function handleArchiveAppointment(appointment: Appointment) {
    const shouldArchive = window.confirm(
      "Archive this appointment? It will disappear from the active dashboard, but the data will stay available for history and recovery."
    );

    if (!shouldArchive) {
      return;
    }

    setArchivingAppointmentForId(appointment.id);
    setMessage("");

    try {
      const { error } = await supabase
        .from("appointments")
        .update({
          archived_at: new Date().toISOString(),
          status: "archived",
        })
        .eq("id", appointment.id);

      if (error) {
        throw error;
      }

      setEditingAppointmentIds((currentIds) => ({
        ...currentIds,
        [appointment.id]: false,
      }));
      setEditingNoteIds((currentIds) => ({
        ...currentIds,
        [appointment.id]: false,
      }));
      await loadAppointments();
      setMessage("Appointment archived.");
    } catch (error) {
      setMessage(getErrorMessage(error));
    } finally {
      setArchivingAppointmentForId(null);
    }
  }

  async function restoreAppointment(appointmentId: string) {
    setRestoringAppointmentForId(appointmentId);
    setMessage("");

    try {
      const { error } = await supabase
        .from("appointments")
        .update({
          archived_at: null,
          status: "scheduled",
        })
        .eq("id", appointmentId);

      if (error) {
        throw error;
      }

      await loadAppointments();
      setMessage("Appointment restored.");
    } catch (error) {
      setMessage(getErrorMessage(error));
    } finally {
      setRestoringAppointmentForId(null);
    }
  }

  function updateNoteDraft(
    appointmentId: string,
    field: "followups" | "summary" | "takeaways",
    value: string
  ) {
    setNoteDrafts((currentDrafts) => ({
      ...currentDrafts,
      [appointmentId]: {
        ...emptyNoteDraft,
        ...currentDrafts[appointmentId],
        [field]: value,
      },
    }));
  }

  function startEditingNote(appointmentId: string, note: AppointmentNote) {
    setNoteDrafts((currentDrafts) => ({
      ...currentDrafts,
      [appointmentId]: {
        followups: asTextList(note.followups).join("\n"),
        summary: note.summary_short ?? "",
        takeaways: asTextList(note.takeaways).join("\n"),
      },
    }));
    setEditingNoteIds((currentIds) => ({
      ...currentIds,
      [appointmentId]: true,
    }));
  }

  function cancelEditingNote(appointmentId: string) {
    setEditingNoteIds((currentIds) => ({
      ...currentIds,
      [appointmentId]: false,
    }));
    setNoteDrafts((currentDrafts) => ({
      ...currentDrafts,
      [appointmentId]: emptyNoteDraft,
    }));
  }

  async function handleSaveNote(
    event: FormEvent<HTMLFormElement>,
    appointment: Appointment
  ) {
    event.preventDefault();
    setSavingNoteForId(appointment.id);
    setMessage("");

    try {
      const draft = noteDrafts[appointment.id];
      const summary = draft?.summary.trim() ?? "";
      const takeaways = linesToList(draft?.takeaways ?? "");
      const followups = linesToList(draft?.followups ?? "");

      if (!summary && takeaways.length === 0 && followups.length === 0) {
        throw new Error("Please add a summary, takeaway, or follow-up.");
      }

      const { careCircleId, userId } = await getPrimaryCareContext();
      const existingNote = notesByAppointment.get(appointment.id);

      const { data: newNote, error: insertError } = await supabase
        .from("appointment_notes")
        .insert({
        appointment_id: appointment.id,
        care_circle_id: careCircleId,
        user_id: userId,
        input_text: summary || null,
        summary_short: summary || null,
        takeaways,
        followups,
        is_current: true,
        version_number: existingNote ? existingNote.version_number + 1 : 1,
        source: existingNote ? "manual_edit" : "manual",
        generated_by_ai: false,
        accepted_by_user: true,
        })
        .select("id")
        .single();

      if (insertError) {
        throw insertError;
      }

      if (existingNote) {
        const { error: archiveError } = await supabase
          .from("appointment_notes")
          .update({
            is_current: false,
            superseded_at: new Date().toISOString(),
            superseded_by_note_id: newNote.id,
          })
          .eq("id", existingNote.id);

        if (archiveError) {
          throw archiveError;
        }
      }

      setNoteDrafts((currentDrafts) => ({
        ...currentDrafts,
        [appointment.id]: emptyNoteDraft,
      }));
      setEditingNoteIds((currentIds) => ({
        ...currentIds,
        [appointment.id]: false,
      }));
      await loadAppointments();
      setMessage(existingNote ? "Notes updated. Previous version archived." : "Notes added.");
    } catch (error) {
      setMessage(getErrorMessage(error));
    } finally {
      setSavingNoteForId(null);
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
              {signedInEmail ? (
                <p className="mt-3 text-xs font-medium uppercase tracking-wide text-slate-500">
                  Plan: {entitlement.plan_name} · Care VIPs{" "}
                  {careSubjects.length}/{careVipLimit}
                </p>
              ) : null}
            </div>

            {signedInEmail && canUseMultipleCareVips ? (
              <div className="mt-6 border-t border-slate-200 pt-6">
                <div className="flex items-center justify-between gap-3">
                  <h2 className="text-xl font-semibold">View Care VIP</h2>
                  <button
                    className="text-sm font-semibold italic text-amber-800"
                    onClick={() =>
                      setManagingCareVips((isManaging) => !isManaging)
                    }
                    type="button"
                  >
                    {managingCareVips ? "Done" : "Manage"}
                  </button>
                </div>
                <label className="mt-4 block text-sm font-medium text-slate-700">
                  Showing
                  <select
                    className="mt-2 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-base"
                    disabled={loading || careSubjects.length === 0}
                    onChange={(event) => handleChangeSubject(event.target.value)}
                    value={selectedSubjectId}
                  >
                    <option value={ALL_SUBJECTS}>All Care VIPs</option>
                    {careSubjects.map((subject) => (
                      <option key={subject.id} value={subject.id}>
                        {subject.display_name}
                      </option>
                    ))}
                  </select>
                </label>

                {managingCareVips ? (
                  <form
                    className="mt-5 rounded-md bg-slate-50 p-4"
                    onSubmit={handleCreateCareVip}
                  >
                    <h3 className="font-semibold text-slate-900">Add Care VIP</h3>
                    <label className="mt-3 block text-sm font-medium text-slate-700">
                      Name
                      <input
                        className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2 text-base"
                        disabled={!canAddCareVip}
                        onChange={(event) => setNewCareVipName(event.target.value)}
                        placeholder="e.g. Dixie"
                        type="text"
                        value={newCareVipName}
                      />
                    </label>
                    <button
                      className="mt-4 w-full rounded-md bg-slate-900 px-4 py-2 font-semibold text-white disabled:bg-slate-400"
                      disabled={creatingCareVip || !canAddCareVip}
                      type="submit"
                    >
                      {creatingCareVip ? "Adding..." : "+ Add Care VIP"}
                    </button>
                    {!canAddCareVip ? (
                      <p className="mt-3 text-sm text-slate-500">
                        {entitlement.plan_name} includes {careVipLimit} active
                        Care VIPs.
                      </p>
                    ) : null}
                  </form>
                ) : null}
              </div>
            ) : null}

            {signedInEmail ? (
              <form
                className="mt-6 border-t border-slate-200 pt-6"
                onSubmit={handleCreateAppointment}
              >
                <h2 className="text-xl font-semibold">Add appointment</h2>
                {canUseMultipleCareVips ? (
                  <label className="mt-4 block text-sm font-medium text-slate-700">
                    Who is this for?
                    <select
                      className="mt-2 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-base"
                      disabled={careSubjects.length === 0}
                      onChange={(event) =>
                        setNewAppointmentSubjectId(event.target.value)
                      }
                      value={newAppointmentSubjectId}
                    >
                      {careSubjects.length === 0 ? (
                        <option value="">No Care VIPs found</option>
                      ) : null}
                      {careSubjects.map((subject) => (
                        <option key={subject.id} value={subject.id}>
                          {subject.display_name}
                        </option>
                      ))}
                    </select>
                  </label>
                ) : null}
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
            {signedInEmail ? (
              <div className="flex flex-wrap gap-2">
                <button
                  className={`rounded-md px-4 py-2 text-sm font-semibold ${
                    appointmentView === "active"
                      ? "bg-blue-700 text-white"
                      : "border border-slate-300 bg-white text-slate-700"
                  }`}
                  disabled={loading}
                  onClick={() => handleChangeAppointmentView("active")}
                  type="button"
                >
                  Active
                </button>
                <button
                  className={`rounded-md px-4 py-2 text-sm font-semibold ${
                    appointmentView === "archived"
                      ? "bg-blue-700 text-white"
                      : "border border-slate-300 bg-white text-slate-700"
                  }`}
                  disabled={loading}
                  onClick={() => handleChangeAppointmentView("archived")}
                  type="button"
                >
                  Archived
                </button>
              </div>
            ) : null}

            {appointments.length === 0 ? (
              <div className="rounded-lg border border-dashed border-slate-300 bg-white p-6 text-slate-600">
                {appointmentView === "archived"
                  ? "No archived appointments found."
                  : "No appointments loaded yet."}
              </div>
            ) : (
              appointments.map((appointment) => {
                const note = notesByAppointment.get(appointment.id);
                const prep = guidanceByAppointment.get(appointment.id);
                const appointmentSubject = appointment.care_subject_id
                  ? subjectsById.get(appointment.care_subject_id)
                  : null;
                const appointmentDraft =
                  appointmentDrafts[appointment.id] ?? emptyAppointmentDraft;
                const isEditingAppointment =
                  editingAppointmentIds[appointment.id] ?? false;
                const noteDraft = noteDrafts[appointment.id] ?? emptyNoteDraft;
                const isEditingNote = editingNoteIds[appointment.id] ?? false;
                const takeaways = asTextList(note?.takeaways);
                const followups = asTextList(note?.followups);
                const bringList = asTextList(prep?.bring_list);
                const questions = asTextList(prep?.key_questions);
                const watchouts = asTextList(prep?.watchouts);
                const medReview = asTextList(prep?.med_review);
                const sinceLastVisit = asTextList(prep?.since_last_visit);
                const isArchived = appointment.status === "archived";

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
                        {appointmentSubject ? (
                          <p className="mt-1 text-sm font-medium text-slate-500">
                            For {appointmentSubject.display_name}
                          </p>
                        ) : null}
                      </div>
                      <span className="rounded-full bg-blue-50 px-3 py-1 text-sm font-medium text-blue-700">
                        {appointment.status}
                      </span>
                    </div>

                    {!isEditingAppointment && !isArchived ? (
                      <div className="mt-4 flex flex-wrap gap-3">
                        <button
                          className="rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700"
                          onClick={() => startEditingAppointment(appointment)}
                          type="button"
                        >
                          Edit appointment
                        </button>
                        <button
                          className="rounded-md border border-rose-300 px-3 py-2 text-sm font-semibold text-rose-700 disabled:text-slate-400"
                          disabled={archivingAppointmentForId === appointment.id}
                          onClick={() => handleArchiveAppointment(appointment)}
                          type="button"
                        >
                          {archivingAppointmentForId === appointment.id
                            ? "Archiving..."
                            : "Archive appointment"}
                        </button>
                      </div>
                    ) : null}

                    {isArchived ? (
                      <div className="mt-4">
                        <button
                          className="rounded-md bg-blue-700 px-4 py-2 text-sm font-semibold text-white disabled:bg-slate-400"
                          disabled={restoringAppointmentForId === appointment.id}
                          onClick={() => restoreAppointment(appointment.id)}
                          type="button"
                        >
                          {restoringAppointmentForId === appointment.id
                            ? "Restoring..."
                            : "Restore appointment"}
                        </button>
                      </div>
                    ) : null}

                    {isEditingAppointment && !isArchived ? (
                      <form
                        className="mt-5 rounded-md border border-slate-200 bg-slate-50 p-4"
                        onSubmit={(event) =>
                          handleSaveAppointment(event, appointment)
                        }
                      >
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div>
                            <h3 className="text-lg font-semibold text-slate-900">
                              Edit appointment
                            </h3>
                            <p className="mt-1 text-sm text-slate-500">
                              Update the appointment details saved on this record.
                            </p>
                          </div>
                          <button
                            className="rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700"
                            onClick={() => cancelEditingAppointment(appointment.id)}
                            type="button"
                          >
                            Cancel
                          </button>
                        </div>

                        <div className="mt-4 grid gap-4 md:grid-cols-2">
                          <label className="block text-sm font-medium text-slate-700">
                            Title
                            <input
                              className="mt-2 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-base"
                              onChange={(event) =>
                                updateAppointmentDraft(
                                  appointment.id,
                                  "title",
                                  event.target.value
                                )
                              }
                              type="text"
                              value={appointmentDraft.title}
                            />
                          </label>
                          <label className="block text-sm font-medium text-slate-700">
                            Date & time
                            <input
                              className="mt-2 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-base"
                              onChange={(event) =>
                                updateAppointmentDraft(
                                  appointment.id,
                                  "startsAt",
                                  event.target.value
                                )
                              }
                              type="datetime-local"
                              value={appointmentDraft.startsAt}
                            />
                          </label>
                          <label className="block text-sm font-medium text-slate-700">
                            Status
                            <select
                              className="mt-2 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-base"
                              onChange={(event) =>
                                updateAppointmentDraft(
                                  appointment.id,
                                  "status",
                                  event.target.value
                                )
                              }
                              value={appointmentDraft.status}
                            >
                              <option value="scheduled">Scheduled</option>
                              <option value="completed">Completed</option>
                              <option value="cancelled">Cancelled</option>
                              <option value="draft">Draft</option>
                            </select>
                          </label>
                          <label className="block text-sm font-medium text-slate-700 md:col-span-2">
                            Reason
                            <textarea
                              className="mt-2 min-h-24 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-base"
                              onChange={(event) =>
                                updateAppointmentDraft(
                                  appointment.id,
                                  "reason",
                                  event.target.value
                                )
                              }
                              value={appointmentDraft.reason}
                            />
                          </label>
                        </div>

                        <div className="mt-4 flex flex-wrap gap-3">
                          <button
                            className="rounded-md bg-blue-700 px-4 py-2 font-semibold text-white disabled:bg-slate-400"
                            disabled={savingAppointmentForId === appointment.id}
                            type="submit"
                          >
                            {savingAppointmentForId === appointment.id
                              ? "Saving..."
                              : "Save appointment"}
                          </button>
                        </div>
                      </form>
                    ) : null}

                    {appointment.reason ? (
                      <section className="mt-5">
                        <h3 className="font-semibold text-slate-900">Reason</h3>
                        <p className="mt-1 text-slate-700">{appointment.reason}</p>
                      </section>
                    ) : null}

                    {note ? (
                      <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <h3 className="font-semibold text-blue-800">
                            Visit notes
                          </h3>
                          <p className="mt-1 text-sm text-slate-500">
                            Current version {note.version_number}
                          </p>
                        </div>
                        {!isEditingNote && !isArchived ? (
                          <button
                            className="rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700"
                            onClick={() => startEditingNote(appointment.id, note)}
                            type="button"
                          >
                            Edit notes
                          </button>
                        ) : null}
                      </div>
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

                    {!isArchived && (note && !isEditingNote ? null : (
                      <form
                        className="mt-5 rounded-md border border-slate-200 bg-slate-50 p-4"
                        onSubmit={(event) => handleSaveNote(event, appointment)}
                      >
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div>
                            <h3 className="text-lg font-semibold text-slate-900">
                              {note ? "Edit notes" : "Add notes"}
                            </h3>
                            {note ? (
                              <p className="mt-1 text-sm text-slate-500">
                                Saving creates version {note.version_number + 1}
                                and keeps the old one archived.
                              </p>
                            ) : null}
                          </div>
                          {note ? (
                            <button
                              className="rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700"
                              onClick={() => cancelEditingNote(appointment.id)}
                              type="button"
                            >
                              Cancel
                            </button>
                          ) : null}
                        </div>
                        <div className="mt-4 grid gap-4 lg:grid-cols-3">
                          <label className="block text-sm font-medium text-slate-700 lg:col-span-3">
                            Visit summary
                            <textarea
                              className="mt-2 min-h-24 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-base"
                              onChange={(event) =>
                                updateNoteDraft(
                                  appointment.id,
                                  "summary",
                                  event.target.value
                                )
                              }
                              placeholder="What happened in the visit?"
                              value={noteDraft.summary}
                            />
                          </label>
                          <label className="block text-sm font-medium text-slate-700">
                            Takeaways
                            <textarea
                              className="mt-2 min-h-32 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-base"
                              onChange={(event) =>
                                updateNoteDraft(
                                  appointment.id,
                                  "takeaways",
                                  event.target.value
                                )
                              }
                              placeholder={
                                "One per line\nExample: Medication changed"
                              }
                              value={noteDraft.takeaways}
                            />
                          </label>
                          <label className="block text-sm font-medium text-slate-700">
                            Follow-ups
                            <textarea
                              className="mt-2 min-h-32 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-base"
                              onChange={(event) =>
                                updateNoteDraft(
                                  appointment.id,
                                  "followups",
                                  event.target.value
                                )
                              }
                              placeholder={"One per line\nExample: Schedule labs"}
                              value={noteDraft.followups}
                            />
                          </label>
                          <div className="flex items-end">
                            <button
                              className="w-full rounded-md bg-blue-700 px-4 py-2 font-semibold text-white disabled:bg-slate-400"
                              disabled={savingNoteForId === appointment.id}
                              type="submit"
                            >
                              {savingNoteForId === appointment.id
                                ? "Saving..."
                                : note
                                  ? "Save edited notes"
                                  : "Save notes"}
                            </button>
                          </div>
                        </div>
                      </form>
                    ))}
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
