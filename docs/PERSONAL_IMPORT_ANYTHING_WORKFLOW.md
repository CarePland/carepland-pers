# Personal Import Anything Workflow

## Purpose

Import Anything is a non-destructive Personal intake workflow. A user can paste text or add screenshots, images, PDFs, portal messages, appointment reminders, discharge instructions, and other healthcare content without choosing an import type first.

The workflow proposes actions, then waits for user review before anything is saved.

## Reuse Of Existing Intake Pieces

- Image OCR reuses the existing `/api/ocr` endpoint with a broader healthcare extraction prompt only when Import Anything requests it.
- PDF extraction uses `/api/import-anything/pdf` to extract readable PDF text through OpenAI file input before the review step.
- AI interpretation follows the existing intake pattern: authenticated request, `intake_items` audit record, OpenAI structured response, then user review.
- AI results are normalized before storage/review so item counts, text fields, confidence values, and list fields stay bounded.
- Approved new appointments route into the existing `appointments` table.
- Approved notes matched to an existing appointment route through `/api/appointment-notes`.
- Existing appointment-specific import buttons and OCR import behavior remain unchanged.

## Matching Logic

The server sends the AI a bounded, normalized list of existing appointment candidates for the selected Care VIP. The AI may set `matched_appointment_id` only when the source text directly supports a high-confidence match.

If a match is uncertain, the item must leave `matched_appointment_id` empty and set `needs_review=true`.

After AI interpretation, CarePland clears any `matched_appointment_id` that is not in the supplied candidate list and marks that item for review.

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

The Appointments toolbar includes an **Import** action. That opens the Personal quick-add panel, which includes an additive Import Anything area:

1. User adds files and/or pasted text.
2. Files can be selected with **Add files** or dropped onto the Import Anything card.
3. Images are OCRed. Text files are read locally with per-file text bounds. PDFs are extracted into review text with per-file size limits.
4. The user selects **Review everything found**.
5. CarePland shows summary counts:
   - Appointments Found
   - Providers Found
   - Notes Found
   - Tasks Found
   - Medication Changes Found
   - Questions Found
   - CarePrep Found
6. The user edits, approves, or rejects each item.
7. **Save approved items** commits only the supported approved destinations.

## Data Destinations

- Appointments: approved, unmatched appointment items create new `appointments` records.
- Visit notes: approved note items with a high-confidence matched appointment save through `/api/appointment-notes`.
- Providers and locations: approved provider details are saved to per-Care-VIP `care_providers` records when that migration is available. Provider entries are scoped to one Care VIP/person and are not merged across patients. Import Anything inserts newly seen providers but does not silently overwrite existing provider details or create duplicate rows for items already matched to a saved provider. Saved provider candidates are supplied back to later Import Anything reviews as quiet AI refinement context only; no visible provider directory is required yet. AI may propose `matched_provider_id` plus a short match note for future “Do you mean this provider?” confirmation surfaces; unknown provider ids are cleared before review, and valid provider match metadata is preserved in accepted review/audit data without adding visible UI. Provider/location fields also remain captured on newly approved appointments.
- Tasks/reminders: approved items with a high-confidence matched appointment are saved as `next_steps` in a draft `careprep_guidance` record. Unmatched tasks remain in intake audit until a durable Personal task destination is selected.
- Medication changes: approved items with a high-confidence matched appointment are saved as `med_review` in a draft `careprep_guidance` record. Unmatched medication changes remain in intake audit until medication storage is formalized.
- Questions to ask: approved items with a high-confidence matched appointment are saved as `key_questions` in a draft `careprep_guidance` record. Unmatched questions remain in intake audit.
- CarePrep-relevant information: approved items with a high-confidence matched appointment are saved as `next_steps` in a draft `careprep_guidance` record. Draft source context is bounded; the full accepted interpretation remains in intake audit metadata. Unmatched items remain in intake audit.
- Extracted source text, source file names, and accepted interpretation metadata are preserved for review/audit. Original uploaded images, PDFs, and text files are not retained after extraction/review processing. This is intentional privacy behavior: CarePland extracts the useful healthcare context, then avoids keeping extra copies of sensitive source files.

## Session Behavior

Import Anything progress is stored with the existing session draft state. Extracted text, source names, review items, summary text, and the intake audit id survive ordinary in-app navigation and same-session page reloads. They are cleared when the user saves approved items, explicitly discards the quick-add panel, signs out, or the session ends.

Import Anything source names and review items count as unsaved work. Sign-out, browser refresh, and quick-add close/switch warnings should protect in-progress Import Anything reviews the same way they protect appointment imports, note edits, and other drafts.

## Roadmap

- Provider confirmation popup: future UI may show a lightweight “Do you mean this provider?” confirmation when Import Anything finds a likely saved provider match for the current Care VIP. The popup should show the stored provider details and ask for confirmation before treating the match as user-approved. This is roadmap-only for now; current provider matching remains quiet AI refinement context and accepted audit metadata.

Import Anything is additive. It does not remove, replace, or alter existing specialized import workflows.
