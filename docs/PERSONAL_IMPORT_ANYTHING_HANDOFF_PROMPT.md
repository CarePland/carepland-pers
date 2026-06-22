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
- broader OCR support in `app/api/ocr/route.ts` using `scope=import_anything`
- Personal quick-add UI inside `app/CarePlandPers.tsx`
- documentation at `docs/PERSONAL_IMPORT_ANYTHING_WORKFLOW.md`

The first pass is intentionally non-destructive and additive:

- Users can paste text and/or add screenshots, images, PDFs, portal messages, appointment reminders, discharge instructions, and other healthcare content without choosing an import type first.
- Images are OCRed.
- Text files are read locally.
- PDFs are accepted and preserved as source references, but full PDF text extraction is not wired yet.
- AI detects appointments, providers, locations, medication changes, notes, tasks, questions to ask, and CarePrep-relevant content.
- Existing appointments are supplied as match candidates.
- High-confidence matches may be proposed.
- Uncertain items must be marked `needs_review=true`.
- Existing manually entered records should not be changed automatically.
- The user reviews, edits, approves, or rejects each detected item before anything is saved.

Current approved-save behavior:

- Approved unmatched appointments create new `appointments` records.
- Approved notes with a matched appointment save through `/api/appointment-notes`.
- Providers, tasks, medication changes, questions, and CarePrep items are currently retained in intake audit/review metadata until durable destinations are selected.

Before making changes, review:

- `docs/PERSONAL_IMPORT_ANYTHING_WORKFLOW.md`
- `app/api/import-anything/route.ts`
- `app/api/ocr/route.ts`
- the Import Anything section in `app/CarePlandPers.tsx`

Suggested next work:

1. Verify the Import Anything UI in-browser.
2. Improve PDF text extraction if a local/server-side PDF parser is already available in the repo.
3. Route approved tasks/questions/CarePrep items into existing Personal or CarePrep destinations if those persistence flows exist.
4. Improve provider matching/reuse without creating duplicate provider records.
5. Consider adding a compact “source bundle” or attachment strategy for preserving uploaded source files, not only text/source names.
6. Add focused tests for the import route and review mapping if the project has suitable Personal test patterns.

Validation already passed after the initial implementation:

```bash
npm run lint
npm run build
```

Please keep this workflow review-first, low-jargon, and aligned with CarePland Personal’s simple intake philosophy.
