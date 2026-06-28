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

1. Store `receiver_url`, `claim`/`code`, `device`, and `hardwareProfile` from the native provisioning link.
2. Open the receiver URL.
3. Append `setupCode`, `device`, `hardwareProfile`, and `nativeShell=android` query parameters when absent.
4. Expose the same non-secret setup values plus native device facts to the hosted Receiver through `window.CarePlandReceiver.getProvisioningJson()`. Device facts include manufacturer, model, SDK version, display width/height, density, and a best-effort detected hardware profile.

The initial scaffold stores only non-secret setup values in app-private preferences. Once the server returns a durable receiver credential, move that credential to Android Keystore-backed storage.

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
- Add Android Enterprise/device-owner support for kiosk and managed updates.
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

The current scaffold supports best-effort relaunch after normal boot and app update. True kiosk reliability should be handled through Android Enterprise dedicated-device setup, managed Play, or another device-owner/MDM path.

Sideloaded demo installs can still be useful, but they should be treated as soft appliance mode rather than guaranteed locked-down kiosk mode.
