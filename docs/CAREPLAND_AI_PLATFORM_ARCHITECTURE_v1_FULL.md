
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

---

# Platform Overview

```
Input Surface
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

- Raw text
- Transcript
- Surface context
- Device metadata

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

# Closing

CarePland is building a conversational operating system for care information.

People should speak naturally.

The platform should understand conservatively.

Every important interpretation should be explainable.

Every explanation should be auditable.

Every future interface should plug into the same architecture.

The success of CarePland is measured not by how impressive its AI appears,
but by how reliably it helps people communicate, coordinate care, and build trust over time.
