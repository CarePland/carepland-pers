"use client";

import { useState } from "react";

import type { ReceiverSetupMetadata, ReceiverSetupStepProps } from "./types";
import { ReceiverQrCard } from "./ReceiverQrCard";
import { ReceiverSetupStatus } from "./ReceiverSetupStatus";
import { absoluteUrl, safeApkFilename } from "./utils";

export function ReceiverInstallStep({
  browserOrigin,
  copyText,
  draft,
  installModeLock,
  metadata,
  receiverUrl,
  setDraft,
}: Pick<ReceiverSetupStepProps, "draft" | "setDraft"> & {
  browserOrigin: string;
  copyText: (value: string, label: string) => Promise<void>;
  installModeLock?: "android";
  metadata: ReceiverSetupMetadata | null;
  receiverUrl: string;
}) {
  const apkUrl = absoluteUrl(metadata?.apkDownloadUrl ?? "", browserOrigin);
  const apkFilename = safeApkFilename(metadata?.apkVersionName ?? "");
  const installMode = installModeLock ?? draft.installMode ?? "web";
  const showInstallModeSelector = !installModeLock && !draft.installMode;
  const [showAndroidUrl, setShowAndroidUrl] = useState(false);
  const [showBrowserUrl, setShowBrowserUrl] = useState(false);

  return (
    <section className="grid gap-5">
      {showInstallModeSelector ? (
        <div className="mx-auto grid w-full max-w-xl grid-cols-2 rounded-xl border border-[#cbd9e7] bg-white p-1 shadow-sm">
          {[
            { label: "Browser Link", value: "web" },
            { label: "Android App", value: "android" },
          ].map((option) => (
            <button
              aria-pressed={installMode === option.value}
              className={`min-h-12 rounded-lg px-4 text-base font-black transition focus:outline-none focus:ring-2 focus:ring-[#4e84b2] ${
                installMode === option.value
                  ? "bg-[#2f6f9f] text-white shadow-sm"
                  : "text-[#173150] hover:bg-[#edf5fc]"
              }`}
              key={option.value}
              onClick={() =>
                setDraft((current) => ({
                  ...current,
                  installMode: option.value as "android" | "web",
                }))
              }
              type="button"
            >
              {option.label}
            </button>
          ))}
        </div>
      ) : null}

      {installMode === "web" ? (
        <div className="mx-auto grid w-full max-w-4xl gap-6 py-4">
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-stretch">
            <div className="grid min-w-0 content-start gap-6 py-1">
              <h3 className="text-3xl font-black text-[#172f49]">Browser Link</h3>
              <p className="max-w-2xl text-xl font-semibold leading-relaxed text-[#5f6e84]">
                Use Receiver in a browser on your device.
              </p>
              <div className="flex flex-wrap gap-4">
                <a
                  className="grid min-h-[3.75rem] place-items-center rounded-lg bg-[#2f6f9f] px-7 text-lg font-black text-white hover:bg-[#285f89] focus:outline-none focus:ring-2 focus:ring-[#4e84b2]"
                  href={receiverUrl}
                  rel="noreferrer"
                  target="_blank"
                >
                  Open Receiver
                </a>
                <button
                  className="min-h-[3.75rem] rounded-lg border border-[#cbd9e7] bg-white px-7 text-lg font-black text-[#173150] hover:bg-[#edf5fc] focus:outline-none focus:ring-2 focus:ring-[#4e84b2]"
                  onClick={() => copyText(receiverUrl, "Receiver link copied.")}
                  type="button"
                >
                  Copy Link
                </button>
                <button
                  aria-expanded={showBrowserUrl}
                  className="min-h-[3.75rem] rounded-lg border border-[#cbd9e7] bg-white px-7 text-lg font-black text-[#173150] hover:bg-[#edf5fc] focus:outline-none focus:ring-2 focus:ring-[#4e84b2]"
                  onClick={() => setShowBrowserUrl((current) => !current)}
                  type="button"
                >
                  {showBrowserUrl ? "Hide URL" : "Show URL"}
                </button>
              </div>
              {showBrowserUrl ? (
                <p className="mt-4 max-w-xl break-all rounded-lg bg-[#f8fbff] px-4 py-3 text-base font-bold leading-relaxed text-[#345d83]">
                  {receiverUrl}
                </p>
              ) : null}
            </div>
            <ReceiverQrCard
              appearance="open"
              copyLabel="Copy Receiver Link"
              details="qrOnly"
              label="Receiver Link"
              onCopy={() => copyText(receiverUrl, "Receiver link copied.")}
              qrSize="large"
              text={receiverUrl}
            />
          </div>
        </div>
      ) : (
        <div className="mx-auto grid w-full max-w-4xl gap-6 py-4">
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-stretch">
            <div className="grid min-w-0 content-start gap-8 py-2">
              <h3 className="text-3xl font-black text-[#172f49]">Android App</h3>
              {apkUrl ? (
                <div className="flex flex-wrap gap-4">
                  <a
                    className="grid min-h-16 place-items-center rounded-lg bg-[#2f6f9f] px-7 text-lg font-black text-white hover:bg-[#285f89] focus:outline-none focus:ring-2 focus:ring-[#4e84b2]"
                    download={apkFilename}
                    href={metadata?.apkDownloadUrl || apkUrl}
                  >
                    Download APK
                  </a>
                  <button
                    className="min-h-16 rounded-lg border border-[#cbd9e7] bg-white px-7 text-lg font-black text-[#173150] hover:bg-[#edf5fc] focus:outline-none focus:ring-2 focus:ring-[#4e84b2]"
                    onClick={() => copyText(apkUrl, "APK link copied.")}
                    type="button"
                  >
                    Copy APK Link
                  </button>
                  <button
                    aria-expanded={showAndroidUrl}
                    className="min-h-16 rounded-lg border border-[#cbd9e7] bg-white px-7 text-lg font-black text-[#173150] hover:bg-[#edf5fc] focus:outline-none focus:ring-2 focus:ring-[#4e84b2]"
                    onClick={() => setShowAndroidUrl((current) => !current)}
                    type="button"
                  >
                    {showAndroidUrl ? "Hide APK URL" : "Show APK URL"}
                  </button>
                </div>
              ) : (
                <div>
                  <ReceiverSetupStatus tone="warn">
                    APK download is not configured. You can still use the Browser Link.
                  </ReceiverSetupStatus>
                </div>
              )}
              <div className="flex min-h-10 flex-wrap items-center gap-x-3 gap-y-1 text-lg font-bold text-[#5f6e84]">
                <span>
                  APK version{" "}
                  <span className="font-black text-[#345d83]">
                    {metadata?.apkVersionName || "Build not listed"}
                  </span>
                </span>
                <span aria-hidden="true" className="text-[#9aa8ba]">·</span>
                <button
                  className="font-black text-[#173150] underline-offset-2 hover:text-[#2f6f9f] hover:underline focus:outline-none focus:ring-2 focus:ring-[#4e84b2]"
                  onClick={() => setDraft((current) => ({ ...current, section: "advancedAndroid" }))}
                  type="button"
                >
                  Advanced Android Setup
                </button>
              </div>
              {showAndroidUrl && apkUrl ? (
                <p className="mt-4 max-w-xl break-all rounded-lg bg-[#f8fbff] px-4 py-3 text-base font-bold leading-relaxed text-[#345d83]">
                  {apkUrl}
                </p>
              ) : null}
            </div>
            {apkUrl ? (
              <ReceiverQrCard
                appearance="open"
                copyLabel="Copy APK Link"
                details="qrOnly"
                label="APK Link"
                onCopy={() => copyText(apkUrl, "APK link copied.")}
                qrSize="large"
                text={apkUrl}
              />
            ) : null}
          </div>
        </div>
      )}
    </section>
  );
}
