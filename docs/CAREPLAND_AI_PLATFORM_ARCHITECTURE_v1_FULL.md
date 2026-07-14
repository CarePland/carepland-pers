
# CAREPLAND AI PLATFORM ARCHITECTURE
**Version:** 1.0 (Architectural Draft)
**Audience:** CarePland engineers, AI contributors, Codex sessions
**Status:** Foundational Specification

---

# Executive Summary

CarePland is not built around an AI assistant. It is built around an AI platform composed of small,
bounded, explainable services.

Every service has one responsibility.
Every service accepts structured input.
Every service emits structured output.
Every meaningful decision leaves an auditable Decision Trace.

Users express intent; CarePland determines implementation.

The objective is not to make AI appear intelligent.

The objective is to make CarePland understandable, predictable, trustworthy, and extensible.

---

# Design Philosophy

## North Star

> CarePland should understand more than it records.

> Normalize more than it decides.

> Decide more than it automates.

> AI assists people.
> Humans remain authoritative.

Users should not need to translate themselves into software.

Instead, CarePland should translate ordinary caregiving language into structured information.

CarePland should minimize the need for users to understand application structure, organizational
hierarchy, or implementation details. Users express what they are trying to accomplish; CarePland
determines the appropriate workflow, routing, and data model while preserving transparency through
Decision Trace.

## Meaning Over Modality

This is analogous to CarePland's Import Anything paradigm: CarePland should extract meaning from
inputs and convey meaning through outputs. The method of transmission is relevant only insofar as
it helps capture or communicate meaning effectively.

CCKL and HKL should normalize meaning, not merely text. Text, speech, OCR, photos, structured
forms, SMS, voice memos, selected examples, and future wearable signals are edge modalities for
observing underlying reality. Speech synthesis, text, notifications, emails, dashboards, and future
surfaces are edge modalities for presenting responses.

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
relevant. Do not erase provenance. Do desource core interpretation.

This does not remove modality from the Observation contract. Modality remains useful metadata. The
goal is to prevent speech, text, OCR, message, example, or future input types from creating separate
product logic after capture. Likewise, output should not preserve the source format by default:
choose the output method that best conveys meaning to the recipient, subject to user preferences,
consent, device capabilities, privacy, and accessibility.

---

# Platform Constitution

These principles supersede implementation convenience.

1. One responsibility per layer.
2. Every layer consumes structured output from the previous layer.
3. Layers never duplicate responsibilities.
4. Universal knowledge and household knowledge remain separate.
5. Conservative interpretation always wins over clever interpretation.
6. Every meaningful decision produces a Decision Trace.
7. Low-confidence interpretation never silently creates durable records.
8. Clients are replaceable; platform services are shared.
9. Historical reasoning is immutable.
10. AI modules communicate using structured contracts rather than prose.
11. User-facing surfaces expose intent, not implementation structure.
12. Platform layers normalize shared meaning; input and output modalities remain edge adapters.
13. Preserve source provenance, but desource core interpretation after capture.
14. Interaction families describe human purpose before workflow selection.

---

# Platform Overview

```
Input Surface
      │
      ▼
Observation
      │
      ▼
Transcription / Text Capture
      │
      ▼
Consumer Care Knowledge Layer (CCKL)
      │
      ▼
Household Knowledge Layer (HKL)
      │
      ▼
Knowledge Resolution
      │
      ▼
Intent Router (Talk)
      │
      ▼
Workflow Selection
      │
      ▼
Decision Trace
      │
      ▼
Persistence / Human Review
```

No downstream layer should routinely inspect raw language once structured concepts are available.

---

# Layer Specifications

## Layer 1 – Input Surfaces

Examples

- Receiver
- Dashboard
- Mobile
- OCR
- Appointment Import
- CarePrep
- Voice Memo
- Call Summary
- Future hardware
- Future smart speakers

Responsibilities

- Capture user input
- Capture interaction context
- Capture active care subject
- Capture active workflow
- Never determine intent
- Never normalize healthcare language

Provides

- Observation source
- Modality, such as speech, typed text, example prompt, OCR, message, or document
- Raw text
- Transcript when available
- Surface context
- Device metadata

Input surfaces should submit Observations and then stop caring which downstream workflow is chosen. Receiver Ask/Tell, browser Ask, future SMS, phone bridges, facility kiosks, and Import Anything follow-up should share this boundary instead of duplicating routing logic.

## Layer 1.5 – Observation

Purpose

Capture one user thought as the canonical platform input.

Responsibilities

- Preserve the active person/care subject
- Preserve source, modality, surface, device, and capture metadata
- Preserve raw text or transcript text
- Avoid deciding intent or workflow
- Provide one shared entry point for future AI platform routing

Phase 1 may still hand off to legacy deterministic handlers such as Receiver Talk or local Ask behavior after Observation capture. That handoff is compatibility scaffolding, not a new product layer.

---

## Layer 1.6 – MeaningFrame

Purpose

Represent normalized meaning between Observation and IntentResult.

Responsibilities

- Preserve normalized text or transcript text
- Preserve provenance from the Observation
- Carry concept, household, person, contact, and temporal references when available
- Carry ambiguity, confidence, and Decision Trace fragments when available
- Avoid deciding intent, workflow, urgency, persistence, or output modality

MeaningFrame is intentionally conservative. It represents CarePland's current normalized
understanding of an Observation. It is not intended to contain workflow decisions,
recommendations, or presentation choices. Those belong to later platform stages.

The v1 MeaningFrame is intentionally sparse. Receiver Ask/Tell speech, typed text, and selected
examples use it before shared deterministic interpreter adapters, but no new AI or expanded intent
handling is introduced. Speech uses the Receiver Talk interpreter adapter, which wraps the existing
deterministic Talk rules and preserves current Track write behavior.

---

## Layer 1.7 – Interaction Family

Purpose

Classify the human purpose of an Observation after MeaningFrame and before intent/workflow
selection.

Interaction Family answers the question: what is the person trying to accomplish?

It must not answer: which API should run, which table should be written, which UI button was used,
or which final workflow should execute.

Canonical families

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

Responsibilities

- Classify the primary human-purpose family.
- Preserve optional secondary families for compound utterances.
- Preserve confidence, ambiguity, and clarification needs.
- Emit Decision Trace rationale for why the family was chosen.
- Avoid deciding workflow, persistence, write policy, or presentation.

Examples

- "When is my next appointment?" -> Ask.
- "I went for a walk." -> Observe.
- "My knee hurts." -> Observe, with possible Escalate depending on severity and context.
- "I need milk." -> Need.
- "Tell Andrew I'll be late." -> Communicate.
- "Remind me to take my pills." -> Remind.
- "Help me get ready for tomorrow." -> Plan.
- "Should I call the doctor?" -> Decide.
- "What is this letter?" with a document/photo/OCR input -> Discover.
- "I'm worried about tomorrow." -> Express.
- "I fell and need help now." -> Escalate.

Architectural notes

Interaction Family is an interpreter output and a workflow-selection input. It is not part of
MeaningFrame because MeaningFrame should remain a conservative representation of normalized
meaning, not a workflow-oriented classification. Interaction Family also does not replace
IntentResult; intent remains the narrower downstream interpretation that can account for resolved
meaning, family, permissions, workflow availability, device capabilities, and safety policy.

Compound utterances should use primary and secondary families rather than proliferating special
cases. For example, "I need milk, tell Andrew" may be primary Need with secondary Communicate.
"Remind me to ask the doctor about my knee" may be primary Remind with secondary Plan or Ask.
"I fell and need Andrew" may be primary Escalate with secondary Communicate and Observe.

---

## Layer 1.8 - Deterministic Ask Intent

Purpose

Refine Ask-family Receiver utterances into a small deterministic intent category before generic
recovery.

Responsibilities

- Identify whether an Ask utterance is about appointments, past visit or health history, medication
  status, household status, item location or status, upcoming plans, person/contact lookup, or a
  truly unknown question.
- Extract simple entities and temporal references when they can be found deterministically.
- Emit Decision Trace details for the Ask intent, capability status, extracted entities, and matched
  rules.
- Return explicit `capability_missing` when the question is understood but the required data or
  workflow is not available.

This layer remains behavior-preserving and deterministic. It does not add prompts, model calls,
workflow execution, persistence choices, or new user-facing capabilities. Its purpose is to avoid
treating understood questions as generic recovery while preserving clear diagnostic evidence for
future platform refinement.

---

## Layer 2 – Consumer Care Knowledge Layer (CCKL)

Purpose

Normalize universal consumer healthcare language.

CCKL knows healthcare vocabulary.

It does not know the household.

Responsibilities

- Detect healthcare concepts
- Detect brands
- Detect portals
- Detect insurance entities
- Detect consumer terminology
- Detect common phonetic variants
- Emit stable concept identifiers
- Preserve ambiguity

Must Never

- Decide urgency
- Decide workflow
- Create reminders
- Create Track Events
- Resolve household aliases
- Diagnose
- Recommend treatment

Example

Input

"Ghee-haw denied it."

Output

conceptId: insurance.geha
confidence: 0.81
ambiguity: medium

Decision Trace explains WHY.

---

## Layer 3 – Household Knowledge Layer

Purpose

Resolve household-specific meaning.

Examples

- Dr. Bob
- Mom's pharmacy
- Blue pills
- Heart doctor
- Andrew
- Green inhaler

Responsibilities

- Household aliases
- Provider aliases
- Household vocabulary
- Learned household concepts

Never

- Modify universal vocabulary
- Promote household knowledge into CCKL

---

## Layer 4 – Knowledge Resolution

Purpose

Merge:

- Universal concepts
- Household concepts
- Runtime context

Produces

Resolved concepts ready for routing.

---

## Layer 5 – Intent Router (Talk)

Purpose

Determine probable user intent.

Example intents

- track_activity
- focus_completion
- measurement
- reminder
- connect_call
- appointment_question
- appointment_note
- unknown

Responsibilities

Interpret intent only.

Must Never

- Execute workflows
- Persist data
- Diagnose
- Provide clinical advice

---

## Layer 6 – Workflow Layer

Maps intent into product capabilities.

Examples

Track

Today's Focus

Appointments

Connect

Recommendations

CarePrep

Messages

Each workflow owns its persistence.

---

## Layer 7 – Decision Trace

Every layer leaves breadcrumbs.

Decision Trace should answer:

What?

Why?

Confidence?

Evidence?

Alternatives?

Version?

Human review?

Execution status?

Decision traces are immutable historical artifacts.

---

## Layer 8 – Interaction Attempts And Platform Review

Interaction Attempts connect Observations, MeaningFrames, Interaction Family classifications,
Decision Traces, presented responses, user recovery actions, revisions, and final outcomes into
one inspectable chain.

They answer:

What was the user trying to accomplish?

How did the interpretation evolve?

How did the user recover when the response was not useful?

What ultimately happened?

Platform Reviews are separate durable administrator artifacts attached to Interaction Attempts.
They answer a different question:

What did a platform reviewer learn from this interaction?

The first review artifact is a freeform human comment. Optional advisory analyses may summarize
likely concerns, affected platform layers, and possible refinement areas.

Platform Reviews must never directly modify production behavior. They must not become interpreter
memory, rewrite prompts, alter Interaction Family classification, influence workflow selection, or
change Receiver behavior automatically. They are a durable body of architectural knowledge for
future human-led refinement.

---

# Shared Vocabulary

Observation

Raw user expression.

Concept

Normalized healthcare idea.

Resolved Concept

Concept after household resolution.

Intent

What the user is trying to accomplish.

Workflow

Product action.

Decision Trace

Machine-readable explanation.

Interaction Attempt

Diagnostic parent for one overall user effort across Observations, revisions, responses, and
outcomes.

Platform Review

Administrator-authored learning artifact attached to an Interaction Attempt. Advisory only.

Knowledge Candidate

Potential future vocabulary.

---

# Stable Concept IDs

Concepts should use stable identifiers.

Examples

insurance.geha

insurance.part_d

device.dexcom

portal.mychart

activity.walking

provider.cardiologist

Clients should depend on identifiers rather than display strings.

---

# Client Entry Points

Voice

Input → Pipeline

OCR

OCR → CCKL → Pipeline

Call Summary

Summary text → CCKL → Pipeline

Dashboard Text

Text → Pipeline

Existing structured workflows

May bypass language normalization but still produce Decision Trace.

---

# Decision Trace Standard

Every layer records:

- layer
- input summary
- output summary
- confidence
- evidence
- competing candidates
- rejection reasons
- version
- timestamp

Decision traces compose into an end-to-end audit chain.

---

# Human Review

Human review is required when:

- confidence below threshold
- ambiguity high
- durable records affected
- medication-specific interpretation required
- household resolution uncertain

---

# Safety

CarePland never:

- Diagnoses
- Prescribes
- Determines medical urgency within CCKL
- Infers adherence
- Infers enrollment
- Creates permanent records from uncertain language

---

# Architectural Anti-Patterns

Do not:

- Place routing logic in Receiver.
- Place urgency logic in CCKL.
- Reparse normalized language.
- Mix household and universal knowledge.
- Skip Decision Traces.
- Allow clients to invent platform behavior.

---

# End-to-End Example

User:

"I walked to the mailbox."

Receiver captures audio.

Transcript created.

CCKL identifies activity.walking.

Household layer links current walking focus item.

Knowledge Resolution merges concepts.

Intent Router selects Track Activity.

Workflow creates Track Event.

Decision Trace captures reasoning at every layer.

---

# Hardware Independence

Receiver is a client.

The platform is hardware-independent.

Potential clients include:

- Grandstream appliance
- Browser
- Tablet
- Phone
- Smart speaker
- Future dedicated hardware

Hardware changes must not require architectural changes.

---

# Extensibility

New capabilities should ask:

Does this belong in an existing layer?

Does it violate responsibility boundaries?

Does it emit structured output?

Does it produce a Decision Trace?

Can another client reuse it?

If not, redesign before implementation.

---

# Future Roadmap

Future services may include:

- Facility Knowledge Layer
- Household learning engine
- Medication knowledge layer
- Long-term memory
- Smart speaker adapters
- Multi-modal reasoning
- Analytics over Decision Traces

These extend the platform rather than replacing existing layers.

---

# Current Implementation Notes

The initial platform extraction exposes shared contracts and small adapters under `app/lib/platform/ai`.

Current implemented pieces:

- `contracts.ts` defines platform shapes for observations, concepts, resolved concepts, intent results, workflow selections, and decision traces.
- `ccklService.ts` wraps the existing Consumer Care Knowledge seed matcher and emits platform `Concept[]` plus a `consumer_care_knowledge` Decision Trace without changing existing CCKL helper behavior.
- `hklService.ts` is a no-op Household Knowledge Layer scaffold that reuses `HouseholdConcept` and `DecisionTrace<"household_knowledge">`, emits an empty `HouseholdConcept[]`, and uses a `no_write` execution policy. It is not consumed by workflows and does not resolve household aliases yet.
- `knowledgeResolutionService.ts` is a no-op Knowledge Resolution scaffold that accepts platform `Concept[]` and `HouseholdConcept[]`, reuses `ResolvedConcept` and `DecisionTrace<"knowledge_resolution">`, emits an empty `ResolvedConcept[]`, and uses a `no_write` execution policy. It is not consumed by workflows and does not merge universal or household concepts yet.
- Platform tests prove the current layers compose in memory as CCKL → HKL → Knowledge Resolution while all three traces remain `no_write`; this composition is not wired into product runtime behavior.
- `traceComposition.ts` collects CCKL, HKL, and Knowledge Resolution `DecisionTrace` objects in deterministic platform order without reinterpreting traces or changing execution policy. It is a platform utility only and is not wired into workflows or persistence.
- `normalizationResult.ts` is a passive platform container for carrying `Concept[]`, `HouseholdConcept[]`, `ResolvedConcept[]`, and composed `DecisionTrace[]` together. It does not invoke platform layers, reinterpret outputs, or mutate supplied values.
- Connect call-summary prompt construction consumes `ccklService.ts` while preserving the exact legacy prompt-context string. Platform concepts and the CCKL Decision Trace are available at the internal boundary but are not persisted by call summary v1.
- `talkAdapter.ts` maps existing Talk interpretation results into platform `IntentResult` and `DecisionTrace` shapes while preserving the existing persisted snake_case Talk trace.
- `index.ts` is the platform AI import boundary for future platform callers.

Not yet implemented:

- Household Knowledge Layer workflow consumption, alias resolution, or persistence.
- Knowledge Resolution workflow consumption, merge behavior, or persistence.
- Knowledge bundles.
- New vocabulary, aliases, routing behavior, or product automation from this extraction.

---

# Closing

CarePland is building a conversational operating system for care information.

People should speak naturally.

The platform should understand conservatively.

Every important interpretation should be explainable.

Every explanation should be auditable.

Every future interface should plug into the same architecture.

The success of CarePland is measured not by how impressive its AI appears,
but by how reliably it helps people communicate, coordinate care, and build trust over time.
