import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildTopicAliasMap,
  normalizeTopicSlug,
  recencyMultiplier,
  relatedTopicSlugsForMention,
  resolveTopicSlug,
  scoreContextCandidate,
  truncateSourceSnippet,
  type HealthTopic,
} from ".";
import {
  getFrequencyLabel,
  getRecencyLabel,
  getSpanLabel,
  healthFocusCardSummary,
  healthStoryNarrative,
  statusNarrativePhrase,
} from "./topicSummary";
import {
  buildUserContextFromFeedback,
  normalizeFeedbackDraft,
} from "./feedback";
import {
  latestRelationshipStateMap,
  relationshipContextSentence,
  relationshipStateFromContextText,
  relationshipStateFromFeedback,
} from "./relationshipFeedback";
import {
  applyTopicContextLabelOverrides,
  parseTopicContextLabelOverrides,
} from "./contextSignatureLabels";
import { healthFocusPromptVersionLabel } from "./prompts";

describe("healthTopics", () => {
  const topics: HealthTopic[] = [
    {
      aliases: ["BP", "high blood pressure", "home readings"],
      category: "vitals",
      displayName: "Blood Pressure",
      domain: "health",
      slug: "blood_pressure",
    },
    {
      aliases: ["med changes", "dose change"],
      category: "medications",
      displayName: "Medication Changes",
      domain: "health",
      slug: "medication_changes",
    },
  ];

  it("normalizes topic names and aliases into stable slugs", () => {
    assert.equal(normalizeTopicSlug(" Blood Pressure "), "blood_pressure");
    assert.equal(normalizeTopicSlug("Labs & Imaging"), "labs_and_imaging");

    const aliasMap = buildTopicAliasMap(topics);

    assert.equal(resolveTopicSlug("BP", aliasMap), "blood_pressure");
    assert.equal(resolveTopicSlug("Dose change", aliasMap), "medication_changes");
    assert.equal(resolveTopicSlug("Kidney Values", aliasMap), "kidney_values");
  });

  it("builds related topic slugs without repeating the current topic", () => {
    assert.deepEqual(
      relatedTopicSlugsForMention("blood_pressure", [
        "blood_pressure",
        "dizziness",
        "Medication Changes",
        "dizziness",
      ]),
      ["dizziness", "medication_changes"]
    );
  });

  it("scores same-provider topic context above merely related context", () => {
    const referenceDate = new Date("2026-06-07T12:00:00Z");
    const target = {
      appointmentStartsAt: "2026-06-10T16:00:00Z",
      appointmentType: "primary_care",
      providerName: "Dr. Smith",
      providerOrganization: "Main Street Clinic",
      specialty: "primary care",
      topicSlugs: ["blood_pressure"],
    };

    const sameProviderScore = scoreContextCandidate(
      {
        appointmentStartsAt: "2026-05-20T16:00:00Z",
        appointmentType: "primary_care",
        providerName: "Dr. Smith",
        providerOrganization: "Main Street Clinic",
        specialty: "primary care",
        status: "ongoing",
        topicSlugs: ["blood_pressure"],
      },
      target,
      { referenceDate }
    );

    const relatedOnlyScore = scoreContextCandidate(
      {
        appointmentStartsAt: "2026-05-20T16:00:00Z",
        appointmentType: "cardiology",
        providerName: "Dr. Patel",
        providerOrganization: "Heart Clinic",
        specialty: "cardiology",
        status: "ongoing",
        topicSlugs: ["blood_pressure"],
      },
      target,
      { referenceDate }
    );

    assert.ok(sameProviderScore.score > relatedOnlyScore.score);
    assert.deepEqual(sameProviderScore.sharedTopicSlugs, ["blood_pressure"]);
  });

  it("boosts recent urgent care context for primary care preparation", () => {
    const score = scoreContextCandidate(
      {
        appointmentStartsAt: "2026-06-01T12:00:00Z",
        appointmentType: "urgent_care",
        status: "follow_up",
        topicSlugs: ["dizziness"],
      },
      {
        appointmentStartsAt: "2026-06-12T12:00:00Z",
        appointmentType: "primary_care",
        topicSlugs: ["dizziness"],
      },
      { referenceDate: new Date("2026-06-07T12:00:00Z") }
    );

    assert.ok(score.breakdown.some((item) => item.factorKey === "recent_urgent_care"));
    assert.ok(score.breakdown.some((item) => item.factorKey === "pcp_broad_context"));
  });

  it("applies recency decay with a floor for older appointments", () => {
    const referenceDate = new Date("2026-06-07T12:00:00Z");

    assert.equal(
      recencyMultiplier("2026-06-07T12:00:00Z", referenceDate),
      1
    );
    assert.equal(
      recencyMultiplier("2020-06-07T12:00:00Z", referenceDate),
      0.15
    );
  });

  it("normalizes and truncates source snippets", () => {
    assert.equal(
      truncateSourceSnippet("  Blood   pressure was discussed.  ", 80),
      "Blood pressure was discussed."
    );
    assert.equal(
      truncateSourceSnippet("Blood pressure readings were elevated at home.", 26),
      "Blood pressure readings..."
    );
  });

  it("builds conversational context signature labels from dates and counts", () => {
    const referenceDate = new Date("2026-06-07T12:00:00Z");

    assert.equal(
      getRecencyLabel("2026-06-07T08:00:00Z", referenceDate),
      "Today"
    );
    assert.equal(
      getRecencyLabel("2026-05-12T08:00:00Z", referenceDate),
      "Last Month"
    );
    assert.equal(
      getRecencyLabel("2025-11-12T08:00:00Z", referenceDate),
      "Last Year"
    );
    assert.equal(getFrequencyLabel(1, 10), "Once");
    assert.equal(getFrequencyLabel(3, 10), "A Few Times");
    assert.equal(getFrequencyLabel(4, 20), "Occasionally");
    assert.equal(getFrequencyLabel(6, 20), "Fairly Often");
    assert.equal(getFrequencyLabel(12, 20), "Frequent");
    assert.equal(getFrequencyLabel(17, 20), "Most Visits");
    assert.equal(
      getSpanLabel("2026-01-07T08:00:00Z", "2026-06-07T08:00:00Z"),
      "Several Months"
    );
    assert.equal(
      getSpanLabel("2024-01-07T08:00:00Z", "2026-06-07T08:00:00Z"),
      "Multiple Years"
    );
  });

  it("applies Admin-managed Health Focus context label overrides", () => {
    const frequencyLabels = parseTopicContextLabelOverrides(`
      # Canonical = label_full;label_short
      A Few Times = A few saved visits;Few
      Most Visits: Most recorded visits;Most
    `);
    const displaySignature = applyTopicContextLabelOverrides(
      {
        frequencyLabel: "A Few Times",
        recencyLabel: "Earlier This Year",
        spanLabel: "Several Months",
      },
      {
        frequency: frequencyLabels,
        recency: {
          "Earlier This Year": {
            full: "Earlier in the year",
            short: "This year",
          },
        },
      }
    );

    assert.equal(displaySignature.frequencyLabel.full, "A few saved visits");
    assert.equal(displaySignature.frequencyLabel.short, "Few");
    assert.equal(displaySignature.recencyLabel.full, "Earlier in the year");
    assert.equal(displaySignature.recencyLabel.short, "This year");
    assert.equal(displaySignature.spanLabel.full, "Several Months");
    assert.equal(displaySignature.spanLabel.short, "Several Months");
  });

  it("labels Health Focus prompt versions for Admin-managed prompt paths", () => {
    assert.equal(
      healthFocusPromptVersionLabel("health_story_narrative_summary", {
        version_number: 3,
      }),
      "health_story_narrative_summary:v3"
    );
    assert.equal(
      healthFocusPromptVersionLabel("health_topic_feedback_interpretation", null),
      "health_topic_feedback_interpretation:fallback"
    );
  });

  it("turns Health Story clarification feedback into reusable care context", () => {
    const feedback = normalizeFeedbackDraft(
      {
        careCircleId: "care-circle-1",
        careSubjectId: "care-vip-1",
        feedbackMode: "clarification",
        relatedTopicSlug: "Dental / Oral Health",
        sourceAppointmentIds: ["appt-1", "appt-1"],
        systemSummaryText:
          "Pain appears in dental and orthopedic contexts.",
        targetType: "topic_relationship",
        topicSlug: "Pain",
        userComment: "The dental pain and knee pain are unrelated.",
      },
      "user-1"
    );
    const context = buildUserContextFromFeedback(feedback, "feedback-1");

    assert.equal(feedback.topic_slug, "pain");
    assert.equal(feedback.related_topic_slug, "dental_oral_health");
    assert.equal(feedback.feedback_mode, "clarification");
    assert.deepEqual(feedback.source_appointment_ids, ["appt-1"]);
    assert.equal(context?.context_type, "topic_relationship");
    assert.equal(
      context?.context_text,
      "The dental pain and knee pain are unrelated."
    );
    assert.equal(context?.source_feedback_id, "feedback-1");
  });

  it("uses the latest relationship feedback as visible relationship state", () => {
    const states = latestRelationshipStateMap([
      {
        created_at: "2026-06-01T10:00:00Z",
        related_topic_slug: "cholesterol",
        relationship_feedback: "unrelated",
      },
      {
        created_at: "2026-06-02T10:00:00Z",
        related_topic_slug: "cholesterol",
        relationship_feedback: "related",
      },
      {
        created_at: "2026-06-01T09:00:00Z",
        related_topic_slug: "sleep",
        relationship_feedback: "unrelated",
      },
    ]);

    assert.equal(relationshipStateFromFeedback("unrelated"), "separate");
    assert.equal(states.get("cholesterol"), "related");
    assert.equal(states.get("sleep"), "separate");
    assert.equal(
      relationshipStateFromContextText(
        "Asthma / Breathing and Blood Pressure were marked separate."
      ),
      "separate"
    );
  });

  it("phrases relationship corrections without repeating the source topic", () => {
    assert.equal(
      relationshipContextSentence({
        relatedDisplayNames: ["Blood Pressure"],
        relationshipState: "separate",
      }),
      "You noted Blood Pressure is separate."
    );
    assert.equal(
      relationshipContextSentence({
        relatedDisplayNames: ["Blood Pressure", "Cholesterol"],
        relationshipState: "separate",
      }),
      "You noted Blood Pressure and Cholesterol are separate."
    );
    assert.equal(
      relationshipContextSentence({
        relatedDisplayNames: ["Blood Pressure", "Cholesterol", "Sleep"],
        relationshipState: "separate",
      }),
      "You marked several topics as separate."
    );
    assert.equal(
      relationshipContextSentence({
        relatedDisplayNames: ["Physical Therapy"],
        relationshipState: "related",
      }),
      "You noted Physical Therapy is related."
    );
    assert.equal(
      relationshipContextSentence({
        relatedDisplayNames: ["Physical Therapy", "Knee Pain"],
        relationshipState: "related",
      }),
      "You noted Physical Therapy and Knee Pain are related."
    );
    assert.equal(
      relationshipContextSentence({
        relatedDisplayNames: ["Physical Therapy", "Knee Pain", "Arthritis"],
        relationshipState: "related",
      }),
      "You marked several topics as related."
    );

    const narrative = healthStoryNarrative({
      displayName: "Asthma / Breathing",
      latestMentionAt: "2026-06-23T20:33:00Z",
      mentionCount: 2,
      providerNames: [],
      relatedTopics: [],
      statuses: ["follow_up"],
      topicSlug: "asthma_breathing",
      userContextTexts: ["You noted Cholesterol is separate."],
    });

    assert.match(narrative, /You noted Cholesterol is separate/);
    assert.doesNotMatch(narrative, /You've clarified: You marked/);
  });

  it("summarizes physical therapy as part of a care thread when related topics support it", () => {
    const narrative = healthStoryNarrative({
      displayName: "Physical Therapy",
      latestMentionAt: "2026-05-15T20:29:00Z",
      mentionCount: 4,
      providerNames: ["Orthopaedic Sports Medicine", "Neurology Associates"],
      relatedTopics: [
        { displayName: "Knee Pain", topicSlug: "knee_pain" },
        { displayName: "Imaging", topicSlug: "imaging" },
        { displayName: "Pain", topicSlug: "pain" },
      ],
      statuses: ["ongoing"],
      topicSlug: "physical_therapy",
    });

    assert.match(narrative, /alongside knee pain and imaging/);
    assert.doesNotMatch(narrative, /saved notes|record connects|topic was mentioned/i);
    assert.doesNotMatch(narrative, /^This came up several times/);
  });

  it("includes prior user clarification in later Health Stories", () => {
    const narrative = healthStoryNarrative({
      displayName: "Pain",
      latestMentionAt: "2026-07-21T14:16:00Z",
      mentionCount: 5,
      providerNames: ["Harbor Dental", "Orthopaedic Sports Medicine"],
      relatedTopics: [
        { displayName: "Dental / Oral Health", topicSlug: "dental_oral_health" },
        { displayName: "Knee Pain", topicSlug: "knee_pain" },
        { displayName: "Imaging", topicSlug: "imaging" },
      ],
      statuses: ["follow_up", "ongoing"],
      topicSlug: "pain",
      userContextTexts: ["The dental pain and knee pain are unrelated."],
    });

    assert.match(narrative, /You've clarified/);
    assert.match(narrative, /dental pain and knee pain are unrelated/);
  });

  it("summarizes knee pain with the distinct related care sequence", () => {
    const narrative = healthStoryNarrative({
      displayName: "Knee Pain",
      latestMentionAt: "2026-03-22T07:00:00Z",
      mentionCount: 4,
      providerNames: ["Orthopaedic Sports Medicine"],
      relatedTopics: [
        { displayName: "Imaging", topicSlug: "imaging" },
        { displayName: "Arthritis", topicSlug: "arthritis" },
        { displayName: "Physical Therapy", topicSlug: "physical_therapy" },
        { displayName: "Follow-Up", topicSlug: "follow_up" },
      ],
      statuses: ["ongoing", "follow_up"],
      topicSlug: "knee_pain",
    });

    assert.match(narrative, /Source topics connect this/);
    assert.match(narrative, /imaging, arthritis, physical therapy, and follow-up care/);
    assert.doesNotMatch(narrative, /saved notes|record connects|topic was mentioned/i);
    assert.doesNotMatch(narrative, /^This came up several times/);
  });

  it("summarizes pain as dental and orthopedic contexts when both are related", () => {
    const narrative = healthStoryNarrative({
      displayName: "Pain",
      latestMentionAt: "2026-07-21T14:16:00Z",
      mentionCount: 5,
      providerNames: ["Harbor Dental", "Orthopaedic Sports Medicine"],
      relatedTopics: [
        { displayName: "Dental / Oral Health", topicSlug: "dental_oral_health" },
        { displayName: "Knee Pain", topicSlug: "knee_pain" },
        { displayName: "Imaging", topicSlug: "imaging" },
      ],
      statuses: ["follow_up", "ongoing"],
      topicSlug: "pain",
    });

    assert.match(narrative, /Dental care and knee-related care/);
    assert.match(narrative, /more than one pain thread rather than one single issue/);
    assert.doesNotMatch(narrative, /saved notes|record connects|topic was mentioned/i);
    assert.doesNotMatch(narrative, /last appeared|appeared recently|few months/i);
  });

  it("summarizes blood pressure as monitoring context when related topics support it", () => {
    const narrative = healthStoryNarrative({
      displayName: "Blood Pressure",
      latestMentionAt: "2026-02-14T08:00:00Z",
      mentionCount: 2,
      providerNames: ["Main Street Primary Care"],
      relatedTopics: [
        { displayName: "Dizziness", topicSlug: "dizziness" },
        { displayName: "Cholesterol", topicSlug: "cholesterol" },
        { displayName: "Medication Changes", topicSlug: "medication_changes" },
      ],
      statuses: ["follow_up"],
      topicSlug: "blood_pressure",
    });

    assert.match(narrative, /dizziness, cholesterol, and medication changes/);
    assert.match(narrative, /primary care or cardiology conversations/);
    assert.doesNotMatch(narrative, /saved notes|record connects|topic was mentioned/i);
    assert.doesNotMatch(narrative, /^This came up a few times/);
  });

  it("uses condensed Health Focus card summaries without pill details", () => {
    const summary = healthFocusCardSummary({
      displayName: "Blood Pressure",
      mentionCount: 2,
      providerNames: ["Main Street Primary Care"],
      relatedTopics: [
        { displayName: "Dizziness", topicSlug: "dizziness" },
        { displayName: "Cholesterol", topicSlug: "cholesterol" },
        { displayName: "Nutrition / Weight", topicSlug: "nutrition_weight" },
        { displayName: "Anxiety / Stress", topicSlug: "anxiety_stress" },
        { displayName: "Follow-Up", topicSlug: "follow_up" },
      ],
      statuses: ["follow_up"],
      topicSlug: "blood_pressure",
    });

    assert.equal(
      summary,
      "Blood pressure appears to be part of broader health monitoring rather than a standalone concern."
    );
    assert.ok(summary.length <= 160);
    assert.doesNotMatch(
      summary,
      /recent|earlier|several times|few times|frequent|months|years|visits/i
    );
  });

  it("uses conversational Health Focus card phrasing for split pain context", () => {
    const summary = healthFocusCardSummary({
      displayName: "Pain",
      mentionCount: 5,
      providerNames: ["Harbor Dental", "Orthopaedic Sports Medicine"],
      relatedTopics: [
        { displayName: "Dental / Oral Health", topicSlug: "dental_oral_health" },
        { displayName: "Knee Pain", topicSlug: "knee_pain" },
        { displayName: "Imaging", topicSlug: "imaging" },
      ],
      statuses: ["follow_up", "ongoing"],
      topicSlug: "pain",
    });

    assert.equal(
      summary,
      "You've discussed both dental pain and knee-related pain. These appear to be separate concerns."
    );
    assert.ok(summary.length <= 120);
  });

  it("turns visit statuses into relevant narrative phrases", () => {
    const phrase = statusNarrativePhrase(
      ["follow_up", "ongoing", "unknown"],
      "knee_pain"
    );

    assert.match(phrase, /follow-up|ongoing/);
    assert.doesNotMatch(phrase, /resolved|new/);

    const broadPhrase = statusNarrativePhrase(
      ["follow_up", "ongoing", "resolved"],
      "pain"
    );

    assert.doesNotMatch(broadPhrase, /follow-up, ongoing, and resolved/);
  });

  it("hard-caps Health Focus card summaries at 200 characters", () => {
    const summary = healthFocusCardSummary({
      displayName:
        "A very long custom health focus topic with a lot of extra wording",
      mentionCount: 1,
      providerNames: [
        "A very long provider organization name that should not dominate the card",
      ],
      relatedTopics: [],
      statuses: [],
      topicSlug: "custom_topic",
    });

    assert.ok(summary.length <= 200);
  });
});
