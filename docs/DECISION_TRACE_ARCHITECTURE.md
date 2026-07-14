# Decision Trace Architecture

Last updated: 2026-07-04

## The CarePland Principle

Every meaningful AI interpretation should be explainable.

Not just to the developer. To future versions of CarePland itself.

That means every interpreted action produces an auditable decision artifact.

Users express intent; CarePland determines implementation.

CarePland should minimize the need for users to understand application structure, organizational
hierarchy, or implementation details. Users express what they are trying to accomplish; CarePland
determines the appropriate workflow, routing, and data model while preserving transparency through
Decision Trace. This principle applies across Receiver, Import Anything, OCR, CarePrep, Ask,
Recommendations, Connect, and public/registrar website experiences.

## Requirement

CarePland AI features must be explainable, auditable, and continuously improvable. An interpreted request should not simply return an intent. It should produce a structured decision record describing what decision was made and why.

Every interpreted request should generate a Decision Trace object, regardless of whether the resulting action is automatically executed, queued for review, or rejected. The Decision Trace is a durable engineering artifact, not conversational output.

## Goals

The Decision Trace exists to:

- Explain why CarePland chose one interpretation over another.
- Support future model and router improvements.
- Allow developers and Admin tools to analyze routing quality.
- Provide transparent auditability.
- Preserve the reasoning that existed at the time of interpretation instead of re-running future models or reconstructing historical context.

## Expected Shape

Decision traces should include fields like:

- `primary_intent`
- `confidence`
- `matched_rules`
- `matched_phrases`
- `entities_detected`
- `context_used`
- `candidate_intents`
- `critical_deciding_factors`
- `proposed_action`
- `requires_confirmation`
- `requires_review`
- `model_version`
- `router_version`
- `timestamp`

`candidate_intents` should include rejected or lower-confidence alternatives with a confidence and rejection reason when available.

## Architecture

CarePland should not contain independent AI interpretation logic inside Receiver, Dashboard, CarePrep, Connect, or future surfaces.

UI surfaces provide context:

- active person
- current page or surface
- active appointment
- active Today's Focus items
- recent Track Events
- available contacts
- device or receiver context

The interpretation layer produces:

- intent
- confidence
- structured payload
- proposed action
- decision trace
- review requirements

The UI decides how to present or execute the result.

## Long-Term Scope

The same decision-trace architecture should eventually be shared across:

- Talk
- Health Focus recommendations
- CarePrep
- OCR/import interpretation
- Appointment interpretation
- Connect call summaries
- Reminder generation
- Future AI-assisted workflows

The objective is that every meaningful AI decision inside CarePland can later answer:

- What decision was made?
- Why was that decision made?
- What evidence supported it?

without re-running the model or reconstructing historical context.
