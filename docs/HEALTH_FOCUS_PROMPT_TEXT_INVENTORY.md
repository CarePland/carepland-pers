# Health Focus Prompt and Text Inventory

Status: under-the-hood inventory with a read-only Admin surface in `Admin > System > AI Prompts > Inventory`. This is a working reference for reviewing Health Focus / Health Story prompt paths, user-facing text, and future feedback points before building a richer editable inventory surface.

## Purpose

Health Focus should be inspectable and tunable. If users say something was confusing, too technical, too vague, or not human enough, there should be a concrete place to identify which prompt or text path shaped that experience.

This document tracks:

- prompt key
- Admin-visible label
- what the prompt affects
- when it is used or expected to be used
- user-facing text it may influence
- feedback signals that should lead to refinement

Health Focus prompts should use the existing Admin AI Prompts system through `ai_instruction_sets` and `ai_instruction_versions`. Do not create a parallel prompt-management system.

## Current Admin Prompt Paths

### `health_topic_extraction`

Admin label: Health topic extraction

Purpose: Extract candidate Health Focus topics from saved source text such as Visit Notes, appointment details, CarePrep, Ask, or future report inputs.

Current/future trigger:

- after Visit Notes are saved
- during backfill
- future AI-assisted extraction pass

User-facing impact:

- which topics appear in `Your Health Focus`
- which source notes appear under `Sources used for this story`

Refine if users say:

- an important topic is missing
- irrelevant topics are appearing
- the app is over-medicalizing normal language
- pet/family/non-human context is mishandled

### `health_topic_normalization`

Admin label: Health topic normalization

Purpose: Map user/source language to standardized topic slugs while preserving human language.

Current/future trigger:

- when extracted topic text needs to map to the Health Focus catalog
- when new user wording should be aligned with existing topics

User-facing impact:

- topic names on Health Focus cards
- whether topics are grouped or split

Refine if users say:

- “that is not what I meant”
- “this should be about right knee pain, not general pain”
- “these should be separate”

### `health_topic_relationship_detection`

Admin label: Health topic relationship detection

Purpose: Decide whether topics appear related, separate, or unclear based on source context and user corrections.

Current/future trigger:

- when building Health Story summaries
- when interpreting co-mentioned topics
- when deciding if Pain is one thread or multiple threads

User-facing impact:

- story language such as separate care threads vs one broader topic
- related-topic chips and future report grouping

Refine if users say:

- unrelated topics were treated as connected
- connected issues were split apart
- relationship language feels too certain

### `health_focus_card_summary`

Admin label: Health Focus card summary

Purpose: Write short, plain-language Health Focus card summaries.

Current/future trigger:

- when rendering or saving Health Focus card summaries
- future generated/saved card summaries

User-facing impact:

- short card text under the three context pills

Current content rules:

- do not repeat recency/frequency/span; the pills do that
- avoid extraction-mechanics phrases
- explain what the topic appears to mean
- keep it short enough for scanning

Refine if users say:

- card summaries are confusing
- summaries sound robotic
- summaries feel too vague
- summaries overstate meaning

### `health_story_narrative_summary`

Admin label: Health Story narrative summary

Purpose: Write the top Health Story paragraph.

Current/future trigger:

- when opening `View Story`
- future saved Health Narrative generation

User-facing impact:

- the main Health Story explanation

Current content rules:

- explain the care story, not the topic graph
- use cautious language
- do not diagnose or advise
- incorporate prior user clarifications

Refine if users say:

- “that is not the story”
- “this sounds like a database”
- “this is too medical”
- “I already corrected this”

### `health_story_timeline_summary`

Admin label: Health Story timeline summary

Purpose: Create approximate, source-backed timeline items.

Current/future trigger:

- when enough dated source appointments exist
- future saved Health Story/report generation

User-facing impact:

- timeline items on the Health Story page

Current content rules:

- use broad timing such as `Spring 2026`
- avoid unnecessary timestamps
- hide the timeline if source data is too thin

Refine if users say:

- order is confusing
- timeline implies progression without proof
- exact dates would be more useful in a specific context

### `health_story_source_snippet_selection`

Admin label: Health Story source snippet selection

Purpose: Choose short source snippets that support trust and auditability.

Current/future trigger:

- when selecting snippets for `Sources used for this story`
- future AI-assisted source selection

User-facing impact:

- source card snippet text

Current content rules:

- prefer meaningful source text
- avoid showing `Matched term`
- fallback text should be calm: `Relevant saved note text was not available.`

Refine if users say:

- source proof is weak
- snippets do not explain why the topic appeared
- source cards feel like extraction artifacts

### `health_topic_feedback_interpretation`

Admin label: Health topic feedback interpretation

Purpose: Interpret user feedback on Health Focus / Health Story output.

Current/future trigger:

- when a user clicks feedback controls
- when a user submits a clarification

User-facing impact:

- whether feedback is stored as confirmation, correction, relationship feedback, or clarification
- whether feedback should influence future generation

Refine if users say:

- feedback was misunderstood
- the app keeps making the same mistake
- clarification wording is not reflected later

### `health_topic_correction_structuring`

Admin label: Health topic correction structuring

Purpose: Convert user clarifications into durable care-context corrections.

Current/future trigger:

- after feedback interpretation
- before writing to `health_topic_user_context`

User-facing impact:

- future Health Focus cards
- future Health Stories
- future CarePrep context
- future reports

Refine if users say:

- corrections are too broad
- corrections are applied to the wrong Care VIP/topic
- corrections should influence Health Story but not CarePrep, or vice versa

### `health_report_generation`

Admin label: Health report generation

Purpose: Generate saved Health Focus reports and reusable Health Narratives.

Current/future trigger:

- when generating a saved topic report
- when refreshing a saved Health Narrative

User-facing impact:

- saved report text
- report source references
- future comparison of reports over time

Refine if users say:

- report is too generic
- report ignores corrections
- report is too long or too clinical

## Current Non-Prompt Text Paths

These are UI copy/text behaviors that may eventually belong in Dynamic Text or a dedicated content registry.

### Health Focus Section

Current text:

- `Your Health Focus`
- `Care themes from your notes`
- `View sources`
- `View Story`

User-facing moment:

- Home Health Focus card grid

Refine if users say:

- “Health Focus” is unclear
- “Care themes” sounds too abstract
- “View sources” sounds technical

### Context Signature Pills

Dimensions:

- recency
- frequency
- span

Example labels:

- `This Month`
- `Earlier This Year`
- `A Few Times`
- `Fairly Often`
- `Several Months`
- `Multiple Years`

User-facing moment:

- Health Focus cards
- Health Story header

Refine if users say:

- labels are too vague
- labels feel too exact
- frequency does not match their expectation

### Health Story Detail

Current text:

- `Health Story`
- `Key details`
- `Related topics`
- `Related providers`
- `Timeline`
- `Sources used for this story`
- `Relevant saved note text was not available.`

User-facing moment:

- after `View Story`

Refine if users say:

- story sections feel too technical
- source text is not reassuring
- related topics feel like a data dump

## Feedback UI Copy Candidates

Not implemented yet. Candidate copy for future small feedback controls:

- `Looks right`
- `Not accurate`
- `These are separate`
- `These are related`
- `Add clarification`

Clarification placeholder candidates:

- `What should CarePland remember about this story?`
- `Add a short correction or clarification`

Important: this should not feel like support feedback. It should feel like the user is helping CarePland understand their care story.

## Review Rule

When reviewing any Health Focus prompt or text path, ask:

- Would a normal person say this out loud?
- Does this explain the user’s care, or does it explain how the system found the topic?
- Is the language cautious without being evasive?
- Is this prompt visible/editable through Admin if it shapes user-facing context?
- Could prior user corrections change the output?
