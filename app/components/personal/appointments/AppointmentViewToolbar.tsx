import { useState } from "react";

import { ManagedByHouseholdHeart } from "../../shared/PersonAvatar";

export type AppointmentView = "archived" | "logged" | "upcoming";

type AppointmentViewToolbarProps = {
  allSubjectsValue: string;
  canFilterCareVips: boolean;
  careSubjects: Array<{
    avatarEmoji?: string | null;
    display_name: string;
    id: string;
    managed_by_household?: boolean | null;
  }>;
  disabled: boolean;
  hideOlder?: boolean;
  onChangeSubject: (subjectId: string) => void;
  onChangeView: (view: AppointmentView) => void;
  selectedSubjectId: string;
  sticky?: boolean;
  stickyTop: number;
  view: AppointmentView;
};

function subjectInitials(displayName: string) {
  const parts = displayName
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (parts.length >= 2) {
    return `${parts[0]?.[0] ?? ""}${parts[1]?.[0] ?? ""}`.toUpperCase();
  }

  return displayName.trim().slice(0, 2).toUpperCase() || "?";
}

function compactSubjectName(displayName: string) {
  return displayName.trim().split(/\s+/)[0] || displayName;
}

export function AppointmentViewToolbar({
  allSubjectsValue,
  canFilterCareVips,
  careSubjects,
  disabled,
  hideOlder = false,
  onChangeSubject,
  onChangeView,
  selectedSubjectId,
  sticky = true,
  stickyTop,
  view,
}: AppointmentViewToolbarProps) {
  const [optimisticSubjectId, setOptimisticSubjectId] =
    useState(selectedSubjectId);
  const [optimisticView, setOptimisticView] = useState(view);
  const viewOptions: Array<{ label: string; value: AppointmentView }> = [
    { label: "Logged", value: "logged" },
    { label: "Archived", value: "archived" },
  ];
  const subjectOptions = [
    { display_name: "All appts", id: allSubjectsValue },
    ...careSubjects,
  ];
  const showingOlderAppointments = optimisticView !== "upcoming";

  return (
    <div
      className={
        sticky
          ? "sticky z-40 bg-slate-50 pb-0 before:absolute before:-top-2 before:left-0 before:right-0 before:h-2 before:bg-slate-50"
          : "bg-slate-50 pb-0"
      }
      style={sticky ? { top: stickyTop } : undefined}
    >
      <div className="relative">
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
          {canFilterCareVips ? (
            <div className="order-1 flex max-w-full items-center gap-2 overflow-x-auto">
              {subjectOptions.map((subject) => {
                const selected = optimisticSubjectId === subject.id;
                const avatarEmoji = subject.avatarEmoji?.trim() ?? "";
                const isAllSubjects = subject.id === allSubjectsValue;
                const avatarLabel =
                  isAllSubjects
                    ? "All"
                    : avatarEmoji || subjectInitials(subject.display_name);
                const shortName = compactSubjectName(subject.display_name);

                return (
                  <button
                    aria-pressed={selected}
                    className={`inline-flex shrink-0 items-center gap-2 rounded-full py-1.5 pl-1.5 text-sm font-semibold transition-colors ${
                      selected
                        ? "bg-blue-50 text-blue-800 ring-1 ring-blue-100"
                        : "text-slate-600 hover:bg-blue-50/70 hover:text-blue-800"
                    } ${isAllSubjects ? "pr-1.5 min-[1280px]:pr-3" : "pr-3"}`}
                    disabled={disabled || careSubjects.length === 0}
                    key={subject.id}
                    onClick={() => {
                      setOptimisticSubjectId(subject.id);
                      onChangeSubject(subject.id);
                    }}
                    type="button"
                  >
                    <span
                      aria-hidden="true"
                      className={`grid h-7 w-7 place-items-center rounded-full font-black ${
                        selected
                          ? "bg-blue-100 text-blue-800"
                          : "bg-slate-100 text-slate-500"
                      } ${avatarEmoji ? "text-base" : "text-xs"}`}
                    >
                      {avatarLabel}
                    </span>
                    {isAllSubjects ? (
                      <span className="hidden min-[1280px]:inline">
                        {subject.display_name}
                      </span>
                    ) : (
                      <span>
                        <span>{shortName}</span>
                        {shortName !== subject.display_name ? (
                          <span className="hidden min-[1280px]:inline">
                            {" "}
                            {subject.display_name.slice(shortName.length).trim()}
                          </span>
                        ) : null}
                        {subject.managed_by_household ? (
                          <ManagedByHouseholdHeart className="ml-1" />
                        ) : null}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          ) : (
            <span aria-hidden="true" className="order-1" />
          )}

          {hideOlder && !showingOlderAppointments ? null : (
          <div className="order-2 ml-auto flex flex-wrap items-center justify-end gap-2">
            {showingOlderAppointments ? (
              <>
                <nav
                  aria-label="Older appointment views"
                  className="flex flex-wrap items-center gap-1 rounded-full border border-blue-100 bg-white/70 p-0.5 shadow-sm"
                >
                  {viewOptions.map((option) => {
                    const selected = optimisticView === option.value;

                    return (
                      <button
                        aria-pressed={selected}
                        className={`relative rounded-full px-4 py-1.5 text-sm font-semibold transition-colors ${
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
                </nav>
                <button
                  className="min-h-9 rounded-md px-2 text-xs font-semibold text-slate-500 transition-colors hover:text-blue-800"
                  onClick={() => {
                    setOptimisticView("upcoming");
                    onChangeView("upcoming");
                  }}
                  type="button"
                >
                  Exit
                </button>
              </>
            ) : (
              <button
                className="min-h-9 rounded-md px-2 text-xs font-semibold text-slate-500 transition-colors hover:text-blue-800"
                onClick={() => {
                  setOptimisticView("logged");
                  onChangeView("logged");
                }}
                type="button"
              >
                Older
              </button>
            )}
          </div>
          )}
        </div>
      </div>
    </div>
  );
}
