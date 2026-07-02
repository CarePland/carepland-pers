# Talk Intent Foundation

Last updated: 2026-07-01

Receiver Talk is the universal lightweight entry point for “say something and CarePland will try to figure it out.” V1 is deterministic and intentionally narrow. It is not a general voice assistant, clinical assistant, emergency flow, or medication-management system.

## V1 Surface

- Receiver voice review calls `/api/connect/talk` after transcription is reviewed.
- The route verifies the active Main Connect User with existing Connect person access checks.
- The route loads active `focus_items` and upcoming appointments for that person, interprets the text, and writes a `track_events` row only when confidence is high and review is not needed.
- The Receiver keeps using the existing review and answer modals. No polished Talk UI is introduced in this pass.

## Supported Intents

- `track_event_activity`: deterministic walking phrases such as `I walked to the mailbox` create `activity.walking` events.
- `focus_item_completion`: broad medication phrases can match an active medication Focus Item and create a linked `medication.taken` or `medication.skipped` event.
- `measured_track_event`: weight phrases such as `I weighed 185 pounds` create `measurement.weight` with parsed `value` and `unit`.
- `connect_call_request`: `Call Andrew` returns a structured call request and the Receiver routes known contacts into the existing call flow.
- `appointment_question`: next-appointment questions answer from existing upcoming appointment data.
- `unknown`: unclear input returns a clarification/review result and does not create permanent Track records.

## Explicit Boundaries

- Do not store raw audio permanently.
- Do not store full raw transcripts in Track payloads. The interpreter stores the interpreted result and concise structured details only.
- Do not write low-confidence or review-needed events automatically.
- Do not infer medication specifics. Medication handling is broad only: morning/evening/afternoon medications taken or skipped, or medication question.
- Do not model individual medications, dosages, refills, interactions, or missed-dose guidance.
- Do not provide clinical advice, diagnosis, treatment instructions, or emergency handling.
- Do not use broad autonomous recommendation generation from Talk input.

## Later Connections

- Today’s Focus: Talk-created `track_events.focus_item_id` can remove completed Focus Items from the day’s list.
- Track: Talk events use `source = talk_voice` and person-scoped `care_circle_id` / `care_subject_id`.
- Reminders: future reminder responses can reuse the same deterministic event-writing policy.
- Connect call summaries: approved care-only summaries can later create source-linked Track Events using the same review thresholds.
- CarePrep and Health Focus: Talk events become person-level context only after they are recorded as Track facts; they should remain source-traceable and non-clinical.
