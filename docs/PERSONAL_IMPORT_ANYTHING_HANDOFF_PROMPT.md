# CarePland Personal Import Anything Handoff Prompt

Use this in a fresh Codex chat to continue the Personal Import Anything work separately from Connect.

## Command

```bash
cd /Users/agoodloe/Documents/Codex/CarePland/APP_CODE/carepland-all
```

## Prompt

This is for CarePland Personal, not Connect.

Please continue the new Import Anything workflow in the merged CarePland app at:

`/Users/agoodloe/Documents/Codex/CarePland/APP_CODE/carepland-all`

Important separation notes:

- Avoid CP Connect files unless absolutely necessary for shared build/type issues.
- Another thread may be working on Connect user linking and Connect audio.
- This thread should focus on Personal Import Anything only.
- Preserve the merged architecture.
- Keep existing appointment import, OCR import, notes import, provider matching, and CarePrep flows working unchanged.
- Do not remove, replace, or alter existing specialized import buttons during this phase.

Current implementation already added:

- `app/api/import-anything/route.ts`
- `app/api/import-anything/pdf/route.ts`
- `app/lib/personal/importAnything/*` normalization, review-mapping, source-formatting, appointment-candidate, and provider helpers/tests
- broader OCR support in `app/api/ocr/route.ts` using `scope=import_anything`
- Personal quick-add UI inside `app/CarePlandPers.tsx`
- `supabase/sql/2026-06-22_care_providers.sql`
- documentation at `docs/PERSONAL_IMPORT_ANYTHING_WORKFLOW.md`

Latest UI verification:

- Signed-in Chrome verification on `http://localhost:3000/?personal=1&appointments=1` showed the Appointments toolbar with person/all-appts pills plus **Add**, **Import**, and **Older**.
- **Import** opened the quick-add panel and displayed the **Import Anything** area.
- **Review everything found** stayed disabled until text or files were added.
- No Import Anything-specific browser console errors were observed during that check.
- User tested separate `.txt` and `.pdf` uploads with harmless sample content.
- User completed a non-private-tab save. The observed success message was: `Import saved. 0 appointments created, 0 notes saved, 1 CarePrep draft created, 0 providers tracked, 2 items kept for review/audit.`
- After that save, the Import Anything review panel cleared and no Import Anything save errors were observed in browser logs.
- `supabase/sql/2026-06-22_care_providers.sql` has been applied to the Supabase dev project `CarePland-dev`.
- Verification query confirmed `care_providers` exists with 17 columns, 4 indexes, and 3 RLS policies.
- After the provider migration was applied, a fake provider-only Import Anything save through the app reported: `Import saved. 0 appointments created, 0 notes saved, 0 CarePrep drafts created, 1 provider tracked, 0 items kept for review/audit.`
- No Import Anything/provider save errors were observed in browser logs after that provider tracking test.
- Read-only Supabase verification found exactly 1 matching fake provider row for `Dr. Avery Stone / Test Harbor Cardiology`, with `source = import_anything`.
- Import Anything progress now participates in the existing session draft state. Extracted text, source names, review items, summary text, and intake id survive ordinary same-session navigation/reload and clear on save/discard/sign-out/session end.
- Import Anything source names and review items now count as unsaved work for sign-out, browser refresh, and quick-add close/switch warnings.

The first pass is intentionally non-destructive and additive:

- Users can paste text and/or add screenshots, images, PDFs, portal messages, appointment reminders, discharge instructions, and other healthcare content without choosing an import type first.
- Files can be added with **Add files** or by dropping them onto the Import Anything card.
- Images are OCRed.
- Text files are read locally.
- PDFs are extracted through `/api/import-anything/pdf` using OpenAI file input, with file count and size limits.
- AI detects appointments, providers, locations, medication changes, notes, tasks, questions to ask, and CarePrep-relevant content.
- Existing appointments are supplied as match candidates.
- High-confidence matches may be proposed.
- Uncertain items must be marked `needs_review=true`.
- Existing manually entered records should not be changed automatically.
- The user reviews, edits, approves, or rejects each detected item before anything is saved.
- AI output is normalized before review/storage so item counts, field lengths, confidence values, and matched ids stay bounded.
- Original uploaded images, PDFs, and text files are not retained after extraction/review processing. Keep extracted text, source file names, and accepted interpretation metadata only. Treat this as an intentional privacy position: extract the useful healthcare context without storing extra copies of sensitive source files.

Current approved-save behavior:

- Approved unmatched appointments create new `appointments` records.
- Approved notes with a matched appointment save through `/api/appointment-notes`.
- Approved matched tasks, medication changes, questions, and CarePrep-relevant items create draft `careprep_guidance` rows in the relevant sections.
- Approved newly seen providers are tracked in per-Care-VIP `care_providers` records when the migration is available.
- Saved providers are used only as quiet AI refinement context for the same Care VIP; do not expose a provider directory yet.
- Items matched to a saved provider should not create duplicate provider rows or silently overwrite saved provider data.
- A future “Do you mean this provider?” confirmation popup is roadmap-only; do not implement it yet without a new design decision.

Before making changes, review:

- `docs/PERSONAL_IMPORT_ANYTHING_WORKFLOW.md`
- `app/api/import-anything/route.ts`
- `app/api/ocr/route.ts`
- the Import Anything section in `app/CarePlandPers.tsx`

Suggested next work:

1. Add route-level tests for `/api/import-anything` and `/api/import-anything/pdf` if the project gets suitable API route test patterns.
2. Revisit a visible provider confirmation popup only after designing the review interaction.
3. Keep monitoring user-facing save summaries so matched/review-only items are counted clearly.

Validation already passed after the current implementation:

```bash
npm test
npm run lint
npm run build
```

Please keep this workflow review-first, low-jargon, and aligned with CarePland Personal’s simple intake philosophy.
