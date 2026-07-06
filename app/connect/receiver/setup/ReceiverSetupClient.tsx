"use client";

import { useEffect, useMemo, useState } from "react";
import QRCode from "qrcode";

import { connectAuthHeaders } from "@/app/lib/connect/context/client";

import styles from "./ReceiverSetup.module.css";

type ReceiverSetupClientProps = {
  apkDownloadUrl: string;
  apkSha256Checksum: string;
  apkVersionName: string;
  embedded: boolean;
  initialCode: string;
  initialDevice: string;
  initialHardwareProfile: string;
  initialMainConnectUserPersonId: string;
  initialReceiverUrl: string;
  initialUiLayout: string;
  setupBaseUrl: string;
};

const profileOptions = [
  {
    device: "gxv3370",
    hardwareProfile: "studio_gxv3370_1024x600",
    label: "GXV test receiver",
    uiLayout: "desk_phone_1024x600",
  },
  {
    device: "android_receiver",
    hardwareProfile: "generic_landscape_android",
    label: "Landscape Android",
    uiLayout: "default_receiver",
  },
  {
    device: "android_receiver",
    hardwareProfile: "generic_android_phone",
    label: "Android phone",
    uiLayout: "default_receiver",
  },
];

export function ReceiverSetupClient({
  apkDownloadUrl,
  apkSha256Checksum,
  apkVersionName,
  embedded,
  initialCode,
  initialDevice,
  initialHardwareProfile,
  initialMainConnectUserPersonId,
  initialReceiverUrl,
  initialUiLayout,
  setupBaseUrl,
}: ReceiverSetupClientProps) {
  const [setupCode, setSetupCode] = useState(initialCode || "");
  const [receiverUrl, setReceiverUrl] = useState(initialReceiverUrl);
  const [device, setDevice] = useState(initialDevice);
  const [hardwareProfile, setHardwareProfile] = useState(initialHardwareProfile);
  const [uiLayout, setUiLayout] = useState(initialUiLayout);
  const [copied, setCopied] = useState(false);
  const [commandCopied, setCommandCopied] = useState(false);
  const [claimError, setClaimError] = useState("");
  const [claimPending, setClaimPending] = useState(false);
  const [claimStorageSource, setClaimStorageSource] = useState("");
  const [nativeClaim, setNativeClaim] = useState("");
  const [pairingStatus, setPairingStatus] = useState("");
  const [pairingCheckPending, setPairingCheckPending] = useState(false);
  const [openAttempted, setOpenAttempted] = useState(false);
  const [browserOrigin, setBrowserOrigin] = useState("");
  const [setupQrCode, setSetupQrCode] = useState("");
  const [provisioningQrCode, setProvisioningQrCode] = useState("");
  const [ownerProvisioningQrCode, setOwnerProvisioningQrCode] = useState("");
  const [wifiQrCode, setWifiQrCode] = useState("");
  const [wifiSsid, setWifiSsid] = useState("");
  const [wifiPassword, setWifiPassword] = useState("");
  const [wifiSecurity, setWifiSecurity] = useState("WPA");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [ownerQrCopied, setOwnerQrCopied] = useState(false);

  useEffect(() => {
    setBrowserOrigin(setupBaseUrl || window.location.origin);
  }, [setupBaseUrl]);

  useEffect(() => {
    if (!initialCode.trim()) return;
    void checkPairingCode(initialCode);
    // Run only for URL prefill.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialCode]);

  const effectiveReceiverUrl = useMemo(() => {
    if (receiverUrl.trim()) return receiverUrl.trim();
    if (!browserOrigin) return "/connect/receiver";
    const origin = new URL(browserOrigin);
    if (origin.hostname === "localhost" || origin.hostname === "127.0.0.1") {
      return `http://10.0.2.2:${origin.port || "3002"}/connect/receiver`;
    }
    return new URL("/connect/receiver", browserOrigin).toString();
  }, [browserOrigin, receiverUrl]);

  const setupPageUrl = useMemo(() => {
    if (!browserOrigin) return "";
    const url = new URL("/connect/receiver/setup", browserOrigin);
    url.searchParams.set("code", setupCode.trim());
    url.searchParams.set("device", device);
    url.searchParams.set("hardwareProfile", hardwareProfile);
    url.searchParams.set("uiLayout", uiLayout);
    if (receiverUrl.trim()) {
      url.searchParams.set("receiverUrl", receiverUrl.trim());
    }
    return url.toString();
  }, [browserOrigin, device, hardwareProfile, receiverUrl, setupCode, uiLayout]);

  const provisioningUrl = useMemo(() => {
    const url = new URL("carepland://receiver/provision");
    url.searchParams.set("receiver_url", effectiveReceiverUrl);
    if (nativeClaim) {
      url.searchParams.set("claim", nativeClaim);
    } else {
      url.searchParams.set("code", setupCode.trim());
    }
    url.searchParams.set("device", device);
    url.searchParams.set("hardwareProfile", hardwareProfile);
    url.searchParams.set("uiLayout", uiLayout);
    url.searchParams.set("mode", nativeClaim ? "claim_pending" : "setup_pending");
    return url.toString();
  }, [
    device,
    effectiveReceiverUrl,
    hardwareProfile,
    nativeClaim,
    setupCode,
    uiLayout,
  ]);

  const androidOpenReceiverUrl = useMemo(() => {
    const intentPath = provisioningUrl.replace(/^carepland:\/\//, "intent://");
    const fallback = setupPageUrl
      ? `;S.browser_fallback_url=${encodeURIComponent(setupPageUrl)}`
      : "";
    return `${intentPath}#Intent;scheme=carepland;package=com.carepland.connectreceiver${fallback};end`;
  }, [provisioningUrl, setupPageUrl]);

  const absoluteApkDownloadUrl = useMemo(() => {
    if (!apkDownloadUrl) return "";
    if (/^https?:\/\//i.test(apkDownloadUrl)) return apkDownloadUrl;
    if (!browserOrigin) return apkDownloadUrl;
    return new URL(apkDownloadUrl, browserOrigin).toString();
  }, [apkDownloadUrl, browserOrigin]);

  const cleanPairingCode = setupCode.replace(/\D/g, "");
  const codeReady = cleanPairingCode.length >= 5 || setupCode.trim().length >= 4;
  const canOpenReceiverApp = codeReady && Boolean(nativeClaim);
  const setupMode = nativeClaim
    ? "Receiver ready"
    : setupCode.trim() === "12345"
      ? "Local test receiver"
      : "Waiting for pairing code";
  const apkBuildLabel = apkVersionName ? `build ${apkVersionName}` : "build not listed";
  const adbBinary = browserOrigin
    ? "/Users/agoodloe/Library/Android/sdk/platform-tools/adb"
    : "adb";
  const adbCommand = `${adbBinary} shell 'am start -a android.intent.action.VIEW -d "${provisioningUrl}"'`;
  const setupOriginIsLocalhost =
    browserOrigin.includes("://localhost") || browserOrigin.includes("://127.0.0.1");
  const apkOriginIsLocalhost =
    absoluteApkDownloadUrl.includes("://localhost") ||
    absoluteApkDownloadUrl.includes("://127.0.0.1");
  const wifiPayload = useMemo(() => {
    const ssid = wifiEscape(wifiSsid.trim());
    if (!ssid) return "";
    const type = wifiSecurity === "nopass" ? "nopass" : wifiSecurity;
    const password = type === "nopass" ? "" : wifiEscape(wifiPassword);
    return `WIFI:T:${type};S:${ssid};P:${password};;`;
  }, [wifiPassword, wifiSecurity, wifiSsid]);
  const ownerProvisioningPayload = useMemo(() => {
    if (!absoluteApkDownloadUrl || !apkSha256Checksum) return "";
    const payload: Record<string, unknown> = {
      "android.app.extra.PROVISIONING_DEVICE_ADMIN_COMPONENT_NAME":
        "com.carepland.connectreceiver/.ReceiverDeviceAdminReceiver",
      "android.app.extra.PROVISIONING_DEVICE_ADMIN_PACKAGE_DOWNLOAD_LOCATION":
        absoluteApkDownloadUrl,
      "android.app.extra.PROVISIONING_DEVICE_ADMIN_PACKAGE_CHECKSUM": apkSha256Checksum,
      "android.app.extra.PROVISIONING_LEAVE_ALL_SYSTEM_APPS_ENABLED": true,
      "android.app.extra.PROVISIONING_ADMIN_EXTRAS_BUNDLE": {
        careplandProvisioningUrl: provisioningUrl,
        careplandReceiverUrl: effectiveReceiverUrl,
        careplandHardwareProfile: hardwareProfile,
        careplandUiLayout: uiLayout,
      },
    };

    if (wifiSsid.trim()) {
      payload["android.app.extra.PROVISIONING_WIFI_SSID"] = wifiSsid.trim();
      payload["android.app.extra.PROVISIONING_WIFI_SECURITY_TYPE"] = wifiSecurity;
      if (wifiSecurity !== "nopass") {
        payload["android.app.extra.PROVISIONING_WIFI_PASSWORD"] = wifiPassword;
      }
    }

    return JSON.stringify(payload);
  }, [
    absoluteApkDownloadUrl,
    apkSha256Checksum,
    effectiveReceiverUrl,
    hardwareProfile,
    provisioningUrl,
    uiLayout,
    wifiPassword,
    wifiSecurity,
    wifiSsid,
  ]);

  useEffect(() => {
    let cancelled = false;
    if (!setupPageUrl) {
      setSetupQrCode("");
      return;
    }
    QRCode.toDataURL(setupPageUrl, qrOptions())
      .then((dataUrl) => {
        if (!cancelled) setSetupQrCode(dataUrl);
      })
      .catch(() => {
        if (!cancelled) setSetupQrCode("");
      });
    return () => {
      cancelled = true;
    };
  }, [setupPageUrl]);

  useEffect(() => {
    let cancelled = false;
    if (!provisioningUrl) {
      setProvisioningQrCode("");
      return;
    }
    QRCode.toDataURL(provisioningUrl, qrOptions())
      .then((dataUrl) => {
        if (!cancelled) setProvisioningQrCode(dataUrl);
      })
      .catch(() => {
        if (!cancelled) setProvisioningQrCode("");
      });
    return () => {
      cancelled = true;
    };
  }, [provisioningUrl]);

  useEffect(() => {
    let cancelled = false;
    if (!ownerProvisioningPayload) {
      setOwnerProvisioningQrCode("");
      return;
    }
    QRCode.toDataURL(ownerProvisioningPayload, qrOptions(340))
      .then((dataUrl) => {
        if (!cancelled) setOwnerProvisioningQrCode(dataUrl);
      })
      .catch(() => {
        if (!cancelled) setOwnerProvisioningQrCode("");
      });
    return () => {
      cancelled = true;
    };
  }, [ownerProvisioningPayload]);

  useEffect(() => {
    let cancelled = false;
    if (!wifiPayload) {
      setWifiQrCode("");
      return;
    }
    QRCode.toDataURL(wifiPayload, qrOptions())
      .then((dataUrl) => {
        if (!cancelled) setWifiQrCode(dataUrl);
      })
      .catch(() => {
        if (!cancelled) setWifiQrCode("");
      });
    return () => {
      cancelled = true;
    };
  }, [wifiPayload]);

  function selectProfile(value: string) {
    const selected = profileOptions.find((option) => option.label === value);
    if (!selected) return;
    setDevice(selected.device);
    setHardwareProfile(selected.hardwareProfile);
    setUiLayout(selected.uiLayout);
  }

  async function copyProvisioningUrl() {
    setCopied(false);
    await navigator.clipboard.writeText(provisioningUrl);
    setCopied(true);
  }

  async function copySetupPageUrl() {
    setCopied(false);
    await navigator.clipboard.writeText(setupPageUrl);
    setCopied(true);
  }

  async function copyAdbCommand() {
    setCommandCopied(false);
    await navigator.clipboard.writeText(adbCommand);
    setCommandCopied(true);
  }

  async function copyOwnerProvisioningPayload() {
    setOwnerQrCopied(false);
    await navigator.clipboard.writeText(ownerProvisioningPayload);
    setOwnerQrCopied(true);
  }

  async function createClaim() {
    setClaimError("");
    setClaimPending(true);
    try {
      const response = await fetch("/api/connect/receiver-shell/claims", {
        body: JSON.stringify({
          deviceProfile: device,
          hardwareProfile,
          receiverUrl: effectiveReceiverUrl,
          setupCode: setupCode.trim(),
          uiLayout,
        }),
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      const payload = (await response.json().catch(() => ({}))) as {
        claim?: string;
        error?: string;
        storageSource?: string;
      };
      if (!response.ok || !payload.claim) {
        throw new Error(payload.error || "Unable to create receiver claim.");
      }
      setNativeClaim(payload.claim);
      setClaimStorageSource(payload.storageSource || "");
    } catch (error) {
      setClaimError(error instanceof Error ? error.message : "Unable to create receiver claim.");
    } finally {
      setClaimPending(false);
    }
  }

  async function checkPairingCode(code = setupCode) {
    const trimmed = code.trim();
    if (!trimmed) return;
    setPairingCheckPending(true);
    setClaimError("");
    try {
      const response = await fetch(
        `/api/connect/receiver-shell/pairing-sessions?code=${encodeURIComponent(trimmed)}`,
        { cache: "no-store" }
      );
      const payload = (await response.json().catch(() => ({}))) as {
        error?: string;
        status?: string;
      };
      if (!response.ok) {
        setPairingStatus(payload.error || "Pairing code not found yet.");
        return;
      }
      setPairingStatus(
        payload.status === "paired"
          ? "Receiver detected and ready to connect."
          : payload.status === "pending"
            ? "Receiver detected. Pair it when you are ready."
            : payload.status
              ? `Receiver code status: ${payload.status}.`
              : "Receiver detected."
      );
    } finally {
      setPairingCheckPending(false);
    }
  }

  async function pairReceiver() {
    setClaimError("");
    setClaimPending(true);
    try {
      const response = await fetch("/api/connect/receiver-shell/pairing-sessions/pair", {
        body: JSON.stringify({
          deviceProfile: device,
          hardwareProfile,
          mainConnectUserPersonId: initialMainConnectUserPersonId,
          pairingCode: setupCode.trim(),
          receiverUrl: effectiveReceiverUrl,
          uiLayout,
        }),
        cache: "no-store",
        headers: {
          ...(await connectAuthHeaders()),
          "Content-Type": "application/json",
        },
        method: "POST",
      });
      const payload = (await response.json().catch(() => ({}))) as {
        claim?: string;
        error?: string;
        receiverName?: string;
        storageSource?: string;
      };
      if (!response.ok || !payload.claim) {
        throw new Error(payload.error || "Unable to pair Receiver.");
      }
      setNativeClaim(payload.claim);
      setClaimStorageSource(payload.storageSource || "");
      setPairingStatus(
        payload.receiverName
          ? `Receiver ready for ${payload.receiverName}.`
          : "Receiver ready."
      );
    } catch (error) {
      setClaimError(error instanceof Error ? error.message : "Unable to pair Receiver.");
    } finally {
      setClaimPending(false);
    }
  }

  return (
    <main className={`${styles.page} ${embedded ? styles.embeddedPage : ""}`}>
      <section className={styles.panel} aria-labelledby="receiver-setup-title">
        <div className={styles.header}>
          <div>
            <p>CarePland Connect</p>
            <h1 id="receiver-setup-title">Set Up Receiver</h1>
          </div>
          <span>{apkVersionName ? `APK ${apkVersionName}` : "Setup"}</span>
        </div>

        <div className={styles.installGrid}>
          <div className={styles.installStep}>
            <span>1</span>
            <strong>Install Receiver ({apkBuildLabel})</strong>
            <p>Download and install the Receiver app on the Android device.</p>
            {apkDownloadUrl ? (
              <a className={styles.primaryAction} href={apkDownloadUrl}>
                Download APK {apkVersionName ? `(${apkBuildLabel})` : ""}
              </a>
            ) : (
              <p className={styles.errorNote}>
                APK download URL is not configured yet. Set CONNECT_RECEIVER_APK_URL.
              </p>
            )}
          </div>

          <div className={styles.installStep}>
            <span>2</span>
            <strong>Open Receiver and get code</strong>
            <p>Open the Receiver app. It will show a short pairing code, like 123 456.</p>
          </div>
        </div>

        {setupOriginIsLocalhost ? (
          <p className={styles.warningNote}>
            This setup QR uses localhost. For real hardware, open the setup page from the LAN
            bridge URL or configure CONNECT_RECEIVER_SETUP_BASE_URL.
          </p>
        ) : null}

        <div className={styles.statusStrip}>
          <span>{setupMode}</span>
          {nativeClaim ? (
            <strong>
              Receiver ready{claimStorageSource ? ` · ${claimStorageSource}` : ""}
            </strong>
          ) : setupCode.trim() === "12345" ? (
            <strong>Rob Robson test code</strong>
          ) : (
            <strong>Enter the code shown on the Receiver</strong>
          )}
        </div>

        <div className={styles.pairingPanel}>
          <span>3</span>
          <label className={styles.field}>
            <span>Enter code to pair</span>
            <input
              autoComplete="one-time-code"
              inputMode="numeric"
              onChange={(event) => {
                setSetupCode(event.target.value);
                setNativeClaim("");
                setClaimStorageSource("");
              }}
              placeholder="123 456"
              value={setupCode}
            />
          </label>
          <div className={styles.actions}>
            <button
              className={styles.primaryAction}
              disabled={!codeReady || claimPending}
              type="button"
              onClick={pairReceiver}
            >
              {claimPending ? "Pairing Receiver" : nativeClaim ? "Receiver Ready" : "Pair Receiver"}
            </button>
            <button
              className={styles.secondaryAction}
              disabled={!codeReady || pairingCheckPending}
              type="button"
              onClick={() => checkPairingCode()}
            >
              {pairingCheckPending ? "Checking" : "Check Code"}
            </button>
          </div>
          {pairingStatus ? <p className={styles.note}>{pairingStatus}</p> : null}
        </div>

        {nativeClaim ? (
          <a
            aria-disabled={!canOpenReceiverApp}
            className={`${styles.primaryAction} ${styles.fullWidthAction} ${canOpenReceiverApp ? "" : styles.disabled}`}
            href={canOpenReceiverApp ? androidOpenReceiverUrl : undefined}
            onClick={(event) => {
              if (!canOpenReceiverApp) {
                event.preventDefault();
                return;
              }
              setOpenAttempted(true);
            }}
          >
            Open Receiver App
          </a>
        ) : null}

        {claimError ? <p className={styles.errorNote}>{claimError}</p> : null}

        <div className={styles.qrPanel}>
          <div>
            <span>Open-app QR</span>
            <p>
              Use this only if the Receiver app does not notice pairing automatically.
            </p>
          </div>
          {canOpenReceiverApp && provisioningQrCode ? (
            <img className={styles.smallQrImage} src={provisioningQrCode} alt="Open Receiver app QR code" />
          ) : null}
          <button
            className={styles.secondaryAction}
            disabled={!canOpenReceiverApp}
            type="button"
            onClick={copyProvisioningUrl}
          >
            Copy App Link
          </button>
        </div>

        <details className={styles.detailsPanel}>
          <summary>WiFi setup helper</summary>
          <p>
            Optional: create a WiFi QR code for Android camera/settings. CarePland does not store
            this network password.
          </p>
          <div className={styles.grid}>
            <label className={styles.field}>
              <span>Network name</span>
              <input onChange={(event) => setWifiSsid(event.target.value)} value={wifiSsid} />
            </label>
            <label className={styles.field}>
              <span>Password</span>
              <input
                onChange={(event) => setWifiPassword(event.target.value)}
                type="password"
                value={wifiPassword}
              />
            </label>
            <label className={styles.field}>
              <span>Security</span>
              <select
                onChange={(event) => setWifiSecurity(event.target.value)}
                value={wifiSecurity}
              >
                <option value="WPA">WPA/WPA2</option>
                <option value="WEP">WEP</option>
                <option value="nopass">No password</option>
              </select>
            </label>
          </div>
          {wifiQrCode ? (
            <img className={styles.qrImage} src={wifiQrCode} alt="WiFi network QR code" />
          ) : null}
        </details>

        <details className={styles.detailsPanel}>
          <summary>Dedicated-device QR</summary>
          <p>
            For factory-reset Android devices only. This asks Android setup to install CarePland as
            the device owner for the strongest Receiver appliance behavior.
          </p>
          {ownerProvisioningQrCode ? (
            <img
              className={styles.qrImage}
              src={ownerProvisioningQrCode}
              alt="Dedicated device provisioning QR code"
            />
          ) : (
            <p className={styles.errorNote}>
              Dedicated-device QR needs a downloadable APK URL and APK checksum.
            </p>
          )}
          {apkOriginIsLocalhost ? (
            <p className={styles.warningNote}>
              This APK URL uses localhost. Real hardware needs a LAN or public URL it can reach.
            </p>
          ) : null}
          <button
            className={styles.secondaryAction}
            disabled={!ownerProvisioningPayload}
            type="button"
            onClick={copyOwnerProvisioningPayload}
          >
            {ownerQrCopied ? "Copied" : "Copy QR Payload"}
          </button>
        </details>

        <button
          className={styles.linkButton}
          type="button"
          onClick={() => setShowAdvanced((value) => !value)}
        >
          {showAdvanced ? "Hide advanced setup" : "Advanced setup"}
        </button>

        {showAdvanced ? (
          <>
            <div className={styles.qrPanel}>
              <div>
                <span>Setup page QR</span>
                <p>Use this if the Android device needs to open this setup page directly.</p>
              </div>
              {setupQrCode ? (
                <img className={styles.smallQrImage} src={setupQrCode} alt="Receiver setup QR code" />
              ) : null}
              <button className={styles.secondaryAction} type="button" onClick={copySetupPageUrl}>
                {copied ? "Copied" : "Copy Setup Link"}
              </button>
            </div>

            <div className={styles.actionsThree}>
              <button
                className={styles.secondaryAction}
                disabled={!codeReady || claimPending}
                type="button"
                onClick={createClaim}
              >
                {claimPending ? "Connecting" : nativeClaim ? "Refresh App Link" : "Create App Claim"}
              </button>
              <a
                aria-disabled={!canOpenReceiverApp}
                className={`${styles.secondaryAction} ${canOpenReceiverApp ? "" : styles.disabled}`}
                href={canOpenReceiverApp ? androidOpenReceiverUrl : undefined}
                onClick={(event) => {
                  if (!canOpenReceiverApp) {
                    event.preventDefault();
                    return;
                  }
                  setOpenAttempted(true);
                }}
              >
                Open Receiver App
              </a>
              <button
                className={styles.secondaryAction}
                type="button"
                onClick={() => {
                  setNativeClaim("");
                  setClaimStorageSource("");
                  setClaimError("");
                }}
              >
                Use Local Code
              </button>
            </div>

            <label className={styles.field}>
              <span>Setup code</span>
              <input
                autoComplete="one-time-code"
                inputMode="text"
                onChange={(event) => setSetupCode(event.target.value)}
                value={setupCode}
              />
            </label>

            <label className={styles.field}>
              <span>Receiver page</span>
              <input
                onChange={(event) => setReceiverUrl(event.target.value)}
                placeholder={effectiveReceiverUrl}
                value={receiverUrl}
              />
            </label>

            <label className={styles.field}>
              <span>Hardware profile</span>
              <select
                onChange={(event) => selectProfile(event.target.value)}
                value={
                  profileOptions.find(
                    (option) =>
                      option.device === device &&
                      option.hardwareProfile === hardwareProfile &&
                      option.uiLayout === uiLayout
                  )?.label || ""
                }
              >
                <option value="">Custom</option>
                {profileOptions.map((option) => (
                  <option key={option.label} value={option.label}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <div className={styles.grid}>
              <label className={styles.field}>
                <span>Device</span>
                <input onChange={(event) => setDevice(event.target.value)} value={device} />
              </label>
              <label className={styles.field}>
                <span>Hardware</span>
                <input
                  onChange={(event) => setHardwareProfile(event.target.value)}
                  value={hardwareProfile}
                />
              </label>
              <label className={styles.field}>
                <span>Layout</span>
                <input onChange={(event) => setUiLayout(event.target.value)} value={uiLayout} />
              </label>
            </div>

            <div className={styles.emulatorPanel}>
              <div>
                <span>Emulator fallback</span>
                <code>{adbCommand}</code>
              </div>
              <button className={styles.secondaryAction} type="button" onClick={copyAdbCommand}>
                {commandCopied ? "Copied" : "Copy Command"}
              </button>
            </div>
          </>
        ) : null}

        <p className={styles.note}>
          {openAttempted
            ? "If nothing opened, install the app first, then return here and tap Open Receiver App again."
            : "The normal path is: install the Receiver, type the code it shows, then pair it here."}
        </p>
      </section>
    </main>
  );
}

function qrOptions(width = 280) {
  return {
    color: {
      dark: "#17231d",
      light: "#ffffff",
    },
    errorCorrectionLevel: "M" as const,
    margin: 1,
    width,
  };
}

function wifiEscape(value: string) {
  return value.replace(/([\\;,:"])/g, "\\$1");
}
