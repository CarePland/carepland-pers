# CarePland Stable Project Context

Last updated: 2026-07-21

This document is the stable architectural and operational memory for CarePland Personal. It should be updated as assumptions change. Do not preserve obsolete decisions for historical completeness here; keep this document current, clear, and useful for future implementation chats.

## How To Use This Document

- Read this before making non-trivial product, architecture, AI, admin, or UX changes.
- Update this document when implementation decisions, terminology, business rules, workflows, or constraints change.
- Prefer concise stable facts over chat-style notes.
- If a topic is still speculative, mark it as future plan or open question.
- More than one implementation chat may run at the same time. Each chat should stay contextually focused and avoid overlapping edits where possible to minimize conflicts.
- Test/demo data is a product-design surface, not just a development convenience. When a subsequent chat makes or evaluates a meaningful product, architecture, AI, admin, workflow, or UX change, it should consider whether the change warrants an addition or adjustment to the sample/test data. This should not be automatic: ask Andrew explicitly, with a brief justification tied to what the new data would let the team evaluate or demonstrate.
- For independent app code reviews, maintain the copied-only slim review bundle described in `docs/APP_CODE_REVIEW_BUNDLE.md`. Refreshing it is intended to be a low-cost incremental copy that includes current working-tree source and excludes dependencies, build output, logs, env files, certificates, and other bulky/private artifacts.
- Systemwide recurring-request policy: no idle polling, period. Polling is allowed only for explicit active workflows that would visibly fail without refreshes, must stop when the workflow ends or prerequisites are absent, and should prefer realtime or user-triggered refresh. See `docs/CONNECT_RECURRING_REQUESTS_POLICY.md`.
- CarePland has a conservative PWA/offline foundation: a global client runtime registers `/sw.js` in production and on local development hosts for restart recovery, the signed-in top nav shows a quiet online/offline LED beside the people selector, and the service worker caches only the app shell/static assets plus `/offline.html`. Local development should not cache Next dev chunks. The browser also keeps an inert visible-screen snapshot for offline refresh recovery; it preserves the current Home/Appointments/Messages-style visible UI, disabled controls/links, current form values, and open panels for up to 24 hours. If a navigation or refresh lands while CarePland cannot be reached, `/offline.html` should retry the original page automatically with bounded backoff and reopen it when the server is back, without requiring repeated manual refreshes. After the stale window, the fallback state should say CarePland needs to connect to continue. Do not cache API responses or sensitive care data in the service worker until an explicit offline data model, retention policy, and security review exist. Offline data should remain intentional read-only snapshots for high-value care workflows, not broad browser caching.
- CarePland includes a global, user-triggered Send Help diagnostics path for beta support. The client keeps bounded in-memory breadcrumbs for navigation, API calls, console logs, device/build facts, session context, recent UI events, and a sanitized visible-screen snapshot. Pressing Send Help opens a confirmation dialog explaining what is included/excluded and lets the user add optional `What were you trying to do?` / `What happened instead?` notes; successful submission shows a durable acknowledgment with a human-readable `HELP-YYYYMMDD-XXXX` reference. The client sends packet schema version `1` to `/api/platform/help-diagnostics`; the server validates the schema, enforces size/rate limits, redacts secrets again, associates the authenticated user when a bearer token is available, derives deterministic triage fields, and stores the report in `help_reports`.
- CarePland also has a persistent `Something Went Wrong` entry point mounted from the root layout for signed-in app and Receiver surfaces, excluding public/auth/print/screenshot contexts. It is not emergency copy and should not be renamed to Send Help, Need Help, or Having Trouble. V1 uses a compact Talk-style voice/text capture panel, a 60-second recording limit with elapsed time and accessible announcements, deterministic interpretation into support families (`how_to`, `navigation`, `workflow_request`, `unexpected_behavior`, `technical_diagnostic`, `access_or_session_problem`, `unclear`), and explicit user confirmation before sending diagnostics. Submitted reports reuse `/api/platform/help-diagnostics` and appear in Admin Help Reports with the user description, interpreted question, family, confidence, selected workflow, context used, and correlation/session ID extracted from diagnostic breadcrumbs. Voice transcription currently reuses Connect audio handling when a bound Receiver person is available; text remains the universal fallback.
- Send Help is a black-box recorder for debugging, not idle polling or continuous upload. It explicitly excludes request/response bodies by default, sensitive headers, passwords, tokens, secret-looking URL values, and typed form values from the automatic packet. User-entered report notes are retained separately from the automatic diagnostic packet in the report row. Initial retention is retained-until-deleted; future retention windows, deletion tooling, and user-visible support messaging are future work. Admin-only review lives under Admin -> Support -> Help Reports and is protected server-side by `profiles.is_admin`; ordinary users can submit reports but cannot list or retrieve reports. Admin triage uses deterministic, non-AI categories and counts such as likely category, frontend error count, failed API count, slow requests, last meaningful user action, last failed endpoint, and most recent exception. Admins can mark reports reviewing, needing follow-up, resolved, or dismissed; add internal notes; assign themselves; and record a resolution category. Raw packets are available only as an expandable secondary diagnostic view.
- Send Help also establishes the reusable failure-of-silence diagnostic event contract. Long-running or failure-prone user actions should record `action started`, `still processing/delayed`, `succeeded`, `failed`, and `abandoned` style events through the diagnostics recorder where practical. The global recorder already captures help-report open/submit success/failure, request timeout/abort, client connectivity loss/restore, runtime exceptions, unhandled promise rejections, and page-hidden abandonment signals. Prioritize saves, sends, uploads, AI generation, Receiver pairing/connection, synchronization, and session-loss paths; do not instrument every trivial click.
- Terminal session loss is centralized in `app/lib/platform/sessionValidity.ts`. Family, the main Personal app, and Receiver should report explicit authentication rejection there instead of each inventing separate 401 handling. The shared state distinguishes authenticated, temporarily offline, session lost, offline access expired, and reauthenticating; temporary network failures and offline-access policy must remain distinct from server-rejected authentication. Duplicate 401/session-lost events should be suppressed so only one recovery flow is presented.
- Extended offline access is modeled as a server-issued entitlement, not a client-only timer. Policy constants live in `app/lib/platform/offlineAccess.ts`; plan eligibility stays behind the shared entitlement/feature interface (`extended_offline_access`), and issuance is centralized through the `offline_authorizations` server record/RPC so future subscription renewal, expiration, revocation, device-specific passes, tier durations, or server-driven policy changes can be added without spreading plan checks through UI code. The current implementation remains intentionally narrow: 14 days, one successful issue per rolling 30 days, no stacking, no custom durations, no admin override flow, and no broad offline data caching. Reconnection refreshes normal online state and does not cancel an active pass; if a pass expires while still offline, the app must not extend it merely by re-evaluating local state.
- Modularize progressively and intentionally as patterns stabilize. Avoid premature abstraction and unnecessary micro-components.
- Every extraction should either reduce duplication, improve explainability, or enable another workflow to reuse the platform. If it does not do one of those things, do not do it.
- Separate logic from `app/page.tsx` when it improves architectural clarity, maintainability, and separation of concerns, not merely for stylistic purity.
- Stable visual design rule: do not wrap individual checklist items, acknowledgement rows, list rows, or simple form-choice items in their own bordered/background boxes by default. Use whitespace, alignment, typography, and section-level structure instead. Bordered/background containers are reserved for true grouped panels, repeated cards, alerts, modals, or controls where the container itself has product meaning.
- Long-running user actions such as AI review, OCR/file extraction, uploads/saves, message delivery, Receiver pairing, and synchronization should never appear silent. Use the shared CarePland progress status pattern: immediate progress copy, delayed "still working" reassurance, a longer-than-usual state, and an assistance state after the configurable escalation threshold. Assistance should not be framed as an error; offer Continue Waiting, Try Again when the caller can safely retry, and Send Diagnostics. Long-operation diagnostics should record operation/stage/elapsed timing, route, page/device/network facts, API timeline/request IDs, recent UI breadcrumbs, console errors, and relevant person/Receiver context while continuing to avoid request bodies, typed form values, tokens, and secrets.
- Wizard progress states should not show a green/complete pill merely because a user has filled local fields, checked boxes, or navigated past a page. Green means functionally complete and confirmed by the app's durable state or a successful save/acknowledgement.
- Profile modularization has begun with focused presentational components under `app/components/profile/` and Care VIP workflow logic under `app/lib/profile/`; keep extracting stable profile sections and rules there before broad page-level rewrites.
- Refactor large pages through behavior-preserving extraction first: move stable UI regions into focused components, move repeated field/workflow rules into `app/lib/...`, then consider hooks once ownership boundaries are clear.
- Profile draft shape, Supabase row-to-draft hydration, normalization, phone/ZIP validation, display-name derivation, and dirty-state keying live in `app/lib/profile/profileDraft.ts`; onboarding and signed-in profile flows should use this shared policy instead of reimplementing field rules.
- Profile display labels should not fall back to raw email addresses. When no usable display/full name exists, use a neutral self label such as `You`, and hydrate stored email-like display names as blank so users are prompted toward intentional names instead of exposing login identifiers.
- Profile setup and signed-in Profile contact details share `app/components/profile/ProfileContactDetailsForm.tsx`; use its inline/card variants instead of duplicating profile field markup.
- Early Access acknowledgement and profile setup gate UI lives in `app/components/personal/onboarding/OnboardingGate.tsx`; keep `app/CarePlandPers.tsx` responsible for state/data orchestration while the gate component owns the presentational branches. Personal onboarding may use the Receiver Setup wizard visual language and dimensions: a headerless full-screen app surface, rounded 1024 x 640 canvas, pale in-wizard header, pill progress, sticky footer, strong blue primary action, and viewport scale-to-fit behavior with a small margin so tablet/appliance windows resize cleanly. It should not introduce a generic onboarding framework, browser-stored wizard state, or fake setup steps. Completion truth remains the existing profile fields (`beta_*_acknowledged_at`, `onboarding_completed_at`, and `requires_email_update`). The current Personal Setup wizard is `Early Access`, `Basic Info`, `Address`, and `You’re Ready`; `You’re Ready` can be reviewed before signup completion, but its launch action only works after the Address save has durably completed setup.
- Email/password or email-update profile setup requires first name, last name, phone, time zone, address line 1, city, state/region, and ZIP; display name and address line 2 remain optional. Required-field labels, HTML required attributes, validation messages, and Ask onboarding facts should stay aligned.
- Future Personal Setup wizard steps may include `Personalize`, but only as design notes until there are real product decisions and durable data paths. Do not add fake or staged Personalize controls. Display name is already part of Basic Info/profile setup; avatar/profile image, quiet hours, and reminder style should be omitted from onboarding until their actual Personal settings persistence and downstream behavior exist.
- First-run Home welcome guide UI and static slide content live in `app/components/WelcomeGuide.tsx`; keep `app/page.tsx` responsible for welcome state, dismissed/save actions, and appointment/import/sample-data callbacks.
- The welcome guide's demo/example-data action should keep the guide visible until sample seeding succeeds, then dismiss the guide and open Appointments so users can immediately inspect the seeded examples.
- Admin workspace chrome/navigation lives in `app/components/admin/AdminWorkspaceShell.tsx`; continue moving admin-only UI into admin components without pulling patient-facing state or workflows along with it.
- Admin Dashboard includes `Priorities`, a deterministic operational triage inbox for answering what needs administrator attention now. V1 source adapters live in `app/lib/admin/priorities.ts` and `/api/admin/priorities`; admin lifecycle state persists in `admin_priority_states` with transition audit in `admin_priority_events`. The dashboard shows concise cards only: what happened, affected person/Receiver label where available, why it appears, last occurrence, severity, status, recommended action, and a direct route to the underlying admin surface. It must not become a raw event feed or duplicate detailed Help/Checkpoint/diagnostic panels. Current connected sources are open Send Help reports (`help_reports`), Checkpoint runs without reviewer decisions (`checkpoint_runs`), repeated Receiver/interaction failures (`interaction_attempts`), repeated operation failures from interaction attempts, and repeated authentication/session Help reports. V1 inspected but intentionally does not yet connect `carepland_work_events` because current rows mainly represent completed work, AI operation cost logs because they are analytics not unresolved triage, and the Receiver diagnostics mode endpoint because durable unresolved diagnostic records are not yet modeled. Triage is deterministic: severity is Critical/High/Medium/Low, categories are Needs Attention/Review/Watch/Deferred, lifecycle states are Open/Acknowledged/In progress/Deferred/Resolved/Dismissed, and each priority keeps a human-readable explanation derived from the rule that created it. Source adapters should add stable incident keys so acknowledgement, deferral, resolution, and dismissal survive recomputation; dismissed issues should reappear only when genuinely new activity crosses the source rule threshold. Admin-only access must be enforced server-side, and priority cards should avoid full message bodies, medical narratives, prompts, transcripts, uploaded document text, or raw diagnostic packets.
- Admin status changes are high-risk account operations. The Admin Users activity table exposes `profiles.is_admin` as an Admin checkbox, but granting Admin access requires an explicit confirmation, shows the target user's name/email, and requires the current admin's password. Removing Admin access must never eliminate the final remaining Admin; enforce this server-side, not only in UI.
- Admin includes `Checkpoint`, an Admin-only evaluation surface for preserved interpretive runs and editorial review of AI-generated user experiences. The first complete preserved Checkpoint Use is CarePrep: Admin selects account, Care VIP, and appointment; generates a CarePrep Checkpoint run; reviews Overall Assessment, Suggested Improvements, Display Preview, and Good Decisions first; keeps Evidence Packet, structured interpretation, Decision Quality Review, Decision Trace, prompt/model metadata, raw contracts, and history secondary/collapsed; saves a Checkpoint Decision; and can reopen the preserved run from history. Health Stories are also reviewed in Checkpoint as a read-only generated-story review surface by account and Care VIP; reviewers browse stories, inspect one story at a time, and evaluate an expanded Display Preview rendered with the same user-facing presentation components while evidence, structured interpretation, decision quality, trace, and prompt metadata remain collapsed. Checkpoint evaluates CarePland's product judgment, not just generated prose: for every recommendation or preparation item it should expose the decision CarePland made, supporting evidence, whether the decision reduced user work or reassigned work, and a better decision when the current one is weak. Platform rule: whenever CarePland already possesses reliable information, it should prefer using, summarizing, surfacing, connecting, or reminding from that information over asking the user to rediscover or re-enter it. Exceptions should be explicit, such as verification, confirmation, changed circumstances, or intentionally collecting new observations. V0 decisions are evaluation records only and must not publish or expose output to users. CarePrep runs are stored in `checkpoint_runs` with frozen evidence/output snapshots, prompt/model metadata, evaluator decision/tags/notes, and Admin-only access.
- Admin includes a `Workflow View` surface for inspecting setup workflows through isolated browser preview routes. It should render the real Personal Setup and Receiver Setup wizard components for visual/workflow review with viewport presets, but preview actions must not mutate real user accounts or provisioning records.
- Admin Tools includes `Data Health`, an executable integrity-check surface for cross-table account/setup state mismatches. Keep repairs narrow, explicit, audited, and limited to unambiguous invariants. Current invariant: `profiles.onboarding_completed_at` implies the required Early Access acknowledgement timestamps are present; the repair backfills missing acknowledgement timestamps from the profile completion time.
- Sign-out unsaved-change summaries, appointment modifier close/switch checks, and Import panel close checks live in `app/lib/unsavedChanges.ts`; keep the policy for what counts as discardable work centralized instead of rebuilding it in page-level UI.
- Ask messages already shown in a conversation are not unsaved work by themselves. Treat Ask as dirty only while the user has unsent input or a reply request is in flight.
- Manual appointment creation should have one visible Add Appointment form. The minimum required fields are person, title, and date/time; location, provider, practice, reason, and favorite-location details are optional context. Canceling or switching away from the add panel should clear the new-appointment draft so banners and navigation guards reflect real state.
- CarePrep user-facing output is deliberately minimal: an optional opening line of at most 180 characters, optional `Before the Visit` suggestions, and optional `During the Visit` suggestions. Do not show `Summary`, `Bring`, `Questions`, `Medication Review`, `Since Last Visit`, `Watchouts`, or `Next Steps` as user-facing CarePrep sections. Both suggestion sections are optional; when CarePland cannot produce materially useful appointment preparation, omit CarePrep rather than showing an empty branded state. `Before the Visit` is capped at 3 items. `During the Visit` is capped at 3 by default, with a fourth only when clearly distinct, strongly supported, and genuinely important. CarePrep should make calm, concise, non-authoritative suggestions and should not ask users to retrieve or re-enter information CarePland already reliably possesses except for verification, confirmation, changed circumstances, or new observations. Current storage maps this simplified contract onto `careprep_guidance.summary` as the opening line, `bring_list` as Before the Visit, and `key_questions` as During the Visit; old generated CarePrep outputs are not preserved for compatibility.
- CarePrep guidance-to-form normalization, intake draft content types, and CarePrep edit comparison live in `app/lib/personal/editor/editorState.ts` with the other draft comparison helpers.
- Supabase server environment checks belong in `app/lib/server/env.ts`; API routes should use the shared helper as they are touched instead of reimplementing ad hoc `process.env` guards.
- Supabase route-client creation belongs in `app/lib/server/supabase.ts`; new API routes should use the public, authenticated-user, or service-role client factory instead of rebuilding `createClient` options inline.
- Browser-side Supabase auth/data access should reuse the shared singleton in `app/lib/platform/browserSupabase.ts` to avoid multiple GoTrueClient instances in one browser context. Server/API routes may continue using request-scoped clients from the server helper.
- Health Focus / Reports is a person-level context layer, not an appointment-card feature and not currently a Home surface. The first foundation exists in `supabase/sql/2026-06-07_health_focus_reports_foundation.sql`, `app/lib/healthTopics/`, and `app/lib/reports/`. Ordinary appointment-card Visit Notes saves and single Import/intake Visit Notes saves use `app/api/appointment-notes/route.ts`, which triggers deterministic catalog-based topic extraction through `app/api/health-topics/extract/route.ts` / `app/lib/healthTopics/server.ts` as a best-effort server follow-up. Current Health Story review belongs in Admin Checkpoint, using the existing `app/api/health-topics/summary/route.ts`, `app/api/health-topics/detail/route.ts`, and production presentation components as a Display Preview; the Home presentation has been removed while generation/persistence remains intact. Topic summary generation and reports UI are not implemented yet. Topic mention status is user-editable even when AI suggests the initial value. Topic extraction should stay server-side after Visit Notes are saved, not as client-side orchestration in `app/page.tsx`. Keep planning details in `docs/HEALTH_FOCUS_REPORTS_FOUNDATION.md` and do not build this layer into `app/page.tsx`.
- Health Focus taxonomy should optimize for the story of care, not clinical coding. Keep domains broad, categories reasonable, and topics user-friendly. Do not drift toward an exhaustive diagnosis ontology. Topic relationships, such as Blood Pressure appearing alongside Dizziness, Medication Changes, Cardiology, or Home Monitoring, are expected to become more useful than deep category nesting.
- Health Focus extraction stores co-mentioned topic slugs from the same source note in `topic_mentions.related_topic_slugs`; topic detail can surface these as lightweight `Also appears with` context.
- Health Stories are evolving and require ongoing editorial review before competing with primary caregiver tasks. Do not show Health Stories on the CP Pers Home page until an explicit product decision promotes them from Checkpoint review to user-facing experience. Home should remain focused on immediate caregiver actions such as appointments, messages, Receiver setup, notes, CarePrep, and Today’s Focus.
- Health Focus story details should feel snappy after the first load when Health Stories are reviewed or eventually surfaced. It is acceptable to cache loaded topic detail responses in memory for the current browser tab/session with a small cap. Do not store full story details in browser storage. Any future user-facing Health Story summary cache must be reviewed with the product placement decision and should be bypassed after data-changing feedback actions.
- Health Focus context pill labels are Admin-managed Dynamic Text. In the Health Story panel, keep the story header calm with the topic icon/name only; place context pills in the footer beside a clear CalendarClock-style date marker. The footer date marker should show only the app-formatted date text, not a visible `Last seen` label. Do not surface visit count or the full mixed status set in the compact story footer. The label override format is `canonical = label_full;label_short`; keep the date value itself app-formatted unless Andrew explicitly asks for date-format configurability.
- Existing current accepted Visit Notes can be retrofitted through `app/api/health-topics/backfill/route.ts`. Home may attempt one small signed-in backfill per Care VIP filter per session, then reload the summary; this is an early low-volume retrofit behavior, not a long-term background job system.
- CarePland Track / Today's Focus separates intentions from recorded reality. `focus_items` are person-scoped prompts/goals/routines; `track_events` are person-scoped facts that something happened or was observed. A checkbox/tap is only one possible way to create a Track Event. Talk, reminders, appointment notes, Connect call summaries, caregiver notes, and manual entry should write source-traceable Track Events rather than overloading Focus Item state. Keep Track broad and user-friendly, not diagnosis or clinical decision support. The first Receiver backend proof of concept is authenticated/person-explicit: `/api/connect/today-focus` returns at most three active items and supports only `simple_done` plus `measured_value` completion. Receiver Today’s Focus should show only stored/ranked Focus Items for the real Main Receiver User, not static placeholder goals or the prototype receiver id; tapping a Receiver Focus item now writes a `track_events` row during testing, and measured items collect value/unit before saving. Completed Receiver Focus items are removed from the list for the current Focus day, where the Focus day resets at 4:00 AM in the signed-in user’s profile timezone when available. Receiver completion Undo is an Admin-tunable grace-period rollback, defaulting to 5 seconds through the shared Receiver Dynamic Text key `connect_receiver_undo_seconds`; Undo deletes the just-created Receiver Today’s Focus `track_events` row for that focus item, rather than leaving a retracted event. Future Receiver undo actions should use the same setting unless there is a clear product reason to split them. A small Today’s Focus cadence preference layer lives in `focus_cadence_preferences`: it is not a reminder scheduler, but a user preference signal for how often recommendation-backed Focus items should surface. Preferences can show an item less often, hide until the next appointment, snooze for 30 days, or stop suggesting unless materially new evidence appears. CP Pers Home can show a read-only Today’s Focus preview through the signed-in `/api/personal/today-focus` endpoint; it follows the selected Care VIP or Everyone mode and does not expose Receiver completion, Undo, or cadence controls until Coordinator workflows are designed. If a Care VIP is marked as managed by another person, CP Pers Home should continue to show their Focus but should not allow updating/completing Focus for that person in the initial Coordinator experience. The shared `TodayFocusList` component is person-scoped so CP Pers Home can later render either a selected Care VIP list or aggregate Everyone view without changing the preference model. Today’s Focus ranking v1 is deterministic and inspectable: base weights are user-created Today goal 100, caregiver goal 95, appointment today 90, medication reminder 90, appointment tomorrow prep 80, AI/recommendation candidate 70, routine habit 50, low-priority suggestion 20; modifiers are overdue +20, repeatedly skipped +15, provider/CarePrep-backed +25, expires today +15, and already completed today removed. Returned items include `todayFocusRanking` with source category, modifiers, final score, and rationale. Receiver Talk v1 uses deterministic interpretation through `/api/connect/talk` after reviewed transcription, supports walking/activity, broad medication completion, weight measurement, Connect call requests, next-appointment questions, and unknown handling, and only writes `track_events` for high-confidence no-review Track intents. Talk does not store raw audio or full raw transcripts in Track payloads, does not infer medication specifics, and does not provide clinical advice. It does not use AI ranking or generation. The foundation is documented in `docs/TRACK_TODAYS_FOCUS_FOUNDATION.md`, `docs/TALK_INTENT_FOUNDATION.md`, and `supabase/sql/2026-07-01_track_today_focus_foundation.sql`.
- Connect Receiver identity separates Receiver User, Receiver Contact, and Primary User. Receiver User is the CarePland person represented by the Receiver. Receiver Contact is the login-capable auth user who receives Receiver-originated contact/message/call/escalation actions. Primary User/account owner is separate and must not be assumed to be the Receiver Contact. MVP Receiver Contact resolves from the authenticated user who creates or pairs the Receiver setup claim, surfaced as `receiverContactUserId` plus display name for presentation. Receiver-originated communication is unavailable when contact setup is missing or when the resolved Receiver Contact represents the Receiver User; do not silently reroute to another contact.
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
- Platform principle: users express intent; CarePland determines implementation. CarePland should minimize the need for users to understand application structure, organizational hierarchy, or implementation details. Users express what they are trying to accomplish; CarePland determines the appropriate workflow, routing, and data model while preserving transparency through Decision Trace. This applies across Receiver, Import Anything, OCR, CarePrep, Ask, Recommendations, Connect, and public/registrar website experiences. Human thoughts should enter the platform as source-independent Observations before routing to Talk, Ask, Track, Connect messaging, reminders, review queues, or future workflows.
- Meaning Over Modality: platform layers should normalize shared meaning, not merely text. Speech, typed text, OCR, photos, structured forms, SMS, voice memos, selected examples, and future wearable signals are interchangeable observation adapters at the edge; speech synthesis, text, notifications, emails, and dashboards are interchangeable presentation adapters at the edge. The center of CarePland should operate on shared semantics so new modalities do not require rewriting core routing or workflow logic. Preserve source metadata for provenance, audit, accessibility, and presentation decisions, but desource core interpretation after capture. See `docs/UNIVERSAL_OBSERVATION_PIPELINE.md`.
- Interaction Attempts are the diagnostic parent for a user's overall effort to accomplish one human purpose. Each utterance/rephrase remains a separate immutable Observation; revisions share the same Attempt, preserve parent lineage, and append events such as response presented, not helpful, rephrase selected, send selected, workflow completed, cancelled, abandoned, or timed out. Attempt data is for interpretation/recovery improvement and Admin diagnostics, not generic analytics, and should extend Decision Trace/review/workflow history concepts rather than creating parallel diagnostic systems.
- Platform Reviews are durable administrator observations about what was learned from an Interaction Attempt. They are separate from Attempt data: Attempts describe user effort; Reviews describe reviewer interpretation of that effort. Human review comments and optional advisory analyses must never directly change prompts, interpreter memory, Interaction Family classification, workflow selection, or Receiver behavior. They inform future human-led platform refinement only.
- The Interaction Review Queue is a read-only Admin view derived from existing Interaction Attempts, Observations, Events, Platform Reviews, and Review Analyses. It helps proto-beta reviewers find attempts with not-helpful feedback, revisions, abandonment/timeouts, capability gaps, family changes, or existing/unreviewed review state. It must not create automatic reviews or duplicate attempt history.
- Canonical Interaction Families describe human purpose after MeaningFrame and before workflow selection: Ask, Observe, Need, Communicate, Remind, Plan, Decide, Discover, Express, and Escalate. These families are interpreter outputs and workflow-selection inputs; they are not UI labels, API commands, database actions, or MeaningFrame fields. For example, "I need milk" is Need, "I went for a walk" is Observe, "Tell Andrew I'll be late" is Communicate, and "What is this letter?" with an artifact is Discover.
- Receiver Ask-family utterances pass through a small deterministic Ask intent refinement before generic recovery. Current categories include appointment lookup, past visit/health history, medication status, household status, item location/status, upcoming plan, person/contact lookup, and general unknown. Understood-but-unavailable intents should return explicit `capability_missing` diagnostics, not pretend a workflow exists and not fall through to generic recovery.
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
- Basic Personal/Profile loaders must resolve the active Care Circle from `care_circle_memberships.user_id = signed-in user id` and `status = active`, preferring the owner membership, rather than treating every visible membership row as part of the current account.
- Accidental shared active Care Circles can be inspected through `supabase/sql/2026-07-15_admin_account_scope_audit.sql` and repaired through `supabase/sql/2026-07-15_repair_shared_care_circles.sql`; run the preview and dry-run functions before applying the repair. Reused Care VIP display names and unlinked active/default `care_subjects` are manual-review signals only; do not infer ownership or move history from names. For disposable test accounts where no history should be preserved, use `supabase/sql/2026-07-15_reset_test_accounts_by_email.sql` as a dry-run-first app-side reset that preserves auth logins by default.
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
- **Prep family**: internal shorthand for workflows that create useful meaning from collections of data. Current internal terms include **CarePrep** for appointment preparation, **MessagePrep** for appointment-linked message meaning/summary items, and **ImportPrep** for Import Anything interpretation/review outputs. These names do not require code/schema/UI renames and should not force user-facing copy.
- **Import**: preferred user-facing term for the former "Quick Add" workflow.
- **Demo data**: clearly labeled sample appointments, notes, and CarePrep examples. Demo data must never be ambiguous.
- **Support question / Ticket**: in-app support thread between user and CarePland/admin.

Person/avatar assumptions:

- The canonical CarePland Pers person model is currently `care_subjects`; Connect participants and focus targets must reference existing `care_subjects.id` values.
- `care_subjects.account_user_id` is the optional canonical link from a real person row to the signed-in account profile that person represents. Use it for Receiver self-use labeling such as `(You)`; do not infer the signed-in person from `is_default`.
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
- Connect uses `Main Receiver User` as the current user-facing stabilization term for the person whose Receiver world is active. The active person resolves from a specific global focus, then an in-memory Connect-local target when global focus is `Everyone`, then the durable `connect_settings.main_connect_user_person_id` setting, then a default/logged-in Pers person as last-resort display focus. Connect must not be personless when a signed-in Pers person is available. Connect participant rows control whether Receiver/call/message/audio actions are enabled; they are not the source of whether a person can be the visible Connect focus.
- Connect Settings may expose the durable Main Receiver User setting with compact person buttons. Do not expose `Household` as user-facing Receiver configuration until Receiver has real household/multi-user runtime support; keep household terminology limited to future/dev notes and prototype plumbing.
- Receiver primary-contact labels such as `Send to [Name]`, `Call [Name]`, and Ask/Tell examples must not be hardcoded to a developer/test caregiver name. The durable product direction is a Profile setting per Care VIP/Care Circle that selects the primary Connect contact/coordinator: the Care VIP group member managing the Receiver relationship and receiving fallback communication. Until that Profile selector and data model exist, Receiver may use the active Care Circle owner/profile display name as a temporary proxy and must fall back to neutral `Care coordinator` copy when no person can be resolved.
- Care VIPs classified as pets (`cat`, `dog`, `pet`, or `pet:<custom label>`) may appear in Connect person context but cannot be selected as the Receiver User. Show them de-emphasized and labeled by species/type.
- Connect user-facing surfaces should not expose advanced provisioning, setup diagnostics, audio maintenance, or receiver-user management as a standalone Messages/Connect destination. Care VIP/person management lives in Profile, and Receiver Settings lives in Profile & Settings beside Your CarePland Account. Provisioning and diagnostics should still move toward Admin/DEV-oriented surfaces as they harden.
- Profile is the home for Care VIP avatar management. Connect should display and use avatars, but photo upload/remove controls belong in Profile so identity setup is not split across workflows. Within Profile, avatar controls belong with the selected person in Contact Details, not in the top Care VIP add/remove summary.
- Profile Contact Details distinguishes the logged-in account user from Care VIPs. It uses a person selector without `Everyone`; selecting the account user shows saved account contact fields, while selecting another Care VIP shows that person's avatar/name context without inventing contact fields until scoped Care VIP contact data exists.
- Future CP Pers import/interpreter work, including a possible single "import all" action, may create or update `care_subjects`, appointments, notes, and other Pers-owned records, but it should not automatically create `connect_participants` rows or change `connect_settings.main_connect_user_person_id`. Enabling a Pers person for Connect remains explicit provisioning/Admin behavior until participant management is intentionally designed.
- Connect message-audio playback and receiver hearing feedback are prototype-stable and should not be tuned further until live call behavior is in place. The next audio priority is call infrastructure.
- Receiver contextual UX prompts are intended to be a library of single-question, low-friction learning moments shown during normal use, not traditional surveys. They must ask one question, be directly related to a recent experience, be easy to dismiss, appear infrequently, avoid urgent workflows, and tune CarePland behavior rather than collect marketing feedback. When Receiver UX work involves uncertainty around timing, visibility, wording, interaction friction, notification frequency, or dismissal behavior, consider whether a future contextual prompt should be cataloged. The first catalog foundation lives in `app/lib/connect/receiverContextualPrompts.ts`. Initial future-trigger item: after a Receiver user has completed Today's Focus items enough times, occasionally ask whether the Receiver Undo window gives enough time, with answers `Not enough time`, `About right`, and `Too much time`; this should inform the shared `connect_receiver_undo_seconds` setting.
- Connect calls now have an app-owned local signaling foundation in `app/lib/connect/calls/server/` and `/api/connect/calls/*`: call records handle ringing/answered/connected/declined/hung-up state, while call signals carry future WebRTC offer/answer/ICE/media-state payloads. The legacy local prototype server may still mirror call state when running, but it is no longer the only place the app can store call state. Keep live media implementation layered on this call/signaling boundary instead of mixing WebRTC details into receiver UI state. As of 2026-07-13, Connect calls are deprecated/paused and recurring client polling for `/api/connect/calls*` is intentionally disabled to prevent runaway Vercel function invocations. Re-enable calls only with an explicit low-volume polling/realtime design; see `docs/CONNECT_RECURRING_REQUESTS_POLICY.md`.
- Connect live-call audio uses the browser WebRTC controller in `app/lib/connect/calls/browserCallAudio.ts`; caller and receiver UI should show explicit audio readiness/connection/interruption state and provide microphone mute/unmute while a call is connected. Phone testing requires HTTPS or another secure context for microphone permission; plain LAN HTTP may still show call state but should not be expected to carry live microphone audio.
- Connect live-call media state should travel through `media_state` signals, not only through call-record polling. The browser call controller sends peer-ended and mute/unmute signals, applies an audio connection timeout, and lets the other side stop promptly when a peer ends the media session.
- Connect live-call WebRTC uses default public STUN when no environment override is configured, but product-demo reliability across the internet will likely require TURN. Browser calls fetch ICE settings from `/api/connect/calls/ice-config`, which prefers Twilio Network Traversal short-lived ICE credentials when `TWILIO_ACCOUNT_SID` and `TWILIO_AUTH_TOKEN` are configured server-side. If Twilio is unavailable, the route falls back to server-side `CONNECT_ICE_SERVERS_JSON` or `CONNECT_STUN_URLS`, `CONNECT_TURN_URLS`, `CONNECT_TURN_USERNAME`, and `CONNECT_TURN_CREDENTIAL`; the browser-exposed `NEXT_PUBLIC_CONNECT_*` names remain a fallback. Static TURN credentials are acceptable only as a short demo bridge; production should use Twilio-generated short-lived credentials.
- Receiver call polling should prefer calls targeted to the Receiver's durable device id. During the early browser-Receiver phase, if the Receiver sees exactly one active call for its Receiver Active Person but its local browser identity does not match the targeted `receiverId`, it may surface that call as a person-scoped fallback and log `call_receiver_person_scoped_call_fallback_used`. This prevents stale local browser identity from blocking testing while still preserving exact Receiver targeting when identities match.
- Connect call summaries are not general conversation summaries. The summary goal is a brief care record from the conversation: include only medication discussions, symptoms, pain, mobility, sleep, appetite, weight, blood sugar/BP readings, cognitive changes, clinically relevant mood/function changes, upcoming appointments, provider instructions, caregiver observations, follow-up actions, and equipment. Exclude gossip, politics, sports, TV, opinions, financial topics unless directly needed for care access, vacation plans, relationships, jokes, religious discussion, and embarrassing non-care details. Include contextual life details only when they directly affect care; when uncertain, omit.
- Connect call transcripts are temporary by design. Store the transcript on the call record only until the AI-generated Call Summary is immediately reviewed during the active/fresh call interaction, approved, discarded, or expired; once approved or expired, permanently delete the associated transcript while keeping the durable summary fields. Generated summaries may still use `pending_review` / `transcript_expires_at` internally for cleanup and future live-call flows, but the current message-first MVP must not expose a later Receiver UI for reviewing call summaries after the call has ended. Reviewer edits are persisted in `summary_approval_draft_text`; approval stores the draft when present, otherwise the generated summary, as `approved_summary_text`, sets `summary_status = approved`, records approval metadata, and deletes the transcript plus transcript segments. If the transcript expires before formal approval, cleanup must delete the transcript, retain `generated_summary_text`, set `summary_status = expired_unreviewed`, and add the note `Transcript expired before formal approval. Generated summary retained as unapproved.` Do not call expired or timed-out summaries approved. Approval should happen only while the conversation is fresh; deferred call-summary review queues are out of scope while live calling is de-emphasized for the MVP. The Receiver implementation may keep the immediate editable Call Summary surface with `Approve this version` for active/fresh call interactions so it can be reused when live calling returns. Future TODOs: define dual-party approval UX, discrepancy handling, richer clarification/regeneration workflow, reminder/escalation policy before expiration, and any future Coordinator/Call History approval surface if product direction reintroduces deferred review.
- When the future `Not Quite` / reject-refine summary workflow is designed, the user must be reminded that only care-relevant parts of the conversation can be stored in CarePland. The refinement UI should explain that the approved record is limited to information relevant to appointments, health, or caregiving, and that personal details or general conversation may need to be omitted even if they were discussed on the call.
- Call summary approval and transcript cleanup are related but distinct operations. Approval should save the user-approved care summary first; transcript text and transcript segments should then be deleted. If segment cleanup fails after approval, surface `transcriptCleanupStatus: "pending"` and allow a retry path rather than pretending cleanup completed.
- Durable Connect call storage is defined in `supabase/sql/2026-06-25_connect_call_records.sql` plus `supabase/sql/2026-07-03_connect_call_pending_summary_review.sql`: `connect_calls` for call lifecycle, temporary transcript text, generated/approved summary fields, review drafts, transcript expiration, and cleanup status; `connect_call_signals` for short-lived WebRTC signaling; `connect_call_events` for diagnostics without transcripts/audio; and `connect_call_summaries` for brief care-only summary audit rows. `supabase/sql/2026-06-25_connect_call_summary_prompt.sql` seeds the Admin-managed `connect_call_care_summary` prompt. The app-owned call routes now try Supabase-backed call/signaling storage first and fall back to local JSON storage when the durable tables are unavailable, preserving local development while making deployed remote demos possible after the SQL is applied.
- Connect MVP direction is now message-first successful communication: contextual messages, person-inbox Receiver display, explicit acknowledgement, read/seen visibility, and caregiver visibility are the launch path. Callback requests are de-emphasized/semi-deprecated while live Call is pulled back; do not foreground callback options in the appointment message composer or appointment message history. Live audio/WebRTC remains part of the long-term Connect vision and should not be removed, but live call reliability should no longer block the initial Connect MVP. Durable message storage is defined in `supabase/sql/2026-07-09_connect_messages_foundation.sql`: `connect_messages` stores person-scoped Receiver Active Person messages with lifecycle timestamps (`delivered_at`, `read_at`, `heard_at`, `acknowledged_at`, `callback_requested_at`), acknowledgement/callback flags, sender metadata, legacy/device-context optional receiver device id, and text/audio fields; `connect_message_events` stores append-only lifecycle events. `/api/connect/messages` should prefer Supabase-backed durable rows and keep local/prototype fallback for development. Message reads/writes must preserve Main Receiver User / Receiver Active Person scoping and bound Receiver authorization.
- Connect call diagnostics should use `connect_call_events` for operational breadcrumbs such as call created, state updated, signal posted, and summary approved. Event details must remain metadata-only and must not include transcript text, raw audio, SDP bodies, ICE candidate payloads, or other sensitive conversation content.
- During Connect UI polishing, operational call/audio/transcript details currently shown on the page should be kept available behind a `Diagnostics` checkbox visible only to Admins. This is a central troubleshooting requirement: future polished user-facing Receiver/Coordinator call UI should not expose noisy implementation state by default, but Admins should retain a quick way to see audio state, transcript-capture state, and recovery controls when a call behaves unexpectedly.
- Receiver appliance home should use a single secondary footer `Attention` slot near Sounds/Clean for pending items that need action. It should not replace primary home buttons or show large banners. For the current message-first MVP, Attention should surface actionable messages (`Message`) and must not expose deferred Call Summary review after a call has ended. Future inputs should plug into the same resolver for reminder due (`Reminder`), receiver update available (`Update`), and device/audio issue (`Help`).
- Receiver message-first UI should surface actionable messages through `Attention` and may present an explicit `OK` acknowledgement action in the message reader. Callback request state may remain durable for legacy records but should not be foregrounded while Call is de-emphasized. Live call controls can remain available, but should be visually/textually secondary and labeled as live calls rather than the core Connect path.
- Receiver `Appliance` and `Modern` are the current approved production-ready hosted React Receiver UX choices. Appliance is the default dedicated Receiver surface, implemented by the former Ask/Tell 2 layout (`homeLayout=ask_tell_2`), and treats the Receiver as the care recipient's simple CarePland interface rather than a phone or messaging app. Modern is the approved responsive web Receiver surface (`receiverLayout=modern`). The in-Receiver style chooser should expose only Appliance and Modern; Classic, Focus, original Ask/Tell, Default Web, and Old Web are staging/development layouts visible through Admin Layout preview only. Modern2 is deprecated and must not be reintroduced as a selectable Receiver layout. The Appliance top-level model should emphasize Today's Focus, Next Appointment, Ask/Tell, Messages, and Appointments; Talk, live call, and record-request mechanics should remain available underneath but not be prominent. Ask/Tell should open as a full-screen, multi-modal intent surface: speech starts automatically for transcription/audio capture, typing remains available, and prefab examples remain available. These modalities are non-exclusive; speech transcript should not silently erase typed text, and choosing an example over existing text should ask before replacing it. CarePland routes the resulting thought through the shared Observation boundary before current Talk/Ask interpretation and later AI platform layers.
- Connect call transcription should start with chunked background transcription before true live captions. The first chunk model is a 35-second transcription window every 30 seconds, giving a 5-second overlap: `0:00-0:35`, `0:30-1:05`, `1:00-1:35`, etc. Segment transcripts live in `connect_call_transcript_segments`, are stitched into the temporary `connect_calls.transcript_text`, and must be deleted with the assembled transcript after summary approval. The first browser implementation records mixed local+remote call audio from the Dashboard side only after remote audio arrives, to avoid duplicate transcripts from both parties.
- The Consumer Care Knowledge Layer (CCKL) is the shared interpretation aid for consumer-facing medical/care terms, brands, services, and common nonstandard phrasing. It helps transcription correction, Connect call summaries, appointment prep, Health Topic recognition, and Admin review without expanding the care record beyond CarePland's care-relevance/privacy policy. CCKL is not a diagnosis engine, clinical decision support system, medical encyclopedia, permanent transcript store, intent router, or workflow engine. Phase 1 is code-native under `app/lib/personal/consumerCareKnowledge/`, returns stable concept IDs for matched entries, injects only matched ephemeral prompt context into Connect call summaries, and is documented in `docs/CONSUMER_CARE_KNOWLEDGE_LAYER.md`. The platform-shaped CCKL service in `app/lib/platform/ai/ccklService.ts` wraps the existing seed matcher and emits `Concept[]` plus a `DecisionTrace`; Connect call-summary prompt construction now uses this platform service while preserving the exact legacy prompt-context output. The call-summary boundary exposes platform concepts/trace internally for future explainability, but call summary v1 consumes only `existingContext.promptContext` and does not persist CCKL artifacts. Future CCKL should support a clarification loop when CarePland has high confidence that a useful term, brand, acronym, wordmark, nickname, or household phrase needs explanation: ask the user whether to add/clarify it, support both user-specific meaning and global candidate knowledge, avoid forcing one user's definition onto everyone, and allow improved global definitions to be offered back to earlier users for confirmation. The first clarification choices should be `Yes, and remember this for me`, `No, don't remember`, and `Don't ask again about this`, with a checked `I want to be asked about these` preference. If a user unchecks that preference, show the confirmation text `Choosing to not interpret these may impact the quality of your health history` with `I understand` and `Nevermind`; `Nevermind` should hide the warning and restore the checked state. This user/care-circle preference belongs in Profile under Connect and should be modeled as one of a growing set of configurable Connect interpretation preferences. Any AI prompts used to identify, propose, normalize, or review CCKL clarification candidates must live in the Admin prompt/instruction workflow before product use, and Admin data-quality analysis should account for whether users opted into or out of these clarifications. These clarification candidates improve interpretation only; they must not store full transcripts or expand the care record beyond reviewed care-relevant facts. Future platform callers can import CCKL from `app/lib/platform/ai`. The no-op Household Knowledge Layer scaffold in `app/lib/platform/ai/hklService.ts` reuses `HouseholdConcept` and `DecisionTrace<"household_knowledge">`, returns an empty `HouseholdConcept[]` with `no_write`, and is not consumed by Talk, call summaries, persistence, or any workflow yet. It does not resolve household aliases. The proposed future AI normalization prompt lives in `ai-prompts/consumer_care_knowledge_layer/` and should normalize language into reusable structured concepts while leaving routing, urgency, storage, Track, Focus, and other workflow decisions to downstream layers. Keep the seed small and curated until the taxonomy, prompt behavior, and future Admin/storage workflow stabilize.
- The no-op Knowledge Resolution scaffold in `app/lib/platform/ai/knowledgeResolutionService.ts` accepts platform `Concept[]` and `HouseholdConcept[]`, reuses `ResolvedConcept` and `DecisionTrace<"knowledge_resolution">`, returns an empty `ResolvedConcept[]` with `no_write`, and is not consumed by Talk, call summaries, persistence, UI, Admin, or any workflow yet. It does not merge universal and household concepts or resolve aliases.
- Platform tests now prove CCKL, HKL, and Knowledge Resolution compose in memory while remaining unwired from product runtime behavior.
- The trace composition utility in `app/lib/platform/ai/traceComposition.ts` can carry CCKL, HKL, and Knowledge Resolution `DecisionTrace` objects together in deterministic platform order without changing trace contents or execution policy. It remains unwired from Talk, call summaries, persistence, UI, Admin, and workflow behavior.
- The platform normalization result container in `app/lib/platform/ai/normalizationResult.ts` can carry `Concept[]`, `HouseholdConcept[]`, `ResolvedConcept[]`, and `DecisionTrace[]` together without invoking layers, reinterpreting outputs, mutating values, or wiring the platform into product workflows.
- For local phone demos, keep the normal Next dev app on port 3000 and run `npm run dev:connect-https` to expose an HTTPS bridge on port 3001. The bridge prints LAN dashboard/receiver URLs and generates ignored local dev certificates under `certificates/`; set `CONNECT_HTTPS_LAN_HOST` when the LAN IP changes and restart Next so `allowedDevOrigins` matches.
- `docs/CONNECT_AUDIO_DEMO_CHECKLIST.md` is the near-term Connect audio demo runbook for local LAN and internet demos. Keep it aligned with live-call behavior, summary approval, temporary transcript privacy, HTTPS microphone requirements, and TURN expectations.
- The standalone Connect Receiver Android direction is a thin native appliance shell, not a native rewrite of Connect. Keep the native shell under `android/connect-receiver`; it owns launch/provisioning, permissions, wake/reboot behavior, kiosk/device-owner hooks, WebView/TWA settings, native device/screen detection, install identity, version reporting, and future hardware-specific behavior. The hosted web Receiver remains the product surface and owns UI/layouts, fixed-resolution device profiles, copy, remote config, receiver-user changes, calls, messages, diagnostics, and most feature updates. Provisioning should be web-first and appliance-like: the preferred demo path is install/open Receiver, let the unpaired Receiver request a short-lived six-digit pairing code through `/api/connect/receiver-shell/pairing-sessions`, enter that code on `/connect/receiver/setup`, and pair it through `/api/connect/receiver-shell/pairing-sessions/pair` to the signed-in caregiver/admin's current Main Receiver User context. User-facing setup language should say Pair Receiver, Set Up Receiver, Receiver detected, and Receiver ready; claim remains internal/debug terminology. The native Receiver must not start the Receiver web surface from a plain installer/launcher open before a setup claim or bound receiver device exists; instead it shows a local confirmation/pairing screen that sends the user back to the browser setup page when caregiver action is needed. The native Receiver Mode wizard is local-first device configuration, not pairing/auth: it records `receiver_mode` (`dedicated` or `personal`), `provisioning_completed_at_ms`, and local capability statuses for full screen, microphone, kiosk, keep-awake, boot start, battery optimization, and update checks before continuing into the existing claim/bound-device flow. Human-typed setup URLs should support short word phrases such as `/r/kind-maple-chair` while keeping the underlying token opaque and separate. Provisioning links must never carry permanent account credentials. Published setup may also create signed-in, short-lived setup codes through `/api/connect/provisioning/receiver-devices/:receiverDeviceId/setup-token`; `/r/<setup-code>` redirects to `/connect/receiver/setup?code=<setup-code>`, and advanced/local setup can exchange only existing available codes through `/api/connect/receiver-shell/claims`. Bare `/r` redirects to prototype `12345` only in local/dev or when `CONNECT_RECEIVER_ALLOW_PROTOTYPE_SETUP_CODE=1`; `12345` is not the normal published provisioning path. The APK may keep a pseudonymous app-private `receiverInstallId` plus optional server-issued `receiverDeviceId` as non-secret receiver binding hints; durable receiver credentials should move to Android Keystore-backed storage when implemented. Local binding status values are `unprovisioned`, `local_test`, `setup_pending`, `claim_pending`, and `bound`. `supabase/sql/2026-06-27_connect_receiver_provisioning.sql` defines the first durable `connect_receiver_devices` and `connect_receiver_claims`; `/api/connect/receiver-shell/claims` prefers Supabase service-role storage and falls back to local files only when Supabase/tables are unavailable in development. `/api/connect/receiver-shell/devices/binding` verifies bound devices by matching `receiverDeviceId` and `receiverInstallId`, updates `last_seen_at`, mirrors native Receiver mode/capability/device-profile fields into `connect_receiver_devices` when `supabase/sql/2026-06-28_connect_receiver_device_profiles.sql` has been applied, and is the startup hook for revocation/re-provisioning behavior. `/connect/receiver/setup` is the first install-from-link page: its primary path is now Install Receiver -> Open Receiver and get code -> Enter code to pair; setup-page QR, dedicated-device QR, local/debug claim creation, and emulator tools live under Advanced setup. Local development can serve the debug APK from `/api/connect/receiver-shell/apk/debug`, while production/release installs should use `CONNECT_RECEIVER_APK_URL`. The setup page can also generate a factory-reset Android dedicated-device QR payload when it has a reachable APK URL and APK SHA-256 checksum; the QR passes the current CarePland provisioning link as admin extras, and the native admin receiver stores that link when Android completes owner provisioning. `/api/connect/receiver-shell/update-policy` is the first remote update decision point: the shell reports version/device facts and the server can answer current, update-recommended, or update-required, and Connect Dashboard can surface that status for a bound receiver. Current policy responses are advisory and set `canSelfUpdate: false`; unattended APK replacement should be handled through Android Enterprise/managed Play/MDM or a later explicitly designed installer path. Server-side receiver binding, revocation, token rotation, and remote update-policy decisions remain the target durable model. The setup page includes a local browser-generated WiFi QR helper for initial network setup; it does not store WiFi credentials and is not managed WiFi provisioning. Temporary setup networks are a supported onboarding bridge for older appliance hardware, but mini-router/captive-portal automation is a future feature; the current priority is stable install/provisioning, launch recovery, bound-device visibility, and web-side update behavior for a real mom-device handoff. The long-term deployment goal remains a public HTTPS setup/provisioning path with short-lived claims so caregivers do not need to run laptop-hosted servers. Default phone/receiver behavior, kiosk, and hardware setting control should be phased after real-device testing. See `docs/CONNECT_RECEIVER_ANDROID_SHELL.md`.
- Browser-opened Receivers are first-class Receivers, not just setup helpers. An unpaired `/connect/receiver` browser session should create a browser-local receiver install id, request/display a six-digit pairing code, poll pairing status, redeem the paired internal claim, and store the bound receiver-device identity locally. The browser-local install id is CarePland's retained browser UUID; it is the browser Receiver continuity key and should preserve the Receiver's existing name/binding across ordinary disconnects, reloads, browser restarts, and long silent periods unless the user clears site data, uses a different browser/profile/device, revokes/re-pairs, or deletes the Receiver. Browser semantic details such as browser name, OS, version, timezone, and screen size are hints for labels or user confirmation only, not trusted identity. A Receiver that already has a local or native receiver identity must first verify its existing binding and show a setup-check state rather than requesting a fresh pairing code; pairing-code polling is only for truly unpaired setup sessions or explicit re-pairing after the server says the binding is missing, revoked, expired, or mismatched. The normal signed-in caregiver path is Connect -> Receiver -> Pair Receiver, where the entered code binds the Receiver to the currently selected Main Receiver User / Receiver Active Person. Pairing from an existing Receiver should replace that Receiver's install binding rather than creating another lasting Receiver record. `/connect/receiver/setup` must keep working for direct/public setup links and install-oriented flows, but it is not the required in-app pairing surface when the caregiver is already in Connect.
- Unpaired/uninitialized Receiver setup placeholders are low-retention records, not durable audit artifacts. If a setup-pending Receiver has no paired/bound identity, no heartbeat, no care circle, and no Main Receiver User, it may be deleted directly even when it has a browser-local install id used only to reuse the same pending placeholder. These placeholders expire after 30 minutes, and Receiver Settings can expose a direct Delete action for immediate cleanup without confirmation.
- Receiver kiosk status must distinguish normal Device Admin from true Device Owner. Device Admin can be opened from the native wizard as a setup aid, but reliable lock-task/kiosk behavior requires device-owner provisioning through Android Enterprise, managed Play/MDM, a QR device-owner flow, or factory-reset hardware testing with `adb shell dpm set-device-owner com.carepland.connectreceiver/.ReceiverDeviceAdminReceiver`.
- Dedicated Receiver mode owns appliance-style recovery behavior in the native shell: boot/package-replaced/power-connected auto-launch is enabled only after the local provisioning wizard records `receiver_mode = dedicated`, and recovery launches take a short wake lock so the Receiver has time to reopen. Personal Device mode must remain a normal Android app and should not auto-launch or aggressively return to the foreground.
- Receiver hardware profiles, Receiver UI layouts, and Receiver UI schemas are separate concepts. A hardware profile describes install context and device facts such as model/manufacturer, expected screen size, density, orientation, audio/handset quirks, kiosk expectations, and native policy. A UI layout describes the hosted Receiver presentation family such as `desk_phone_1024x600`. A UI schema describes the actual appliance layout rules, zones, footer behavior, minimum touch sizes, panel mode, and feature-slot expectations. Hardware profiles may select default UI layouts/schemas, but provisioning and dev testing can override them independently. Early profile examples include `grandstream_gxv3370`, `studio_gxv3370_1024x600`, `generic_hd_landscape_android`, `generic_landscape_android`, and `generic_android_phone`; the first concrete schema is `gxv3370_classic_1024x600_v1` in `app/lib/connect/receiver/receiverUiSchemas.ts`. Receiver features should consume a normalized Receiver Runtime Contract, now started in `app/lib/connect/receiver/receiverRuntimeContract.ts`, that carries receiver identity, Receiver Active Person, runtime (`classic_webview` or `modern_web`), hardware/display facts, selected UI layout, UI schema id/version, scale mode, device mode, version, and capability statuses. A 1920x1080 Android 7 kiosk display can be recognized as `generic_hd_landscape_android` while still using `desk_phone_1024x600`, `gxv3370_classic_1024x600_v1`, and `scale_to_fit` for early testing.
- Android 7-era appliance WebViews such as the Grandstream/GXV3370 class and iTab-style Android 7 kiosk displays may not reliably run the modern React/Next Receiver client bundle. The near-term Receiver strategy is one APK with strict hosted renderer separation: modern React work stays under the `modern_web` runtime at `/connect/receiver`, while Classic WebView work stays under the `classic_webview` runtime at `/connect/receiver/legacy` and uses plain server-rendered HTML/CSS plus Android-7-compatible JavaScript. Do not split APKs solely for UI/layout differences, and do not blur Classic WebView/modern implementation directories with scattered conditional UI branches. Classic WebView is now a real appliance renderer to polish first for current lower-cost and older test hardware, not merely a temporary error page or mockup.
- The Classic WebView Receiver route must still perform the native binding heartbeat. It reads `window.CarePlandReceiver.getProvisioningJson()` and posts version, Receiver mode, capability, kiosk, and recovery facts to `/api/connect/receiver-shell/devices/binding` using Android-7-compatible JavaScript so Admin/Dashboard status remains accurate on GXV-class hardware.
- The native Receiver should recover from temporary Receiver-server unavailability without caregiver intervention. If the configured Receiver page cannot load or does not become ready, show a calm local error/retry screen and keep retrying automatically.
- Connect Dashboard Guide mode is deprecated/paused as of 2026-07-13. The previous API-mediated design wrote guide highlights through `/api/connect/receiver-guide`, had Receiver windows announce per-window session ids, and let Guide send short-lived identify codes to a live Receiver window. That always-on polling pattern was a top Vercel invocation offender, so modern Receiver, classic Receiver, and dashboard recurring Guide polling are intentionally disabled. Future Guide work should be opt-in/debug-only, realtime-based, or otherwise bounded before reintroducing `/api/connect/receiver-guide` loops; see `docs/CONNECT_RECURRING_REQUESTS_POLICY.md`.
- `Connect Archive` is an Admin-only main-nav tab at `/connect-archive/dashboard`. It is a copied page/component snapshot of the Connect dashboard intended to preserve the current Connect web-side experience while the live `Connect` tab is refined, removed, or relocated. Future Connect UI edits should target the live dashboard first and only intentionally sync archive changes.
- Admin-only top chrome and debug/test controls such as the Dev environment pill, admin status counters, Messages `Dev View`, and the Home `Show CarePland at a Glance test` checkbox can be hidden by admins through the profile/focus selector menu with `Show Admin Items`. `Connect Archive` is additionally behind the Admin dashboard `Show All Top Nav` override, so it stays out of the normal admin top nav unless the broader top-nav/debug module view is enabled. Keep these toggles outside Admin-only navigation so admins can restore hidden chrome without first opening Admin. If a hidden admin test control was actively showing a preview, hiding admin items should also disable that preview state.
- Sample/test data now has three layers. The existing Health Focus sample seed creates longitudinal care history for appointments, Visit Notes, CarePrep, Health Topic mentions, and Health Topic feedback. The `sample_seed_meaning_v3` layer adds current meaning/action examples for Recommendations, Today's Focus, Track Events, Connect Messages, Focus cadence preferences, and CarePland Work Events so seeded accounts can demonstrate how CarePland turns understood context into reviewable, traceable product work. The `sample_seed_receiver_messages_v1` layer adds a bound demo Receiver, Connect participant/settings rows, richer Messages, appointment-linked MessagePrep, Receiver interaction attempts, a call-summary example, and Admin operational examples for Help/Priorities/Checkpoint. Keep removal parity whenever adding sample rows: user removal must clean only rows clearly marked as sample data and leave real user information intact.
- CP Pers Home has a `Launch Test Receiver` affordance near Receiver Setup. It opens the real web Receiver in local-test provisioning mode with the GXV-style test profile, giving product/testing chats an immediate Receiver surface without requiring Android hardware or durable pairing first. This is a launch affordance, not a replacement for future durable demo Receiver, Message, MessagePrep, interaction, or call sample data; ask Andrew before adding those sample-data layers and justify what each would let the team evaluate.
- The live Connect dashboard has been simplified for the next web-side refinement pass: its Settings content is also hosted under Profile & Settings as `Receiver Settings`, with Main Receiver User selection at the top of that panel. The main Connect home no longer presents live-call controls, incoming-call state, or call-path diagnostics. The archive remains the preserved copy for removed/relocated surfaces.
- Receiver Setup has an installer-style overlay launched from Home/Connect and Receiver Settings, and `/connect/receiver/setup` now renders the same universal wizard for public/direct setup links such as setup.carepland.com and `/r/<setup-code>`. Keep generic overlay/progress/navigation/status/resume concerns reasonably separable for possible future guided setup flows, but do not create a broad onboarding framework yet. Receiver identity, pairing, install metadata, Web Receiver URL, and Android provisioning remain Receiver-specific. The wizard starts with a setup-path choice that lets the user choose Android App or Web Browser, then continues through Install, Receiver User, Pair, and Complete Setup. In Connect context, `care_subjects.account_user_id` identifies the signed-in account person for setup presentation, so Receiver User choices can show `(You)` and self-use can disable message/call actions without display-name, email, or `is_default` matching. Receiver Setup may offer to create the missing account-linked real person row as an explicit setup action. See `docs/RECEIVER_SETUP_OVERLAY_IMPLEMENTATION.md`.
- The GXV3370/desk-phone Receiver profile is a landscape-only appliance UI, not a mini dashboard. Use `?device=gxv3370` (persisted locally) for this profile. Its home screen should stay brutally simple with huge tap targets, no person selector chrome, no small navigation, and primary actions such as `Call [primary contact]`, `Ask a Question`, `Appointment`, and `Messages` alongside high-contrast time/greeting/appointment status. Call screens should read like a phone/intercom appliance: incoming calls show `ANSWER` and `NOT NOW`; connected calls show `Connected to [primary contact]`, `Use the handset or speaker.`, and one dominant `END CALL` action. GXV task surfaces such as Ask, Messages, and Appointments should behave like full-screen appliance panels, not centered web modals; use a top toolbar, large/simple controls, concise empty states, and bottom paging where relevant. The home header can show the small browser fullscreen `MAX` / `MIN` control for non-kiosk browser use, but it should be hidden when native kiosk/lock-task mode owns fullscreen behavior.
- Receiver layout staging now lives as a top-level Admin `Layout` page, not inside Connect. The Admin Layout area renders the real Receiver route in a local-test iframe and uses the code-native catalog in `app/lib/connect/receiver/receiverLayoutCatalog.ts`. Treat layouts like branchable product surfaces with four lifecycle buckets: `active` layouts are assignable today and visible to customers; `proposed` layouts are admin-only works in progress; `experiment` layouts are intentionally testable variants that may later sit behind flags; `archive` layouts are old reference layouts and are not assignable. Every catalog entry must carry `productionReady`, `assignable`, and `customerVisible` booleans so production readiness, assignment eligibility, and customer visibility stay distinct. Layout previews may use URL-driven fake provisioning to create a temporary local-test Receiver context; when richer fake data is needed, prefer plugging that profile into the existing Receiver sample/test data layer instead of inventing isolated mock content.
- Receiver Notifications is an untitled contextual home-surface slot, not a list or notification center. It presents at most one notification at a time: the highest-priority contextual information that is not already represented elsewhere on the Receiver screen. It should avoid duplicating visible appointment, message, online/offline, or action-state information unless the notification adds materially different context. Read/seen messages should not automatically disappear from this slot merely because the recipient opened them; permanence rules are product policy, not an implicit side effect of `read_at`. When no higher-priority item needs action, the notification copy may explicitly state the lifecycle state, such as `You have a message you've read from [Name]`, so caregivers and recipients can distinguish old-but-still-relevant context from urgent unread attention.
- Receiver message lifecycle states should remain distinct: `delivered_at` means the message reached durable Receiver delivery infrastructure; future `seen_at` may mean the message was visible in a list or home surface; `read_at` currently means the individual message reader was opened; `heard_at` means audio/text playback was started; `acknowledged_at` means the recipient explicitly pressed OK; and `callback_requested_at` means the recipient requested a callback. Opening the Messages list should not be treated as full acknowledgement. Appointment message history should avoid status-pill clutter: show quiet timestamp-sized copy such as `Seen by Rob` when `read_at`, `heard_at`, or `acknowledged_at` indicates the recipient engaged with the message. The current schema has `read_at` but not `seen_at`; add `seen_at` later if list/home visibility becomes important to caregiver status.
- Durable Connect messages are now the shared CarePland message record for person-centered communication surfaces. CarePland messages people, not appliances: `connect_messages.main_connect_user_person_id` is the current physical column for the recipient person / person inbox, and nullable `appointment_id` links a message to an appointment when relevant. Existing messages with no appointment remain valid general messages; do not duplicate message content into appointment-specific tables. Normal caregiver/dashboard-created messages must not target a specific Receiver, and local/dev fallback messages should follow the same rule rather than storing a Receiver as the message owner. `connect_messages.receiver_device_id` is legacy/device-context only and should be left null for normal person-inbox sends; use separate receipt/status records later for per-Receiver display, seen, heard, acknowledgement, notification, diagnostics, or offline-sync facts.
- Receiver assignment is intentionally sticky because it is a privacy boundary: changing `connect_receiver_devices.main_connect_user_person_id` changes which person inbox that Receiver displays. Replacing a device should be functionally seamless: shut off the old Receiver, pair the new Receiver, assign/select the same person, and the new Receiver displays that person's existing Connect inbox without message migration, duplication, or ownership rewrite. Message compose surfaces should choose the person only; Receiver ownership changes belong in Receiver Settings with deliberate confirmation.
- CP Pers Home has a Messages section for the selected Care VIP only. Everyone focus intentionally does not show a mixed person inbox; choose a concrete Care VIP to view recent messages. Appointment-related Home message clicks should open the associated appointment when it is still accessible, while general message clicks open the full Messages/Connect surface.
- CP Pers Home can show a concise selected-Care-VIP message summary above the existing recent message history. The current foundation is deterministic and reusable in `app/lib/personal/messages/homeMessageSummary.ts`: it extracts a small set of concrete communication points, preserves source message ids, merges only same-meaning points, and returns an Everyone/reinforcement summary only when at least two distinct people independently reinforce the same normalized meaning. Everyone summary is a reinforcement detector, not a merged inbox, household dashboard, or filler card; Home currently surfaces only the selected person's individual summary while keeping the full Messages area as the source of truth. The summary has a `Not quite` feedback path that records the visible summary, user concern, source message ids, key points, decision trace, and model/rule version in `home_message_summary_feedback` for audit and future summary-model improvement.
- Connect Message History should use quiet homepage-style rows. Timeline rows use two compact lines: time plus appointment/direction, then date plus message body. By Appointment groups show the appointment title and message count, then the same compact message rows. Normal history views should not show `Needs OK` or callback status clutter; Dev View can still expose operational details underneath rows. The Messages page no longer has a Send/History submenu; it opens directly to history with a collapsed `New Message` composer at the top using the same compact composer layout as appointment message panels, followed by the existing history content.
- Appointment cards surface related messages from the same durable message records through quiet icon controls in the appointment action row: an envelope icon with a count opens related messages. When an appointment has no linked messages, the send icon also stays in the top action row; when linked messages exist, the send icon moves into the first message row so it reads as part of that thread. Avoid separate title-row `x Messages` / `New Message` text controls. The expanded related-message area should be visually quiet and self-evident, without a separate `Related Messages` title/action header. Typed appointment message drafts are preserved in session draft state and included in the shared unsaved-work warning before page changes or sign-out. Appointment message composer controls should not foreground semi-deprecated callback requests or `Needs OK`; appointment history should instead show quiet seen/read state when available. Only one appointment Messages panel should be expanded at a time. Sending a message from appointment context should pass that appointment id into the existing message creation flow so the new message is automatically related to the appointment.
- Appointment-context message creation must also pass the appointment's Care VIP/person id into the Messages surface so Connect sends as the same person the appointment belongs to. If durable message storage cannot save the appointment relationship, the send should fail visibly rather than silently falling back to a local/general message.
- Appointment-linked Connect messages can maintain a separate derived `appointment_communication_summaries` inventory. Internally, this meaning-making layer can be called MessagePrep. Raw `connect_messages` remain authoritative evidence; the derived inventory stores structured communication items by existing CarePrep category, source message ids, source display names, generation status, model/prompt metadata, and a decision trace. MessagePrep items should be as brief as possible while still covering the relevant context; prefer existing message summary/condensed-message metadata when available, then fall back to the saved message body/transcript. MessagePrep-derived What to Know rows should show compact provenance such as `Rob: Bring...` or `Rob et al: Bring...` when multiple source names contributed. Only new durable message creation with an appointment id should trigger normal summary evaluation; delivery/read/heard/acknowledgement/callback updates, fetches, page loads, Receiver events, and metadata changes must not regenerate it. CP Pers may run a scoped one-appointment rebuild when related messages exist but no active MessagePrep items have been materialized yet, so older appointment-linked messages can self-heal into What to Know. Treat What to Know as a display composition layer that can merge CarePrep and other appointment-side input streams at render time; communication-derived items should appear there with a quiet message-source icon without flattening them into `careprep_guidance`.
- The appointment-card refresh icon beside What to Know refreshes the composed What to Know view, not only CarePrep. It should run eligible CarePrep refresh, rebuild scoped MessagePrep from appointment-linked messages, reload the appointment details/messages, and keep the What to Know panel open.
- Receiver diagnostic mode is an Admin-only testing affordance, not recipient-facing product language. Admin > Connect > Interaction Traces can enable a temporary muted Receiver Ask/Tell result readout showing the Observation -> MeaningFrame -> family/interpreter -> response path plus a small Trace popup for the current/last Interaction Attempt chain. The Receiver ID remains visible for all users as a quiet identity/naming affordance, not as an Admin-only diagnostic badge.
- Receiver Ask/Tell speech uses message condensation only when the final transcript exceeds the Receiver text-input limit. The editable text field and sendable condensed draft remain capped for appliance usability, but the captured speech transcript has its own longer limit and must not be clipped to the text-input limit before condensation. Short speech continues through the existing Observation -> MeaningFrame -> Interaction Family -> interpreter path unchanged. For long speech, the full transcript becomes the immutable Observation and is retained in the Interaction Attempt; a condensed draft is a derived, editable message preview only. The user must approve the draft before sending, and diagnostics should record the original transcript length, condensation trigger, draft, edits, approval, and final transmitted message. Condensation is message preparation, not interpretation, and must not replace the original Observation or feed future knowledge retrieval in place of the original transcript.
- Receiver Offline Awareness v1 is web Receiver behavior, not Android shell/APK behavior. It shows clear Online/Offline/Offline — using saved appointment info status on Receiver home, caches only minimal upcoming appointment display fields with `cachedAt` after a successful online appointment load, and uses that cache only as a stale fallback hint during temporary connectivity loss. Server data remains authoritative. This is not full offline mode: do not queue offline writes, do not allow write-like local state for server actions while offline, and do not cache Messages, Talk, calls, call summary approvals, Focus completions, transcripts, Decision Traces, recommendations, or other interactive/authoritative data for offline use. Online-required Receiver actions should be visibly subdued when offline and explain that the feature needs an internet connection when tapped. Cache classes for future planning: Static assets such as UI assets/sounds/icons can cache indefinitely; Configuration such as Receiver settings and approved Care VIP lists should refresh on reconnect; Read-only operational displays such as upcoming appointments and Today's Focus display may show offline with a timestamp; Interactive surfaces such as Messages, Talk, calls, approvals, and write actions require connectivity; Authoritative records such as Decision Traces, transcripts, and recommendations remain server-authoritative and are never cached for editing.
- Receiver pages should not perform idle content polling. As of 2026-07-13, Receiver home content loads on startup, explicit user actions, and return-to-active-app checks; recurring message polling is limited to active message-reading surfaces, while Connect calls and Receiver Guide recurring polling are disabled because those paused features were the top Vercel invocation offenders. Future Receiver polling changes must follow `docs/CONNECT_RECURRING_REQUESTS_POLICY.md`.
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
- CarePrep refresh should be gated before metering/model work when the latest saved/draft CarePrep already considered the same total count of relevant prior appointments and there are no newer saved Visit Notes among those prior appointments. Updated notes on an already-considered appointment are a material context change and should allow refresh. The editable Dynamic Text key `careprep_refresh_not_ready_message` explains the blocked case in user-facing language without exposing target/count/debug details; current default: `CarePrep is already up to date for this appointment. Add or save new Visit Notes, then try again.`
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
- CarePland Family is not part of the MVP. `/family/*` product routes are Admin-only prototype surfaces; non-admin and signed-out users must not be able to navigate into them.
- Care VIPs have a person-level `managed_by_household` flag surfaced as `Managed Care VIP`. User-facing help text should explain: `This Care VIP will not log in to CarePland directly. If configured, they can still use Receiver. This is useful for children, pets, and others who won't be personally logging into CarePland.` This setting covers young children, parents with cognitive impairment, spouses or adults who prefer someone else to manage the app, and pets, without requiring CarePland to infer diagnoses or capability. Pets are treated as managed by household by default and the option is checked/disabled for them. The initial behavior should be conservative: managed people may appear in read-only Coordinator views such as CP Pers Home Today's Focus, but Coordinator completion/update actions for their Focus should stay disabled until the managed-person workflow is explicitly designed.
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
- Session-lost handling is now shared through `app/lib/platform/sessionValidity.ts`; keep signed-in app and Receiver surfaces on that shared guard rather than restoring older local signed-out/session-lost TODOs.

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

Internally, Import Anything interpretation/review outputs can be called ImportPrep when referring to the shared Prep-family pattern: CarePland turns a collection of source data into useful, reviewable meaning without making the user understand the implementation path.
- Import Anything performs identity resolution immediately after analysis and before object review, appointment matching/creation, medication ownership, task ownership, CarePrep ownership, or MessagePrep ownership. Unknown detected people must be explicitly matched to an existing Care VIP, explicitly created as a new Care VIP when capacity allows, or explicitly left unresolved. CarePland must never silently substitute an existing Care VIP or create a Care VIP during save/object review; unresolved ownership remains empty and downstream owner-required writes are skipped/blocked rather than attached to another person.
- Import Anything should not discard standalone Visit Notes just because no existing appointment matches. If Visit Notes appear to describe a real unsaved visit, the review should say that it looks like a new appointment; when approved, CarePland creates the appointment from supported details and saves the Visit Notes onto it.
- If Import Anything is unsure which appointment Visit Notes belong to, the review should let the user attach the notes to an existing appointment instead of forcing the new-appointment path.

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
- The onboarding helper is also available from profile setup. It should explain that profile requirements depend on auth source: Google/Apple-style OAuth should keep extra contact/profile fields optional unless the UI marks them otherwise, while email/password or email-update setup may require basic account/contact fields such as first and last name, phone, time zone, street address, city, state, and ZIP for dates, account recovery, and support follow-up. Keep this from sounding like a medical intake form.
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
- OpenAI Responses API calls should use the shared platform boundary in `app/lib/platform/ai/responses.ts` when practical. That helper owns provider endpoint details, API-key validation, request-id capture, response JSON parsing fallback, and canonical output text extraction so workflows can focus on structured inputs, schemas, prompts, logging, and product-specific fallback behavior.
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
