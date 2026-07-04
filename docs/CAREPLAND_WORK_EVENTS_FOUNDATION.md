# CarePland Work Events Foundation

CarePland Work Events are the durable Layer 2 record for what CarePland actually handled, connected, prepared, coordinated, or made reviewable.

They are distinct from:

- Layer 1 Facts: immutable things that happened, such as appointments created, reminders acknowledged, voice messages played, Track Events, or Health Story approvals.
- Layer 3 Human outcomes: what people value, such as arriving prepared, reminders being acknowledged, or nobody needing to figure out who was responsible for a pickup.

Work Events are the bridge. They make it possible for future `CarePland at a Glance` summaries to say CarePland quietly handled something without guessing.

North star: CarePland should measure the work the user no longer had to do because the platform quietly handled it.

The point is not to report feature usage. Prefer:

- `Through CarePland, you had appointment context before 6 appointments.`
- `CarePrep identified follow-up questions before your visits.`
- `Import Anything prepared information for 5 appointments without manual typing.`
- `Health Stories identified recurring patterns across multiple appointments.`
- `Connect delivered messages that avoided additional phone calls.`

Avoid:

- `6 appointments tracked.`
- `8 Health Stories available.`
- `5 Today's Focus items available.`
- `AI generated 18 summaries.`

## Table

`carepland_work_events`

Important fields:

- `work_type`: constrained app vocabulary for what CarePland did.
- `outcome_category`: constrained app vocabulary for the human outcome this work may support.
- `confidence`: confidence that CarePland actually performed this work and the sources support it. This is not clinical confidence.
- `related_sources`: JSON array of source references. Expected object shape: `{ source_type, source_table, source_id, label, role }`.
- `idempotency_key`: optional deterministic key so rerunnable jobs do not duplicate the same work event.
- `avoided_effort_*`: optional conservative estimates for later summaries. These must remain clearly labeled estimates.

## Initial Work Types

- `careprep_prepared`
- `health_story_connected`
- `recommendation_identified`
- `supporting_evidence_found`
- `duplicate_information_detected`
- `note_linked`
- `appointment_context_organized`
- `reminder_coordinated`
- `message_delivery_confirmed`
- `focus_ranked`
- `errand_reassigned`
- `assignment_conflict_resolved`
- `schedule_change_coordinated`
- `call_summary_prepared`

Add new values deliberately. Avoid broad catch-all types until there is a concrete source workflow that needs them.

## Initial Writes

The first backend writes are intentionally narrow:

- CarePrep generation records `careprep_prepared`.
- Health Topic extraction from Visit Notes records `health_story_connected` when topic mentions are inserted.

Do not wire every feature yet. Future integrations should be added only when CarePland has clearly performed coordination work and can attach source-traceable evidence.

## At A Glance

Future `CarePland at a Glance` summaries should combine:

- Layer 1 Facts.
- Layer 2 Work Events.
- Layer 3 Human-outcome phrasing.

The user-facing summary should usually present Layer 3, but it should be backed by Layer 2 work events. Avoided-effort estimates should be conservative, optional, and sourced from the recorded work event types rather than retroactive guesses.
