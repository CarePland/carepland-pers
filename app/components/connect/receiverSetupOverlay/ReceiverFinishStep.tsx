import type { ReceiverSetupStepProps } from "./types";
import { receiverDisplayName } from "./utils";

export function ReceiverFinishStep({
  draft,
  selectedContact,
  selectedDevice,
  selectedUser,
  setDraft,
}: Pick<
  ReceiverSetupStepProps,
  "draft" | "selectedContact" | "selectedDevice" | "selectedUser" | "setDraft"
> & {
}) {
  const checklist = [
    {
      label: "Receiver User",
      comboLabel: "select a User",
      message: "Please select a Receiver User.",
      ready: Boolean(selectedUser),
      section: "receiverUser" as const,
      value: selectedUser?.displayName || "Not selected",
    },
    {
      label: "Receiver Contact",
      comboLabel: "choose where messages go",
      message: "Please choose where Receiver messages will go.",
      ready: Boolean(selectedContact),
      section: "receiverUser" as const,
      value: selectedContact?.displayName || "Not selected",
    },
    {
      label: "Pair Receiver",
      comboLabel: "pair or re-pair",
      message: "Please pair or re-pair this Receiver.",
      ready: draft.pairingStatus === "paired" || Boolean(selectedDevice?.pairedAt),
      section: "pair" as const,
      value: selectedDevice ? receiverDisplayName(selectedDevice) : "Not verified",
    },
  ];
  const incompleteItems = checklist.filter((item) => !item.ready);
  const setupReady = incompleteItems.length === 0;

  return (
    <section className="grid gap-8 py-8 sm:gap-10 sm:py-10">
      <ul className="grid gap-6 sm:grid-cols-3 sm:gap-8">
        {checklist.map((item) => {
          const content = (
            <>
              <span
                aria-label={item.ready ? "Ready" : "Go back to complete"}
                className={`mx-auto grid h-16 w-16 place-items-center rounded-full text-3xl font-black sm:h-20 sm:w-20 sm:text-4xl ${
                  item.ready ? "bg-[#e5f7ee] text-[#176342]" : "bg-[#edf1f4] text-[#5f6e84]"
                }`}
              >
                {item.ready ? "✓" : <BackArrowIcon />}
              </span>
              <span>
                <span className="block text-lg font-black text-[#172f49] sm:text-xl">
                  {item.label}
                </span>
                <span className="block text-base font-semibold text-[#5f6e84] sm:text-lg">
                  {item.value}
                </span>
              </span>
            </>
          );

          return (
            <li className="text-center" key={item.label}>
              {item.ready ? (
                <div className="grid gap-4 px-3 py-5 sm:py-6">{content}</div>
              ) : (
                <button
                  className="grid w-full gap-4 rounded-lg px-3 py-5 transition hover:bg-[#f8fbff] focus:outline-none focus:ring-2 focus:ring-[#4e84b2] sm:py-6"
                  onClick={() =>
                    setDraft((current) => ({
                      ...current,
                      section: item.section,
                    }))
                  }
                  type="button"
                >
                  {content}
                </button>
              )}
          </li>
          );
        })}
      </ul>

      {setupReady ? (
        <p className="px-3 py-2 text-center text-2xl font-black leading-snug text-[#0f5a3b] sm:text-3xl">
          Receiver is ready to use.
        </p>
      ) : incompleteItems.length > 1 ? (
        <p className="px-3 py-2 text-center text-xl font-bold leading-snug text-[#6f4d00] sm:text-2xl">
          For this Receiver,{" "}
          {incompleteItems.map((item, index) => {
            const isLast = index === incompleteItems.length - 1;
            const needsComma = incompleteItems.length > 2 && !isLast;
            return (
              <span key={item.label}>
                {isLast ? "and " : null}
                <button
                  className="underline-offset-4 hover:underline focus:outline-none focus:ring-2 focus:ring-[#4e84b2]"
                  onClick={() =>
                    setDraft((current) => ({
                      ...current,
                      section: item.section,
                    }))
                  }
                  type="button"
                >
                  {item.comboLabel}
                </button>
                {needsComma ? ", " : isLast ? "." : ", "}
              </span>
            );
          })}
        </p>
      ) : (
        <div className="grid gap-3">
          {incompleteItems.map((item) => (
            <button
              className="justify-self-center px-3 py-2 text-center text-xl font-bold leading-snug text-[#6f4d00] underline-offset-4 hover:underline focus:outline-none focus:ring-2 focus:ring-[#4e84b2] sm:text-2xl"
              key={item.label}
              onClick={() =>
                setDraft((current) => ({
                  ...current,
                  section: item.section,
                }))
              }
              type="button"
            >
              {item.message}
            </button>
          ))}
        </div>
      )}
    </section>
  );
}

function BackArrowIcon() {
  return (
    <svg
      aria-hidden="true"
      className="h-7 w-7"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="3"
      viewBox="0 0 24 24"
    >
      <path d="M19 12H5" />
      <path d="m12 5-7 7 7 7" />
    </svg>
  );
}
