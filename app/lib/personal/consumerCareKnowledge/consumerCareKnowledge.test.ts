import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildConsumerCareKnowledgeContext,
  buildConsumerCareKnowledgePromptContext,
  findConsumerCareKnowledgeMatches,
} from ".";

describe("consumer care knowledge", () => {
  it("matches consumer medication packaging language", () => {
    const matches = findConsumerCareKnowledgeMatches(
      "PillPack was late, so Dad missed the morning packet."
    );

    assert.equal(matches[0]?.entry.canonicalTerm, "PillPack");
    assert.ok(matches.some((match) => match.entry.canonicalTerm === "PillPack"));
  });

  it("recognizes common access and portal terms", () => {
    const matches = findConsumerCareKnowledgeMatches(
      "The cardiology office said the medicine needs prior auth, and the denial is in MyChart."
    );
    const terms = matches.map((match) => match.entry.canonicalTerm).sort();

    assert.deepEqual(terms, ["MyChart", "Prior authorization"]);
  });

  it("recognizes pharmacy benefit and prescription plan brand identities", () => {
    const matches = findConsumerCareKnowledgeMatches(
      "Caremark said Silver Script needs the refill approved first."
    );
    const terms = matches.map((match) => match.entry.canonicalTerm).sort();

    assert.deepEqual(terms, ["CVS Caremark", "SilverScript"]);
  });

  it("recognizes phonetic GEHA references when users say it aloud", () => {
    const context = buildConsumerCareKnowledgeContext(
      "Ghee hah said the specialist is in network.",
      { useCase: "transcript_interpretation" }
    );

    assert.equal(context.hasMatches, true);
    assert.deepEqual(context.conceptIds, ["insurance_access.geha"]);
    assert.deepEqual(context.matchedTerms, ["G.E.H.A"]);
    assert.match(context.promptContext, /ghee hah -> G\.E\.H\.A/);
    assert.match(context.promptContext, /Concept ID: insurance_access\.geha/);
    assert.match(context.promptContext, /Do not infer plan type/);
  });

  it("recognizes mobility and monitoring equipment without diagnosis inference", () => {
    const matches = findConsumerCareKnowledgeMatches(
      "Bring the rollator and the glucose meter to the appointment."
    );
    const terms = matches.map((match) => match.entry.canonicalTerm).sort();

    assert.deepEqual(terms, ["Blood sugar meter", "Rollator"]);
  });

  it("keeps generic unrelated text out of the prompt context", () => {
    assert.equal(
      buildConsumerCareKnowledgePromptContext("They watched a movie and talked about lunch."),
      ""
    );
  });

  it("builds bounded prompt context with storage guardrails", () => {
    const context = buildConsumerCareKnowledgePromptContext(
      "She uses GoodRx for one refill and sent a portal message about test strips.",
      { maxEntries: 2 }
    );

    assert.match(context, /Consumer Care Knowledge Layer context/);
    assert.match(context, /not medical advice/);
    assert.match(context, /Store\/summarize only care-relevant facts actually discussed/);
    assert.match(context, /GoodRx/);
    assert.ok(context.split("\n- ").length <= 3);
  });

  it("returns reusable context for user-question workflows", () => {
    const context = buildConsumerCareKnowledgeContext(
      "Does the prior auth affect the walker order?",
      { useCase: "user_question" }
    );

    assert.equal(context.hasMatches, true);
    assert.equal(context.useCase, "user_question");
    assert.deepEqual(context.matchedTerms.sort(), [
      "Prior authorization",
      "Walker",
    ]);
    assert.match(context.promptContext, /user question/);
    assert.match(context.promptContext, /Answer only from supplied CarePland context/);
  });

  it("allows admin review to inspect a larger matched set", () => {
    const context = buildConsumerCareKnowledgeContext(
      "PillPack, GoodRx, prior auth, MyChart, DME, rollator, CGM, home health, PT, and compression socks were all mentioned.",
      { useCase: "admin_review" }
    );

    assert.equal(context.hasMatches, true);
    assert.ok(context.matches.length > 8);
    assert.match(context.promptContext, /prompt-review opportunities/);
  });
});
