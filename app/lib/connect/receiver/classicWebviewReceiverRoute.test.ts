import assert from "node:assert/strict";
import { describe, it } from "node:test";

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
});
