"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";

import {
  addTimeToDueIntent,
  parseNaturalDueInput,
} from "../../../lib/family/errands/dueIntent";
import {
  sampleErrandEvents,
  sampleErrands,
  sampleFamilyMembers,
} from "../../../lib/family/errands/sampleData";
import type {
  Errand,
  ErrandAppointmentRelation,
  ErrandDueDateOption,
  ErrandDueIntent,
  ErrandEvent,
  FamilyAppointmentOption,
} from "../../../lib/family/types";
import {
  gentlePrimaryButtonClass,
  gentleSecondaryButtonClass,
  gentleSmallSecondaryButtonClass,
  panelClass,
} from "../../shared/uiStyles";
import { ErrandStatusPill } from "./ErrandStatusPill";

type ErrandDraft = {
  title: string;
  description: string;
  dueLabel: string;
  assignedMemberName: string;
};

const emptyDraft: ErrandDraft = {
  title: "",
  description: "",
  dueLabel: "",
  assignedMemberName: "",
};

function newId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function nowLabel() {
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date());
}

export function ErrandsWorkspace() {
  const [errands, setErrands] = useState<Errand[]>(sampleErrands);
  const [events, setEvents] = useState<ErrandEvent[]>(sampleErrandEvents);
  const [draft, setDraft] = useState<ErrandDraft>(emptyDraft);
  const [confirmedDueIntent, setConfirmedDueIntent] =
    useState<ErrandDueIntent>();
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimeChoices, setShowTimeChoices] = useState(false);
  const [customTime, setCustomTime] = useState("");
  const [customMeaning, setCustomMeaning] = useState("");
  const [showMeaningHelp, setShowMeaningHelp] = useState(false);
  const [learnedMeaningMessage, setLearnedMeaningMessage] = useState("");
  const [appointments, setAppointments] = useState<FamilyAppointmentOption[]>(
    [],
  );
  const [appointmentsLoading, setAppointmentsLoading] = useState(false);
  const [appointmentsError, setAppointmentsError] = useState("");
  const [selectedErrandId, setSelectedErrandId] = useState(sampleErrands[0]?.id);
  const dueInputRef = useRef<HTMLInputElement>(null);

  const selectedErrand = errands.find((errand) => errand.id === selectedErrandId);

  const dueInterpretation = useMemo(
    () => parseNaturalDueInput(draft.dueLabel),
    [draft.dueLabel],
  );
  const appointmentSearchText =
    dueInterpretation.kind === "contextual"
      ? dueInterpretation.anchorSearchText ?? ""
      : dueInterpretation.kind === "appointment_candidate"
      ? dueInterpretation.anchorSearchText ?? ""
      : "";

  const activeDueIntent =
    confirmedDueIntent?.sourceText === draft.dueLabel.trim()
      ? confirmedDueIntent
      : dueInterpretation;

  const selectedEvents = useMemo(
    () => events.filter((event) => event.errandId === selectedErrandId),
    [events, selectedErrandId],
  );

  const availableErrands = errands.filter(
    (errand) => errand.status === "available",
  );
  const assignedErrands = errands.filter(
    (errand) => errand.status === "assigned",
  );
  const completedErrands = errands.filter(
    (errand) => errand.status === "completed",
  );
  const attentionErrands = errands.filter(
    (errand) =>
      errand.status === "unable_to_complete" || errandIsPastDue(errand),
  );

  useEffect(() => {
    if (
      dueInterpretation.kind !== "contextual" &&
      dueInterpretation.kind !== "appointment_candidate"
    ) {
      return;
    }

    let isActive = true;

    async function loadAppointments() {
      await Promise.resolve();

      if (!isActive) {
        return;
      }

      setAppointmentsLoading(true);
      setAppointmentsError("");

      try {
        const query = appointmentSearchText
          ? `?q=${encodeURIComponent(appointmentSearchText)}`
          : "";
        const response = await fetch(`/api/family/appointments${query}`);
        const body = (await response.json()) as {
          appointments?: FamilyAppointmentOption[];
          error?: string;
        };

        if (!response.ok) {
          throw new Error(body.error || "Unable to load appointments.");
        }

        if (isActive) {
          setAppointments(body.appointments ?? []);
        }
      } catch (error: unknown) {
        if (isActive) {
          setAppointmentsError(
            error instanceof Error
              ? error.message
              : "Unable to load appointments.",
          );
        }
      } finally {
        if (isActive) {
          setAppointmentsLoading(false);
        }
      }
    }

    const timeoutId = window.setTimeout(() => {
      void loadAppointments();
    }, 600);

    return () => {
      isActive = false;
      window.clearTimeout(timeoutId);
    };
  }, [appointmentSearchText, dueInterpretation.kind]);

  function addEvent(event: Omit<ErrandEvent, "id" | "createdLabel">) {
    setEvents((currentEvents) => [
      {
        ...event,
        id: newId("event"),
        createdLabel: `Today, ${nowLabel()}`,
      },
      ...currentEvents,
    ]);
  }

  function handleCreateErrand(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const title = draft.title.trim();
    if (!title) {
      return;
    }

    const assignedMemberName = draft.assignedMemberName || undefined;
    const nextErrand: Errand = {
      id: newId("errand"),
      careVipName: "Mom",
      title,
      description: draft.description.trim() || "No extra details yet.",
      status: assignedMemberName ? "assigned" : "available",
      assignedMemberName,
      dueLabel:
        activeDueIntent.kind === "none"
          ? undefined
          : activeDueIntent.displayLabel,
      dueIntent: activeDueIntent.kind === "none" ? undefined : activeDueIntent,
    };

    setErrands((currentErrands) => [nextErrand, ...currentErrands]);
    setSelectedErrandId(nextErrand.id);
    setDraft(emptyDraft);
    setConfirmedDueIntent(undefined);
    setShowDatePicker(false);
    setShowTimeChoices(false);
    setCustomTime("");
    addEvent({
      errandId: nextErrand.id,
      type: "created",
      actorName: "Care Coordinator",
      detail: `Created errand: ${nextErrand.title}`,
    });

    if (assignedMemberName) {
      addEvent({
        errandId: nextErrand.id,
        type: "assigned",
        actorName: "Care Coordinator",
        detail: `Assigned to ${assignedMemberName}`,
      });
    }
  }

  function updateErrand(
    errandId: string,
    updater: (errand: Errand) => Errand,
  ) {
    setErrands((currentErrands) =>
      currentErrands.map((errand) =>
        errand.id === errandId ? updater(errand) : errand,
      ),
    );
  }

  function assignErrand(errand: Errand, memberName: string) {
    updateErrand(errand.id, (currentErrand) => ({
      ...currentErrand,
      assignedMemberName: memberName,
      status: currentErrand.status === "completed" ? "completed" : "assigned",
    }));
    addEvent({
      errandId: errand.id,
      type: "assigned",
      actorName: "Care Coordinator",
      detail: `Assigned to ${memberName}`,
    });
  }

  function acceptErrand(errand: Errand) {
    const actorName = errand.assignedMemberName ?? "Care team member";
    updateErrand(errand.id, (currentErrand) => ({
      ...currentErrand,
      status: "assigned",
      assignedMemberName: currentErrand.assignedMemberName ?? actorName,
    }));
    addEvent({
      errandId: errand.id,
      type: "assigned",
      actorName,
      detail: "Accepted ownership",
    });
  }

  function completeErrand(errand: Errand) {
    updateErrand(errand.id, (currentErrand) => ({
      ...currentErrand,
      status: "completed",
    }));
    addEvent({
      errandId: errand.id,
      type: "completed",
      actorName: errand.assignedMemberName ?? "Care team member",
      detail: "Marked complete",
    });
  }

  function unableToCompleteErrand(errand: Errand) {
    updateErrand(errand.id, (currentErrand) => ({
      ...currentErrand,
      status: "unable_to_complete",
    }));
    addEvent({
      errandId: errand.id,
      type: "unable_to_complete",
      actorName: errand.assignedMemberName ?? "Care team member",
      detail: "Unable to complete; needs attention",
    });
  }

  function releaseErrand(errand: Errand) {
    updateErrand(errand.id, (currentErrand) => ({
      ...currentErrand,
      assignedMemberName: undefined,
      status: "available",
    }));
    addEvent({
      errandId: errand.id,
      type: "released",
      actorName: "Care Coordinator",
      detail: "Released to the Care Family",
    });
  }

  return (
    <div className="grid gap-5">
      <section className="grid gap-3 sm:grid-cols-3">
        <Metric label="Available" value={String(availableErrands.length)} />
        <Metric label="Assigned" value={String(assignedErrands.length)} />
        <Metric label="Completed" value={String(completedErrands.length)} />
        <Metric label="Needs attention" value={String(attentionErrands.length)} />
      </section>

      <section className="grid gap-4 lg:grid-cols-[1fr_1.35fr]">
        <form className={panelClass} onSubmit={handleCreateErrand}>
          <h2 className="text-xl font-semibold text-blue-950">New errand</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Errands are the things to do: concrete, home-based responsibilities
            that need a clear owner.
          </p>
          <label className="mt-4 block text-sm font-semibold text-slate-700">
            What needs to happen?
            <input
              className="mt-2 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-base"
              onChange={(event) =>
                setDraft((currentDraft) => ({
                  ...currentDraft,
                  title: event.target.value,
                }))
              }
              placeholder="Pick up prescriptions"
              value={draft.title}
            />
          </label>
          <label className="mt-4 block text-sm font-semibold text-slate-700">
            Details
            <textarea
              className="mt-2 min-h-24 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-base"
              onChange={(event) =>
                setDraft((currentDraft) => ({
                  ...currentDraft,
                  description: event.target.value,
                }))
              }
              placeholder="Add timing, location, or follow-through notes."
              value={draft.description}
            />
          </label>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-semibold text-slate-700">
                Due
                <input
                  className="mt-2 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-base"
                  onChange={(event) => {
                    setDraft((currentDraft) => ({
                      ...currentDraft,
                      dueLabel: event.target.value,
                    }));
                    setConfirmedDueIntent(undefined);
                  }}
                  placeholder="In 3 days, June 15 5pm, before appointment"
                  ref={dueInputRef}
                  value={draft.dueLabel}
                />
              </label>
              <p className="mt-2 text-xs leading-5 text-slate-500">
                Examples: Tomorrow, in 3 days, June 15 5pm, before Dr. Smith.
              </p>
            </div>
            <label className="block text-sm font-semibold text-slate-700">
              Offer to
              <select
                className="mt-2 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-base"
                onChange={(event) =>
                  setDraft((currentDraft) => ({
                    ...currentDraft,
                    assignedMemberName: event.target.value,
                  }))
                }
                value={draft.assignedMemberName}
              >
                <option value="">No one yet</option>
                {sampleFamilyMembers.map((member) => (
                  <option key={member.id} value={member.displayName}>
                    {member.displayName}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <DueIntentClarifier
            customTime={customTime}
            customMeaning={customMeaning}
            appointments={appointments}
            appointmentsError={appointmentsError}
            appointmentsLoading={appointmentsLoading}
            dueIntent={activeDueIntent}
            isConfirmed={
              Boolean(confirmedDueIntent) &&
              confirmedDueIntent?.sourceText === draft.dueLabel.trim()
            }
            onChange={() => {
              setConfirmedDueIntent(undefined);
              window.requestAnimationFrame(() => {
                dueInputRef.current?.focus();
                dueInputRef.current?.select();
              });
            }}
            onConfirm={(intent) => setConfirmedDueIntent(intent)}
            onCustomTimeChange={setCustomTime}
            onCustomMeaningChange={setCustomMeaning}
            onChooseDueOption={(intent) => {
              const confirmedIntent = {
                ...intent,
                sourceText: intent.displayLabel,
              };
              setDraft((currentDraft) => ({
                ...currentDraft,
                dueLabel: intent.displayLabel,
              }));
              setConfirmedDueIntent(confirmedIntent);
            }}
            onChooseMeaning={(meaning) => {
              const nextIntent = parseNaturalDueInput(meaning.dueText);
              const previousPhrase = draft.dueLabel.trim();
              setDraft((currentDraft) => ({
                ...currentDraft,
                dueLabel: meaning.label,
              }));
              setConfirmedDueIntent(
                confirmedMeaningIntent(meaning.label, nextIntent),
              );
              setShowMeaningHelp(false);
              setLearnedMeaningMessage(
                `Saved this household meaning: "${previousPhrase}" means "${meaning.label}".`,
              );
            }}
            onDatePick={(dateValue) => {
              setDraft((currentDraft) => ({
                ...currentDraft,
                dueLabel: dateValue,
              }));
              setConfirmedDueIntent(parseNaturalDueInput(dateValue));
            }}
            onPickTime={(timeLabel) => {
              const nextIntent = addTimeToDueIntent(activeDueIntent, timeLabel);
              setConfirmedDueIntent(nextIntent);
            }}
            onSelectAppointment={(appointmentId) => {
              const appointment = appointments.find(
                (appointmentOption) => appointmentOption.id === appointmentId,
              );

              if (!appointment) {
                return;
              }

              if (activeDueIntent.kind === "contextual") {
                setConfirmedDueIntent({
                  ...activeDueIntent,
                  anchorId: appointment.id,
                  anchorLabel: appointment.title,
                  anchorStartsAt: appointment.startsAt,
                  displayLabel: `${appointmentRelationLabel(
                    activeDueIntent.relation,
                  )} ${appointment.label}`,
                });
              }

              if (activeDueIntent.kind === "appointment_candidate") {
                setConfirmedDueIntent({
                  ...activeDueIntent,
                  anchorId: appointment.id,
                  anchorLabel: appointment.label,
                  anchorStartsAt: appointment.startsAt,
                  displayLabel: appointment.label,
                });
              }
            }}
            onChooseAppointmentRelation={(relation) => {
              if (
                activeDueIntent.kind !== "appointment_candidate" ||
                !activeDueIntent.anchorId ||
                !activeDueIntent.anchorLabel
              ) {
                return;
              }

              const nextIntent: ErrandDueIntent = {
                kind: "contextual",
                sourceText: appointmentRelationDisplay(
                  relation,
                  activeDueIntent.anchorLabel,
                ),
                relation,
                anchorId: activeDueIntent.anchorId,
                anchorLabel: activeDueIntent.anchorLabel,
                anchorSearchText: activeDueIntent.anchorSearchText,
                anchorStartsAt: activeDueIntent.anchorStartsAt,
                displayLabel: appointmentRelationDisplay(
                  relation,
                  activeDueIntent.anchorLabel,
                ),
                confidence: "medium",
              };

              setDraft((currentDraft) => ({
                ...currentDraft,
                dueLabel: nextIntent.displayLabel,
              }));
              setConfirmedDueIntent(nextIntent);
            }}
            onUseCustomTime={() => {
              if (!customTime.trim()) {
                return;
              }
              const nextIntent = addTimeToDueIntent(
                activeDueIntent,
                customTime.trim(),
              );
              setConfirmedDueIntent(nextIntent);
            }}
            onUseCustomMeaning={() => {
              const trimmedMeaning = customMeaning.trim();

              if (!trimmedMeaning) {
                return;
              }

              const nextIntent = parseNaturalDueInput(trimmedMeaning);
              const previousPhrase = draft.dueLabel.trim();
              setDraft((currentDraft) => ({
                ...currentDraft,
                dueLabel: trimmedMeaning,
              }));
              setConfirmedDueIntent(
                confirmedMeaningIntent(trimmedMeaning, nextIntent),
              );
              setShowMeaningHelp(false);
              setCustomMeaning("");
              setLearnedMeaningMessage(
                `Saved this household meaning: "${previousPhrase}" means "${trimmedMeaning}".`,
              );
            }}
            learnedMeaningMessage={learnedMeaningMessage}
            setShowMeaningHelp={setShowMeaningHelp}
            setShowDatePicker={setShowDatePicker}
            setShowTimeChoices={setShowTimeChoices}
            showMeaningHelp={showMeaningHelp}
            showDatePicker={showDatePicker}
            showTimeChoices={showTimeChoices}
          />
          <button className={`mt-5 ${gentlePrimaryButtonClass}`} type="submit">
            Create errand
          </button>
        </form>

        <div className="grid gap-3">
          {errands.map((errand) => {
            const isPastDue = errandIsPastDue(errand);

            return (
              <article
                key={errand.id}
                className={`${panelClass} ${
                  errand.id === selectedErrandId ? "ring-2 ring-blue-200" : ""
                }`}
              >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <button
                  className="text-left"
                  onClick={() => setSelectedErrandId(errand.id)}
                  type="button"
                >
                  <p className="text-sm font-semibold text-blue-700">
                    {errand.careVipName}
                  </p>
                  <h2 className="mt-1 text-lg font-semibold text-blue-950">
                    {errand.title}
                  </h2>
                  <p className="mt-2 text-sm leading-6 text-slate-600">
                    {errand.description}
                  </p>
                </button>
                <ErrandStatusPill isPastDue={isPastDue} status={errand.status} />
              </div>

              <dl className="mt-4 grid gap-3 border-t border-blue-50 pt-4 text-sm sm:grid-cols-2">
                <div>
                  <dt className="font-semibold text-slate-500">Ownership</dt>
                  <dd className="mt-1 text-slate-800">
                    {ownershipLabel(errand)}
                  </dd>
                </div>
                <div>
                  <dt className="font-semibold text-slate-500">Due</dt>
                  <dd className="mt-1 text-slate-800">
                    {errand.dueLabel ?? "Open"}
                    {isPastDue ? " · Past Due" : ""}
                  </dd>
                </div>
              </dl>
              {errand.status === "unable_to_complete" ? (
                <p className="mt-3 rounded-md border border-rose-100 bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-800">
                  Needs reassignment
                </p>
              ) : null}

              <div className="mt-4 flex flex-wrap gap-2">
                {sampleFamilyMembers.map((member) => (
                  <button
                    className={gentleSmallSecondaryButtonClass}
                    key={member.id}
                    onClick={() => assignErrand(errand, member.displayName)}
                    type="button"
                  >
                    Assign {member.displayName}
                  </button>
                ))}
                <button
                  className={gentleSecondaryButtonClass}
                  disabled={errand.status === "completed"}
                  onClick={() => acceptErrand(errand)}
                  type="button"
                >
                  Accept ownership
                </button>
                <button
                  className={gentlePrimaryButtonClass}
                  disabled={errand.status === "completed"}
                  onClick={() => completeErrand(errand)}
                  type="button"
                >
                  Complete
                </button>
                <button
                  className={gentleSecondaryButtonClass}
                  disabled={errand.status === "completed"}
                  onClick={() => unableToCompleteErrand(errand)}
                  type="button"
                >
                  I can&apos;t do it
                </button>
                <button
                  className={gentleSecondaryButtonClass}
                  disabled={errand.status === "completed"}
                  onClick={() => releaseErrand(errand)}
                  type="button"
                >
                  Release
                </button>
              </div>
              </article>
            );
          })}
        </div>
      </section>

      <section className={panelClass}>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-xl font-semibold text-blue-950">Event log</h2>
            <p className="mt-2 text-sm text-slate-600">
              {selectedErrand
                ? `History for ${selectedErrand.title}`
                : "Select an errand to inspect its history."}
            </p>
          </div>
          {selectedErrand ? (
            <ErrandStatusPill
              isPastDue={errandIsPastDue(selectedErrand)}
              status={selectedErrand.status}
            />
          ) : null}
        </div>
        <ol className="mt-5 grid gap-3">
          {selectedEvents.map((event) => (
            <li
              className="rounded-md border border-blue-50 bg-blue-50/50 p-3"
              key={event.id}
            >
              <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                <p className="font-semibold text-blue-950">{event.detail}</p>
                <p className="text-sm text-slate-500">{event.createdLabel}</p>
              </div>
              <p className="mt-1 text-sm text-slate-600">
                {event.actorName} · {event.type}
              </p>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className={panelClass}>
      <p className="text-sm font-semibold text-slate-500">{label}</p>
      <p className="mt-2 text-3xl font-semibold text-blue-950">{value}</p>
    </div>
  );
}

function ownershipLabel(errand: Errand) {
  if (errand.status === "available") {
    return "Available · Needs an owner";
  }

  if (errand.status === "assigned") {
    return `Assigned to ${errand.assignedMemberName ?? "Care Family member"}`;
  }

  if (errand.status === "completed") {
    return errand.assignedMemberName
      ? `Completed by ${errand.assignedMemberName}`
      : "Completed";
  }

  return "Unable to Complete · Needs attention";
}

function errandIsPastDue(errand: Errand) {
  if (errand.status === "completed") {
    return false;
  }

  const boundary = errandPastDueBoundary(errand);

  if (!boundary) {
    return false;
  }

  return boundary.getTime() < Date.now();
}

function errandPastDueBoundary(errand: Errand) {
  const dueIntent = errand.dueIntent;

  if (dueIntent?.kind === "date") {
    return endOfLocalDay(new Date(`${dueIntent.dateIso}T00:00:00`));
  }

  if (dueIntent?.kind === "date_time") {
    const parsed = new Date(`${dueIntent.dateIso} ${dueIntent.timeLabel}`);
    return Number.isNaN(parsed.getTime()) ? undefined : parsed;
  }

  if (dueIntent?.kind === "contextual" && dueIntent.anchorStartsAt) {
    const anchorStart = new Date(dueIntent.anchorStartsAt);

    if (Number.isNaN(anchorStart.getTime())) {
      return undefined;
    }

    if (dueIntent.relation === "before") {
      return anchorStart;
    }

    if (dueIntent.relation === "during") {
      return addHours(anchorStart, 2);
    }

    if (dueIntent.relation === "after") {
      return addHours(anchorStart, 8);
    }

    if (dueIntent.relation === "on_day") {
      return endOfLocalDay(anchorStart);
    }
  }

  if (errand.dueLabel === "Yesterday") {
    return new Date(0);
  }

  return undefined;
}

function addHours(date: Date, hours: number) {
  return new Date(date.getTime() + hours * 60 * 60 * 1000);
}

function endOfLocalDay(date: Date) {
  const endOfDay = new Date(date);
  endOfDay.setHours(23, 59, 59, 999);
  return endOfDay;
}

type DueIntentClarifierProps = {
  customTime: string;
  customMeaning: string;
  appointments: FamilyAppointmentOption[];
  appointmentsError: string;
  appointmentsLoading: boolean;
  dueIntent: ErrandDueIntent;
  isConfirmed: boolean;
  learnedMeaningMessage: string;
  onChange: () => void;
  onChooseDueOption: (intent: ErrandDueDateOption) => void;
  onChooseMeaning: (meaning: SuggestedMeaning) => void;
  onChooseAppointmentRelation: (relation: ErrandAppointmentRelation) => void;
  onConfirm: (intent: ErrandDueIntent) => void;
  onCustomMeaningChange: (value: string) => void;
  onCustomTimeChange: (value: string) => void;
  onDatePick: (dateValue: string) => void;
  onPickTime: (timeLabel: string) => void;
  onSelectAppointment: (appointmentId: string) => void;
  onUseCustomMeaning: () => void;
  onUseCustomTime: () => void;
  setShowMeaningHelp: (showMeaningHelp: boolean) => void;
  setShowDatePicker: (showDatePicker: boolean) => void;
  setShowTimeChoices: (showTimeChoices: boolean) => void;
  showMeaningHelp: boolean;
  showDatePicker: boolean;
  showTimeChoices: boolean;
};

type SuggestedMeaning = {
  label: string;
  dueText: string;
};

const appointmentRelationOptions: Array<{
  relation: ErrandAppointmentRelation;
  label: string;
}> = [
  { relation: "before", label: "Before appointment" },
  { relation: "during", label: "During appointment" },
  { relation: "after", label: "After appointment" },
  { relation: "on_day", label: "On appointment day" },
  { relation: "linked", label: "Just link to appointment" },
];

function DueIntentClarifier({
  customTime,
  customMeaning,
  appointments,
  appointmentsError,
  appointmentsLoading,
  dueIntent,
  isConfirmed,
  learnedMeaningMessage,
  onChange,
  onChooseDueOption,
  onChooseMeaning,
  onChooseAppointmentRelation,
  onConfirm,
  onCustomMeaningChange,
  onCustomTimeChange,
  onDatePick,
  onPickTime,
  onSelectAppointment,
  onUseCustomMeaning,
  onUseCustomTime,
  setShowMeaningHelp,
  setShowDatePicker,
  setShowTimeChoices,
  showMeaningHelp,
  showDatePicker,
  showTimeChoices,
}: DueIntentClarifierProps) {
  if (dueIntent.kind === "none") {
    return null;
  }

  const canAddTime = dueIntent.kind === "date" || dueIntent.kind === "date_time";
  const datePickerValue =
    dueIntent.kind === "date" || dueIntent.kind === "date_time"
      ? dueIntent.dateIso
      : "";
  const shouldShowDisplayLabel =
    (dueIntent.kind !== "contextual" &&
      dueIntent.kind !== "appointment_candidate" &&
      dueIntent.kind !== "ambiguous_date") ||
    (dueIntent.kind === "contextual" && Boolean(dueIntent.anchorId)) ||
    (dueIntent.kind === "appointment_candidate" && Boolean(dueIntent.anchorId));
  const shouldShowHelperText =
    dueIntent.kind !== "contextual" &&
    dueIntent.kind !== "appointment_candidate" &&
    dueIntent.kind !== "ambiguous_date";

  return (
    <div className="mt-4 rounded-lg border border-blue-100 bg-blue-50/70 p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-blue-950">
            {dueIntent.kind === "contextual" && !dueIntent.anchorId
              ? "Which appointment?"
              : dueIntent.kind === "appointment_candidate" && !dueIntent.anchorId
                ? "I found these appointments:"
              : dueIntent.kind === "appointment_candidate" && dueIntent.anchorId
                ? "How should this errand relate to the appointment?"
              : dueIntent.kind === "ambiguous_date"
                ? "Which date?"
              : dueIntent.kind === "unparsed"
              ? "I don't recognize this yet."
              : "I think you mean:"}
          </p>
          {shouldShowDisplayLabel ? (
            <p className="mt-1 text-lg font-semibold text-blue-900">
              {dueIntent.displayLabel}
            </p>
          ) : null}
          {shouldShowHelperText ? (
            <p className="mt-2 text-xs leading-5 text-slate-600">
              {dueIntent.kind === "unparsed"
                ? "You can keep it as written or help CarePland learn what this means."
                : "CarePland can store both the natural phrase and the interpreted date."}
            </p>
          ) : null}
        </div>
        {isConfirmed ? (
          <span className="inline-flex rounded-full border border-emerald-100 bg-emerald-50 px-3 py-1 text-sm font-semibold text-emerald-800">
            Confirmed
          </span>
        ) : null}
      </div>

      {dueIntent.kind === "contextual" ||
      (dueIntent.kind === "appointment_candidate" && !dueIntent.anchorId) ? (
        <div className="mt-3">
          <label className="block">
            <span className="sr-only">Appointment</span>
            <select
              className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-base font-semibold text-slate-800"
              disabled={appointmentsLoading || appointments.length === 0}
              onChange={(event) => onSelectAppointment(event.target.value)}
              value={dueIntent.anchorId ?? ""}
            >
              <option value="">
                {appointmentsLoading
                  ? "Loading appointments..."
                  : "Choose an appointment"}
              </option>
              {appointments.map((appointment) => (
                <option key={appointment.id} value={appointment.id}>
                  {appointment.label}
                </option>
              ))}
            </select>
          </label>
          {appointmentsError ? (
            <p className="mt-2 text-xs leading-5 text-rose-700">
              {appointmentsError}
            </p>
          ) : null}
          {!appointmentsLoading &&
          !appointmentsError &&
          appointments.length === 0 ? (
            <p className="mt-2 text-xs leading-5 text-slate-500">
              No shared appointments were found yet. The phrase can still be
              saved as contextual intent.
            </p>
          ) : null}
        </div>
      ) : null}

      {dueIntent.kind === "appointment_candidate" && dueIntent.anchorId ? (
        <div className="mt-3 grid gap-2">
          {appointmentRelationOptions.map((option) => (
            <button
              className="rounded-md border border-blue-100 bg-white px-3 py-2 text-left text-sm font-semibold text-blue-900 shadow-sm transition hover:border-blue-200 hover:bg-blue-50"
              key={option.relation}
              onClick={() => onChooseAppointmentRelation(option.relation)}
              type="button"
            >
              {option.label}
            </button>
          ))}
        </div>
      ) : null}

      {dueIntent.kind === "ambiguous_date" ? (
        <div className="mt-3 grid gap-2">
          {dueIntent.options.map((option) => (
            <button
              className="rounded-md border border-blue-100 bg-white px-3 py-2 text-left text-sm font-semibold text-blue-900 shadow-sm transition hover:border-blue-200 hover:bg-blue-50"
              key={`${option.kind}-${option.dateIso}-${option.displayLabel}`}
              onClick={() => onChooseDueOption(option)}
              type="button"
            >
              {option.displayLabel}
            </button>
          ))}
        </div>
      ) : null}

      <div className="mt-4 flex flex-wrap gap-2">
        {!isConfirmed &&
        dueIntent.kind !== "ambiguous_date" &&
        dueIntent.kind !== "appointment_candidate" ? (
          <button
            className={gentlePrimaryButtonClass}
            onClick={() => onConfirm(dueIntent)}
            type="button"
          >
            Confirm
          </button>
        ) : null}
        <button className={gentleSecondaryButtonClass} onClick={onChange} type="button">
          Change
        </button>
        <button
          className={gentleSecondaryButtonClass}
          onClick={() => setShowDatePicker(!showDatePicker)}
          type="button"
        >
          Date picker
        </button>
        {canAddTime ? (
          <button
            className={gentleSecondaryButtonClass}
            onClick={() => setShowTimeChoices(!showTimeChoices)}
            type="button"
          >
            Add time
          </button>
        ) : null}
      </div>

      {showDatePicker ? (
        <label className="mt-4 block text-sm font-semibold text-slate-700">
          Pick an exact date
          <input
            className="mt-2 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-base"
            onChange={(event) => onDatePick(event.target.value)}
            type="date"
            value={datePickerValue}
          />
        </label>
      ) : null}

      {dueIntent.kind === "unparsed" ? (
        <div className="mt-4">
          <button
            className="w-full rounded-full bg-blue-900 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-950"
            onClick={() => setShowMeaningHelp(!showMeaningHelp)}
            type="button"
          >
            Help CarePland understand this
          </button>
          {learnedMeaningMessage ? (
            <p className="mt-2 text-xs leading-5 text-emerald-800">
              {learnedMeaningMessage}
            </p>
          ) : null}
        </div>
      ) : null}

      {dueIntent.kind === "unparsed" && showMeaningHelp ? (
        <div className="mt-4 rounded-md border border-blue-100 bg-white/80 p-3">
          <p className="text-sm font-semibold text-blue-950">
            What did you mean?
          </p>
          <div className="mt-3 grid gap-2">
            {suggestMeanings(dueIntent.sourceText).map((meaning) => (
              <button
                className="rounded-md border border-blue-100 bg-white px-3 py-2 text-left text-sm font-semibold text-blue-900 shadow-sm transition hover:border-blue-200 hover:bg-blue-50"
                key={meaning.label}
                onClick={() => onChooseMeaning(meaning)}
                type="button"
              >
                {meaning.label}
              </button>
            ))}
          </div>
          <div className="mt-3 flex flex-col gap-2 sm:flex-row">
            <input
              className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-base"
              onChange={(event) => onCustomMeaningChange(event.target.value)}
              placeholder="Something else"
              value={customMeaning}
            />
            <button
              className={gentleSecondaryButtonClass}
              onClick={onUseCustomMeaning}
              type="button"
            >
              Save
            </button>
          </div>
        </div>
      ) : null}

      {showTimeChoices && canAddTime ? (
        <div className="mt-4 rounded-md border border-blue-100 bg-white/80 p-3">
          <p className="text-sm font-semibold text-slate-700">Time?</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {["Noon", "2 PM", "4 PM"].map((timeLabel) => (
              <button
                className={gentleSmallSecondaryButtonClass}
                key={timeLabel}
                onClick={() => onPickTime(timeLabel)}
                type="button"
              >
                {timeLabel}
              </button>
            ))}
          </div>
          <div className="mt-3 flex flex-col gap-2 sm:flex-row">
            <input
              className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-base"
              onChange={(event) => onCustomTimeChange(event.target.value)}
              placeholder="Custom time"
              value={customTime}
            />
            <button
              className={gentleSecondaryButtonClass}
              onClick={onUseCustomTime}
              type="button"
            >
              Use custom
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function appointmentRelationLabel(relation: ErrandAppointmentRelation) {
  switch (relation) {
    case "before":
      return "Before";
    case "during":
      return "During";
    case "after":
      return "After";
    case "on_day":
      return "On appointment day:";
    case "linked":
      return "Linked to";
  }
}

function appointmentRelationDisplay(
  relation: ErrandAppointmentRelation,
  appointmentLabel: string,
) {
  if (relation === "on_day") {
    return `On appointment day: ${appointmentLabel}`;
  }

  return `${appointmentRelationLabel(relation)} ${appointmentLabel}`;
}

function confirmedMeaningIntent(
  label: string,
  intent: ErrandDueIntent,
): ErrandDueIntent {
  if (intent.kind === "none") {
    return {
      kind: "unparsed",
      sourceText: label,
      displayLabel: label,
      confidence: "low",
    };
  }

  return {
    ...intent,
    sourceText: label,
  };
}

function suggestMeanings(sourceText: string): SuggestedMeaning[] {
  const normalized = sourceText.toLowerCase();

  if (/\b(vet|vetr|veterinarian)\b/.test(normalized)) {
    return [
      { label: "Before vet appointment", dueText: "before vet" },
      { label: "Before Dixie's next vet visit", dueText: "before vet" },
      {
        label: "Before any veterinarian appointment",
        dueText: "before veterinarian",
      },
    ];
  }

  if (/\b(appt|appointment|dr|doctor)\b/.test(normalized)) {
    return [
      { label: "Before appointment", dueText: "before appointment" },
      { label: "Before next doctor appointment", dueText: "before doctor" },
      { label: "After appointment", dueText: "after appointment" },
    ];
  }

  return [
    { label: "Before appointment", dueText: "before appointment" },
    { label: "Soon, but no exact date", dueText: sourceText },
    { label: "Keep as household shorthand", dueText: sourceText },
  ];
}
