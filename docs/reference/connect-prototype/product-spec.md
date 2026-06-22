# CarePland Connect

## Core Clarification

CarePland Connect helps trusted caregivers initiate real-time conversations with loved ones when normal contact methods fail.

The product exists to establish a live conversation. It is not a notification system, messaging system, or acknowledgment workflow.

## Connect Request

A Connect Request is the setup step for a live communication session.

It should be viewed like a phone ringing. The ringing is not the goal. The conversation is the goal.

## Success Criteria

The system succeeds when:

1. A caregiver initiates a request to talk.
2. The recipient is reached through an approved endpoint.
3. The recipient accepts.
4. A live conversation begins.
5. The caregiver can see whether connection was established, failed, declined, or timed out.

A delivered notification without a resulting conversation is only a partial success.

## Conversation Status

The MVP tracks `conversation_status` rather than only `request_status`.

Suggested states:

- `requested`
- `notified`
- `accepted`
- `connecting`
- `connected`
- `declined`
- `no_response`
- `failed`
- `ended`

## Architecture

CarePland Connect is a trusted conversation orchestration layer.

CarePland Connect is the evolution of SMS for caregiving: a communication layer built around voice, context, and care recipient participation rather than phones and text alone.

Endpoints are interchangeable transport mechanisms, including:

- Smart speakers
- Smart displays
- Tablets
- Mobile phones
- VoIP services
- Traditional phone calls
- Future CarePland hardware

## Receiver Portability Principle

Android Receiver should prove the experience, but Android must remain a client.

Core product behavior should move toward API-shaped service boundaries so a future Web Receiver can reuse the same backend behavior with minimal rewrite.

Future desired architecture:

```text
Android Receiver -> Connect API -> shared backend/data/prompt layer
Web Receiver     -> Connect API -> shared backend/data/prompt layer
```

Do not build `receiver.carepland.com` prematurely, but avoid Android-only architecture decisions that would make it painful later.

A minimal static Web Receiver prototype exists to validate portability:

`web-receiver.html`

It consumes shared mock receiver models and mirrors the Android appliance layout without chasing full Android feature parity.

Portable receiver services should map to backend APIs over time:

- Receiver status and heartbeat
- Selected/assigned contacts
- Message Center
- Audio messages and audio metadata
- Hear/read transcript state
- Something Else request handling
- AI interpretation
- Receiver settings and caregiver/admin setting locks

Android-specific capabilities should remain isolated behind adapters:

- FCM notifications
- Native microphone recording
- Native audio playback
- Android system volume controls
- Kiosk/lock task mode
- Launch-on-boot behavior

Durable state should be designed to live server-side, including messages, heard/read status, transcripts, audio file references, receiver settings, selected contacts, AI interpretation results, heartbeat status, and receiver app version.

### Shared Audio Boundary

Audio capture, storage, playback metadata, and transcription should not be modeled as Connect-only behavior.

Important Admin boundary: when product direction says "Admin," it refers to the consolidated CarePland Admin surface at `/Users/agoodloe/Documents/Codex/CarePland/APP_CODE/carepland-all/app/admin`, not the Connect prototype dashboard. The Connect prototype may temporarily emit local events, traces, audio profiles, and receiver settings for testing, but Admin review, analysis, configuration, and read-only operational panels should live in the CarePland Admin surface unless explicitly requested otherwise.

Current Admin extraction alignment: the Pers/Admin root registry is expected to include concrete Connect areas for provisioning, audio, request interpretation, and interaction traces. Connect prototype work should feed those areas with local/test data and shared service shapes, not create a parallel Admin destination inside the prototype.

Desktop UI direction: non-receiver Connect surfaces should migrate toward the CarePland Personal look and feel. The receiver remains an appliance-style interface, but caregiver/coordinator desktop views, Admin-adjacent testing views, and other non-receiver surfaces should visually align with CP Personal because the user base is likely to overlap and should not feel like they are moving between unrelated products.

### Guided Receiver Assistance Policy

Core principle: Guide mode is assistance, not control.

The tutor can click a control in the receiver simulation to highlight that same control on the receiver user's device; the receiver screen may dim around it with a large target, but the receiver user still has to press the real button themselves. If the tutor stops guiding, the receiver user's screen immediately returns to normal.

When the receiver user touches anything, the guide target clears on their side and their action proceeds normally. If they pressed the intended target, the laptop simply continues in Guide mode with no extra visual fuss. If they pressed something else, the laptop simulation may show `Mom pressed: X` and briefly mark that spot in yellow, while staying in Guide mode so the tutor can point to the next thing.

Connect, Personal, and Family will all need reusable audio capabilities:

- Receiver Ask and Ask Recovery voice capture.
- Audio messages.
- Recorded reminders.
- Future conversational or live-audio experiences.

Connect may own the care-recipient appliance flow that uses audio, but the lower-level services should remain product-neutral:

- Browser/native recording adapters.
- Audio file storage.
- MIME type and duration metadata.
- Optional transcription.
- Playback URLs and transcript status.
- Browser/native playback adapters, audio unlock, one-shot cues, ringer loops, and text-to-speech fallback.

Connect domain objects should reference audio artifacts rather than owning the audio subsystem. For example, a `ConnectAskInteraction` may have child events that reference an audio message or recovery recording, but `AskRecovery` should not become the primary parent object and audio services should remain reusable by Pers and Family.

Audio artifacts should expose stable, product-neutral classification fields in addition to raw debug/source labels. `artifactKind` should describe what the recording represents, such as Ask input, Ask recovery, receiver message, coordinator message, or recovered upload. `audioDirection` should describe movement, such as receiver local input, receiver-to-coordinator, or coordinator-to-receiver. Admin, migration, analytics, and future Pers/Family integrations should prefer these fields over filename or `source` inference.

Audio implementation should advance through stored-audio capabilities before live calling:

1. Receiver voice capture: tap mic, record, stop, transcribe, confirm text, send.
2. Playback everywhere: every recorded item keeps original audio, transcript, and a play control for the coordinator/admin view.
3. Voice Ask: voice-first capture feeds the same Ask interpreter and answer/recovery flow.
4. Audio messages: coordinator records a message, receiver gets `HEAR`, `READ`, and `CALL BACK`.
5. Live audio spike: only after recording, upload, storage, playback, transcription, and message routing are reliable. WebRTC should become "stream audio instead of storing audio," not "invent communications."

Playback normalization should be virtual and non-destructive at this stage. Preserve the original recording, then apply a shared playback gain/comfort-volume target when audio is played. Later, measured loudness metadata can tune the gain per artifact without rewriting the source file.

Speech enhancement should also remain virtual and conservative. The playback layer may analyze a decoded audio artifact, save a small enhancement profile, and apply only helpful playback-time processing: high-pass filtering for rumble, small low-mid cuts for boxiness, modest presence boost for intelligibility, light compression for quiet speech, and limiting for sudden peaks. Noisy, harsh, clipped, or already-compressed recordings should receive less processing so the system does not pump room noise or make tablet microphones painful to hear.

Receiver hearing feedback should be captured as profile data, not as one-off UI state. If the user says enhanced playback was easier or harder to hear, save the message/audio reference, speaker/source, enhancement settings, analysis profile, and outcome. In the prototype this may live locally on the receiver; later it should move to the correct durable owner, likely care recipient, receiver device, or household, so Connect can learn which clarity choices help a specific person hear speech comfortably.

## Ask Interpreter Workflow

The Receiver homepage stays appliance-simple:

- Call selected contact
- Ask a question
- When is my appointment?
- Optional sounds
- One visible message at a time

The `Ask a question` flow is the first version of Connect as an intent capture and routing system. It should not be treated as only a text-message form.

Initial receiver flow:

1. Receiver user taps `Ask a question`.
2. Receiver asks: `What would you like to do?`
3. User types anything, records a request, or selects a suggested need.
4. Connect interprets the request.
5. Connect shows a confirmation step before sending or taking action.
6. Only confirmed actions create messages or calls.

Voice input should use the shared audio capture/transcription boundary. If transcription is unavailable or fails, the receiver should keep the user in a simple recovery path: typing still works, and no misleading Ask interpretation should be created from an empty or failed transcript.

Recording/transcription status should live in the same large input field whenever possible. The receiver should avoid adding a separate status strip for normal voice capture states such as `Listening...`, `Turning recording into text...`, or transcription fallback copy. This keeps the appliance flow visually simple and supports a future smaller/icon-only record control.

A homepage microphone control may launch the same Ask surface in voice-first mode. This should not become a separate voice product or parallel interaction model. Voice-first mode opens Ask without suggestion buttons, uses a simpler title such as `Recording your voice`, and starts in the engaged recording state. The path remains: speak, confirm interpreted text, answer or recover.

Any receiver microphone recording should have a dead-air guard. The prototype may use lightweight browser audio-level monitoring, but the product behavior should be consistent across voice-first Ask, regular Ask recording, Ask Recovery, and future audio-message capture: if the user stops speaking or the room is silent for a short period, stop recording and move to the next useful step instead of leaving the receiver waiting indefinitely.

Initial intent categories:

- `appointment_question`
- `message_to_caregiver`
- `household_request`
- `concern_or_symptom`
- `device_help`
- `unknown`

Example interpretations:

- `I need milk` -> `household_request` -> offer to send request to Coordinator/Admin.
- `What time am I leaving?` -> `appointment_question` -> answer from available appointment/pickup context when possible.
- `I feel dizzy` -> `concern_or_symptom` -> carefully offer to tell or call Andrew.
- `My TV isn't working` -> `device_help` or `household_request` -> offer to send to Andrew.
- `Tell Andrew I'm ready` -> `message_to_caregiver` -> confirm sending to Andrew.

Sensitive categories must not imply emergency dispatch, medical diagnosis, or 911 behavior. The receiver may say:

`This may be important. Would you like me to tell Andrew?`

Buttons:

- `Tell Andrew`
- `Call Andrew`
- `Go Back`

Dynamic suggestion buttons should eventually adapt based on time of day, upcoming appointments, household patterns, recent messages, and commonly used intents. These are likely needs, not generic autocomplete.

### AI Interpretation Confidence

Connect is an appliance, not a chatbot.

The goal is not to demonstrate AI intelligence. The goal is to help the user successfully complete a task with the fewest possible decisions, while always providing a clear path when the AI may be wrong.

Core rule:

- When confidence is high, answer.
- When confidence is moderate, clarify.
- When confidence is low, ask.

The system should never confidently choose an interpretation when multiple plausible interpretations exist.

High confidence:

The user's intent is obvious and there is a clear answer.

Examples:

- `What time is my appointment?`
- `What should I bring?`
- `When am I leaving?`

Behavior:

Provide the answer immediately and offer only a small number of contextual follow-up actions.

Moderate confidence:

The system identifies 2-3 highly plausible interpretations but cannot confidently determine which one is correct.

The system should not choose. It should ask the user to select.

Example:

`I'm not totally sure what you mean. Pick the one you prefer.`

Buttons:

- `Show what's happening this week`
- `Send a message to Andrew`
- `Call Andrew`

Low confidence:

The system cannot determine intent with reasonable confidence.

Example:

`I didn't quite understand. What would you like to do?`

Actions:

- `Type your request`
- `Record your request`
- `Call Andrew`

The system should never fabricate certainty.

Interpretation transparency:

When the system interprets a request before escalation, it should show the interpretation before taking action.

Example:

`I can send this to Andrew:`

`I can't remember what was happening this week.`

Buttons:

- `Send to Andrew`
- `Edit`
- `Go Back`

Connect exists to reduce effort. Connect does not exist to make decisions on behalf of the user.

Preferred behavior:

1. Answer when confident.
2. Clarify when uncertain.
3. Escalate when necessary.
4. Always provide a path to correction.

A correct answer is good. A wrong answer that can easily be corrected is acceptable. A wrong answer with no correction path is unacceptable.

### AI Correction Path Principle

Every AI answer should provide an easy path to correction.

This is not because the AI is bad. It is because assumptions are inevitable.

Never trap the user inside a wrong assumption.

If the system assumes the wrong appointment, person, location, date, task, or concern, there should be an obvious correction path that requires less effort than typing whenever possible.

Examples:

- Appointment answer -> `Wrong appointment`
- Bring-list answer -> `That's not what I need`
- Location answer -> `Wrong place`
- Time answer -> `Wrong time`
- Contact/routing answer -> `Wrong person`
- Household request answer -> `That's not the request`
- Symptom/concern answer -> `Something else is wrong`

The contextual correction path is separate from the generic `This wasn't helpful` path.

The generic path means the whole response failed.

The contextual correction path means the system may be close, but one key assumption is wrong.

### Answer Button Minimalism

Every AI answer screen gets three universal controls:

- `That answered my question`
- `This wasn't helpful`
- `Ask Andrew` or equivalent human escalation

Then add 0-2 contextual buttons maximum.

Only show a contextual button if a reasonable human would bet money that it is the user's next question.

Do not show buttons merely because they are possibly useful, related, or technically relevant.

The system should prefer one generic failure path over many specific failure paths.

Specific correction buttons should only appear when confidence is very high that the correction represents the user's likely next action.

Examples:

- `What time am I leaving?` with no pickup time saved -> `Wrong time`, `This wasn't helpful`, `Ask Andrew`.
- `What should I bring?` with a bring-list answer -> `This wasn't helpful`, `Ask Andrew`.
- Appointment selection context -> `I meant a different appointment`, `This wasn't helpful`, `Ask Andrew`.

Reduce choices. Preserve escape routes.

Human escalation should appear at the bottom of the action stack whenever possible.

Implementation note:

The web receiver currently uses a local deterministic interpreter in `shared/receiver-ask-service.js`. This is intentionally API-shaped so it can later become:

`POST /api/connect/receiver/ask/interpret`

The Android Receiver should use the same backend contract once available.

## Connect Admin AI Prompt

Admin migration is ongoing. Do not assume CP Personal Admin remains the final prompt home.

Connect may now add Connect-specific trace/domain types and API/storage on the Connect side without jamming them back into CP Personal UI.

Admin should surface Connect Ask traces through a separated Admin panel/module, similar to the extracted Admin islands already represented in `app/components/admin/`.

Architectural rule:

Do not make `AskRecovery` the primary object.

Use a durable parent object such as `ConnectAskInteraction`, with recovery, escalation, correction, and outcome events attached beneath it.

This preserves the no-forced-1:1 principle and keeps Admin as the review/analysis surface across product flavors.

### Connect Ask Interaction Trace

Connect should track the full Ask interaction trail for analysis and improvement.

Parent object:

`ConnectAskInteraction`

Suggested fields:

- `id`
- `careCircleId`
- `receiverDeviceId`
- `receiverHouseholdId`
- `receiverPersonId`
- `coordinatorUserId`
- `receiverUserDisplayName`
- `originalInput`
- `inputMethod`
- `selectedSuggestion`
- `surface`
- `interpreterVersion`
- `promptKey`
- `promptVersion`
- `outcome`
- `createdAt`
- `updatedAt`
- `completedAt`

Child events:

- `input_captured`
- `interpretation_returned`
- `answer_shown`
- `button_selected`
- `followup_input_captured`
- `message_escalated`
- `call_escalated`
- `recovery_started`
- `recovery_sent`
- `completed`
- `abandoned`

Trace analysis should answer:

- What questions are common?
- Where is the AI failing?
- Which buttons are actually used?
- Which answers lead to `This wasn't helpful`?
- Which questions usually escalate to Andrew?
- What should become a first-class workflow?
- What suggestions should appear earlier?

Future Connect Admin section:

```text
Connect Admin
  AI Prompts
    Ask Interpreter Prompt
```

Prompt name:

`Ask Interpreter Prompt`

Prompt key:

`connect_ask_interpreter`

Purpose:

Classify open-ended receiver requests, avoid overcomplicated responses, and return short confirmation-first next actions.

Prompt requirements:

- classify receiver intent
- return an explicit confidence level
- answer when confidence is high
- clarify rather than choose when confidence is moderate
- ask rather than fabricate certainty when confidence is low
- answer the user's actual question rather than only identifying context
- prefer simple next actions
- generate follow-up buttons based on the answer returned
- include at least one context-specific not-quite-right path whenever reasonable
- avoid emergency claims
- never imply medical diagnosis
- do not send without confirmation
- return structured JSON
- keep receiver-facing language short, direct, and friendly
- avoid trapping the receiver user inside a wrong assumption

Expected output shape:

```json
{
  "intent": "household_request",
  "confidence": "high",
  "receiverMessage": "I can send this to Andrew.",
  "proposedAction": {
    "type": "send_message",
    "recipientRole": "coordinator",
    "recipientName": "Andrew",
    "body": "I need milk."
  },
  "buttons": [
    { "label": "Send to Andrew", "action": "confirm_send" },
    { "label": "Edit", "action": "edit" },
    { "label": "Go Back", "action": "cancel" }
  ]
}
```

Admin prompt storage should later support prompt name, prompt text, active/inactive state, version history, rollback/revert, last updated timestamp, and updated by.

## Ask Recovery: This Wasn't Helpful

`This wasn't helpful` is a recovery path, not a dead end.

When a receiver user marks an Ask answer as unhelpful, Connect should capture what they actually needed and route that clarification to the Coordinator/Admin when appropriate.

Receiver copy:

`Sorry that wasn't the answer you needed.`

`What were you really looking for?`

Avoid first-person appliance language such as `I didn't understand`, `We couldn't answer`, or `Let me try again`.

Recovery options:

- Type a clarification.
- Record a clarification when microphone support is available.

Confirmation:

`Send this to Andrew?`

Buttons:

- `Send to Andrew`
- `Edit`
- `Go Back`

After sending:

`Sent to Andrew.`

AskRecovery object:

```json
{
  "id": "",
  "careCircleId": "",
  "receiverDeviceId": "",
  "receiverHouseholdId": "",
  "receiverPersonId": "",
  "coordinatorUserId": "",
  "originalQuestion": "",
  "interpreterIntent": "",
  "answerShown": "",
  "selectedActionBeforeFeedback": "",
  "feedbackType": "not_helpful",
  "clarificationText": "",
  "clarificationAudioUrl": null,
  "transcriptText": null,
  "createdAt": "",
  "status": "sent_to_coordinator",
  "source": "receiver_ask_recovery"
}
```

Future Admin TODOs:

- View all `This wasn't helpful` events.
- Filter by intent/category.
- See original question vs answer vs clarification.
- Mark reviewed.
- Add to prompt improvement notes.
- Add as example training/evaluation data.
- Identify common failed questions.
- Improve dynamic suggestion buttons based on failures.

These events are among the most valuable model-improvement signals because they capture the gap between what Connect answered and what the receiver user actually needed.

## Receiver Setup Help

Receiver setup should include practical, device-specific help for audio and browser/device constraints.

Sound Help should collect:

- Problem: no sound, no beeps, no spoken reminders, faint beeps.
- Device detected: iPad, iPhone, Android, or browser device.
- Browser detected: Safari, Chrome, Firefox, or unknown.
- App mode detected: browser, Home Screen web app, standalone web app, or native where available.
- Last audio test result.
- Permission/autoplay status when detectable.

The receiver should provide a Test Sound action before and after instructions.

Future AI-generated instructions should be caregiver-readable, practical, and non-destructive. They must not recommend deleting accounts, wiping devices, resetting all settings, factory resets, or other high-risk recovery actions. The prompt should live in CP Pers/Admin under the Connect prompt group as `connect_receiver_sound_help` until the Admin extraction is complete.

### Support Recipes

Sound Help should use static Support Recipes before AI generation.

Flow:

1. Detect issue, device, browser, OS, and app mode.
2. Build a normalized recipe lookup key.
3. Search reviewed/static recipes.
4. If no match exists, generate instructions once.
5. Save generated instructions as a recipe candidate.
6. Reuse saved recipes for future matching devices.

Initial local prototype uses static JavaScript recipes and `localStorage` generated recipes behind an API-shaped service:

`getSupportRecipe(issue, context)`

This should later move to the Connect backend/Admin surface without changing the Receiver UI.

Future Admin TODOs:

- View generated recipes.
- Edit recipes.
- Approve, draft, or archive recipes.
- Track usage count.
- Mark recipes reviewed.
- Override bad AI-generated instructions.

Support recipes may include safe local receiver actions such as:

- Set receiver volume to High.
- Turn on Retro Sounds and Button Beeps.

When a help step can be completed safely by the receiver itself, the UI should offer a large action button rather than requiring the user to leave the instructions and find the setting manually. Recipes must not expose operational/admin actions on the receiver.

Troubleshooting note to preserve:

During early Web Receiver testing, an older iPad played generated Web Audio button beeps with volume differences, while a newer iPad running Safari/Firefox on iPadOS allowed speech synthesis but muted or reduced regular web audio. Safari later produced a delayed, very faint beep. This appears to be an iPadOS/WebKit browser-audio behavior rather than a CarePland logic failure. Future troubleshooting should check physical volume, Control Center output, Silent/Focus state, browser/site audio behavior, Home Screen web app mode, and whether speech works separately from generated/media audio before changing receiver logic.

Principle: AI should generate missing support knowledge once. CarePland should reuse reviewed/static support recipes whenever possible to improve cost, speed, consistency, reliability, and support quality.

## Trust Boundary

CarePland Connect must not:

- Continuously monitor audio
- Record conversations by default
- Allow hidden listening
- Allow unauthorized access

All Connect Requests must be attributable to a named caregiver, limited to authorized relationships, and recorded in an audit log.

## Retro Mode

Retro Mode is an optional presentation layer for CarePland Connect.

It must never alter functionality, permissions, workflows, accessibility, or communication behavior. It may only affect visual styling, user-facing terminology, and optional audio cues.

Retro Mode has independently configurable presentation layers:

- Visual skin: Modern, Retro, or Retro + Woodgrain.
- Audio pack: optional classic telephone-inspired sounds.

Call-oriented terminology is the default product language:

- Endpoint becomes Receiver.
- Start Connect Request becomes Call.
- Accept becomes Answer.
- End conversation becomes Hang Up.
- No response becomes Receiver Unavailable.
- Declined becomes Line Busy.

The implementation may retain terminology mapping logic for future language variants, but the user-facing default should remain call-oriented.

## Founder Easter Eggs

These are optional, non-core delights for later exploration. They must not interfere with accessibility, trust, caregiver workflows, or the core call orchestration experience.

- Time service reference: a hidden or optional voice prompt inspired by "at the tone, the time will be..."
- Hidden 1930s RKO-style radio tower icon with electricity bolts that advance incrementally when calls are placed.
- Obscure telecom references tucked into non-critical UI states, logs, or developer-only details.
- Tiny jokes and references calibrated to make exactly twelve people on the internet laugh.

Retro audio examples:

- Outgoing in-call ringback when the coordinator/caregiver presses Call, repeated as: sound file, 2 second pause, sound file.
- Classic telephone ring for future coordinator-incoming calls, played once.
- SIT tone followed by the "number not available" message when a receiver cannot be reached or the call is not answered.
- Busy-line tone when the recipient declines.

The loved-one/receiver side should not play the Retro audio pack in the current MVP simulation.

## Android Receiver Spike

CarePland Connect should validate Android as a dedicated receiver type before relying on Alexa or Google Home.

The Android Receiver app turns a phone, tablet, or similar Android device into a CarePland receiver:

- Idle state: Receiver Available.
- Incoming call state: full-screen call UI when possible.
- Actions: Answer, Decline, Hang Up.
- Audio: loud swappable ringtone.
- Transport: Firebase Cloud Messaging for call events.
- Fallback testing: local adb debug call trigger.

Android must remain one receiver type within the broader receiver model, not the only receiver strategy.

Spike source:

`android-receiver/`

## Receiver Hardware-Agnostic Principle

CarePland Connect Receiver must be hardware-agnostic.

The receiver is software that may run on:

- Android tablets
- Android phones
- Dedicated kiosks
- Smart displays
- Raspberry Pi devices
- Future custom hardware

Hardware should be treated as a deployment target rather than a product requirement.

The experience should feel like a thoughtful homage to trusted communication systems, not parody or novelty.

## Visual Language & Receiver Experience

CarePland Connect is not a phone, dashboard, or social app.

CarePland Connect should feel like a trusted household communication appliance. The design goal is confidence, not modernity.

Users should immediately understand:

- What can be pressed.
- What happened after they pressed it.
- What to do next.

Connect should be retro-inspired, not retro-recreated. It may borrow strengths from Braun radios, stereo receivers, telephones, microwave ovens, television remotes, IBM keyboards, and dedicated household appliances, but it should not literally recreate vintage equipment.

The user should feel "this feels familiar" without consciously noticing why.

Accessibility wins over aesthetics. The receiver should optimize for older eyes, viewing from across a room, poor lighting, reduced dexterity, reduced hearing, and cognitive fatigue.

Buttons must look pressable. Avoid flat design. Buttons should have clear borders, visible elevation, obvious shape, high contrast, and distinct press state. Users should never wonder whether something is a button.

Touchscreens lack physical resistance, so Connect should replace tactile feedback with sensory feedback:

- Confirmation sounds when available.
- Visible button depression.
- Color or shade change.
- State change.
- Status confirmation.

Every touch should immediately acknowledge the user: "Yes, I heard you."

Stable layout remains a core accessibility principle. Nothing should move under the user's finger. Avoid layout shifts, dynamic button repositioning, and expanding controls that move neighboring controls.

Semantic color language:

- Green: call, start, confirm, play, success.
- Blue: communication, messages, information, hear, read.
- Amber: settings, configuration, device management, maintenance.
- Gray: back, close, cancel, secondary actions.
- Red: warning, error, urgent situations, critical alerts. Use sparingly.

Connect must use multiple layers of visual distinction rather than relying on color alone. Controls should differ through color, border, depth, shadow, typography, spacing, and state changes. Controls should remain obvious from across a room and understandable under reduced vision, reduced contrast sensitivity, or limited technical familiarity.

On most screens, only one action should visually dominate. Users should instantly identify the main action.

The palette should avoid bright neon colors and favor warm creams, soft charcoals, muted blues, deep greens, warm grays, and gentle amber accents. The feel should suggest household appliance rather than enterprise dashboard or social media app.

Themes may affect backgrounds, textures, decorative elements, and sounds. They must not alter semantic color meaning. Green still means go. Blue still means communicate. Amber still means settings. Gray still means navigation.

Connect Appearance settings are an admin/testing tool first, not receiver-facing setup. The web receiver may load an active local theme through CSS variables for fast preset testing, with defaults matching the working Classic Green appearance. Theme customization should remain optional and local until the Admin extraction has a stable Connect island. Later, presets can be assigned to the appropriate durable owner, likely household, receiver device, or user preference, without making Ask, audio, or receiver setup depend on that customization layer.

Typography should prioritize readability: large font sizes, high contrast, simple typefaces, and clear labels. Avoid decorative fonts, tiny labels, and low contrast text. Labels belong inside buttons whenever practical.

Touch targets should be larger than typical consumer app controls and tolerate tremors, imprecise taps, and limited dexterity.

Appliance Test:

Could an older adult walk up to this device and immediately understand what to press?

If not, simplify. The objective is not sophistication. The objective is confidence.

## Future Concept: Household Receiver & Shared Context Platform

CarePland Connect is not fundamentally a calling product.

It is a conversation-routing and shared-context platform designed to help families successfully communicate when traditional communication methods fail.

The goal is not:

"Notification delivered."

The goal is:

"Conversation started."

Over time, Connect may evolve beyond communication into a persistent family presence layer that facilitates awareness, coordination, and shared understanding across households.

### Conversation Success Over Device Success

Traditional communication systems measure success when:

- Phone rings
- Text delivers
- Notification appears

Connect measures success when:

- A family member is reached
- A conversation begins
- Shared understanding is achieved

All architecture decisions should support this principle.

### Endpoint Routing Philosophy

Connect should be designed around endpoints rather than specific devices.

Potential endpoints include:

- Android Receiver
- CarePland Mobile App
- PSTN telephone
- Smart speakers
- Smart displays
- Cameras
- Future CarePland hardware

The Connect Router should determine:

"What is the most likely way to successfully begin a conversation right now?"

rather than:

"What device should receive a notification?"

### Household Receiver Concept

The Household Receiver is a dedicated in-home communication appliance.

It serves as:

- Communication endpoint
- Family information display
- Appointment dashboard
- Shared context display

The device should feel like a household appliance rather than a tablet.

Preferred hardware characteristics:

- Approximately 7-inch display
- Always powered
- Wi-Fi connected
- Integrated speaker
- Integrated microphone
- Countertop or tabletop placement
- High visibility
- High volume output

The device does not require cellular service, high-performance processors, large storage, premium cameras, or general-purpose tablet functionality. The receiver exists to facilitate communication and context sharing.

### Appliance vs. Tablet Philosophy

Users should perceive the receiver as:

"The CarePland thing."

Not:

"The tablet."

The less the experience resembles a traditional tablet or smartphone, the lower the support burden and cognitive load.

Desired characteristics:

- Always available
- No app launching
- No navigation complexity
- No account management
- No charging requirements

### Initial Hardware Strategy

Phase 1 should use commodity Android hardware.

Potential configuration:

- Refurbished Android tablet
- Kiosk mode
- CarePland launcher
- Always-on charging
- Dedicated stand

Benefits:

- Minimal hardware investment
- Rapid prototyping
- Field testing
- Low replacement cost

A custom 3D-printed stand may provide:

- Nest Hub-style viewing angle
- Hidden cable routing
- Improved stability
- Better speaker projection
- Appliance-like appearance

This approach allows validation of product concepts before custom hardware development.

### Screen Sharing & Shared Context

The long-term value of Connect may be less about voice communication and more about synchronized context.

Families frequently experience communication failures not because they cannot speak, but because they are not viewing the same information. Connect can solve this problem.

A caregiver may remotely present information on the receiver.

Examples:

- Appointment information: cardiology follow-up, time, doctor, address, and pickup plan.
- CarePrep: questions to ask, symptoms to discuss, medication review, blood pressure readings.
- Visit summary: doctor recommendations, medication changes, lab work, follow-up plan.
- Family coordination: grocery lists, errands, caregiver schedules, family reminders.

Design principle:

The system should support:

"I am showing this to you."

rather than:

"Can you find this on your device?"

This reduces cognitive burden and improves accessibility for seniors.

### Voice Communication

Core communication flow:

1. Andrew requests conversation.
2. Receiver announces request.
3. Mom accepts.
4. Conversation begins.

State progression:

`Requested -> Notified -> Accepted -> Connecting -> Connected -> Ended`

### Override & Escalation Concepts

Future versions may support escalation paths when communication attempts fail.

Examples:

- Receiver announcement
- Alternative endpoint routing
- Additional household devices

Designs should prioritize family communication and consent while avoiding surveillance-oriented behavior.

### Smart Display Inspiration

Devices such as smart displays demonstrate several desirable characteristics:

- Always visible
- Always powered
- Voice capable
- Whole-room presence
- Shared household location

These characteristics are more important than specific vendor ecosystems.

The long-term objective is not to replicate a smart home platform. The objective is to create a family communication appliance.

### Long-Term Product Vision

Connect ultimately becomes a household presence layer that supports:

- Communication
- Appointment awareness
- Care coordination
- Shared context
- Family connection

A future interaction may resemble:

"Hello Ms. Smith. You have an appointment at 2 PM today. Andrew will pick you up at 1:30. Is there anything you would like me to tell him?"

The receiver is no longer merely a calling device. It becomes a trusted communication bridge between households.

Guiding question:

"Does this increase the probability that meaningful communication and shared understanding occur between family members?"

## Future Concept: Receiver-Initiated Communication

The Receiver is not a passive endpoint.

The Receiver should support both:

- Inbound communication
- Outbound communication

with equal importance.

The long-term goal is not to build a better speakerphone. The goal is to create the simplest possible way for family members to initiate, receive, and share context-rich communication regardless of technical ability.

### Core Principle: Intent-Based Communication

CarePland Connect should avoid becoming a traditional phone replacement.

Receiver design principle:

The receiver should present the smallest possible interface and ask users what they are trying to accomplish. CarePland should route requests to the appropriate workflow, screen, or family member. Users should not be required to understand application structure, modules, or navigation hierarchy.

The receiver should not center on:

- Contacts lists
- Dial pads
- Call logs
- Voicemail trees
- Generic phone menus

Those patterns recreate the complexity Connect is meant to reduce.

Instead, the receiver should support intent-based communication.

Examples:

- Call Andrew
- Contact Family
- I Need Help
- Leave Message
- Tell Andrew Something
- Ask About This Appointment
- Show Appointment

The receiver home screen should offer a small number of large, obvious actions rather than a general-purpose communication app.

### Receiver Home Structure

The receiver home screen should organize around three human questions:

People:

"Who can I reach?"

Examples:

- Andrew
- Susan
- Family

What's Happening:

"What matters right now?"

Examples:

- Appointment tomorrow
- Message from Andrew
- Grocery request pending

Action:

"What would you like to do?"

Examples:

- Call Andrew
- Do Something Else

"Do Something Else" is the AI doorway and escape hatch. It should not become the primary UI or a replacement for obvious one-touch actions. When selected, the system asks what the user wants to do, then Connect routes the intent to the right person, workflow, or screen.

### Three-Zone Appliance Layout

The receiver should be divided into three persistent zones:

- Status Area: fixed at the top. Shows time, greeting, people, human availability, next appointment, and critical reminders.
- Action Area: fixed in the middle. Shows a tiny set of large appliance controls such as Call Andrew and Do Something Else.
- Workspace Area: dynamic at the bottom. Swipes horizontally between activity feed, contact context, appointment context, intent workspace, and setup/debug context.

Only the Workspace Area should swipe or transform. The Status Area and Action Area should remain fixed so users keep orientation and muscle memory.

The useful mental model is a classic household appliance:

Static display + static buttons + dynamic workspace.

### UI Stability Principle

The interface must never reposition, replace, resize, or reorder interactive controls while the user may reasonably be attempting to interact with them.

More simply:

"Nothing should move under the user's finger."

This is especially important for the receiver. Primary controls should remain in consistent locations, and dynamic content should not disturb the touch targets users rely on.

### Receiver Reliability Principle

The receiver should assume that software updates, refreshes, and recovery actions will never be initiated by the receiver user.

The system should self-maintain whenever possible.

Receiver users should not be expected to restart the app, refresh the screen, apply updates, recover failed services, reconnect integrations, or understand technical fault states. Maintenance, recovery, and operational correction should be automatic when possible or handled by the caregiver/admin side.

If a receiver app or web receiver refreshes, crashes, updates, or reloads, it should recover back into receiver appliance mode automatically. A refresh should not return the user to a setup/start screen unless the receiver has intentionally been unpaired, deactivated, or signed out by an admin.

Receiver authentication should also be appliance-oriented. Once a receiver is paired and trusted, normal session timeout behavior should not interrupt receiver availability. The receiver should not require the receiver user to periodically log back in. Credential renewal, token refresh, and recovery from expired sessions should be handled silently where possible or from the caregiver/admin side.

### Must-Do: Remote Receiver System Volume Control

The caregiver/laptop side should eventually be able to control the actual Android receiver system volume.

This is separate from the current local comfort-volume setting, which only adjusts CarePland sound playback relative to the device's current media volume and must not change Android system volume or require Do Not Disturb permissions.

Future remote system-volume control should be treated as an operational/admin receiver capability. It should be initiated from the caregiver/admin side, clearly logged, and designed carefully around Android permissions, user consent, and device-management limitations.

### Must-Do: Admin Override for Receiver Local Settings

The caregiver/admin side should eventually be able to control whether the receiver user may change local comfort settings on the Android receiver.

This may include locking or limiting:

- Volume controls
- Retro Sounds
- Button Beeps
- Retro Ringers
- Future comfort/accessibility settings that affect receiver audibility or reliability

Rationale:

The receiver user may turn down or disable sounds without fully understanding the communication implications. In some care situations, that could make Connect unreliable at the exact moment it is needed.

Design requirements:

- Treat this as an admin/lockdown capability, not a hidden punishment.
- Make the current control state visible to caregiver/admin.
- Prefer clear receiver copy such as "Managed by caregiver" when a setting is locked.
- Log admin changes.
- Avoid exposing mission-critical routing or safety controls on the receiver.
- Preserve local comfort control by default unless caregiver/admin intentionally restricts it.

## Future Concept: Contextual Reminders & Household Memory

CarePland Connect should eventually support contextual reminders that go beyond alarms and notifications.

The goal is not simply to remind someone that an event exists. The goal is to deliver useful context at the moment it is needed.

Examples:

- "Elizabeth, it's your scheduled bedtime. Don't forget to put your hearing aids in the charger on your bedside nightstand."
- "Good morning, Elizabeth. Your morning medication is set up on the breakfast bar."
- "Elizabeth, Andrew will be picking you up for your appointment at 1:30 PM today."

These reminders combine timing, caregiver knowledge, appointment context, household routines, and location-specific information. The system becomes a repository for "household memory" that caregivers normally carry in their heads.

Traditional reminders answer:

"What time is it?"

CarePland reminders should answer:

"What should I know right now?"

The objective is not compliance. The objective is support, continuity, and reduced confusion. Connect should feel like a helpful family member rather than an alarm clock.

### Household Memory

Caregivers often know things such as:

- Hearing aids charge on the nightstand.
- Morning medication is on the breakfast bar.
- The walker is in the bedroom.
- The appointment paperwork is in the blue folder.

These details are frequently forgotten, especially when memory issues are present. Connect can preserve and deliver this information when appropriate.

### Phase 1: Scheduled Contextual Reminders

Implement simple scheduled reminders.

No environmental awareness required. No sensors required. No AI required.

Admin creates:

- Reminder Name: Bedtime Reminder
- Time: 10:00 PM
- Message: "Elizabeth, it's your scheduled bedtime. Don't forget to put your hearing aids in the charger on your bedside nightstand."

At the scheduled time:

- Receiver announces message.
- Receiver displays message.
- User may choose `OKAY` or `REMIND ME LATER`.

Example reminder types:

- Bedtime: "Elizabeth, it's your scheduled bedtime. Don't forget to put your hearing aids in the charger on your bedside nightstand."
- Morning Medication: "Good morning, Elizabeth. Your morning medication is set up on the breakfast bar."
- Appointment Preparation: "Elizabeth, your cardiology appointment is tomorrow. Please remember to bring your blood pressure log."
- Departure Reminder: "Elizabeth, Andrew will be picking you up in 30 minutes."
- Routine Tasks: "Elizabeth, today is trash pickup day."

Initial reminder object:

```json
{
  "name": "Morning Medication",
  "careVip": "Elizabeth",
  "scheduledTime": "08:00",
  "message": "Good morning, Elizabeth. Your morning medication is set up on the breakfast bar.",
  "allowSnooze": true,
  "snoozeMinutes": 15,
  "active": true
}
```

### Reminder Receiver UX

Reminder appears in the workspace area.

Receiver speaks the reminder aloud.

Buttons:

- `OKAY`
- `REMIND ME LATER`

Optional future action:

- `CALL ANDREW`

### Reminder Speech Source Hierarchy

Reminder speech should support a hierarchy of human warmth and availability.

Preferred order:

1. Pre-recorded caregiver or family voice
2. Selected CarePland AI voice
3. Device/browser text-to-speech fallback

The goal is to make reminders feel human, familiar, and emotionally grounded when possible.

Examples:

- Andrew records: "Mom, don't forget I'll pick you up at 1:30."
- Susan records: "Mom, your morning medication is on the breakfast bar."
- If no recording exists, CarePland uses the selected AI voice.
- If AI voice generation is unavailable, the receiver uses device/browser TTS.

Design requirements:

- Each reminder may optionally include a recorded audio asset.
- Recorded reminders should preserve the written transcript/message beside the audio.
- The receiver should always display the reminder text, even when audio is available.
- Speech source should be visible in admin/caregiver tools.
- Users should be able to replace or remove recorded reminder audio.
- CarePland should not require recorded audio for reminders to work.

This creates a graceful quality descent:

```text
Family voice -> CarePland AI voice -> Device/browser TTS
```

The experience should remain reliable even when the most human option is unavailable.

### Phase 2: Reminder Templates

Allow caregiver to define:

- Trigger: Bedtime
- Context: Hearing aids on nightstand

Generated message:

"Elizabeth, it's your scheduled bedtime. Don't forget to put your hearing aids in the charger on your bedside nightstand."

Goal: separate schedule from reminder content.

### Phase 3: Connect + Personal Integration

Use existing Personal data, including appointments, providers, CarePrep, medication schedules, follow-ups, and caregiver notes.

Examples:

- "Elizabeth, your audiology appointment is tomorrow at 10 AM. Don't forget your hearing aids."
- "Elizabeth, Andrew noted that the lab order is already printed and waiting by the front door."

### Phase 4: Basic Situational Awareness

Potential future integrations:

- Motion sensors
- Presence detection
- Door locks
- Camera events
- Device activity

Example:

"Good morning, Elizabeth."

only after morning activity is detected.

This phase is intentionally deferred.

### Contextual Reminder Principle

CarePland Connect reminders should deliver context, not just time.

The system should preserve household knowledge and deliver it at the moment it becomes useful.

The long-term vision is not an alarm clock. The long-term vision is a trusted household communication layer that helps people maintain routines, independence, and continuity.

### Scenario: Mom Initiates Contact

Many seniors are not comfortable navigating contacts, apps, or phone menus.

The receiver could reduce outbound contact to a few trusted options:

- Call Andrew
- Call Susan
- Family Group
- Caregiver
- I Need Help

No dialing, searching, contact-management, or app-launching should be required.

### Human Status Before Contact

The receiver should show human status, not technical status.

Useful examples:

- Andrew is available.
- Andrew was last active 5 minutes ago.
- Andrew is traveling.
- Susan is on a call.
- Family group is available.

This context helps the recipient decide whether to call, send a message, or choose another family contact. It should not expose infrastructure states such as socket status, push status, endpoint health, or device telemetry on the household-facing surface.

### Scenario: Context-Driven Outbound Communication

Outbound communication becomes more useful when it carries context.

Example:

The receiver says:

"You have an appointment tomorrow."

Mom taps:

"Question for Andrew"

Mom says:

"Can you ask if they're doing blood work?"

CarePland routes the message with appointment context attached.

This is more useful than a generic message because the recipient understands what the question is about.

### Scenario: "Tell Andrew..."

Connect should support low-friction spoken relay from the receiver.

Example:

The receiver says:

"Andrew will pick you up tomorrow at 1:30."

Buttons:

- OK
- Tell Andrew Something

Mom says:

"Can we stop at the pharmacy?"

CarePland delivers that message to Andrew without requiring Mom to use a phone, open an app, type, or navigate contacts.

### Scenario: One-Touch Audio or Video

The receiver may eventually support a Nest Hub-like one-touch communication surface.

Possible home screen actions:

- Andrew
- Susan
- Caregiver
- Family

Tap:

"Talk to Andrew."

No contacts app. No dialing. No searching.

### Scenario: Asynchronous Communication

Asynchronous communication may become as important as live calling.

Example:

Mom presses:

"Leave Message"

Mom records:

"I found the insurance paperwork."

CarePland delivers:

"Mom left a message."

Future versions may transcribe, summarize, label confidence, and route the message to the appropriate approved care circle member.

### UI Implication

The receiver home screen may need to evolve from a passive display:

- Current time
- Next appointment

into an action-oriented communication appliance:

- Current time
- Next appointment
- Call Andrew
- Messages
- Appointments
- Leave Message
- Ask For Help

Actions should remain large, limited, and purpose-driven.

### Contextual Actions

Because Connect can understand CarePland context, outbound communication should be contextual whenever possible.

If Mom is viewing an appointment, the receiver could show:

"Ask About This Appointment"

CarePland can route the message as:

"Mom has a question about Cardiology Follow-Up on June 22."

This is more useful than a generic phone call or generic message because the communication includes shared context by default.

## Future Concept: CarePland Voice / Conversational Care Relay

CarePland Connect may eventually become more than a caller-to-receiver system. Once the Android Receiver can reliably handle audio input and output, it can become a conversational care relay: a trusted voice interface that helps older adults communicate information back to their care circle.

Core idea:

CarePland can proactively speak useful, contextual information and invite a natural spoken response.

Example prompt:

"Hello Ms. Smith. You have an appointment with Dr. Jones today at 2 PM. Andrew will be picking you up before that. Is there anything you'd like him to know?"

Example recipient response:

"Tell Andrew I want to get lunch before."

CarePland routes this to Andrew as:

"Mom says she would like to get lunch before today's 2 PM appointment."

Additional examples:

- "Tell Andrew I'm not feeling well."
- "Tell Susan I need more groceries."
- "Ask Andrew what time he is coming."
- "Tell Jenny the pharmacy called."

This would connect multiple CarePland layers:

- Personal: appointments, CarePrep, visit context
- Family: errands, concerns, caregiver coordination
- Connect: voice receiver, call initiation, trusted communication
- Future AI layer: listen, summarize, route, escalate

Important product distinction:

CarePland Voice is not AI companionship, surveillance, or always-on monitoring. It is a communication bridge between trusted people.

Potential capabilities:

- Appointment reminder with response capture
- Caregiver pickup coordination
- Spoken concern reporting
- Voice-to-message relay
- Voice-to-errand creation
- "Would you like me to call Andrew?" escalation
- Summary and routing to approved care circle members
- Confidence labeling and audit trail

Design principle:

CarePland Voice should help humans communicate with each other. The AI is the relay, not the relationship.

Strategic note:

This could become a profound interactive experience because it gives older adults a low-friction way to communicate needs, preferences, worries, and reminders without opening an app, finding a phone, or typing. The receiver becomes a trusted communication appliance for the household.

## Future Implementation Note: External Video Service Integration (Not Native Connect Video)

Status: Future Concept / Parking Lot

### Purpose

CarePland Connect should not assume that all households need or want a Connect-native video calling solution.

Many users already successfully use FaceTime, Zoom, Google Meet, WhatsApp, Microsoft Teams, or other video services. These users have existing contacts, established habits, and familiarity with those platforms.

The goal of Connect is communication orchestration, not necessarily ownership of the transport layer.

### Design Philosophy

Connect should focus on helping people successfully connect.

If an existing video platform already works for a household, Connect should leverage that platform rather than replacing it.

This follows the broader Connect philosophy:

- Hide complexity.
- Use existing tools when appropriate.
- Build only what needs building.
- Optimize for successful communication, not feature ownership.

### Future Coordinator Configuration

Potential Connect Admin settings:

Communication Options:

- Audio Calling Enabled
- Video Calling Enabled

Preferred Video Service:

- FaceTime
- Zoom
- Google Meet
- WhatsApp
- Microsoft Teams
- Connect Video (future)

Optional:

- Show Video Call Buttons
- Allow Multiple Video Services
- Fallback Service Selection

### Receiver Experience

The receiver should never need to understand underlying platform choices.

Examples:

- Call Andrew
- Video Call Andrew

or

- Call
- Video Call

The receiver should not need to know:

- FaceTime
- Zoom
- Google Meet
- WhatsApp
- Teams

Those implementation details belong to coordinator configuration.

### Potential Launch Model

When a receiver initiates a video call:

1. Connect determines the configured service.
2. Connect launches the appropriate external application or meeting link.
3. User participates using the familiar platform.
4. User exits the external app and returns to Connect.

This should be treated as a handoff model rather than Connect-controlled video.

### User Segmentation

Three likely categories:

1. Existing Video Users

Already comfortable with FaceTime or similar tools.

Goal:
Launch familiar platform.

2. Assisted Users

Can participate in video calls but cannot reliably initiate them.

Goal:
Connect handles launch and setup.

3. Appliance-Only Users

Need an entirely managed communication experience.

Goal:
Potential future Connect-native audio/video solution.

### Long-Term Possibility

Connect Video may eventually exist as a native communication layer.

However:

- External service integration should remain a first-class option.
- Native video should not be required for Connect success.
- Native video should only be built if it provides clear value beyond existing services.

### Key Principle

The value of Connect is helping people communicate.

The value is not necessarily in owning the audio/video transport mechanism.

Success is measured by:

`Mom and Andrew successfully connected.`

not

`The connection occurred through Connect-owned video infrastructure.`

## Care Circle Roles and Communication Permissions

CarePland Connect is not a social network and not a phone directory. It is a care circle.

Membership in a care circle does not automatically grant visibility or direct communication with every other member.

Initial roles:

- Receiver User: the person using the receiver device/app, such as Mom or Elizabeth.
- Coordinator/Admin: the person managing the care circle, receiver behavior, routing, reminders, devices, and permissions, such as Andrew.
- Participant: a trusted care-circle member, such as Cousin Ann, Susan, or Blaine.

Default participant visibility:

- A Participant may see/contact the Receiver User.
- A Participant may see/contact the Coordinator/Admin.
- A Participant may not automatically see or contact other Participants.

Participant visibility settings:

- private: visible only to the Coordinator/Admin and, if allowed, the Receiver User.
- discoverable: may appear in a scoped discovery flow, but visibility does not imply communication permission.

Direct participant-to-participant communication requires consent from both parties. Do not expose phone numbers, emails, or direct channels before consent.

Connection states:

- none
- requested
- accepted
- declined
- blocked
- revoked

Coordinator/Admin sees all care circle participants and connection states. Participants see only the relationships they are allowed to see. The Receiver User sees a small, simple contact set.

Design principle:

Reveal only the complexity necessary for each role. CarePland Connect should facilitate care communication without accidentally creating family politics software.

## V1 Participant Interface: SMS-First Contribution

For V1, care circle participants such as Cousin Ann, Susan, or Blaine should be able to participate using their existing phone number and normal texting workflow.

Participants should not need to install an app, learn a dashboard, or log into a participant portal for basic contribution.

V1 surface split:

- Participant: SMS-first contribution.
- Receiver User: dedicated receiver/app/web device.
- Coordinator/Admin: web admin app.

Participant V1 capabilities:

- Send a text message to the Receiver User.
- Send a text message to the Coordinator/Admin.
- Receive delivery/heard/read confirmation.
- Reply YES/NO to confirmation prompts.
- Receive simple reminders or prompts from the Coordinator.
- Later receive a secure link for richer actions if needed.

Participant V1 non-goals:

- No full participant UI.
- No dashboard.
- No participant calling.
- No care circle browsing.
- No participant-to-participant discovery.
- No receiver settings.
- No admin controls.

For V1, participants cannot directly call the receiver through Connect. Participant V1 is messaging/contribution only.

Example: message to receiver

Participant texts CarePland:

"Tell Elizabeth good luck at the doctor today."

CarePland replies:

"Send this to Elizabeth?

Good luck at the doctor today.

Reply YES to send or NO to cancel."

After YES, the receiver shows:

"Message from Ann"

"Good luck at the doctor today."

Receiver actions may include:

- HEAR
- READ
- CALL BACK if allowed

Example: message to coordinator

Participant texts:

"Tell Andrew I can drive Elizabeth on Tuesday."

CarePland routes the message to the Coordinator/Admin and replies:

"Message sent to Andrew."

Ambiguous recipient:

If a participant texts:

"I can help Tuesday."

CarePland replies:

"Who should receive this?

1. Elizabeth
2. Andrew

Reply 1 or 2."

Routing logic:

V1 SMS routing uses care circle membership and permissions. A participant's default allowed recipients are the Receiver User and the Coordinator/Admin. Other participants are disallowed unless a direct connection exists later.

Identity:

Participant identity is based on a verified phone number mapped to a care circle participant record. If no match exists, CarePland should reply:

"This phone number is not currently connected to a CarePland Connect care circle."

Confirmation requirement:

SMS messages should generally require confirmation before sending, especially when parsing or AI routing is involved. Use "Reply YES to send" and "Reply NO to cancel" to avoid accidental malformed or misrouted messages.

Initial SMS participant message object:

```json
{
  "careCircleId": "",
  "fromParticipantId": "",
  "fromPhone": "",
  "toType": "receiver_user | coordinator",
  "toId": "",
  "body": "Good luck at the doctor today.",
  "source": "sms_participant",
  "status": "pending_confirmation | sent | canceled",
  "createdAt": "",
  "sentAt": "",
  "heardAt": null,
  "readAt": null
}
```

Future extensions:

- Participant voice-message by phone call.
- Participant secure web link for richer actions.
- Participant-to-participant communication with mutual consent.
- Direct calling if explicitly enabled.
- Family audio reminder recording.
- Reminder contribution prompts.
- Opt-in message status notifications.

Design principle:

Do not force casual participants into another app. CarePland Connect should meet participants where they already are: their phone, their number, and their normal texting workflow. This keeps V1 lightweight and prevents Connect from becoming a phone service or social network too early.

## Foundational Model: Household Receivers, Admin Delegation, and Escalation

### Receiver Household Model

A receiver is a device endpoint, not always a person.

CarePland Connect should support:

- Receiver Device: the physical or software endpoint, such as Kitchen Receiver.
- Receiver Household / Care Unit: the shared care context, such as Elizabeth and Robert.
- Receiver Person: an individual associated with that household, such as Elizabeth or Robert.

A receiver may serve one person, a married couple, multiple household members, or future shared-care settings.

Messages and reminders may target:

- Elizabeth
- Robert
- Both / Household

Design principle:

A receiver is a device endpoint. A receiver household is the care context. A receiver person is an individual associated with that endpoint.

### Owner and Admin Separation

Do not treat Admin as one unlimited role forever.

Owner / Super Admin controls account-level authority and highest-risk decisions:

- billing/account ownership
- delete care circle
- assign/remove admins
- transfer ownership
- highest-risk permissions
- escalation/override policy

Admin / Coordinator manages the care operation:

- receiver setup
- care circle members
- reminders
- messages
- routine routing
- receiver comfort/operational settings as allowed

For V1, allow:

- one Owner / Primary Admin
- one Additional Admin

The additional Admin may help manage reminders, participants, messages, receiver setup, and routine care coordination.

Design principle:

Admin manages the care operation. Owner/Super Admin controls ultimate authority and account-level risk.

### Escalation and Override Policy

Escalation / override is separate from Admin.

Admin rights manage the system. Escalation rights affect the receiver household directly.

Future escalation levels may include:

- none
- request attention
- persistent ring / repeated announcement
- urgent bypass quiet hours
- direct audio/video override only if explicitly enabled and consented

For V1, escalation policy may remain a placeholder, but it should be modeled separately from Admin access.

Suggested data concepts:

- CareCircle
- ReceiverDevice
- ReceiverHousehold
- ReceiverPerson
- CareCircleMember
- EscalationPolicy

Important product principles:

- A care circle is not a social network.
- A receiver is not always one person.
- Admin access is not the same as ownership.
- Override/escalation access is not the same as Admin access.
- Families are complicated, so allow one trusted additional Admin early.
- Keep V1 simple, but do not hardcode assumptions that break married-couple or shared-household use cases later.

### Future Model Pressure Tests

These scenarios should be raised during future design or implementation if a proposed workflow intersects them.

Multiple receivers, same household:

- Example: Kitchen Receiver plus Bedroom Receiver.
- Messages/reminders may eventually target one device, all devices, or the nearest/active device.
- Do not assume one household has exactly one receiver endpoint.

One person, multiple households:

- Example: Mom has home, assisted living, and a temporary stay with family.
- Receiver location should remain flexible.
- Do not assume one receiver person has exactly one fixed household context forever.

Multiple care circles for one admin:

- Example: Andrew manages Mom, Dad, Ellie, and possibly another relative.
- Admin experiences must not assume one admin maps to one care circle.

One participant in multiple care circles:

- Example: Ann helps Elizabeth and another relative.
- Her SMS/portal identity may map to more than one care circle.
- Routing must eventually disambiguate which care circle a message belongs to.

Shared receiver, private messages:

- Example: Elizabeth and Robert share a receiver.
- Some messages are household-safe.
- Other messages should be directed only to Elizabeth or only to Robert.
- Message privacy cannot be inferred from device alone.

Receiver person without login:

- Elizabeth may never have a user account.
- A Receiver Person is a person/entity, not necessarily an authenticated user.

Admin succession:

- The primary admin may become unavailable.
- Additional admin rights, owner transfer, and succession policy matter eventually.

Paid caregiver boundary:

- A paid caregiver may participate in care communication.
- They should not automatically see family details, other participants, or historical private messages.

Emergency/override consent per person:

- In a married-couple household, Elizabeth may consent to override while Robert may not.
- Escalation consent should be person-aware where needed.

Deceased/inactive receiver person:

- A receiver person may eventually be archived without deleting family messages, reminders, or historical care context.
