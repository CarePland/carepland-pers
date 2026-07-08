# Connect Audio Demo Checklist

This checklist is for near-term CarePland Connect demos where the goal is to show a live call, temporary transcript capture, care-summary generation, and summary approval.

## Local LAN Demo

1. Start the normal local app and HTTPS bridge:
   - `scripts/restart-connect-local.sh`
   - Use the printed HTTPS Dashboard and Receiver URLs.
2. Confirm both devices are on the same network.
3. Use HTTPS for phone/Receiver testing so the browser can request microphone access.
4. On the Receiver, answer the call and confirm the microphone prompt appears if needed.
5. On the Dashboard, speak the care-relevant test scenario for at least 35-45 seconds so the first transcript chunk has time to complete.
6. End the call from either side.
7. Confirm the Receiver shows the call-summary status, then opens/reviews the summary when ready.
8. Approve only care-relevant summary text. Approval should keep the approved summary and delete the temporary transcript.

## Internet Demo

Internet demos may connect less reliably with only public STUN. Configure TURN before relying on a remote demo.

For production, use Twilio Network Traversal Service. The app generates short-lived ICE credentials server-side when these environment variables are present:

```bash
TWILIO_ACCOUNT_SID='AC...'
TWILIO_AUTH_TOKEN='...'
```

The browser fetches the resulting ICE server list from `/api/connect/calls/ice-config` when a live call starts. The Twilio auth token is never sent to the browser.

Static TURN settings are still supported as a fallback or short demo bridge:

```bash
CONNECT_ICE_SERVERS_JSON='[{"urls":["stun:stun.l.google.com:19302"]},{"urls":["turn:example.com:3478"],"username":"demo-user","credential":"demo-password"}]'
```

Or:

```bash
CONNECT_STUN_URLS='stun:stun.l.google.com:19302'
CONNECT_TURN_URLS='turn:example.com:3478'
CONNECT_TURN_USERNAME='demo-user'
CONNECT_TURN_CREDENTIAL='demo-password'
```

The older browser-exposed names still work as a fallback:

```bash
NEXT_PUBLIC_CONNECT_ICE_SERVERS_JSON='[{"urls":["stun:stun.l.google.com:19302"]},{"urls":["turn:example.com:3478"],"username":"demo-user","credential":"demo-password"}]'
```

Or:

```bash
NEXT_PUBLIC_CONNECT_STUN_URLS='stun:stun.l.google.com:19302'
NEXT_PUBLIC_CONNECT_TURN_URLS='turn:example.com:3478'
NEXT_PUBLIC_CONNECT_TURN_USERNAME='demo-user'
NEXT_PUBLIC_CONNECT_TURN_CREDENTIAL='demo-password'
```

Static TURN credentials are acceptable only as a short demo bridge. Production should use Twilio-generated short-lived TURN credentials.

## Demo Script

Use care-relevant content, not general conversation:

- Appointment: "For tomorrow's cardiology follow-up, please bring the medication list."
- Medication context: "The medication list is taped to the PillPack box."
- Caregiver observation: "The caregiver also knows the over-the-counter medicine that is not in the box."
- Follow-up: "Bring both the PillPack list and any extra over-the-counter medications."

Avoid demonstrating summary capture with gossip, jokes, politics, or general chat. The summary model should omit non-care details, so using non-care content can make the demo look empty by design.

## If Something Looks Wrong

- No microphone prompt: confirm HTTPS or localhost.
- Call connects but no audio: check browser microphone permission and whether TURN is needed for internet testing.
- No transcript after a short call: speak for at least 35-45 seconds; chunked transcript capture is not instant.
- Summary is delayed: use `Check Again` on Dashboard or wait for the Receiver post-call status to update.
- Raw transcript/debug details: use Admin Diagnostics. Do not expose transcript internals as the default demo story.
