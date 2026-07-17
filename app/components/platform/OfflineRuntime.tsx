"use client";

import { useEffect } from "react";

import {
  addHours,
  offlineAuthorizationStorageKey,
  offlineLastOnlineValidationStorageKey,
  STANDARD_OFFLINE_HOURS,
} from "../../lib/platform/offlineAccess";

const offlineSnapshotStorageKey = "carepland-offline-visible-snapshot:v1";
const offlineSnapshotRefreshMs = 15 * 1000;

export function OfflineRuntime() {
  useEffect(() => {
    if (typeof window === "undefined" || typeof document === "undefined") {
      return;
    }

    let lastSnapshotAt = 0;
    let refreshTimer: number | undefined;

    const captureSnapshot = () => {
      const now = Date.now();
      if (now - lastSnapshotAt < 1000) {
        return;
      }

      const main = document.querySelector("main");
      if (!main) {
        return;
      }

      const clonedMain = main.cloneNode(true);
      if (!(clonedMain instanceof HTMLElement)) {
        return;
      }

      preserveFormValues(main, clonedMain);
      makeSnapshotInert(clonedMain);
      recordOnlineValidationIfAvailable(now);

      const snapshot = {
        capturedAt: now,
        expiresAt: offlineUsableUntil(now),
        headHtml: snapshotHeadHtml(),
        html: clonedMain.outerHTML,
        path: window.location.pathname + window.location.search,
        title: document.title || "CarePland",
      };

      try {
        window.localStorage.setItem(
          offlineSnapshotStorageKey,
          JSON.stringify(snapshot)
        );
        lastSnapshotAt = now;
      } catch {
        // Browser storage can be unavailable or full; offline snapshots are best effort.
      }
    };

    const scheduleSnapshot = () => {
      window.clearTimeout(refreshTimer);
      refreshTimer = window.setTimeout(captureSnapshot, 250);
    };

    captureSnapshot();
    const intervalId = window.setInterval(captureSnapshot, offlineSnapshotRefreshMs);
    window.addEventListener("beforeunload", captureSnapshot);
    window.addEventListener("pagehide", captureSnapshot);
    window.addEventListener("offline", captureSnapshot);
    document.addEventListener("visibilitychange", captureSnapshot);
    document.addEventListener("click", scheduleSnapshot, true);
    document.addEventListener("input", scheduleSnapshot, true);
    document.addEventListener("change", scheduleSnapshot, true);

    return () => {
      window.clearInterval(intervalId);
      window.clearTimeout(refreshTimer);
      window.removeEventListener("beforeunload", captureSnapshot);
      window.removeEventListener("pagehide", captureSnapshot);
      window.removeEventListener("offline", captureSnapshot);
      document.removeEventListener("visibilitychange", captureSnapshot);
      document.removeEventListener("click", scheduleSnapshot, true);
      document.removeEventListener("input", scheduleSnapshot, true);
      document.removeEventListener("change", scheduleSnapshot, true);
    };
  }, []);

  useEffect(() => {
    if (
      process.env.NODE_ENV !== "production" ||
      typeof navigator === "undefined" ||
      !("serviceWorker" in navigator)
    ) {
      return;
    }

    void navigator.serviceWorker
      .register("/sw.js", {
        scope: "/",
        updateViaCache: "none",
      })
      .catch(() => {
        // Offline support is progressive enhancement; the app should keep running.
      });
  }, []);

  return null;
}

function offlineUsableUntil(now: number) {
  const activePassExpiresAt = activeOfflineAuthorizationExpiresAt(now);
  if (activePassExpiresAt) {
    return activePassExpiresAt;
  }

  return (
    addHours(
      new Date(readLastOnlineValidationAt() ?? now),
      STANDARD_OFFLINE_HOURS
    ).getTime()
  );
}

function activeOfflineAuthorizationExpiresAt(now: number) {
  try {
    const rawValue = window.localStorage.getItem(offlineAuthorizationStorageKey);
    if (!rawValue) return null;

    const parsed = JSON.parse(rawValue) as {
      expiresAt?: unknown;
      status?: unknown;
    };
    if (parsed.status !== "active" || typeof parsed.expiresAt !== "string") {
      return null;
    }

    const expiresAt = new Date(parsed.expiresAt).getTime();
    return Number.isFinite(expiresAt) && expiresAt > now ? expiresAt : null;
  } catch {
    return null;
  }
}

function readLastOnlineValidationAt() {
  try {
    const value = Number(
      window.localStorage.getItem(offlineLastOnlineValidationStorageKey)
    );

    return Number.isFinite(value) && value > 0 ? value : null;
  } catch {
    return null;
  }
}

function recordOnlineValidationIfAvailable(now: number) {
  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    return;
  }

  try {
    window.localStorage.setItem(
      offlineLastOnlineValidationStorageKey,
      String(now)
    );
  } catch {
    // Best effort only.
  }
}

function snapshotHeadHtml() {
  return Array.from(
    document.querySelectorAll<HTMLLinkElement | HTMLStyleElement>(
      'link[rel="stylesheet"], style'
    )
  )
    .map((element) => element.outerHTML)
    .join("\n");
}

function preserveFormValues(sourceRoot: Element, clonedRoot: HTMLElement) {
  const sourceFields = sourceRoot.querySelectorAll("input, textarea, select");
  const clonedFields = clonedRoot.querySelectorAll("input, textarea, select");

  sourceFields.forEach((sourceField, index) => {
    const clonedField = clonedFields[index];
    if (!clonedField) return;

    if (sourceField instanceof HTMLInputElement) {
      const clonedInput = clonedField as HTMLInputElement;
      if (sourceField.type === "checkbox" || sourceField.type === "radio") {
        if (sourceField.checked) {
          clonedInput.setAttribute("checked", "");
        } else {
          clonedInput.removeAttribute("checked");
        }
      } else {
        clonedInput.setAttribute("value", sourceField.value);
      }
      return;
    }

    if (sourceField instanceof HTMLTextAreaElement) {
      clonedField.textContent = sourceField.value;
      return;
    }

    if (sourceField instanceof HTMLSelectElement) {
      const clonedSelect = clonedField as HTMLSelectElement;
      Array.from(sourceField.options).forEach((sourceOption, optionIndex) => {
        const clonedOption = clonedSelect.options[optionIndex];
        if (!clonedOption) return;
        if (sourceOption.selected) {
          clonedOption.setAttribute("selected", "");
        } else {
          clonedOption.removeAttribute("selected");
        }
      });
    }
  });
}

function makeSnapshotInert(root: HTMLElement) {
  root.querySelectorAll("script").forEach((element) => element.remove());
  root.querySelectorAll("button, input, textarea, select").forEach((element) => {
    element.setAttribute("disabled", "");
    element.setAttribute("aria-disabled", "true");
  });
  root.querySelectorAll("a").forEach((element) => {
    element.setAttribute("aria-disabled", "true");
    element.removeAttribute("href");
  });
}
