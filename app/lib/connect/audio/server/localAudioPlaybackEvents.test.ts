import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, it } from "node:test";

import {
  localAudioPlaybackProfile,
  readLocalAudioPlaybackEvents,
  recordLocalAudioPlaybackEvent,
} from "./localAudioPlaybackEvents";

describe("local Connect audio playback events", () => {
  it("records receiver playback attempts and summarizes them for Admin", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "connect-audio-playback-"));
    const indexPath = path.join(dir, "playback-events.json");

    try {
      await recordLocalAudioPlaybackEvent(
        {
          audioUrl: "/api/connect/audio/media/receiver/message.webm",
          mainConnectUserPersonId: "person-bob",
          messageFrom: "Andrew",
          messageId: "message-1",
          playbackState: "started",
        },
        { indexPath }
      );
      await recordLocalAudioPlaybackEvent(
        {
          audioUrl: "/api/connect/audio/media/receiver/message.webm",
          messageFrom: "Andrew",
          messageId: "message-1",
          playbackState: "ended",
        },
        { indexPath }
      );
      await recordLocalAudioPlaybackEvent(
        {
          audioEnhancementProfile: {
            adjustments: {
              bassReduction: "strong",
              compression: "moderate",
              speed: "normal",
              timbre: "brighter",
            },
            gainMultiplier: 1.25,
            highPassHz: 165,
            lowMidGainDb: -3.5,
            playbackGain: 1.18,
            playbackRate: 1,
            presenceGainDb: 8,
            profileId: "bright_speech_clarity",
            reasons: ["presence_boost", "rumble_reduction"],
          },
          audioUrl: "/api/connect/audio/media/receiver/message.webm",
          messageFrom: "Andrew",
          messageId: "message-1",
          playbackState: "feedback",
          source: "receiver_audio_feedback_version_1",
        },
        { indexPath }
      );
      await recordLocalAudioPlaybackEvent(
        {
          audioUrl: "/api/connect/audio/media/receiver/message.webm",
          messageFrom: "Andrew",
          messageId: "message-1",
          playbackState: "feedback",
          source: "receiver_audio_feedback_original",
        },
        { indexPath }
      );

      const index = await readLocalAudioPlaybackEvents({ indexPath });
      const profile = localAudioPlaybackProfile(index.events);

      assert.equal(index.events.length, 4);
      assert.equal(index.events[3]?.mainConnectUserPersonId, "person-bob");
      assert.equal(profile.enhancementEvents.length, 4);
      assert.equal(profile.summary.feedbackEvents, 2);
      assert.equal(profile.summary.helped, 1);
      assert.equal(profile.summary.averageProfile.playbackRate, 1);
      assert.equal(profile.summary.averageProfile.highPassHz, 165);
      assert.equal(
        profile.summary.commonReasons.some(
          (reason) => reason.reason === "presence_boost" && reason.count === 1
        ),
        true
      );
      assert.equal(profile.summary.learningSummary.preferenceCounts.version1, 1);
      assert.equal(profile.summary.learningSummary.preferenceCounts.original, 1);
      assert.equal(profile.summary.learningSummary.adjustments.timbre.brighter, 1);
      assert.equal(profile.summary.learningSummary.adjustments.bassReduction.strong, 1);
      assert.equal(profile.summary.playbackStarted, 1);
      assert.equal(profile.summary.playbackEnded, 1);
      assert.equal(profile.summary.playbackErrors, 0);
      assert.equal(profile.summary.sourceSummaries[0]?.label, "Receiver playback");
    } finally {
      await rm(dir, { force: true, recursive: true });
    }
  });

  it("preserves Main Connect User on playback feedback events", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "connect-audio-playback-"));
    const indexPath = path.join(dir, "playback-events.json");

    try {
      const event = await recordLocalAudioPlaybackEvent(
        {
          artifactId: "artifact-1",
          audioUrl: "/api/connect/audio/media/receiver/message.webm",
          mainConnectUserPersonId: "person-bob",
          messageFrom: "Andrew",
          messageId: "message-1",
          playbackState: "feedback",
          source: "receiver_audio_feedback_version_1",
        },
        { indexPath }
      );
      const index = await readLocalAudioPlaybackEvents({ indexPath });

      assert.equal(event.mainConnectUserPersonId, "person-bob");
      assert.equal(index.events[0]?.mainConnectUserPersonId, "person-bob");
      assert.equal(index.events[0]?.artifactId, "artifact-1");
      assert.equal(index.events[0]?.playbackState, "feedback");
    } finally {
      await rm(dir, { force: true, recursive: true });
    }
  });
});
