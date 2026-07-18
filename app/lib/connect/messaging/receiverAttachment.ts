type ReceiverAttachmentDevice = {
  active?: boolean;
  mainConnectUserPersonId?: string;
  pairedAt?: string;
  provisioningCompletedAt?: string;
  receiverInstallId?: string;
  status?: string;
};

const attachedReceiverStatuses = new Set(["active", "bound", "claim_pending", "connected"]);

export function personHasAttachedReceiver(
  devices: ReceiverAttachmentDevice[] | null | undefined,
  personId: string
) {
  const normalizedPersonId = personId.trim();
  if (!normalizedPersonId) return false;

  return (devices ?? []).some((device) => {
    if (device.active === false || device.status === "revoked") return false;
    if (device.mainConnectUserPersonId?.trim() !== normalizedPersonId) return false;

    const status = device.status?.trim() || "";
    return (
      attachedReceiverStatuses.has(status) ||
      Boolean(device.pairedAt || device.provisioningCompletedAt || device.receiverInstallId)
    );
  });
}
