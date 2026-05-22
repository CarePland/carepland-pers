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
      className="sticky z-40 flex flex-wrap items-center justify-between gap-3 bg-slate-50/95 py-3 backdrop-blur"
      style={{ top: stickyTop }}
    >
      <div className="flex flex-wrap gap-2">
        {viewOptions.map((option) => (
          <button
            className={`rounded-md px-4 py-2 text-sm font-semibold ${
              view === option.value
                ? "bg-blue-700 text-white"
                : "border border-slate-300 bg-white text-slate-700"
            }`}
            disabled={disabled}
            key={option.value}
            onClick={() => onChangeView(option.value)}
            type="button"
          >
            {option.label}
          </button>
        ))}
      </div>

      {canFilterCareVips ? (
        <div className="flex flex-wrap items-center gap-2 text-sm text-slate-700">
          <label className="flex items-center gap-2">
            <span className="font-medium">Showing:</span>
            <select
              className="max-w-48 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
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
            className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 disabled:text-slate-400"
            disabled={disabled}
            onClick={onRefresh}
            type="button"
          >
            Refresh
          </button>
        </div>
      ) : null}
    </div>
  );
}

