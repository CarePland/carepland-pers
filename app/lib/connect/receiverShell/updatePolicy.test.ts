import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { receiverShellUpdatePolicy } from "./updatePolicy";

describe("receiverShellUpdatePolicy", () => {
  it("treats the current debug APK version as up to date", () => {
    assert.deepEqual(
      receiverShellUpdatePolicy({ nativeVersionCode: 10, shellVersion: "0.1.9" })
        .managedUpdateRecommended,
      false
    );
    assert.deepEqual(receiverShellUpdatePolicy({ nativeVersionCode: 10 }), {
      canSelfUpdate: false,
      hardwareProfile: "",
      installedVersionCode: 10,
      installedVersionName: "",
      latestVersionCode: 10,
      latestVersionName: "0.1.9",
      managedUpdateRecommended: false,
      minSupportedVersionCode: 1,
      ok: true,
      releaseChannel: "local",
      updateAction: "none",
      updateAvailable: false,
      updateRequired: false,
    });
  });

  it("does not recommend updates when the APK version is unknown", () => {
    const policy = receiverShellUpdatePolicy({});

    assert.equal(policy.managedUpdateRecommended, false);
    assert.equal(policy.updateAvailable, false);
    assert.equal(policy.updateRequired, false);
  });

  it("recommends managed updates when a newer APK is available", () => {
    const policy = receiverShellUpdatePolicy(
      {
        hardwareProfile: "studio_gxv3370_1024x600",
        nativeVersionCode: 1,
        nativeVersionName: "0.1.0",
      },
      {
        installUrl: "https://example.test/carepland-receiver-v2.apk",
        latestVersionCode: 2,
        latestVersionName: "0.2.0",
        releaseChannel: "debug",
      }
    );

    assert.equal(policy.updateAction, "recommended");
    assert.equal(policy.updateAvailable, true);
    assert.equal(policy.updateRequired, false);
    assert.equal(policy.canSelfUpdate, false);
    assert.equal(policy.installUrl, "https://example.test/carepland-receiver-v2.apk");
    assert.equal(policy.hardwareProfile, "studio_gxv3370_1024x600");
  });

  it("marks updates required when the installed APK is below the support floor", () => {
    const policy = receiverShellUpdatePolicy(
      { nativeVersionCode: 1 },
      {
        latestVersionCode: 3,
        minSupportedVersionCode: 2,
      }
    );

    assert.equal(policy.updateAction, "required");
    assert.equal(policy.updateAvailable, true);
    assert.equal(policy.updateRequired, true);
    assert.equal(policy.managedUpdateRecommended, true);
  });
});
