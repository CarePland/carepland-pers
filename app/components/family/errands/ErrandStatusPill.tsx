import type { ErrandStatus } from "../../../lib/family/types";

const statusLabels: Record<ErrandStatus, string> = {
  available: "Available",
  assigned: "Assigned",
  completed: "Completed",
  unable_to_complete: "Unable to Complete",
};

const statusClasses: Record<ErrandStatus, string> = {
  available: "border-blue-100 bg-blue-50 text-blue-800",
  assigned: "border-emerald-100 bg-emerald-50 text-emerald-800",
  completed: "border-teal-100 bg-teal-50 text-teal-800",
  unable_to_complete: "border-rose-100 bg-rose-50 text-rose-800",
};

type ErrandStatusPillProps = {
  isPastDue?: boolean;
  status: ErrandStatus;
};

export function ErrandStatusPill({ isPastDue, status }: ErrandStatusPillProps) {
  return (
    <span className="inline-flex flex-wrap gap-1">
      <span
        className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${statusClasses[status]}`}
      >
        {statusLabels[status]}
      </span>
      {isPastDue ? (
        <span className="inline-flex rounded-full border border-rose-100 bg-rose-50 px-2.5 py-1 text-xs font-semibold text-rose-800">
          Past Due
        </span>
      ) : null}
    </span>
  );
}
