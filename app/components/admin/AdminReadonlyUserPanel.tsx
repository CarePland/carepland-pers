"use client";

import { RefObject } from "react";
import {
  AdminContactDetails,
  adminContactDetailsFromValue,
} from "../../lib/adminContactDetails";
import { AdminContactDetailsPanel } from "./AdminContactDetailsPanel";

type AdminSensitiveResourceType =
  | "appointment_details"
  | "appointment_note"
  | "careprep_guidance"
  | "profile_contact";

type AdminRevealedSensitiveData = Record<string, unknown> & {
  resource_type?: AdminSensitiveResourceType;
};

type AdminReadonlyCareSubject = {
  display_name: string;
  id: string;
};

type AdminReadonlyProfile = {
  id: string;
  display_name: string | null;
  masked_email: string | null;
  onboarding_completed_at: string | null;
  beta_terms_acknowledged_at: string | null;
  beta_privacy_acknowledged_at: string | null;
  beta_disclaimer_acknowledged_at: string | null;
  requires_email_update: boolean;
  is_admin: boolean;
  is_test_user: boolean;
  has_contact_details: boolean;
};

type AdminReadonlyCounts = {
  appointment_count: number;
  note_count: number;
  careprep_count: number;
};

type AdminReadonlyEntitlement = {
  care_circle_id: string;
  plan_id: string | null;
  plan_name: string | null;
};

type AdminReadonlyAppointment = {
  id: string;
  care_subject_id: string | null;
  current_note_id: string | null;
  current_guidance_id: string | null;
  current_guidance_review_status: string | null;
  created_at: string | null;
  title_preview: string | null;
  starts_on: string | null;
  status: string;
  updated_at: string | null;
  is_sample_data: boolean;
  has_starts_at: boolean;
  has_provider_name: boolean;
  has_provider_organization: boolean;
  has_location_name: boolean;
  provider_name_preview: string | null;
  provider_organization_preview: string | null;
  location_name_preview: string | null;
  has_reason: boolean;
  has_location_address: boolean;
  has_location_phone: boolean;
  has_note: boolean;
  has_careprep: boolean;
};

type AdminReadonlySnapshot = {
  appointments: AdminReadonlyAppointment[];
  care_subjects: AdminReadonlyCareSubject[];
  counts: AdminReadonlyCounts;
  entitlements: AdminReadonlyEntitlement[];
  profile: AdminReadonlyProfile;
};

type AdminReadonlyUserPanelProps = {
  formatAdminDate: (value: string | null) => string;
  formatDate: (value: string | null) => string;
  formatDateOnly: (value: string | null) => string;
  onClose: () => void;
  onReveal: (args: {
    reason?: string;
    resourceId?: string | null;
    resourceType: AdminSensitiveResourceType;
    targetUserId: string;
  }) => Promise<boolean>;
  onSaveContactDetails: (
    contactDetails: AdminContactDetails,
    reason: string
  ) => Promise<boolean>;
  panelRef: RefObject<HTMLElement | null>;
  revealedData: Record<string, AdminRevealedSensitiveData>;
  revealingKey: string | null;
  savingContactDetails: boolean;
  shortId: (value: string | null) => string;
  snapshot: AdminReadonlySnapshot;
};

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

function textValue(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function adminSensitiveKey(
  resourceType: AdminSensitiveResourceType,
  resourceId: string | null = null
) {
  return `${resourceType}:${resourceId ?? "profile"}`;
}

function adminAppointmentPrivacyLabel(appointment: AdminReadonlyAppointment) {
  const hiddenItems = [
    "full title",
    appointment.has_starts_at ? "date/time" : "",
    appointment.has_provider_name ? "provider" : "",
    appointment.has_provider_organization ? "practice" : "",
    appointment.has_location_name ? "location" : "",
    appointment.has_reason ? "reason" : "",
    appointment.has_location_address ? "address" : "",
    appointment.has_location_phone ? "phone" : "",
  ].filter(Boolean);

  return hiddenItems.length > 0
    ? `Hidden: ${hiddenItems.join(", ")}`
    : "No hidden appointment details";
}

function careSubjectNameForId(
  subjects: AdminReadonlyCareSubject[],
  subjectId: string | null
) {
  if (!subjectId) {
    return "No Care VIP";
  }

  return (
    subjects.find((subject) => subject.id === subjectId)?.display_name ??
    `Care VIP ${subjectId.slice(0, 8)}`
  );
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

export function AdminReadonlyUserPanel({
  formatAdminDate,
  formatDate,
  formatDateOnly,
  onClose,
  onReveal,
  onSaveContactDetails,
  panelRef,
  revealedData,
  revealingKey,
  savingContactDetails,
  shortId,
  snapshot,
}: AdminReadonlyUserPanelProps) {
  const contactKey = adminSensitiveKey("profile_contact");

  return (
    <section
      className="mt-5 scroll-mt-24 rounded-md border border-blue-200 bg-blue-50 p-4"
      ref={panelRef}
      tabIndex={-1}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-blue-700">
            Read-only admin view
          </p>
          <h3 className="mt-1 text-xl font-semibold text-slate-950">
            Viewing {snapshot.profile.display_name || "User"}
          </h3>
          <p className="mt-1 max-w-3xl text-sm text-blue-950">
            Sensitive profile, appointment, Notes, and CarePrep details are
            hidden until revealed. Reveals are logged for audit.
          </p>
        </div>
        <button
          className="rounded-md border border-blue-300 bg-white px-4 py-2 font-semibold text-blue-800"
          onClick={onClose}
          type="button"
        >
          Exit view
        </button>
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
        <div className="rounded-md border border-blue-100 bg-white p-3">
          <h4 className="font-semibold text-slate-900">Account</h4>
          <dl className="mt-3 space-y-2 text-sm">
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Email
              </dt>
              <dd className="text-slate-800">
                {snapshot.profile.masked_email || "Not set"}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Onboarding
              </dt>
              <dd className="text-slate-800">
                {snapshot.profile.onboarding_completed_at
                  ? `Complete ${formatAdminDate(
                      snapshot.profile.onboarding_completed_at
                    )}`
                  : "Not complete"}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Early Access acknowledgements
              </dt>
              <dd className="text-slate-800">
                {snapshot.profile.beta_terms_acknowledged_at &&
                snapshot.profile.beta_privacy_acknowledged_at &&
                snapshot.profile.beta_disclaimer_acknowledged_at
                  ? "Complete"
                  : "Incomplete"}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Flags
              </dt>
              <dd className="mt-1 flex flex-wrap gap-1">
                {snapshot.profile.requires_email_update ? (
                  <span className="rounded-full bg-amber-100 px-2 py-1 text-xs font-semibold text-amber-800">
                    Needs email update
                  </span>
                ) : null}
                {snapshot.profile.is_test_user ? (
                  <span className="rounded-full bg-amber-100 px-2 py-1 text-xs font-semibold text-amber-800">
                    Test
                  </span>
                ) : null}
                {snapshot.profile.is_admin ? (
                  <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-700">
                    Admin
                  </span>
                ) : null}
              </dd>
            </div>
          </dl>
        </div>

        <div className="rounded-md border border-blue-100 bg-white p-3">
          <div className="grid gap-3 sm:grid-cols-3">
            {[
              ["Appointments", snapshot.counts.appointment_count],
              ["Notes", snapshot.counts.note_count],
              ["CarePrep", snapshot.counts.careprep_count],
            ].map(([label, value]) => (
              <div className="rounded-md bg-slate-50 p-3" key={label}>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  {label}
                </p>
                <p className="mt-1 text-2xl font-semibold text-slate-900">
                  {value}
                </p>
              </div>
            ))}
          </div>

          <div className="mt-4 flex flex-wrap gap-2 text-sm">
            {snapshot.entitlements.length > 0 ? (
              snapshot.entitlements.map((entitlement) => (
                <span
                  className="rounded-full bg-blue-100 px-3 py-1 font-semibold text-blue-800"
                  key={`${entitlement.care_circle_id}-${entitlement.plan_id}`}
                >
                  {entitlement.plan_name || entitlement.plan_id || "Plan unknown"}
                </span>
              ))
            ) : (
              <span className="rounded-full bg-slate-100 px-3 py-1 font-semibold text-slate-600">
                No active plan found
              </span>
            )}
            {snapshot.care_subjects.map((subject) => (
              <span
                className="rounded-full bg-slate-100 px-3 py-1 font-semibold text-slate-700"
                key={subject.id}
              >
                Care VIP: {subject.display_name}
              </span>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-4">
        <AdminContactDetailsPanel
          contactDetails={
            revealedData[contactKey]
              ? adminContactDetailsFromValue(revealedData[contactKey])
              : null
          }
          hasContactDetails={snapshot.profile.has_contact_details}
          key={JSON.stringify(revealedData[contactKey] ?? "hidden")}
          maskedEmail={snapshot.profile.masked_email}
          onReveal={(reason) =>
            onReveal({
              reason,
              resourceType: "profile_contact",
              targetUserId: snapshot.profile.id,
            })
          }
          onSave={onSaveContactDetails}
          revealing={revealingKey === contactKey}
          saving={savingContactDetails}
        />
      </div>

      <div className="mt-4 space-y-3">
        <h4 className="font-semibold text-slate-900">Appointment preview</h4>
        {snapshot.appointments.length === 0 ? (
          <p className="rounded-md border border-dashed border-blue-200 bg-white p-3 text-sm text-slate-600">
            No appointments found for this account.
          </p>
        ) : (
          snapshot.appointments.map((appointment) => {
            const detailKey = adminSensitiveKey(
              "appointment_details",
              appointment.id
            );
            const noteKey = appointment.current_note_id
              ? adminSensitiveKey("appointment_note", appointment.current_note_id)
              : "";
            const carePrepKey = appointment.current_guidance_id
              ? adminSensitiveKey(
                  "careprep_guidance",
                  appointment.current_guidance_id
                )
              : "";
            const appointmentDetails = revealedData[detailKey];
            const noteDetails = noteKey ? revealedData[noteKey] : null;
            const carePrepDetails = carePrepKey ? revealedData[carePrepKey] : null;

            return (
              <article
                className="rounded-md border border-blue-100 bg-white p-3"
                key={appointment.id}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h5 className="font-semibold text-slate-950">
                      {appointmentDetails
                        ? textValue(appointmentDetails.title) || "Appointment"
                        : appointment.title_preview || "Appointment"}
                    </h5>
                    <p className="text-sm text-slate-600">
                      {appointmentDetails &&
                      textValue(appointmentDetails.starts_at)
                        ? formatDate(textValue(appointmentDetails.starts_at))
                        : appointment.starts_on
                          ? `${formatDateOnly(appointment.starts_on)} · time hidden`
                          : "Date not set"}{" "}
                      · {appointment.status}
                    </p>
                    <p className="mt-1 text-sm text-slate-700">
                      {appointmentDetails
                        ? [
                            textValue(appointmentDetails.provider_name),
                            textValue(appointmentDetails.provider_organization),
                            textValue(appointmentDetails.location_name),
                          ]
                            .filter(Boolean)
                            .join(" · ") || "Provider/location not set"
                        : [
                            appointment.has_provider_name ||
                            appointment.has_provider_organization
                              ? [
                                  appointment.provider_name_preview,
                                  appointment.provider_organization_preview,
                                ]
                                  .filter(Boolean)
                                  .join(" · ") || "Provider hidden"
                              : "",
                            appointment.has_location_name
                              ? appointment.location_name_preview ||
                                "Location hidden"
                              : "",
                          ]
                            .filter(Boolean)
                            .join(" · ") || "Provider/location not set"}
                    </p>
                  </div>
                  <div className="text-right text-xs text-slate-500">
                    {appointment.is_sample_data ? (
                      <span className="mb-1 inline-flex rounded-full bg-amber-100 px-2 py-1 font-semibold text-amber-800">
                        Sample
                      </span>
                    ) : null}
                    <p>
                      <span className="font-semibold">Created:</span>{" "}
                      {formatAdminDate(appointment.created_at)}
                    </p>
                    <p>
                      <span className="font-semibold">Updated:</span>{" "}
                      {formatAdminDate(appointment.updated_at)}
                    </p>
                    <p>
                      <span className="font-semibold">Appt ID:</span>{" "}
                      {shortId(appointment.id)}
                    </p>
                    <p>
                      <span className="font-semibold">Care VIP:</span>{" "}
                      {careSubjectNameForId(
                        snapshot.care_subjects,
                        appointment.care_subject_id
                      )}
                    </p>
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap gap-2 text-xs">
                  <span className="rounded-full bg-slate-100 px-2 py-1 font-semibold text-slate-600">
                    {appointment.has_note ? "Has notes" : "No current note"}
                  </span>
                  <span className="rounded-full bg-slate-100 px-2 py-1 font-semibold text-slate-600">
                    {appointment.has_careprep
                      ? appointment.current_guidance_review_status === "draft"
                        ? "CarePrep draft"
                        : "Has CarePrep"
                      : "No CarePrep"}
                  </span>
                  {appointment.current_note_id ? (
                    <span className="rounded-full bg-slate-100 px-2 py-1 font-semibold text-slate-600">
                      Note ID {shortId(appointment.current_note_id)}
                    </span>
                  ) : null}
                  {appointment.current_guidance_id ? (
                    <span className="rounded-full bg-slate-100 px-2 py-1 font-semibold text-slate-600">
                      CarePrep ID {shortId(appointment.current_guidance_id)}
                    </span>
                  ) : null}
                </div>

                <div className="mt-3 grid gap-3 md:grid-cols-3">
                  <div className="rounded-md bg-slate-50 p-3 text-sm">
                    <p className="font-semibold text-slate-800">Details</p>
                    {appointmentDetails ? (
                      <div className="mt-2 space-y-1 text-slate-700">
                        {(
                          [
                          ["Reason", appointmentDetails.reason],
                          ["Address", appointmentDetails.location_address],
                          ["Date/time", appointmentDetails.starts_at],
                          ["Provider", appointmentDetails.provider_name],
                          [
                            "Practice",
                            appointmentDetails.provider_organization,
                          ],
                          ["Location", appointmentDetails.location_name],
                          ["Phone", appointmentDetails.location_phone],
                          ] as Array<[string, unknown]>
                        ).map(([label, value]) => {
                          const cleanedValue =
                            label === "Date/time" && textValue(value)
                              ? formatDate(textValue(value))
                              : textValue(value);

                          return cleanedValue ? (
                            <p key={label}>
                              <span className="font-semibold">{label}:</span>{" "}
                              {cleanedValue}
                            </p>
                          ) : null;
                        })}
                      </div>
                    ) : (
                      <>
                        <p className="mt-1 text-slate-600">
                          {adminAppointmentPrivacyLabel(appointment)}
                        </p>
                        <button
                          className="mt-2 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 disabled:text-slate-400"
                          disabled={revealingKey === detailKey}
                          onClick={() =>
                            onReveal({
                              resourceId: appointment.id,
                              resourceType: "appointment_details",
                              targetUserId: snapshot.profile.id,
                            })
                          }
                          type="button"
                        >
                          {revealingKey === detailKey
                            ? "Revealing..."
                            : "Reveal full title/details"}
                        </button>
                      </>
                    )}
                  </div>

                  <div className="rounded-md bg-slate-50 p-3 text-sm">
                    <p className="font-semibold text-slate-800">Notes</p>
                    {noteDetails ? (
                      <div className="mt-2 space-y-2 text-slate-700">
                        {textValue(noteDetails.summary_short) ? (
                          <p>{textValue(noteDetails.summary_short)}</p>
                        ) : null}
                        <p className="font-semibold text-slate-800">Takeaways</p>
                        <DetailList
                          emptyLabel="No takeaways saved."
                          items={asTextList(noteDetails.takeaways)}
                        />
                        <p className="font-semibold text-slate-800">Follow-ups</p>
                        <DetailList
                          emptyLabel="No follow-ups saved."
                          items={asTextList(noteDetails.followups)}
                        />
                      </div>
                    ) : appointment.current_note_id ? (
                      <>
                        <p className="mt-1 text-slate-600">
                          Note content is hidden.
                        </p>
                        <button
                          className="mt-2 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 disabled:text-slate-400"
                          disabled={revealingKey === noteKey}
                          onClick={() =>
                            onReveal({
                              resourceId: appointment.current_note_id,
                              resourceType: "appointment_note",
                              targetUserId: snapshot.profile.id,
                            })
                          }
                          type="button"
                        >
                          {revealingKey === noteKey
                            ? "Revealing..."
                            : "Reveal notes"}
                        </button>
                      </>
                    ) : (
                      <p className="mt-1 text-slate-600">No current note.</p>
                    )}
                  </div>

                  <div className="rounded-md bg-slate-50 p-3 text-sm">
                    <p className="font-semibold text-slate-800">CarePrep</p>
                    {carePrepDetails ? (
                      <div className="mt-2 space-y-2 text-slate-700">
                        {textValue(carePrepDetails.summary) ? (
                          <p>{textValue(carePrepDetails.summary)}</p>
                        ) : null}
                        <p className="font-semibold text-slate-800">Questions</p>
                        <DetailList
                          emptyLabel="No questions saved."
                          items={asTextList(carePrepDetails.key_questions)}
                        />
                        <p className="font-semibold text-slate-800">Bring</p>
                        <DetailList
                          emptyLabel="No bring list saved."
                          items={asTextList(carePrepDetails.bring_list)}
                        />
                        <p className="font-semibold text-slate-800">Watchouts</p>
                        <DetailList
                          emptyLabel="No watchouts saved."
                          items={asTextList(carePrepDetails.watchouts)}
                        />
                      </div>
                    ) : appointment.current_guidance_id ? (
                      <>
                        <p className="mt-1 text-slate-600">
                          CarePrep content is hidden.
                        </p>
                        <button
                          className="mt-2 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 disabled:text-slate-400"
                          disabled={revealingKey === carePrepKey}
                          onClick={() =>
                            onReveal({
                              resourceId: appointment.current_guidance_id,
                              resourceType: "careprep_guidance",
                              targetUserId: snapshot.profile.id,
                            })
                          }
                          type="button"
                        >
                          {revealingKey === carePrepKey
                            ? "Revealing..."
                            : "Reveal CarePrep"}
                        </button>
                      </>
                    ) : (
                      <p className="mt-1 text-slate-600">No current CarePrep.</p>
                    )}
                  </div>
                </div>
              </article>
            );
          })
        )}
      </div>
    </section>
  );
}
