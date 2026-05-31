import { useEffect, useRef, useState } from "react";

export type AppointmentView = "archived" | "logged" | "upcoming";

type AppointmentViewToolbarProps = {
  allSubjectsValue: string;
  canFilterCareVips: boolean;
  careSubjects: Array<{ display_name: string; id: string }>;
  disabled: boolean;
  onChangeSubject: (subjectId: string) => void;
  onChangeView: (view: AppointmentView) => void;
  selectedSubjectId: string;
  stickyTop: number;
  view: AppointmentView;
};

function EllipsisVerticalIcon({
  className = "h-5 w-5",
}: {
  className?: string;
}) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
      viewBox="0 0 24 24"
    >
      <circle cx="12" cy="12" r="1" />
      <circle cx="12" cy="5" r="1" />
      <circle cx="12" cy="19" r="1" />
    </svg>
  );
}

export function AppointmentViewToolbar({
  allSubjectsValue,
  canFilterCareVips,
  careSubjects,
  disabled,
  onChangeSubject,
  onChangeView,
  selectedSubjectId,
  stickyTop,
  view,
}: AppointmentViewToolbarProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [optimisticSubjectId, setOptimisticSubjectId] =
    useState(selectedSubjectId);
  const [optimisticView, setOptimisticView] = useState(view);
  const mobileMenuRef = useRef<HTMLDivElement | null>(null);
  const viewOptions: Array<{ label: string; value: AppointmentView }> = [
    { label: "Upcoming", value: "upcoming" },
    { label: "Logged", value: "logged" },
    { label: "Archived", value: "archived" },
  ];

  useEffect(() => {
    if (!mobileMenuOpen) {
      return;
    }

    function closeMobileMenuOnOutsideClick(event: PointerEvent) {
      const target = event.target;

      if (
        target instanceof Node &&
        mobileMenuRef.current?.contains(target)
      ) {
        return;
      }

      setMobileMenuOpen(false);
    }

    document.addEventListener("pointerdown", closeMobileMenuOnOutsideClick);

    return () => {
      document.removeEventListener(
        "pointerdown",
        closeMobileMenuOnOutsideClick
      );
    };
  }, [mobileMenuOpen]);

  return (
    <div
      className="sticky z-40 bg-slate-50 pb-0 pt-0.5 before:absolute before:-top-2 before:left-0 before:right-0 before:h-2 before:bg-slate-50 md:-mt-6"
      style={{ top: stickyTop }}
    >
      <div className="relative px-3 pt-2">
        <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-2">
          <div className="order-2 flex flex-wrap items-center gap-1.5 rounded-full border border-blue-100 bg-white/70 p-1 shadow-sm md:order-1">
            {viewOptions.map((option) => {
              const selected = optimisticView === option.value;

              return (
                <button
                  aria-pressed={selected}
                  className={`relative rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
                    selected
                      ? "bg-blue-50 text-blue-800 ring-1 ring-blue-100"
                      : "text-slate-600 hover:bg-blue-50/70 hover:text-blue-800"
                  }`}
                  key={option.value}
                  onClick={() => {
                    setOptimisticView(option.value);
                    onChangeView(option.value);
                  }}
                  type="button"
                >
                  {option.label}
                </button>
              );
            })}
          </div>

          {canFilterCareVips ? (
            <div
              className="absolute right-4 top-2 z-10 flex items-end pb-px md:hidden"
              ref={mobileMenuRef}
            >
              <button
                aria-expanded={mobileMenuOpen}
                aria-label="Appointment view options"
                className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-blue-100 bg-white/80 text-slate-500 shadow-sm hover:bg-blue-50 hover:text-blue-800 focus:outline-none focus:ring-2 focus:ring-blue-300"
                disabled={disabled}
                onClick={() => setMobileMenuOpen((isOpen) => !isOpen)}
                type="button"
              >
                <EllipsisVerticalIcon className="h-5 w-5" />
              </button>
              {mobileMenuOpen ? (
                <div className="absolute right-0 top-11 z-20 w-56 rounded-md border border-slate-200 bg-white p-3 text-left shadow-lg">
                  <label className="block text-sm font-medium text-slate-600">
                    Showing
                    <select
                      className="mt-2 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700"
                      disabled={careSubjects.length === 0}
                      onChange={(event) => {
                        setOptimisticSubjectId(event.target.value);
                        onChangeSubject(event.target.value);
                        setMobileMenuOpen(false);
                      }}
                      value={optimisticSubjectId}
                    >
                      <option value={allSubjectsValue}>All appts</option>
                      {careSubjects.map((subject) => (
                        <option key={subject.id} value={subject.id}>
                          {subject.display_name}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
              ) : null}
            </div>
          ) : null}

          {canFilterCareVips ? (
            <div className="order-1 hidden w-full flex-wrap items-center gap-2 pb-2 text-sm text-slate-500 md:order-2 md:flex md:w-auto">
              <label className="flex items-center gap-2">
                <span>Showing:</span>
                <select
                  className="max-w-48 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700"
                  disabled={careSubjects.length === 0}
                  onChange={(event) => {
                    setOptimisticSubjectId(event.target.value);
                    onChangeSubject(event.target.value);
                  }}
                  value={optimisticSubjectId}
                >
                  <option value={allSubjectsValue}>All appts</option>
                  {careSubjects.map((subject) => (
                    <option key={subject.id} value={subject.id}>
                      {subject.display_name}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
