# Receiver Setup Overlay Implementation

Initial implementation date: 2026-07-14

Receiver Setup is implemented as an installer-style overlay launched from Receiver Settings and used by the standalone `/connect/receiver/setup` page. The standalone setup route now opens the universal wizard directly so public setup links such as setup.carepland.com and `/r/<setup-code>` land in the same guided experience.

## Receiver-Specific Responsibilities

- Receiver User and Receiver Contact selection.
- Receiver self-contact warning behavior.
- Android APK metadata and install links.
- Web Receiver URL.
- Pairing-code check and pairing actions.
- Finish readiness summary.
- Advanced Android setup, including Wi-Fi QR and dedicated-device provisioning payloads.

## Potential Future Guided-Setup Extraction Candidates

These pieces are intentionally kept reasonably separable, but they should not be extracted until another setup flow proves the shape:

- Overlay shell with dialog behavior, Escape handling, focus restoration, and focus trap.
- Step progress display.
- Footer navigation with Back, Next, and Close.
- Status callout component.
- Lightweight session resume helpers.
- QR card with copyable text alternative.

Household onboarding, caregiver invite setup, and other future guided setup flows could reuse those concerns after the Receiver implementation settles. Receiver identity, pairing, installation, and Android provisioning should remain Receiver-owned.
