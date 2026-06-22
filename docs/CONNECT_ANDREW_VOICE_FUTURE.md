# Connect Future Concept: Andrew Voice

Status: future concept only. This document is not a provider integration plan and does not authorize voice cloning work.

## Product Goal

Connect may eventually read Andrew-authored messages aloud in an Andrew-like voice, using an explicit opt-in voice sample from Andrew.

Plain-language framing:

- Read Andrew's messages in Andrew's voice.
- Andrew's words, Andrew's voice.
- Mom always knows when a message is being read in Andrew's voice.

## Hard Boundary

Andrew Voice may be used only for content authored by Andrew or explicitly approved by Andrew.

Do not use Andrew Voice to:

- make the system pretend Andrew is speaking live
- answer open-ended questions as Andrew
- provide system prompts
- provide medical advice
- interpret a situation and speak as Andrew
- speak any content Andrew did not author or approve

Reminder boundary recommendation:

Andrew Voice may be used for Andrew-authored messages and Andrew-approved reminders only.

## Transparency

Receiver-facing UI must clearly identify synthesized Andrew Voice.

Good copy:

- This message is being read in Andrew's voice.
- Read in Andrew's voice.
- Andrew set up this voice for his messages.

Avoid:

- Andrew is speaking.
- Andrew says...
- Live from Andrew.
- AI voice clone.

## Message Audio Source Distinctions

The system should distinguish:

- recorded audio directly from Andrew
- generated speech in Andrew's voice
- generic system speech

These states should be represented in message/audio metadata before any provider is integrated.

## Coordinator/Admin Setup Concept

Future configuration area:

- Sender: Andrew
- Voice sample status: Not set up / Ready / Needs update
- Use Andrew's voice for Andrew's messages: On / Off
- Re-record voice sample
- Preview what Mom will hear
- Disable Andrew voice

Consent requirements:

- Voice setup must be opt-in by Andrew.
- The receiver/caregiver must be able to disable it.
- The UI must never imply the message is a live call.

## Receiver Playback Concept

When a message from Andrew is opened:

- Show message text/transcript.
- If Andrew Voice is enabled and available, offer or use "Read in Andrew's voice."
- Preserve Play / Stop / Replay behavior.
- Preserve "The words were hard to hear" audio feedback.
- Preserve Call Back.
- Clearly label when generated Andrew Voice is being used.

## Implementation Notes

For now:

- document the safety boundary
- add provider-neutral types/placeholders
- avoid real voice cloning, provider APIs, or synthesized voice generation

Future provider integration should be gated behind explicit consent, source metadata, generated-audio labeling, and Admin review.

Design principle: comforting and familiar, not deceptive.
