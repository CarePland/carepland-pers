import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildConnectAudioProfile,
  filterAudioPlaybackEventsForMainConnectUser,
} from "./audioProfileScoping";
import type { LocalAudioPlaybackEvent } from "./localAudioPlaybackEvents";

function playbackEvent(
  overrides: Partial<LocalAudioPlaybackEvent> & Pick<LocalAudioPlaybackEvent, "eventId">
): LocalAudioPlaybackEvent {
  return {
    createdAt: "2026-06-21T12:00:00.000Z",
    playbackState: "started",
    ...overrides,
  };
}

describe("Connect audio profile scoping", () => {
  it("filters playback events to the selected Main Connect User", () => {
    const events = [
      playbackEvent({ eventId: "bob-started", mainConnectUserPersonId: "person-bob" }),
      playbackEvent({ eventId: "alice-started", mainConnectUserPersonId: "person-alice" }),
      playbackEvent({ eventId: "untagged" }),
    ];

    assert.deepEqual(
      filterAudioPlaybackEventsForMainConnectUser(events, "person-bob").map(
        (event) => event.eventId
      ),
      ["bob-started"]
    );
  });

  it("builds a person-scoped profile from local events only", () => {
    const profile = buildConnectAudioProfile({
      localPlaybackEvents: [
        playbackEvent({
          eventId: "bob-started",
          mainConnectUserPersonId: "person-bob",
          playbackState: "started",
        }),
        playbackEvent({
          eventId: "bob-ended",
          mainConnectUserPersonId: "person-bob",
          playbackState: "ended",
        }),
      ],
      prototypeProfile: null,
    });

    assert.equal(profile.summary.total, 2);
    assert.equal(profile.summary.playbackStarted, 1);
    assert.equal(profile.summary.playbackEnded, 1);
    assert.equal(profile.enhancementEvents.length, 2);
    assert.deepEqual(profile.events, []);
  });

  it("merges broad prototype profile data with local profile data", () => {
    const profile = buildConnectAudioProfile({
      localPlaybackEvents: [
        playbackEvent({
          eventId: "local-ended",
          playbackState: "ended",
        }),
      ],
      prototypeProfile: {
        enhancementEvents: [{ eventId: "prototype-enhancement" }],
        events: [{ eventId: "prototype-event" }],
        summary: {
          feedbackEvents: 2,
          sourceSummaries: [{ count: 2, source: "prototype" }],
          total: 4,
        },
      },
    });

    assert.equal(profile.summary.total, 5);
    assert.equal(profile.summary.feedbackEvents, 2);
    assert.equal(profile.summary.enhancementEvents, 1);
    assert.equal(profile.enhancementEvents.length, 2);
    assert.deepEqual(profile.events, [{ eventId: "prototype-event" }]);
    assert.equal(profile.summary.sourceSummaries?.length, 2);
  });
});
