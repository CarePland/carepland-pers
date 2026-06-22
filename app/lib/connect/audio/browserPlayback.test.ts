import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  connectComfortVolumeLevel,
  connectEnhancedOutputGain,
} from "./browserPlayback";

describe("connect browser audio playback", () => {
  it("maps receiver comfort volume to playback volume", () => {
    assert.equal(connectComfortVolumeLevel("low"), 0.18);
    assert.equal(connectComfortVolumeLevel("med"), 0.5);
    assert.equal(connectComfortVolumeLevel("high"), 1);
  });

  it("caps enhanced output gain", () => {
    assert.ok(
      Math.abs(
      connectEnhancedOutputGain("high", {
        gainMultiplier: 1.25,
        playbackGain: 1.18,
      }) - 1.475
      ) < 0.000001
    );
    assert.equal(
      connectEnhancedOutputGain("high", {
        gainMultiplier: 2,
        playbackGain: 2,
      }),
      1.8
    );
  });
});
