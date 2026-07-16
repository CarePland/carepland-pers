import type { ConnectPersPerson } from "@/app/lib/connect/context";

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return parts
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("") || "R";
}

export function ReceiverPersonChoice({
  description,
  isCurrentUser,
  person,
  selected,
  onSelect,
}: {
  description?: string;
  isCurrentUser?: boolean;
  onSelect: () => void;
  person: ConnectPersPerson;
  selected: boolean;
}) {
  return (
    <button
      aria-pressed={selected}
      className={`grid min-h-20 w-full gap-3 rounded-lg p-4 text-left transition sm:grid-cols-[auto_minmax(0,1fr)] sm:items-center ${
        selected
          ? "bg-[#edf5fc] shadow-[inset_0_0_0_2px_#9fc6e8]"
          : "bg-white hover:bg-[#f8fbff]"
      } focus:outline-none focus:ring-2 focus:ring-[#4e84b2]`}
      onClick={onSelect}
      type="button"
    >
      <span
        aria-hidden="true"
        className={`grid h-14 w-14 shrink-0 place-items-center overflow-hidden rounded-full border font-black ${
          selected
            ? "border-[#4e84b2] bg-[#4e84b2] text-white"
            : "border-[#cbd9e7] bg-[#edf5fc] text-[#244d73]"
        }`}
      >
        {person.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img alt="" className="h-full w-full object-cover" src={person.avatarUrl} />
        ) : person.avatarEmoji ? (
          <span className="text-3xl leading-none">{person.avatarEmoji}</span>
        ) : (
          initials(person.displayName)
        )}
      </span>
      <span className="min-w-0">
        <span className="block truncate text-lg font-black text-[#172f49]">
          {person.displayName}
          {isCurrentUser ? (
            <span className="ml-2 whitespace-nowrap text-base font-black text-[#4e84b2]">
              (You)
            </span>
          ) : null}
        </span>
        {description ? (
          <span className="mt-1 block text-sm font-semibold text-[#5f6e84]">
            {description}
          </span>
        ) : null}
      </span>
    </button>
  );
}
