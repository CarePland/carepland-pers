"use client";

import { useMemo, useState } from "react";

import { ReceiverQrCard } from "./ReceiverQrCard";
import { ReceiverSetupStatus } from "./ReceiverSetupStatus";
import type { ReceiverSetupMetadata } from "./types";
import { absoluteUrl, ownerProvisioningPayload, wifiQrPayload } from "./utils";

const androidProfileOptions = [
  {
    deviceProfile: "android_receiver",
    hardwareProfile: "generic_landscape_android",
    label: "Generic Android Receiver",
    uiLayout: "default_receiver",
  },
  {
    deviceProfile: "gxv3370",
    hardwareProfile: "studio_gxv3370_1024x600",
    label: "GXV test receiver",
    uiLayout: "desk_phone_1024x600",
  },
] as const;

export function AdvancedAndroidSetupPanel({
  browserOrigin,
  copyText,
  metadata,
  provisioningUrl,
  receiverUrl,
}: {
  browserOrigin: string;
  copyText: (value: string, label: string) => Promise<void>;
  metadata: ReceiverSetupMetadata | null;
  provisioningUrl: string;
  receiverUrl: string;
}) {
  const initialProvisioningCode = useMemo(
    () => setupCodeFromProvisioningUrl(provisioningUrl),
    [provisioningUrl]
  );
  const [deviceProfile, setDeviceProfile] = useState<string>(
    androidProfileOptions[0].deviceProfile
  );
  const [hardwareProfile, setHardwareProfile] = useState<string>(
    androidProfileOptions[0].hardwareProfile
  );
  const [setupCode, setSetupCode] = useState(initialProvisioningCode);
  const [uiLayout, setUiLayout] = useState<string>(androidProfileOptions[0].uiLayout);
  const [wifiPassword, setWifiPassword] = useState("");
  const [wifiSecurity, setWifiSecurity] = useState("WPA");
  const [wifiSsid, setWifiSsid] = useState("");
  const apkUrl = absoluteUrl(metadata?.apkDownloadUrl ?? "", browserOrigin);
  const advancedProvisioningUrl = useMemo(
    () =>
      receiverProvisioningUrl({
        deviceProfile,
        hardwareProfile,
        receiverUrl,
        setupCode,
        uiLayout,
      }),
    [deviceProfile, hardwareProfile, receiverUrl, setupCode, uiLayout]
  );
  const emulatorCommand = useMemo(
    () => emulatorFallbackCommand(advancedProvisioningUrl),
    [advancedProvisioningUrl]
  );
  const wifiPayload = useMemo(
    () => wifiQrPayload(wifiSsid, wifiPassword, wifiSecurity),
    [wifiPassword, wifiSecurity, wifiSsid]
  );
  const ownerPayload = useMemo(
    () =>
      ownerProvisioningPayload({
        apkSha256Checksum: metadata?.apkSha256Checksum ?? "",
        apkUrl,
        hardwareProfile,
        provisioningUrl: advancedProvisioningUrl,
        receiverUrl,
        uiLayout,
        wifiPassword,
        wifiSecurity,
        wifiSsid,
      }),
    [
      apkUrl,
      advancedProvisioningUrl,
      hardwareProfile,
      metadata?.apkSha256Checksum,
      receiverUrl,
      uiLayout,
      wifiPassword,
      wifiSecurity,
      wifiSsid,
    ]
  );

  return (
    <section className="grid gap-5">
      <div>
        <h2 className="text-2xl font-black text-[#172f49]">Advanced Android Setup</h2>
        <p className="mt-2 text-base font-semibold leading-relaxed text-[#5f6e84]">
          These tools are for dedicated Android devices and should not be needed for normal setup.
        </p>
      </div>

      <div className="rounded-lg border border-[#d6e3f2] bg-white p-4">
        <h3 className="text-lg font-black text-[#172f49]">Receiver app profile</h3>
        <div className="mt-4 grid gap-3">
          <label className="grid gap-1">
            <span className="text-sm font-black text-[#345d83]">Setup code</span>
            <input
              className="min-h-11 rounded-lg border border-[#cbd9e7] px-3 text-base font-semibold text-[#172f49] outline-none focus:border-[#4e84b2] focus:ring-2 focus:ring-[#9fc6e8]"
              onChange={(event) => setSetupCode(event.target.value)}
              placeholder="123456"
              value={setupCode}
            />
          </label>
          <label className="grid gap-1">
            <span className="text-sm font-black text-[#345d83]">Receiver page</span>
            <input
              className="min-h-11 rounded-lg border border-[#cbd9e7] px-3 text-base font-semibold text-[#172f49] outline-none focus:border-[#4e84b2] focus:ring-2 focus:ring-[#9fc6e8]"
              readOnly
              value={receiverUrl}
            />
          </label>
          <label className="grid gap-1">
            <span className="text-sm font-black text-[#345d83]">Hardware profile</span>
            <select
              className="min-h-11 rounded-lg border border-[#cbd9e7] px-3 text-base font-semibold text-[#172f49] outline-none focus:border-[#4e84b2] focus:ring-2 focus:ring-[#9fc6e8]"
              onChange={(event) => {
                const selectedProfile = androidProfileOptions.find(
                  (option) => option.label === event.target.value
                );
                if (!selectedProfile) return;
                setDeviceProfile(selectedProfile.deviceProfile);
                setHardwareProfile(selectedProfile.hardwareProfile);
                setUiLayout(selectedProfile.uiLayout);
              }}
              value={
                androidProfileOptions.find(
                  (option) =>
                    option.deviceProfile === deviceProfile &&
                    option.hardwareProfile === hardwareProfile &&
                    option.uiLayout === uiLayout
                )?.label ?? ""
              }
            >
              {androidProfileOptions.map((option) => (
                <option key={option.label} value={option.label}>
                  {option.label}
                </option>
              ))}
              <option value="">Custom</option>
            </select>
          </label>
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="grid gap-1">
              <span className="text-sm font-black text-[#345d83]">Device</span>
              <input
                className="min-h-11 rounded-lg border border-[#cbd9e7] px-3 text-base font-semibold text-[#172f49] outline-none focus:border-[#4e84b2] focus:ring-2 focus:ring-[#9fc6e8]"
                onChange={(event) => setDeviceProfile(event.target.value)}
                value={deviceProfile}
              />
            </label>
            <label className="grid gap-1">
              <span className="text-sm font-black text-[#345d83]">Hardware</span>
              <input
                className="min-h-11 rounded-lg border border-[#cbd9e7] px-3 text-base font-semibold text-[#172f49] outline-none focus:border-[#4e84b2] focus:ring-2 focus:ring-[#9fc6e8]"
                onChange={(event) => setHardwareProfile(event.target.value)}
                value={hardwareProfile}
              />
            </label>
            <label className="grid gap-1">
              <span className="text-sm font-black text-[#345d83]">Layout</span>
              <input
                className="min-h-11 rounded-lg border border-[#cbd9e7] px-3 text-base font-semibold text-[#172f49] outline-none focus:border-[#4e84b2] focus:ring-2 focus:ring-[#9fc6e8]"
                onChange={(event) => setUiLayout(event.target.value)}
                value={uiLayout}
              />
            </label>
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-[#d6e3f2] bg-white p-4">
        <h3 className="text-lg font-black text-[#172f49]">Wi-Fi setup helper</h3>
        <p className="mt-1 text-sm font-semibold text-[#5f6e84]">
          Create a Wi-Fi QR code for Android camera/settings. CarePland does not store this
          network password.
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <label className="grid gap-1">
            <span className="text-sm font-black text-[#345d83]">Network name</span>
            <input
              className="min-h-11 rounded-lg border border-[#cbd9e7] px-3 text-base font-semibold text-[#172f49] outline-none focus:border-[#4e84b2] focus:ring-2 focus:ring-[#9fc6e8]"
              onChange={(event) => setWifiSsid(event.target.value)}
              value={wifiSsid}
            />
          </label>
          <label className="grid gap-1">
            <span className="text-sm font-black text-[#345d83]">Password</span>
            <input
              className="min-h-11 rounded-lg border border-[#cbd9e7] px-3 text-base font-semibold text-[#172f49] outline-none focus:border-[#4e84b2] focus:ring-2 focus:ring-[#9fc6e8]"
              onChange={(event) => setWifiPassword(event.target.value)}
              type="password"
              value={wifiPassword}
            />
          </label>
          <label className="grid gap-1">
            <span className="text-sm font-black text-[#345d83]">Security</span>
            <select
              className="min-h-11 rounded-lg border border-[#cbd9e7] px-3 text-base font-semibold text-[#172f49] outline-none focus:border-[#4e84b2] focus:ring-2 focus:ring-[#9fc6e8]"
              onChange={(event) => setWifiSecurity(event.target.value)}
              value={wifiSecurity}
            >
              <option value="WPA">WPA/WPA2</option>
              <option value="WEP">WEP</option>
              <option value="nopass">No password</option>
            </select>
          </label>
        </div>
        {wifiPayload ? (
          <div className="mt-4">
            <ReceiverQrCard label="Wi-Fi QR" text={wifiPayload} />
          </div>
        ) : null}
      </div>

      <ReceiverQrCard
        copyLabel="Copy App Link"
        label="Receiver app provisioning link"
        onCopy={() => copyText(advancedProvisioningUrl, "App provisioning link copied.")}
        text={advancedProvisioningUrl}
      />

      <div className="rounded-lg border border-[#d6e3f2] bg-white p-4">
        <h3 className="text-lg font-black text-[#172f49]">Emulator fallback</h3>
        <div className="mt-3 grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-stretch">
          <pre className="max-h-52 overflow-auto whitespace-pre-wrap rounded-lg bg-[#f8fbff] p-3 text-sm font-bold leading-relaxed text-[#172f49]">
            {emulatorCommand}
          </pre>
          <button
            className="min-h-11 rounded-lg border border-[#cbd9e7] bg-white px-4 text-sm font-black text-[#173150] hover:bg-[#edf5fc] focus:outline-none focus:ring-2 focus:ring-[#4e84b2]"
            onClick={() => copyText(emulatorCommand, "Emulator command copied.")}
            type="button"
          >
            Copy Command
          </button>
        </div>
      </div>

      {ownerPayload ? (
        <ReceiverQrCard
          copyLabel="Copy QR Payload"
          label="Dedicated-device QR payload"
          onCopy={() => copyText(ownerPayload, "Dedicated-device QR payload copied.")}
          text={ownerPayload}
        />
      ) : (
        <ReceiverSetupStatus tone="warn">
          Dedicated-device QR needs a downloadable APK URL and APK checksum.
        </ReceiverSetupStatus>
      )}

      <ReceiverSetupStatus>
        Device-owner setup is only for factory-reset Android devices. Normal Device Admin can help
        setup, but reliable kiosk behavior requires device-owner provisioning.
      </ReceiverSetupStatus>
    </section>
  );
}

function setupCodeFromProvisioningUrl(value: string) {
  try {
    const url = new URL(value);
    return url.searchParams.get("code") || "";
  } catch {
    return "";
  }
}

function receiverProvisioningUrl({
  deviceProfile,
  hardwareProfile,
  receiverUrl,
  setupCode,
  uiLayout,
}: {
  deviceProfile: string;
  hardwareProfile: string;
  receiverUrl: string;
  setupCode: string;
  uiLayout: string;
}) {
  const url = new URL("carepland://receiver/provision");
  url.searchParams.set("receiver_url", receiverUrl);
  if (setupCode.trim()) {
    url.searchParams.set("code", setupCode.trim());
  }
  url.searchParams.set("device", deviceProfile.trim() || "android_receiver");
  url.searchParams.set("hardwareProfile", hardwareProfile.trim() || "generic_landscape_android");
  url.searchParams.set("uiLayout", uiLayout.trim() || "default_receiver");
  url.searchParams.set("mode", "setup_pending");
  return url.toString();
}

function emulatorFallbackCommand(provisioningUrl: string) {
  return [
    "/Users/agoodloe/Library/Android/sdk/platform-tools/adb",
    "shell",
    "'am start -a android.intent.action.VIEW -d",
    `"${provisioningUrl}"'`,
  ].join(" ");
}
