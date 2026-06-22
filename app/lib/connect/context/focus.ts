import { allCarePlandFocusValue } from "../../platform/focus";

export type ConnectFocusResolutionInput = {
  connectTargetPersonId?: string | null;
  fallbackPersonId?: string | null;
  globalFocusId?: string | null;
  savedMainConnectUserPersonId?: string | null;
};

function normalizeFocusId(value?: string | null) {
  return value?.trim() ?? "";
}

export function resolveActiveConnectPersonId({
  connectTargetPersonId,
  fallbackPersonId,
  globalFocusId,
  savedMainConnectUserPersonId,
}: ConnectFocusResolutionInput) {
  const normalizedGlobalFocusId = normalizeFocusId(globalFocusId);

  if (
    normalizedGlobalFocusId &&
    normalizedGlobalFocusId !== allCarePlandFocusValue
  ) {
    return normalizedGlobalFocusId;
  }

  return (
    normalizeFocusId(connectTargetPersonId) ||
    normalizeFocusId(savedMainConnectUserPersonId) ||
    normalizeFocusId(fallbackPersonId)
  );
}
