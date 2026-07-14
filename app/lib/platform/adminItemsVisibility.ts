export const adminItemsVisibilityStorageKey = "carepland-show-admin-items:v1";
export const adminItemsVisibilityChangedEvent =
  "carepland-admin-items-visibility-changed";

export function readShowAdminItemsPreference() {
  if (typeof window === "undefined") {
    return true;
  }

  return window.localStorage.getItem(adminItemsVisibilityStorageKey) !== "false";
}

export function writeShowAdminItemsPreference(enabled: boolean) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(
    adminItemsVisibilityStorageKey,
    enabled ? "true" : "false"
  );
  window.dispatchEvent(
    new CustomEvent(adminItemsVisibilityChangedEvent, {
      detail: { enabled },
    })
  );
}
