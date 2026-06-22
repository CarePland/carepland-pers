import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildConnectAudioArtifactsResponse,
  buildConnectAudioReviewResponse,
  buildLocalAudioArtifactDetailResponse,
  localAudioArtifactIntegrityMatches,
} from "./audioArtifactScoping";

describe("Connect audio artifact scoping", () => {
  it("summarizes scoped local artifacts without prototype artifacts", () => {
    const response = buildConnectAudioArtifactsResponse({
      localArtifacts: [
        {
          artifactId: "local-linked",
          mainConnectUserPersonId: "person-bob",
          relatedMessage: {
            body: "Voice",
            createdAt: "2026-06-21T12:00:00.000Z",
            from: "receiver",
            id: "message-1",
            mainConnectUserPersonId: "person-bob",
            to: "Andrew",
          },
        },
        {
          artifactId: "local-unlinked",
          mainConnectUserPersonId: "person-bob",
        },
      ],
      mainConnectUserPersonId: "person-bob",
      prototypeArtifacts: [],
    });

    assert.equal(response.mainConnectUserPersonId, "person-bob");
    assert.equal(response.scope, "main_connect_user");
    assert.equal(response.summary.total, 2);
    assert.equal(response.summary.localArtifacts, 2);
    assert.equal(response.summary.prototypeArtifacts, 0);
    assert.equal(response.summary.linkedLocalArtifacts, 1);
  });

  it("combines unscoped prototype artifacts only when provided by the broad route", () => {
    const response = buildConnectAudioArtifactsResponse({
      localArtifacts: [{ artifactId: "local" }],
      mainConnectUserPersonId: "",
      prototypeArtifacts: [{ artifactId: "prototype" }],
    });

    assert.deepEqual(
      response.artifacts.map((artifact) => artifact.artifactId),
      ["local", "prototype"]
    );
    assert.equal(response.mainConnectUserPersonId, null);
    assert.equal(response.scope, "admin_broad");
    assert.equal(response.summary.prototypeArtifacts, 1);
  });

  it("builds person-scoped review summaries from local artifacts", () => {
    const response = buildConnectAudioReviewResponse({
      localArtifacts: [
        {
          artifactId: "local-review",
          mainConnectUserPersonId: "person-bob",
          relatedMessage: {
            body: "Voice",
            createdAt: "2026-06-21T12:00:00.000Z",
            from: "receiver",
            id: "message-1",
            mainConnectUserPersonId: "person-bob",
            to: "Andrew",
          },
        },
      ],
      mainConnectUserPersonId: "person-bob",
      prototypeReview: null,
    });

    assert.equal(response.review.mainConnectUserPersonId, "person-bob");
    assert.equal(response.review.scope, "main_connect_user");
    assert.equal(response.review.summary?.artifacts, 1);
    assert.equal(response.review.summary?.linkedLocalArtifacts, 1);
    assert.equal(response.review.summary?.localArtifacts, 1);
  });

  it("preserves broad prototype review summary fields while adding local counts", () => {
    const response = buildConnectAudioReviewResponse({
      localArtifacts: [{ artifactId: "local" }],
      mainConnectUserPersonId: "",
      prototypeReview: {
        artifacts: [{ artifactId: "prototype" }],
        summary: {
          missingOriginals: 2,
          pendingTranscripts: 3,
        },
      },
    });

    assert.deepEqual(
      response.review.artifacts?.map((artifact) => artifact.artifactId),
      ["local", "prototype"]
    );
    assert.equal(response.review.mainConnectUserPersonId, null);
    assert.equal(response.review.scope, "admin_broad");
    assert.equal(response.review.summary?.artifacts, 2);
    assert.equal(response.review.summary?.missingOriginals, 2);
    assert.equal(response.review.summary?.pendingTranscripts, 3);
  });

  it("builds local artifact detail with scoped related message and integrity status", () => {
    const response = buildLocalAudioArtifactDetailResponse({
      localArtifact: {
        artifactId: "artifact-1",
        audioByteSize: 42,
        audioSha256: "abc123",
        createdAt: "2026-06-21T12:00:00.000Z",
        mainConnectUserPersonId: "person-bob",
      },
      mainConnectUserPersonId: "person-bob",
      messageLinks: [
        {
          body: "Voice",
          createdAt: "2026-06-21T12:01:00.000Z",
          from: "receiver",
          id: "message-1",
          mainConnectUserPersonId: "person-bob",
          to: "Andrew",
        },
      ],
      storage: {
        audioUrl: "/api/connect/audio/media/artifact-1.webm",
        currentByteSize: 42,
        currentSha256: "abc123",
        exists: true,
        originalPreserved: true,
      },
    });

    assert.equal(response.mainConnectUserPersonId, "person-bob");
    assert.equal(response.scope, "main_connect_user");
    assert.equal(response.detail.artifact?.relatedMessage?.id, "message-1");
    assert.equal(response.detail.relatedMessage?.id, "message-1");
    assert.equal(response.detail.storage?.indexedByteSize, 42);
    assert.equal(response.detail.storage?.indexedSha256, "abc123");
    assert.equal(response.detail.storage?.integrityMatches, true);
    assert.equal(response.detail.auditTrail?.[0]?.type, "audio.artifact_preserved");
  });

  it("prefers sha256 integrity when both indexed and current hashes exist", () => {
    assert.equal(
      localAudioArtifactIntegrityMatches({
        currentByteSize: 42,
        currentSha256: "current",
        indexedByteSize: 42,
        indexedSha256: "indexed",
      }),
      false
    );
  });

  it("falls back to byte-size integrity when hashes are unavailable", () => {
    assert.equal(
      localAudioArtifactIntegrityMatches({
        currentByteSize: 42,
        indexedByteSize: 42,
      }),
      true
    );
    assert.equal(
      localAudioArtifactIntegrityMatches({
        currentByteSize: undefined,
        indexedByteSize: 42,
      }),
      undefined
    );
  });
});
