"use client";

import { connectAuthHeaders } from "@/app/lib/connect/context/client";
import {
  browserReceiverPairingCodeReady,
  formatBrowserReceiverPairingCode,
  normalizeBrowserReceiverPairingCode,
} from "@/app/lib/connect/receiverShell/browserPairing";
import { LongOperationStatus } from "@/app/components/shared/LongOperationStatus";

import { ReceiverSetupStatus } from "./ReceiverSetupStatus";
import type { ReceiverSetupStepProps } from "./types";

export function ReceiverPairStep({
  draft,
  isReturningReceiverSetup,
  onCancelPairingChange,
  onPairingComplete,
  receiverUrl,
  selectedDevice,
  selectedUser,
  setDraft,
}: Pick<
  ReceiverSetupStepProps,
  | "draft"
  | "isReturningReceiverSetup"
  | "onCancelPairingChange"
  | "onPairingComplete"
  | "selectedDevice"
  | "selectedUser"
  | "setDraft"
> & {
  receiverUrl: string;
}) {
  const codeReady = browserReceiverPairingCodeReady(draft.pairingCode);
  const pairingReady = draft.pairingStatus === "paired" || Boolean(selectedDevice?.pairedAt);
  const readyMessage = isReturningReceiverSetup
    ? "This Receiver is already paired."
    : "Receiver paired successfully.";
  const receiverUserMissing = !selectedUser;

  async function checkCode() {
    const pairingCode = normalizeBrowserReceiverPairingCode(draft.pairingCode);
    if (!pairingCode) return;
    setDraft((current) => ({ ...current, pairingError: "", pairingStatus: "checking" }));
    try {
      const response = await fetch(
        `/api/connect/receiver-shell/pairing-sessions?code=${encodeURIComponent(
          pairingCode
        )}`,
        { cache: "no-store" }
      );
      const payload = (await response.json().catch(() => ({}))) as {
        error?: string;
        status?: string;
      };
      setDraft((current) => ({
        ...current,
        pairingError: response.ok ? "" : pairingErrorMessage(payload.error),
        pairingStatus:
          response.ok && payload.status === "paired"
            ? "paired"
            : response.ok
              ? "pending"
              : "error",
      }));
    } catch {
      setDraft((current) => ({
        ...current,
        pairingError: "CarePland could not check that code. Check the connection and try again.",
        pairingStatus: "error",
      }));
    }
  }

  async function pairReceiver() {
    if (!selectedUser?.id || !codeReady) return;
    const pairingCode = normalizeBrowserReceiverPairingCode(draft.pairingCode);
    setDraft((current) => ({ ...current, pairingError: "", pairingStatus: "pending" }));
    try {
      const response = await fetch("/api/connect/receiver-shell/pairing-sessions/pair", {
        body: JSON.stringify({
          deviceProfile: "web_receiver",
          hardwareProfile: "web",
          mainConnectUserPersonId: selectedUser.id,
          pairingCode,
          receiverUrl,
          targetReceiverDeviceId: selectedDevice?.id || selectedDevice?.receiverId,
          uiLayout: "default_receiver",
        }),
        cache: "no-store",
        headers: {
          ...(await connectAuthHeaders()),
          "Content-Type": "application/json",
        },
        method: "POST",
      });
      const payload = (await response.json().catch(() => ({}))) as {
        claim?: string;
        error?: string;
        ok?: boolean;
        receiverDeviceId?: string;
      };
      if (!response.ok || payload.ok === false) {
        throw new Error(payload.error || "Unable to pair Receiver.");
      }
      setDraft((current) => ({
        ...current,
        lastCompletedSection: "pair",
        nativeClaim: payload.claim || current.nativeClaim,
        pairingError: "",
        pairingStatus: "paired",
        selectedReceiverDeviceId: payload.receiverDeviceId || current.selectedReceiverDeviceId,
      }));
      void onPairingComplete().catch((error) => {
        console.warn("Receiver Setup could not refresh after pairing.", error);
      });
    } catch (error) {
      setDraft((current) => ({
        ...current,
        pairingError:
          error instanceof Error
            ? pairingErrorMessage(error.message)
            : "CarePland could not pair this Receiver. Check the code and try again.",
        pairingStatus: "error",
      }));
    }
  }

  return (
    <section className="mx-auto grid w-full max-w-2xl gap-6 py-6 text-center">
      <div>
        <h2 className="text-3xl font-black text-[#172f49]">Pair Receiver</h2>
        {!receiverUserMissing ? (
          <p className="mt-3 text-lg font-semibold leading-relaxed text-[#5f6e84]">
            Enter the six-digit code shown on the Receiver screen.
          </p>
        ) : null}
      </div>

      {receiverUserMissing ? (
        <button
          className="mx-auto max-w-xl px-2 py-3 text-center text-xl font-black leading-snug text-[#6f4d00] hover:underline focus:outline-none focus:ring-2 focus:ring-[#d9a441]"
          onClick={() => setDraft((current) => ({ ...current, section: "receiverUser" }))}
          type="button"
        >
          Choose who this Receiver is for before pairing.
        </button>
      ) : null}

      {pairingReady ? (
        <div className="grid justify-items-center gap-4">
          <ReceiverSetupStatus tone="good">{readyMessage}</ReceiverSetupStatus>
          <button
            className="min-h-12 rounded-lg border border-[#cbd9e7] bg-white px-5 text-base font-black text-[#173150] hover:bg-[#edf5fc] focus:outline-none focus:ring-2 focus:ring-[#4e84b2]"
            onClick={() =>
              setDraft((current) => ({
                ...current,
                pairingCode: "",
                pairingError: "",
                pairingStatus: "idle",
              }))
            }
            type="button"
          >
            Re-pair Receiver
          </button>
        </div>
      ) : !receiverUserMissing ? (
        <>
          <label className="mx-auto grid w-fit gap-3">
            <span className="sr-only">Enter the six-digit code shown on the Receiver screen.</span>
            <input
              autoComplete="one-time-code"
              className="h-16 w-[9ch] rounded-lg border border-[#cbd9e7] bg-white px-3 text-center text-3xl font-black tracking-normal text-[#172f49] outline-none focus:border-[#4e84b2] focus:ring-2 focus:ring-[#9fc6e8]"
              inputMode="numeric"
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  pairingCode: formatBrowserReceiverPairingCode(event.target.value),
                  pairingError: "",
                  pairingStatus: "idle",
                }))
              }
              placeholder="123 456"
              value={draft.pairingCode}
            />
          </label>

          <div className="flex flex-wrap justify-center gap-3">
            <button
              className="min-h-12 rounded-lg border border-[#cbd9e7] bg-white px-5 text-base font-black text-[#173150] hover:bg-[#edf5fc] focus:outline-none focus:ring-2 focus:ring-[#4e84b2] disabled:opacity-55"
              disabled={!codeReady || draft.pairingStatus === "checking"}
              onClick={() => void checkCode()}
              type="button"
            >
              {draft.pairingStatus === "checking" ? "Checking" : "Check Code"}
            </button>
            <button
              className="min-h-12 rounded-lg bg-[#2f6f9f] px-6 text-base font-black text-white hover:bg-[#285f89] focus:outline-none focus:ring-2 focus:ring-[#4e84b2] disabled:opacity-55"
              disabled={!selectedUser || !codeReady || draft.pairingStatus === "pending"}
              onClick={() => void pairReceiver()}
              type="button"
            >
              {draft.pairingStatus === "pending" ? "Pairing" : "Pair Receiver"}
            </button>
            {isReturningReceiverSetup ? (
              <button
                className="min-h-12 rounded-lg border border-[#cbd9e7] bg-white px-5 text-base font-black text-[#173150] hover:bg-[#edf5fc] focus:outline-none focus:ring-2 focus:ring-[#4e84b2]"
                onClick={onCancelPairingChange}
                type="button"
              >
                Cancel
              </button>
            ) : null}
          </div>
        </>
      ) : null}

      {draft.pairingStatus === "checking" ? (
        <LongOperationStatus
          allowDiagnostics
          className="mx-auto max-w-xl border-[#d6e3f2] bg-[#f8fbff] text-[#345d83]"
          delayMs={3000}
          escalationMs={45000}
          messages={[
            "Checking the Receiver screen code...",
            "This can take a moment if the Receiver just came online.",
            "A few careful moments later...",
            "Still checking. If the code expired, we will say so.",
          ]}
          onRetry={() => void checkCode()}
          operation="receiver_pairing"
          stage="checking_code"
          title="Checking code."
          verySlowMs={30000}
        />
      ) : draft.pairingStatus === "pending" ? (
        <LongOperationStatus
          allowDiagnostics
          className="mx-auto max-w-xl border-[#d6e3f2] bg-[#f8fbff] text-[#345d83]"
          delayMs={3000}
          escalationMs={45000}
          messages={[
            "Connecting this Receiver to the selected person...",
            "This can take a moment if the Receiver is finishing setup.",
            "A few careful moments later...",
            "Still pairing. The Receiver may need another moment.",
          ]}
          onRetry={() => void pairReceiver()}
          operation="receiver_pairing"
          stage="pairing_receiver"
          title="Pairing Receiver."
          verySlowMs={30000}
        />
      ) : draft.pairingStatus === "error" ? (
        <ReceiverSetupStatus tone="error">
          {draft.pairingError ||
            "Pairing code is invalid, expired, or unavailable. Check the Receiver screen and try again."}
        </ReceiverSetupStatus>
      ) : null}

    </section>
  );
}

function pairingErrorMessage(message?: string) {
  const trimmed = message?.trim();
  if (!trimmed) {
    return "Pairing code is invalid, expired, or unavailable. Check the Receiver screen and try again.";
  }
  if (/not found/i.test(trimmed)) {
    return "Pairing code was not found. Make sure the setup page and Receiver are using the same CarePland address, then try the code on the Receiver screen.";
  }
  return trimmed;
}
