import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  attachLocalAudioArtifactMessageLinks,
  findLocalAudioArtifactMessageLinks,
} from "./localAudioMessageLinks";

describe("local Connect audio message links", () => {
  it("matches local messages by audio artifact id", () => {
    const matches = findLocalAudioArtifactMessageLinks(
      {
        artifactId: "audio-artifact-1",
        audioUrl: "/api/connect/audio/media/audio-artifact-1.webm",
      },
      [
        {
          audioArtifactId: "audio-artifact-1",
          body: "Need help with my medication.",
          createdAt: "2026-06-18T10:00:00.000Z",
          from: "receiver",
          id: "message-1",
          to: "coordinator",
        },
      ]
    );

    assert.equal(matches.length, 1);
    assert.equal(matches[0]?.id, "message-1");
  });

  it("matches local messages by normalized audio URL", () => {
    const matches = findLocalAudioArtifactMessageLinks(
      {
        artifactId: "audio-artifact-2",
        audioUrl: "/api/connect/audio/media/audio-artifact-2.webm",
      },
      [
        {
          audioUrl: "http://localhost:3000/api/connect/audio/media/audio-artifact-2.webm",
          body: "Voice message",
          createdAt: "2026-06-18T11:00:00.000Z",
          from: "coordinator",
          id: "message-2",
          to: "receiver",
        },
      ]
    );

    assert.equal(matches.length, 1);
    assert.equal(matches[0]?.id, "message-2");
  });

  it("attaches the most recent linked message to local artifacts", () => {
    const artifacts = attachLocalAudioArtifactMessageLinks(
      [
        {
          artifactId: "audio-artifact-3",
          audioUrl: "/api/connect/audio/media/audio-artifact-3.webm",
        },
      ],
      [
        {
          audioArtifactId: "audio-artifact-3",
          body: "Older voice message",
          createdAt: "2026-06-18T09:00:00.000Z",
          from: "receiver",
          id: "message-old",
          to: "coordinator",
        },
        {
          audioArtifactId: "audio-artifact-3",
          body: "Newer voice message",
          createdAt: "2026-06-18T12:00:00.000Z",
          from: "receiver",
          id: "message-new",
          to: "coordinator",
        },
      ]
    );

    assert.equal(artifacts[0]?.relatedMessage?.id, "message-new");
  });

  it("filters local artifact links by Main Connect User", () => {
    const artifacts = attachLocalAudioArtifactMessageLinks(
      [
        {
          artifactId: "audio-artifact-4",
          audioUrl: "/api/connect/audio/media/audio-artifact-4.webm",
        },
        {
          artifactId: "audio-artifact-5",
          audioUrl: "/api/connect/audio/media/audio-artifact-5.webm",
        },
        {
          artifactId: "audio-artifact-6",
          audioUrl: "/api/connect/audio/media/audio-artifact-6.webm",
          mainConnectUserPersonId: "person-bob",
        },
      ],
      [
        {
          audioArtifactId: "audio-artifact-4",
          body: "Bob message",
          createdAt: "2026-06-18T12:00:00.000Z",
          from: "receiver",
          id: "message-bob",
          mainConnectUserPersonId: "person-bob",
          to: "coordinator",
        },
        {
          audioArtifactId: "audio-artifact-5",
          body: "Alice message",
          createdAt: "2026-06-18T12:05:00.000Z",
          from: "receiver",
          id: "message-alice",
          mainConnectUserPersonId: "person-alice",
          to: "coordinator",
        },
      ],
      { mainConnectUserPersonId: "person-bob" }
    );

    assert.equal(artifacts.length, 2);
    assert.equal(artifacts[0]?.relatedMessage?.id, "message-bob");
    assert.equal(artifacts[1]?.artifactId, "audio-artifact-6");
  });
});
