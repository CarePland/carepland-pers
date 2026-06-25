# Session Page View State

CarePland restores selected page context during the current browser login session
only after meaningful interaction. The goal is to feel like returning to an open
binder with a bookmark, not to preserve every incidental UI state.

Storage target:

- `sessionStorage`
- keys prefixed with `carepland-page-view-state:`
- helper: `app/lib/navigation/pageViewState.ts`

The helper exposes:

- `savePageViewState(pageKey, state)`
- `restorePageViewState(pageKey)`
- `clearPageViewState(pageKey)`
- `clearAllPageViewState()`

All page view state is cleared on CarePland sign-out paths that use the shared
Personal or Connect sign-out handlers.

## Appointments

Persisted after meaningful engagement:

- selected appointment view: `upcoming`, `logged`, or `archived`
- selected Care VIP / subject filter
- active add / quick-add panel
- expanded CarePrep sections
- expanded Visit Notes appointment
- scroll position

Intentionally not persisted as page view state:

- hover states
- appointment option menus
- transient confirmations
- unsaved appointment, note, CarePrep, or import drafts

Unsaved drafts continue to use the existing session draft mechanism.

## Connect

Persisted after meaningful engagement:

- current Connect page surface: Home, Receiver, or Settings
- Settings subsection
- scroll position

Intentionally not persisted:

- temporary Connect-local person selection while global focus is `Everyone`
- guide targets and temporary receiver highlights
- call/message/recording transient state
- testing or demo receiver selections

Durable Main Connect User remains owned by the existing Connect context setting,
not by session page view state.

## Family

Family active view is primarily route-based, so the browser URL remains the
source for the active Family section.

Persisted for Family Errands after meaningful engagement:

- selected/open errand
- scroll position

Intentionally not persisted:

- draft errand form text
- due-date helper panels
- SMS simulator selections and logs
- transient workflow/demo choices

## Meaningful Engagement Rule

Opening a page and immediately leaving should not create a restorable bookmark.

State is saved after actions such as:

- choosing a subview
- selecting a filter
- opening a record or section
- navigating to a deeper page surface
- scrolling after a page already has an engaged bookmark

Incidental visual states remain local React state only.
