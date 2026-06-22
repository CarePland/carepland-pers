# Connect Prototype Reference

This folder is a reference copy of the current CarePland Connect prototype.

Source copied from:

`/Users/agoodloe/Documents/Codex/2026-06-13/files-mentioned-by-the-user-pasted/outputs/carepland-connect`

This code is not imported by the Next app. Use it to migrate Connect behavior
into product/module code under:

- `app/components/connect`
- `app/lib/connect`
- `app/api/connect` or equivalent Next API routes

Excluded on purpose:

- `node_modules`
- generated Android build output
- local uploads/audio artifacts
- runtime logs and pid files

Migration rule: copy behavior and contracts deliberately. Do not wire this
static DOM runtime directly into the Next app as permanent architecture.
