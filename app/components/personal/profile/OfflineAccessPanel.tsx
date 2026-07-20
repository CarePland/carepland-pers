"use client";

import { useEffect, useMemo, useState } from "react";

import {
  canRequestExtendedOfflineAccess,
  offlineAccessReasonCodes,
  offlineAuthorizationStorageKey,
  offlineDeviceIdStorageKey,
  offlineLastOnlineValidationStorageKey,
  STANDARD_OFFLINE_HOURS,
  EXTENDED_OFFLINE_DAYS,
  type OfflineAccessReasonCode,
  type OfflineAccessState,
  type OfflineAuthorizationRecord,
} from "../../../lib/platform/offlineAccess";
import { gentlePrimaryButtonClass } from "../../shared/uiStyles";

type OfflineAccessPanelProps = {
  accountId: string | null;
  getAuthHeaders: () => Promise<Record<string, string>>;
};

const reasonLabels: Record<OfflineAccessReasonCode, string> = {
  emergency_preparation: "Emergency preparation",
  hospital_or_care_facility: "Hospital or care facility",
  limited_internet_access: "Limited internet access",
  other: "Other",
  prefer_not_to_say: "Prefer not to say",
  travel: "Travel",
};

export function OfflineAccessPanel({
  accountId,
  getAuthHeaders,
}: OfflineAccessPanelProps) {
  const [deviceId, setDeviceId] = useState("");
  const [state, setState] = useState<OfflineAccessState | null>(null);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [reasonCode, setReasonCode] = useState<OfflineAccessReasonCode | "">(
    ""
  );
  const [confirming, setConfirming] = useState(false);
  const [message, setMessage] = useState("");

  const canRequest = useMemo(
    () => (state ? canRequestExtendedOfflineAccess(state) : false),
    [state]
  );

  useEffect(() => {
    setDeviceId(readOrCreateOfflineDeviceId());
  }, []);

  useEffect(() => {
    if (!accountId || !deviceId) return;

    let cancelled = false;
    const currentAccountId = accountId;
    const currentDeviceId = deviceId;

    async function loadState() {
      setLoading(true);
      setMessage("");
      try {
        const response = await fetch(
          `/api/personal/offline-access?accountId=${encodeURIComponent(
            currentAccountId
          )}&deviceId=${encodeURIComponent(currentDeviceId)}`,
          {
            headers: await getAuthHeaders(),
          }
        );
        const payload = await response.json();
        if (!response.ok || payload.ok === false) {
          throw new Error(
            payload.error || "CarePland could not load offline access."
          );
        }
        if (!cancelled) {
          setState(payload as OfflineAccessState);
          persistOfflineAuthorization(payload.activePass ?? null);
          recordSuccessfulOnlineValidation();
        }
      } catch (error) {
        if (!cancelled) {
          setMessage(
            error instanceof Error
              ? error.message
              : "CarePland could not load offline access."
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadState();

    return () => {
      cancelled = true;
    };
  }, [accountId, deviceId, getAuthHeaders]);

  async function submitRequest() {
    if (!accountId || !deviceId) return;

    setSubmitting(true);
    setMessage("");
    try {
      const response = await fetch(
        `/api/personal/offline-access?accountId=${encodeURIComponent(
          accountId
        )}&deviceId=${encodeURIComponent(deviceId)}`,
        {
          body: JSON.stringify({ reasonCode: reasonCode || null }),
          headers: {
            "Content-Type": "application/json",
            ...(await getAuthHeaders()),
          },
          method: "POST",
        }
      );
      const payload = await response.json();
      if (!response.ok || payload.ok === false) {
        throw new Error(
          payload.error ||
            "CarePland could not prepare extended offline access. Check your connection and try again."
        );
      }

      persistOfflineAuthorization(payload.activePass ?? null);
      recordSuccessfulOnlineValidation();
      setState((current) =>
        current
          ? {
              ...current,
              activePass: payload.activePass,
              nextEligibleAt: new Date(
                new Date(payload.activePass.issuedAt).getTime() +
                  current.policy.cooldownDays * 24 * 60 * 60 * 1000
              ).toISOString(),
            }
          : null
      );
      setConfirming(false);
      setMessage("Ready for offline use");
    } catch {
      setMessage(
        "CarePland could not prepare extended offline access. Check your connection and try again."
      );
    } finally {
      setSubmitting(false);
    }
  }

  const activePass = state?.activePass ?? null;
  const nextEligibleAt = state?.nextEligibleAt
    ? new Date(state.nextEligibleAt)
    : null;
  const nextEligibleCopy =
    nextEligibleAt && nextEligibleAt.getTime() > Date.now()
      ? `Extended offline access is available again on ${formatDateTime(
          nextEligibleAt
        )}.`
      : "";

  return (
    <section className="max-w-3xl rounded-md bg-white p-5 ring-1 ring-slate-200">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-xl font-semibold text-slate-950">
            Offline Access
          </h2>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-600">
            If you go offline, you can see everything already in CarePland for{" "}
            {STANDARD_OFFLINE_HOURS} hours.
          </p>
        </div>
        {loading ? (
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">
            Checking
          </span>
        ) : null}
      </div>

      {activePass ? (
        <div className="mt-4 rounded-md bg-blue-50 p-3 text-sm text-blue-950 ring-1 ring-blue-100">
          <p className="font-semibold">Extended offline access is active</p>
          <p className="mt-1">
            Available until {formatDateTime(new Date(activePass.expiresAt))}.
          </p>
          <p className="mt-2 text-blue-800">
            Reconnecting during this period will refresh CarePland and will not
            cancel your offline access.
          </p>
        </div>
      ) : state?.eligible ? (
        <div className="mt-4 grid gap-3">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">
              Planning to be offline more than {STANDARD_OFFLINE_HOURS} hours?
            </h3>
            <p className="mt-1 text-sm leading-6 text-slate-600">
              Prepare this device for up to {EXTENDED_OFFLINE_DAYS} days
              offline.
            </p>
          </div>
          {nextEligibleCopy ? (
            <p className="text-sm text-slate-600">{nextEligibleCopy}</p>
          ) : null}
          {canRequest ? (
            confirming ? (
              <div className="grid gap-3 rounded-md bg-slate-50 p-3 ring-1 ring-slate-200">
                <div>
                  <p className="text-sm font-semibold text-slate-950">
                    Planning to be offline?
                  </p>
                  <p className="mt-1 text-sm leading-6 text-slate-600">
                    Help us understand how people use offline access.
                  </p>
                </div>
                <label className="block text-sm font-medium text-slate-700">
                  I&apos;m going offline because...
                  <select
                    className="mt-2 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
                    onChange={(event) =>
                      setReasonCode(
                        event.target.value as OfflineAccessReasonCode | ""
                      )
                    }
                    value={reasonCode}
                  >
                    <option value="">(optional)</option>
                    {offlineAccessReasonCodes.map((code) => (
                      <option key={code} value={code}>
                        {reasonLabels[code]}
                      </option>
                    ))}
                  </select>
                </label>
                <div>
                  <p className="mt-1 text-sm leading-6 text-slate-600">
                    You&apos;ll have up to {EXTENDED_OFFLINE_DAYS} days of access to
                    information already available on this device. New
                    information and features that require a connection will
                    resume the next time you&apos;re online.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    className={gentlePrimaryButtonClass}
                    disabled={submitting}
                    onClick={() => void submitRequest()}
                    type="button"
                  >
                    {submitting ? "Preparing..." : "Prepare"}
                  </button>
                  <button
                    className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-600"
                    disabled={submitting}
                    onClick={() => setConfirming(false)}
                    type="button"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <button
                className={gentlePrimaryButtonClass}
                onClick={() => setConfirming(true)}
                type="button"
              >
                Prepare for offline use
              </button>
            )
          ) : null}
        </div>
      ) : state ? (
        <p className="mt-4 text-sm text-slate-600">
          Extended offline access is not included with this plan.
        </p>
      ) : null}

      {message ? (
        <p className="mt-3 text-sm font-medium text-slate-600">{message}</p>
      ) : null}
    </section>
  );
}

function readOrCreateOfflineDeviceId() {
  try {
    const existing = window.localStorage.getItem(offlineDeviceIdStorageKey);
    if (existing) return existing;

    const next =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `offline-device-${Date.now()}-${Math.random()
            .toString(36)
            .slice(2)}`;
    window.localStorage.setItem(offlineDeviceIdStorageKey, next);
    return next;
  } catch {
    return "";
  }
}

function persistOfflineAuthorization(
  authorization: OfflineAuthorizationRecord | null
) {
  try {
    if (!authorization) {
      window.localStorage.removeItem(offlineAuthorizationStorageKey);
      return;
    }
    window.localStorage.setItem(
      offlineAuthorizationStorageKey,
      JSON.stringify(authorization)
    );
  } catch {
    // Offline authorization storage is best effort on the device.
  }
}

function recordSuccessfulOnlineValidation() {
  try {
    window.localStorage.setItem(
      offlineLastOnlineValidationStorageKey,
      String(Date.now())
    );
  } catch {
    // Best effort only.
  }
}

function formatDateTime(date: Date) {
  try {
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(date);
  } catch {
    return date.toLocaleString();
  }
}
