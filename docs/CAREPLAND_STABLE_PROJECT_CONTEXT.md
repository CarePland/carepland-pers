# CarePland Stable Project Context

Last updated: 2026-05-22

This document is the stable architectural and operational memory for CarePland Personal. It should be updated as assumptions change. Do not preserve obsolete decisions for historical completeness here; keep this document current, clear, and useful for future implementation chats.

## How To Use This Document

- Read this before making non-trivial product, architecture, AI, admin, or UX changes.
- Update this document when implementation decisions, terminology, business rules, workflows, or constraints change.
- Prefer concise stable facts over chat-style notes.
- If a topic is still speculative, mark it as future plan or open question.
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

CarePland Personal is currently a beta product. The old Adalo/Make/Twilio implementation is treated as product-discovery history, not as a code architecture to clone.

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
- Personal/default plan supports a single primary Care VIP experience.
- Personal Plus is visually/conceptually associated with multiple Care VIPs.
- Billing-grade enforcement is not complete; plan enforcement is currently lightweight and beta-oriented.
- Multi-user/family access is a future expansion, not a fully implemented permission system.

Future tiering may include:

- Additional Care VIP limits.
- CarePland Family / CP Family support.
- More formal subscription and billing enforcement.

## Care VIP Definitions And Rules

Care VIPs are the people whose appointments are tracked.

Current assumptions:

- A user can have one or more Care VIPs depending on entitlement.
- If only one Care VIP exists, patient-facing selectors should usually be hidden to reduce noise.
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
- Logged by adding notes.

Appointment views:

- Upcoming
- Logged
- Archived

Current user-facing appointment page direction:

- Reduce status bars and load-count messages.
- Keep `Upcoming / Logged / Archived` as the primary view controls.
- Move filtering/refresh beside view controls when useful.
- Hide Care VIP filter if only one Care VIP exists.
- Avoid heavy "Showing appointments" panels.
- Avoid showing Add Appointment / Import as always-dominant controls on the appointment list.
- Use map/calendar affordances inline with meaningful text rather than as repeated bordered utility buttons.
- Keep patient-facing appointment cards calmer than admin tools.

Current appointment-card direction:

- Practice/location name can link to Google Maps with a small map pin when an address exists.
- Calendar icon belongs near the appointment date/time, unboxed.
- Takeaways and Follow-ups should appear before CarePrep.
- CarePrep generation belongs inside the CarePrep section.
- If no CarePrep exists, show `Generate CarePrep` inside the CarePrep area.
- While generating, show an amber `Generating...` message until the CarePrep appears.

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
- For a last-appointment notes prompt, use concise actions such as `Add` and `Paste / Import`.

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
- The support assistant injects current Agent Knowledge into its context.
- Agent Knowledge should be updated when product capabilities change to prevent context drift.

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

- Admin tabs include tools, users/activity, integration errors, content, AI, assistant review, messages, product management, and tickets.
- Admin header/ticket indicators should show actionable counts with words, e.g. `New` and `Followup`, not mystery fractions.
- Admin tools may be denser than patient-facing pages.
- Admin pages may use wider layouts than user-facing pages.

Email notifications:

- Support reply notifications use email.
- Global email enable/disable toggle exists conceptually/administratively.
- `noreply@carepland.com` is the intended sender spelling.
- SMS/Twilio is future work and cost-sensitive.

## Dynamic Content And Messaging

Dynamic content admin exists for app text that may change, including:

- Beta/legal acknowledgement text.
- Support assistant copy.
- Support email content.
- Onboarding/welcome text.
- AI Agent knowledge.

Rules:

- Prefer dynamic content for wording likely to evolve during beta.
- Preserve version history.
- Reverting content should create a new current version.
- Keep user-facing messages calm and practical.

## Technical Stack And Architecture

Current stack:

- Next.js App Router.
- React client-heavy app in `app/page.tsx`.
- Supabase for auth, database, RLS, RPCs, storage of prompt/content/support/admin data.
- Vercel for deployment.
- OpenAI APIs for AI workflows.
- Google Places API for address/place lookup.
- SendGrid/email provider for support notifications.

Important files:

- Main app: `app/page.tsx`
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

MFA:

- Full MFA/2FA is not implemented.
- Twilio/SMS was used in the older Adalo implementation but is not currently part of core auth.
- SMS/text notifications are future work due to cost and operational complexity.

## Deployment And Environment Notes

Deployment:

- Vercel hosts the app.
- `app.carepland.com` is production/live.
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

Google Places errors:

- Show gentle user message when unavailable.
- Log aggregate integration errors for Admin.
- Do not expose raw Google API errors to users.

Demo/test users:

- Test-user flag should exist but should not be easy to toggle accidentally.
- SQL/admin maintenance scripts are acceptable for test-user flag changes.

## Implementation Decision Log

- Use Import instead of Quick Add for user-facing language.
- Keep support chat in-app rather than external Freshdesk/ServiceNow-style exchange for now.
- Prefer email notifications before SMS due to cost and complexity.
- Use `noreply@carepland.com`.
- Use Agent Knowledge in Admin AI section to keep the support assistant current.
- Use compact mark-only logo in signed-in header; keep fuller logo for signed-out context.
- Cap normal signed-in user-facing pages at 900px; allow Admin to be wider.
- Appointment toolbar extracted to `app/components/AppointmentViewToolbar.tsx` because it has a clean low-coupling boundary.
- Do not extract the full appointment card yet; it is too coupled to page-local state and would create a large prop bundle.

