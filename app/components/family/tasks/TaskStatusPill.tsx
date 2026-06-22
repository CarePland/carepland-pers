import type { FamilyTaskStatus } from "../../../lib/family/types";

const statusLabels: Record<FamilyTaskStatus, string> = {
  available: "Available",
  assigned: "Assigned",
  completed: "Completed",
  unable_to_complete: "Unable to Complete",
};

const statusClasses: Record<FamilyTaskStatus, string> = {
  available: "border-blue-100 bg-blue-50 text-blue-800",
  assigned: "border-emerald-100 bg-emerald-50 text-emerald-800",
  completed: "border-teal-100 bg-teal-50 text-teal-800",
  unable_to_complete: "border-rose-100 bg-rose-50 text-rose-800",
};

type TaskStatusPillProps = {
  status: FamilyTaskStatus;
};

export function TaskStatusPill({ status }: TaskStatusPillProps) {
  return (
    <span
      className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${statusClasses[status]}`}
    >
      {statusLabels[status]}
    </span>
  );
}
