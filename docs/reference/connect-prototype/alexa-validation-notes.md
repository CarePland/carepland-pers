# Alexa Interface Validation Notes

## Validation Question

Can CarePland Connect use Amazon Alexa so that Mom hears a prompt like:

> Hello, incoming call from Andrew. Accept the call?

And, if Mom accepts, can CarePland establish a live conversation?

## Current Working Hypothesis

The exact desired workflow is unlikely to be supported through standard public Alexa Skills Kit APIs.

Alexa appears to support:

- Custom skills that respond after the user invokes the skill.
- Proactive Events that create Alexa notifications for opted-in users.
- Reminders that can speak configured reminder text, with permission constraints.
- Native Alexa Calling / Drop In behavior managed by Amazon/Alexa accounts.

Alexa does not appear, from public docs reviewed so far, to expose a standard third-party API that lets CarePland:

1. Remotely wake a recipient Echo device.
2. Speak an arbitrary real-time prompt.
3. Capture an immediate yes/no acceptance.
4. Programmatically bridge a live audio call from an external caregiver app.

## Relevant Findings

### Proactive Events

Proactive Events are available to custom skills and can send events to Alexa users who opted in to receive them.

However, Amazon currently describes one proactive channel: Alexa Notifications. These are based on predefined schemas, not arbitrary conversational prompts.

The closest schema found is `AMAZON.MessageAlert.Activated`, but its notification phrase is fixed around message counts and message status, for example:

> You have three new messages from Jane Doe.

This does not match the CarePland need for:

> Incoming call from Andrew. Accept the call?

### Reminders

Reminders can include spoken content and can create an audible Alexa reminder.

However, reminder creation is designed around a skill session and reminder permissions. It is not clearly suitable for immediate, external call orchestration, and it does not solve live call bridging.

### Custom Skills

A custom skill can ask Mom "Do you want to accept the call?" once Mom is already interacting with the skill.

The unresolved issue is initiation: CarePland needs Andrew's action to cause Mom's device to prompt her without Mom first invoking the skill.

### Native Alexa Calling / Drop In

Native Alexa Calling and Drop In may match the human experience more closely, but public Alexa Skills Kit docs do not show a supported third-party API for initiating those calls from a custom external app.

## Practical Validation Plan

### Path A: Proactive Events Proof

Goal: Confirm whether Alexa Notifications can be used as a low-friction receiver alert.

Test:

1. Create a development Alexa custom skill.
2. Add Proactive Events with `AMAZON.MessageAlert.Activated`.
3. Enable notifications for the test skill in the Alexa app.
4. Send a unicast proactive event to the recipient account.
5. Observe:
   - Does the Echo device speak aloud?
   - Does it only show/play a notification tone?
   - Can the wording be made acceptable?
   - Can Mom respond by voice immediately?

Expected result: Useful as an alert at best, not a full Connect Request.

### Path B: Reminder Proof

Goal: Confirm whether a just-in-time reminder can audibly speak a call invitation.

Test:

1. Build a test skill with reminder permissions.
2. Invoke the skill once as Mom and grant reminder permission.
3. Attempt to create a near-immediate reminder with text like "Andrew is trying to call you."
4. Observe:
   - Minimum scheduling delay.
   - Spoken wording.
   - Whether it feels like a call or like a reminder.
   - Whether it allows an immediate accept flow.

Expected result: Audibly noticeable but probably semantically wrong and not a live call path.

### Path C: Native Alexa Calling Research

Goal: Determine whether any partner/API path exists for Alexa Calling, Drop In, or real-time communications.

Test:

1. Review current Amazon developer materials for communications, smart home WebRTC, and partner programs.
2. Contact Amazon developer support if public docs remain unclear.
3. Specifically ask whether a third-party caregiver app can initiate a recipient Echo prompt and bridge a live audio session.

Expected result: likely requires native Alexa features, a partner/private API, or is not supported.

## Product Implication

Do not make Alexa the only MVP path until Path A-C are validated on real hardware.

The safer architecture is still:

- CarePland Connect owns the conversation orchestration state.
- Alexa is treated as one possible receiver transport.
- Phone/SMS/mobile/tablet/VoIP remain available receiver transports.
- Alexa support should be promoted only to first-class status if real-device validation proves the accept-and-connect workflow is possible.
