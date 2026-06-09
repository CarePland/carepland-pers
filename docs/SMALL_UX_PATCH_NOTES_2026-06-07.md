# Small UX Patch Notes - 2026-06-07

Purpose: record small, non-Health-Focus concept fixes that can be reapplied to an earlier build if the larger Health Focus / Reports foundation needs to be reverted. Continue adding distinct, low-blast-radius UX/product patches here as they arise.

These fixes are intentionally separate from:

- `supabase/sql/2026-06-07_health_focus_reports_foundation.sql`
- `app/lib/healthTopics/`
- `app/lib/reports/`
- `app/api/health-topics/`
- `app/api/appointment-notes/`

## Patch 1: Care VIPs Includes People And Pets

User-facing reason:

Care VIPs should quietly signal that pets are valid care subjects without forcing users to classify a Care VIP as human or non-human.

File:

- `app/components/profile/ProfileAccountSummary.tsx`

Changes:

1. In the account summary grid wrapper, switch the three-column breakpoint from `xl` to `lg`.

   This keeps the Care VIPs block in the middle column at common desktop widths instead of dropping it into a full-width lower row.

   Replace:

   ```tsx
   sm:grid-cols-[minmax(0,1fr)_18rem] xl:min-h-[14rem] xl:grid-cols-[minmax(0,1.15fr)_minmax(0,1.15fr)_18rem]
   ```

   With:

   ```tsx
   sm:grid-cols-[minmax(0,1fr)_18rem] lg:min-h-[14rem] lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1.15fr)_18rem]
   ```

2. Change related `xl:` layout classes in the same account summary grid section to `lg:`.

   Important examples:

   ```tsx
   xl:after:hidden
   xl:before:absolute
   xl:order-2
   xl:col-span-1
   xl:mt-auto
   xl:order-3
   ```

   become:

   ```tsx
   lg:after:hidden
   lg:before:absolute
   lg:order-2
   lg:col-span-1
   lg:mt-auto
   lg:order-3
   ```

3. In the Care VIPs header, preserve the literal casing `CARE VIPs` and add `People and pets` as secondary text.

   Replace the old heading:

   ```tsx
   <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
     CARE VIPs
   </h3>
   ```

   With:

   ```tsx
   <h3 className="min-w-0 truncate text-xs font-semibold tracking-wide text-slate-500">
     CARE VIPs
     <span className="ml-2 font-medium normal-case tracking-normal text-slate-400">
       People and pets
     </span>
   </h3>
   ```

Notes:

- Do not use `uppercase` on this heading, because it turns `CARE VIPs` into `CARE VIPS`.
- Use `text-slate-400` for `People and pets`; `text-slate-300` read as disabled.
- Keep the count, such as `3/5`, on the far right.

## Patch 2: Quiet Automatic CarePrep Failures After Notes Save

User-facing reason:

Saving Visit Notes should be a low-friction success moment. Automatic CarePrep is a background convenience and should not show red errors when it cannot run. A user who saves notes should not be told to configure CarePrep instructions.

File:

- `app/page.tsx`

Function:

- `triggerAutoCarePrepAfterNotes`

Changes:

1. If no upcoming appointment is available, return quietly.

   Replace:

   ```tsx
   if (!nextAppointment) {
     setMessage("Notes saved. No upcoming appointment was available for automatic CarePrep.");
     return;
   }
   ```

   With:

   ```tsx
   if (!nextAppointment) {
     return;
   }
   ```

2. Remove the transient global message that says CarePrep is being prepared.

   Remove:

   ```tsx
   setMessage(
     `Notes saved. Preparing CarePrep for ${
       nextAppointment.title || "the next appointment"
     }...`
   );
   ```

3. In the catch block, log background failure only. Do not set global red message or show an error toast.

   Replace:

   ```tsx
   } catch (error) {
     const message = getErrorMessage(error);
     setMessage(`Auto-CarePrep did not run: ${message}`);
     showToast(message, { type: "error" });
   } finally {
   ```

   With:

   ```tsx
   } catch (error) {
     console.warn("Automatic CarePrep after notes did not run.", error);
   } finally {
   ```

Expected behavior:

- User saves notes.
- The user sees only the normal Notes success message, such as `Notes added.` or `Notes updated. Previous version archived.`
- If automatic CarePrep succeeds, the existing quiet auto-CarePrep success status can still appear.
- If automatic CarePrep fails because instructions, prompts, entitlements, environment, or target appointments are unavailable, there is no user-facing red error.

## Patch 3: Discarded Unsaved Work Actually Clears Drafts

User-facing reason:

When a user confirms that they want to leave a page or sign out despite unfinished work, CarePland should actually discard that work. The warning should not disappear while the underlying draft survives into the next page or the next login.

File:

- `app/page.tsx`

Changes:

1. Add a shared `discardUnsavedWorkState` helper that clears in-memory draft/editing state and removes `carepland-draft-state:v1` from `sessionStorage`.

   It resets:

   - profile draft back to the saved profile
   - unadded Care VIP name
   - new appointment draft
   - appointment detail drafts/editing flags
   - Visit Notes drafts/editing flags
   - CarePrep drafts/editing flags
   - Import/intake drafts and matches
   - bulk appointment drafts
   - Ask draft conversation state
   - pending discard/switch confirmations
   - place lookup state

2. In `confirmPendingMainTabChange`, call `discardUnsavedWorkState()` before applying the tab change.

3. In confirmed sign-out, call `discardUnsavedWorkState()` before `supabase.auth.signOut()`.

4. Update the leave-page warning copy from preserving unfinished work to discarding it, and rename the action from `Continue` to `Discard and continue`.

Expected behavior:

- Clicking `Discard and continue` clears the unsaved draft that triggered the warning.
- The same warning should not immediately reappear for the same discarded work.
- Confirmed sign-out clears draft state before leaving the session.
- Signing back in should not resurrect discarded draft work from the previous session.

## Verification

Run:

```bash
npm test
npm run lint
npm run build
```

Manual checks:

- Profile > Account summary shows `CARE VIPs  People and pets`.
- `CARE VIPs` keeps the lowercase `s`.
- At common desktop widths, the account summary reads as `Plan | Care VIPs | Account tools`.
- Saving Visit Notes shows only the Notes saved/updated success message.
- A missing CarePrep instruction set does not create a red user-facing error after Notes save.
- Unsaved work discarded through the page-leave warning does not survive the navigation.
- Unsaved work discarded through sign-out does not survive signing out and signing back in.
