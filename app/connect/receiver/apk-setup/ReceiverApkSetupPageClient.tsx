"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { ReceiverSetupOverlay } from "@/app/components/connect/receiverSetupOverlay/ReceiverSetupOverlay";
import {
  fetchConnectFocusPeople,
  fetchConnectMainUserContext,
} from "@/app/lib/connect/context/client";
import type { ConnectMainUserContext } from "@/app/lib/connect/context";
import { isConnectPetSubjectType } from "@/app/lib/connect/context/mainConnectUserEligibility";
import {
  fetchConnectProvisioningSnapshot,
  type ConnectProvisioningSnapshot,
} from "@/app/lib/connect/provisioning";

export function ReceiverApkSetupPageClient({
  initialPairingCode = "",
  initialReceiverUrl = "",
  selectedReceiverKey,
}: {
  initialPairingCode?: string;
  initialReceiverUrl?: string;
  selectedReceiverKey: string;
}) {
  const [connectContext, setConnectContext] = useState<ConnectMainUserContext | null>(null);
  const [provisioning, setProvisioning] = useState<ConnectProvisioningSnapshot | null>(null);
  const [status, setStatus] = useState("Loading Receiver setup...");

  const refresh = useCallback(async () => {
    setStatus("Loading Receiver setup...");
    const { nextContext, nextProvisioning } = await loadApkSetupData();
    setConnectContext(nextContext ? nextContext : null);
    setProvisioning(nextProvisioning);
    setStatus("Ready.");
  }, []);

  useEffect(() => {
    let cancelled = false;
    loadApkSetupData().then(({ nextContext, nextProvisioning }) => {
      if (cancelled) return;
      setConnectContext(nextContext);
      setProvisioning(nextProvisioning);
      setStatus("Ready.");
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const activeDevices = useMemo(
    () =>
      (provisioning?.receiverDevices ?? []).filter(
        (device) => device.revokedAt == null && device.status !== "revoked"
      ),
    [provisioning?.receiverDevices]
  );

  function closeSetup() {
    window.close();
    window.setTimeout(() => {
      if (!window.closed) {
        setStatus("You can close this Receiver Setup window.");
      }
    }, 150);
  }

  return (
    <main className="min-h-screen bg-black">
      {status !== "Ready." ? (
        <div className="grid min-h-screen place-items-center px-6 text-center">
          <p className="text-lg font-black text-white">{status}</p>
        </div>
      ) : null}
      <ReceiverSetupOverlay
        activeDevices={activeDevices}
        connectContext={connectContext}
        initialPairingCode={initialPairingCode}
        initialReceiverUrl={initialReceiverUrl}
        initialSection="start"
        onClose={closeSetup}
        onRefresh={refresh}
        open={status === "Ready."}
        selectedReceiverKey={selectedReceiverKey}
        startCloseLabel="Close window"
      />
    </main>
  );
}

async function loadApkSetupData() {
  const [contextResult, focusPeopleResult, provisioningResult] = await Promise.allSettled([
    fetchConnectMainUserContext(),
    fetchConnectFocusPeople(),
    fetchConnectProvisioningSnapshot({
      includeInactiveHouseholds: true,
    }),
  ]);
  const rawContext = settledValue(contextResult);
  const focusPeople = (settledValue(focusPeopleResult) ?? []).filter(
    (person) => !isConnectPetSubjectType(person.subjectType)
  );
  const nextContext = rawContext
    ? {
        ...rawContext,
        people: rawContext.people.length ? rawContext.people : focusPeople,
      }
    : null;
  const nextProvisioning = settledValue(provisioningResult);
  return { nextContext, nextProvisioning };
}

function settledValue<T>(result: PromiseSettledResult<T>) {
  return result.status === "fulfilled" ? result.value : null;
}
