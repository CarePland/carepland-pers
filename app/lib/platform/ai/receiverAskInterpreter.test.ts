import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { createObservation } from "./observationPipeline";
import {
  answerReceiverAsk,
  interpretReceiverAskIntent,
  interpretReceiverAskObservation,
} from "./receiverAskInterpreter";

const contacts = [
  { displayName: "Andrew", id: "contact-andrew" },
  { displayName: "Beth", id: "contact-beth" },
  { displayName: "Susan", id: "contact-susan" },
];

type ReceiverAskObservationInterpretation = ReturnType<
  typeof interpretReceiverAskObservation
>;

function requireAskInterpretation(
  interpretation: ReceiverAskObservationInterpretation
) {
  assert.ok(interpretation.askInterpretation);
  return interpretation.askInterpretation;
}

describe("Receiver Ask interpreter", () => {
  it("preserves current upcoming appointment answer", () => {
    assert.deepEqual(
      answerReceiverAsk("When is my next appointment?", contacts[0], contacts[0]),
      {
        actionLabel: "That answered my question",
        answer: "Upcoming appointments are available for the active Main Connect User.",
        messageBody: "",
        question: "When is my next appointment?",
        recipientId: "",
        type: "answer",
      }
    );
  });

  it("preserves current past visit answer", () => {
    assert.deepEqual(
      answerReceiverAsk("What did I talk about with the doctor?", contacts[0], contacts[0]),
      {
        actionLabel: "That answered my question",
        answer: "Past visit notes are not available from this Receiver view yet.",
        messageBody: "",
        question: "What did I talk about with the doctor?",
        recipientId: "",
        type: "answer",
      }
    );
  });

  it("preserves current symptom-style send-to-Andrew behavior", () => {
    assert.deepEqual(
      answerReceiverAsk("Tell Andrew my knee hurts.", contacts[1], contacts[0]),
      {
        actionLabel: "Send to Andrew",
        answer: "This may be important.",
        messageBody: "Tell Andrew my knee hurts.",
        question: "Tell Andrew my knee hurts.",
        recipientId: "contact-andrew",
        type: "message",
      }
    );
  });

  it("routes typed and example Observations through the same shared interpreter", () => {
    const typed = interpretReceiverAskObservation({
      contacts,
      fallbackContact: contacts[0],
      observation: createObservation({
        modality: "typed",
        source: "receiver",
        text: "I need milk",
      }),
    });
    const example = interpretReceiverAskObservation({
      contacts,
      fallbackContact: contacts[0],
      observation: createObservation({
        modality: "example",
        source: "receiver",
        text: "I need milk",
      }),
    });

    assert.equal(typed.needsRecovery, false);
    assert.equal(example.needsRecovery, false);
    assert.equal(typed.answer?.messageBody, "I need milk");
    assert.equal(example.answer?.messageBody, "I need milk");
    assert.equal(typed.meaningFrame.normalizedText, example.meaningFrame.normalizedText);
    assert.equal(typed.meaningFrame.provenance.modality, "typed");
    assert.equal(example.meaningFrame.provenance.modality, "example");
  });

  it("keeps What should I bring on the Ask path instead of making Send primary", () => {
    const interpretation = interpretReceiverAskObservation({
      contacts,
      fallbackContact: contacts[0],
      observation: createObservation({
        modality: "example",
        source: "receiver",
        text: "What should I bring?",
      }),
    });

    assert.equal(interpretation.familyClassification.family, "ask");
    assert.equal(interpretation.needsRecovery, false);
    const ask = requireAskInterpretation(interpretation);
    assert.equal(ask.intent, "upcoming_plan");
    assert.equal(ask.capabilityStatus, "capability_missing");
    assert.equal(interpretation.answer?.type, "answer");
    assert.equal(
      interpretation.answer?.answer,
      "This is a question about upcoming plans. Plan details are not available in this preview yet."
    );
    assert.equal(interpretation.answer?.actionLabel, "OK");
  });

  it("uses the family layer to present needs as something to send", () => {
    const interpretation = interpretReceiverAskObservation({
      contacts,
      fallbackContact: contacts[0],
      observation: createObservation({
        modality: "typed",
        source: "receiver",
        text: "I need milk.",
      }),
    });

    assert.equal(interpretation.familyClassification.family, "need");
    assert.equal(interpretation.askInterpretation, undefined);
    assert.equal(interpretation.answer?.type, "message");
    assert.equal(interpretation.answer?.answer, "This sounds like something that needs attention.");
    assert.equal(interpretation.answer?.actionLabel, "Send to Andrew");
  });

  it("uses the family layer to present health observations as concerns", () => {
    const interpretation = interpretReceiverAskObservation({
      contacts,
      fallbackContact: contacts[0],
      observation: createObservation({
        modality: "typed",
        source: "receiver",
        text: "I feel dizzy.",
      }),
    });

    assert.equal(interpretation.familyClassification.family, "observe");
    assert.equal(interpretation.askInterpretation, undefined);
    assert.equal(interpretation.answer?.type, "message");
    assert.equal(interpretation.answer?.answer, "This sounds like a health concern.");
    assert.equal(interpretation.answer?.actionLabel, "Send to Andrew");
  });

  it("uses the family layer to present communication as a prepared message", () => {
    const interpretation = interpretReceiverAskObservation({
      contacts,
      fallbackContact: contacts[0],
      observation: createObservation({
        modality: "typed",
        source: "receiver",
        text: "Tell Andrew my knee hurts.",
      }),
    });

    assert.equal(interpretation.familyClassification.family, "communicate");
    assert.equal(interpretation.askInterpretation, undefined);
    assert.equal(interpretation.answer?.type, "message");
    assert.equal(interpretation.answer?.answer, "Ready to send to Andrew.");
    assert.equal(interpretation.answer?.messageBody, "my knee hurts.");
  });

  it("uses the family layer to keep reminders out of generic Ask recovery", () => {
    const interpretation = interpretReceiverAskObservation({
      contacts,
      fallbackContact: contacts[0],
      observation: createObservation({
        modality: "typed",
        source: "receiver",
        text: "Remind me to take my pills.",
      }),
    });

    assert.equal(interpretation.familyClassification.family, "remind");
    assert.equal(interpretation.askInterpretation, undefined);
    assert.equal(interpretation.needsRecovery, false);
    assert.equal(interpretation.answer?.type, "answer");
    assert.equal(interpretation.answer?.answer, "This sounds like a reminder. Reminders are not available in this preview yet.");
  });

  it("routes unclear standalone input to clarification instead of Ask", () => {
    const examples = ["I’m cold.", "I’m hungry.", "I’m tired."];

    for (const text of examples) {
      const interpretation = interpretReceiverAskObservation({
        contacts,
        fallbackContact: contacts[0],
        observation: createObservation({
          modality: "typed",
          source: "receiver",
          text,
        }),
      });

      assert.equal(interpretation.familyClassification.family, "unclear", text);
      assert.equal(interpretation.needsRecovery, true, text);
      assert.equal(interpretation.answer, undefined, text);
      assert.equal(interpretation.askInterpretation, undefined, text);
    }
  });

  it("routes contextual replies to clarification when there is no active context", () => {
    const examples = [
      "Yes.",
      "No.",
      "Maybe.",
      "That’s right.",
      "Not quite.",
      "Try again.",
      "Never mind.",
      "That's the one.",
      "Not that one.",
      "Close enough.",
    ];

    for (const text of examples) {
      const interpretation = interpretReceiverAskObservation({
        contacts,
        fallbackContact: contacts[0],
        observation: createObservation({
          modality: "typed",
          source: "receiver",
          text,
        }),
      });

      assert.equal(interpretation.familyClassification.family, "contextual_response", text);
      assert.equal(interpretation.needsRecovery, true, text);
      assert.equal(interpretation.askInterpretation, undefined, text);
    }
  });

  it("presents decision and escalation families distinctly from generic messaging", () => {
    const decide = interpretReceiverAskObservation({
      contacts,
      fallbackContact: contacts[0],
      observation: createObservation({
        modality: "typed",
        source: "receiver",
        text: "Should I call the doctor?",
      }),
    });
    const escalate = interpretReceiverAskObservation({
      contacts,
      fallbackContact: contacts[0],
      observation: createObservation({
        modality: "typed",
        source: "receiver",
        text: "I can’t breathe well.",
      }),
    });

    assert.equal(decide.familyClassification.family, "decide");
    assert.equal(decide.answer?.answer, "CarePland cannot make that decision from the available information.");
    assert.equal(decide.answer?.actionLabel, "Send to Andrew");
    assert.equal(escalate.familyClassification.family, "escalate");
    assert.equal(escalate.answer?.answer, "This may need prompt attention.");
    assert.equal(escalate.answer?.actionLabel, "Send to Andrew");
  });

  it("resolves named recipients and refuses ambiguous recipient substitution", () => {
    const named = interpretReceiverAskObservation({
      contacts,
      fallbackContact: contacts[0],
      observation: createObservation({
        modality: "typed",
        source: "receiver",
        text: "Tell Susan I can’t find my glasses.",
      }),
    });
    const pronoun = interpretReceiverAskObservation({
      contacts,
      fallbackContact: contacts[0],
      observation: createObservation({
        modality: "typed",
        source: "receiver",
        text: "Tell her I’m ready.",
      }),
    });
    const missing = interpretReceiverAskObservation({
      contacts,
      fallbackContact: contacts[0],
      observation: createObservation({
        modality: "typed",
        source: "receiver",
        text: "We should let everyone know.",
      }),
    });

    assert.equal(named.familyClassification.family, "communicate");
    assert.equal(named.answer?.actionLabel, "Send to Susan");
    assert.equal(named.answer?.recipientId, "contact-susan");
    assert.equal(pronoun.familyClassification.family, "communicate");
    assert.equal(pronoun.answer?.answer, "Who should receive this?");
    assert.equal(pronoun.answer?.recipientId, "");
    assert.equal(missing.familyClassification.family, "communicate");
    assert.equal(missing.answer?.answer, "Who should receive this?");
    assert.equal(missing.answer?.recipientId, "");
  });

  it("recognizes broader communication phrasing and clarifies unresolved recipients", () => {
    const examples = [
      ["Ask him if he's coming.", "Who should receive this?"],
      [
        "My daughter ought to hear this.",
        "Which available person is your daughter?",
      ],
      ["I need to talk to someone.", "Who should receive this?"],
    ] as const;

    for (const [text, answer] of examples) {
      const interpretation = interpretReceiverAskObservation({
        contacts,
        fallbackContact: contacts[0],
        observation: createObservation({
          modality: "typed",
          source: "receiver",
          text,
        }),
      });

      assert.equal(interpretation.familyClassification.family, "communicate", text);
      assert.equal(interpretation.answer?.type, "answer", text);
      assert.equal(interpretation.answer?.answer, answer, text);
      assert.equal(interpretation.answer?.recipientId, "", text);
    }
  });

  it("offers the default contact for generic awareness statements", () => {
    const interpretation = interpretReceiverAskObservation({
      contacts,
      fallbackContact: contacts[0],
      observation: createObservation({
        modality: "typed",
        source: "receiver",
        text: "Someone should know about this.",
      }),
    });

    assert.equal(interpretation.familyClassification.family, "communicate");
    assert.equal(interpretation.answer?.answer, "We can send this to Andrew.");
    assert.equal(interpretation.answer?.actionLabel, "Send to Andrew");
    assert.equal(interpretation.answer?.recipientId, contacts[0].id);
    assert.equal(interpretation.answer?.type, "message");
  });

  it("preserves unknown named recipient wording instead of collapsing to a generic who question", () => {
    const interpretation = interpretReceiverAskObservation({
      contacts: [contacts[0], contacts[1]],
      fallbackContact: contacts[0],
      observation: createObservation({
        modality: "typed",
        source: "receiver",
        text: "Tell Susan I can't find my glasses.",
      }),
    });

    assert.equal(interpretation.familyClassification.family, "communicate");
    assert.equal(
      interpretation.answer?.answer,
      "Susan is not available as a recipient in this preview. Choose an available recipient."
    );
  });

  it("does not attach meaningless AskIntent general_unknown to non-Ask families", () => {
    const examples = [
      ["I went for a walk.", "observe"],
      ["I need milk.", "need"],
      ["Tell Andrew my knee hurts.", "communicate"],
      ["Remind me to take my pills.", "remind"],
      ["I fell and need help now.", "escalate"],
    ] as const;

    for (const [text, family] of examples) {
      const interpretation = interpretReceiverAskObservation({
        contacts,
        fallbackContact: contacts[0],
        observation: createObservation({
          modality: "typed",
          source: "receiver",
          text,
        }),
      });

      assert.equal(interpretation.familyClassification.family, family, text);
      assert.equal(interpretation.askInterpretation, undefined, text);
      assert.doesNotMatch(
        interpretation.answer?.diagnosticSummary ?? "",
        /AskIntent general_unknown/,
        text
      );
      assert.match(
        interpretation.answer?.diagnosticSummary ?? "",
        /No family-specific interpretation yet/,
        text
      );
    }
  });

  it("classifies item location questions before generic recovery", () => {
    const interpretation = interpretReceiverAskObservation({
      contacts,
      fallbackContact: contacts[0],
      observation: createObservation({
        modality: "typed",
        source: "receiver",
        text: "Where are my glasses?",
      }),
    });

    assert.equal(interpretation.needsRecovery, false);
    const ask = requireAskInterpretation(interpretation);
    assert.equal(ask.intent, "item_location");
    assert.equal(ask.entities.entity, "glasses");
    assert.equal(ask.capabilityStatus, "capability_missing");
    assert.equal(interpretation.answer?.type, "answer");
    assert.match(interpretation.answer?.answer ?? "", /Item location is not available/);
    assert.match(interpretation.answer?.diagnosticSummary ?? "", /AskIntent item_location/);
    assert.equal(
      ask.decisionTrace.context?.capabilityStatus,
      "capability_missing"
    );
  });

  it("classifies household status questions with subject and action", () => {
    const interpretation = interpretReceiverAskObservation({
      contacts,
      fallbackContact: contacts[0],
      observation: createObservation({
        modality: "typed",
        source: "receiver",
        text: "Has anyone fed Dixie?",
      }),
    });

    assert.equal(interpretation.needsRecovery, false);
    const ask = requireAskInterpretation(interpretation);
    assert.equal(ask.intent, "household_status");
    assert.equal(ask.entities.subject, "Dixie");
    assert.equal(ask.entities.action, "fed");
    assert.equal(ask.capabilityStatus, "capability_missing");
  });

  it("classifies item status questions as understood but missing capability", () => {
    const interpretation = interpretReceiverAskObservation({
      contacts,
      fallbackContact: contacts[0],
      observation: createObservation({
        modality: "typed",
        source: "receiver",
        text: "What happened to the trash bags?",
      }),
    });

    assert.equal(interpretation.needsRecovery, false);
    const ask = requireAskInterpretation(interpretation);
    assert.equal(ask.intent, "item_status");
    assert.equal(ask.entities.entity, "the trash bags");
    assert.equal(ask.capabilityStatus, "capability_missing");
  });

  it("classifies upcoming plan questions with temporal references", () => {
    const interpretation = interpretReceiverAskObservation({
      contacts,
      fallbackContact: contacts[0],
      observation: createObservation({
        modality: "typed",
        source: "receiver",
        text: "Where are we going later?",
      }),
    });

    assert.equal(interpretation.needsRecovery, false);
    const ask = requireAskInterpretation(interpretation);
    assert.equal(ask.intent, "upcoming_plan");
    assert.deepEqual(ask.temporalReferences, ["later"]);
    assert.equal(ask.capabilityStatus, "capability_missing");
  });

  it("classifies additional Ask questions into deterministic subtypes before recovery", () => {
    const examples = [
      ["What am I doing next?", "upcoming_plan"],
      ["What happens next?", "upcoming_plan"],
      ["What comes next?", "upcoming_plan"],
      ["What do I need tomorrow?", "appointment_preparation"],
      ["What do I need before I leave?", "appointment_preparation"],
      ["Am I ready?", "appointment_preparation"],
      ["Is everything set?", "appointment_preparation"],
      ["When is that?", "context_reference"],
    ] as const;

    for (const [text, intent] of examples) {
      const interpretation = interpretReceiverAskObservation({
        contacts,
        fallbackContact: contacts[0],
        observation: createObservation({
          modality: "typed",
          source: "receiver",
          text,
        }),
      });

      assert.equal(interpretation.familyClassification.family, "ask", text);
      assert.equal(interpretation.needsRecovery, false, text);
      assert.equal(requireAskInterpretation(interpretation).intent, intent, text);
    }
  });

  it("lets unresolved required context take precedence over capability messaging", () => {
    const appointment = interpretReceiverAskObservation({
      contacts,
      fallbackContact: contacts[0],
      observation: createObservation({
        modality: "typed",
        source: "receiver",
        text: "Does she have an appointment?",
      }),
    });
    const contextReference = interpretReceiverAskObservation({
      contacts,
      fallbackContact: contacts[0],
      observation: createObservation({
        modality: "typed",
        source: "receiver",
        text: "When is that?",
      }),
    });

    const appointmentAsk = requireAskInterpretation(appointment);
    assert.equal(appointmentAsk.intent, "appointment_lookup");
    assert.equal(appointmentAsk.entities.requiresContext, true);
    assert.equal(appointment.answer?.answer, "Who are you asking about?");

    const referenceAsk = requireAskInterpretation(contextReference);
    assert.equal(referenceAsk.intent, "context_reference");
    assert.equal(referenceAsk.entities.requiresContext, true);
    assert.equal(contextReference.answer?.answer, "More context is needed for that question.");
  });

  it("keeps preparation questions behind the unsupported capability boundary", () => {
    const interpretation = interpretReceiverAskObservation({
      contacts,
      fallbackContact: contacts[0],
      observation: createObservation({
        modality: "typed",
        source: "receiver",
        text: "What do I need before I leave?",
      }),
    });

    const ask = requireAskInterpretation(interpretation);
    assert.equal(ask.intent, "appointment_preparation");
    assert.equal(
      interpretation.answer?.answer,
      "This is a question about preparing to leave. Preparation details are not available in this preview yet."
    );
  });

  it("extracts care-subject status and unresolved pronoun context", () => {
    const mom = interpretReceiverAskObservation({
      contacts,
      fallbackContact: contacts[0],
      observation: createObservation({
        modality: "typed",
        source: "receiver",
        text: "Did Mom eat?",
      }),
    });
    const awake = interpretReceiverAskObservation({
      contacts,
      fallbackContact: contacts[0],
      observation: createObservation({
        modality: "typed",
        source: "receiver",
        text: "Is she awake?",
      }),
    });
    const appointment = interpretReceiverAskObservation({
      contacts,
      fallbackContact: contacts[0],
      observation: createObservation({
        modality: "typed",
        source: "receiver",
        text: "Does she have an appointment?",
      }),
    });
    const checked = interpretReceiverAskObservation({
      contacts,
      fallbackContact: contacts[0],
      observation: createObservation({
        modality: "typed",
        source: "receiver",
        text: "Has anyone checked on her?",
      }),
    });

    const momAsk = requireAskInterpretation(mom);
    assert.equal(momAsk.intent, "household_status");
    assert.equal(momAsk.entities.subject, "Mom");
    assert.equal(momAsk.entities.action, "eat");

    const awakeAsk = requireAskInterpretation(awake);
    assert.equal(awakeAsk.intent, "household_status");
    assert.equal(awakeAsk.entities.subjectReference, "she");
    assert.equal(awakeAsk.entities.requiresContext, true);

    const appointmentAsk = requireAskInterpretation(appointment);
    assert.equal(appointmentAsk.intent, "appointment_lookup");
    assert.equal(appointmentAsk.entities.subjectReference, "she");
    assert.equal(appointmentAsk.entities.requiresContext, true);

    const checkedAsk = requireAskInterpretation(checked);
    assert.equal(checkedAsk.intent, "household_status");
    assert.equal(checkedAsk.entities.action, "checked_on");
    assert.equal(checkedAsk.entities.subject, "");
    assert.equal(checkedAsk.entities.subjectReference, "her");
    assert.equal(checkedAsk.entities.requiresContext, true);
  });

  it("preserves unresolved person references and time references in Ask entities", () => {
    const coming = interpretReceiverAskObservation({
      contacts,
      fallbackContact: contacts[0],
      observation: createObservation({
        modality: "typed",
        source: "receiver",
        text: "Is he coming later?",
      }),
    });
    const called = interpretReceiverAskObservation({
      contacts,
      fallbackContact: contacts[0],
      observation: createObservation({
        modality: "typed",
        source: "receiver",
        text: "Did she call?",
      }),
    });

    const comingAsk = requireAskInterpretation(coming);
    assert.equal(comingAsk.intent, "household_status");
    assert.equal(comingAsk.entities.subjectReference, "he");
    assert.equal(comingAsk.entities.action, "coming");
    assert.equal(comingAsk.entities.requiresContext, true);
    assert.deepEqual(comingAsk.temporalReferences, ["later"]);
    assert.equal(coming.answer?.answer, "Who are you asking about?");

    const calledAsk = requireAskInterpretation(called);
    assert.equal(calledAsk.intent, "person_or_contact_lookup");
    assert.equal(calledAsk.entities.subjectReference, "she");
    assert.equal(calledAsk.entities.action, "call");
    assert.equal(calledAsk.entities.requiresContext, true);
    assert.equal(called.answer?.answer, "Who are you asking about?");
  });

  it("classifies past visit and health history questions with a topic", () => {
    const interpretation = interpretReceiverAskObservation({
      contacts,
      fallbackContact: contacts[0],
      observation: createObservation({
        modality: "typed",
        source: "receiver",
        text: "What did the doctor say about my leg?",
      }),
    });

    assert.equal(interpretation.needsRecovery, false);
    const ask = requireAskInterpretation(interpretation);
    assert.equal(ask.intent, "past_visit_or_health_history");
    assert.equal(ask.entities.topic, "leg");
    assert.equal(ask.capabilityStatus, "capability_missing");
  });

  it("classifies appointment lookup questions as available deterministic Ask", () => {
    const interpretation = interpretReceiverAskObservation({
      contacts,
      fallbackContact: contacts[0],
      observation: createObservation({
        modality: "typed",
        source: "receiver",
        text: "When is my next appointment?",
      }),
    });

    assert.equal(interpretation.needsRecovery, false);
    const ask = requireAskInterpretation(interpretation);
    assert.equal(ask.intent, "appointment_lookup");
    assert.equal(ask.capabilityStatus, "available");
    assert.equal(interpretation.answer?.answer, "Upcoming appointments are available for the active Main Connect User.");
  });

  it("classifies medication status questions as understood but missing capability", () => {
    const interpretation = interpretReceiverAskObservation({
      contacts,
      fallbackContact: contacts[0],
      observation: createObservation({
        modality: "typed",
        source: "receiver",
        text: "Did I take my medicine?",
      }),
    });

    assert.equal(interpretation.needsRecovery, false);
    const ask = requireAskInterpretation(interpretation);
    assert.equal(ask.intent, "medication_status");
    assert.equal(ask.entities.action, "take");
    assert.equal(ask.entities.entity, "medicine");
    assert.equal(ask.capabilityStatus, "capability_missing");
  });

  it("asks for the missing object before offering to send vague needs", () => {
    const examples = [
      ["I need another one.", "What do you need another one of?"],
      ["I need it soon.", "What do you need soon?"],
    ] as const;

    for (const [text, answer] of examples) {
      const interpretation = interpretReceiverAskObservation({
        contacts,
        fallbackContact: contacts[0],
        observation: createObservation({
          modality: "typed",
          source: "receiver",
          text,
        }),
      });

      assert.equal(interpretation.familyClassification.family, "need", text);
      assert.equal(interpretation.answer?.type, "answer", text);
      assert.equal(interpretation.answer?.answer, answer, text);
    }
  });

  it("keeps standalone forgotten context unclear", () => {
    const interpretation = interpretReceiverAskObservation({
      contacts,
      fallbackContact: contacts[0],
      observation: createObservation({
        modality: "typed",
        source: "receiver",
        text: "I forgot.",
      }),
    });

    assert.equal(interpretation.familyClassification.family, "unclear");
    assert.equal(interpretation.needsRecovery, true);
    assert.equal(interpretation.answer, undefined);
  });

  it("routes evaluation and help requests to sensible families", () => {
    const decision = interpretReceiverAskObservation({
      contacts,
      fallbackContact: contacts[0],
      observation: createObservation({
        modality: "typed",
        source: "receiver",
        text: "Is this bad?",
      }),
    });
    const help = interpretReceiverAskObservation({
      contacts,
      fallbackContact: contacts[0],
      observation: createObservation({
        modality: "typed",
        source: "receiver",
        text: "Can somebody help me?",
      }),
    });

    assert.equal(decision.familyClassification.family, "decide");
    assert.equal(decision.answer?.answer, "CarePland cannot make that decision from the available information.");
    assert.equal(help.familyClassification.family, "need");
    assert.equal(help.answer?.answer, "This sounds like something that needs attention.");
  });

  it("keeps guidance questions on Ask without current communication intent", () => {
    const interpretation = interpretReceiverAskObservation({
      contacts,
      fallbackContact: contacts[0],
      observation: createObservation({
        modality: "typed",
        source: "receiver",
        text: "What should I ask?",
      }),
    });

    assert.equal(interpretation.familyClassification.family, "ask");
    assert.ok(!interpretation.familyClassification.secondaryFamilies?.includes("communicate"));
    assert.equal(interpretation.needsRecovery, false);
    assert.equal(requireAskInterpretation(interpretation).intent, "appointment_preparation");
  });

  it("uses explicit recipient information when a need also asks to communicate", () => {
    const interpretation = interpretReceiverAskObservation({
      contacts,
      fallbackContact: contacts[0],
      observation: createObservation({
        modality: "typed",
        source: "receiver",
        text: "I need milk and tell Andrew.",
      }),
    });

    assert.equal(interpretation.familyClassification.family, "need");
    assert.ok(interpretation.familyClassification.secondaryFamilies?.includes("communicate"));
    assert.equal(interpretation.answer?.type, "message");
    assert.equal(interpretation.answer?.answer, "Ready to send to Andrew.");
    assert.equal(interpretation.answer?.messageBody, "I need milk.");
  });

  it("preserves medication and health components for medication-related health observations", () => {
    const interpretation = interpretReceiverAskObservation({
      contacts,
      fallbackContact: contacts[0],
      observation: createObservation({
        modality: "typed",
        source: "receiver",
        text: "I forgot my medicine and now I don't feel well.",
      }),
    });

    assert.equal(interpretation.familyClassification.family, "observe");
    assert.ok(interpretation.familyClassification.secondaryFamilies?.includes("need"));
    assert.equal(interpretation.answer?.answer, "This sounds like a health concern.");
    assert.match(interpretation.answer?.diagnosticSummary ?? "", /secondary need/);
  });

  it("presents health observations as health concerns instead of generic events", () => {
    const examples = [
      "I don't feel well.",
      "I forgot my medicine and now I don't feel well.",
    ];

    for (const text of examples) {
      const interpretation = interpretReceiverAskObservation({
        contacts,
        fallbackContact: contacts[0],
        observation: createObservation({
          modality: "typed",
          source: "receiver",
          text,
        }),
      });

      assert.equal(interpretation.familyClassification.family, "observe", text);
      assert.equal(interpretation.answer?.answer, "This sounds like a health concern.", text);
    }
  });

  it("keeps unclear input on the recovery path without AskIntent", () => {
    const interpretation = interpretReceiverAskObservation({
      contacts,
      fallbackContact: contacts[0],
      observation: createObservation({
        modality: "typed",
        source: "receiver",
        text: "The purple idea is sideways.",
      }),
    });

    assert.equal(interpretation.familyClassification.family, "unclear");
    assert.equal(interpretation.needsRecovery, true);
    assert.equal(interpretation.answer, undefined);
    assert.equal(interpretation.askInterpretation, undefined);
  });

  it("exposes a shared AskInterpretation result directly", () => {
    const observation = createObservation({
      modality: "typed",
      source: "receiver",
      text: "Where are my glasses?",
    });
    const meaningFrame = {
      ambiguity: "none" as const,
      concepts: [],
      confidence: 1,
      contactReferences: [],
      decisionTraceFragments: [],
      householdReferences: [],
      normalizedText: observation.rawText ?? "",
      observationId: observation.observationId,
      personReferences: [],
      provenance: {
        modality: observation.modality,
        observedAt: observation.observedAt,
        observationId: observation.observationId,
        source: observation.source,
      },
      temporalReferences: [],
    };

    const ask = interpretReceiverAskIntent("Where are my glasses?", meaningFrame);

    assert.equal(ask.intent, "item_location");
    assert.equal(ask.entities.entity, "glasses");
    assert.equal(ask.decisionTrace.outputSummary, "item_location");
  });
});
