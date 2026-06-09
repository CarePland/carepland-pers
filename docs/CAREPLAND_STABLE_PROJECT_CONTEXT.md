# CarePland Stable Project Context

Last updated: 2026-06-07

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
- Health Focus Home should prioritize human-facing health concerns over supporting extraction categories. Use plain-language narrative summaries and `View Story` framing; keep counts, dates, providers, and source snippets available but secondary.
- Existing current accepted Visit Notes can be retrofitted through `app/api/health-topics/backfill/route.ts`. Home may attempt one small signed-in backfill per Care VIP filter per session, then reload the summary; this is an early low-volume retrofit behavior, not a long-term background job system.

## Refactoring Direction

Current modularization is intentionally incremental:

- `app/page.tsx` remains the top-level orchestration shell for now.
- Stable Profile UI sections belong under `app/components/profile/`.
- Care VIP add, duplicate-email, reactivation, and soft-deactivation behavior belongs in `app/lib/profile/careVipActions.ts`.
- Profile draft hydration, normalization, and validation belongs in `app/lib/profile/profileDraft.ts`.
- Unsaved-change summary, appointment modifier close/switch, and Import panel close policy belongs in `app/lib/unsavedChanges.ts`; page components may own warning UI, but should not duplicate the rules for which drafts count.
- Draft normalization and comparison rules, including CarePrep guidance form values, belong in `app/lib/editorState.ts` unless they are specific to a narrower domain module.
- Health Focus / Reports work should continue through dedicated domain modules such as `app/lib/healthTopics/`, `app/components/healthTopics/`, `app/lib/reports/`, and dedicated API routes as needed. `app/page.tsx` should only orchestrate visibility and high-level state for this layer.

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
- Profile Care VIP management controls should only appear for entitlements that support multiple active Care VIPs.
- If more than one Care VIP exists, filtering controls can appear as "Showing: [All appts]".
- Appointment records may reference a `care_subject_id`.
- Multi-user access, role-based family sharing, and permission management are future work.
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
- Practice/location name opens a lightweight location details bottom sheet with provider, address, phone, and actions such as Maps and Call.
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
- The Home next-appointment panel should share the Appointments page visual language: appointment title/details at the top, with CarePrep presented as a blue-shell panel and white content interior.
- Home CarePrep can start expanded by default; clicking its `CarePrep` header may collapse or expand it.

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
