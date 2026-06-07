# Health Focus / Reports Foundation

Status: future architecture direction, not yet implemented.

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

## Data Principles

- Appointments and saved Notes remain the source of truth.
- Topic mentions are an index over source material, not a replacement for source material.
- Topic summaries and reports should store source appointment ids so generated content can be traced back.
- AI output should be saved when it becomes reusable context, rather than regenerated repeatedly without an audit trail.
- Topic/report data should be scoped to the correct Care VIP.

## Candidate Data Model

Future tables may include:

- `health_topics`
- `topic_mentions`
- `topic_summaries`
- `reports`

Topic mentions may include:

- topic id/name
- appointment id
- Care VIP / care subject id
- provider
- appointment date
- source snippet
- confidence
- status such as `new`, `ongoing`, `resolved`, or `follow_up`
- related topic ids/names

Reports may include:

- report type
- topic
- date range
- generated summary
- source appointment ids
- creation date
- version metadata

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

## MVP Shape

A likely first version should be narrow:

- generate or record topic mentions from saved Visit Notes and/or CarePrep workflows
- show a small Health Focus list for a Care VIP
- open a topic detail view with source-backed mentions
- optionally generate and save one plain-language topic summary

Reports should be designed into the data model, but broad reporting UI can wait.

## Out Of Scope For First Build

- automated diagnosis or medical advice
- trend claims that are not backed by source material
- cross-report analytics
- progression detection
- broad report comparison
- complex permission sharing

## Strategic Value

This layer answers the user objection "Why not just use Notes?" CarePland would not merely store notes; it would identify, organize, summarize, and retrieve context across time.
