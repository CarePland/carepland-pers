import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { receiverRouteHints } from "./receiverRouteHints";

describe("Receiver route hints", () => {
  it("uses GXV Classic layout for the receiver subdomain", () => {
    const hints = receiverRouteHints({ host: "receiver.carepland.com" });

    assert.deepEqual(hints, {
      device: "gxv3370",
      hardwareProfile: "grandstream_gxv3370",
      uiLayout: "desk_phone_1024x600",
      useClassic: true,
    });
  });

  it("uses GXV Classic layout for Grandstream browser user agents", () => {
    const hints = receiverRouteHints({
      host: "app.carepland.com",
      userAgent: "Mozilla/5.0 (Linux; Android 7.0; Grandstream GXV3370)",
    });

    assert.equal(hints.useClassic, true);
    assert.equal(hints.device, "gxv3370");
    assert.equal(hints.hardwareProfile, "grandstream_gxv3370");
    assert.equal(hints.uiLayout, "desk_phone_1024x600");
  });

  it("does not force Classic layout for ordinary browser visits", () => {
    const hints = receiverRouteHints({
      host: "app.carepland.com",
      userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X)",
    });

    assert.deepEqual(hints, { useClassic: false });
  });
});
