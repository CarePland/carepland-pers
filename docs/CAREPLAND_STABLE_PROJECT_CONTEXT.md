# CarePland Stable Project Context

Last updated: 2026-07-02

This document is the stable architectural and operational memory for CarePland Personal. It should be updated as assumptions change. Do not preserve obsolete decisions for historical completeness here; keep this document current, clear, and useful for future implementation chats.

## How To Use This Document

- Read this before making non-trivial product, architecture, AI, admin, or UX changes.
- Update this document when implementation decisions, terminology, business rules, workflows, or constraints change.
- Prefer concise stable facts over chat-style notes.
- If a topic is still speculative, mark it as future plan or open question.
- More than one implementation chat may run at the same time. Each chat should stay contextually focused and avoid overlapping edits where possible to minimize conflicts.
- Modularize progressively and intentionally as patterns stabilize. Avoid premature abstraction and unnecessary micro-components.
- Separate logic from `app/page.tsx` when it improves architectural clarity, maintainability, and separation of concerns, not merely for stylistic purity.
- Profile modularization has begun with focused presentational components under `app/components/profile/` and Care VIP workflow logic under `app/lib/profile/`; keep extracting stable profile sections and rules there before broad page-level rewrites.
- Refactor large pages through behavior-preserving extraction first: move stable UI regions into focused components, move repeated field/workflow rules into `app/lib/...`, then consider hooks once ownership boundaries are clear.
- Profile draft shape, Supabase row-to-draft hydration, normalization, phone/ZIP validation, display-name derivation, and dirty-state keying live in `app/lib/profile/profileDraft.ts`; onboarding and signed-in profile flows should use this shared policy instead of reimplementing field rules.
- Profile setup and signed-in Profile contact details share `app/components/profile/ProfileContactDetailsForm.tsx`; use its inline/card variants instead of duplicating profile field markup.
- Early Access acknowledgement and profile setup gate UI lives in `app/components/OnboardingGate.tsx`; keep `app/page.tsx` responsible for state/data orchestration while the gate component owns the presentational branches.
- First-run Home welcome guide UI and static slide content live in `app/components/WelcomeGuide.tsx`; keep `app/page.tsx` responsible for welcome state, dismissed/save actions, and appointment/import/sample-data callbacks.
- Admin workspace chrome/navigation lives in `app/components/admin/AdminWorkspaceShell.tsx`; continue moving admin-only UI into admin components without pulling patient-facing state or workflows along with it.
- Sign-out unsaved-change summaries, appointment modifier close/switch checks, and Import panel close checks live in `app/lib/unsavedChanges.ts`; keep the policy for what counts as discardable work centralized instead of rebuilding it in page-level UI.
- CarePrep guidance-to-form normalization, intake draft content types, and CarePrep edit comparison live in `app/lib/editorState.ts` with the other draft comparison helpers.
- Supabase server environment checks belong in `app/lib/server/env.ts`; API routes should use the shared helper as they are touched instead of reimplementing ad hoc `process.env` guards.
- Supabase route-client creation belongs in `app/lib/server/supabase.ts`; new API routes should use the public, authenticated-user, or service-role client factory instead of rebuilding `createClient` options inline.
- Health Focus / Reports is a person-level context layer, not an appointment-card feature. The first foundation exists in `supabase/sql/2026-06-07_health_focus_reports_foundation.sql`, `app/lib/healthTopics/`, and `app/lib/reports/`. Ordinary appointment-card Visit Notes saves and single Import/intake Visit Notes saves use `app/api/appointment-notes/route.ts`, which triggers deterministic catalog-based topic extraction through `app/api/health-topics/extract/route.ts` / `app/lib/healthTopics/server.ts` as a best-effort server follow-up. The first read surface uses `app/api/health-topics/summary/route.ts`, `app/api/health-topics/detail/route.ts`, and components under `app/components/healthTopics/` on Home. Topic summary generation and reports UI are not implemented yet. Topic mention status is user-editable even when AI suggests the initial value. Topic extraction should stay server-side after Visit Notes are saved, not as client-side orchestration in `app/page.tsx`. Keep planning details in `docs/HEALTH_FOCUS_REPORTS_FOUNDATION.md` and do not build this layer into `app/page.tsx`.
- Health Focus taxonomy should optimize for the story of care, not clinical coding. Keep domains broad, categories reasonable, and topics user-friendly. Do not drift toward an exhaustive diagnosis ontology. Topic relationships, such as Blood Pressure appearing alongside Dizziness, Medication Changes, Cardiology, or Home Monitoring, are expected to become more useful than deep category nesting.
- Health Focus extraction stores co-mentioned topic slugs from the same source note in `topic_mentions.related_topic_slugs`; topic detail can surface these as lightweight `Also appears with` context.
- Health Focus Home should prioritize human-facing health concerns over supporting extraction categories. The top-level Home label is `Your Health Stories`, with a short help popup explaining that stories bring together appointments, provider recommendations, symptoms, conditions, medications, and user notes to reveal patterns across visits. Use plain-language narrative summaries and `View Story` framing; keep counts, dates, providers, and source snippets available but secondary.
- Health Focus Home uses a visual topic selector rather than a vertical report-like list: show top topics first, default to the highest-ranked topic, reveal one Health Story panel at a time below the selector, and use Show all/Show less for additional topics. Topic selectors should stay compact with an illustrative icon and title only; context/status pills belong in the selected Health Story panel so the selector feels like approachable care areas to explore, not extracted database categories.
- CP Pers Home supports an Everyone/global overview for appointment-oriented surfaces, but Health Stories remain person-scoped. In Everyone mode, Home's Next Appointment area should show one simple next-appointment row for each applicable Care VIP with an upcoming appointment, labeled `Next appointment for you` or `Next appointment for [Name]`; person-specific mode keeps the richer single appointment panel with notes/CarePrep controls. Health Stories can expose an inline person-only `Change` control in the Health Stories header only when there are actual Health Story topics and more than one Care VIP choice. It follows the global focus when the global focus is a Care VIP, and choosing a Care VIP in Health Stories should also update the global focus. Choosing Everyone globally must not put Health Stories into an Everyone state; keep or choose a concrete Care VIP when there are multiple Care VIPs. If there is only one non-default Care VIP, do not show Health Stories for that Care VIP while Everyone is selected; show them when that Care VIP is selected at the top level.
- Health Focus story details should feel snappy after the first load. Cache loaded topic detail responses in memory for the current browser tab/session with a small cap, prefetch the initially visible topics after summary load, and prefetch hidden topics when Show all expands. Do not store full story details in browser storage. Health Stories summaries may use a lightweight browser-local same-day cache keyed by signed-in account and Care VIP so ordinary Home navigation does not repeatedly reload stories during the same local day; data-changing feedback actions should bypass that cache and refresh immediately.
- Health Focus context pill labels are Admin-managed Dynamic Text. In the Health Story panel, keep the story header calm with the topic icon/name only; place context pills in the footer beside a clear CalendarClock-style date marker. The footer date marker should show only the app-formatted date text, not a visible `Last seen` label. Do not surface visit count or the full mixed status set in the compact story footer. The label override format is `canonical = label_full;label_short`; keep the date value itself app-formatted unless Andrew explicitly asks for date-format configurability.
- Existing current accepted Visit Notes can be retrofitted through `app/api/health-topics/backfill/route.ts`. Home may attempt one small signed-in backfill per Care VIP filter per session, then reload the summary; this is an early low-volume retrofit behavior, not a long-term background job system.
- CarePland Track / Today's Focus separates intentions from recorded reality. `focus_items` are person-scoped prompts/goals/routines; `track_events` are person-scoped facts that something happened or was observed. A checkbox/tap is only one possible way to create a Track Event. Talk, reminders, appointment notes, Connect call summaries, caregiver notes, and manual entry should write source-traceable Track Events rather than overloading Focus Item state. Keep Track broad and user-friendly, not diagnosis or clinical decision support. The first Receiver backend proof of concept is authenticated/person-explicit: `/api/connect/today-focus` returns at most three active items and supports only `simple_done` plus `measured_value` completion. Receiver Today’s Focus should show only stored/ranked Focus Items for the real Main Connect User, not static placeholder goals or the prototype receiver id; tapping a Receiver Focus item now writes a `track_events` row during testing, and measured items collect value/unit before saving. Completed Receiver Focus items are removed from the list for the current Focus day, where the Focus day resets at 4:00 AM in the signed-in user’s profile timezone when available. Receiver completion Undo is an Admin-tunable grace-period rollback, defaulting to 10 seconds through the shared Receiver Dynamic Text key `connect_receiver_undo_seconds`; Undo deletes the just-created Receiver Today’s Focus `track_events` row for that focus item, rather than leaving a retracted event. Future Receiver undo actions should use the same setting unless there is a clear product reason to split them. A small Today’s Focus cadence preference layer lives in `focus_cadence_preferences`: it is not a reminder scheduler, but a user preference signal for how often recommendation-backed Focus items should surface. Preferences can show an item less often, hide until the next appointment, snooze for 30 days, or stop suggesting unless materially new evidence appears. CP Pers Home can show a read-only Today’s Focus preview through the signed-in `/api/personal/today-focus` endpoint; it follows the selected Care VIP or Everyone mode and does not expose Receiver completion, Undo, or cadence controls until Coordinator workflows are designed. If a Care VIP is marked as managed by another person, CP Pers Home should continue to show their Focus but should not allow updating/completing Focus for that person in the initial Coordinator experience. The shared `TodayFocusList` component is person-scoped so CP Pers Home can later render either a selected Care VIP list or aggregate Everyone view without changing the preference model. Today’s Focus ranking v1 is deterministic and inspectable: base weights are user-created Today goal 100, caregiver goal 95, appointment today 90, medication reminder 90, appointment tomorrow prep 80, AI/recommendation candidate 70, routine habit 50, low-priority suggestion 20; modifiers are overdue +20, repeatedly skipped +15, provider/CarePrep-backed +25, expires today +15, and already completed today removed. Returned items include `todayFocusRanking` with source category, modifiers, final score, and rationale. Receiver Talk v1 uses deterministic interpretation through `/api/connect/talk` after reviewed transcription, supports walking/activity, broad medication completion, weight measurement, Connect call requests, next-appointment questions, and unknown handling, and only writes `track_events` for high-confidence no-review Track intents. Talk does not store raw audio or full raw transcripts in Track payloads, does not infer medication specifics, and does not provide clinical advice. It does not use AI ranking or generation. The foundation is documented in `docs/TRACK_TODAYS_FOCUS_FOUNDATION.md`, `docs/TALK_INTENT_FOUNDATION.md`, and `supabase/sql/2026-07-01_track_today_focus_foundation.sql`.
- Talk interpretation must remain auditable. Every Talk result should include a Decision Trace; Talk-created Track Events store it in `structured_payload.talkDecisionTrace` with primary intent, matched rules/phrases, detected entities, context used, candidate intents, critical deciding factors, confidence, confirmation/review requirements, router/model version, timestamp, and write policy so SQL analysis can improve future tools/model behavior without retaining raw transcripts. See `docs/DECISION_TRACE_ARCHITECTURE.md`.
- CarePland Recommendations are reviewable candidates that bridge existing CarePland knowledge to possible Focus Items, reminders, or preparation prompts. `care_recommendations` stores candidate status/reason/priority plus a deterministic `dedupe_key`; `care_recommendation_evidence` stores one or more supporting sources plus an `evidence_hash` for rerunnable scans. Recommendations are not automatically shown, approved, or converted to Focus Items. Initial generation is deterministic and evidence-based, not autonomous AI. Recommendation priority language must avoid emergency-sounding labels; use `strong`, `high`, `normal`, and `low`, with Admin display text such as Strong recommendation or High importance. The v1 backend endpoint `/api/personal/recommendations` can list stored candidates, scan current appointment notes, CarePrep guidance, Health Focus topic mentions, and Track history for a person, create/update reviewable candidates, explicitly approve/dismiss/expire candidates, and convert an approved/candidate recommendation into an active `focus_items` row. Each generated candidate includes `structured_payload.recommendationTrace` with generation rule, matched keyword labels, source mix, priority rationale, confidence rationale, and sort inputs for later analysis/model improvement. Conversion is still human-triggered and uses the recommendation's suggested completion type/event type plus simple priority-to-importance mapping; converted Focus Items keep `metadata.focusRankingDecision` and the original `metadata.recommendationTrace`. This does not automatically rank or show Receiver Today’s Focus. If AI-assisted recommendation generation or ranking is added later, the prompt must be seeded through the Admin-editable `ai_instruction_versions` workflow before product use. See `docs/RECOMMENDATIONS_FOUNDATION.md` and `supabase/sql/2026-07-01_care_recommendations_foundation.sql`.
- Admin has a foundation-only `Today's Focus` tab for reviewing recommendations, with the same `Today's Focus Review` panel also visible under Admin > Tools as an operational fallback. Admin review supports an explicit global approval workflow: start from all unreviewed recommendations, or narrow by user/account, Care VIP group, and specific Care VIPs. User/account, group, and Care VIP selectors should show unreviewed counts for `candidate`/`approved` recommendations, and the panel should show a total unreviewed count near the top. Global review access is only available after verifying `profiles.is_admin`; normal users still use person-scoped authenticated access. The panel can scan/load recommendation candidates, inspect reason/evidence/rationale, select one or all reviewable candidates, approve/dismiss them, or write selected candidates to Today's Focus. The default Review Queue contains `candidate` and `approved` items; `approved` means acceptable but not yet converted. `Written to Focus`, `Dismissed`, `Expired`, and `All` are history/filter views. After a write/dismiss action, the row should show the outcome briefly, then leave the default queue. This is not the final caregiver/user approval UI. Recommendation titles may remain review-oriented, but converted Focus Items should use person-facing titles for Receiver presentation, while preserving the original recommendation title in Focus Item metadata. Review actions should be audited in `care_recommendation_review_events`; the recommendation row keeps `metadata.latestReview` as a quick summary. Review audit rows include a first-class `recommendation_outcome`: `approved`, `dismissed_temporary`, `dismissed_permanent`, `snoozed_time`, `snoozed_until_new_evidence`, or `written_to_focus`. Dismissal requires a review note and a type: temporary, snooze until new evidence, or permanent. Snoozed/permanent dismissals suppress the same candidate until new evidence appears; when a snoozed candidate returns because evidence changed, the candidate payload should include a `snoozeReturn` rationale for the reviewer.
- Today's Focus Review keeps its in-progress Admin review draft in browser session storage so loaded candidates, scope choices, selected recommendations, and review notes survive ordinary return/reload during the session. Pending selections or a typed review note count as unsaved work and participate in the shared beforeunload/sign-out/main-tab warning flow; switching away from the Admin review/tools area prompts before discarding. Successful approve/write/dismiss actions clear the pending review draft.

## Refactoring Direction

Current modularization is intentionally incremental:

- `app/page.tsx` remains the top-level orchestration shell for now.
- Stable Profile UI sections belong under `app/components/profile/`.
- Care VIP add, duplicate-email, reactivation, and soft-deactivation behavior belongs in `app/lib/profile/careVipActions.ts`.
- Profile draft hydration, normalization, and validation belongs in `app/lib/profile/profileDraft.ts`.
- Unsaved-change summary, appointment modifier close/switch, and Import panel close policy belongs in `app/lib/unsavedChanges.ts`; page components may own warning UI, but should not duplicate the rules for which drafts count.
- Draft normalization and comparison rules, including CarePrep guidance form values, belong in `app/lib/editorState.ts` unless they are specific to a narrower domain module.
- Health Focus / Reports work should continue through dedicated domain modules such as `app/lib/healthTopics/`, `app/components/healthTopics/`, `app/lib/reports/`, and dedicated API routes as needed. `app/page.tsx` should only orchestrate visibility and high-level state for this layer.
- Contextual Ask focus builders live in `app/lib/ask/activeAskContext.ts`. Home, Health Focus, and future top-level Ask integrations should reuse these helpers instead of rebuilding active `askContext` objects inline in `app/page.tsx`.
- Top-level Ask can route obvious high-level care-record/context questions through `/api/home-context` using coarse active Ask context, while support/help/problem/product-feedback messages continue through `/api/ask`. Top-level Ask should not inherit selected Health Focus story context or show user-facing context badges; story-specific questions belong in the local Health Story `Get more context` input. Keep the conservative split logic in `app/lib/ask/contextualAskRouting.ts` rather than embedding routing regexes directly in `app/page.tsx`.
- Dynamic Text should include meaningful user-facing copy that Andrew may reasonably tune without code changes. Placeholder and microcopy strings are not all managed yet; promote them into `appContentDefaults` / `appContentOptions` as touched when they affect important workflows. The top-level Ask panel manages both `ask_guidance_message` and `ask_input_placeholder`.

Justification:

- Reduce `app/page.tsx` size and blast radius without broad rewrites.
- Make field-policy changes once, especially around required/optional profile details, auth-source behavior, phone formatting, ZIP validation, and saved-vs-draft comparison.
- Preserve the current UI while making later design and behavior changes easier to apply consistently.

Guardrails:

- Do not introduce new Profile workflows during refactors unless explicitly requested.
- Keep extracted components mostly presentational until workflow ownership is stable.
- Prefer shared helper modules for rules that must behave consistently across onboarding, Profile, navigation warnings, and save actions.
- Unit tests for pure trust-policy modules live beside the modules as `*.test.ts` and run through `npm test` using `tsconfig.test.json`. Add or update these tests when changing editor-state normalization, unsaved-change predicates, profile draft validation, or saved-vs-current comparison behavior.
- Run test/lint/build/diff-check after trust-policy or profile workflow extractions.
- API routes should fail clearly when required Supabase configuration is missing. Public routes should return a calm, user-safe unavailable message; authenticated/admin routes should distinguish server misconfiguration from ordinary user validation errors.
- Before starting the Health Focus / Reports implementation, create a date/time-stamped full-folder backup clone because it is a major architectural addition.

## Product Philosophy And Positioning

CarePland Personal helps people remember appointment details, prepare for future visits, and bring useful context forward. The product is a personal appointment memory and preparation system, not a medical advice system.

Core philosophy:

- Reduce cognitive burden for people managing appointments and follow-up details.
- Close the loop between visits: capture what happened, remember what matters, and bring the right context forward.
- Accept information in the form users already have: manual entry, pasted text, uploaded images, and `.ics` calendar files.
- Use AI as a quiet assistant. Avoid making "AI" the user-facing product identity.
- Maintain audit trails for meaningful data changes, AI outputs, admin edits, support interactions, and prompt evolution.
- CarePland Principle: every meaningful AI interpretation should be explainable to developers and to future versions of CarePland itself. Every interpreted action should produce a durable Decision Trace artifact that records what decision was made, why it was made, what evidence/context supported it, what alternatives were considered, confidence, review/confirmation requirements, router/model version, and timestamp. Do not rely on re-running future models to reconstruct historical reasoning. See `docs/DECISION_TRACE_ARCHITECTURE.md`.
- Track AI operation usage and estimated cost in a reusable way so operational cost can be analyzed by workflow/type without exposing token/cost details to patient-facing surfaces.
- Data dignity is a core trust principle. User data should be treated as borrowed context for helping the user, not as casually available operational raw material.
- Prefer calm patient-facing surfaces over admin-style control panels.
- Patient-facing vocabulary preferences live in `docs/CAREPLAND_DESIGN_ASSETS.md`; use that list for softer action/copy pairs such as `Looks Right / Not Quite`, `Related / Separate`, and `Past Visit Context`.
- Future Health Focus and Reports should extend CarePland from appointment-level preparation toward person-level context retrieval. Appointment records and saved Notes remain the source of truth; topic mentions, summaries, and reports are reusable context assets with source traceability, not replacements for source records.

CarePland Personal is internally managed as a beta product, but user-facing product language should call this phase `Early Access`, not `Beta Testing` or `beta`, unless referring to internal operations. Early Access means the same rollout/testing phase as internal beta testing while presenting a more confident user-facing posture. Future terminology plan: Early Access will likely be renamed `Founding Member`; do not make that copy change until Andrew explicitly starts the rename. The old Adalo/Make/Twilio implementation is treated as product-discovery history, not as a code architecture to clone.

## Legacy Adalo

Legacy Adalo data may be imported for early adopters so they can resume testing in CarePland Personal with familiar appointments, notes, and CarePrep context. Treat these imports as one-off continuity migrations, not as a permanent parallel workflow.

Structural assumptions:

- Adalo `UID` / `UID.` / `UID_api` was the old unifying field for a user group. In CarePland Personal, that grouping maps to one Care Circle owned by one authenticated user.
- Old Adalo usernames are not user-facing identifiers in CarePland Personal and should not be carried forward as product terminology.
- Only explicitly reviewed real early adopters should be imported. Adalo test flags are unreliable: some real testers were flagged as test accounts, and some test-looking rows may still represent real people.
- Placeholder-looking emails such as `@carepland.com`, `a@a.com`, `b@b.com`, and `cp@cp.com` may be intentional beta login aliases provided to testers. They can be imported when explicitly approved, but users will not be able to use normal email-based password reset or email verification flows unless the email is replaced with one they control.
- Imported users with placeholder/login-alias emails should be marked as requiring an email update. Product behavior should send them through profile onboarding, blank the email field, require a real email they control, and attempt to update Supabase auth email before treating onboarding/account setup as complete.
- Existing Adalo bcrypt password hashes should not be reused. Imported users should receive Supabase-auth accounts with generated temporary passwords or a password reset flow.
- Adalo `Errands_Tasks` rows are the primary appointment shell when they contain appointment/date/provider/practice information. Adalo `Appointment_details` rows hold logged visit notes/takeaways/follow-ups and pair to tasks through `Errands_Tasks.appt_detail_id = Appointment_details.ID` and `Appointment_details.id_number = Errands_Tasks.ID`.
- Paired task/detail rows should become one CarePland appointment, not duplicate appointment records.
- Adalo appointment details with summaries, takeaways, follow-ups, or transcripts should become version 1 current Notes on the imported appointment.
- Adalo guidance fields from task rows should become imported CarePrep guidance when present, marked with `source = legacy_adalo`.
- Legacy import records should use `source = legacy_adalo` where the destination table supports `source`.
- Care VIP assignment should prefer explicit legacy care-recipient names when present; otherwise default to the imported user/profile name.
- Imports should start as dry-runs with a reviewable plan before any production write.

## Core Terminology And Naming

- **CarePland Personal**: the current product/app.
- **Care VIP**: the person whose appointments and care context are being tracked.
- **Care Circle**: the underlying grouping/ownership container for a user and their Care VIPs. This replaces the older UID/family grouping concept from Adalo.
- **Appointment**: scheduled or historical visit/event tracked by CarePland.
- **Upcoming**: appointment view for future or not-yet-logged appointments.
- **Logged**: appointment has a current note reference.
- **Archived**: appointment is hidden from active views and should be treated as read-only unless restored.
- **Notes**: user-entered or imported summary/takeaways/follow-ups for a completed appointment.
- **CarePrep**: pre-visit guidance generated from appointment details, notes, and relevant history.
- **Import**: preferred user-facing term for the former "Quick Add" workflow.
- **Demo data**: clearly labeled sample appointments, notes, and CarePrep examples. Demo data must never be ambiguous.
- **Support question / Ticket**: in-app support thread between user and CarePland/admin.

Person/avatar assumptions:

- The canonical CarePland Pers person model is currently `care_subjects`; Connect participants and focus targets must reference existing `care_subjects.id` values.
- Lightweight person avatars live on `care_subjects` as `avatar_url`, `avatar_type`, and `avatar_alt_text`.
- Avatar type values are `initials`, `uploaded`, and future `generated`; initials fallback is always available and avatars must never block app use.
- Uploaded avatar files are stored in the private Supabase Storage bucket `carepland-avatars` and managed through authenticated server routes, not direct browser service-role access.
- Care VIP pet classification is lightweight for now and uses existing `care_subjects.subject_type` values: `cat`, `dog`, `pet`, or `pet:<custom label>`. Non-pet/default people may remain `other`. There is no dedicated species field yet.
- When no uploaded/generated avatar exists, cat/dog/generic pet Care VIPs use emoji avatar fallbacks as recognition anchors.
- Future generated illustrated avatars should remain user-approved, friendly, dignified, and non-photorealistic. The original uploaded photo should be deleted after generation/selection when practical for privacy.
- The logged-in account user is distinct from the current CarePland focus. The personal app focus can be `Everyone` (aggregate across available people) or one specific `care_subjects.id`.
- The top-right header focus pill is the visible identity anchor for whose CarePland world is being viewed. `Everyone` is a first-class aggregate mode, not a fallback.
- The current focus reuses the existing personal UI subject selection state and local UI-state persistence for now. TODO: decide whether to persist focus as an account/server setting.
- Connect Home follows the global CarePland focus for active person context. `Everyone` shows aggregate Connect history and offers compact avatar/name shortcuts into a temporary Connect target for call/message without changing the global focus. That temporary Connect target is in-memory only and can be forgotten when navigating away.
- Connect uses `Main Connect User` as the current stabilization term for the person whose Receiver world is active. The active person resolves from a specific global focus, then an in-memory Connect-local target when global focus is `Everyone`, then the durable `connect_settings.main_connect_user_person_id` setting, then a default/logged-in Pers person as last-resort display focus. Connect must not be personless when a signed-in Pers person is available. Connect participant rows control whether Receiver/call/message/audio actions are enabled; they are not the source of whether a person can be the visible Connect focus.
- Connect Settings may expose the durable Main Connect User setting with compact person buttons. `Household` may appear as a transparent disabled/planned pill to signal the future multi-user Receiver direction, but it must not save configuration until Receiver has real household/multi-user runtime support.
- Care VIPs classified as pets (`cat`, `dog`, `pet`, or `pet:<custom label>`) may appear in Connect household/person context but cannot be selected as the Receiver User. Show them de-emphasized and labeled by species/type.
- Connect user-facing surfaces should not expose advanced provisioning, setup diagnostics, audio maintenance, or Connect People management. Care VIP/person management lives in Profile; provisioning and diagnostics belong in Admin/DEV-oriented surfaces. User-facing Connect Settings should stay limited to meaningful Receiver defaults such as Household and Receiver User.
- Profile is the home for Care VIP avatar management. Connect should display and use avatars, but photo upload/remove controls belong in Profile so identity setup is not split across workflows. Within Profile, avatar controls belong with the selected person in Contact Details, not in the top Care VIP add/remove summary.
- Profile Contact Details distinguishes the logged-in account user from Care VIPs. It uses a person selector without `Everyone`; selecting the account user shows saved account contact fields, while selecting another Care VIP shows that person's avatar/name context without inventing contact fields until scoped Care VIP contact data exists.
- Future CP Pers import/interpreter work, including a possible single "import all" action, may create or update `care_subjects`, appointments, notes, and other Pers-owned records, but it should not automatically create `connect_participants` rows or change `connect_settings.main_connect_user_person_id`. Enabling a Pers person for Connect remains explicit provisioning/Admin behavior until participant management is intentionally designed.
- Connect message-audio playback and receiver hearing feedback are prototype-stable and should not be tuned further until live call behavior is in place. The next audio priority is call infrastructure.
- Receiver contextual UX prompts are intended to be a library of single-question, low-friction learning moments shown during normal use, not traditional surveys. They must ask one question, be directly related to a recent experience, be easy to dismiss, appear infrequently, avoid urgent workflows, and tune CarePland behavior rather than collect marketing feedback. When Receiver UX work involves uncertainty around timing, visibility, wording, interaction friction, notification frequency, or dismissal behavior, consider whether a future contextual prompt should be cataloged. The first catalog foundation lives in `app/lib/connect/receiverContextualPrompts.ts`. Initial future-trigger item: after a Receiver user has completed Today's Focus items enough times, occasionally ask whether the Receiver Undo window gives enough time, with answers `Not enough time`, `About right`, and `Too much time`; this should inform the shared `connect_receiver_undo_seconds` setting.
- Connect calls now have an app-owned local signaling foundation in `app/lib/connect/calls/server/` and `/api/connect/calls/*`: call records handle ringing/answered/connected/declined/hung-up state, while call signals carry future WebRTC offer/answer/ICE/media-state payloads. The legacy local prototype server may still mirror call state when running, but it is no longer the only place the app can store call state. Keep live media implementation layered on this call/signaling boundary instead of mixing WebRTC details into receiver UI state.
- Connect live-call audio uses the browser WebRTC controller in `app/lib/connect/calls/browserCallAudio.ts`; caller and receiver UI should show explicit audio readiness/connection/interruption state and provide microphone mute/unmute while a call is connected. Phone testing requires HTTPS or another secure context for microphone permission; plain LAN HTTP may still show call state but should not be expected to carry live microphone audio.
- Connect live-call media state should travel through `media_state` signals, not only through call-record polling. The browser call controller sends peer-ended and mute/unmute signals, applies an audio connection timeout, and lets the other side stop promptly when a peer ends the media session.
- Connect live-call WebRTC uses default public STUN when no environment override is configured, but product-demo reliability across the internet will likely require TURN. The browser call controller supports `NEXT_PUBLIC_CONNECT_ICE_SERVERS_JSON` as an override, or `NEXT_PUBLIC_CONNECT_STUN_URLS`, `NEXT_PUBLIC_CONNECT_TURN_URLS`, `NEXT_PUBLIC_CONNECT_TURN_USERNAME`, and `NEXT_PUBLIC_CONNECT_TURN_CREDENTIAL` for simple configuration. Static public TURN credentials are acceptable only as a short demo bridge; production should use short-lived credentials.
- Connect call summaries are not general conversation summaries. The summary goal is a brief care record from the conversation: include only medication discussions, symptoms, pain, mobility, sleep, appetite, weight, blood sugar/BP readings, cognitive changes, clinically relevant mood/function changes, upcoming appointments, provider instructions, caregiver observations, follow-up actions, and equipment. Exclude gossip, politics, sports, TV, opinions, financial topics unless directly needed for care access, vacation plans, relationships, jokes, religious discussion, and embarrassing non-care details. Include contextual life details only when they directly affect care; when uncertain, omit.
- Connect call transcripts are temporary by design. Store the transcript on the call record only until the AI-generated Call Summary is reviewed, approved, or expired; once approved or expired, permanently delete the associated transcript while keeping the durable summary fields. Generated summaries enter `pending_review` with `transcript_expires_at` defaulting to about seven days. Reviewer edits are persisted in `summary_approval_draft_text`; approval stores the draft when present, otherwise the generated summary, as `approved_summary_text`, sets `summary_status = approved`, records approval metadata, and deletes the transcript plus transcript segments. If the transcript expires before formal approval, cleanup must delete the transcript, retain `generated_summary_text`, set `summary_status = expired_unreviewed`, and add the note `Transcript expired before formal approval. Generated summary retained as unapproved.` Do not call expired or timed-out summaries approved. Approval should be requested from both call parties on completion when possible. Approval may come from either party; the Receiver participant may be excluded from approval when the flow explicitly chooses that because cognitive impairment or caregiving context may make the managing party the more appropriate approver. The first implementation currently approves from the Receiver post-call summary popup; `Approve` calls the app-owned summary approval endpoint with the edited draft and clears local transcript text, while `Not Quite` only shows the placeholder `This is where clarification and summary refinement will happen.` and does not yet regenerate. When the model finds no care-relevant summary, the Receiver should treat that as a distinct state: `No Relevant Info` confirms cleanup with no saved summary text, while `Add Missing Care Info` remains disabled until the user types care-relevant missing context and then submits that text as the approved care note. Future TODOs: define dual-party approval UX, discrepancy handling, richer clarification/regeneration workflow, reminder/escalation policy before expiration, and the long-term approval surface if it moves to Coordinator, Call History, or another review workflow.
- When the future `Not Quite` / reject-refine summary workflow is designed, the user must be reminded that only care-relevant parts of the conversation can be stored in CarePland. The refinement UI should explain that the approved record is limited to information relevant to appointments, health, or caregiving, and that personal details or general conversation may need to be omitted even if they were discussed on the call.
- Call summary approval and transcript cleanup are related but distinct operations. Approval should save the user-approved care summary first; transcript text and transcript segments should then be deleted. If segment cleanup fails after approval, surface `transcriptCleanupStatus: "pending"` and allow a retry path rather than pretending cleanup completed.
- Durable Connect call storage is defined in `supabase/sql/2026-06-25_connect_call_records.sql` plus `supabase/sql/2026-07-03_connect_call_pending_summary_review.sql`: `connect_calls` for call lifecycle, temporary transcript text, generated/approved summary fields, review drafts, transcript expiration, and cleanup status; `connect_call_signals` for short-lived WebRTC signaling; `connect_call_events` for diagnostics without transcripts/audio; and `connect_call_summaries` for brief care-only summary audit rows. `supabase/sql/2026-06-25_connect_call_summary_prompt.sql` seeds the Admin-managed `connect_call_care_summary` prompt. The app-owned call routes now try Supabase-backed call/signaling storage first and fall back to local JSON storage when the durable tables are unavailable, preserving local development while making deployed remote demos possible after the SQL is applied.
- Connect call diagnostics should use `connect_call_events` for operational breadcrumbs such as call created, state updated, signal posted, and summary approved. Event details must remain metadata-only and must not include transcript text, raw audio, SDP bodies, ICE candidate payloads, or other sensitive conversation content.
- During Connect UI polishing, operational call/audio/transcript details currently shown on the page should be kept available behind a `Diagnostics` checkbox visible only to Admins. This is a central troubleshooting requirement: future polished user-facing Receiver/Coordinator call UI should not expose noisy implementation state by default, but Admins should retain a quick way to see audio state, transcript-capture state, and recovery controls when a call behaves unexpectedly.
- Receiver appliance home should use a single secondary footer `Attention` slot near Sounds/Clean for pending items that need action. It should not replace primary home buttons or show large banners. Current priority is pending call summary review (`Review`) above unread messages (`Message`); future inputs should plug into the same resolver for reminder due (`Reminder`), receiver update available (`Update`), and device/audio issue (`Help`).
- Connect call transcription should start with chunked background transcription before true live captions. The first chunk model is a 35-second transcription window every 30 seconds, giving a 5-second overlap: `0:00-0:35`, `0:30-1:05`, `1:00-1:35`, etc. Segment transcripts live in `connect_call_transcript_segments`, are stitched into the temporary `connect_calls.transcript_text`, and must be deleted with the assembled transcript after summary approval. The first browser implementation records mixed local+remote call audio from the Dashboard side only after remote audio arrives, to avoid duplicate transcripts from both parties.
- The Consumer Care Knowledge Layer (CCKL) is the shared interpretation aid for consumer-facing medical/care terms, brands, services, and common nonstandard phrasing. It helps transcription correction, Connect call summaries, appointment prep, Health Topic recognition, and Admin review without expanding the care record beyond CarePland's care-relevance/privacy policy. CCKL is not a diagnosis engine, clinical decision support system, medical encyclopedia, permanent transcript store, intent router, or workflow engine. Phase 1 is code-native under `app/lib/personal/consumerCareKnowledge/`, returns stable concept IDs for matched entries, injects only matched ephemeral prompt context into Connect call summaries, and is documented in `docs/CONSUMER_CARE_KNOWLEDGE_LAYER.md`. The proposed future AI normalization prompt lives in `ai-prompts/consumer_care_knowledge_layer/` and should normalize language into reusable structured concepts while leaving routing, urgency, storage, Track, Focus, and other workflow decisions to downstream layers. Keep the seed small and curated until the taxonomy, prompt behavior, and future Admin/storage workflow stabilize.
- For local phone demos, keep the normal Next dev app on port 3000 and run `npm run dev:connect-https` to expose an HTTPS bridge on port 3001. The bridge prints LAN dashboard/receiver URLs and generates ignored local dev certificates under `certificates/`; set `CONNECT_HTTPS_LAN_HOST` when the LAN IP changes and restart Next so `allowedDevOrigins` matches.
- `docs/CONNECT_AUDIO_DEMO_CHECKLIST.md` is the near-term Connect audio demo runbook for local LAN and internet demos. Keep it aligned with live-call behavior, summary approval, temporary transcript privacy, HTTPS microphone requirements, and TURN expectations.
- The standalone Connect Receiver Android direction is a thin native appliance shell, not a native rewrite of Connect. Keep the native shell under `android/connect-receiver`; it owns launch/provisioning, permissions, wake/reboot behavior, kiosk/device-owner hooks, WebView/TWA settings, native device/screen detection, install identity, version reporting, and future hardware-specific behavior. The hosted web Receiver remains the product surface and owns UI/layouts, fixed-resolution device profiles, copy, remote config, receiver-user changes, calls, messages, diagnostics, and most feature updates. Provisioning should be web-first: a simple setup URL opens an authenticated Supabase-backed approval page, verifies a short-lived setup code, lets an authorized user approve the install and phase-appropriate hardware profile, then opens the APK with a short-lived native app claim. The native Receiver must not start the Receiver web surface from a plain installer/launcher open before a setup claim or bound receiver device exists; instead it shows a local confirmation screen that sends the user back to the browser setup page to create the claim. The native Receiver Mode wizard is local-first device configuration, not pairing/auth: it records `receiver_mode` (`dedicated` or `personal`), `provisioning_completed_at_ms`, and local capability statuses for full screen, microphone, kiosk, keep-awake, boot start, battery optimization, and update checks before continuing into the existing claim/bound-device flow. Human-typed setup URLs should support short word phrases such as `/r/kind-maple-chair` while keeping the underlying token opaque and separate. Provisioning links must never carry permanent account credentials. The current local shortcut `/r` redirects to the prototype Receiver setup code `12345` to make setup-network installs easier to type on older hardware. The APK may keep a pseudonymous app-private `receiverInstallId` plus optional server-issued `receiverDeviceId` as non-secret receiver binding hints; durable receiver credentials should move to Android Keystore-backed storage when implemented. Local binding status values are `unprovisioned`, `local_test`, `setup_pending`, `claim_pending`, and `bound`; `12345` remains only a prototype local-test code. `supabase/sql/2026-06-27_connect_receiver_provisioning.sql` defines the first durable `connect_receiver_devices` and `connect_receiver_claims`; `/api/connect/receiver-shell/claims` prefers Supabase service-role storage and falls back to local files only when Supabase/tables are unavailable in development. `/api/connect/receiver-shell/devices/binding` verifies bound devices by matching `receiverDeviceId` and `receiverInstallId`, updates `last_seen_at`, mirrors native Receiver mode/capability/device-profile fields into `connect_receiver_devices` when `supabase/sql/2026-06-28_connect_receiver_device_profiles.sql` has been applied, and is the startup hook for revocation/re-provisioning behavior. `/connect/receiver/setup` is the first install-from-link page: it can show a setup QR, offer APK download, create a short-lived app claim, and open the installed Receiver through `carepland://receiver/provision`; local development can serve the debug APK from `/api/connect/receiver-shell/apk/debug`, while production/release installs should use `CONNECT_RECEIVER_APK_URL`. The setup page can also generate a factory-reset Android dedicated-device QR payload when it has a reachable APK URL and APK SHA-256 checksum; the QR passes the current CarePland provisioning link as admin extras, and the native admin receiver stores that link when Android completes owner provisioning. `/api/connect/receiver-shell/update-policy` is the first remote update decision point: the shell reports version/device facts and the server can answer current, update-recommended, or update-required, and Connect Dashboard can surface that status for a bound receiver. Current policy responses are advisory and set `canSelfUpdate: false`; unattended APK replacement should be handled through Android Enterprise/managed Play/MDM or a later explicitly designed installer path. Server-side receiver binding, revocation, token rotation, and remote update-policy decisions remain the target durable model. The setup page includes a local browser-generated WiFi QR helper for initial network setup; it does not store WiFi credentials and is not managed WiFi provisioning. Temporary setup networks are a supported onboarding bridge for older appliance hardware, but mini-router/captive-portal automation is a future feature; the current priority is stable install/provisioning, launch recovery, bound-device visibility, and web-side update behavior for a real mom-device handoff. The long-term deployment goal remains a public HTTPS setup/provisioning path with short-lived claims so caregivers do not need to run laptop-hosted servers. Default phone/receiver behavior, kiosk, and hardware setting control should be phased after real-device testing. See `docs/CONNECT_RECEIVER_ANDROID_SHELL.md`.
- Receiver kiosk status must distinguish normal Device Admin from true Device Owner. Device Admin can be opened from the native wizard as a setup aid, but reliable lock-task/kiosk behavior requires device-owner provisioning through Android Enterprise, managed Play/MDM, a QR device-owner flow, or factory-reset hardware testing with `adb shell dpm set-device-owner com.carepland.connectreceiver/.ReceiverDeviceAdminReceiver`.
- Dedicated Receiver mode owns appliance-style recovery behavior in the native shell: boot/package-replaced/power-connected auto-launch is enabled only after the local provisioning wizard records `receiver_mode = dedicated`, and recovery launches take a short wake lock so the Receiver has time to reopen. Personal Device mode must remain a normal Android app and should not auto-launch or aggressively return to the foreground.
- Receiver hardware profiles and Receiver UI layouts are separate concepts. A hardware profile describes install context and device facts such as model/manufacturer, expected screen size, density, orientation, audio/handset quirks, kiosk expectations, and native policy. A UI layout describes the hosted Receiver presentation such as canvas size, action placement, modal density, and text sizing. Hardware profiles may select default UI layouts, but provisioning and dev testing can override them independently. Early profile examples include `grandstream_gxv3370`, `studio_gxv3370_1024x600`, `generic_landscape_android`, and `generic_android_phone`; the GXV3370-style UI layout is `desk_phone_1024x600`.
- Android 7-era appliance WebViews such as the Grandstream/GXV3370 class may not reliably run the modern React/Next Receiver client bundle. The native shell can route those devices to `/connect/receiver/legacy`, a plain server-rendered Receiver surface without Next client chunks. Keep this as a hardware compatibility path, not the primary Receiver product surface.
- The legacy Receiver route must still perform the native binding heartbeat. It reads `window.CarePlandReceiver.getProvisioningJson()` and posts version, Receiver mode, capability, kiosk, and recovery facts to `/api/connect/receiver-shell/devices/binding` using Android-7-compatible JavaScript so Admin/Dashboard status remains accurate on GXV-class hardware.
- The native Receiver should recover from temporary Receiver-server unavailability without caregiver intervention. If the configured Receiver page cannot load or does not become ready, show a calm local error/retry screen and keep retrying automatically.
- Connect Dashboard Guide mode is no longer browser-local only. The dashboard writes guide highlights through `/api/connect/receiver-guide`, the Receiver polls that endpoint, and each Receiver browser window announces a short-lived per-window session id so the Guide can warn when the same Receiver is open in multiple windows and target the intended live session. Guide can also send short-lived two-digit identify codes to live Receiver browser windows; the user can read the popup code from the Receiver window and enter it in Guide to target that exact browser session. These codes are a setup/debug identity aid, not authentication or durable pairing. The older same-browser `localStorage` keys remain as a preview/fallback path, but real Receiver guidance should use the API-mediated state keyed by receiver/device id plus optional receiver session id.
- The GXV3370/desk-phone Receiver profile is a landscape-only appliance UI, not a mini dashboard. Use `?device=gxv3370` (persisted locally) for this profile. Its home screen should stay brutally simple with huge tap targets, no person selector chrome, no small navigation, and primary actions such as `Call Andrew`, `Ask a Question`, `Appointment`, and `Messages` alongside high-contrast time/greeting/appointment status. Call screens should read like a phone/intercom appliance: incoming calls show `ANSWER` and `NOT NOW`; connected calls show `Connected to Andrew`, `Use the handset or speaker.`, and one dominant `END CALL` action. GXV task surfaces such as Ask, Messages, and Appointments should behave like full-screen appliance panels, not centered web modals; use a top toolbar, large/simple controls, concise empty states, and bottom paging where relevant. The home header can show the small browser fullscreen `MAX` / `MIN` control for non-kiosk browser use, but it should be hidden when native kiosk/lock-task mode owns fullscreen behavior.
- Receiver Screen Cleaning is a dedicated appliance mode, not a normal page. It shows only a title, one friendly cleaning message, and a large two-minute countdown; it ignores normal Receiver touch interactions and automatically returns home when complete. The first cleaning shows the default cleaning message, later sessions use random messages except when the local cleaning count reaches a configured milestone such as 5, 10, 20, etc. Cleaning sessions should be recorded best-effort for usage analytics with start/end time, duration, Receiver/person identifiers, device identifier, receiver mode, cleaning count, and message, without affecting the visible user flow.

Naming preferences:

- Use plain product language for users.
- Avoid internal model names, prompt names, or implementation language in user-facing copy.
- Use "CarePland assistant" or "CarePland" rather than foregrounding "AI" in user-facing contexts.
- Admin-facing labels may be more operational, but should remain readable.

## Pricing And Tier Structure

Current implemented assumptions:

- CarePland Personal has a plan/tier display in Profile/Admin contexts.
- Profile should show current plan status quietly; detailed tier comparison belongs on the public website or billing flow rather than the Profile page.
- Pricing tiers should reflect increasing continuity support, automation, reduced cognitive load, and care coordination rather than arbitrary technical usage limits.
- Tier 1: Free introduces basic appointment tracking, limited manual CarePrep generation, limited document/OCR/calendar imports, and self-service help. It does not automatically generate CarePrep.
- Tier 2: Active Use supports active healthcare management with larger manual CarePrep and import allowances, CarePland assistant/chat support access, and increased historical/context depth. It remains primarily manually triggered.
- Tier 3: Premium Individual supports one Care VIP with automatic CarePrep for medical appointments, smart reminders, proactive preparation workflows, generous import allowances, enhanced support responsiveness, and reduced manual effort.
- Tier 4: Group supports multiple Care VIPs, automatic CarePrep across multiple people, shared continuity workflows, group-oriented coordination, highest import allowances, and most generous support access.
- Early Access is a distinct plan tier for early adopters. Functionally, it currently matches Group/full-access behavior, supports multiple Care VIPs, includes automatic CarePrep, and should help distinguish early adopters from later paid subscribers. Future terminology plan: this tier/user-facing status is expected to be renamed `Founding Member`.
- Existing database plan ids are currently preserved for compatibility: `personal` maps to Free and `personal_plus` maps to Group. `early_access` maps to Early Access.
- During the pre-billing phase, real new onboarded users and imported early adopters should be assigned to `early_access` by default so they are distinguishable from later paid subscribers and can later choose a standard plan.
- Admin is not a pricing tier. Admin access remains controlled by admin flags/permissions, but the Profile plan display may show an Admin badge next to the actual plan for admin users.
- Billing-grade enforcement is not complete; plan enforcement is currently lightweight and beta-oriented.
- Backend plan-feature metering foundation exists as SQL patches: `plan_features`, `care_circle_feature_usage`, `check_feature_access`, `consume_feature_usage`, and `refund_feature_usage`.
- Manual CarePrep generation is the first metered workflow and uses feature key `careprep_manual`; automatic CarePrep entitlement uses feature key `careprep_auto` for future automation work.
- Metering reserves usage before expensive work and refunds it if generation fails before a CarePrep draft is saved.
- Manual CarePrep plan-limit copy is editable in Admin > Dynamic Text via `careprep_manual_limit_message`; `plan_features.limit_message` remains a backend fallback.
- When a user reaches a metered CarePrep limit, keep the CarePrep action visible and show the plan-limit message in place. Do not hide the feature or remove the path, because that creates confusion.
- Automatic CarePrep after saved Visit Notes uses `careprep_auto`: after notes are saved on a completed/logged appointment, CarePland should try to prepare the next upcoming contextually related appointment for the same Care VIP, such as dental notes flowing to the next dental appointment before an unrelated earlier eye exam. If no contextual match is found, fall back to the next upcoming appointment for that Care VIP. The notes save must remain successful even if automatic CarePrep is unavailable or fails.
- Successful automatic CarePrep should show a green expiring appointment-page status bar with an anchor action to the prepared appointment. The editable Dynamic Text key `careprep_auto_success_message` controls the message and supports `{appointmentTitle}`.
- CarePrep refresh should be gated before metering/model work when the latest saved/draft CarePrep already considered the same total count of relevant prior appointments and there are no newer saved Visit Notes among those prior appointments. Updated notes on an already-considered appointment are a material context change and should allow refresh. The editable Dynamic Text key `careprep_refresh_not_ready_message` explains the blocked case; current default: `CarePrep can't be run yet because you have no additional appointments to consider.`
- Outlier monitoring for CarePrep generation should track short-window generation volume and repeat/refresh-like generation volume by Care Circle/user. Start with Admin-visible tracking and soft review before adding hard throttles, unless abuse or runaway cost appears in real usage.
- Multi-user/group permissioning is future expansion, not a fully implemented role system.
- CP Family is a separate future app direction for deeper caregiving support and should not be used as the Tier 4 label for CarePland Personal.
- Plan changes during Early Access may be mediated through support/admin rather than self-service billing.
- Reassigning a user from Group/`personal_plus` to Early Access/`early_access` should be a simple entitlement `plan_id` change on the active Care Circle entitlement; appointment, Care VIP, notes, and CarePrep data should not move.
- Metering should use user-facing workflow language such as CarePrep generations, automatic appointment preparation, document imports, and Care VIPs.
- Do not expose technical concepts such as tokens, credits, context units, or model usage in patient-facing pricing surfaces.

Future tiering may include:

- More formal subscription and billing enforcement.
- Trial access to selected higher-tier automation so Free users can experience proactive continuity and reduced cognitive effort.
- Automated usage metering for document uploads, OCR processing, iCal/calendar imports, support assistant access, context depth, and additional workflows beyond CarePrep.

## Care VIP Definitions And Rules

Care VIPs are the people whose appointments are tracked.

Current assumptions:

- A user can have one or more Care VIPs depending on entitlement.
- If only one Care VIP exists, patient-facing selectors should usually be hidden to reduce noise.
- Profile should always show the current Care VIP section as an identity/account summary. Add/manage limits still respect entitlement, but the section should not disappear merely because the current plan has one active Care VIP.
- If more than one Care VIP exists, filtering controls can appear as "Showing: [All appts]".
- Appointment records may reference a `care_subject_id`.
- Multi-user access, role-based family sharing, and permission management are future work.
- Care VIPs have a person-level `managed_by_household` flag surfaced in Profile > Contact Details as `Managed by Household`. Use user-facing meaning: `This person is primarily managed by a family member or caregiver. CarePland will tailor features accordingly.` This setting covers young children, parents with cognitive impairment, spouses or adults who prefer someone else to manage the app, and pets, without requiring CarePland to infer diagnoses or capability. Pets are treated as managed by household by default and the option is checked/disabled for them. The initial behavior should be conservative: managed people may appear in read-only Coordinator views such as CP Pers Home Today's Focus, but Coordinator completion/update actions for their Focus should stay disabled until the managed-person workflow is explicitly designed.
- Care VIP removal should be a soft deactivation, not a hard delete. Non-default Care VIPs can be deactivated with confirmation; saved appointments remain in CarePland but are hidden from the active Care VIP workflow. Adding a Care VIP with an email address that matches an inactive record should offer reactivation instead of creating a duplicate, and adding an email address that matches an active Care VIP in the same Care Circle should be blocked. Duplicate non-email names are allowed for now because family/member names are not unique identifiers. Adult/age-threshold permission or email-confirmation workflows are still future work.

UX rule:

- Do not make solo users think they are managing a complex multi-person system.
- Show multi-person controls only when they are useful.

## Appointment Workflow

Appointments can be:

- Created manually.
- Imported from pasted text.
- Imported from uploaded images after OCR/text extraction.
- Imported from `.ics` calendar files after review.
- Edited.
- Archived and restored.
- Deleted through a soft-delete marker (`deleted_at`) so the appointment is hidden from normal user views without physically removing the record.
- Logged by adding notes.

Appointment views:

- Upcoming
- Logged
- Archived

Performance rule:

- Appointment view switches and Care VIP `Showing` filters should derive from the already-loaded appointment pool whenever possible. Do not rehydrate profile, Care Circle, entitlement, Care VIP, and onboarding context for simple local view/filter changes. Broad appointment/account reloads should be reserved for mutations, session hydration, and explicit data refreshes.
- Initial appointment load should prioritize first useful paint: load the base appointment pool first, render the list, and hydrate richer details such as current Notes and CarePrep guidance in the background unless the user action specifically requires those details immediately.
- Email/password sign-in should treat authentication and app hydration as separate phases. Once credentials are accepted, move out of the sign-in form promptly and let profile, appointment, content, session-setting, support, and admin-specific hydration continue from the signed-in app shell.
- Critical post-audio stabilization TODO: add a global signed-out/session-lost guard for the app and Receiver surfaces. If a signed-in surface finds itself without a valid logged-in state, it should clear unsafe local UI state as needed and take the user to the sign-in page instead of leaving the app in a stale, half-hydrated, or personless state. This is especially important after live-call testing because Receiver and Dashboard may be open on separate devices for long periods.

Current user-facing appointment page direction:

- Reduce status bars and load-count messages.
- Keep `Upcoming / Logged / Archived` as the primary view controls.
- Move filtering/refresh beside view controls when useful.
- On mobile, keep `Upcoming / Logged / Archived` primary and place secondary toolbar utilities such as Care VIP filtering behind a small vertical-dot overflow menu aligned with card action menus; tablet/desktop can keep the filter visible.
- Do not expose page-level refresh buttons on patient-facing pages; keep manual refresh controls only where they are content-specific, such as CarePrep refresh, or admin-facing.
- Hide Care VIP filter if only one Care VIP exists.
- Avoid heavy "Showing appointments" panels.
- Avoid showing Add Appointment / Import as always-dominant controls on the appointment list.
- Do not show the last-appointment notes reminder as a large panel on the Appointments page; surface it gently on Home instead.
- Use map/calendar affordances inline with meaningful text rather than as repeated bordered utility buttons.
- Keep patient-facing appointment cards calmer than admin tools.

Current appointment-card direction:

- Omit redundant `scheduled` badges in Upcoming; show status only when it adds meaning, such as Archived.
- Collapse appointment notes entry into a single `Notes` action that accepts typed, pasted, or uploaded context and interprets it into summary, takeaways, and follow-ups for user review before saving.
- Keep appointment management actions such as Edit, Archive, and Delete in a secondary three-dot menu.
- Delete is user-facing deletion but implementation should be soft-delete/hide, not physical removal.
- Practice/location name opens a lightweight location details bottom sheet with provider, address, phone, and actions such as Maps and Call only when there is a map-openable address. The pin/location affordance and Maps action should mean CarePland has enough confidence to open the address in Google Maps, not merely that a practice/location name or address-like string exists.
- Calendar icon belongs near the appointment date/time, unboxed.
- Appointment card content should read in workflow order: Reason first, CarePrep second, Visit Notes and post-visit note content third.
- Takeaways and Follow-ups belong with Visit Notes after CarePrep.
- Do not show empty Takeaways or Follow-ups regions on Upcoming appointments; those are post-visit notes surfaces.
- Hide CarePrep entirely on Logged and Archived views; it is pre-visit preparation and should not invite comparison against completed appointment notes.
- Logged and Archived views should allow only one expanded Visit Notes panel at a time; opening one appointment's Visit Notes minimizes the others.
- Expanded Visit Notes on Logged and Archived uses the same blue-shell/white-interior pattern as CarePrep, with summary, takeaways, and follow-ups grouped inside the white interior.
- CarePrep should behave like an expandable sibling to Visit Notes: a soft-blue `CarePrep` button triggers generation when no prep exists, then opens the generated panel.
- While generating, show an amber `Generating...` message near the CarePrep button until the generated panel appears.
- Expanded CarePrep uses a blue header/border shell with content grouped inside a white area; the `CarePrep` title collapses the panel, and Edit appears beside the title as a faint bordered icon button.
- CarePrep draft review actions should protect user edits: unchanged drafts can be accepted as-is, while changed drafts must be saved as an edited version.
- CarePrep draft review and saved CarePrep headers can offer a small Refresh action to generate a new draft instead of encouraging discard. Refresh frequency/comparison eligibility rules are future backend policy work.

## Home Workflow

Home is the signed-in first surface for CarePland Personal. It should welcome new users, make the next useful action obvious, and surface lightweight continuity reminders without feeling like a dashboard.

Current Home direction:

- First-run welcome guidance belongs on Home, not on the Appointments list.
- The first-run welcome page should stay short and philosophical rather than readme-like: `Welcome to CarePland`, `Appointment context, simply.`, a small orientation video, one concise explanation, a compact slideshow of three visual panels, and a compact get-started section.
- Welcome-page visuals can use a few stills from the orientation video as placeholders, but should not become a full storyboard or heavy tutorial.
- The three welcome panels should explain the gap between appointments, context as the missing connection, and the CarePland loop from Visit Notes to CarePrep to future context.
- Welcome panels should appear one at a time in a calm slideshow so the images can be large enough to read without making the page feel dense.
- Primary first-run actions should help users add their first real appointment or import appointment details they already have.
- While the first-run welcome guide is active, hide top-level Appointments/Profile navigation and right-side header utilities such as Ask/account indicators so the user is guided toward the welcome page's get-started actions instead of leaving through ambiguous header links.
- The welcome page can include a simple `Need help?` link near the bottom that opens the Ask/help panel directly; do not point users to a hidden top-right help control while welcome header utilities are suppressed.
- Demo data should be offered as clearly labeled examples to explore, not as a required setup step.
- Demo-data copy should reassure users that examples are fictional/clearly labeled and removable without affecting real appointments.
- Regular user-facing Home, Appointments, and Profile pages should include a tiny soft-gray footer with centered `© 2026 CarePland` and a subtle `Why CarePland` pill on the right that opens the welcome explanation. Keep it off the welcome page itself.
- For admins viewing user-facing pages, show build metadata quietly on the left side of the same footer rather than as a separate patient-facing footer block.
- Welcome dismissal is database-backed on `profiles` with `welcome_guide_dismissed_at` and `welcome_guide_dismissed_version`, not browser-local storage. Reset by clearing the fields or bumping the app's current welcome version. Deliberate clicks away from Welcome, including get-started actions, mark it read; closing the browser/window without action should leave it unread.
- The last-appointment notes reminder should stay gentle and compact on Home.
- The next appointment and CarePrep preview should remain the main recurring Home utility after setup.
- The Home next-appointment panel should share the Appointments page visual language: appointment title/details at the top, a direct `Add Notes` entry point using the Visit Notes flow, and CarePrep presented as calm inline content rather than a blue AI-styled module.
- Home `Next appointment` is schedule-based, not notes-status-based. Adding notes from Home should not immediately remove or advance the next-appointment card just because the appointment now has Visit Notes; it should remain visible through the current day unless future scheduling logic is explicitly revised. Keep any separate notes reminder as a fallback for past unnoted appointments, not as the primary Home action when it duplicates the next appointment.
- The broad Home `Get more context` panel has been removed. High-level Home/context questions should go through the top-level Ask panel; localized `Get more context` inputs may remain inside specific story/item surfaces such as Health Story.
- Home CarePrep starts collapsed by default; clicking its `CarePrep` header expands or collapses the preview.
- The Home next-appointment panel should not show a manual CarePrep refresh/generate icon. Manual generation and refresh remain appointment-card workflows.
- If the Home next appointment has no current/draft CarePrep and appears to be medical or veterinary, Home may automatically prepare CarePrep once for that appointment when the page appears. Eligible appointment signals include primary care, specialists, cardiology, orthopedics, therapy, dental, vision, hearing, imaging, labs, veterinary, hospital, and clinic context. Ineligible non-care categories include tax, legal, financial, haircut, car service, and generic Other.
- Future `CarePland at a Glance` summaries should be occasional, dismissible reflections on real-world outcomes CarePland helped support, not analytics dashboards, permanent Home widgets, engagement reports, or gamification. They should appear infrequently, never interrupt urgent tasks, use only real data, and emphasize quiet outcomes such as appointments not missed, reminders acknowledged, provider recommendations becoming Health Stories, family messages heard, CarePrep readiness, Today's Focus completion, errands completed by Care Team members, assignment changes handled cleanly, notes connected to the correct appointment, or the household staying in sync. Avoid vanity/software metrics such as app opens, clicks, generated-summary counts, engagement percentages, streaks, badges, or celebratory effects. Long term, this feature should measure invisible value: unnecessary phone calls, duplicated effort, forgotten appointments, searching for information, or confusion about ownership that was avoided because CarePland kept context organized. Conservative optional estimates are allowed, but must be clearly labeled as estimates, for example `Estimated coordination avoided: about 12 phone calls or text conversations` or `Estimated time saved: approximately 30-50 minutes`; do not exaggerate or turn estimates into marketing claims.
- The north star for `CarePland at a Glance` is: CarePland should measure the work the user no longer had to do because the platform quietly handled it. Prefer outcome language over feature/count language. Say `Through CarePland, you had appointment context before 6 appointments`, `CarePrep identified follow-up questions before your visits`, or `CarePland organized appointment information before you needed it`, not `6 appointments tracked`, `8 Health Stories available`, or `5 Today's Focus items available`. As the platform matures, include outcome/avoided-work summaries from Appointments, Import Anything, CarePrep, Connect, Family, Errands, Daily Focus, Health Stories, reminders, Receiver, and recommendations.
- `CarePland at a Glance` depends on three distinct tracking layers. Layer 1 is Facts: immutable things that happened, such as appointment created, reminder acknowledged, voice message played, Today's Focus completed, or Health Story approved. Layer 2 is CarePland work: what CarePland actually did or coordinated, such as connecting five appointments into one Health Story, preparing CarePrep before a visit, identifying a recurring recommendation, detecting duplicate information, reassigning an errand after a conflict, or finding supporting evidence from multiple providers. This is the missing bridge and should be recorded as CarePland activity, not user activity. Layer 3 is Human outcomes: what people value, such as arriving prepared, every reminder being acknowledged, nobody needing to figure out who was picking up the prescription, or the household staying in sync. At a Glance should mostly show Layer 3, but it cannot honestly say CarePland quietly handled something unless Layer 2 recorded that CarePland actually handled it.
- Avoided-effort estimates require robust source tracking: each future task/process should record what CarePland actually did or coordinated, with enough structured context to later map that completed work to conservative avoided-effort assumptions. The avoided effort can be calculated later, but only if the underlying handled-work signal is captured at the time. Prefer durable, source-traceable CarePland-work events over retroactive guesses. The Layer 2 foundation is `carepland_work_events`, documented in `docs/CAREPLAND_WORK_EVENTS_FOUNDATION.md` and `supabase/sql/2026-07-02_carepland_work_events_foundation.sql`; initial backend writes are intentionally narrow: CarePrep generation records `careprep_prepared`, and Health Topic extraction from Visit Notes records `health_story_connected`. The design philosophy is trusted infrastructure: CarePland should occasionally make quiet successes visible without seeking attention, helping users feel that things were a little easier than they would have been otherwise. As Appointments, Connect, Family, Errands, Daily Focus, Health Stories, reminders, and related workflows mature, they should naturally contribute source-traceable summary signals so `CarePland at a Glance` becomes a holistic household reflection rather than a single-feature report. The normal experience should be a small read-and-dismiss summary card with a subtle `More...` path into a longer historical household summary such as `Past 30 Days` and `This Year`; the expanded view should feel like personal household history, not product analytics. Initial Home implementation may expose an Admin-only checkbox to preview a test version using available Home context; that checkbox is a testing affordance, not final user-facing behavior.
- Home automatic CarePrep is available to all users regardless of tier and does not consume `careprep_manual` or `careprep_auto` metered usage. It should still use the normal CarePrep data model, prompt, draft review path, and existing refresh guard, and should avoid repeated attempts on every login or return to Home.

## Notes Workflow

Notes capture what happened during or after an appointment.

Supported flows:

- Type notes manually.
- Paste/import notes into a specific appointment.
- Extract image text and interpret into notes.
- Save interpreted notes after review.
- Edit notes later; edits create versions.

Rules:

- Notes are versioned.
- Blank overwrites should be blocked.
- The current note reference lives on the appointment.
- AI-generated drafts and user-saved/edited results should be distinguishable.
- For a last-appointment notes prompt, prefer a gentle Home reminder such as `Add notes to: [appointment]` that opens the interpreted notes flow.

## CarePrep Workflow Definitions

CarePrep is guidance for a future appointment. It uses appointment details and saved context to help the user prepare.

CarePrep content currently includes:

- Summary / highlights.
- Bring list.
- Questions to ask.
- Watchouts.
- Medication review.
- Since-last-visit context.
- Next steps when available.

Rules:

- CarePrep generation uses stored AI instruction versions.
- CarePrep output is versioned.
- A generated draft can be reviewed, accepted, edited into a user version, or discarded.
- User edits are preserved separately from original AI output.
- Current CarePrep is tracked.
- Prior CarePrep versions remain available for analysis.
- CarePrep generation records prompt/instruction references and input snapshots.
- CarePrep should feel like helpful guidance, not a system module.

## Import, OCR, And Document Processing

Import supports:

- Pasted appointment details.
- Pasted visit notes.
- Up to 10 uploaded images for image-to-text extraction.
- One `.ics`/iCal calendar file at a time for initial rollout.

Rules:

- Imported appointment items must be reviewed before saving.
- Calendar import should include select-all behavior when showing imported appointment drafts.
- Import state should reset when leaving/restarting import.
- Upload/import status should appear near the file chooser and disappear when processing finishes.
- Extracted text is not intended to store raw image files.
- Image extraction converts images to text for downstream interpretation.

Future plans:

- Broader calendar integrations may be considered later.
- Google Calendar OAuth or other provider sync is not currently implemented.

## Google Places And Favorite Locations

Google Places is used for address/business autocomplete.

Current behavior:

- Users can search for clinics/businesses/addresses.
- A selected place can populate appointment provider/practice/address fields.
- Users can save favorite locations.
- Favorite locations can have nicknames.
- If no nickname is entered, use the practice/place name.
- Nicknames can reduce visual clutter in appointment display.
- Favorite locations are per user/care circle rather than global shared records.
- A plain Google Maps search link does not require a Google Maps API key. API-backed validation/geocoding/embedded maps do.
- Until address validation is first-class, suppress Maps actions for sample data and obvious placeholder addresses. Future implementation should store validated address/place confidence separately instead of inferring validity from free-text address strings.

Operational behavior:

- Google Places failures should show a gentle user-facing message, for example: "Looks like autocomplete for addresses isn't available right now. We'll look into it."
- Integration errors are summarized for Admin rather than exposing raw API failures to users.
- Quota/rate errors should be tracked at aggregate level: time window, error key, occurrence count, affected users, and max attempted call count when known.

## AI Generation Workflows

Current AI workflows include:

- CarePrep generation.
- Note intake interpretation.
- Appointment import interpretation.
- OCR/image-to-text support.
- Support assistant answers.
- Support assistant answer QA analysis.

AI instruction management:

- Admin AI prompt manager exists.
- Prompt versions are archived, reversible, and hashable.
- Reverting creates a new current version rather than deleting history.
- Prompt exports live under `ai-prompts/`.
- `Ask user response rubric` is an Admin-visible AI prompt/instruction set. It is the global response philosophy for Ask modules that write user-facing text.

Agent knowledge:

- Admin AI area includes Agent Knowledge content for product facts, known limitations, and escalation guidance.
- Agent Knowledge also includes voice/tone guidance so the support assistant stays warm, steady, practical, empathetic without pretending intimacy, supportive without being syrupy, and clear about limits without sounding cold.
- The support assistant injects current Agent Knowledge into its context.
- Agent Knowledge should be updated when product capabilities change to prevent context drift.
- Agent Knowledge includes Early Access plan tier facts, CarePrep metering context, and the limitation that self-service billing/plan changes are not wired up yet.
- Ask includes a dedicated onboarding helper module/prompt for low-risk getting-started questions. It covers profile basics, Early Access acknowledgements, Care Circle setup, the Home welcome guide, focused first actions, demo examples, and when account-specific onboarding blockers should be escalated. Keep onboarding-specific assistant behavior in this module rather than bloating the general Ask router or support assistant prompt.
- When a user expresses confusion on the welcome/onboarding experience, the onboarding helper should respond with gentle orientation rather than procedural troubleshooting: reassure them, restate the appointment-context idea, name examples such as what changed, what mattered, and what to ask next, and point them toward adding or importing a first appointment.
- The onboarding helper is also available from profile setup. It should explain that profile requirements depend on auth source: Google/Apple-style OAuth should keep extra contact/profile fields optional unless the UI marks them otherwise, while email/password or email-update setup may require basic account/contact fields such as first and last name, phone, time zone, and ZIP for dates, account recovery, and support follow-up. Keep this from sounding like a medical intake form.
- Agent Knowledge should evolve toward a proposal-based lifecycle: automated or manual checks can propose changes with justifications, source evidence, confidence, and risk category; Admin should approve, edit, reject, defer, or publish those changes.
- Agent Knowledge proposals should preserve the original current text, AI-proposed text, and Admin-final text when edited. Admin edits are first-class QA signal and should not overwrite the original proposal trail.
- Rollbacks should be granular where possible by Agent Knowledge block/entry and should create new current versions rather than deleting history.
- User feedback on support assistant answer quality should feed knowledge-gap detection, proposal generation, and regression-test candidates. User feedback should not directly rewrite Agent Knowledge without review.
- Agent Knowledge proposal generation should have Admin-controlled settings. Background auto-generation, software-update-triggered checks, scheduled checks, feedback clustering, and severity/quantity thresholds should be individually configurable.
- Background auto-generation should have a configurable period in days so Admin can control how often unattended checks are queued.
- Software-update-triggered checks should be easy to disable temporarily when Admin is doing many rapid implementation passes.
- Feedback clustering should group similar answer-quality issues and may push a proposal automatically only when configured thresholds are met, such as repeated not-helpful feedback, Admin review flags, severity category, or a time-window threshold.
- Manual Agent Knowledge checks should always be available from Admin AI regardless of background automation settings.

AI user-facing principle:

- Do not describe features as AI-generated unless that matters for consent/review.
- Position the app as helping users organize and remember, not as replacing judgment or providing medical advice.

## Support And Admin Architecture

Support:

- Users can ask support questions in the app.
- The support assistant can answer basic app-use questions before escalation.
- Users can mark answers helpful/not helpful and submit feedback.
- Support assistant interactions are stored for review.
- Admin can review support tickets and assistant answers.
- Support ticket messages support user/admin/internal-note roles.
- Ask is the planned unified user-facing entry point for questions, ideas, workflow feedback, bugs, confusing moments, and things that may need review. It should feel like open dialogue, not a ticketing system.
- Ask should use a centralized intake architecture: conversation threads/messages first, then an intake submission snapshot with transcript, AI summary, routing recommendation, confidence, rationale, risk flags, and recommended downstream actions.
- Ask should be modular. The router/classifier should not become one giant prompt. Separate dynamic instruction paths should exist for routing, clarification, feature/workflow interpretation, bug/friction interpretation, off-topic handling, and the existing support assistant.
- Ask runtime now uses a router-first pattern with optional downstream module passes. When the router recommends clarification, The Clarifier module decides whether one more question is actually useful or whether the item should be summarized for review. Feature/workflow and bug/friction routes can be enriched by their own AI instruction sets and schemas before Admin review, producing structured recommended actions while preserving the original conversation snapshot. The off-topic handler is a bounded fallback module: it may briefly redirect harmless out-of-scope messages, but risky off-topic content should be sent to review rather than closed casually.
- Ask onboarding/help questions can be handled by the dedicated onboarding helper after routing. The router should stay broad and the onboarding helper should own low-risk getting-started answers plus escalation recommendations for account-specific onboarding blockers.
- AI workflows should use the shared operation-cost logging pattern where practical: capture provider, model, prompt/workflow key, usage tokens, pricing snapshot, estimated cost, and source record link. Admin cost summaries should stay admin-only, summarize by operation type/model, and be treated as estimates. Pricing snapshots must be revisited when provider pricing changes.
- Ask AI behavior should not deny that it is AI or pretend to be human, but AI framing should stay in the background unless the user asks or it matters for consent, review, or trust.
- Ask user-facing module responses should avoid first-person assistant language such as `I`, `me`, `my`, `we`, `we're`, `we've`, and `we'll` whenever practical. Use neutral routing language such as `This will be raised for review`, `This may need a closer look`, or `A little more detail would help route this correctly` so Ask does not sound like a human agent.
- If a user asks what Ask is, it can say it is an AI assistant designed to help route questions, feedback, and ideas throughout CarePland, and that it is not a replacement for real people; phrase this neutrally rather than as the assistant speaking personally.
- Ask user-facing descriptive text should be editable through Admin > Dynamic Text / message catalog wherever practical. Treat hardcoded Ask panel guidance, acknowledgements, and explanatory copy as a smell; prompt Andrew to decide whether new Ask copy belongs in Dynamic Text if he forgets.
- Ask routing settings such as auto-route enablement, auto-create confidence threshold, default clarification turns, and absolute clarification turns are database-backed and editable from `Support > Ask - Review`.
- Ask should prevent obvious duplicate submissions of the same question/request. Duplicate handling should feel reassuring rather than punitive, using an editable acknowledgement such as `Thanks — we got your question!`.
- Ask can ask useful clarifying questions when the answer materially improves routing, troubleshooting, or Admin usefulness. Clarifying questions should be brief, conversational, and forgiving, especially for likely typos or near-matches. Avoid formal interrogation phrasing such as `Could you please clarify what you mean by...` when a warmer phrasing such as `Just to make sure I understand — did you mean...` would work. Do not use endless questioning; configurable limits and stop reasons should be tracked.
- Ask routed outputs should be cross-referenceable. Raw intake, support tickets, bugs, wishlist items, assistant-review records, and future destinations should be linked rather than collapsed into one generic object.
- `Support > Ask - Review` should show active related-item links for each Ask submission, including support tickets and Product Management items created from that intake, so Ask remains the source hub rather than a dead-end review record. Downstream support tickets and Product Management items created from Ask should also expose a simple link back to the source Ask review item.
- Ask auto-routing should be conservative. High-confidence low-risk items may eventually auto-create downstream records, but user-submitted ideas must not become public or committed roadmap items without Admin review.
- Incorrect auto-routes should be rolled back by status/link retraction and audit trail, not physical deletion, so model quality can be analyzed later.
- Ask recommendation decisions are product-learning data, not just admin workflow bookkeeping. When Admin accepts, rejects, or overrides an AI routing/action recommendation, store that decision with the original recommendation, category, confidence, rationale, target record, and admin note where available. Future Ask/model improvement should use these records to understand agreement rates, tune confidence thresholds, identify weak categories, improve modular prompts, and decide when any auto-routing is trustworthy enough to expand.
- Ask support-question outcomes should be explicitly reviewable. Admin can accept an answered Ask conversation as resolved/closed, create a linked support ticket when human follow-up is needed, or reject/override the recommendation. These choices should feed the same recommendation-decision trail used for future model-quality analysis.
- Ask review UX should be decision-first. Show a concise plain-language recommended action before raw evidence. Keep verbose details such as raw recommendation JSON, transcript, safety flags, router rationale, and manual review notes separately expandable, with an Expand all / Collapse all control for deep review.
- Ask prompt/module evaluation should be available to Admin as a non-destructive Ask Module Lab inside `Support > Ask - Review`: Admin can paste multiple test questions, choose one modular Ask path, and review compact summaries, confidence, quality notes, and raw structured output without creating Ask submissions, support tickets, bugs, or wishlist items. These lab calls should log estimated AI cost by module so prompt tuning can be evaluated operationally.
- The browser-readable running notes for Ask explanation and validation live at `docs/CAREPLAND_ASK_SYSTEM_RUNNING_NOTES.html`. Keep that document practical and review-oriented; keep stable architectural commitments in this stable context file.

Admin:

- Admin top-level tabs include Dashboard, Tools, Users, System, and Support. Users contains User Activity, Early Access Intake, and Audit Trail. Audit Trail is a read-only list for audited admin user-view/contact-access events and should stay near the user support workflow. System contains Errors, Dynamic Text, AI Prompts, and Product Management. Support contains `Ask - Review` and Tickets. `Ask - Review` is the primary review surface for Ask intake submissions and may also retain older support-assistant answer review streams during the transition. Do not add a separate top-level Messages tab; short messages belong in Dynamic Text.
- Admin Early Access Intake stores interested people/prospects separately from Supabase auth users. Intake records should capture name, email, optional phone, relationship to care, communication preference, read-only consent status, `What interests you about CarePland?`, source, status, last contacted timestamp, and admin notes.
- Early Access intake is the staging area for follow-up before account creation. Do not create placeholder auth accounts merely to track interest.
- Future individual/group communication workflows should build from Early Access intake records and communication preferences rather than ad hoc email threads.
- Admin header/ticket indicators should show actionable counts with words, e.g. `New` and `Followup`, not mystery fractions.
- Admin navigation uses durable per-admin freshness state for breadcrumb-style attention indicators only for operational/admin-response queues. Red means new/unseen by that admin and takes priority over yellow. Yellow means known but still needs follow-up/action. These indicators should apply to things that require an admin response, such as system/integration errors, user-reported support tickets, Early Access intake follow-up, assistant-review items, and reviewable AI proposals. They should not light up for admin-authored backlog/content surfaces such as Product Mgmt lanes/items, Dynamic Text edits, prompt/version history, wishlist entries, bugs entered by the admin, or other internal notes that are better summarized later by Admin HQ/dashboard tooling.
- Hard development gate: Admin Dashboard/Admin HQ should remain a read-only operational landing area until real operational data creates a concrete repeated need. Current approved dashboard surfaces are attention-signal counts, the placeholder/link to the Admin HQ prioritization prompt, and the basic admin-only AI operation cost summary. Future chats must explicitly gate-check Andrew before implementing smarter Dashboard/Admin HQ behavior, including AI prioritization, richer summaries, stale engagement scoring, new alert layers, additional dashboard cards, ranking logic, or automation. Allowed without re-approval: fixing broken navigation, reducing existing UI noise, preserving current breadcrumb behavior, maintaining the approved prompt link, and maintaining the approved AI cost summary. Not allowed without a concrete real-world signal and explicit approval in that chat: expanding the dashboard because it seems useful, imaginative, or likely needed later.
- Admin tools may be denser than patient-facing pages.
- Admin pages may use wider layouts than user-facing pages.
- Admin-only Auth maintenance that touches `auth.users`, such as updating a tester's login email, must run through protected server routes using `SUPABASE_SERVICE_ROLE_KEY`; never expose service-role keys or Auth admin operations to browser/client code.
- Admin Tools includes operational settings such as session idle timeouts. Keep these controls plain and scoped; use SQL-backed settings plus admin RPCs for values that should survive deploys.
- Admin Users / Activity supports a read-only `View as user` workflow for test-account pre-flight and troubleshooting. It is not auth impersonation and should not create a Supabase session as the target user.
- Admin Users / Activity rows can include lightweight operational helpers such as sortable column headers, a `User Group` column, and an expandable `View VIPs` row detail with Care VIP name pills. `User Group` should identify the Care Circle/account owner so users can be visually grouped by household/family-style account context; it should not mean pricing tier. These are admin metadata/navigation aids and should not reveal sensitive appointment, Notes, or CarePrep content.
- Admin table sorting should become a reusable UI pattern. The default implementation should be client-side sorting for already-loaded Admin datasets: each sortable header is a button, clicking the same header toggles ascending/descending, clicking a different header applies that column's sensible default direction, and the active sort indicator is visible in the header. Prefer a small shared helper/component once at least two Admin tables need this behavior, e.g. `SortableHeader`, sort-state type, and value-accessor sort utility. Use server-side sorting only when result sets become too large, paginated, or expensive to fully load.
- Candidate places for the reusable sorting pattern include Users / Activity, Early Access Intake, support tickets, assistant review queues, integration error summaries, and future Admin audit/access-history views. Sorting should remain an Admin/workbench affordance unless a patient-facing table clearly needs it.
- Recent modularization direction: extract components when they have a clean boundary and reduce the size of `app/page.tsx` without forcing a huge prop bundle. Good examples are Admin contact reveal/edit panels, toolbar-like controls, sortable table headers, and small repeated admin cards. Avoid extracting deeply coupled appointment/body workflows until their state and actions can move cleanly with them.
- Admin access to user data should be intentional and justified, including owner/admin access by Andrew. Sensitive access should require a short purpose/justification before reveal whenever practical.
- Read-only admin user views should default to metadata and account/workflow shape. Sensitive profile/contact details, full appointment titles, appointment times, full provider/practice/location details, appointment details, Notes, CarePrep bodies, support message bodies, imported text, and extracted content should stay hidden until deliberately revealed. Appointment previews may show dates plus short prefixes of title/provider/practice/location so the view remains operationally useful without exposing full details.
- Non-sensitive appointment metadata such as created/updated timestamps, short record IDs, Care VIP assignment, note/CarePrep presence, and draft/current state can be shown in Admin read-only views to support import QA and troubleshooting.
- Admin user contact detail review/editing should visually resemble the user-facing Profile > Contact Details form, but it must remain inside the audited Admin user view rather than true impersonation. Revealing full contact values and saving changes require explicit admin justification and audit acknowledgement.
- Sensitive reveals should be backed by admin-scoped RPCs and audit events, not by simply hiding already-loaded sensitive content in the browser.
- Admin access requests/events should be designed so they can later power a user-visible access history. User-facing history should be calm and understandable, e.g. who accessed which broad category, when, and why, without exposing internal implementation details.
- Admin access is beginning to move from a single `is_admin` flag toward extensible permission scopes for future staff roles. `is_admin` remains the current owner/admin compatibility flag.

## Privacy And Trust Posture

CarePland should treat privacy as part of the product experience, not only as a legal page. The trust angle is grounded in Andrew's PeopleSoft, Student Records, FERPA, and compliance background: operational access can be necessary, but it should be purposeful, limited, documented, and reviewable. That philosophy should carry into user-facing explanations later: CarePland asks people to store sensitive appointment context, so the app should show that access is handled with care.

Current implementation principles:

- User data is borrowed context for helping the user, not casually available operational raw material.
- Admin views should start with redacted or summarized information whenever that is enough for troubleshooting.
- Contact details are hidden by default in Admin `View as user`. Revealing full contact details requires a written justification before the data is returned.
- Updating contact details requires a separate written justification before saving. Viewing and saving are separate audit events; taking a peek is not invisible.
- Contact detail updates run through a protected server route using the Supabase service role key. Service-role operations must never run in browser/client code.
- Contact audit metadata should record broad fields viewed or changed, actor, target user, timestamp, reason, and redacted before/after summaries. Avoid casually displaying full old/new sensitive values in audit surfaces.
- Sensitive appointment, Notes, and CarePrep content should follow the same general reveal-and-audit pattern as contact details, even when the exact UI differs.
- Future public trust copy can say, in plain language, that CarePland limits admin visibility by default, requires a reason to reveal sensitive account details, and keeps an access trail for accountability.

Email notifications:

- Support reply notifications use email.
- Global email enable/disable toggle exists conceptually/administratively.
- `noreply@carepland.com` is the intended sender spelling.
- SMS/Twilio is future work and cost-sensitive.

## Dynamic Content And Messaging

Dynamic content admin exists for app text that may change, including:

- Early Access/legal acknowledgement text.
- Support assistant copy.
- Support email content.
- Onboarding/welcome text.
- Short workflow messages, including the manual CarePrep plan-limit message.
- Plan feature wording shown in the Profile current-plan helper and future billing surfaces.
- AI Agent knowledge.

Rules:

- Prefer dynamic content for wording likely to evolve during Early Access.
- Preserve version history.
- Reverting content should create a new current version.
- Keep user-facing messages calm and practical.
- The Profile plan `?` helper should describe the current plan's actual included features in very brief phrases, not compare all tiers or act as marketing copy. Each plan has one whole editable Dynamic Text block under the Plans category so Admin can review and edit the panel visually without hunting individual lines. The first line is the summary; following lines may use `Label: value`. It may reserve a quiet placeholder for a future plan-change link.
- In Admin sessions, the Profile plan panel's Change Plan control may act as a local preview selector for validating plan Dynamic Text. This must not update entitlements, billing state, metering state, or user data.
- In Admin sessions, the Profile Care VIPs panel may include a small local allowance preview selector beside the counter. This is only for visual validation of Care VIP limit states and must not update the real entitlement or create additional permissions.

## Public Website And Domain Positioning

CarePland has a public website/front door separate from the signed-in app experience, hosted inside the same Next.js/Vercel project as the app.

Current website direction:

- `carepland.com` / `www.carepland.com` should present the public marketing/Early Access site.
- `app.carepland.com` should bypass the public website for signed-out visitors and open the app sign-in/auth gateway directly.
- The signed-in app remains in the same Vercel project and is reachable from the public homepage through the Sign in/Open app path; signed-in users should continue into the app shell.
- Use one coordinated deployment so public website assets, Early Access intake, and app/admin surfaces stay aligned.
- The public website should route primary top-level calls to action toward Early Access signup rather than directly into the app during Early Access.
- Early Access signup should write consented prospect records into `early_access_intake` with `source = public_website`; Admin remains the review/follow-up surface.
- The public website should be calm, patient-centered, and concrete rather than startup-generic.
- Basic public Privacy Policy and Terms of Service pages live at `/privacy` and `/terms`; they should stay conservative, plain-language, and aligned with the data dignity/admin-audit and Early Access/not-medical-advice posture until formal legal review replaces them.

Core public positioning:

- `Complete the appointment loop.`
- CarePland helps people and loved ones bring the context that matters to the next visit.
- CarePland turns past visits, notes, and care history into actionable preparation for the next appointment.
- Healthcare asks patients to be active participants, but most tools are built around providers and systems. CarePland is purpose-built for patients and caregivers in the space between appointments.
- CarePland helps people arrive prepared to collaborate with their clinician; avoid framing the product as replacing or competing with the doctor.

Website content assumptions:

- Narrative order: identify the problem, show the cause, offer the answer.
- Public section sequence should be: hero/appointment-loop preview, gap-between-appointments video section, continuity-breakdown panels, patient-tools asymmetry, care-history-to-appointment-readiness, trust/data-dignity explanation, Early Access signup.
- Keep CP Pers out of the initial public website narrative unless it becomes necessary later; the current homepage should avoid internal feature jargon.
- Public trust copy should be plain-language and reviewable before publication. It can connect CarePland's privacy posture to Andrew's higher-ed systems, FERPA, auditing, data-security background, National Student Clearinghouse enrollment reporting, NSLDS data-integrity verification, and Title IV financial-aid enrollment data stewardship, but it should avoid legal/compliance overclaims and should not imply formal HIPAA certification or complete legal-policy coverage.
- Public trust copy should emphasize data dignity, limited admin visibility by default, purposeful sensitive access, written reasons where practical, and reviewable audit trails.
- Public pricing/tier explanation can live on the website; draft website copy is preserved in `docs/CAREPLAND_PRICING_TIERS_WEBSITE_COPY.md`.

Future website editing options to consider only if manual edits start consuming too much implementation time or credits:

- First preference: move public website copy, slide captions, CTA text, and alt text into a small repo-owned content file so edits remain lightweight while Vercel/GitHub stay the source of truth.
- Second preference: evaluate a Git-backed CMS such as TinaCMS or Decap CMS if Andrew needs a browser-based editing surface that still commits content changes back to the repo.
- Later/only if clearly needed: evaluate a visual builder such as Builder.io or Plasmic for layout-level editing. Avoid reintroducing a separate Weebly-style website stack unless there is a strong reason.
- Pricing can be added to the public website later, but the initial homepage should stay focused on the appointment-loop narrative and Early Access intake.
- A future demo video should be embedded from a video platform or CDN rather than stored as a large file in the website repo/deployment.
- The circular hands/heart mark can be used as the public logo direction because it better implies the appointment loop than the rounded-square variant.
- Public website accessibility requirements include descriptive alt text for the three continuity panels, iframe title text for the orientation video, visible keyboard focus, form labels beyond placeholder text, and WCAG AA contrast for text.

## Technical Stack And Architecture

Current stack:

- Next.js App Router.
- React client-heavy signed-in app in `app/page.tsx`.
- Public website component in `app/components/PublicWebsite.tsx`, rendered for signed-out visitors from the root route.
- Supabase for auth, database, RLS, RPCs, storage of prompt/content/support/admin data.
- Vercel for deployment.
- OpenAI APIs for AI workflows.
- Google Places API for address/place lookup.
- SendGrid/email provider for support notifications.

Important files:

- Main app: `app/page.tsx`
- Public website/front door: `app/components/PublicWebsite.tsx`
- Public Early Access API: `app/api/early-access/route.ts`
- Components: `app/components/`
- API routes: `app/api/`
- Places helpers: `app/lib/places`
- Prompt exports: `ai-prompts/`
- SQL patches: `supabase/sql/`

Current architecture reality:

- `app/page.tsx` remains large and stateful.
- Refactor gradually.
- Extract small components when the boundary is clean and reduces complexity.
- Avoid extracting large stateful appointment cards prematurely if it creates a giant prop bundle.
- Good extraction candidates are low-coupling UI controls such as badges, toolbars, and display-only sections.

## Supabase, SQL, And Data Assumptions

Supabase is used for:

- Authentication.
- Profiles.
- Care circles and Care VIPs.
- Appointments.
- Appointment notes and note versions.
- CarePrep guidance and history.
- AI instruction sets and versions.
- Dynamic app content versions.
- Product management items.
- Support tickets/messages.
- Support assistant interaction storage and admin reviews.
- Integration error summaries.
- Plan feature definitions and Care Circle feature usage counters.
- Early Access intake/prospect records.
- Public website Early Access submissions use anonymous insert-only access into `early_access_intake`; Admin read/update remains authenticated/admin-only.

SQL rules:

- Reusable schema/RPC/admin patches should live in `supabase/sql/`.
- One-off maintenance SQL can be provided inline when appropriate.
- Prefer RLS-aware RPCs for admin/user operations.
- Do not make sensitive admin toggles too easy in the UI when accidental activation would be risky.

## Authentication And MFA Assumptions

Current auth:

- Supabase email/password.
- Supabase Google OAuth is available from the signed-out auth gateway as `Continue with Google`; it uses the same profile setup, Early Access acknowledgement, onboarding, Care Circle, and idle-timeout behavior after session creation.
- Profile setup should be lighter for OAuth accounts than email/password accounts. Authenticated OAuth email is enough to proceed; name, phone, ZIP, and similar contact details should be optional unless a future workflow genuinely requires them. Email/password and imported email-update flows can still require a small set of basics.
- Profile/contact inputs should include browser/mobile-friendly hints such as `autoComplete`, `inputMode`, and semantic input types where appropriate. This reduces user friction on mobile and helps password/account managers without changing business rules.
- Browser time zone detection should fall back to a supported app time zone rather than leaving required setup users with an unexplained blank `Time zone is required` state.
- Email confirmation.
- Password reset/update password flow.
- Profile setup after signup.
- Required profile basics include name, phone, ZIP, and time zone.
- Supabase signup confirmation and password-reset links must resolve to `https://app.carepland.com`, not `carepland.com` / `www.carepland.com` or the Vercel deployment URL. The public domains are the website/front door; auth handoff belongs in the app.
- OAuth redirect links must also resolve to the app auth handoff and include an explicit `auth_action=google_sign_in` marker so the app does not confuse OAuth authorization-code redirects with email-confirmation redirects.
- Browser sessions are persisted through Supabase, but CarePland adds an app-level idle timeout. Session timeout settings live in `app_session_settings` and are editable in Admin > Tools. Default behavior is 24 hours of no browser activity for normal users and no timeout for admins. A null timeout means no automatic sign-out for that role.

MFA:

- Full MFA/2FA is not implemented.
- Twilio/SMS was used in the older Adalo implementation but is not currently part of core auth.
- SMS/text notifications are future work due to cost and operational complexity.

## Deployment And Environment Notes

Deployment:

- Vercel hosts the app.
- `app.carepland.com` is production/live for the app login and signed-in app experience.
- `carepland.com` / `www.carepland.com` host the public website/front door.
- Vercel preview deployments are useful for beta testing.
- Environment indicators such as `DEV`/`Preview` are useful outside production.
- Production custom domain should not show preview/dev status.

Build/admin context:

- Admin pages show build context at the bottom.
- Example: build number/hash and build datetime.
- This helps Andrew distinguish deployed context during testing.
- Build datetime should not be hardcoded in app UI. The build command generates `app/build-info.ts` via `scripts/write-build-info.mjs` so Version info can show the current build timestamp when no explicit `NEXT_PUBLIC_CAREPLAND_BUILD_DTTM` is supplied. Preserve this generated-build-info pattern in future iterations unless replacing it with an equivalent deployment metadata source.

## UX Principles And Design Philosophy

Patient-facing UX:

- Calm, clear, and low-cognitive-load.
- Less clinical, less bordered, less system-y.
- Avoid repeated button clusters.
- Avoid admin energy bleeding into patient-facing pages.
- Prefer spacing, typography, and hierarchy over many bordered boxes.
- Keep primary next action obvious.
- A fundamental CarePland design precept is: `Here are the things we can do here.` Each surface should make the locally available actions legible without turning the page into a control panel. The user should not have to infer what is possible, hunt for hidden workflow paths, or decode system structure; CarePland should calmly present the useful things that can be done in the current context.
- CarePland uses AI to make better decisions, not more complicated interfaces. The goal is not to recreate the past; it is to recover enduring product virtues such as clarity, permanence, accountability, and purpose, then pair them with modern intelligence that explains itself, adapts thoughtfully, and leaves people in control. Great CarePland tools should feel obvious, dependable, and quiet enough to fade into the background while people focus on what matters.
- Keep secondary actions available but less dominant.
- Hide controls that are not currently useful.
- Patient-facing UI should feel gentle, kind, and human-scale. Avoid "operator cockpit" density unless the user is in an admin or power-review context. Prefer calm grouping, plain language, and a small number of meaningful actions over dense controls, status panels, and configuration-heavy surfaces.
- Treat small UI choices as subconscious directors toward context, calmness, clarity, and continuity. Button shape, color weight, spacing, copy, confirmation behavior, and visual hierarchy should quietly help users understand what matters, feel safe continuing, and avoid accidental loss. These details do not need to announce themselves; they should make the product feel nice to use.
- Avoid confirmation prompts for harmless, reversible actions such as signing out. Use confirmation or warning prompts when an action would discard unsaved user-entered changes, remove user data, or otherwise create meaningful loss.
- Unsaved-change warnings should be based on meaningful current content or meaningful current differences from existing saved records, not merely on an editor being open, field edit history, focus/touched state, or an AI/generated draft object existing. If a user clears a new unsaved note/intake draft back to an empty, non-saveable state, closing should be treated as safe. If a user edits a saved record and then restores the fields to the saved values, closing should also be treated as safe. Clearing fields on an existing saved record can still be meaningful and may warrant a warning when the current values differ from what is saved.
- Dirty-state logic should be standardized before adding more editable surfaces. Each editor should define a canonical saved baseline, a canonical current value, a normalizer for comparison, and a single `hasMeaningfulChanges`-style predicate used by close, tab-switch, sign-out, save-button enablement, and discard warnings. Raw AI intake text, match candidates, generated draft metadata, selected IDs, focus/touched state, and previous edit history are process state; they should not independently trigger unsaved-change warnings when the visible/current saveable fields are empty or match the saved baseline. Text intake match candidates alone are not unsaved work; only visible raw pasted text, visible/saveable intake draft fields, and reviewable bulk import drafts should count. Shared editor-state helpers and intake draft content types live in `app/lib/editorState.ts`; prefer extending that policy layer over adding new inline dirty-state checks or page-local duplicate draft shapes.
- Browser `beforeunload` protection should stay light and use the same aggregate unsaved-change predicate as sign-out. Do not add refresh-specific or process-state-only warnings.
- Patient-facing navigation should not silently discard unsaved drafts. If users move between Home, Appointments, and Profile, preserve meaningful unsaved work so later close/sign-out guards can still detect it; only explicit discard/close actions should clear that state.
- Main-tab navigation warnings should use the same aggregate unsaved-work policy as sign-out, but copy should distinguish preservation from destruction. If switching pages keeps drafts in the browser, describe the work as unfinished/kept for now rather than discarded.
- Onboarding-only gates such as Early Access acknowledgements and profile setup should not render until signed-in profile context has hydrated. Avoid momentary flashes of onboarding screens caused by default/null local state before the profile row has loaded.
- Treat copy fit and line breaks as part of the design system, not incidental cleanup. Patient-facing UI should avoid awkward orphaned words, stranded helping verbs, cramped labels, and accidental wraps when a small wording change, deliberate line break, or modest layout adjustment can make the surface feel calmer and more polished. Single words should generally not wrap alone to a new line, and intentional multi-line word groups should look visually balanced.
- Current patient-facing visual direction favors the refined Home pattern: rounded paper-like containers with soft, diffuse shadows; restrained blue hover/focus states; secondary metadata in lighter WCAG-compliant grey; fewer nested boxes; and spacing that separates workflow phases without turning each phase into a separate module. Use blue for active/decision states, routine focus, and AI-generated user-facing output where practical; reserve amber/rose for true caution/destructive/error states.
- Shared patient-facing button and item-section style constants live in `app/lib/uiStyles.ts`. Prefer extending that shared style layer over adding new page-local button class strings when a pattern is meant to recur.
- AI-generated CarePrep and Visit Notes should share a mellow soft-blue visual language when displayed as saved output. Prefer continuous blue-tinted surfaces with section-level padding and quiet icon utilities over white inset cards or loud command buttons. This helps users recognize organized CarePland-generated material without making the interface feel clinical or system-heavy.
- On Home and Appointments, primary content regions should feel like continuity surfaces, not admin cards. Titles, summaries, and main content can act as calm open targets when that reduces button noise, while map/date/refresh/destructive actions remain distinct.

Admin UX:

- Denser controls are acceptable.
- Admin pages can show more operational detail.
- Admin should support solo-founder operations and reduce the need for external tools.

Responsive rules:

- Minimum supported phone width target: 360px.
- 390-430px is common modern phone.
- 768px is tablet portrait/narrow layout.
- 800px is acceptable bare-minimum desktop/SVGA sanity check.
- 900px is current max width for normal signed-in user-facing pages.
- Admin can keep a wider max width because tables/review panels need room.

Header rules:

- Signed-in header uses compact mark-only CarePland logo.
- Signed-out/login header can use fuller logo/wordmark.
- On initial app load, wait for Supabase session restore before rendering signed-in or public/signed-out content so stale public shells do not flash for signed-in users.
- On narrow screens, Profile and Support are icon-only utility actions on the right.
- `Appointments` should remain spelled out down to narrow widths where feasible.
- Product/environment pills are low priority and can hide first.

## Known Constraints

- `app/page.tsx` is still large and stateful.
- Full family/multi-user permission system is not built.
- Billing-grade plan enforcement is not complete.
- Calendar sync/OAuth is not implemented.
- SMS/Twilio notifications are deferred.
- MFA is not implemented.
- Provider directory and deeper Google Maps integrations are future possibilities.
- Patient-facing appointment page still needs additional calming/polish.
- Some UI states are beta/admin-oriented and may need role-aware suppression later.

## Future Plans

Likely future directions:

- CarePland Family / multi-user care circles.
- More formal role/permission model.
- Better calendar integrations.
- More robust favorite location management.
- Assistant-driven help and product guidance.
- Improved prompt/Agent Knowledge lifecycle.
- Agent Knowledge drift checks triggered by software updates, available manually from Admin, and scheduled as a beta safety net.
- Assistant answer-quality regression checks based on real user questions and Admin-reviewed support assistant interactions.
- Background Agent Knowledge checks should create reviewable proposals, not silently publish changes.
- Broader error monitoring and alerting.
- More formal staging/test data strategy.
- SMS/text notification option when cost/benefit is justified.
- Provider/business lookup improvements.
- More refined Appointments page hierarchy and action grouping.

## Business Rules And Automation Logic

Support notifications:

- Notify users when Admin responds to their support question.
- Keep message simple: user should log in to review.
- Time-suppression logic should exist on email side for future rollout even if current value is effectively zero/no suppression.
- Global email sending toggle should exist.

Early Access intake:

- Intake records are not user accounts.
- Store communication preference and consent/readiness before follow-up.
- Communication consent is not an Admin-editable field. It should be captured directly from the person through signup/intake or a future explicit communication flow.
- Use the prompt `What interests you about CarePland?` rather than asking for private care details in first-contact intake.
- Status should support a simple funnel such as new, reviewing, contacted, interested, invited, converted, not a fit, and closed.

Google Places errors:

- Show gentle user message when unavailable.
- Log aggregate integration errors for Admin.
- Do not expose raw Google API errors to users.

Demo/test users:

- Test-user flag should exist but should not be easy to toggle accidentally.
- SQL/admin maintenance scripts are acceptable for test-user flag changes.
- Imported Adalo/test users may be reviewed through the read-only Admin `View as user` flow before sending login instructions. Use this to confirm onboarding, email-update requirements, Care Circle/Care VIP setup, appointment import shape, and visible account state without changing the user's data.
- Admin user-data access should be audited. Opening a read-only user view and revealing sensitive data should record the acting admin, target user, resource type, optional resource id, permission scope, reason when available, and timestamp.

## Implementation Decision Log

- Use Import instead of Quick Add for user-facing language.
- Keep support chat in-app rather than external Freshdesk/ServiceNow-style exchange for now.
- Prefer email notifications before SMS due to cost and complexity.
- Use `noreply@carepland.com`.
- Use Agent Knowledge in Admin AI section to keep the support assistant current.
- Agent Knowledge updates should be reviewable proposals before publication when they materially affect product behavior, pricing, limitations, support escalation, medical-safety boundaries, or assistant voice.
- Agent Knowledge proposal tracking should preserve original, AI-suggested, and Admin-final text so answer-quality failures can be traced to stale knowledge, proposal quality, Admin edits, or assistant behavior.
- Use compact mark-only logo in signed-in header; keep fuller logo for signed-out context.
- Cap normal signed-in user-facing pages at 900px; allow Admin to be wider.
- Appointment toolbar extracted to `app/components/AppointmentViewToolbar.tsx` because it has a clean low-coupling boundary.
- Do not extract the full appointment card yet; it is too coupled to page-local state and would create a large prop bundle.
- Appointment records use a softly rounded white workspace with gentle separators and paper-like shadow, not individually heavy cards. Expanded CarePrep and Visit Notes regions may remain inline workflow panels rather than fully rounded cards because they expand/collapse inside the appointment record; keep them visually calm through restrained blue treatment, spacing, and quieter actions.
- Public website CTA should point to Early Access signup during the internal beta phase rather than repeatedly sending users to the app.
- Public website video should be embedded from a hosted video service/CDN rather than committed as a large deployment asset.
- Admin `View as user` is implemented as read-only admin snapshot/reveal RPCs with audit logging rather than true session impersonation. Sensitive data should be fetched only after an explicit reveal action.
- Admin Early Access Intake stores prospects separately from app users so interest and communication follow-up can be managed before account creation.
