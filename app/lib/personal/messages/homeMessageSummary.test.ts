import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { buildHomeMessageSummary } from "./homeMessageSummary";

const baseMessage = {
  body: "",
  createdAt: "2026-07-13T12:00:00.000Z",
  id: "message-1",
  transcript: "",
};

function person(
  personId: string,
  personName: string,
  messages: Array<{ body: string; id: string }>
) {
  return {
    messages: messages.map((message, index) => ({
      ...baseMessage,
      body: message.body,
      createdAt: `2026-07-13T12:0${index}:00.000Z`,
      id: message.id,
    })),
    personId,
    personName,
  };
}

describe("Home message summaries", () => {
  it("combines overlapping individual points", () => {
    const result = buildHomeMessageSummary([
      person("rob", "Rob", [
        { body: "Bring your glasses.", id: "message-1" },
        { body: "Bring your glasses and vision prescription.", id: "message-2" },
      ]),
    ]);

    const summary = result.individualSummaries[0];
    assert.equal(summary?.summary, "Bring your glasses and vision prescription.");
    assert.equal(summary?.keyPoints.length, 1);
    assert.deepEqual(summary?.keyPoints[0]?.sourceMessageIds, [
      "message-1",
      "message-2",
    ]);
  });

  it("preserves distinct actionable details", () => {
    const result = buildHomeMessageSummary([
      person("rob", "Rob", [
        { body: "Bring your glasses and vision prescription.", id: "message-1" },
        { body: "Your eyes will be dilated.", id: "message-2" },
        { body: "You should arrange a ride home.", id: "message-3" },
      ]),
    ]);

    assert.equal(
      result.individualSummaries[0]?.summary,
      "Your eyes will be dilated. Arrange a ride home. Bring your glasses and vision prescription."
    );
  });

  it("keeps concrete bring details from overlapping recent Home messages", () => {
    const result = buildHomeMessageSummary([
      person("rob", "Rob", [
        { body: "Bring your Rx sunglasses this time", id: "message-1" },
        { body: "Be sure to bring exercise plan papers", id: "message-2" },
        { body: "Bring your pairs of glasses and sunglasses", id: "message-3" },
      ]),
    ]);

    assert.equal(
      result.individualSummaries[0]?.summary,
      "Bring prescription glasses and sunglasses. Bring exercise plan papers."
    );
    assert.deepEqual(result.individualSummaries[0]?.sourceMessageIds, [
      "message-1",
      "message-3",
      "message-2",
    ]);
  });

  it("creates an Everyone summary when two people reinforce the same topic", () => {
    const result = buildHomeMessageSummary([
      person("rob", "Rob", [
        { body: "Your eyes will be dilated.", id: "message-1" },
      ]),
      person("ellie", "Ellie", [
        { body: "The eye doctor will dilate your pupils.", id: "message-2" },
      ]),
    ]);

    assert.equal(
      result.everyoneSummary?.summary,
      "More than one person mentioned that your eyes will be dilated."
    );
    assert.deepEqual(result.everyoneSummary?.reinforcedTopics[0]?.personIds, [
      "rob",
      "ellie",
    ]);
  });

  it("returns null Everyone summary when only one person mentions a topic", () => {
    const result = buildHomeMessageSummary([
      person("rob", "Rob", [
        { body: "Your eyes will be dilated.", id: "message-1" },
      ]),
      person("ellie", "Ellie", [
        { body: "OK", id: "message-2" },
      ]),
    ]);

    assert.equal(result.everyoneSummary, null);
    assert.equal(
      result.decisionTrace.omittedEveryoneSummaryReason,
      "fewer_than_two_people_with_summaries"
    );
  });

  it("returns null Everyone summary when multiple people have unrelated messages", () => {
    const result = buildHomeMessageSummary([
      person("rob", "Rob", [
        { body: "Bring your insurance card.", id: "message-1" },
      ]),
      person("ellie", "Ellie", [
        { body: "Call the clinic to confirm the appointment.", id: "message-2" },
      ]),
    ]);

    assert.equal(result.everyoneSummary, null);
    assert.equal(
      result.decisionTrace.omittedEveryoneSummaryReason,
      "no_concrete_meaning_reinforced_by_multiple_people"
    );
  });

  it("treats paraphrased equivalent statements as reinforcement", () => {
    const result = buildHomeMessageSummary([
      person("rob", "Rob", [
        { body: "Your eyes will be dilated.", id: "message-1" },
      ]),
      person("ellie", "Ellie", [
        { body: "The eye doctor will dilate your pupils.", id: "message-2" },
      ]),
    ]);

    assert.equal(
      result.everyoneSummary?.reinforcedTopics[0]?.normalizedMeaning,
      "eye appointment includes pupil dilation"
    );
  });

  it("does not treat vaguely related but different statements as reinforcement", () => {
    const result = buildHomeMessageSummary([
      person("rob", "Rob", [
        { body: "Bring your glasses.", id: "message-1" },
      ]),
      person("ellie", "Ellie", [
        { body: "You may need a ride home.", id: "message-2" },
      ]),
    ]);

    assert.equal(result.everyoneSummary, null);
  });

  it("cites the correct people and source messages for Everyone summaries", () => {
    const result = buildHomeMessageSummary([
      person("rob", "Rob", [
        { body: "Your eyes will be dilated.", id: "message-1" },
        { body: "Arrange a ride home.", id: "message-2" },
      ]),
      person("ellie", "Ellie", [
        { body: "The eye doctor will dilate your pupils.", id: "message-3" },
      ]),
    ]);

    assert.deepEqual(result.everyoneSummary?.reinforcedTopics[0]?.personIds, [
      "rob",
      "ellie",
    ]);
    assert.deepEqual(
      result.everyoneSummary?.reinforcedTopics[0]?.sourceMessageIds,
      ["message-1", "message-3"]
    );
  });

  it("can include a unique supporting recommendation without making it consensus", () => {
    const result = buildHomeMessageSummary([
      person("rob", "Rob", [
        { body: "Your eyes will be dilated.", id: "message-1" },
        { body: "You should arrange a ride home.", id: "message-2" },
      ]),
      person("ellie", "Ellie", [
        { body: "The eye doctor will dilate your pupils.", id: "message-3" },
      ]),
    ]);

    assert.equal(
      result.everyoneSummary?.summary,
      "More than one person mentioned that your eyes will be dilated. Rob also recommended arranging a ride home."
    );
    assert.deepEqual(result.everyoneSummary?.uniqueSupportingPoint, {
      personId: "rob",
      sourceMessageIds: ["message-2"],
      text: "arranging a ride home",
    });
    assert.equal(result.everyoneSummary?.reinforcedTopics.length, 1);
  });

  it("does not generate filler Everyone summaries", () => {
    const result = buildHomeMessageSummary([
      person("rob", "Rob", [{ body: "Thanks", id: "message-1" }]),
      person("ellie", "Ellie", [{ body: "OK", id: "message-2" }]),
    ]);

    assert.equal(result.everyoneSummary, null);
    assert.deepEqual(result.individualSummaries, []);
  });
});
