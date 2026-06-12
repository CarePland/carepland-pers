# Health Focus / Reports Foundation

Status: foundation in progress. Database tables, TypeScript domain helpers, deterministic catalog extraction, initial API routes, a small Home Health Focus summary card, and a source-backed topic detail panel exist. Ordinary appointment-card Visit Notes saves and single Import/intake Visit Notes saves go through a server route that triggers best-effort topic extraction. Topic summary generation and reports UI are not yet implemented.

## Purpose

Health Focus is the proposed person-level context layer above appointment-level workflows. It should help CarePland move from appointment preparation toward a personal healthcare context engine while staying aligned with the existing philosophy: reduce cognitive overload, carry context forward, protect user effort, and keep the UI calm.

## Problem

CarePland already captures valuable source material through appointments, Visit Notes, CarePrep, imports, and Ask. Users should not need to manually search appointment-by-appointment to answer questions like:

- Tell me about my blood pressure.
- What has happened with my knee pain?
- What have doctors said about dizziness?
- What are the major themes in my care?

The missing layer is a structured, reusable topic index.

## Proposed Concepts

Health Focus is the user-facing topic surface.

Examples:

- Blood Pressure
- Cholesterol
- Knee Pain
- Fatigue
- Sleep
- Imaging
- Medication Changes
- Lab Results

Implementation should treat Health Focus as the visible expression of a broader context layer:

- Health topics
- Topic mentions
- Saved topic summaries
- Saved reports

## Taxonomy Strategy

Health Focus should tell the story of someone's care. It should not become a diagnosis taxonomy, clinical coding system, or lightweight ICD clone.

Design center:

- User-friendly topics
- Broad domains
- Reasonable categories
- Topic relationships
- Source-backed narrative retrieval

Avoid optimizing for:

- exhaustive medical ontology coverage
- deeply nested clinical classification
- diagnosis-first naming
- categories that require users to know medical coding language

The user-facing object should feel like `Blood Pressure Story`, not `Cardiovascular > Vitals > Blood Pressure > Essential Hypertension > Stage 1`.

Domain should stay very broad. Initial domains:

- `health`
- `care_logistics`

Possible future domains, added only when they clearly earn their place:

- `wellness`
- `caregiving`
- `pet_health`

Category should be useful for grouping and retrieval, not rigid clinical classification. Current categories include:

- `vitals`
- `labs`
- `medications`
- `symptoms`
- `lifestyle`
- `diagnostics`
- `dental`
- `conditions`
- `procedures`
- `therapy`
- `mobility`
- `mental_health`
- `preventive_care`
- `nutrition`
- `specialists`
- `follow_up`

Topic is the user-language layer. Topic is not the same thing as condition.

Examples:

- `Blood Pressure` is a topic.
- `Hypertension` may be a related condition or alias.
- A future `Blood Pressure Story` might pull from Blood Pressure, Hypertension, Medication Changes, Dizziness, Cardiology, and Home Monitoring without requiring the user to know any of those structures.

Topic relationships may become more valuable than taxonomy depth. CarePland should be able to learn and store relationships such as:

- Blood Pressure linked with Dizziness
- Blood Pressure linked with Medication Changes
- Blood Pressure linked with Cardiology
- Blood Pressure linked with Home Monitoring

Future narratives can then say things like: "Blood pressure is frequently discussed alongside dizziness and medication timing." That kind of usefulness should emerge from relationships and source-backed mentions, not from a perfect category tree.

## Data Principles

- Appointments and saved Notes remain the source of truth.
- Topic mentions are an index over source material, not a replacement for source material.
- Topic summaries and reports should store source appointment ids so generated content can be traced back.
- AI output should be saved when it becomes reusable context, rather than regenerated repeatedly without an audit trail.
- Topic/report data should be scoped to the correct Care VIP.
- Users should have agency over topic status. AI may suggest `new`, `ongoing`, `resolved`, or `follow_up`, but the current status is user-editable and status ownership is tracked.
- Source traceability should prefer source IDs and anchors over copied note text. If a snippet is stored, it should be whitespace-normalized, short, and used only as a traceability aid.
- Topic names should prefer human language over diagnosis/coding language unless the user or source material naturally uses the diagnosis term.
- Topic relationships should be preserved and analyzed over time; they may power better reports than deeper category nesting.

## Narrative Quality Principles

Health Focus summaries should translate database facts into human context. The card and Health Story summary should not read like a topic extraction report.

Before showing a summary, use this practical test: if changing only the topic title still leaves the paragraph sounding plausible, the summary is too generic.

Prefer topic-specific observations such as:

- Knee pain appears connected with imaging, arthritis, physical therapy, and follow-up care.
- Physical therapy appears to support a broader knee-pain care thread rather than standing alone.
- Dental / Oral Health appears mainly in dental visits and may be separate from orthopedic topics.
- Pain may represent more than one care thread when it appears across dental and orthopedic visits.
- Blood pressure appears alongside dizziness, cholesterol, or medication changes, suggesting broader monitoring context.

Avoid using these as the entire summary:

- This came up several times.
- Several providers were involved.
- This appears to remain active.
- Saved notes also connect this with...

Those details are still useful as supporting context, but the primary narrative should explain what is distinctive about the topic based on saved appointments, providers, related topics, dates, snippets, and statuses. Keep the language cautious: `appears`, `seems`, `saved notes suggest`, `the record connects`, and `may represent`. Do not diagnose, advise, or infer improvement/worsening unless the saved source text clearly supports it.

## Context Signature

Each Health Focus topic can show a compact three-pill context signature:

- recency: when the topic last appeared
- frequency: how often it appears across the selected saved visit set
- span: how long the topic has been part of the saved care history

Examples:

- `Last Month` / `Frequent` / `Several Months`
- `This Month` / `Most Visits` / `Multiple Years`
- `Earlier This Year` / `Occasionally` / `About a Year`

These labels are intentionally approximate. They should orient the user quickly without turning the main Health Focus card into analytics. Exact dates and source details belong lower in the Health Story source/evidence sections.

The context signature should carry the orientation work. Main story prose should avoid repeating the same facts with lines like `this topic appeared recently`, `this last appeared a few months ago`, or `this came up several times`. Once the pills answer current/prominent/long-running, the summary should focus on what is distinctive about the care story.

The story should not merely report topic relationships. A sentence like `Pain appears with Dental / Oral Health and Knee Pain` is extraction metadata. A better Health Story explains the meaning cautiously: `You've discussed both dental pain and knee-related pain. These appear to be separate concerns rather than one single issue.`

Card and story summaries should sound like plain observations, not topic analysis. Avoid phrases such as `saved notes place it near`, `the record connects it with`, `related context may include`, `matched term`, and `topic was mentioned`. Prefer shorter language like `You've discussed...`, `This appears to be...`, `This seems separate from...`, `This appears alongside...`, and `This looks like...`.

The context signature should be generated by shared helpers, not hardcoded in page components. The UI should render the labels in a consistent order: recency, frequency, span. Use distinct colors by dimension for quick recognition, but never rely on color alone to communicate meaning.

## Implemented Foundation

Initial foundation migration:

- `supabase/sql/2026-06-07_health_focus_reports_foundation.sql`

Initial domain modules:

- `app/lib/healthTopics/`
- `app/lib/reports/`

Initial API routes:

- `app/api/appointment-notes/route.ts`
- `app/api/health-topics/backfill/route.ts`
- `app/api/health-topics/extract/route.ts`
- `app/api/health-topics/detail/route.ts`
- `app/api/health-topics/summary/route.ts`

Initial patient-facing components:

- `app/components/healthTopics/HealthFocusCard.tsx`
- `app/components/healthTopics/HealthFocusTopicDetail.tsx`

Foundation tables:

- `health_topics`
- `topic_mentions`
- `topic_summaries`
- `reports`
- `context_relevance_policies`
- `context_relevance_policy_factors`
- `health_topic_feedback`
- `health_topic_user_context`

The initial topic catalog is global and standardized. It includes topics such as Blood Pressure, Cholesterol, Medication Changes, Knee Pain, Dizziness, Fatigue, Sleep, Lab Results, Imaging, Dental / Oral Health, Diabetes, Arthritis, Asthma / Breathing, Procedures, Physical Therapy, Walking / Balance, Anxiety / Stress, Mood / Depression, Preventive Care, Nutrition / Weight, Cardiology, Orthopedics, Neurology, Home Monitoring, and Follow-Up. Topic aliases such as `BP`, `hypertension`, `labs`, `MRI`, `dentist`, `fall risk`, and `cardiologist` map toward normalized slugs.

Catalog strategy:

- The first catalog is seeded in the migration so extraction never starts against an empty catalog.
- Catalog rows are code-controlled for now.
- The schema includes catalog ownership/source fields so Admin-created or Admin-modified topics can be supported later without redesigning the table.
- The app does not grant topic catalog write access to authenticated users yet.

Topic mentions may include:

- topic id/name
- appointment id
- Care VIP / care subject id
- provider
- appointment date
- source appointment/note IDs
- optional source snippet
- optional source text hash/source anchor
- confidence
- AI-suggested status such as `new`, `ongoing`, `resolved`, or `follow_up`
- current user-editable status and status ownership metadata
- related topic ids/names
- co-mentioned related topic slugs from the same source note

Source snippet policy:

- A source relationship should always be stored when available, such as `appointment_id`, `source_table`, and `source_id`.
- `source_anchor` and `source_text_hash` can support traceability without copying note text.
- A hash alone is not enough for user-facing explanation because it cannot show why a mention was extracted, but it can help detect whether source text changed.
- If copied text is needed, `source_snippet` is optional, whitespace-normalized, and capped at 240 characters in the database. The TypeScript helper defaults to 160 characters.

Reports may include:

- report type
- topic
- date range
- generated summary
- source appointment ids
- creation date
- version metadata

Relevance policy factors are stored as rows so future retrieval ranking can become product/admin-tweakable instead of hardcoded. The first default policy includes factors for:

- topic overlap
- unresolved/follow-up status
- user-marked importance
- same provider
- same practice/organization
- same specialty
- same appointment type
- recent Urgent Care context
- PCP broad-context behavior
- recency decay

These factors are intentionally separate from the topic catalog. The topic layer answers "What is this about?" The relevance policy answers "Which prior context matters most right now?"

Feedback and correction storage:

- `health_topic_feedback` stores what the system showed, what the user said about it, which Care VIP/topic/story/report it applied to, source appointment/topic mention references, and whether the feedback should influence future generation.
- `health_topic_user_context` stores durable user corrections and clarifications that should be treated as care-context input in future Health Focus, CarePrep, and report generation.
- Feedback is not generic support feedback. It is product-learning and care-context data.
- Binary feedback can confirm or correct interpretations such as `looks_right`, `not_accurate`, `related`, or `unrelated`.
- Clarification feedback can preserve user wording such as `The dental pain and knee pain are unrelated` or `This is actually about my right knee`.
- Future summaries should use prior clarifications so the user does not have to correct the same mistake repeatedly.

Admin-managed Health Focus prompt paths:

- `health_topic_extraction`
- `health_topic_normalization`
- `health_topic_relationship_detection`
- `health_focus_card_summary`
- `health_story_narrative_summary`
- `health_story_timeline_summary`
- `health_story_source_snippet_selection`
- `health_topic_feedback_interpretation`
- `health_topic_correction_structuring`
- `health_report_generation`
- `home_context_intent_classifier`
- `home_context_answer`

These use the existing `ai_instruction_sets` / `ai_instruction_versions` Admin AI Prompts architecture. Do not create a parallel prompt-management system for Health Focus. Anything that shapes user-facing Health Focus context should be inspectable, versioned, editable in Admin, reversible, and testable.

`home_context_intent_classifier` and `home_context_answer` power the `Get more context` panel. They are intentionally distinct from the existing Ask assistant. The classifier should reject unrelated questions before the answer prompt runs, and the answer prompt should answer only from saved CarePland context.

The context path now receives an explicit `askContext` object. Supported levels are `global`, `home`, `health_focus`, `appointment`, `visit_note`, and `careprep`. The Home panel uses `home` with visible page items such as the Next Appointment card; expanded Health Focus stories use `health_focus` with the selected topic name and source appointment IDs. Future appointment and document surfaces should pass the same object shape instead of creating a parallel Ask flow.

Ask should search in this order: visible context, current page context, then broader CarePland records. Non-health appointment questions, such as tax appointments, eye exams, or vet visits, should be treated as valid CarePland questions when they match saved appointment data.

The first conversation layer is session-only. After an answer, `Continue` allows short follow-up questions to inherit the prior question and answer. `Not quite` provides directional correction for the current session. These turns are passed into the same context route and prompts, but they are not yet persisted as long-term user context.

## Architecture Guardrails

Do not build Health Focus inside `app/page.tsx`.

Before implementation starts:

- Create a date/time-stamped full-folder backup clone, per Andrew's workflow for major architectural shifts.
- Define the domain boundary before building UI.
- Add dedicated modules and keep `app/page.tsx` as an orchestration shell only.
- Prefer `app/lib/healthTopics/` for topic rules, normalization, extraction payloads, and saved-vs-current logic.
- Prefer `app/components/healthTopics/` for patient-facing Health Focus UI.
- Prefer `app/lib/reports/` for report rules and saved report normalization.
- Prefer dedicated API routes under `app/api/health-topics/` and `app/api/reports/` if server workflows are needed.
- Use shared server helpers from `app/lib/server/` for Supabase configuration/client setup.
- If the feature introduces drafts or close/save behavior, integrate with the shared unsaved-change policy instead of adding inline warning logic.

Extraction trigger decision:

- Topic extraction should be triggered server-side after Visit Notes are saved, not as a client-side follow-up from `app/page.tsx`.
- Saving Notes should remain successful even if topic extraction is unavailable or fails.
- The likely route boundary is `app/api/health-topics/extract/route.ts`, using server-side Supabase helpers and writing `topic_mentions` without exposing Health Focus orchestration to `app/page.tsx`.
- The ordinary appointment-card Visit Notes save path uses `app/api/appointment-notes/route.ts`, which triggers topic extraction as a best-effort server follow-up.
- The single Import/intake Visit Notes acceptance path also uses `app/api/appointment-notes/route.ts` for note writing and extraction while keeping appointment creation and intake-item bookkeeping in the existing client flow for now.
- Bulk appointment import does not create Visit Notes today, so there is no Health Focus extraction work for that path yet.
- Existing current accepted Visit Notes can be retrofitted through `app/api/health-topics/backfill/route.ts`.
- The Home Health Focus loader may attempt one small signed-in backfill per Care VIP filter per session, then reload the summary. This is intended for early low-volume retrofit only, not as a long-term background job system.

Extraction strategy:

- The first extractor is deterministic catalog matching against seeded topic display names, slugs, and aliases.
- This intentionally proves the durable storage, dedupe, confidence, and server-trigger path before adding model-based extraction.
- Future AI extraction can augment or replace deterministic candidates, but should preserve the same `topic_mentions` write policy and user-editable status model.

Read surface:

- The first read surface is a passive Home card labeled `Your Health Focus`.
- It reads grouped active `topic_mentions` through `app/api/health-topics/summary/route.ts`.
- It prioritizes human-facing health concerns over supporting extraction categories. Topics such as Blood Pressure, Knee Pain, Asthma / Breathing, Cholesterol, Fatigue, Sleep, Nutrition / Weight, and Medication Changes should outrank supporting topics such as Follow-Up, Lab Results, and Imaging when Home space is limited.
- It shows topic names, short plain-language narrative summaries, mention counts, latest mention dates, and simple ongoing/follow-up pills.
- Counts and source metadata are secondary to why the topic matters.
- Main Health Focus and Health Story narratives should use human-friendly approximation. Prefer phrases such as `came up a few times`, `came up several times`, `appeared recently`, `a few months ago`, and `several providers were involved` over precise counts and timestamps. Exact dates belong in the source/evidence section.
- Selecting a topic opens a source-backed detail panel through `app/api/health-topics/detail/route.ts`.
- The topic action is framed as `View Story` to support the broader Health Narratives / Care Stories direction.
- The detail panel is framed as a `Health Story`. It should lead with a plain-language summary, then key details, related topics, a timeline when multiple dated source appointments exist, and sources used for the story.
- Source cards should include appointment date, appointment title, provider/practice when available, status chip, and relevant snippet. If the only available source text is a catalog match fallback such as `Matched term: pain`, the UI should phrase it as `Topic matched from saved note text.`
- Story timelines should use approximate date labels such as `Spring 2026` rather than timestamped appointment dates. Sources can show clean exact dates without times unless time is specifically useful.
- When extracted source notes mention multiple topics, each mention stores the other co-mentioned topic slugs. The detail panel can show these as `Also appears with` relationships.
- The `View sources` action sends users to Logged appointments for now.

Relationship feedback state:

- Health Story related-topic feedback should be treated as persistent context, not a one-time acknowledgement.
- Existing `health_topic_feedback` rows are the source of truth for reviewed relationship state. The stored value `related` maps to a visible `related` state, and the stored value `unrelated` maps to the user-facing `separate` state.
- The latest non-ignored feedback row for a topic pair wins.
- Main `Related topics:` should show active or unreviewed candidates by default.
- Topics the user marked separate should move out of the main related-topic line and into a secondary `Separate (n)` control.
- Opening `Separate (n)` shows the separated topics inline. Selecting one should remind the user it was previously marked separate and offer only the useful reversal action: `Change to Related`.
- Future Health Story and Health Focus summaries should not imply a separated relationship unless later user feedback changes that state.
- Relationship feedback phrases such as `You marked Cholesterol as a separate topic.` should become Admin-editable app text. They are user-facing context language, not model logic, and should eventually live beside the other Health Focus text controls.

Sample data requirement:

- Sample data must demonstrate CarePland's core value proposition, not merely exercise application functionality.
- Demo history should include at least one continuity-of-care story, one user-corrected relationship, one user-confirmed relationship, one resolved care thread, one ongoing care thread, one future appointment benefiting from prior context, and one multi-subject care scenario.
- The seed should deliberately create recurring topics over time, overlapping-but-separate topics, related-topic ambiguity, different providers/specialties, sparse topics that should rank lower, one-time topics, and enough source appointments for timeline and context-signature behavior.
- The current Health Focus sample seed is `supabase/sql/2026-06-09_health_focus_sample_data_seed.sql`.

## Known UI/UX Issues

- Health Story feedback text fields, such as `Not quite` story clarification and `Separate` relationship clarification, are local UI state today and are not yet integrated into the shared unsaved-change policy. Do not add one-off dirty-state checks inside the Health Story component. When dirty-state rules are externalized further from `app/page.tsx`, include these Health Story feedback drafts in the same centralized close, tab-switch, sign-out, and beforeunload policy.

## MVP Shape

A likely first version should be narrow:

- generate or record topic mentions from saved Visit Notes and/or CarePrep workflows
- show a small Health Focus list for a Care VIP
- open a topic detail view with source-backed mentions
- optionally generate and save one plain-language topic summary
- eventually save these summaries as reusable Health Narratives / Care Stories rather than regenerating them every time

Reports should be designed into the data model, but broad reporting UI can wait.

## Current Non-Goals

The foundation does not yet:

- backfill existing appointments
- generate or save topic summaries through an API
- use relevance scores in CarePrep retrieval
- expose admin controls for relevance weights
- call AI to extract topics
- expose the Health Story Discuss UI

## Out Of Scope For First Build

- automated diagnosis or medical advice
- trend claims that are not backed by source material
- cross-report analytics
- progression detection
- broad report comparison
- complex permission sharing

## Strategic Value

This layer answers the user objection "Why not just use Notes?" CarePland would not merely store notes; it would identify, organize, summarize, and retrieve context across time.
