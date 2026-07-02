"use client";

import { useEffect, useRef } from "react";

export type TodayFocusListItem = {
  id: string;
  title: string;
};

export type TodayFocusCadencePreferenceAction =
  | "show_less_often"
  | "hide_until_next_appointment"
  | "snooze_30_days"
  | "stop_suggesting";

export type TodayFocusCadencePreferenceCadence =
  | "few_times_a_week"
  | "weekly"
  | "every_couple_of_weeks"
  | "monthly"
  | "only_before_appointments";

type TodayFocusListProps = {
  completedItemIds?: string[];
  completingId?: string;
  items: TodayFocusListItem[];
  onComplete: (item: TodayFocusListItem) => void;
  onUndoComplete?: (item: TodayFocusListItem) => void;
  onOpenPreference: (item: TodayFocusListItem) => void;
  preferenceOpenForId?: string | null;
  preferenceStep?: "main" | "cadence";
  onCancelPreference: () => void;
  onChoosePreference: (
    action: TodayFocusCadencePreferenceAction,
    cadence?: TodayFocusCadencePreferenceCadence
  ) => void;
  variant?: "receiver" | "home";
};

const mainPreferenceOptions: Array<{
  action: TodayFocusCadencePreferenceAction;
  label: string;
}> = [
  { action: "show_less_often", label: "Show this less often" },
  { action: "hide_until_next_appointment", label: "Hide until my next appointment" },
  { action: "snooze_30_days", label: "Snooze for 30 days" },
  { action: "stop_suggesting", label: "Stop suggesting this" },
];

const cadenceOptions: Array<{
  cadence: TodayFocusCadencePreferenceCadence;
  label: string;
}> = [
  { cadence: "few_times_a_week", label: "A few times a week" },
  { cadence: "weekly", label: "Weekly" },
  { cadence: "every_couple_of_weeks", label: "Every couple of weeks" },
  { cadence: "monthly", label: "Monthly" },
  { cadence: "only_before_appointments", label: "Only before appointments" },
];

export function TodayFocusList({
  completedItemIds = [],
  completingId = "",
  items,
  onCancelPreference,
  onChoosePreference,
  onComplete,
  onOpenPreference,
  onUndoComplete,
  preferenceOpenForId = null,
  preferenceStep = "main",
  variant = "home",
}: TodayFocusListProps) {
  const listRef = useRef<HTMLUListElement | null>(null);

  useEffect(() => {
    if (!preferenceOpenForId) return;

    function handlePointerDown(event: PointerEvent) {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (listRef.current?.contains(target)) return;
      onCancelPreference();
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onCancelPreference();
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [onCancelPreference, preferenceOpenForId]);

  return (
    <ul className={`today-focus-list today-focus-list-${variant}`} ref={listRef}>
      {items.map((item) => {
        const preferenceOpen = item.id === preferenceOpenForId;
        const completed = completedItemIds.includes(item.id);
        const active = completed || item.id === completingId;

        return (
          <li
            className={`today-focus-list-item ${
              preferenceOpen ? "today-focus-list-item-open" : ""
            }`}
            key={item.id}
          >
            <div className="today-focus-item-row">
              <button
                className={`today-focus-complete-button ${
                  active ? "today-focus-complete-active" : ""
                }`}
                onClick={() =>
                  completed && onUndoComplete
                    ? onUndoComplete(item)
                    : onComplete(item)
                }
                type="button"
              >
                <span className="today-focus-checkbox" aria-hidden="true" />
                <span className="today-focus-title">{item.title}</span>
                {completed ? (
                  <span className="today-focus-undo-label">Undo</span>
                ) : null}
              </button>
              <button
                aria-expanded={preferenceOpen}
                aria-label={`Adjust how often CarePland shows ${item.title}`}
                className="today-focus-preference-button"
                onClick={() => onOpenPreference(item)}
                type="button"
              >
                ×
              </button>
            </div>
            {preferenceOpen ? (
              <div className="today-focus-preference-popover" role="dialog">
                {preferenceStep === "cadence" ? (
                  <>
                    {cadenceOptions.map((option) => (
                      <button
                        key={option.cadence}
                        onClick={() =>
                          onChoosePreference("show_less_often", option.cadence)
                        }
                        type="button"
                      >
                        {option.label}
                      </button>
                    ))}
                  </>
                ) : (
                  <>
                    {mainPreferenceOptions.map((option) => (
                      <button
                        key={option.action}
                        onClick={() => onChoosePreference(option.action)}
                        type="button"
                      >
                        {option.label}
                      </button>
                    ))}
                  </>
                )}
                <button
                  className="today-focus-preference-cancel"
                  onClick={onCancelPreference}
                  type="button"
                >
                  Cancel
                </button>
              </div>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}
