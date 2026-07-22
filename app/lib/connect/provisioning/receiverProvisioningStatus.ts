import type {
  ConnectProvisioningSnapshot,
  ConnectReceiverDevice,
} from "./types";

// Pure derivations over a Connect provisioning snapshot's receiver devices.
// These exist to remove duplicated, drifting device-shape handling from
// CarePlandPers.tsx -- they intentionally stay thin wrappers around the
// canonical ConnectReceiverDevice/ConnectProvisioningSnapshot contract rather
// than introducing a new client, hook, or state layer.

// Assumes /api/connect/provisioning returns receiverDevices at the top level
// of the snapshot, per app/api/connect/provisioning/route.ts (see
// shellProfileToReceiverDevice and its callers) -- there is no legacy
// `payload.provisioning.receiverDevices` nesting to fall back to. If the
// endpoint's response shape intentionally changes, update this function (and
// ConnectProvisioningSnapshot) to match the new contract rather than
// reintroducing a defensive/legacy-shape branch here.
export function normalizeReceiverDevices(
  snapshot: ConnectProvisioningSnapshot | null | undefined
): ConnectReceiverDevice[] {
  return Array.isArray(snapshot?.receiverDevices) ? snapshot.receiverDevices : [];
}

export function hasAnyBoundReceiverDevice(
  devices: ConnectReceiverDevice[]
): boolean {
  return devices.some((device) => device.status === "bound");
}
