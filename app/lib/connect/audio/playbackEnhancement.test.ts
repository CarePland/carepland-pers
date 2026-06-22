import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  connectAudioEnhancementProfileForVariant,
  connectAudioPreferenceFromEvents,
  connectAudioPreferenceWithFeedback,
  defaultConnectAudioPreference,
  randomizedConnectComparisonVersions,
} from "./playbackEnhancement";

describe("connect audio playback enhancement", () => {
  it("keeps all comparison versions while allowing blind ordering", () => {
    const versions = randomizedConnectComparisonVersions(() => 0);

    assert.deepEqual(
      versions.map((version) => version.variant).sort(),
      ["original", "version1", "version2"]
    );
    assert.deepEqual(
      versions.map((version) => version.choice).sort(),
      ["original", "version_1", "version_2"]
    );
  });

  it("learns preferred playback from receiver feedback events", () => {
    const preference = connectAudioPreferenceFromEvents([
      { source: "receiver_audio_feedback_original" },
      { source: "receiver_audio_feedback_version_2" },
      { source: "receiver_audio_feedback_version_2" },
      { source: "receiver_audio_feedback_same" },
    ]);

    assert.equal(preference.originalCount, 1);
    assert.equal(preference.version2Count, 2);
    assert.equal(preference.sameCount, 1);
    assert.equal(preference.preferredVariant, "version2");
  });

  it("uses original audio when original wins the preference", () => {
    const preference = connectAudioPreferenceWithFeedback(
      defaultConnectAudioPreference(),
      "original"
    );

    assert.equal(preference.preferredVariant, "original");
    assert.equal(connectAudioEnhancementProfileForVariant("default", preference), null);
  });

  it("keeps option recipes intentionally distinct for calibration", () => {
    const preference = defaultConnectAudioPreference();
    const option1 = connectAudioEnhancementProfileForVariant("version1", preference);
    const option2 = connectAudioEnhancementProfileForVariant("version2", preference);

    assert.equal(option1?.profileId, "bright_speech_clarity");
    assert.equal(option1?.adjustments.timbre, "brighter");
    assert.equal(option1?.adjustments.bassReduction, "strong");
    assert.equal(option2?.profileId, "steady_slow_speech");
    assert.equal(option2?.adjustments.speed, "slower");
    assert.equal(option2?.adjustments.compression, "strong");
  });
});
