# CarePland Recommendations Foundation

Last updated: 2026-07-01

CarePland Recommendations are reviewable candidates for possible Daily Focus items, reminders, or preparation prompts.

They are not automatically shown to users. They are not automatically converted into Focus Items. They are not autonomous AI actions or medical decision support.

AI may help later, but people decide.

## Model

### `care_recommendations`

Candidate-level record.

Key fields:

- `care_circle_id`, `care_subject_id`: person-scoped and Care VIP safe.
- `recommendation_type`: starts with `daily_focus_candidate`, with room for `careprep_candidate`, `reminder_candidate`, `health_focus_candidate`, and `custom`.
- `title`, `description`, `reason`: user/caregiver-readable candidate explanation.
- `dedupe_key`: deterministic generation key used by rerunnable v1 scans to update the same open candidate.
- `source_type`, `source_table`, `source_id`: primary source hint.
- `confidence`: confidence in the extraction/match, not confidence that the person should do it.
- `priority`: `critical`, `high`, `normal`, or `low`.
- `expires_at`: optional candidate freshness boundary.
- `status`: `candidate`, `approved`, `dismissed`, `expired`, or `converted_to_focus`.
- `converted_focus_item_id`: set only after an approval workflow creates a Focus Item.
- `structured_payload`: suggested completion type, event type, units, related topics, review context, and `recommendationTrace`.

`recommendationTrace` is the v1 decision trace for model improvement and review. It includes:

- `generationRule`: deterministic rule that created the candidate.
- `matchedKeywords`: readable keyword labels that matched supporting evidence.
- `sourceSummary` and `sourceTypeCounts`: where supporting information came from.
- `priorityDecision`: priority value, rationale, and signals.
- `confidenceDecision`: average evidence confidence, source boost, final confidence, and rationale.
- `sortDecision`: the priority/confidence values used for candidate ordering.

### `care_recommendation_evidence`

Supporting source rows for a recommendation.

One recommendation may have multiple pieces of evidence, such as a user goal, a cardiology note, and a PT note. Evidence rows keep source labels, snippets, source table/id, source type, occurrence date, confidence, and an `evidence_hash` so repeated v1 scans do not add the same evidence over and over.

## Deterministic Generation Rules

The first foundation uses deterministic rules only. No AI prompt is added.

Initial rules:

- Provider/CarePrep phrases such as `track home blood pressure`, `home BP log`, or `home monitoring` can create a `Track home blood pressure readings` candidate.
- Physical therapy, walking tolerance, balance, or activity-planning references can create a `Take a short walk` or mobility-oriented candidate.
- Nutrition/weight notes and CarePrep items can create a `Record weight` measured-value candidate.
- Medication timing phrases can create a review candidate such as `Review medication timing notes`, but this should not become medication instructions without human review.
- User and caregiver goal sources should be carried forward directly as candidates, with source type `user_goal` or `caregiver_goal`.

Priority must come from evidence:

- `critical`: only when the source explicitly says urgent/critical or equivalent. Do not infer.
- `high`: provider instruction, CarePrep next step, or multiple independent supporting sources.
- `normal`: single user/caregiver goal or broad Health Focus/Track-history support.
- `low`: weak, old, or low-confidence support.

## V1 Backend

The first backend endpoint is `/api/personal/recommendations`.

- `GET /api/personal/recommendations?personId=...&status=candidate` lists stored recommendation candidates with evidence.
- `POST /api/personal/recommendations` with `{ personId }` scans existing CarePland data, generates deterministic candidates, stores new candidates, updates existing open candidates with the same `dedupe_key`, and adds only new evidence rows.
- `PATCH /api/personal/recommendations` with `{ personId, recommendationId, action }` supports `approve`, `dismiss`, `expire`, and `convert_to_focus`.
- Source scanning currently uses current appointment notes, current CarePrep guidance, Health Focus topic mentions, and Track history when those tables are available.
- `convert_to_focus` creates an active `focus_items` row using the recommendation title, priority, suggested completion type, suggested event type, and measured follow-up config where known. It marks the recommendation `converted_to_focus` and stores `converted_focus_item_id`.
- Converted Focus Items store `metadata.focusRankingDecision` with the recommendation id, source, priority-to-importance mapping, final `importanceScore`, and rationale. They also carry `metadata.recommendationTrace` so the original recommendation decision remains inspectable after conversion.
- Recommendations remain reviewable candidates until an explicit review action is taken. The endpoint does not automatically show, convert, or rank Focus Items for Receiver Today’s Focus.
- TODO(recommendations-approval-ui): design the approve/modify/dismiss UI around these backend actions.
- TODO(recommendations-admin-ai): if AI enters recommendation generation or ranking, seed the prompt through Admin-managed `ai_instruction_versions` first.

## Example Recommendations From Project Seed Data

These examples come from existing sample and Health Focus seed SQL, not live production data.

### Track Home Blood Pressure Readings

Source evidence:

- Appointment note in `2026-05-19_sample_data_seed.sql`: `Track home blood pressure readings before the next visit.`
- Health Focus sample note in `2026-06-09_health_focus_sample_data_seed.sql`: `Track home blood pressure readings.`
- Cardiology sample note: `Continue home monitoring and send readings if dizziness worsens.`
- CarePrep sample: bring `Home blood pressure readings` / `Home blood pressure log`.

Candidate shape:

- `recommendation_type`: `daily_focus_candidate`
- `priority`: `high`
- Suggested focus completion: `measured_value`
- Suggested event type: `measurement.blood_pressure`
- Reason: `Found in provider notes and CarePrep around home blood pressure monitoring.`

### Take A Short Walk

Source evidence:

- PT sample note: `Walking tolerance and balance were reviewed.`
- Health Focus topic mention: `Walking tolerance and balance were reviewed in PT.`
- Nutrition/lab sample note: `walking was discussed as part of activity planning.`

Candidate shape:

- `recommendation_type`: `daily_focus_candidate`
- `priority`: `normal`
- Suggested focus completion: `simple_done`
- Suggested event type: `activity.walking`
- Reason: `Walking appeared in PT and activity-planning context.`

### Record Weight

Source evidence:

- Nutrition/lab sample note: `Nutrition and weight were reviewed with cholesterol labs.`
- Pet/Care VIP sample CarePrep: `Ask whether weight or appetite needs follow-up.`

Candidate shape:

- `recommendation_type`: `daily_focus_candidate`
- `priority`: `normal`
- Suggested focus completion: `measured_value`
- Suggested event type: `measurement.weight`
- Reason: `Weight appears in nutrition/lab and follow-up preparation context.`

### Review Medication Timing Notes

Source evidence:

- Primary care sample: `Medication timing may matter for dizziness.`
- Cardiology sample: blood pressure, dizziness, cholesterol, and medication timing were reviewed.
- Mom caregiver sample: `Review medication timing, BP medications, and any cardiology changes.`

Candidate shape:

- `recommendation_type`: `daily_focus_candidate`
- `priority`: `high` when supported by provider/CarePrep evidence
- Suggested focus completion: `note_required`
- Suggested event type: `note.caregiver`
- Reason: `Medication timing appears in provider and CarePrep follow-up context.`

This candidate is intentionally a review/note candidate, not a medication instruction.

## Future Approval Workflow

Future flow:

Appointment / CarePrep / Notes / OCR / Health Focus / Track history

Recommendation candidate

User or caregiver approves, edits, dismisses, or ignores

Approved candidate becomes a Focus Item

Focus Item completion creates Track Event

Track Event becomes future CarePrep and Health Focus context

## AI Prompt Policy

No AI recommendation prompt is included in this foundation.

If AI-assisted recommendation generation or ranking is added later:

- Seed the prompt into the existing Admin-editable `ai_instruction_versions` system.
- Require source evidence in the output schema.
- Require a plain-language `reason`.
- Prohibit diagnosis, treatment instructions, emergency triage, and autonomous conversion to Focus Items.
- Preserve model/prompt version metadata on generated recommendation rows.

## TODOs

- TODO(recommendations-approval): design user/caregiver review states for approve, edit, dismiss, ignore, and convert.
- TODO(recommendations-freshness): tune expiration by source type and appointment timing.
- TODO(recommendations-focus-conversion): refine per-type Focus Item defaults and preserve richer recommendation evidence in the Focus Item review surface.
- TODO(recommendations-admin-ai): if AI enters the loop, add an Admin-managed prompt and structured output schema before product use.
