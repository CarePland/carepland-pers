"use client";

import { ReceiverSetupStatus } from "./ReceiverSetupStatus";
import type { ReceiverSetupStepProps } from "./types";
import { receiverDisplayName } from "./utils";

export function ReceiverTestStep({
  isSelfContact,
  receiverUrl,
  selectedDevice,
}: Pick<ReceiverSetupStepProps, "isSelfContact" | "selectedDevice"> & {
  receiverUrl: string;
}) {
  function playTestSound() {
    const audio = new Audio("/connect/receiver/audio/sit.wav");
    void audio.play();
  }

  return (
    <section className="grid gap-5">
      <div>
        <h2 className="text-2xl font-black text-[#172f49]">Test Receiver.</h2>
        <p className="mt-2 text-base font-semibold leading-relaxed text-[#5f6e84]">
          Try the safe checks that are available now.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <button
          className="min-h-14 rounded-lg border border-[#cbd9e7] bg-white px-4 text-left text-base font-black text-[#173150] hover:bg-[#edf5fc] focus:outline-none focus:ring-2 focus:ring-[#4e84b2]"
          onClick={playTestSound}
          type="button"
        >
          Play test sound
        </button>
        <a
          className="grid min-h-14 place-items-center rounded-lg border border-[#cbd9e7] bg-white px-4 text-left text-base font-black text-[#173150] hover:bg-[#edf5fc] focus:outline-none focus:ring-2 focus:ring-[#4e84b2]"
          href={receiverUrl}
          rel="noreferrer"
          target="_blank"
        >
          Open Receiver
        </a>
      </div>

      <div className="rounded-lg border border-[#d6e3f2] bg-white p-4">
        <p className="text-sm font-black text-[#345d83]">Verify Receiver name</p>
        <p className="mt-1 text-xl font-black text-[#172f49]">
          {selectedDevice ? receiverDisplayName(selectedDevice) : "Receiver name will appear after pairing."}
        </p>
      </div>

      {isSelfContact ? (
        <ReceiverSetupStatus tone="warn">You can&apos;t send a message to yourself.</ReceiverSetupStatus>
      ) : (
        <ReceiverSetupStatus tone="warn">
          Send test message is not enabled in this installer yet because there is no dedicated safe
          test-message endpoint to reuse. The existing production messaging path was left untouched.
        </ReceiverSetupStatus>
      )}
    </section>
  );
}
