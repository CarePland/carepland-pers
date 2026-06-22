"use client";

export type AdminAiHistoryAppointment = {
  id: string;
  starts_at: string | null;
  title: string | null;
};

export type CarePrepHistoryRow = {
  id: string;
  appointment_id: string;
  generated_at: string | null;
  summary: string | null;
  is_current: boolean;
  version_number: number;
  review_status: string | null;
  source: string | null;
  model: string | null;
  prompt_version: string | null;
  instruction_content_hash: string | null;
  instruction_version_id: string | null;
  edited_from_guidance_id: string | null;
  ai_generated_guidance_id: string | null;
  superseded_at: string | null;
  superseded_by_guidance_id: string | null;
};

export type IntakeHistoryRow = {
  id: string;
  accepted_at?: string | null;
  accepted_interpretation?: unknown;
  ai_interpretation?: unknown;
  created_at: string | null;
  error_message?: string | null;
  instruction_content_hash?: string | null;
  interpretation?: unknown;
  match_status?: string | null;
  model?: string | null;
  prompt_version?: string | null;
  raw_text: string | null;
  source_type: string | null;
  status: string | null;
};

type AdminAiHistoryPanelProps = {
  appointments: AdminAiHistoryAppointment[];
  carePrepHistory: CarePrepHistoryRow[];
  formatDate: (value: string | null) => string;
  historyAppointmentId: string;
  intakeHistory: IntakeHistoryRow[];
  loading: boolean;
  mode: "careprep" | "intake";
  onChangeHistoryAppointment: (appointmentId: string) => void;
  onLoadCarePrepHistory: () => void;
  onLoadIntakeHistory: () => void;
};

function intakeSummaryFromRow(row: IntakeHistoryRow) {
  const accepted =
    row.accepted_interpretation && typeof row.accepted_interpretation === "object"
      ? (row.accepted_interpretation as Record<string, unknown>)
      : null;
  const aiDraft =
    row.ai_interpretation && typeof row.ai_interpretation === "object"
      ? (row.ai_interpretation as Record<string, unknown>)
      : null;

  return {
    summary: String(
      accepted?.notes_summary ?? aiDraft?.notes_summary ?? row.raw_text ?? ""
    ),
    title: String(
      accepted?.appointment_title ??
        aiDraft?.appointment_title ??
        "Untitled intake"
    ),
  };
}

export function AdminAiHistoryPanel({
  appointments,
  carePrepHistory,
  formatDate,
  historyAppointmentId,
  intakeHistory,
  loading,
  mode,
  onChangeHistoryAppointment,
  onLoadCarePrepHistory,
  onLoadIntakeHistory,
}: AdminAiHistoryPanelProps) {
  if (mode === "careprep") {
    return (
      <section className="mt-5 space-y-4">
        <div className="flex flex-wrap items-end gap-3">
          <label className="block min-w-64 text-sm font-medium text-slate-700">
            Appointment
            <select
              className="mt-2 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-base"
              onChange={(event) =>
                onChangeHistoryAppointment(event.target.value)
              }
              value={historyAppointmentId || appointments[0]?.id || ""}
            >
              {appointments.length === 0 ? (
                <option value="">No appointments loaded</option>
              ) : null}
              {appointments.map((appointment) => (
                <option key={appointment.id} value={appointment.id}>
                  {appointment.title || "Untitled appointment"} ·{" "}
                  {formatDate(appointment.starts_at)}
                </option>
              ))}
            </select>
          </label>
          <button
            className="rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700"
            disabled={loading}
            onClick={onLoadCarePrepHistory}
            type="button"
          >
            {loading ? "Loading..." : "Load history"}
          </button>
        </div>

        {carePrepHistory.length === 0 ? (
          <p className="rounded-md bg-slate-100 p-3 text-sm text-slate-600">
            No CarePrep history loaded for this appointment yet.
          </p>
        ) : (
          <div className="space-y-3">
            {carePrepHistory.map((row) => (
              <article
                className="rounded-md border border-slate-200 p-4"
                key={row.id}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-slate-900">
                      {row.version_number > 0
                        ? `v${row.version_number}`
                        : "Unaccepted"}
                      {row.is_current ? " · current" : ""}
                      {row.review_status ? ` · ${row.review_status}` : ""}
                      {row.source ? ` · ${row.source}` : ""}
                    </p>
                    <p className="mt-1 text-sm text-slate-500">
                      {formatDate(row.generated_at)}
                      {row.model ? ` · ${row.model}` : ""}
                      {row.prompt_version ? ` · ${row.prompt_version}` : ""}
                    </p>
                    {row.instruction_content_hash ? (
                      <p className="mt-1 font-mono text-xs text-slate-500">
                        {row.instruction_content_hash}
                      </p>
                    ) : null}
                    {row.summary ? (
                      <p className="mt-2 text-sm text-slate-700">
                        {row.summary}
                      </p>
                    ) : null}
                  </div>
                </div>
                <div className="mt-3 grid gap-2 text-xs text-slate-500 md:grid-cols-2">
                  {row.ai_generated_guidance_id ? (
                    <p>AI source: {row.ai_generated_guidance_id}</p>
                  ) : null}
                  {row.edited_from_guidance_id ? (
                    <p>Edited from: {row.edited_from_guidance_id}</p>
                  ) : null}
                  {row.superseded_by_guidance_id ? (
                    <p>Superseded by: {row.superseded_by_guidance_id}</p>
                  ) : null}
                  {row.superseded_at ? (
                    <p>Superseded: {formatDate(row.superseded_at)}</p>
                  ) : null}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    );
  }

  return (
    <section className="mt-5 space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <button
          className="rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700"
          disabled={loading}
          onClick={onLoadIntakeHistory}
          type="button"
        >
          {loading ? "Loading..." : "Load history"}
        </button>
      </div>

      {intakeHistory.length === 0 ? (
        <p className="rounded-md bg-slate-100 p-3 text-sm text-slate-600">
          No note intake history loaded yet.
        </p>
      ) : (
        <div className="space-y-3">
          {intakeHistory.map((row) => {
            const { summary, title } = intakeSummaryFromRow(row);

            return (
              <article
                className="rounded-md border border-slate-200 p-4"
                key={row.id}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-slate-900">
                      {title}
                      {row.status ? ` · ${row.status}` : ""}
                      {row.match_status ? ` · ${row.match_status}` : ""}
                    </p>
                    <p className="mt-1 text-sm text-slate-500">
                      {formatDate(row.created_at)}
                      {row.model ? ` · ${row.model}` : ""}
                      {row.prompt_version ? ` · ${row.prompt_version}` : ""}
                    </p>
                    {row.instruction_content_hash ? (
                      <p className="mt-1 font-mono text-xs text-slate-500">
                        {row.instruction_content_hash}
                      </p>
                    ) : null}
                    {summary ? (
                      <p className="mt-2 max-h-20 overflow-hidden text-sm text-slate-700">
                        {summary}
                      </p>
                    ) : null}
                    {row.error_message ? (
                      <p className="mt-2 text-sm text-red-700">
                        {row.error_message}
                      </p>
                    ) : null}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
