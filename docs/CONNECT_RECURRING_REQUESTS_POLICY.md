# Connect Recurring Requests Policy

Last updated: 2026-07-13

CarePland Receiver pages can remain open all day on appliance devices. Treat every recurring request in CarePland as production capacity-sensitive.

## Systemwide Rule

No idle polling, period. A recurring request is allowed only while an explicit active workflow is in progress, such as a user actively reading a live-updating surface, a short-lived pairing/setup flow, recording audio, or another bounded operation that would visibly be broken without refreshes. Home screens, dashboards, hidden tabs, deprecated features, setup-complete Receivers, and background status displays must not poll while idle.

## Current Deprecated Features

- Connect calls are currently disabled for recurring polling. Do not re-enable `/api/connect/calls*` polling until the call feature is intentionally revived.
- Receiver Guide is currently disabled for recurring polling. Do not re-enable `/api/connect/receiver-guide` polling until Guide is rebuilt as an opt-in/debug feature or moved to a lower-volume realtime/presence design.

The feature flags live in `app/lib/connect/receiver/pollingPolicy.ts`.

## Top Offenders Found

Daily invocation estimate:

`86,400 / interval_seconds x pollers x open_clients`

Before the 2026-07-13 fix:

- Modern Receiver Guide: `/api/connect/receiver-guide`, 2 requests every 1 second, visible or hidden. One open Receiver could generate 172,800 invocations/day.
- Classic Receiver Guide: `/api/connect/receiver-guide`, 2 requests every 2 seconds, visible or hidden. One open classic Receiver could generate 86,400 invocations/day.
- Modern Receiver calls: `/api/connect/calls?personId=...`, every 2.5 seconds. One open Receiver could generate 34,560 invocations/day.
- Classic Receiver calls: `/api/connect/calls?personId=...`, every 3 seconds. One open classic Receiver could generate 28,800 invocations/day.
- Receiver messages: `/api/connect/messages?personId=...`, every 5 seconds. One open Receiver could generate 17,280 invocations/day.
- Receiver diagnostics: `/api/connect/receiver/diagnostics`, every 5 seconds. One open Receiver could generate 17,280 invocations/day.
- Dashboard Guide mode: `/api/connect/receiver-guide`, three requests every 2 seconds plus one request every 1.5 seconds while Guide mode is open. One dashboard left in Guide mode could exceed 187,000 invocations/day.

Observed Vercel usage of roughly 200,000-250,000 invocations/day is therefore plausible from a single always-open modern Receiver running Guide polling plus call polling, or from one classic/modern Receiver plus one dashboard left in Guide mode.

## Required Rules For Future Polling

- Prefer realtime/subscriptions or user-triggered refresh for live features when reliable.
- Poll only after prerequisites are present: signed-in user, selected person, bound/provisioned receiver, and active feature state.
- Never use `setInterval` for network polling unless an in-flight guard prevents overlap. Prefer recursive `setTimeout` after the request settles.
- Slow hidden tabs to at least 60 seconds, or pause entirely.
- Add a comment beside each remaining poller explaining why polling is required, why the interval was chosen, and when it stops.
- Use `recordConnectPollingRequest` for development-only endpoint/caller/reason visibility.
- Static context/provisioning should load on mount or explicit change, not fast polling.
- Do not trigger AI summaries, appointment context rebuilds, or MessagePrep rebuilds from routine polling.

## Current Intended Intervals

- Calls: disabled while deprecated.
- Receiver Guide: disabled while deprecated.
- Receiver idle home: no recurring content polling.
- Receiver messages: load on startup/explicit message actions; while a message-reading surface is open, 10 seconds visible and at least 60 seconds hidden; stops without a selected Receiver person or after leaving Messages.
- Receiver Today’s Focus: load on startup for supported appliance layouts and explicitly after Focus actions; no idle interval.
- Receiver binding check: startup and return-to-active-app safeguard; no idle interval.
- Receiver diagnostics setting: startup check only.
