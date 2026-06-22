# Personal Import Anything Workflow

## Purpose

Import Anything is a non-destructive Personal intake workflow. A user can paste text or add screenshots, images, PDFs, portal messages, appointment reminders, discharge instructions, and other healthcare content without choosing an import type first.

The workflow proposes actions, then waits for user review before anything is saved.

## Reuse Of Existing Intake Pieces

- Image OCR reuses the existing `/api/ocr` endpoint with a broader healthcare extraction prompt only when Import Anything requests it.
- AI interpretation follows the existing intake pattern: authenticated request, `intake_items` audit record, OpenAI structured response, then user review.
- Approved new appointments route into the existing `appointments` table.
- Approved notes matched to an existing appointment route through `/api/appointment-notes`.
- Existing appointment-specific import buttons and OCR import behavior remain unchanged.

## Matching Logic

The server sends the AI a bounded list of existing appointment candidates for the selected Care VIP. The AI may set `matched_appointment_id` only when the source text directly supports a high-confidence match.

If a match is uncertain, the item must leave `matched_appointment_id` empty and set `needs_review=true`.

The initial implementation does not update existing manually entered appointment records from Import Anything. Matched appointments are treated as review/audit context unless the approved item is a note that can be safely attached through the existing notes flow.

## Needs Review Behavior

Every detected item carries:

- `confidence`
- `needs_review`
- `source_excerpt`
- editable fields
- approval status

Items below strong confidence open in the review state. The user can approve, edit, or reject each item before save.

## Review And Approval Flow

The Personal quick-add panel now includes an additive Import Anything area:

1. User adds files and/or pasted text.
2. Images are OCRed. Text files are read locally. PDFs are preserved as source references for this first pass.
3. The user selects **Review everything found**.
4. CarePland shows summary counts:
   - Appointments Found
   - Providers Found
   - Notes Found
   - Tasks Found
   - Medication Changes Found
   - Questions Found
   - CarePrep Found
5. The user edits, approves, or rejects each item.
6. **Save approved items** commits only the supported approved destinations.

## Data Destinations

- Appointments: approved, unmatched appointment items create new `appointments` records.
- Visit notes: approved note items with a high-confidence matched appointment save through `/api/appointment-notes`.
- Providers and locations: captured in appointment fields when part of a newly approved appointment. Standalone provider items remain in intake review/audit for now.
- Tasks/reminders: detected and reviewable, retained in intake audit until a durable Personal task destination is selected.
- Medication changes: detected and reviewable, retained in intake audit until medication storage is formalized.
- Questions to ask: approved items with a high-confidence matched appointment are saved as `key_questions` in a draft `careprep_guidance` record. Unmatched questions remain in intake audit.
- CarePrep-relevant information: approved items with a high-confidence matched appointment are saved as `next_steps` in a draft `careprep_guidance` record. Unmatched items remain in intake audit.
- Source text and source file names: preserved in `intake_items.raw_text` and accepted interpretation metadata.

## Initial Limitations

PDF text extraction is intentionally not fully wired in the local first pass. PDF files are accepted as source references so the workflow remains unified, but the user should paste PDF text or use screenshots/images when they need immediate extraction.

Import Anything is additive. It does not remove, replace, or alter existing specialized import workflows.
