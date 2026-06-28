# CarePland Connect Receiver UI Handoff

Use this as the first prompt/context document for a new chat focused only on the Connect Receiver UI.

## Command

```bash
cd /Users/agoodloe/Documents/Codex/CarePland/APP_CODE/carepland-all
```

## Scope

Work only on the Connect Receiver experience unless a shared helper must be touched to keep Receiver behavior correct.

Primary files:

- `app/components/connect/receiver/ConnectReceiver.tsx`
- `app/components/connect/receiver/ConnectReceiver.module.css`
- `app/connect/receiver/page.tsx`
- `app/lib/connect/context/**`
- `app/lib/connect/messaging/**`
- `app/lib/connect/appointments/**`
- `app/lib/connect/audio/**`
- `app/lib/connect/calls/**`
- `app/api/connect/**`

Relevant reference docs:

- `docs/CONNECT_STABILIZATION_HANDOFF.md`
- `docs/CONNECT_HANDOFF_2026-06-22.md`
- `docs/CONNECT_AUDIO_BOUNDARIES.md`
- `docs/CONNECT_PROTOTYPE_CONTRACTS.md`
- `docs/CONNECT_ANDREW_VOICE_FUTURE.md`

Do not work on Personal Import Anything in this chat. Do not redesign Dashboard or Settings except where Receiver state/guide-mode behavior requires shared data correctness.

## Product Intent

Receiver is the appliance-like side of CarePland Connect.

It should feel like a simple dedicated home device for an older or less technical user:

- large readable text,
- physical-looking buttons,
- stable layout,
- minimal jargon,
- no implementation/debug labels,
- no shrinking/reflow surprises,
- clear state,
- low cognitive load.

The current goal is not to invent a new design. Restore and stabilize the richer pre-migration Receiver behavior inside the merged Next/module structure.

## Architecture Boundary

Keep the merged architecture.

Do not revert to the old standalone prototype. Port behavior and visual fidelity into the integrated module.

Identity rule:

- Canonical people live in `care_subjects`.
- Connect enablement lives in `connect_participants`.
- The active Receiver world is the Main Connect User.
- Receiver must derive active identity through `/api/connect/context` and Connect context helpers, not from local storage as authority.
- Receiver person buttons should represent the relevant Connect people for the active Receiver world and support 1-4 people.

Current important model decision:

- No extra “approved caller” MVP complexity.
- Keep Receiver people related to the current CarePland Personal / Connect participant model.
- Do not create a second Connect-only user model.

## Receiver Visual Rules

Receiver should behave like an appliance viewport.

- The full receiver surface should scale proportionally with browser window resizing.
- Browser keyboard zoom should not distort internal proportions.
- Avoid responsive local weirdness where text grows but containers do not, or buttons become unrelated sizes.
- Prefer a stable fixed design surface that scales as one unit.
- Leave unused space empty rather than stretching individual cards awkwardly.

Home layout should retain the restored pre-migration structure:

- top status panel with time/date/next appointment and greeting/location,
- person buttons,
- main action area:
  - `Contact Andrew`
  - `Ask a question`
  - record icon button
  - optional sounds/radio icon button
  - `When is my appointment?`
- messages panel:
  - previous/next buttons always present, disabled/grey when inactive,
  - message title,
  - sender/time line with relative date labels,
  - message text,
  - `HEAR`, `READ`, `CALL BACK`,
  - `Show All Messages`.

Remove visible debug/status elements from the Receiver homepage unless they are true product UI.

Do not show:

- visible Guide Mode button panel on Receiver home,
- visible Incoming Call test button on Receiver home,
- implementation status bars such as “Optional sounds settings are open,”
- labels like “prototype contract gaps.”

## Styling Notes

Use the existing physical-button visual language:

- strong border,
- subtle raised/drop-shadow treatment,
- cream/white inactive button face,
- green for primary action,
- blue for message/read/hear actions,
- grey/inactive treatment for disabled unavailable choices,
- beige/cream selected highlight where applicable.

Specific restored details:

- Record button should use the red microphone image/icon.
- Optional sounds/radio button should use the radio/sound image/icon and be large enough to be recognizable.
- Older-eye text sizing matters. Subsidiary labels such as `Living Rm`, appointment qualifiers, and secondary status text should remain readable.
- Person unavailable state should use inactive/grey styling, not active pale-green styling.
- `Previous` and `Next` should stay visible and grey out when inactive.

## Receiver Messages

Message timestamps need relative qualifiers:

- `Today 2:40 PM`
- `Yesterday 8:40 PM`
- `Two days ago 7:45 PM`
- exact weekday/date when appropriate.

Homepage message panel:

- sender/time should fit on one line when feasible,
- text should not collide with action buttons,
- `HEAR`, `READ`, `CALL BACK` should align as a full-width row consistent with `Show All Messages`,
- `Show All Messages` should remain a full-width physical button.

Read/Open Message modal:

- Use `Go Home` when opened from the homepage.
- Use `Go Back` when opened from All Messages.
- Text size controls: `Standard`, `Large`, `Extra Large`.
- Text size selection should persist during the session.
- No CSR/debug-style buttons.
- Long text should paginate with large previous/next arrow buttons rather than scrolling.

All Messages modal:

- Use a summary list, not full unbounded message bodies.
- Each row should be a readable two-line-ish summary where possible:
  - sender/time,
  - truncated message preview.
- Clicking a row opens the same Open Message modal.
- Use the same previous/next arrow navigation pattern as individual messages.
- Page based on available fit/line count, not a fixed “one message per page” rule.
- Avoid scrolling.

## Appointment Flow

`When is my appointment?` should preserve the richer pre-migration workflow.

Expected flow:

1. User taps `When is my appointment?`.
2. Optional temporary state can say it is looking for appointments.
3. If multiple appointments are plausible, show `Which appointment?`.
4. Present appointment choices as fixed pages with large physical buttons.
5. Use previous/next navigation if the list does not fit.
6. Do not force a fixed number of choices if long labels need more space.
7. Selecting an appointment opens appointment detail.

Appointment detail should show:

- appointment title,
- date/time,
- provider/clinic/location when available,
- preparation/follow-up notes when available,
- actions such as `Where is it?` and `Done` where appropriate.

Use `Go Home` for top-level appointment choice/detail modals unless opened from a nested path where `Go Back` is clearer.

## Ask Flow

Receiver Ask is an on-device workflow, not a generic small app Ask button.

Expected baseline:

- Home button label: `Ask a question`.
- Popup title: `What would you like?`
- Helper text: `Type anything, or click a button.`
- Text field placeholder/examples should be open-ended.
- Example buttons include common requests such as:
  - `What time am I leaving?`
  - `What should I bring?`
  - `I need milk`
  - `I feel dizzy`
- Record Request button uses the red mic icon.
- Submit button text should be large and product-specific, not tiny `Ask`.

AI interpretive workflow:

- If a request can be interpreted, show the interpreted answer/action flow.
- If not understood, use:
  - `I didn't quite understand. What would you like to do?`
  - `I'll try rephrasing it`
  - `Send this to Andrew`
- Use `Go Home` consistently for Receiver top-level modals.
- Replace “I'll try saying it differently” with “I'll try rephrasing it.”

The Ask flow should eventually be informed by Connect context, but do not wire a separate second Ask system if shared platform Ask is appropriate.

## Recording Flow

Record should open the recording popup immediately.

Expected state sequence:

1. User presses record/mic.
2. Popup opens immediately with title `Recording your voice`.
3. While actively recording:
   - main record button says `Stop Recording`,
   - button face is black/dark with light text,
   - text area can be blank or show recording state.
4. Pressing `Stop Recording` ends capture and begins transcription.
5. While transcribing:
   - text area says `Transcribing recording...`.
6. After transcription:
   - text area contains transcribed text,
   - button says `Record Again`,
   - submit says `This text is what I want to send`.

Do not make the first press require a second press before popup state changes.

## Optional Sounds

Optional sounds are real audio files, not generated system tones.

Expected behavior:

- Button beeps use the microwave beep sound.
- Retro ringers use the old phone ringer file.
- Outgoing call uses the in-call-ring file.
- Failed call plays two sounds:
  - `IC_SIT`
  - `freesound_community-this-number-is-not-available-88505`

Button beeps should apply throughout Receiver, not only on the sound setup page.

Sound settings:

- `Optional Sounds Help` screen should be readable and physical-button styled.
- Main test button should be green with large text.
- White help box language:
  - `Optional sounds include button beeps and retro sounds.`
  - `Speech may work even when other sounds are quiet.`
  - `Adjust volume while this screen is open.`
  - `Check audio output settings if available.`
- Problem buttons should look physical.
- Selected problem button face should turn beige/cream.
- Pressing problem buttons should not leave a status bar visible.
- `Turn Optional Sounds On` should trigger the microwave beep, not old-phone ringing.
- If Retro Sounds or Button Beeps are turned off, pressing Off should not beep.
- If Retro Ringers is turned off, stop any active old-phone playback immediately.
- Retro Ringers test should play one natural ring segment from the file, then stop. Do not loop or compress ring spacing.

Use `Go Home` for the Receiver sound settings modal.

## Guide Mode

Guide Mode is a cross-device pointing loop.

Important behavior:

- Dashboard/guide side does not show a separate control panel of buttons.
- The guide user clicks the actual Receiver preview UI.
- The selected UI target gets a red highlight.
- Receiver user sees the same red highlight and dimmed surrounding UI.
- Receiver user remains in control and can press anything.
- When Receiver user presses a button:
  - red highlight disappears,
  - guide side sees what was chosen,
  - if the wrong button was chosen, guide side indicates that.

Current tolerated but not ideal behavior:

- If no target is selected, a red square placeholder may appear. It is not ideal, but do not redesign this unless explicitly requested.

Critical point:

- Guide Mode highlights must be WYSIWYG between the guide preview and the actual Receiver screen.

## Incoming Call

Incoming call state should be product-like and non-blocking.

- Incoming call prompts should stay on Receiver.
- They should not block all other receiver actions unless the active flow requires it.
- Call state should remain clear: incoming, answered, declined, unavailable, failed.
- Failed calls should use the specified failure audio sequence.

## Receiver Person Buttons

Person buttons should be dynamic and support 1-4 people.

Rules:

- Do not show unrelated prototype/test users.
- Do not show inactive people as available choices.
- If a person is unavailable but relevant, use inactive/grey styling.
- Active/available people should use the physical button state.
- The signed-in app-side user may be one of the total person model participants, but Receiver should not create confusing duplicate lists.

The user is separately working on linking Connect users to CP Personal. Avoid over-solving identity in this Receiver UI pass unless required for visible correctness.

## Dashboard Receiver Preview

Receiver preview should match the actual Receiver surface closely enough for Guide Mode.

- Do not replace product UI with contract placeholders.
- Use the real restored Receiver layout wherever possible.
- Preview fidelity matters because Guide Mode depends on WYSIWYG pointing.

## Known Active Work To Avoid

Other chats may be working on:

- Connect user/Pers identity consolidation,
- Connect audio buildout,
- CP Personal Import Anything,
- broader Admin/Settings cleanup.

Avoid broad refactors across those areas.

## Recommended Receiver Fix Order

1. Verify the current Receiver UI route and screenshot against the restored product baseline.
2. Stabilize appliance scaling and remove visible debug/status controls from Receiver home.
3. Confirm message panel and All Messages paging/read modal behavior.
4. Confirm appointment selection/detail flow.
5. Confirm record popup state machine.
6. Confirm optional sounds audio files and button-beep behavior across Receiver.
7. Confirm Guide Mode WYSIWYG highlight loop between dashboard preview and actual Receiver.
8. Confirm person button list uses the intended active/relevant Connect people only.

## Verification

Run checks after changes:

```bash
npm run lint
npm run build
```

Manual browser checks:

- `http://localhost:3000/connect/receiver`
- `http://localhost:3000/connect/dashboard`
- Receiver homepage at narrow and wide windows.
- Browser keyboard zoom should not distort local proportions.
- Record, optional sounds, Ask, appointment, read/open message, All Messages.
- Guide Mode from Dashboard preview to Receiver.

If local servers are stale, use:

```bash
scripts/restart-connect-local.sh
```

and restart the Next dev server on port `3000` as needed.

