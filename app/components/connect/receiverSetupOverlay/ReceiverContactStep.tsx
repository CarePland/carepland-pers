import { ReceiverSetupStatus } from "./ReceiverSetupStatus";
import type { ReceiverSetupStepProps } from "./types";

export function ReceiverContactStep({
  contactOptions,
  draft,
  isSelfContact,
  selectedContact,
  setDraft,
}: ReceiverSetupStepProps) {
  return (
    <section className="grid gap-5">
      <div>
        <h2 className="text-2xl font-black text-[#172f49]">
          Choose who receives messages and calls from this Receiver.
        </h2>
        <p className="mt-2 text-base font-semibold leading-relaxed text-[#5f6e84]">
          The Receiver Contact is the login-capable user who receives Receiver-originated
          communication.
        </p>
      </div>

      {contactOptions.length ? (
        <div className="grid gap-3">
          {contactOptions.map((contact) => (
            <button
              aria-pressed={draft.receiverContactUserId === contact.userId}
              className={`min-h-20 rounded-lg border p-4 text-left transition ${
                draft.receiverContactUserId === contact.userId
                  ? "border-[#9fc6e8] bg-[#edf5fc]"
                  : "border-[#d6e3f2] bg-white hover:bg-[#f8fbff]"
              } focus:outline-none focus:ring-2 focus:ring-[#4e84b2]`}
              key={contact.userId}
              onClick={() =>
                setDraft((current) => ({
                  ...current,
                  receiverContactUserId: contact.userId,
                }))
              }
              type="button"
            >
              <span className="block text-lg font-black text-[#172f49]">
                {contact.displayName}
              </span>
              <span className="mt-1 block text-sm font-semibold text-[#5f6e84]">
                {contact.source === "existing_receiver"
                  ? "Resolved from an existing Receiver binding"
                  : "Resolved from the current CarePland account context"}
              </span>
            </button>
          ))}
        </div>
      ) : (
        <ReceiverSetupStatus tone="warn">
          Receiver Contact is not resolved yet. CarePland will not invent or silently reroute a
          contact for this Receiver.
        </ReceiverSetupStatus>
      )}

      {selectedContact && isSelfContact ? (
        <ReceiverSetupStatus size="large" tone="warn">
          You can&apos;t message yourself, so certain communication features will not work.
        </ReceiverSetupStatus>
      ) : null}
    </section>
  );
}
