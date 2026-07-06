import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  createReceiverRuntimeContract,
  receiverScreenClass,
} from "./receiverRuntimeContract";

describe("receiver runtime contract", () => {
  it("classifies the 1024x600 appliance layout as Classic WebView native scale", () => {
    const contract = createReceiverRuntimeContract({
      displayDensityDpi: 160,
      displayHeightPx: 600,
      displayWidthPx: 1024,
      manufacturer: "Grandstream",
      model: "GXV3370",
      nativeSdk: 24,
      receiverDeviceId: "receiver-1",
      receiverInstallId: "install-1",
      receiverMode: "dedicated",
    });

    assert.equal(contract.runtime.name, "classic_webview");
    assert.equal(contract.hardware.screenClass, "landscape_1024x600");
    assert.equal(contract.hardware.hardwareProfile, "grandstream_gxv3370");
    assert.equal(contract.layout.uiLayout, "desk_phone_1024x600");
    assert.equal(contract.layout.scaleMode, "native");
    assert.equal(contract.mode.receiverMode, "dedicated");
  });

  it("keeps HD landscape hardware distinct while recommending the appliance layout family", () => {
    const contract = createReceiverRuntimeContract({
      displayDensityDpi: 240,
      displayHeightPx: 1080,
      displayWidthPx: 1920,
      manufacturer: "Amlogic",
      model: "iTabcore v2",
      nativeSdk: 25,
      receiverMode: "dedicated",
    });

    assert.equal(contract.runtime.name, "classic_webview");
    assert.equal(contract.hardware.screenClass, "landscape_hd");
    assert.equal(contract.hardware.hardwareProfile, "generic_hd_landscape_android");
    assert.equal(contract.layout.uiLayout, "desk_phone_1024x600");
    assert.equal(contract.layout.scaleMode, "scale_to_fit");
  });

  it("uses modern responsive defaults for newer generic phone-like receivers", () => {
    const contract = createReceiverRuntimeContract({
      displayHeightPx: 2400,
      displayWidthPx: 1080,
      nativeSdk: 37,
      receiverRuntime: "modern-web",
    });

    assert.equal(contract.runtime.name, "modern_web");
    assert.equal(contract.hardware.screenClass, "portrait_phone");
    assert.equal(contract.hardware.hardwareProfile, "generic_android_phone");
    assert.equal(contract.layout.uiLayout, "default_receiver");
    assert.equal(contract.layout.scaleMode, "responsive");
  });

  it("classifies screen shape independently for direct hardware-profile tests", () => {
    assert.equal(
      receiverScreenClass({
        displayHeightDp: 600,
        displayWidthDp: 1024,
      }),
      "landscape_1024x600"
    );
  });
});
