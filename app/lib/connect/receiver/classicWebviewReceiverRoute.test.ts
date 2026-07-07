import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { GET as getClassicReceiverRoute } from "../../../connect/receiver/legacy/route";
import { classicReceiverRuntimeInput } from "./classicWebviewReceiverRoute";
import { createReceiverRuntimeContract } from "./receiverRuntimeContract";

describe("Classic WebView receiver route runtime input", () => {
  it("maps HD Android 7 URL device facts into the GXV appliance schema with scale-to-fit", () => {
    const input = classicReceiverRuntimeInput(
      new URLSearchParams({
        detectedHardwareProfile: "generic_landscape_android",
        displayDensityDpi: "240",
        displayHeightPx: "1080",
        displayWidthPx: "1920",
        nativeManufacturer: "Amlogic",
        nativeModel: "iTabcore v2",
        nativeOrientation: "landscape",
        nativeSdk: "25",
        receiverBindingStatus: "bound",
        receiverDeviceId: "receiver-1",
        receiverInstallId: "install-1",
        receiverMode: "dedicated",
      })
    );

    const contract = createReceiverRuntimeContract(input);

    assert.equal(contract.runtime.name, "classic_webview");
    assert.equal(contract.hardware.screenClass, "landscape_hd");
    assert.equal(contract.layout.uiSchemaId, "gxv3370_classic_1024x600_v1");
    assert.equal(contract.layout.scaleMode, "scale_to_fit");
  });

  it("preserves explicit GXV layout URL parameters for Classic WebView rendering", () => {
    const input = classicReceiverRuntimeInput(
      new URLSearchParams({
        device: "gxv3370",
        hardwareProfile: "grandstream_gxv3370",
        uiLayout: "desk_phone_1024x600",
      })
    );

    const contract = createReceiverRuntimeContract(input);

    assert.equal(contract.hardware.hardwareProfile, "grandstream_gxv3370");
    assert.equal(contract.layout.uiLayout, "desk_phone_1024x600");
    assert.equal(contract.layout.uiSchemaId, "gxv3370_classic_1024x600_v1");
  });

  it("renders receiver guide presence and highlight support", async () => {
    const response = getClassicReceiverRoute({
      nextUrl: new URL("https://receiver.carepland.test/connect/receiver/legacy"),
    } as never);
    const html = await response.text();

    assert.match(html, /\/api\/connect\/receiver-guide/);
    assert.match(html, /guideRectTarget/);
    assert.match(html, /guideIdentifyCode/);
    assert.match(html, /startReceiverGuideSync/);
  });

  it("renders person-scoped local cache support for Classic data", async () => {
    const response = getClassicReceiverRoute({
      nextUrl: new URL("https://receiver.carepland.test/connect/receiver/legacy"),
    } as never);
    const html = await response.text();

    assert.match(html, /carepland-connect-classic-cache/);
    assert.match(html, /readCachedItems/);
    assert.match(html, /writeCachedItems/);
    assert.match(html, /renderTodayFocusItems/);
  });

  it("renders an early setup fallback for older WebViews", async () => {
    const response = getClassicReceiverRoute({
      nextUrl: new URL("https://receiver.carepland.test/connect/receiver/legacy"),
    } as never);
    const html = await response.text();

    assert.match(html, /__careplandClassicShowSetupFallback/);
    assert.match(html, /__careplandClassicRequestPairingCode/);
    assert.match(html, /fallbackRequestPairingCode/);
    assert.match(html, /fallbackPollPairing/);
    assert.match(html, /Receiver startup hit an older-device script problem/);
    assert.match(html, /window\.location\.reload\(\); return false/);
  });

  it("resets a revoked browser binding back into Receiver pairing", async () => {
    const response = getClassicReceiverRoute({
      nextUrl: new URL("https://receiver.carepland.test/connect/receiver/legacy"),
    } as never);
    const html = await response.text();

    assert.match(html, /function clearStoredBinding/);
    assert.match(html, /bindingNeedsFreshPairing/);
    assert.match(html, /startClassicPairing\(callback\)/);
    assert.match(html, /if \(!binding\) return;/);
  });

  it("polls for dashboard-originated incoming calls in Classic", async () => {
    const response = getClassicReceiverRoute({
      nextUrl: new URL("https://receiver.carepland.test/connect/receiver/legacy"),
    } as never);
    const html = await response.text();

    assert.match(html, /function loadIncomingCalls/);
    assert.match(html, /\/api\/connect\/calls\?personId=/);
    assert.match(html, /receiverDeviceId=/);
    assert.match(html, /receiverInstallId=/);
    assert.match(html, /function showIncomingCall/);
    assert.match(html, /id="answerCallButton"/);
    assert.match(html, /function answerActiveCall/);
    assert.match(html, /id="callTitle"/);
    assert.match(html, /Call from " \+ callerName/);
    assert.match(html, /Tap Answer to talk/);
    assert.match(html, /surface: "classic_webview_receiver"/);
    assert.match(html, /source: "receiver"/);
    assert.match(html, /state: "connected"/);
    assert.match(html, /answeredCallId/);
    assert.match(html, /receiverState\.answeredCallId === activeCall\.callId/);
    assert.match(html, /startIncomingCallPolling/);
  });
});
