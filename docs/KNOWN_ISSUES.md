# Known Issues

Lightweight tracker for minor, deliberately-deferred issues. Not a replacement
for `docs/CAREPLAND_APP_AUDIT_2026-06-20.md` or other dated audits — this is
for small items found and consciously postponed during unrelated work.

---

## Avatar photo upload for the account owner ("yourself") is unreachable

Severity: Minor

Area: Personal / Profile / Contact Details

Date noted: 2026-07-19

Current behavior: `profileContactPeople` (built in `app/CarePlandPers.tsx`,
passed into `ProfileContactDetailsForm`) used to include the account owner's
own `is_default` care_subject as a second, separate row alongside the "You"
row. That second row was confusing (it displayed as a bare email address
with no explanation of how it related to "You") and was removed so the
account owner only appears once.

That second row was also the only reachable path to `onUploadAvatar` /
`onRemoveAvatar` for the account owner's own care_subject record, because
`selectedAvatarPersonId` in `ProfileContactDetailsForm.tsx` only resolves to
a non-null id for entries that carry an explicit `avatarPersonId` — which
the merged "You" row does not. Net effect: there is currently no UI path to
set your own avatar/photo (the one shown in the nav person-switcher, "next
appointment" chip, etc. when you are the selected subject).

Expected behavior: TBD — needs a product decision, not just a code fix.
Options include: (a) surface avatar upload directly on the "You" row without
also exposing free-text rename (to avoid a second, competing source of
truth for the account owner's name alongside First/Last/Preferred Name), or
(b) a dedicated "change photo" control elsewhere (e.g. next to the name
fields on the account form).

Likely files:

- `app/CarePlandPers.tsx` (`profileContactPeople` construction,
  `handleUploadProfileAvatar`, `handleRemoveProfileAvatar`,
  `handleRenameProfilePerson`)
- `app/components/personal/profile/ProfileContactDetailsForm.tsx`
  (`selectedAvatarPersonId`, `avatarControls`, `SelectedPersonAvatarControls`)

Deferred by: Andrew, 2026-07-19 — minor, moving on.
