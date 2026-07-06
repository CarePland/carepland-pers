import type { ConnectMainUserContext, ConnectPersPerson } from "../context";

export type BrowserReceiverPairingPersonResolution =
  | {
      ok: true;
      person: ConnectPersPerson;
      personId: string;
    }
  | {
      error: string;
      ok: false;
      status: number;
    };

export function normalizeBrowserReceiverPairingCode(value: string) {
  return value.replace(/\D/g, "").slice(0, 6);
}

export function formatBrowserReceiverPairingCode(value: string) {
  const normalized = normalizeBrowserReceiverPairingCode(value);
  if (normalized.length <= 3) return normalized;
  return `${normalized.slice(0, 3)} ${normalized.slice(3)}`;
}

export function browserReceiverPairingCodeReady(value: string) {
  return normalizeBrowserReceiverPairingCode(value).length === 6;
}

export function resolveBrowserReceiverPairingPerson(
  connectContext: ConnectMainUserContext,
  requestedPersonId?: string
): BrowserReceiverPairingPersonResolution {
  const personId = requestedPersonId?.trim() || connectContext.mainConnectUserPersonId || "";
  const person = connectContext.people.find((item) => item.id === personId);

  if (!personId || !person) {
    return {
      error: "Choose a Main Connect User before pairing this Receiver.",
      ok: false,
      status: 400,
    };
  }

  return {
    ok: true,
    person,
    personId,
  };
}
