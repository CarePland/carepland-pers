"use client";

import { FormEvent } from "react";
import { InlineConfirmation } from "../shared/InlineConfirmation";

type AskMessage = {
  body: string;
  role: "assistant" | "user";
};

type UnsavedChange = {
  detail?: string;
  key: string;
  label: string;
};

type LocationSheetAppointment = {
  location_address: string | null;
  location_phone: string | null;
  provider_name: string | null;
};

type PersonalOverlaysProps = {
  askCloseConfirmOpen: boolean;
  askConversationComplete: boolean;
  askGuidanceText: string;
  askInput: string;
  askInputPlaceholder: string;
  askMessages: AskMessage[];
  askPanelError: string;
  askPanelOpen: boolean;
  canUseAskPanel: boolean;
  careplandBuildDttm: string;
  careplandBuildNumber: string;
  gentlePrimaryButtonClass: string;
  gentleWarmButtonClass: string;
  locationSheetAppointment: LocationSheetAppointment | null;
  locationSheetMapsLink: string | null;
  locationSheetPhoneHref: string | null;
  locationSheetPracticeLabel: string;
  onCancelPendingMainTabChange: () => void;
  onCloseAskPanel: () => void;
  onCloseLocationSheet: () => void;
  onConfirmPendingMainTabChange: () => void;
  onConfirmSignOut: () => void;
  onResetAskPanelState: () => void;
  onSetAskCloseConfirmOpen: (open: boolean) => void;
  onSetAskInput: (value: string) => void;
  onSetShowVersionInfo: (show: boolean) => void;
  onSetSignOutConfirmOpen: (open: boolean) => void;
  onSubmitAskMessage: (event: FormEvent<HTMLFormElement>) => void;
  runtimeEnvironmentLabel: string;
  sendingAskMessage: boolean;
  showPendingMainTabConfirm: boolean;
  showVersionInfo: boolean;
  signOutConfirmOpen: boolean;
  unsavedSignOutChanges: UnsavedChange[];
};

export function PersonalOverlays({
  askCloseConfirmOpen,
  askConversationComplete,
  askGuidanceText,
  askInput,
  askInputPlaceholder,
  askMessages,
  askPanelError,
  askPanelOpen,
  canUseAskPanel,
  careplandBuildDttm,
  careplandBuildNumber,
  gentlePrimaryButtonClass,
  gentleWarmButtonClass,
  locationSheetAppointment,
  locationSheetMapsLink,
  locationSheetPhoneHref,
  locationSheetPracticeLabel,
  onCancelPendingMainTabChange,
  onCloseAskPanel,
  onCloseLocationSheet,
  onConfirmPendingMainTabChange,
  onConfirmSignOut,
  onResetAskPanelState,
  onSetAskCloseConfirmOpen,
  onSetAskInput,
  onSetShowVersionInfo,
  onSetSignOutConfirmOpen,
  onSubmitAskMessage,
  runtimeEnvironmentLabel,
  sendingAskMessage,
  showPendingMainTabConfirm,
  showVersionInfo,
  signOutConfirmOpen,
  unsavedSignOutChanges,
}: PersonalOverlaysProps) {
  return (
    <>
      {canUseAskPanel && askPanelOpen ? (
        <>
          <button
            aria-label="Close Ask panel"
            className="fixed inset-0 z-[65] cursor-default bg-transparent"
            onClick={onCloseAskPanel}
            type="button"
          />
          <section
            aria-label="Ask panel"
            className="fixed inset-x-3 top-16 z-[70] max-h-[calc(100vh-5rem)] overflow-y-auto rounded-2xl border border-blue-100 bg-blue-50 p-5 shadow-xl sm:left-auto sm:right-5 sm:top-20 sm:w-[min(32rem,calc(100vw-2.5rem))]"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-xl font-semibold text-slate-950">Ask</h2>
                <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-600">
                  {askGuidanceText}
                </p>
              </div>
              <button
                className="rounded px-1 py-0.5 text-sm font-semibold text-slate-500 underline-offset-2 hover:text-slate-800 hover:underline focus:outline-none focus:ring-2 focus:ring-blue-200"
                onClick={onCloseAskPanel}
                type="button"
              >
                Close
              </button>
            </div>

            {askCloseConfirmOpen ? (
              <InlineConfirmation
                cancelLabel="Keep writing"
                className="mt-4 shadow-sm"
                confirmLabel="Discard and close"
                message="This Ask has unsent text or an active conversation. Close it and discard what is here?"
                onCancel={() => onSetAskCloseConfirmOpen(false)}
                onConfirm={onResetAskPanelState}
              />
            ) : null}

            {askMessages.length > 0 ? (
              <div className="mt-6 space-y-2">
                {askMessages.map((askMessage, index) => (
                  <div
                    className={`max-w-[min(100%,42rem)] rounded-xl px-4 py-3 text-sm leading-relaxed ${
                      askMessage.role === "user"
                        ? "ml-auto border border-blue-100 bg-blue-50 text-slate-950"
                        : "border border-blue-100 bg-white/85 text-slate-700"
                    }`}
                    key={`${askMessage.role}-${index}`}
                  >
                    <p className="whitespace-pre-wrap">{askMessage.body}</p>
                  </div>
                ))}
              </div>
            ) : null}

            {askPanelError ? (
              <p className="mt-4 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-950">
                {askPanelError}
              </p>
            ) : null}

            {!askConversationComplete ? (
              <form className="mt-8" onSubmit={onSubmitAskMessage}>
                <label className="sr-only" htmlFor="ask-message">
                  {askInputPlaceholder}
                </label>
                <textarea
                  className="min-h-36 w-full rounded-xl border border-[#d8e0dc] bg-white px-4 py-4 text-base leading-relaxed text-slate-900 shadow-inner outline-none transition placeholder:text-slate-400 focus:border-blue-300 focus:ring-4 focus:ring-blue-100"
                  disabled={sendingAskMessage}
                  id="ask-message"
                  onChange={(event) => {
                    onSetAskInput(event.target.value);
                    onSetAskCloseConfirmOpen(false);
                  }}
                  placeholder={askInputPlaceholder}
                  value={askInput}
                />
                <div className="mt-3 flex items-center justify-end">
                  <button
                    className={`${gentlePrimaryButtonClass} px-5 py-2.5 text-sm`}
                    disabled={sendingAskMessage || !askInput.trim()}
                    type="submit"
                  >
                    {sendingAskMessage ? "Sending..." : "Send"}
                  </button>
                </div>
              </form>
            ) : null}
          </section>
        </>
      ) : null}

      {showPendingMainTabConfirm ? (
        <div className="fixed inset-0 z-[95] flex items-center justify-center bg-slate-950/20 px-4 py-6">
          <button
            aria-label="Stay on this page"
            className="absolute inset-0 cursor-default"
            onClick={onCancelPendingMainTabChange}
            type="button"
          />
          <section className="relative w-full max-w-lg rounded-xl border border-blue-200 bg-[#f4faff] p-5 text-blue-950 shadow-lg">
            <div>
              <h2 className="text-xl font-semibold text-slate-950">
                You have unfinished work
              </h2>
              <p className="mt-2 text-sm leading-6 text-slate-700">
                Changing pages will discard this unfinished work.
              </p>
            </div>
            {unsavedSignOutChanges.length > 0 ? (
              <ul className="mt-4 max-h-64 space-y-2 overflow-y-auto pr-1">
                {unsavedSignOutChanges.map((change) => (
                  <li
                    className="rounded-lg border border-blue-100 bg-white/75 px-3 py-2 text-sm"
                    key={change.key}
                  >
                    <span className="font-semibold text-slate-950">
                      {change.label}
                    </span>
                    {change.detail ? (
                      <span className="ml-2 text-slate-600">
                        {change.detail}
                      </span>
                    ) : null}
                  </li>
                ))}
              </ul>
            ) : null}
            <div className="mt-5 flex flex-wrap items-center justify-end gap-3">
              <button
                className="rounded-md px-2 py-1 text-sm font-semibold text-blue-700 transition hover:bg-blue-100/70 hover:text-blue-900"
                onClick={onCancelPendingMainTabChange}
                type="button"
              >
                Go back
              </button>
              <button
                className={gentlePrimaryButtonClass}
                onClick={onConfirmPendingMainTabChange}
                type="button"
              >
                Discard and continue
              </button>
            </div>
          </section>
        </div>
      ) : null}

      {signOutConfirmOpen ? (
        <div className="fixed inset-0 z-[95] flex items-center justify-center bg-slate-950/20 px-4 py-6">
          <button
            aria-label="Review unsaved changes"
            className="absolute inset-0 cursor-default"
            onClick={() => onSetSignOutConfirmOpen(false)}
            type="button"
          />
          <section className="relative w-full max-w-lg rounded-xl border border-blue-200 bg-[#f4faff] p-5 text-blue-950 shadow-lg">
            <div>
              <h2 className="text-xl font-semibold text-slate-950">
                You have unsaved changes
              </h2>
              <p className="mt-2 text-sm leading-6 text-slate-700">
                Signing out will discard this work.
              </p>
            </div>
            {unsavedSignOutChanges.length > 0 ? (
              <ul className="mt-4 max-h-64 space-y-2 overflow-y-auto pr-1">
                {unsavedSignOutChanges.map((change) => (
                  <li
                    className="rounded-lg border border-blue-100 bg-white/75 px-3 py-2 text-sm"
                    key={change.key}
                  >
                    <span className="font-semibold text-slate-950">
                      {change.label}
                    </span>
                    {change.detail ? (
                      <span className="ml-2 text-slate-600">
                        {change.detail}
                      </span>
                    ) : null}
                  </li>
                ))}
              </ul>
            ) : null}
            <div className="mt-5 flex flex-wrap items-center justify-end gap-3">
              <button
                className="rounded-md px-2 py-1 text-sm font-semibold text-blue-700 transition hover:bg-blue-100/70 hover:text-blue-900"
                onClick={() => onSetSignOutConfirmOpen(false)}
                type="button"
              >
                Go back
              </button>
              <button
                className={gentleWarmButtonClass}
                onClick={onConfirmSignOut}
                type="button"
              >
                Discard and sign out
              </button>
            </div>
          </section>
        </div>
      ) : null}

      <button
        className="fixed bottom-2 left-2 z-[60] rounded px-2 py-1 text-[11px] font-semibold text-slate-300 hover:bg-white hover:text-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-300"
        onClick={() => onSetShowVersionInfo(true)}
        title="Show version info"
        type="button"
      >
        Version
      </button>
      {showVersionInfo ? (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/20 px-4 py-6">
          <button
            aria-label="Close version information"
            className="absolute inset-0 cursor-default"
            onClick={() => onSetShowVersionInfo(false)}
            type="button"
          />
          <section className="relative w-full max-w-sm rounded-lg border border-slate-200 bg-white p-5 text-slate-900 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-semibold uppercase tracking-wide text-blue-700">
                  CarePland
                </p>
                <h2 className="mt-1 text-xl font-semibold">Version info</h2>
              </div>
              <button
                className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-semibold text-slate-700"
                onClick={() => onSetShowVersionInfo(false)}
                type="button"
              >
                Close
              </button>
            </div>
            <dl className="mt-5 space-y-3 text-sm">
              <div>
                <dt className="font-semibold text-slate-500">Build number</dt>
                <dd className="mt-1 break-all font-mono text-slate-950">
                  {careplandBuildNumber}
                </dd>
              </div>
              <div>
                <dt className="font-semibold text-slate-500">Build time</dt>
                <dd className="mt-1 text-slate-950">{careplandBuildDttm}</dd>
              </div>
              <div>
                <dt className="font-semibold text-slate-500">Environment</dt>
                <dd className="mt-1 text-slate-950">
                  {runtimeEnvironmentLabel || "Production"}
                </dd>
              </div>
              <div>
                <dt className="font-semibold text-slate-500">Host</dt>
                <dd className="mt-1 break-all text-slate-950">
                  {typeof window === "undefined"
                    ? "Unknown"
                    : window.location.hostname}
                </dd>
              </div>
            </dl>
          </section>
        </div>
      ) : null}

      {locationSheetAppointment ? (
        <div className="fixed inset-0 z-[70] flex items-end bg-slate-950/20 px-3 pb-3">
          <button
            aria-label="Close location details"
            className="absolute inset-0 cursor-default"
            onClick={onCloseLocationSheet}
            type="button"
          />
          <section className="relative mx-auto w-full max-w-[900px] rounded-t-2xl border border-slate-200 bg-white p-5 shadow-2xl">
            <div className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-slate-300" />
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-xl font-semibold text-slate-950">
                  {locationSheetPracticeLabel || "Appointment location"}
                </h2>
                {locationSheetAppointment.provider_name ? (
                  <p className="mt-1 text-sm font-medium text-slate-700">
                    {locationSheetAppointment.provider_name}
                  </p>
                ) : null}
              </div>
              <button
                className="rounded-md border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-600"
                onClick={onCloseLocationSheet}
                type="button"
              >
                Close
              </button>
            </div>
            <div className="mt-4 space-y-2 text-sm text-slate-700">
              {locationSheetAppointment.location_address ? (
                <p>{locationSheetAppointment.location_address}</p>
              ) : null}
              {locationSheetAppointment.location_phone ? (
                <p>{locationSheetAppointment.location_phone}</p>
              ) : null}
            </div>
            <div className="mt-5 flex flex-wrap gap-2">
              {locationSheetMapsLink ? (
                <a
                  className="rounded-md bg-blue-700 px-4 py-2 text-sm font-semibold text-white"
                  href={locationSheetMapsLink}
                  rel="noreferrer"
                  target="_blank"
                >
                  Maps
                </a>
              ) : null}
              {locationSheetPhoneHref ? (
                <a
                  className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700"
                  href={locationSheetPhoneHref}
                >
                  Call
                </a>
              ) : null}
            </div>
          </section>
        </div>
      ) : null}
    </>
  );
}
