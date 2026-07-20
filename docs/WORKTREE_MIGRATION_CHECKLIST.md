# CarePland Worktree Migration Checklist

Use this when creating or switching to a new local CarePland worktree.

## Checklist

- [ ] Confirm the new worktree path.
  - Example: `/Users/agoodloe/Projects/CarePland/carepland-cowork`
- [ ] Point Claude/Codex at the new workspace path.
- [ ] Point any human terminals/editors at the same path.
  - Avoid running servers from one checkout while editing another.
- [ ] Copy local environment files.
  - Usually copy `.env.local` from the previous working checkout.
  - If present and intentionally local, also review `.env.development.local` or other local-only env files.
  - Do not commit `.env.local`.
- [ ] Verify `.env.local` is being read.
  - At minimum, confirm `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` are present for local app startup.
  - Confirm any local-only server keys needed for the workflow are present, such as Supabase service-role keys, OpenAI keys, Connect/Receiver settings, or audio/transcription settings.
- [ ] Install dependencies if needed.
  - Run `npm install` when `node_modules` is missing or incomplete.
  - Also run it when `next: command not found` appears or `node_modules/next` is missing.
- [ ] Verify package/runtime basics.
  - `node_modules/.bin/next` should exist after install.
  - `npx tsc --noEmit --pretty false --tsBuildInfoFile /tmp/carepland-worktree-check.tsbuildinfo` should not fail because of missing packages.
- [ ] Start or restart local servers from the new worktree.
  - Preferred: `/Users/agoodloe/Projects/CarePland/restart-carepland.sh`
  - Direct: `scripts/restart-connect-local.sh`
  - Stop old servers first when switching worktrees: `/Users/agoodloe/Projects/CarePland/restart-carepland.sh --stop`
- [ ] Confirm the dev server is serving from the new worktree.
  - The restart script should print `CarePland worktree: <path>`.
  - Check logs under `.logs/connect-local/`.
- [ ] Confirm expected local ports.
  - Next app: `http://localhost:3000`
  - HTTPS bridge: `https://localhost:3001`
  - Connect API/local trigger server: `http://localhost:8790`
  - Static reference UI: `http://localhost:4174`
- [ ] Confirm server settings needed for Receiver/setup flows.
  - `CONNECT_LAN_HOST` if the auto-detected LAN IP is wrong.
  - `CONNECT_RECEIVER_SETUP_BASE_URL` if setup links should use a specific host.
  - `CONNECT_RECEIVER_APK_URL` if APK downloads should use a specific host.
  - `CONNECT_RECEIVER_PUBLIC_INSTALL_URL` or `--ngrok-url=...` for public tunnel install testing.
  - `CONNECT_RECEIVER_DEBUG_APK_ENABLED=1` when serving the debug APK route locally.
- [ ] Confirm the server process actually stays alive.
  - The app can print `Ready` and still exit if the launch mode is wrong.
  - If `localhost:3000` is not reachable, keep `npm run dev -- --hostname 0.0.0.0 --port 3000` open in a real Terminal and retry.
- [ ] Open the app and confirm the homepage loads without the offline snapshot.
- [ ] If the browser shows the offline/frozen view, verify the app server first.
  - Then click `Try again now` or hard refresh.
  - If needed, clear the service worker/site data only after confirming the server is live.
- [ ] Confirm Supabase/auth works.
  - Sign in or open the auth gate enough to verify env-backed Supabase setup is not crashing.
- [ ] Confirm root-layout client runtimes do not crash before auth.
  - Watch for import-time errors from diagnostics, Something Went Wrong, Connect audio, or Supabase client creation.
- [ ] Run the test suite.
  - `npm test`
- [ ] Run focused lint/type checks for touched files.
  - Full lint may have unrelated existing issues; note those separately.
- [ ] Check Git status before starting new work.
  - Confirm expected local changes only.
- [ ] Update any pinned/active Codex task context.
  - Future chats should name the new worktree path explicitly.

## Common Failure Signs

- `supabaseUrl is required`
  - `.env.local` is missing or not being read.
  - Or a root-layout import is eagerly creating a Supabase client before env checks can show a friendly state.
- Browser shows `OFFLINE` / frozen view after restart
  - The browser is seeing the offline recovery snapshot because the app server is not reachable.
- `next: command not found`
  - Dependencies are missing or incomplete. Run `npm install` in the new worktree.
- Restart output says `Ready`, but `localhost:3000` is unreachable
  - The Next dev process likely exited after launch. Check `.logs/connect-local/next-app.log` and keep dev running in a real Terminal if needed.
- HTTPS bridge is up but the app is still offline
  - The bridge on `3001` points to the Next app on `3000`; both need to be running.
- Changes do not appear in the browser
  - The server may still be running from the old worktree. Confirm the printed `CarePland worktree` line and restart from the new checkout.
- Receiver setup links use the wrong IP/host
  - Set `CONNECT_LAN_HOST`, `CONNECT_RECEIVER_SETUP_BASE_URL`, or `CONNECT_RECEIVER_APK_URL` and restart.

## Notes

Environment files and other local secrets are intentionally not tracked by Git,
so they do not move automatically with a new worktree.

The safest migration posture is: copy env, install dependencies, restart from
the new worktree, verify the printed worktree path and local ports, then begin
product work.
