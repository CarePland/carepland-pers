import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  createObservation,
  submitObservation,
} from "./observationPipeline";

describe("Observation pipeline", () => {
  it("creates a person-scoped Observation without choosing intent", () => {
    const observation = createObservation({
      deviceId: "receiver-device-1",
      metadata: {
        ignored: undefined,
        receiverInstallId: "install-1",
      },
      modality: "typed",
      observedAt: "2026-07-10T12:00:00.000Z",
      personId: "person-1",
      source: "receiver",
      surface: "ask_tell",
      text: "I need milk",
    });

    assert.equal(observation.context?.careSubjectId, "person-1");
    assert.equal(observation.context?.deviceId, "receiver-device-1");
    assert.equal(observation.context?.surface, "ask_tell");
    assert.equal(observation.modality, "typed");
    assert.equal(observation.rawText, "I need milk");
    assert.equal(observation.metadata?.receiverInstallId, "install-1");
    assert.equal("ignored" in (observation.metadata ?? {}), false);
  });

  it("routes speech through the legacy Talk handler after Observation capture", async () => {
    const seen: string[] = [];
    const submission = await submitObservation(
      {
        modality: "speech",
        personId: "person-1",
        source: "receiver",
        text: "I went for a walk.",
      },
      {
        handleSpeech: (observation) => {
          seen.push(`${observation.source}:${observation.modality}:${observation.rawText}`);
          return { handled: true, result: "talk" };
        },
        handleText: () => "ask",
      }
    );

    assert.equal(submission.route, "legacy_speech_talk");
    assert.equal(submission.result, "talk");
    assert.deepEqual(seen, ["receiver:speech:I went for a walk."]);
  });

  it("routes typed and example input through the same legacy Ask handler", async () => {
    const typed = await submitObservation(
      {
        modality: "typed",
        personId: "person-1",
        source: "receiver",
        text: "When is my next appointment?",
      },
      {
        handleSpeech: () => ({ handled: true, result: "talk" }),
        handleText: (observation) => `ask:${observation.modality}`,
      }
    );
    const example = await submitObservation(
      {
        modality: "example",
        personId: "person-1",
        source: "receiver",
        text: "When is my next appointment?",
      },
      {
        handleSpeech: () => ({ handled: true, result: "talk" }),
        handleText: (observation) => `ask:${observation.modality}`,
      }
    );

    assert.equal(typed.route, "legacy_text_ask");
    assert.equal(example.route, "legacy_text_ask");
    assert.equal(typed.result, "ask:typed");
    assert.equal(example.result, "ask:example");
    assert.equal(typed.meaningFrame.normalizedText, "When is my next appointment?");
    assert.equal(example.meaningFrame.normalizedText, "When is my next appointment?");
    assert.equal(typed.meaningFrame.provenance.modality, "typed");
    assert.equal(example.meaningFrame.provenance.modality, "example");
  });

  it("falls back to legacy Ask when legacy Talk cannot handle speech", async () => {
    const submission = await submitObservation(
      {
        modality: "speech",
        personId: "person-1",
        source: "receiver",
        text: "The purple idea is sideways.",
      },
      {
        handleSpeech: () => ({ handled: false }),
        handleText: () => "recovery",
      }
    );

    assert.equal(submission.route, "legacy_text_ask_fallback");
    assert.equal(submission.result, "recovery");
  });

  it("preserves provenance on the MeaningFrame while keeping modality out of text handling", async () => {
    const seen: string[] = [];
    const submission = await submitObservation(
      {
        deviceId: "receiver-device-1",
        metadata: { receiverInstallId: "install-1" },
        modality: "example",
        observedAt: "2026-07-10T13:00:00.000Z",
        personId: "person-1",
        source: "receiver",
        surface: "ask_tell",
        text: "I need milk",
      },
      {
        handleText: (_observation, meaningFrame) => {
          seen.push(meaningFrame.normalizedText);
          return "shared-ask";
        },
      }
    );

    assert.equal(submission.result, "shared-ask");
    assert.deepEqual(seen, ["I need milk"]);
    assert.equal(submission.meaningFrame.provenance.modality, "example");
    assert.equal(submission.meaningFrame.provenance.source, "receiver");
    assert.equal(submission.meaningFrame.provenance.surface, "ask_tell");
    assert.equal(submission.meaningFrame.provenance.deviceId, "receiver-device-1");
    assert.equal(submission.observation.metadata?.receiverInstallId, "install-1");
  });
});
