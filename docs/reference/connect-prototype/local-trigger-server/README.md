# CarePland Connect Local Trigger Server

Minimal local server for the Android Receiver milestone.

It does not provide live voice, WebRTC, Firebase, push notifications, auth, or durable database persistence. It coordinates local call triggers, state, and prototype receiver audio messages.

Receiver provisioning is documented in:

```text
../docs/connect-provisioning.md
```

## Start

```bash
npm install
npm start
```

Server URL:

```text
http://localhost:8790
```

Optional transcript generation for uploaded receiver audio messages:

```bash
OPENAI_API_KEY=sk-... npm start
```

For local prototype convenience, the server also reads `OPENAI_API_KEY` and
`OPENAI_TRANSCRIBE_MODEL` from `AUDIO_ENV_PATH` when set. If `AUDIO_ENV_PATH`
is not set, it falls back to the local CP Pers env bridge path used by this
prototype.

The server uses `OPENAI_TRANSCRIBE_MODEL` when set, otherwise `gpt-4o-mini-transcribe`.
If no API key is present, audio is still saved and the message is marked `transcriptStatus: not_configured`.

Saved audio files are written under:

```text
local-trigger-server/uploads
```

The prototype does not apply retention trimming to saved audio or message metadata during normal use. Retention policy is intentionally deferred.

## Shared Audio Boundary

Audio capture, upload/transcription, playback enhancement, and hearing feedback are intentionally modeled as reusable browser/local-server capabilities rather than Connect-only features. Connect currently consumes them first, but the same service shapes should be portable into CP Personal and CP Family later.

Audio review/export responses include `audioDomainModel`, a small schema/version feature descriptor for Admin and migration tooling. It should be treated as metadata about the local audio domain shape, not as receiver-facing configuration.

Current shared browser modules:

- `shared/audio-domain-model.cjs` owns the reusable audio domain model, catalogs, and pure classification helpers used by the local server. Keep product-neutral audio vocabulary here rather than in Connect-specific UI or Admin panels.
- `shared/audio-recording-service.js` records microphone input and supports dead-air auto-stop.
- `shared/audio-client-service.js` uploads recordings for transcription or audio messages.
- `shared/audio-playback-service.js` handles playback, virtual normalization, and speech clarity enhancement.
- `shared/audio-hearing-profile-service.js` creates hearing feedback events and local hearing profiles.

Current local endpoints:

- `POST /audio/transcriptions` saves original audio and returns a transcript when configured.
- Audio upload responses return the preserved `artifact` and `artifactId` when available. Audio messages also carry `audioArtifactId` so future playback, feedback, and Admin review can link directly to the original recording instead of relying only on URL matching.
- `GET /audio/artifacts?receiverId=...` lists original saved audio artifacts, message links, transcript status, source, and duration.
- `POST /audio/artifacts/reconcile` recovers preserved upload files that are missing from the local audio index. Use `dryRun: true` to preview.
- `POST /audio/artifacts/backfill-integrity` computes missing byte size and SHA-256 metadata for indexed artifacts from preserved original files.
- `POST /audio/artifacts/:artifactId/transcribe` retries transcription from the preserved original audio and syncs any linked message transcript.
- `POST /audio/artifacts/transcribe-pending` retries up to 10 pending artifact transcripts from preserved originals by default.
- `GET /audio/artifacts/:artifactId/detail?receiverId=...` returns a read-only detail view for one artifact, including storage status, linked message state, timeline events, enhancement events, hearing feedback, and a normalized audit trail.
- `GET /audio/storage-health?receiverId=...` reports missing originals, unhashed artifacts, recoverable uploads, duplicate groups, and indexed byte totals.
- `GET /audio/maintenance-preview?receiverId=...` previews recover, hash backfill, transcript retry, and missing-original counts without changing state.
- `GET /audio/manifest?receiverId=...` returns a versioned, read-only audio manifest for export, migration, and Admin analysis.
- `GET /audio/export-index?receiverId=...` returns the top-level export checklist with paths, payload hashes, summary hints, and bundle integrity references for all focused export surfaces.
- `GET /audio/export-manifest?receiverId=...` returns a lightweight table of contents for export tooling, including readiness, bundle integrity hashes, summary counts, and export surface links.
- `GET /audio/media-manifest?receiverId=...` returns a file-focused manifest of preserved original media paths, hashes, byte sizes, missing-file status, and integrity checks for migration packaging.
- `GET /audio/transcript-manifest?receiverId=...` returns a compact transcript-focused manifest with transcript text/status, retryability context, artifact links, message links, and transcript text hash.
- `GET /audio/hearing-profile-manifest?receiverId=...` returns User Audio Profile-oriented hearing feedback, enhancement events, source summaries, and profile hashes.
- `GET /audio/review-bundle?receiverId=...` returns a compact read-only Admin/migration bundle with review health, profile summary, maintenance preview, manifest, artifact index, bundle integrity hashes, and endpoint links. Add `download=1` to receive the same bundle as a JSON attachment.
- `GET /audio/timeline?receiverId=...` returns a read-only chronological audio event stream for preserved artifacts, transcription retries, enhanced playback, hearing feedback, and heard/read state.
- `POST /audio/timeline/backfill` creates missing timeline events from indexed artifacts and transcript retry timestamps. Event ids are deterministic so repeated backfills do not duplicate rows.
- `POST /audio/events/backfill-artifact-links` resolves older enhancement/hearing-feedback events to preserved audio artifacts when possible and writes `artifactId`, `artifactKind`, `audioDirection`, and `audioSha256`.
- `GET /audio/review?receiverId=...` aggregates preserved originals, transcripts, hearing profile, enhancement events, feedback, and linked message delivery state from the audio domain.
- `/audio/review` includes `timelineSummary` so Admin views can show recent audio-event activity even before opening the raw timeline.
- `/audio/review` and `/audio/manifest` include `eventLinkHealth`, a read-only summary of enhancement/hearing-feedback events that are linked, backfillable, or unresolved against preserved audio artifacts.
- `/audio/review`, `/audio/manifest`, and `/audio/review-bundle` include `captureHealth`, a read-only summary of how many preserved artifacts include capture context versus older legacy/recovered recordings.
- `/audio/review`, `/audio/manifest`, and `/audio/review-bundle` include `transcriptionHealth`, a read-only summary of transcript configuration, status counts, completed artifacts, and retryable artifacts.
- `/audio/review`, `/audio/manifest`, and `/audio/review-bundle` include `reviewReadiness`, a read-only roll-up of blockers, maintenance items, and legacy notes across audio health checks.
- `reviewReadiness` preserves simple code arrays and also includes richer `items` with severity, label, and description so Admin and migration tools do not need to hardcode readiness text.
- `PATCH /messages/:messageId/state` records receiver-side heard/read state for message delivery review.
- `POST /audio/enhancement-events` records automatic playback EQ/normalization decisions.
- `GET /audio/enhancement-events?receiverId=...` returns automatic enhancement detail events.
- `GET /audio/domain-model` returns the current reusable audio domain schema/version feature descriptor without requiring a receiver-specific review.
- `GET /audio/domain-catalogs` returns the consolidated reusable audio domain catalogs and links to the narrower catalog endpoints.
- `GET /audio/state-metadata` returns the local audio state schema/version, audio domain version, saved/loaded timestamps, collection shapes, retention limits, counts, and migration-needed flag.
- `GET /audio/migration-readiness?receiverId=...` returns a read-only migration/export readiness summary using local state metadata, audio review readiness, collection population, and export endpoint links.
- `GET /audio/capabilities` returns the reusable audio capability catalog and local runtime status.
- `GET /audio/readiness-catalog` returns the review readiness status and item vocabulary.
- `GET /audio/event-catalog` returns the audio event type vocabulary.
- `GET /audio/artifact-catalog` returns the artifact kind and audio direction vocabularies.
- `GET /audio/maintenance-catalog` returns the audio maintenance action vocabulary.
- `POST /audio/hearing-feedback` records whether enhanced playback was easier to hear.
- `GET /audio/hearing-profile?receiverId=...` returns the read-only profile summary and detail events.
- Hearing profile summaries include `sourceSummaries`, grouped by speaker/source surface. These are analysis aids for Admin and future audio-profile tuning; they are not identity records.

Local audio state is persisted in `local-trigger-server/data/audio-state.json` so saved audio artifacts, transcripts, hearing feedback, enhancement events, and message heard/read state survive local server restarts. Original media files remain in `local-trigger-server/uploads/`. New saves include audio state schema metadata plus the active reusable audio domain/version so future migration tooling can tell which local state shape it is reading.

Audio artifacts include local integrity metadata when available: byte size and SHA-256 hash. This is used for review, future duplicate detection, and safer migration into a shared Pers/Family audio service.

Audio artifacts also carry product-neutral classification metadata:

- `artifactKind` describes what the audio represents, such as `ask_input`, `ask_recovery`, `receiver_message`, `coordinator_message`, `audio_message`, or `recovered_upload`.
- `audioDirection` describes how the audio moved, such as `receiver_local_input`, `receiver_to_coordinator`, or `coordinator_to_receiver`.
- `captureContext` stores lightweight recording context, such as capture surface, role, browser platform, language, time zone, mime type, and duration. This helps future audio-profile work distinguish receiver appliance microphone input from coordinator/dashboard recordings without making audio owned by Connect.

The raw `source` value is still retained for audit/debugging, but Admin and future migration code should prefer `artifactKind` and `audioDirection` when grouping or routing audio.

Playback enhancement and hearing-feedback events should also store `artifactId`, `artifactKind`, and `audioDirection` when the preserved original can be resolved. Older URL-only events remain readable through URL matching, but new event processing should prefer the direct artifact link.

Browser playback enhancement reporting accepts explicit artifact metadata. When a player already knows `artifactId`, it should send that id with the enhancement event; the local server resolves it first and only falls back to `audioUrl` matching when no direct artifact link is available.

Receiver hearing feedback should follow the same rule: when the heard message has `audioArtifactId`, both the enhanced playback event and the yes/no hearing-feedback event should include that artifact id. This keeps user preference learning attached to the preserved original recording.

`GET /audio/review` also reports duplicate groups when multiple artifacts share the same SHA-256 hash, so recovered or re-indexed uploads can be reviewed without losing the original artifact trail.

For an Android device on the same Wi-Fi network, use your Mac's LAN IP:

```text
http://192.168.50.209:8790
```

On the Mac, the LAN IP is often available with:

```bash
ipconfig getifaddr en0
```

If that returns nothing, check `System Settings > Wi-Fi > Details > IP address`.

## Trigger a Call

```bash
curl -X POST http://localhost:8790/call \
  -H 'content-type: application/json' \
  -d '{"receiverId":"living-room-receiver","callerName":"Andrew","recipientName":"Mom"}'
```

## Reset Local Test State

Useful if the receiver appears to ignore calls after restarting the local server or after several manual tests:

```bash
curl -X POST http://localhost:8790/reset
```

## Receiver Poll

```bash
curl 'http://localhost:8790/receivers/living-room-receiver/events?since=0'
```

## Receiver Presence

Android Receiver registers itself with:

```bash
curl -X POST http://localhost:8790/receivers/register \
  -H 'content-type: application/json' \
  -d '{"receiverId":"living-room-receiver","displayName":"Kitchen Receiver","deviceType":"android","status":"available"}'
```

Caregiver UI lists receivers with:

```bash
curl http://localhost:8790/receivers
```

## Receiver Provisioning

Provisioning is device setup, not receiver-user login. The coordinator creates a single-use setup link/card, the web receiver exchanges it for a scoped receiver-device token, and future receiver requests use that token.

Current local endpoints:

- `GET /receiver-devices`
- `POST /receiver-setup-tokens`
- `POST /receiver-setup-tokens/:token/exchange`
- `POST /receiver-devices/:receiverDeviceId/revoke`
- `POST /receiver-devices/:receiverDeviceId/setup-token`

Example:

```bash
curl -X POST http://localhost:8790/receiver-setup-tokens \
  -H 'content-type: application/json' \
  -d '{"name":"Kitchen Receiver","locationLabel":"Kitchen"}'
```

The response includes a setup code, setup path, and receiver device metadata. Device tokens are returned only by the exchange endpoint and are never included in receiver-device list responses.

## Report State

```bash
curl -X POST http://localhost:8790/calls/<callId>/state \
  -H 'content-type: application/json' \
  -d '{"state":"answered"}'
```

Allowed states:

- `ringing`
- `answered`
- `connected`
- `declined`
- `receiver_unavailable`
- `hung_up`

## Milestone Test Flow

1. Start this server:

   ```bash
   npm start
   ```

2. Open the caregiver web app.
3. Install and open the Android Receiver app.
4. In the Android Receiver app, set:

   ```text
   Receiver ID: living-room-receiver
   Local server URL: http://<mac-lan-ip>:8790
   ```

5. Press `Save Local Server Settings`.
6. Press `Call Mom` in the caregiver web app.
7. The Android receiver should ring and show the incoming call screen.
8. Tap `Answer`, `Decline`, or `Hang Up` on Android.
9. The caregiver web app should update its call status from the local server.
