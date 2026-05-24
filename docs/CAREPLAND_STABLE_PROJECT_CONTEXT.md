# CarePland Stable Project Context

Last updated: 2026-05-22

This document is the stable architectural and operational memory for CarePland Personal. It should be updated as assumptions change. Do not preserve obsolete decisions for historical completeness here; keep this document current, clear, and useful for future implementation chats.

## How To Use This Document

- Read this before making non-trivial product, architecture, AI, admin, or UX changes.
- Update this document when implementation decisions, terminology, business rules, workflows, or constraints change.
- Prefer concise stable facts over chat-style notes.
- If a topic is still speculative, mark it as future plan or open question.
- More than one implementation chat may run at the same time. Each chat should stay contextually focused and avoid overlapping edits where possible to minimize conflicts.
- Modularize progressively and intentionally as patterns stabilize. Avoid premature abstraction and unnecessary micro-components.
- Separate logic from `app/page.tsx` when it improves architectural clarity, maintainability, and separation of concerns, not merely for stylistic purity.

## Product Philosophy And Positioning

CarePland Personal helps people remember appointment details, prepare for future visits, and bring useful context forward. The product is a personal appointment memory and preparation system, not a medical advice system.

Core philosophy:

- Reduce cognitive burden for people managing appointments and follow-up details.
- Close the loop between visits: capture what happened, remember what matters, and bring the right context forward.
- Accept information in the form users already have: manual entry, pasted text, uploaded images, and `.ics` calendar files.
- Use AI as a quiet assistant. Avoid making "AI" the user-facing product identity.
- Maintain audit trails for meaningful data changes, AI outputs, admin edits, support interactions, and prompt evolution.
- Prefer calm patient-facing surfaces over admin-style control panels.

CarePland Personal is internally managed as a beta product, but user-facing product language should call this phase `Early Access`, not `Beta Testing` or `beta`, unless referring to internal operations. Early Access means the same rollout/testing phase as internal beta testing while presenting a more confident user-facing posture. The old Adalo/Make/Twilio implementation is treated as product-discovery history, not as a code architecture to clone.

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
- Early Access is a distinct plan tier for early adopters. Functionally, it currently matches Group/full-access behavior, supports multiple Care VIPs, includes automatic CarePrep, and should help distinguish early adopters from later paid subscribers.
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
- Demo data should be offered as clearly labeled examples to explore, not as a required setup step.
- Demo-data copy should reassure users that examples are fictional/clearly labeled and removable without affecting real appointments.
- Regular user-facing Home, Appointments, and Profile pages should include a tiny soft-gray footer with centered `© 2026 CarePland` and a subtle `Why CarePland` pill on the right that opens the welcome explanation. Keep it off the welcome page itself.
- For admins viewing user-facing pages, show build metadata quietly on the left side of the same footer rather than as a separate patient-facing footer block.
- Welcome dismissal is database-backed on `profiles` with `welcome_guide_dismissed_at` and `welcome_guide_dismissed_version`, not browser-local storage. Reset by clearing the fields or bumping the app's current welcome version. Deliberate clicks away from Welcome, including Dismiss, main navigation, and get-started actions, mark it read; closing the browser/window without action should leave it unread.
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

Agent knowledge:

- Admin AI area includes Agent Knowledge content for product facts, known limitations, and escalation guidance.
- Agent Knowledge also includes voice/tone guidance so the support assistant stays warm, steady, practical, empathetic without pretending intimacy, supportive without being syrupy, and clear about limits without sounding cold.
- The support assistant injects current Agent Knowledge into its context.
- Agent Knowledge should be updated when product capabilities change to prevent context drift.
- Agent Knowledge includes Early Access plan tier facts, CarePrep metering context, and the limitation that self-service billing/plan changes are not wired up yet.
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

Admin:

- Admin tabs include tools, users/activity, Early Access intake, integration errors, Dynamic Text, AI, assistant review, product management, and tickets. Do not add a separate top-level Messages tab; short messages belong in Dynamic Text.
- Admin Early Access Intake stores interested people/prospects separately from Supabase auth users. Intake records should capture name, email, optional phone, relationship to care, communication preference, read-only consent status, `What interests you about CarePland?`, source, status, last contacted timestamp, and admin notes.
- Early Access intake is the staging area for follow-up before account creation. Do not create placeholder auth accounts merely to track interest.
- Future individual/group communication workflows should build from Early Access intake records and communication preferences rather than ad hoc email threads.
- Admin header/ticket indicators should show actionable counts with words, e.g. `New` and `Followup`, not mystery fractions.
- Admin navigation uses durable per-admin freshness state for breadcrumb-style attention indicators only for operational/admin-response queues. Red means new/unseen by that admin and takes priority over yellow. Yellow means known but still needs follow-up/action. These indicators should apply to things that require an admin response, such as system/integration errors, user-reported support tickets, Early Access intake follow-up, assistant-review items, and reviewable AI proposals. They should not light up for admin-authored backlog/content surfaces such as Product Mgmt lanes/items, Dynamic Text edits, prompt/version history, wishlist entries, bugs entered by the admin, or other internal notes that are better summarized later by Admin HQ/dashboard tooling.
- Voluntary development halt: Admin HQ/dashboard prioritization and further Admin attention/polish work should pause until real operational data accumulates from actual use. Future chats should remind Andrew of this pause if he starts expanding Admin dashboards, prioritization agents, extra alert layers, or related polish without a concrete real-world signal. Existing scaffold can remain, but avoid deeper implementation based only on imagined needs.
- Admin tools may be denser than patient-facing pages.
- Admin pages may use wider layouts than user-facing pages.
- Admin-only Auth maintenance that touches `auth.users`, such as updating a tester's login email, must run through protected server routes using `SUPABASE_SERVICE_ROLE_KEY`; never expose service-role keys or Auth admin operations to browser/client code.
- Admin Users / Activity supports a read-only `View as user` workflow for test-account pre-flight and troubleshooting. It is not auth impersonation and should not create a Supabase session as the target user.
- Read-only admin user views should default to metadata and account/workflow shape. Sensitive profile/contact details, full appointment titles, appointment times, full provider/practice/location details, appointment details, Notes, CarePrep bodies, support message bodies, imported text, and extracted content should stay hidden until deliberately revealed. Appointment previews may show dates plus short prefixes of title/provider/practice/location so the view remains operationally useful without exposing full details.
- Non-sensitive appointment metadata such as created/updated timestamps, short record IDs, Care VIP assignment, note/CarePrep presence, and draft/current state can be shown in Admin read-only views to support import QA and troubleshooting.
- Sensitive reveals should be backed by admin-scoped RPCs and audit events, not by simply hiding already-loaded sensitive content in the browser.
- Admin access is beginning to move from a single `is_admin` flag toward extensible permission scopes for future staff roles. `is_admin` remains the current owner/admin compatibility flag.

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
- Profile helper text, including the expandable plan-tier explanation.
- Short workflow messages, including the manual CarePrep plan-limit message.
- AI Agent knowledge.

Rules:

- Prefer dynamic content for wording likely to evolve during Early Access.
- Preserve version history.
- Reverting content should create a new current version.
- Keep user-facing messages calm and practical.
- Profile plan-tier helper content supports line breaks and a tiny safe inline formatting subset for bold text: `<b>` and `<strong>`.

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

Core public positioning:

- `Complete the appointment loop.`
- CarePland helps people and loved ones bring the context that matters to the next visit.
- CarePland turns past visits, notes, and care history into actionable preparation for the next appointment.
- Healthcare asks patients to be active participants, but most tools are built around providers and systems. CarePland is purpose-built for patients and caregivers in the space between appointments.
- CarePland helps people arrive prepared to collaborate with their clinician; avoid framing the product as replacing or competing with the doctor.

Website content assumptions:

- Narrative order: identify the problem, show the cause, offer the answer.
- Public section sequence should be: hero/appointment-loop preview, gap-between-appointments video section, continuity-breakdown panels, patient-tools asymmetry, care-history-to-appointment-readiness, Early Access signup.
- Keep CP Pers out of the initial public website narrative unless it becomes necessary later; the current homepage should avoid internal feature jargon.
- Public pricing/tier explanation can live on the website; draft website copy is preserved in `docs/CAREPLAND_PRICING_TIERS_WEBSITE_COPY.md`.
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
- Email confirmation.
- Password reset/update password flow.
- Profile setup after signup.
- Required profile basics include name, phone, ZIP, and time zone.
- Supabase signup confirmation and password-reset links must resolve to `https://app.carepland.com`, not `carepland.com` / `www.carepland.com` or the Vercel deployment URL. The public domains are the website/front door; auth handoff belongs in the app.

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
- Avoid confirmation prompts for harmless, reversible actions such as signing out. Use confirmation or warning prompts when an action would discard unsaved user-entered changes, remove user data, or otherwise create meaningful loss.
- Treat copy fit and line breaks as part of the design system, not incidental cleanup. Patient-facing UI should avoid awkward orphaned words, stranded helping verbs, cramped labels, and accidental wraps when a small wording change, deliberate line break, or modest layout adjustment can make the surface feel calmer and more polished. Single words should generally not wrap alone to a new line, and intentional multi-line word groups should look visually balanced.

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
- Appointment records use one white workspace with divider-separated records rather than individual card borders/shadows.
- Public website CTA should point to Early Access signup during the internal beta phase rather than repeatedly sending users to the app.
- Public website video should be embedded from a hosted video service/CDN rather than committed as a large deployment asset.
- Admin `View as user` is implemented as read-only admin snapshot/reveal RPCs with audit logging rather than true session impersonation. Sensitive data should be fetched only after an explicit reveal action.
- Admin Early Access Intake stores prospects separately from app users so interest and communication follow-up can be managed before account creation.
