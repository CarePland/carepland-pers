# Track / Today's Focus Foundation

Last updated: 2026-07-01

CarePland Track separates intention from recorded reality.

- **Focus Item**: something CarePland is encouraging, asking about, or bringing forward today.
- **Track Event**: something that actually happened, was observed, or was recorded.

A checkbox, tap, reminder action, Talk capture, appointment note, call summary, or caregiver entry may create a Track Event. The UI action itself is not the data model.

## Tables

### `focus_items`

Person-scoped prompts and goals for Today’s Focus.

Key fields:

- `care_circle_id`, `care_subject_id`: keeps Track multi-person / Care VIP safe.
- `title`: short user-facing intent, such as `Walk to mailbox`.
- `focus_type`: app-owned grouping, such as `daily_prompt`, `routine`, `reminder_prompt`, or future custom values.
- `prompt_text`: optional softer prompt wording for Receiver or mobile UI.
- `recurrence_rule`, `schedule`: conservative schedule foundation. Use simple JSON for local times/windows before creating a richer scheduler.
- `active_start_date`, `active_end_date`, `status`: non-destructive lifecycle.
- `completion_type`: controls the capture flow.
- `completion_event_type`: default `track_events.event_type` to create when completed.
- `completion_prompt_text`, `completion_config`: measured-value prompts, unit options, medication options, note requirements, and other flow settings.
- `importance_score`: conservative ranking hint from 0-100. Receiver Today’s Focus v1 now uses a deterministic ranking policy first, with `importance_score` as one available signal/fallback rather than the only ordering rule.
- `created_by_user_id`, `created_at`, `updated_at`, `metadata`: source and audit context.

### `track_events`

Person-scoped facts that something happened or was observed.

Key fields:

- `care_circle_id`, `care_subject_id`: required person scope.
- `focus_item_id`: optional link back to the prompt that caused the event.
- `event_type`: app-owned lower-case event namespace.
- `title`: human-readable event summary.
- `occurred_at`: when it happened, not merely when entered.
- `source`: where the event came from.
- `source_table`, `source_id`: optional source traceability.
- `value`, `unit`: measured values such as weight or blood sugar.
- `note`: concise human-entered or approved note.
- `structured_payload`: source-specific details that should remain queryable later.
- `confidence`, `needs_review`: useful for AI/voice/note ingestion.
- `event_status`, `superseded_by_track_event_id`: non-destructive correction path.
- `created_by_user_id`, `created_at`, `updated_at`, `metadata`: audit context.

## Completion Types

- `simple_done`: one action creates a basic Track Event. Example: `Walk to mailbox` creates `activity.walking`.
- `measured_value`: UI asks for a value and unit before creating the event. Example: `Weigh yourself` creates `measurement.weight` with `value = 183.4`, `unit = lb`.
- `medication`: initial flow can record taken; later flows may support `all`, `some`, `skipped`, and notes in `structured_payload`.
- `symptom_check`: records a symptom response without clinical decision support.
- `yes_no`: records a yes/no answer, usually in `structured_payload`.
- `note_required`: requires a note before an event can be saved.
- `custom`: escape hatch for early learning without schema churn.

## Source Types

Initial `track_events.source` values:

- `manual`
- `focus_item`
- `receiver_today_focus`
- `talk_voice`
- `appointment_note`
- `connect_call_summary`
- `caregiver_note`
- `reminder`
- `import_anything`
- `system`
- `ai_suggestion`
- `custom`

Voice, note, call-summary, and AI-created events should use `confidence` and `needs_review` when the record may need user confirmation.

## Event Types

Event types are app-owned, lower-case, and should stay plain-language rather than clinical-code driven. Prefer dot namespaces for new values.

Initial examples:

- `activity.walking`
- `medication.taken`
- `medication.skipped`
- `measurement.weight`
- `measurement.blood_sugar`
- `symptom.check`
- `note.caregiver`
- `reminder.response`

Avoid diagnosis or clinical decision-support event types. Track may record that a symptom, measurement, medication action, activity, or care note was captured; it should not infer treatment guidance.

## Measured Follow-Up Prompts

Measured Focus Items store the follow-up in `completion_prompt_text` and/or `completion_config`.

Example:

```json
{
  "completion_type": "measured_value",
  "completion_event_type": "measurement.weight",
  "completion_prompt_text": "What was the weight?",
  "completion_config": {
    "unit": "lb",
    "unitOptions": ["lb", "kg"]
  }
}
```

The resulting Track Event stores:

```json
{
  "event_type": "measurement.weight",
  "title": "Weight",
  "value": 183.4,
  "unit": "lb",
  "source": "receiver_today_focus"
}
```

## Future Connections

- **Talk**: Talk button interpretation can create `track_events` with `source = talk_voice`, a care-relevant `structured_payload`, and review flags when confidence is low. V1 is deterministic and supports walking/activity, broad medication completion, weight measurement, Connect call requests, next-appointment questions, and safe unknown handling. See `docs/TALK_INTENT_FOUNDATION.md`.
- **Reminders**: reminder responses can create `track_events` with `source = reminder`; reminders may also be generated from active `focus_items`.
- **Receiver Today’s Focus**: Receiver should read active `focus_items` for the active `care_subject_id` and create `track_events` when something is recorded. It should not store checkbox state as the source of truth.
- **Appointment Notes / Connect Call Summaries**: approved summaries can create source-linked events when they contain concrete observations or actions.
- **CarePrep / Health Focus**: Track Events become person-level context for trends and summaries, alongside appointments, Visit Notes, topic mentions, and reports. Use source links so generated summaries can trace facts back to the event.

## Receiver Proof Of Concept

The first backend slice is intentionally small:

- Return active Focus Items for one `care_subject_id`.
- Rank with the deterministic Today’s Focus policy in `app/lib/personal/track/todayFocusRanking.ts`.
- Enforce a hard maximum of three returned items.
- Allow `simple_done` completion by creating one Track Event.
- Allow `measured_value` completion by requiring a numeric value and resolving a unit from the request or `completion_config`.
- Remove items already completed today based on `track_events.focus_item_id`.
- Attach `todayFocusRanking` to each returned item so ranking decisions can be analyzed.

### Today’s Focus Ranking Policy v1

Base weights:

- User-created Today goal: `100`
- Caregiver-created goal: `95`
- Appointment today: `90`
- Medication reminder: `90`
- Appointment tomorrow prep: `80`
- AI/recommendation candidate: `70`
- Routine habit: `50`
- Low-priority suggestion: `20`

Modifiers:

- Overdue: `+20`
- Repeatedly skipped: `+15`
- Provider/CarePrep-backed recommendation: `+25`
- Expires today: `+15`
- Already completed today: removed from the result

The ranking trace includes the source category, base weight, modifiers, final score, and rationale. This is intentionally simple, inspectable policy logic, not autonomous AI ranking.

Endpoint:

- `GET /api/connect/today-focus?personId={care_subject_id}` returns the ranked item list.
- `POST /api/connect/today-focus` with `personId`, `focusItemId`, and optional `occurredAt`, `note`, `value`, `unit` creates the Track Event.
- `POST /api/connect/talk` with `personId`, reviewed `inputText`, optional `receiverDeviceId`, and optional contacts interprets Talk input. It writes a `track_events` row only for high-confidence, no-review Track intents.

This slice does not add AI ranking. If AI-assisted ranking or focus generation is introduced later, the prompt must be stored in the existing Admin-editable AI prompt system before it is used in product flows.

## TODOs

- TODO(track-talk): define Talk ingestion review thresholds, source snippets, and transcript retention boundaries before writing voice-created events.
- TODO(track-receiver): define Receiver Today’s Focus query/API and tap/follow-up flow after the schema is applied.
- TODO(track-reminders): decide whether reminders reference `focus_items`, create `focus_items`, or only create `track_events` when answered.
- TODO(track-careprep): decide how Track Events should be ranked for CarePrep relevance without turning Track into clinical decision support.
