import {
  filterCallsForMainConnectUser,
  mergeConnectCalls,
  type ConnectCallRecord,
} from "../callScoping";

export function callsVisibleToConnectSurface({
  accessType,
  persistedCalls,
  personId,
  prototypeCalls,
}: {
  accessType: "receiver_device" | "user";
  persistedCalls: ConnectCallRecord[];
  personId: string;
  prototypeCalls: ConnectCallRecord[];
}) {
  const persistedPersonCalls = filterCallsForMainConnectUser(persistedCalls, personId);

  if (accessType === "receiver_device" || persistedPersonCalls.length > 0) {
    return persistedPersonCalls;
  }

  return filterCallsForMainConnectUser(
    mergeConnectCalls(persistedCalls, prototypeCalls),
    personId
  );
}
