export function carePlandSignInPath(returnTo?: string) {
  const params = new URLSearchParams({ personal: "1" });
  const safeReturnTo = normalizedReturnTo(returnTo);
  if (safeReturnTo) params.set("returnTo", safeReturnTo);
  return `/?${params.toString()}`;
}

export function carePlandSignInPathForCurrentLocation() {
  if (typeof window === "undefined") return carePlandSignInPath();
  return carePlandSignInPath(
    `${window.location.pathname}${window.location.search}${window.location.hash}`
  );
}

export function redirectToCarePlandSignIn(returnTo?: string) {
  if (typeof window === "undefined") return;
  window.location.assign(carePlandSignInPath(returnTo));
}

export function redirectToCarePlandSignInFromCurrentLocation() {
  if (typeof window === "undefined") return;
  window.location.assign(carePlandSignInPathForCurrentLocation());
}

export function carePlandReturnToFromCurrentLocation() {
  if (typeof window === "undefined") return "";
  return normalizedReturnTo(new URLSearchParams(window.location.search).get("returnTo") || "");
}

function normalizedReturnTo(value?: string) {
  const trimmed = value?.trim() || "";
  if (!trimmed.startsWith("/")) return "";
  if (trimmed.startsWith("//")) return "";
  return trimmed;
}
