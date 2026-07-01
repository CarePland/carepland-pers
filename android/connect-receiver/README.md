# CarePland Connect Receiver Android Shell

This is the native Android appliance shell for CarePland Connect Receiver. It is intentionally small: the Receiver product experience remains in the hosted CarePland web app at `/connect/receiver`.

## Current Scope

- Full-screen Android WebView container.
- Receiver URL configuration through provisioning links.
- Microphone permission pass-through for WebRTC/audio features.
- Native JavaScript bridge exposed as `window.CarePlandReceiver`.
- Native device/profile facts appended to the Receiver URL for early layout selection and diagnostics.
- Screen-awake appliance mode.
- Managed-device lock-task support for future kiosk provisioning.
- Best-effort relaunch after normal device reboot or app update.
- Local fallback screen with Retry and device/config details when the hosted Receiver cannot load.

The configured minimum supported Android version is Android 7.0 / API 24.

## Provisioning Flow

Preferred setup starts in the regular CarePland web app:

```text
https://carepland.com/connect/receiver/setup?code=SETUP_CODE
```

Human-typed short setup links can use the same setup code:

```text
https://carepland.com/r/kind-maple-chair
```

That page should validate the setup code with the server, use the current authenticated Supabase session for approval, and then open the native shell with a short-lived app claim.

The shell accepts either Android app links or the custom CarePland scheme after web approval:

```text
https://carepland.com/connect/provision?claim=APP_CLAIM_CODE&device=android_receiver
carepland://receiver/provision?claim=APP_CLAIM_CODE&device=android_receiver
```

Optional development override for the native claim link:

```text
carepland://receiver/provision?receiver_url=https%3A%2F%2Fexample.test%2Fconnect%2Freceiver&claim=APP_CLAIM_CODE&device=gxv3370&hardwareProfile=grandstream_gxv3370&uiLayout=desk_phone_1024x600
```

The app stores the claim/setup code, device profile, hardware profile, UI layout, optional receiver-device ID, and a generated local receiver install ID. It then opens the configured Receiver URL with `setupCode`, `device`, `hardwareProfile`, `uiLayout`, `receiverInstallId`, and `receiverDeviceId` query parameters when they are not already present.

The shell also appends non-secret native facts to the Receiver URL when they are not already present:

```text
nativeShell=android
shellVersion=0.1.0
nativeVersionName=...
nativeVersionCode=...
receiverInstallId=...
detectedHardwareProfile=...
nativeManufacturer=...
nativeModel=...
nativeSdk=...
displayWidthPx=...
displayHeightPx=...
displayDensityDpi=...
nativeOrientation=...
```

These values are layout and diagnostics hints only; they are not authentication credentials.

When the APK is provisioned as Android device owner, it also reports kiosk state through the native bridge:

```json
{
  "deviceOwner": true,
  "lockTaskPermitted": true,
  "lockTaskActive": true
}
```

The long-term server flow should exchange the one-time app claim for a revocable receiver-device credential. Do not put permanent account credentials in provisioning URLs.

The current scaffold uses plain app-private preferences for non-secret setup values. Once a durable receiver credential exists, store that credential through Android Keystore-backed storage.

The hosted Receiver can read native shell state with:

```js
const nativeConfig = window.CarePlandReceiver?.getProvisioningJson?.();
```

That JSON includes the same non-secret provisioning values, version fields, display facts, kiosk flags, `receiverInstallId`, optional `receiverDeviceId`, and `provisionedAtMs`.

## Build

Open `android/connect-receiver` in Android Studio, let Gradle sync, then build or run the `app` target.

For the current local workflow, the buildable Android Studio copy lives at:

```text
/Users/agoodloe/Documents/Codex/CarePland/CarePland-AndroidStudio
```

The repo copy remains the source/reference copy. The Android Studio copy is a build harness mirror that can be refreshed from this directory when needed. The first sync backed up the starter Android Studio project under `.carepland-backups/`.

The shell includes a Gradle wrapper copied from the local Android Studio seed project. Command-line builds require a visible Java runtime:

```text
cd android/connect-receiver
./gradlew assembleDebug
```

If `./gradlew` reports that it cannot locate Java, build from Android Studio or install/configure a JDK/JBR and set `JAVA_HOME`.

The local Android Studio copy can be built from the command line with Android Studio's bundled JBR:

```text
cd /Users/agoodloe/Documents/Codex/CarePland/CarePland-AndroidStudio
JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home" ./gradlew assembleDebug
```

## Native Responsibilities

- Launch the Receiver.
- Persist provisioning config.
- Recover after reboot/update where Android policy allows it.
- Request Android permissions.
- Keep the screen awake.
- Provide the future home for kiosk/device-owner and hardware-specific behavior.

## Server/Web Responsibilities

- Receiver UI and layouts.
- Device profiles and fixed-resolution appliance variants.
- Connect calls, messages, appointments, diagnostics, and copy.
- Setup-code validation and device binding.
- Device revocation and receiver-user changes.
- Remote config and feature flags.

## Notes

True kiosk behavior and reliable unattended app launch are Android Enterprise / device-owner concerns. Sideloaded demo installs should be treated as soft appliance mode.

Dedicated Receiver mode enables the native shell's soft appliance recovery: boot/package-replaced launch is allowed only after the local wizard records Dedicated mode, and the app attempts to reopen itself shortly after being pushed into the background. Personal Device mode stays a normal Android app and does not auto-launch or force itself back to the foreground.

The current shell includes a `DeviceAdminReceiver` so a test device can be provisioned as owner. In owner mode, the app permits itself for lock task, disables keyguard/status bar where Android allows it, and starts lock-task mode. It does not force screen pinning on ordinary sideloaded installs.

For emulator or wiped-device testing, install the debug APK before accounts are added, then run:

```text
adb shell dpm set-device-owner com.carepland.connectreceiver/.ReceiverDeviceAdminReceiver
```

Removing owner/admin state for testing usually requires a factory reset. Some emulator images allow:

```text
adb shell dpm remove-active-admin com.carepland.connectreceiver/.ReceiverDeviceAdminReceiver
```

## Update Direction

The shell reports `versionName`, `versionCode`, and `shellVersion` to the hosted Receiver and appends non-secret version hints to the Receiver URL. The hosted app can use `/api/connect/receiver-shell/update-policy` for remote update prompts, compatibility warnings, or managed-device policy later.

The APK does not silently install arbitrary remote APK files. Reliable unattended APK updates should go through managed Play, Android Enterprise/MDM, or an explicitly approved sideload/update flow for test devices.
