import { receiverSetupSectionLabel, receiverSetupSectionOrder } from "./utils";
import type { ReceiverSetupSection } from "./types";

export function ReceiverSetupProgress({
  canNavigate = false,
  completedSections = {},
  labelOverrides = {},
  onNavigate,
  section,
}: {
  canNavigate?: boolean;
  completedSections?: Partial<Record<ReceiverSetupSection, boolean>>;
  labelOverrides?: Partial<Record<ReceiverSetupSection, string>>;
  onNavigate?: (section: ReceiverSetupSection) => void;
  section: ReceiverSetupSection;
}) {
  const currentIndex = receiverSetupSectionOrder.indexOf(section);

  if (currentIndex < 0) return null;

  return (
    <nav aria-label="Receiver setup progress">
      <ol className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {receiverSetupSectionOrder.map((item) => {
          const active = item === section;
          const complete = Boolean(completedSections[item]);
          const className = `rounded-full px-4 py-3 text-center text-base font-black ${
            active
              ? "bg-[#2f6f9f] text-white"
              : complete
                ? "bg-[#e5f7ee] text-[#176342]"
                : "bg-[#edf1f4] text-[#5f6e84]"
          }`;
          return (
            <li key={item}>
              {canNavigate && onNavigate ? (
                <button
                  aria-current={active ? "step" : undefined}
                  className={`${className} w-full hover:brightness-95 focus:outline-none focus:ring-2 focus:ring-[#4e84b2]`}
                  onClick={() => onNavigate(item)}
                  type="button"
                >
                  {labelOverrides[item] ?? receiverSetupSectionLabel(item)}
                </button>
              ) : (
                <span className={`block ${className}`}>
                  {labelOverrides[item] ?? receiverSetupSectionLabel(item)}
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
