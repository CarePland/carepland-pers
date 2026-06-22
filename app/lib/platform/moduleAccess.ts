export type CarePlandPlatformModule = "connect" | "family";

export type PlatformModuleVisibility = Record<CarePlandPlatformModule, boolean>;

export const platformModuleVisibilityOverrideStorageKey =
  "carepland-platform-show-all-modules:v1";
export const platformModuleVisibilityOverrideChangedEvent =
  "carepland-platform-module-visibility-changed";

type PlatformModuleVisibilityInput = {
  planTierId?: string | null;
  showAllOverride?: boolean;
};

export function getPlatformModuleVisibility({
  showAllOverride = false,
}: PlatformModuleVisibilityInput = {}): PlatformModuleVisibility {
  return {
    connect: true,
    family: showAllOverride,
  };
}

export function readShowAllPlatformModulesOverride(): boolean {
  if (typeof window === "undefined") {
    return false;
  }

  return (
    window.localStorage.getItem(platformModuleVisibilityOverrideStorageKey) ===
    "true"
  );
}

export function writeShowAllPlatformModulesOverride(enabled: boolean) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(
    platformModuleVisibilityOverrideStorageKey,
    enabled ? "true" : "false"
  );
  window.dispatchEvent(
    new CustomEvent(platformModuleVisibilityOverrideChangedEvent, {
      detail: { enabled },
    })
  );
}
