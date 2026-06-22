import type { FamilyTask } from "../../../lib/family/types";
import { panelClass } from "../../shared/uiStyles";
import { TaskStatusPill } from "./TaskStatusPill";

type TaskListProps = {
  tasks: FamilyTask[];
};

export function TaskList({ tasks }: TaskListProps) {
  return (
    <div className="grid gap-3">
      {tasks.map((task) => (
        <article key={task.id} className={panelClass}>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-sm font-semibold text-blue-700">
                {task.careVipName}
              </p>
              <h2 className="mt-1 text-lg font-semibold text-blue-950">
                {task.title}
              </h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                {task.description}
              </p>
            </div>
            <TaskStatusPill status={task.status} />
          </div>
          <dl className="mt-4 grid gap-3 border-t border-blue-50 pt-4 text-sm sm:grid-cols-2">
            <div>
              <dt className="font-semibold text-slate-500">Owner</dt>
              <dd className="mt-1 text-slate-800">
                {task.assignedMemberName ?? "Unassigned"}
              </dd>
            </div>
            <div>
              <dt className="font-semibold text-slate-500">Due</dt>
              <dd className="mt-1 text-slate-800">{task.dueLabel ?? "Open"}</dd>
            </div>
          </dl>
        </article>
      ))}
    </div>
  );
}
