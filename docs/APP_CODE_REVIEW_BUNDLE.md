# App Code Review Bundle

Last updated: 2026-07-16

Use this when preparing or refreshing a separate directory for independent app code review. The bundle is a copied snapshot only; never move files out of the main project.

## Current Review Directory

- Source project: `/Users/agoodloe/Documents/Codex/CarePland/APP_CODE/carepland-all`
- Review copy: `/Users/agoodloe/Documents/Codex/CarePland/APP_CODE/carepland-code-review-2026-07-16`

## Refresh Policy

- Refresh the review copy from the live working tree so uncommitted app changes are included.
- Keep the operation copy-only for the source project. The source project must not be moved, cleaned, reset, or deleted as part of this workflow.
- It is OK for the refresh command to delete files inside the review copy that no longer exist in the source, because the review copy is disposable.
- Exclude generated, dependency, cache, private, and local runtime artifacts.
- Incremental refresh cost should be small: after the first copy, `rsync` transfers changed files and updates removals in the review copy.

## Refresh Command

Run from the source project directory:

```bash
rsync -a --delete \
  --exclude='.git/' \
  --exclude='node_modules/' \
  --exclude='.next/' \
  --exclude='tmp/' \
  --exclude='.logs/' \
  --exclude='.rollback/' \
  --exclude='.tmp-tests/' \
  --exclude='coverage/' \
  --exclude='out/' \
  --exclude='build/' \
  --exclude='.vercel/' \
  --exclude='.DS_Store' \
  --exclude='.env*' \
  --exclude='*.pem' \
  --exclude='*.tsbuildinfo' \
  --exclude='next-env.d.ts' \
  --exclude='certificates/' \
  --exclude='android/**/.gradle/' \
  --exclude='android/**/build/' \
  --exclude='android/**/local.properties' \
  --exclude='docs/reference/connect-prototype/local-trigger-server/data/' \
  --exclude='docs/reference/connect-prototype/local-trigger-server/uploads/' \
  ./ ../carepland-code-review-2026-07-16/
```

## Post-Refresh Checks

```bash
du -sh ../carepland-code-review-2026-07-16
find ../carepland-code-review-2026-07-16 -maxdepth 2 -type d \
  -name node_modules -o -name .next -o -name .git -o -name tmp \
  -o -name .logs -o -name .rollback -o -name certificates
find ../carepland-code-review-2026-07-16 -maxdepth 1 -type f \
  -name '.env*' -o -name '*.tsbuildinfo' -o -name 'next-env.d.ts' -o -name '.DS_Store'
```

The two `find` checks should print nothing.

## Current Result

The first prepared bundle on 2026-07-16 was about 36 MB after excluding the large generated/private folders from the roughly 2.6 GB source directory.
