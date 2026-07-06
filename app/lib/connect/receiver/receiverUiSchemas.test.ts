import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { resolveReceiverUiSchema } from "./receiverUiSchemas";

describe("receiver UI schemas", () => {
  it("selects the GXV Classic WebView schema for the 1024x600 appliance layout", () => {
    const schema = resolveReceiverUiSchema({
      hardwareProfile: "grandstream_gxv3370",
      runtime: "classic_webview",
      uiLayout: "desk_phone_1024x600",
    });

    assert.equal(schema.id, "gxv3370_classic_1024x600_v1");
    assert.equal(schema.designViewport.width, 1024);
    assert.equal(schema.designViewport.height, 600);
    assert.equal(schema.home.footer.layout, "single_row");
    assert.deepEqual(schema.home.focus.excludes, ["appointment_reminders"]);
  });

  it("lets HD Android 7 appliance displays reuse the GXV layout schema with scale-to-fit", () => {
    const schema = resolveReceiverUiSchema({
      hardwareProfile: "generic_hd_landscape_android",
      runtime: "classic_webview",
      uiLayout: "desk_phone_1024x600",
    });

    assert.equal(schema.id, "gxv3370_classic_1024x600_v1");
    assert.deepEqual(schema.layoutScaleModes, ["native", "scale_to_fit"]);
    assert.equal(schema.panelMode, "fullscreen_appliance");
  });

  it("uses the default responsive schema for modern web receivers", () => {
    const schema = resolveReceiverUiSchema({
      hardwareProfile: "generic_android_phone",
      runtime: "modern_web",
      uiLayout: "default_receiver",
    });

    assert.equal(schema.id, "default_receiver_v1");
    assert.equal(schema.designViewport.orientation, "responsive");
    assert.equal(schema.home.footer.layout, "responsive");
  });
});
