import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  classifyConnectAudioArtifact,
  connectAudioDomainCatalogSnapshot,
} from "./domain";

describe("connect audio domain", () => {
  it("classifies receiver Ask input as local receiver audio", () => {
    assert.deepEqual(
      classifyConnectAudioArtifact({
        source: "receiver-ask-input",
      }),
      {
        artifactKind: "ask_input",
        audioDirection: "receiver_local_input",
      }
    );
  });

  it("classifies Ask recovery audio without making recovery the parent object", () => {
    assert.deepEqual(
      classifyConnectAudioArtifact({
        audioUrl: "/uploads/ask-recovery-1710000000000.webm",
        source: "ask_recovery",
      }),
      {
        artifactKind: "ask_recovery",
        audioDirection: "receiver_local_input",
      }
    );
  });

  it("classifies coordinator messages as coordinator-to-receiver", () => {
    assert.deepEqual(
      classifyConnectAudioArtifact({
        from: "coordinator_user",
        source: "message",
        to: "receiver_user",
      }),
      {
        artifactKind: "coordinator_message",
        audioDirection: "coordinator_to_receiver",
      }
    );
  });

  it("classifies receiver messages as receiver-to-coordinator", () => {
    assert.deepEqual(
      classifyConnectAudioArtifact({
        from: "receiver_user",
        source: "message",
        to: "Andrew",
      }),
      {
        artifactKind: "receiver_message",
        audioDirection: "receiver_to_coordinator",
      }
    );
  });

  it("classifies unindexed upload recovery without discarding the original", () => {
    assert.deepEqual(
      classifyConnectAudioArtifact({
        audioUrl: "/uploads/message-1710000000000.webm",
        source: "recovered-upload",
      }),
      {
        artifactKind: "recovered_upload",
        audioDirection: "unknown",
      }
    );
  });

  it("falls back to unknown for unsupported explicit values", () => {
    assert.deepEqual(
      classifyConnectAudioArtifact({
        artifactKind: "appointment_audio",
        audioDirection: "personal_appointment",
      }),
      {
        artifactKind: "unknown",
        audioDirection: "unknown",
      }
    );
  });

  it("exposes product-neutral catalogs for Admin and migration review", () => {
    const snapshot = connectAudioDomainCatalogSnapshot();

    assert.equal(snapshot.audioDomainModel.domain, "carepland.audio");
    assert.ok(snapshot.capabilities.some((item) => item.id === "review_bundle"));
    assert.ok(
      snapshot.capabilities.some(
        (item) => item.id === "sender_voice_future_placeholder"
      )
    );
    assert.ok(
      snapshot.artifacts.artifactKinds.some((item) => item.kind === "ask_input")
    );
    assert.ok(
      snapshot.maintenanceActions.some(
        (item) => item.action === "backfill_integrity"
      )
    );
  });
});
