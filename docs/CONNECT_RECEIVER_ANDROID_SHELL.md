# Connect Receiver Android Shell

The standalone Connect Receiver APK should be a generic Android appliance shell around the hosted CarePland Receiver web UI, not a native rewrite of Connect.

## Stable Direction

- Keep the native shell under `android/connect-receiver`.
- Keep the product experience in the web app, currently `/connect/receiver`.
- Treat the APK as appliance plumbing: launch, provisioning, permissions, screen/wake behavior, reboot recovery, kiosk/device-owner support, and future hardware hooks.
- Treat the server/web layer as the owner of UI, fixed-resolution layouts, copy, workflows, remote config, and receiver-user changes.
- Use web-first provisioning links as short-lived claim tickets. Do not bake account identity or permanent credentials into the APK or URL.
- The preferred setup flow is an authenticated Supabase-backed web approval page first, followed by a native app claim link only after the server has verified the setup code and the approving user.

## Provisioning Contract

Preferred external setup link shape:

```text
https://carepland.com/connect/receiver/setup?code=SETUP_CODE
```

Human-typed short setup links should also be supported:

```text
https://carepland.com/r/kind-maple-chair
```

The visible setup code should favor short, typeable word phrases such as `kind-maple-chair`. Keep the underlying server token opaque and separate from the visible phrase.

The setup page should run in the regular browser/web app, not be intercepted by the APK. Its job is to validate the code, use the current Supabase-authenticated session for approval, and show the install/configuration choices that are safe for the current phase.

Native app claim links, used after web approval:

```text
carepland://receiver/provision?claim=APP_CLAIM_CODE&device=android_receiver
https://carepland.com/connect/provision?claim=APP_CLAIM_CODE&device=android_receiver
```

Hardware profile and UI layout are separate. `hardwareProfile` describes the installed device or test harness; `uiLayout` describes the hosted Receiver presentation. The legacy `device` parameter remains a compatibility shortcut for early testing.

Examples:

```text
hardwareProfile=grandstream_gxv3370
hardwareProfile=studio_gxv3370_1024x600
hardwareProfile=generic_android_phone
uiLayout=desk_phone_1024x600
uiLayout=default_receiver
```

Optional URL override for development:

```text
carepland://receiver/provision?receiver_url=https%3A%2F%2Fcarepland.example%2Fconnect%2Freceiver&claim=APP_CLAIM_CODE&hardwareProfile=studio_gxv3370_1024x600
```

Current shell behavior:

1. Refuse to start the Receiver web surface until a native app claim or bound receiver device exists. A plain installer/launcher open requests a short-lived pairing session, displays a grouped six-digit code such as `123 456`, and waits for caregiver pairing.
2. The pairing screen can open the best-known `/connect/receiver/setup` page; it does not auto-send the user out of the app.
3. The shell polls `/api/connect/receiver-shell/pairing-sessions` while the code is pending. When pairing succeeds, it stores the returned internal app claim and receiver-device id, then continues through the existing claim/redeem path.
4. After the app has a claim or bound receiver device, show the local Receiver Mode wizard when `provisioning_completed_at` is absent. The wizard is not the pairing/auth flow.
5. Store `receiver_mode` as `dedicated` or `personal`, `provisioning_completed_at`, and local capability statuses for full screen, microphone, kiosk, keep-awake, boot start, battery optimization, and update checks.
6. Store `receiver_url`, `claim`, `setupCode`/`code`, `device`, `hardwareProfile`, optional `receiverDeviceId`, and `uiLayout` from the native provisioning link.
7. Open the receiver URL after the local mode wizard completes.
8. Maintain a generated app-private `receiverInstallId` for the APK install.
9. Track a local `bindingStatus`: `unprovisioned`, `local_test`, `setup_pending`, `claim_pending`, or `bound`.
10. Append `setupCode`, `setupClaim`, `device`, `hardwareProfile`, `uiLayout`, `receiverInstallId`, `receiverDeviceId`, `receiverBindingStatus`, `receiverMode`, `provisioningCompletedAtMs`, and `nativeShell=android` query parameters when absent.
11. Expose the same non-secret setup values plus native device facts to the hosted Receiver through `window.CarePlandReceiver.getProvisioningJson()`. Device facts include manufacturer, model, SDK version, display width/height, density, kiosk state, APK version, install ID, optional receiver-device ID, binding status, Receiver mode, local capability statuses, and a best-effort detected hardware profile.
12. If the main Receiver page fails or returns an HTTP error, show a native appliance fallback instead of leaving a raw browser error on screen.
13. If the hosted Receiver reports a revoked, stale, or missing binding through `window.CarePlandReceiver.receiverSetupRequired`, clear the local claim/binding hints and return to the native pairing screen.

The initial scaffold stores only non-secret setup values and the pseudonymous receiver install ID in app-private preferences. Once the server returns a durable receiver credential, move that credential to Android Keystore-backed storage.

## Receiver Mode Wizard

The native Receiver Mode wizard is a device configuration/profile step, not a Supabase pairing/auth replacement. It should feel like activating a simple appliance.

First-pass flow:

1. Ask `How will this device be used?`
2. Offer `Dedicated CarePland Receiver` and `Personal Android Device`.
3. For dedicated mode, show status before configure:
   - Full screen
   - Keep screen awake
   - Microphone
   - Kiosk mode
   - Battery optimization
   - Auto-start
   - Update checks
4. Where Android permits it, provide a simple configure action, such as microphone permission or battery optimization settings.
   The kiosk setup action may open Android's Device Admin screen, but this is not the same as true device-owner kiosk provisioning.
5. End with `Your CarePland Receiver is ready.` and `Start Using CarePland`.

Persisted local fields:

```text
receiver_mode = dedicated | personal
provisioning_completed_at_ms = timestamp
capability_fullscreen = supported | enabled | unavailable | unknown
capability_microphone = supported | enabled | unavailable | unknown
capability_kiosk = supported | enabled | unavailable | unknown
capability_keep_awake = supported | enabled | unavailable | unknown
capability_boot_start = supported | enabled | unavailable | unknown
capability_battery_optimization = supported | enabled | unavailable | unknown
capability_update_checks = supported | enabled | unavailable | unknown
```

Language should stay honest. Use `Update checks`, `Managed updates when available`, `Best Receiver experience`, and `Minimizes interruptions`. Do not imply silent automatic APK updates always work; current remote update behavior is advisory and reports `canSelfUpdate: false`.

The hosted Receiver reports the native setup profile during its normal binding
check. Server-side binding verification mirrors Receiver mode, provisioning
completion time, capability statuses, native app version, Android model/API, and
kiosk/device-owner flags into `connect_receiver_devices` when
`supabase/sql/2026-06-28_connect_receiver_device_profiles.sql` has been applied.
If that migration is absent, binding verification still updates `last_seen_at`
and continues without failing the Receiver.

Target server behavior:

1. Admin/coordinator creates a short-lived setup code for a receiver device or household.
2. Setup URL opens the CarePland web app at `/connect/receiver/setup?code=...`.
3. Web app validates the setup code with Supabase-backed server routes.
4. Web app requires an authenticated approving user/session where appropriate.
5. Approver confirms the receiver, target person/household, and safe phase-one hardware profile.
6. Server creates a short-lived app claim code for this install.
7. Web page opens the native claim link, such as `carepland://receiver/provision?claim=...`.
8. Shell stores the claim and opens the hosted Receiver.
9. Receiver/web layer exchanges the claim for a revocable receiver-device credential.
10. Credential is stored locally by the shell or browser storage, then used for ongoing Receiver sessions.
11. Admin can revoke, rotate, or re-provision the receiver without shipping a new APK.

Current local implementation:

- `supabase/sql/2026-06-27_connect_receiver_provisioning.sql` defines `connect_receiver_devices` and `connect_receiver_claims`.
- `supabase/sql/2026-06-28_connect_receiver_device_profiles.sql` adds the first native device-profile mirror fields to `connect_receiver_devices`.
- `/api/connect/receiver-shell/pairing-sessions` is the near-term demo pairing path: an unpaired Receiver can request a short-lived six-digit code, display it to the caregiver, and poll the same route until pairing completes.
- `/api/connect/receiver-shell/pairing-sessions/pair` lets a signed-in caregiver/admin pair the visible code to the current Main Connect User context. User-facing setup should say Pair Receiver or Set Up Receiver; claim remains an internal implementation word.
- `/api/connect/provisioning/receiver-devices/:receiverDeviceId/setup-token` creates a signed-in, short-lived setup code for a selected Receiver device/person. Published setup should use this path rather than a shared default code.
- `/api/connect/receiver-shell/claims` remains the compatibility layer that exchanges an existing available setup/pairing code for a short-lived native app claim. It does not mint published claims from arbitrary typed codes. The prototype `12345` code is local/dev-only unless `CONNECT_RECEIVER_ALLOW_PROTOTYPE_SETUP_CODE=1` is explicitly set.
- `/api/connect/receiver-shell/claims/redeem` redeems the claim and returns the prototype `receiverDeviceId`.
- `/api/connect/receiver-shell/devices/binding` verifies a bound receiver by matching both `receiverDeviceId` and the APK/browser `receiverInstallId`; successful checks update `last_seen_at` and mirror native setup/device profile fields when available.
- `/connect/receiver/setup` is the first install-from-link page: its primary flow is now Install Receiver -> open Receiver and get code -> enter code to pair. Advanced setup keeps setup-page QR, dedicated-device QR, local/debug claim creation, and emulator tools available without making them the default demo path.
- `/r/<setup-code>` is the short typed setup shortcut. It redirects to `/connect/receiver/setup?code=<setup-code>` and exists to make setup-network installs easier to type on older hardware. Bare `/r` defaults to prototype `12345` only in local/dev or when `CONNECT_RECEIVER_ALLOW_PROTOTYPE_SETUP_CODE=1`; published deployments should create a real setup code from the authenticated dashboard flow.
- `/api/connect/receiver-shell/apk/debug` serves the local debug APK in development, or when `CONNECT_RECEIVER_DEBUG_APK_ENABLED=1`. Production installs should use `CONNECT_RECEIVER_APK_URL` instead.
- The setup page can also generate an Android dedicated-device provisioning QR payload for factory-reset hardware. It uses `CONNECT_RECEIVER_APK_URL` for production APK download, `CONNECT_RECEIVER_APK_SHA256_CHECKSUM` for the required APK checksum, and includes the current CarePland provisioning link as admin extras. In local development, the page can compute the checksum for the debug APK route when the APK exists, but real hardware still needs an APK URL reachable from that device.
- `scripts/restart-connect-local.sh` starts the local Receiver setup/APK routes on the main CarePland Next app and prints LAN setup/download URLs when it can detect a LAN IP address. Use `scripts/restart-connect-local.sh --setup-network` for temporary iPhone-hotspot, travel-router, or mini-router installs; it starts only the production Receiver setup/APK server on the LAN, disables the local HTTPS bridge/prototype API/static reference UI, enables the debug APK route for local install, and prints a short setup-network checklist. Override detection with `CONNECT_LAN_HOST=...` when needed. For a public tunnel, use `scripts/restart-connect-local.sh --ngrok-url=https://example.ngrok-free.app` so the setup page and APK button use the public URL instead of localhost or LAN.
- The app routes prefer Supabase service-role storage when the migration has been applied.
- A local file-backed development bridge under `tmp/connect-receiver-shell/` remains as a fallback when Supabase is not configured or the receiver provisioning tables are not present.
- The hosted Receiver redeems `claim`/`setupClaim` on first load, stores the resulting device binding locally, asks the native shell to persist the bound state when available, and checks the binding on later launches before proceeding.
- Bound Receiver pages send a lightweight binding heartbeat about once per minute while open. This keeps `last_seen_at`, native version, Receiver mode, capability statuses, kiosk flags, and last recovery reason fresh enough for Dashboard/Admin health checks without adding separate monitoring infrastructure.
- If the native shell falls back to the local retry screen because the Receiver page times out, fails network loading, returns an HTTP error, or fails SSL verification, it records a last recovery reason such as `receiver_load_timeout`, `receiver_network_error`, `receiver_http_error_*`, or `receiver_ssl_error`. Dashboard translates these into plain status labels.

The setup page also includes a local WiFi QR helper. It creates a standard Android-compatible WiFi QR code in the browser and does not store the network password. This is a convenience bridge for initial device setup, not managed WiFi provisioning.

## Setup Network Runbook

Some older Receiver hardware is easier to provision when CarePland controls the
temporary install network. Treat this as a setup bridge, not the long-term
production deployment model.

Current field setup:

1. Put the Mac and Android Receiver on the same private network, preferably an
   iPhone hotspot or dedicated travel router. Avoid hotel/public WiFi for local
   install work.
2. Run `scripts/restart-connect-local.sh --setup-network`.
3. Open the printed LAN short setup URL on the Android Receiver, such as
   `http://192.168.x.x:3000/r`.
4. Download/install the APK, complete the Receiver mode wizard, and claim the
   device.
5. Stop the local servers with `scripts/restart-connect-local.sh --stop` and
   turn off the temporary hotspot/router when setup is complete.

Public tunnel setup:

1. Start the public tunnel to the local Next app port, usually port `3000`.
2. Run `scripts/restart-connect-local.sh --ngrok-url=https://your-tunnel.ngrok-free.app`.
3. Open `https://your-tunnel.ngrok-free.app/r` on the Android Receiver.
4. Use the setup page to download/install the APK and provision the Receiver.
5. Stop the local servers and public tunnel after setup is complete.

If the Android device downloads a web page instead of an APK, the tunnel provider
is likely showing an interstitial/warning page. Use the printed public APK URL to
confirm the response is an APK, or switch to a direct public file host/release
APK URL for that install.

For the current real-device test install, do not build additional setup-network
automation. Install on the target phone or Receiver hardware through the
existing provisioning path, then focus on runtime stability: launch reliability,
recovery after app/background/server interruption, bound-device heartbeat,
Dashboard stale-device visibility, and web-side update behavior.

Future mini-router direction:

- A small travel router can broadcast a predictable `CarePland Setup` network.
- The setup network can host or point to the same Receiver setup page and APK
  download route currently used by the local development server.
- A future router image may provide a friendly local hostname such as
  `carepland.setup`, a captive-portal-style landing page, and optional bridging
  to the household WiFi.
- Do not store WiFi passwords in CarePland unless a future managed-provisioning
  design explicitly adds that responsibility.
- This should remain a future feature until the APK install, provisioning,
  kiosk/soft-appliance behavior, and remote web-update model are stable enough
  for a real caregiver handoff.

Security posture:

- Local setup servers are reachable by other devices on the same network.
- Use networks the installer controls.
- Keep setup codes and APK links short-lived when moving beyond local
  development.
- Stop the local setup server after install/provisioning.

## Phasing

Phase 1: approval and app claim

- Web setup URL validates the setup code.
- Authenticated user approves the receiver install.
- Server issues a short-lived native claim code.
- APK opens the hosted Receiver with the claim and hardware profile.
- No default-phone, kiosk, or hardware mutation is required.

Phase 2: receiver configuration

- Setup/approval flow can choose Receiver User, household, location label, hardware profile, and default UI layout.
- Admin can revoke or regenerate app claims.
- Server can return remote config for the Receiver layout and behavior.

Phase 3: hardware/device policy

- Add guided Android permission checks, audio route preferences, keep-awake behavior, orientation, and optional QR setup.
- Android Enterprise/device-owner support has a first scaffold: the APK declares a `DeviceAdminReceiver`, self-permits lock-task when it is device owner, disables keyguard/status bar where Android allows it, starts lock-task mode, and reports kiosk state through the native bridge. Real deployment still needs a managed-device provisioning path.
- Explore whether the app can request any relevant default-role behavior on target hardware. Treat default phone/receiver behavior as device- and Android-version-dependent until tested on real hardware.

## Local Build Harness

The canonical repo copy lives under `android/connect-receiver`.

The current Android Studio build harness lives at:

```text
/Users/agoodloe/Documents/Codex/CarePland/CarePland-AndroidStudio
```

Use the Android Studio copy for local APK builds and device testing while keeping this repo copy as the source/reference unless the source-of-truth decision changes. The Android Studio starter project was backed up before the first Receiver shell sync.

## Update Model

Most changes should be server-side:

- Receiver layout, including fixed-resolution appliance profiles.
- Button labels, copy, guidance, diagnostics, and feature flags.
- Receiver User / Main Connect User assignment.
- Call, message, appointment, and audio behavior implemented in the web app.

APK updates should be reserved for native behavior:

- Android permission flow changes.
- WebView/TWA settings.
- boot/recovery behavior.
- kiosk/device-owner behavior.
- speaker/audio route APIs.
- QR/NFC provisioning.
- supported domains/app links.

## Kiosk And Reboot Notes

The current scaffold supports best-effort relaunch after normal boot, app update, and power connection when the local Receiver mode is `dedicated`. Recovery launches take a short wake lock so the Receiver has time to reopen after a charger is connected or the device finishes booting. Personal Device mode remains a normal Android app and should not auto-launch.

The shell also supports owner-mode lock-task behavior after the device has been provisioned with the CarePland receiver admin component. True kiosk reliability should be handled through Android Enterprise dedicated-device setup, managed Play, or another device-owner/MDM path.

Sideloaded demo installs can still be useful, but they should be treated as soft appliance mode rather than guaranteed locked-down kiosk mode.

Native status distinctions:

- `deviceAdminActive`: the CarePland admin component has been enabled through Android settings. This can support some managed-device plumbing, but it does not by itself make the app a locked appliance.
- `deviceOwner`: the app is the Android device owner. This is the real dedicated-device control level needed for reliable lock-task/kiosk behavior.
- `lockTaskPermitted`: Android allows this package to enter lock-task mode.
- `lockTaskActive`: the app is currently running in lock-task mode.

For local hardware testing on a freshly reset device, the practical ADB owner-mode command is:

```bash
adb shell dpm set-device-owner com.carepland.connectreceiver/.ReceiverDeviceAdminReceiver
```

This must be done before normal consumer setup adds accounts or ownership state to the device. If the command fails, factory reset the test device and try before signing into other Android services. A production path should use Android Enterprise, managed Play, MDM, or a QR-based device-owner provisioning flow rather than relying on manual ADB.

The first QR-based owner-provisioning scaffold is intentionally conservative. The QR payload asks Android setup to download the CarePland APK, verify its checksum, install it as the device owner, and pass the app provisioning URL as admin extras. `ReceiverDeviceAdminReceiver` stores that provisioning URL when Android reports provisioning complete, then launches `MainActivity`. This should be tested on real factory-reset hardware before being considered a supported install path, because OEM setup flows vary.

The native shell reports APK `versionName`, `versionCode`, shell version, hardware profile, and a generated `updatePolicyUrl` to the hosted Receiver. The web app exposes `/api/connect/receiver-shell/update-policy` as the first conservative update-policy endpoint; it reports whether the installed shell is current, update-recommended, or below the minimum supported version. The route can be configured with `CONNECT_RECEIVER_LATEST_VERSION_CODE`, `CONNECT_RECEIVER_LATEST_VERSION_NAME`, `CONNECT_RECEIVER_MIN_SUPPORTED_VERSION_CODE`, `CONNECT_RECEIVER_APK_URL`, `CONNECT_RECEIVER_RELEASE_CHANNEL`, and `CONNECT_RECEIVER_RELEASE_NOTES_URL`.

Current policy responses always set `canSelfUpdate: false`. Silent unattended APK replacement should be treated as an Android Enterprise/managed Play or MDM concern, not as a normal web-app feature. For sideloaded development, the update policy can point a human/admin at a newer APK, but the shell should not install arbitrary APKs by itself.
