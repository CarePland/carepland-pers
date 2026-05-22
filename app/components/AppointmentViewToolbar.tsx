export type AppointmentView = "archived" | "logged" | "upcoming";

type AppointmentViewToolbarProps = {
  allSubjectsValue: string;
  canFilterCareVips: boolean;
  careSubjects: Array<{ display_name: string; id: string }>;
  disabled: boolean;
  onChangeSubject: (subjectId: string) => void;
  onChangeView: (view: AppointmentView) => void;
  onRefresh: () => void;
  selectedSubjectId: string;
  stickyTop: number;
  view: AppointmentView;
};

export function AppointmentViewToolbar({
  allSubjectsValue,
  canFilterCareVips,
  careSubjects,
  disabled,
  onChangeSubject,
  onChangeView,
  onRefresh,
  selectedSubjectId,
  stickyTop,
  view,
}: AppointmentViewToolbarProps) {
  const viewOptions: Array<{ label: string; value: AppointmentView }> = [
    { label: "Upcoming", value: "upcoming" },
    { label: "Logged", value: "logged" },
    { label: "Archived", value: "archived" },
  ];

  return (
    <div
      className="sticky z-40 bg-slate-50 pb-0 pt-0.5 before:absolute before:-top-2 before:left-0 before:right-0 before:h-2 before:bg-slate-50 md:-mt-6"
      style={{ top: stickyTop }}
    >
      <div className="px-3 pt-2">
        <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-2">
          <div className="order-2 flex flex-wrap items-end gap-1 md:order-1">
            {viewOptions.map((option) => {
              const selected = view === option.value;

              return (
                <button
                  aria-pressed={selected}
                  className={`relative rounded-t-lg px-4 py-2 text-sm font-semibold transition-colors ${
                    selected
                      ? "border-x border-t border-slate-200 bg-white text-blue-800 shadow-[0_-1px_0_rgba(148,163,184,0.18)]"
                      : "mb-px border border-transparent text-slate-600 hover:bg-white/70 hover:text-slate-900"
                  }`}
                  disabled={disabled}
                  key={option.value}
                  onClick={() => onChangeView(option.value)}
                  type="button"
                >
                  {option.label}
                </button>
              );
            })}
          </div>

          {canFilterCareVips ? (
            <div className="order-1 flex w-full flex-wrap items-center gap-2 pb-2 text-sm text-slate-500 md:order-2 md:w-auto">
              <label className="flex items-center gap-2">
                <span>Showing:</span>
                <select
                  className="max-w-48 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700"
                  disabled={disabled || careSubjects.length === 0}
                  onChange={(event) => onChangeSubject(event.target.value)}
                  value={selectedSubjectId}
                >
                  <option value={allSubjectsValue}>All appts</option>
                  {careSubjects.map((subject) => (
                    <option key={subject.id} value={subject.id}>
                      {subject.display_name}
                    </option>
                  ))}
                </select>
              </label>
              <button
                className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600 disabled:text-slate-400"
                disabled={disabled}
                onClick={onRefresh}
                type="button"
              >
                Refresh
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
