# Universal Observation Pipeline

## Platform Milestone

Universal Observation Pipeline v1 gives CarePland a canonical entry point for human observations.
Speech, typed input, and example prompts are captured as Observations before workflow-specific
handling. Current behavior remains unchanged, but future normalization, household resolution,
intent routing, and workflow selection now have a single platform boundary through which human
interaction can pass.

## Meaning Over Modality

This is analogous to CarePland's Import Anything paradigm.

CarePland should extract meaning from inputs and convey meaning through outputs. The method of
transmission is relevant only insofar as it helps capture or communicate meaning effectively.

Examples:

- Spoken input, typed text, OCR, SMS, a voice memo, or a selected example may all become the same
  normalized Observation.
- A typed caregiver message may be spoken aloud on Receiver.
- A voice memo may be displayed as a transcript.
- A workflow result may be delivered as text, speech, notification, email, or another suitable
  presentation.
- Downstream interpretation and workflow logic should not depend unnecessarily on the original
  modality.

Architectural rule:

- Input modality belongs at the capture edge.
- Output modality belongs at the presentation edge.
- The core platform should operate on structured meaning.

The canonical direction is:

```
Input modality
  │
  ▼
Observation
  │
  ▼
Normalized / resolved meaning
  │
  ▼
Interaction family
  │
  ▼
Intent
  │
  ▼
Workflow
  │
  ▼
Structured result
  │
  ▼
Presentation policy
  │
  ▼
Output modality
```

Preserve source metadata for provenance, audit, accessibility, and presentation decisions, but do
not allow modality to dictate core meaning or workflow unless the modality itself is materially
relevant.

Do not erase provenance.

Do desource core interpretation.

This is not a reason to remove modality from the Observation contract. Modality remains useful
metadata. The goal is to prevent speech, text, OCR, message, or example inputs from creating
separate product logic after capture.

Likewise, output should not preserve the source format by default. Choose the output method that
best conveys meaning to the recipient, subject to user preferences, consent, device capabilities,
privacy, and accessibility.

## Canonical Interaction Families

Interaction Families classify the human purpose of an Observation after MeaningFrame and before
workflow selection. They describe what the person is trying to accomplish, not which UI, API,
database table, or workflow CarePland will use.

| Family | Human purpose |
| --- | --- |
| Ask | Help me understand. |
| Observe | I want you to know something happened. |
| Need | Something needs attention or acquisition. |
| Communicate | Someone else needs to know this. |
| Remind | Help me remember later. |
| Plan | Help me prepare or organize. |
| Decide | Help me choose between options. |
| Discover | Understand something I'm showing you. |
| Express | Understand how I feel. |
| Escalate | This needs immediate human attention. |

These families are deliberately product-level and human-centered. For example:

- "I went for a walk" is Observe, not a Track API command.
- "I need milk" is Need, not automatically a message.
- "Tell Andrew I'll be late" is Communicate, not a Connect endpoint.
- "When is my next appointment?" is Ask, not an appointment query implementation detail.
- "What is this letter?" or a submitted OCR/photo/document artifact is Discover.

Future interpreters should produce a primary family, optional secondary families, confidence,
clarification needs, and Decision Trace rationale. Workflow selection should consume the family
classification along with resolved meaning, context, permissions, device capabilities, and safety
policy.

Interaction Families should not live inside MeaningFrame. MeaningFrame represents normalized
understanding of the Observation; the family is the first high-level classification of human
purpose. Workflow decisions, persistence, recommendations, and presentation choices remain
downstream.

## Interaction Attempts

An Interaction Attempt is the diagnostic parent for a user's overall effort to accomplish one
human purpose. It is not a replacement for Observation, MeaningFrame, Interaction Family,
interpreters, Decision Trace, review queues, or workflow history. It connects those platform
artifacts into a single inspectable recovery chain.

One Attempt may contain multiple immutable Observations:

```
Interaction Attempt
  │
  ├─ Observation 1
  │    ├─ MeaningFrame
  │    ├─ Interaction Family
  │    ├─ Interpreter / result
  │    ├─ Presented response
  │    └─ User action: not helpful
  │
  ├─ Observation 2
  │    ├─ Revision reason: rephrase
  │    ├─ Parent: Observation 1
  │    ├─ MeaningFrame
  │    ├─ Interaction Family
  │    ├─ Interpreter / result
  │    └─ User action: send selected
  │
  └─ Final outcome
```

Rephrasing, clarification, correction, retry, or modality switching must create a new Observation.
A revision must never overwrite a previous Observation. Revisions share an Attempt, form lineage
through `parentObservationId`, and preserve every interpretation for later inspection.

Attempt events are append-only diagnostic breadcrumbs. Useful platform-level event types include:

- attempt started
- observation submitted
- revised observation submitted
- response presented
- helpful selected
- not helpful selected
- rephrase selected
- send selected
- workflow completed
- cancelled
- abandoned
- timed out

The purpose is continuous improvement of interpretation quality and recovery paths, not generic
analytics. Attempt data can later show where CarePland misunderstood, where the capability was
missing, which Interaction Families are ambiguous, which workflows need better handoff, and how
users naturally recover. It should integrate with Decision Trace and diagnostic Admin surfaces
rather than create a separate intelligence system.

Receiver diagnostic mode may display the current attempt chain for testing. That display is an
Admin/debug affordance only; it should not introduce recipient-facing product language or alter
Receiver behavior.

## Platform Reviews

Platform Reviews are durable administrator observations about an Interaction Attempt.

They are intentionally separate from Interaction Attempts:

- Interaction Attempts describe how the user pursued one human purpose.
- Platform Reviews describe what a reviewer learned from that interaction.

The initial Platform Review artifact is a freeform admin comment attached to an Attempt. It may
record findings such as a likely family mismatch, typo sensitivity, missing capability,
presentation confusion, or recovery-flow problem.

Human review comments are append-only platform knowledge. They must not rewrite Observations,
MeaningFrames, Interaction Family classifications, Decision Traces, Attempt Events, or workflow
history.

Optional review analyses are separate advisory artifacts. An analysis may summarize likely
concerns, affected platform layers, and suggested refinement areas, but it must never:

- modify production behavior;
- become interpreter memory;
- alter prompts;
- alter classification;
- influence future user interactions automatically.

This boundary is deliberate. Platform Reviews inform future human-led platform improvements. They
do not create a self-modifying AI system.

## Interaction Review Queue

The Interaction Review Queue is an Admin read-only view over existing Interaction Attempt records.
It is not a new platform layer and does not duplicate attempt history.

Queue rows are derived from append-only attempt facts such as:

- not helpful selections;
- revised Observations;
- abandoned or timed-out attempts;
- capability-missing responses;
- Interaction Family changes across revisions;
- existing Platform Reviews;
- reviewed versus unreviewed state.

The queue exists to make proto-beta review practical. It helps administrators find attempts that
may merit human inspection, but it must not automatically create reviews, change classifications,
alter prompts, modify workflow selection, or influence future interpretation.

### Family Boundaries And Natural Workflow Destinations

Ask: Help me understand.

- Purpose: answer, explain, retrieve, summarize, compare, or clarify known context.
- Examples: "When is my next appointment?", "What did I talk about with the doctor?", "What
  should I bring tomorrow?", "Did I take my medicine today?", "Who is my cardiologist?", "Why am I
  seeing Dr. Smith?"
- Natural workflow destinations: retrieval, appointment lookup, Health Stories, CarePrep context,
  summaries, household knowledge, Decision Trace explanation.

Observe: I want you to know something happened.

- Purpose: capture a fact, event, change, symptom, activity, or note about reality.
- Examples: "I went for a walk.", "I weighed 162 today.", "I took my pills.", "My knee hurts.",
  "I slept badly last night.", "The nurse called.", "I felt dizzy after lunch."
- Natural workflow destinations: Track Events, health timeline, symptom notes, activity logs,
  medication adherence, review queue, recommendations.

Need: Something needs attention or acquisition.

- Purpose: express an unmet practical need, missing item, desired help, or resource gap.
- Examples: "I need milk.", "We're out of paper towels.", "I need someone to drive me.", "I need
  help with the TV.", "I need my prescription picked up.", "I need batteries for my hearing aids."
- Natural workflow destinations: shopping, errands, caregiver task, delegation, reminder, Connect
  message, inventory, review.

Communicate: Someone else needs to know this.

- Purpose: route meaning to another person.
- Examples: "Tell Andrew I'll be late.", "Message Sarah that I need milk.", "Let Rob know I went
  for a walk.", "Tell my daughter my knee hurts.", "Ask Andrew to call me.", "Send this to Linda."
- Natural workflow destinations: Connect message, acknowledgement, callback request, caregiver
  notification, delivery status, human review.

Remind: Help me remember later.

- Purpose: create a future cue, recurring prompt, or scheduled nudge.
- Examples: "Remind me to take my pills.", "Remind me to call Andrew tomorrow.", "Tell me to bring
  my hearing aids.", "Remind me before my appointment.", "Don't let me forget the milk."
- Natural workflow destinations: reminders, Goals / Today's Focus, appointment prep, medication
  prompts, recurring schedules, caregiver-visible plans.

Plan: Help me prepare or organize.

- Purpose: turn context into preparation, organization, or next-step structure.
- Examples: "Help me get ready for tomorrow.", "What should I do before the appointment?", "Make a
  list for my doctor.", "Help me plan medications for the trip.", "What do I need before I leave?"
- Natural workflow destinations: CarePrep, checklists, appointment preparation, task generation,
  caregiver coordination, recommendations.

Decide: Help me choose between options.

- Purpose: support judgment, prioritization, or tradeoffs.
- Examples: "Should I call the doctor?", "Is this important?", "Which appointment should I
  schedule first?", "Do I need to tell Andrew?", "Is my knee getting worse?"
- Natural workflow destinations: recommendation engine, safety review, caregiver escalation,
  Decision Trace, medical/legal/financial caution handling, human review.

Discover: Understand something I'm showing you.

- Purpose: extract meaning from an artifact or presented evidence.
- Examples: "What is this letter?", "What does this bottle say?", "Read this bill.", "What should
  I do with this form?", "What appointment is this document about?", "What did this discharge page
  say?"
- Natural workflow destinations: Import Anything, OCR, document/photo understanding, medication
  label interpretation, provider/appointment matching, review queue, CarePrep intake.

Express: Understand how I feel.

- Purpose: receive emotional, subjective, preference, uncertainty, gratitude, or frustration state.
- Examples: "I'm worried about tomorrow.", "I don't like this medicine.", "I feel lonely.", "That
  made me nervous.", "I'm tired.", "I'm confused.", "This is frustrating."
- Natural workflow destinations: journal/context note, caregiver-visible concern, review queue,
  emotional context, recommendations, communication suggestion, no-action acknowledgement.

Escalate: This needs immediate human attention.

- Purpose: route high-urgency, distress, risk, or immediate-help meaning toward human attention.
- Examples: "I fell.", "I need help now.", "Call Andrew right away.", "Something is wrong.", "I
  can't get up.", "I'm scared.", "My chest hurts.", "I missed all my pills."
- Natural workflow destinations: caregiver alert, callback request, human review, safety messaging,
  escalation policy, facility workflow. This family does not by itself create emergency-device
  behavior.

## Phase 1 Scope

Phase 1 is behavior-preserving platform consolidation. It does not add new AI, change prompts, or
expand intent handling.

Current Receiver Ask/Tell paths now enter through Observation first:

- Speech enters as `modality: "speech"` and continues through the existing Talk handler.
- Typed input enters as `modality: "typed"` and continues through the existing Ask helper.
- Selected examples enter as `modality: "example"` and continue through the existing Ask helper.

The legacy handlers are compatibility scaffolding. Future work should move normalization,
household resolution, intent routing, workflow selection, review, persistence, and response
generation behind the shared Observation boundary instead of creating new UI-specific routes.

## Phase 2 Scope

Phase 2 introduces the first behavior-preserving MeaningFrame contract between Observation and
workflow-specific interpretation.

Current Receiver Ask/Tell typed and example paths now follow:

```
Observation
  │
  ▼
MeaningFrame
  │
  ▼
Shared Receiver Ask interpreter
  │
  ▼
Existing deterministic answer / recovery behavior
```

MeaningFrame is intentionally conservative. It represents CarePland's current normalized
understanding of an Observation. It is not intended to contain workflow decisions,
recommendations, or presentation choices. Those belong to later platform stages.

This does not add intelligence. The first MeaningFrame preserves normalized text and provenance
while leaving concepts, household references, person references, contact references, temporal
references, and trace fragments empty until real platform services populate them. Receiver remains
responsible for capture and rendering; it should not own Ask interpretation rules.

Speech now enters the same Observation and MeaningFrame path before reaching the existing
deterministic Talk interpreter. The Talk interpreter is still deterministic and behavior-preserving;
only the platform boundary has changed.

## Phase 3 Scope

Phase 3 removes the last major split inside Receiver Ask/Tell.

Receiver Ask/Tell inputs now follow the same platform shape:

```
Speech / typed text / selected example
  │
  ▼
Observation
  │
  ▼
MeaningFrame
  │
  ▼
Shared interpreter adapter
  │
  ▼
Existing deterministic behavior
```

Typed and example inputs use the shared Receiver Ask interpreter. Speech uses the shared Receiver
Talk interpreter, which wraps the existing deterministic Talk rules and preserves current Track
write behavior. Speech is no longer special inside Ask/Tell capture; it is only a modality in
provenance.

## Contract Expectations

An Observation should preserve:

- active person / care subject
- source surface
- modality
- raw text or transcript text when available
- device and capture metadata when available
- provenance needed for audit, accessibility, privacy, and presentation decisions

An Observation should not decide:

- intent
- workflow
- urgency
- persistence policy
- output format

Those belong downstream in platform services.
