import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  extractTopicMentionsFromText,
  noteContentToText,
} from "./extraction";
import { type HealthTopic } from ".";

const topics: HealthTopic[] = [
  {
    aliases: ["BP", "hypertension", "home readings"],
    category: "vitals",
    displayName: "Blood Pressure",
    domain: "health",
    slug: "blood_pressure",
  },
  {
    aliases: ["labs", "bloodwork"],
    category: "labs",
    displayName: "Lab Results",
    domain: "health",
    slug: "lab_results",
  },
  {
    aliases: ["MRI", "x-ray"],
    category: "diagnostics",
    displayName: "Imaging",
    domain: "health",
    slug: "imaging",
  },
  {
    aliases: ["dentist", "cleaning", "tooth", "teeth", "gum"],
    category: "dental",
    displayName: "Dental / Oral Health",
    domain: "health",
    slug: "dental_oral_health",
  },
  {
    aliases: ["cardiologist", "heart doctor"],
    category: "specialists",
    displayName: "Cardiology",
    domain: "health",
    slug: "cardiology",
  },
  {
    aliases: ["pt", "rehab"],
    category: "therapy",
    displayName: "Physical Therapy",
    domain: "health",
    slug: "physical_therapy",
  },
  {
    aliases: ["fall risk", "balance"],
    category: "mobility",
    displayName: "Walking / Balance",
    domain: "health",
    slug: "walking_balance",
  },
];

describe("health topic extraction", () => {
  it("extracts normalized topics from aliases", () => {
    const mentions = extractTopicMentionsFromText(
      "BP was elevated at home. Labs will be rechecked next visit.",
      topics
    );

    assert.deepEqual(
      mentions.map((mention) => mention.topicSlug).sort(),
      ["blood_pressure", "lab_results"]
    );
    assert.equal(
      mentions.find((mention) => mention.topicSlug === "lab_results")?.status,
      "follow_up"
    );
  });

  it("deduplicates repeated terms for the same topic", () => {
    const mentions = extractTopicMentionsFromText(
      "Blood pressure and BP were both discussed because of hypertension.",
      topics
    );

    assert.equal(mentions.length, 1);
    assert.equal(mentions[0].topicSlug, "blood_pressure");
    assert.ok(mentions[0].confidence >= 0.9);
  });

  it("extracts dental and oral health context", () => {
    const mentions = extractTopicMentionsFromText(
      "Dental cleaning went well. Dentist wants to watch one tooth.",
      topics
    );

    assert.equal(mentions.length, 1);
    assert.equal(mentions[0].topicSlug, "dental_oral_health");
  });

  it("extracts narrative relationship topics without diagnosis coding", () => {
    const mentions = extractTopicMentionsFromText(
      "Cardiologist discussed BP and referred to PT because balance and fall risk are still concerns.",
      topics
    );

    assert.deepEqual(
      mentions.map((mention) => mention.topicSlug).sort(),
      ["blood_pressure", "cardiology", "physical_therapy", "walking_balance"]
    );
  });

  it("honors confidence thresholds", () => {
    const mentions = extractTopicMentionsFromText("BP was discussed.", topics, {
      confidenceThreshold: 0.8,
    });

    assert.equal(mentions.length, 0);
  });

  it("builds searchable note text from structured note fields", () => {
    assert.equal(
      noteContentToText({
        followups: ["Monitor BP"],
        summaryShort: "Visit summary",
        takeaways: [{ text: "Lab results reviewed" }],
      }),
      "Visit summary\nLab results reviewed\nMonitor BP"
    );
  });
});
