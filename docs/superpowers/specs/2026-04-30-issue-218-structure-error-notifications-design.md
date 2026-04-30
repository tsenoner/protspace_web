# Structure Error Notification De-duplication - Design Spec

**Issue:** [#218 - Remove notification banner for non-existing structure proteins](https://github.com/tsenoner/protspace_web/issues/218)  
**Date:** 2026-04-30

## Problem

When a selected protein has no available AlphaFold structure, the structure viewer already shows an inline message such as "No 3D structure was found for P12345." The `/explore` host also listens for the viewer's `structure-error` event and converts it into a Sonner notification banner. This duplicates the same user-facing information.

The existing messaging model says structure viewer empty, loading, and error states belong inline inside the structure viewer. Host notifications should be reserved for app-level issues such as dataset import failures, export failures, and selection mode changes.

## Goal

Stop `/explore` from showing a global notification banner for `structure-error` events while preserving the structure viewer's inline error UI and event contract.

## Non-Goals

- Do not change how the structure viewer detects missing structures.
- Do not change the text of the inline missing-structure message.
- Do not remove the `structure-error` event from `@protspace/core`.
- Do not alter notification behavior for dataset loading, selection mode, legend errors, or exports.

## Recommended Approach

Treat `structure-error` as component-owned UI in the `/explore` host.

The structure viewer should continue to dispatch `structure-error` for host integrations and diagnostics, but the demo application should not call the shared `notify.error(...)` path for that event. The host may still log the event for debugging.

This is intentionally simpler than filtering only known "missing structure" messages. The structure viewer already owns all of its visible error states, so the host does not need a second visible surface for any `structure-error` event in `/explore`.

## Component Changes

### `app/src/explore/interaction-controller.ts`

Update `handleStructureError` so it no longer calls `notify.error(getStructureErrorNotification(...))`.

Expected behavior:

- Console diagnostics can remain.
- No Sonner toast is created from `structure-error`.
- The viewer's inline error message remains visible because that is handled inside `packages/core/src/components/structure-viewer/structure-viewer.ts`.

### `app/src/explore/notifications.ts`

Remove `getStructureErrorNotification` if it has no remaining callers after the controller change.

This keeps the notification mapper aligned with the app's actual host-owned notification surfaces.

## Test Changes

### Unit Tests

Update `app/src/explore/notifications.test.ts` so it no longer expects structure errors to map to host notifications. Keep coverage for:

- data load failures
- legend errors
- selection disabled warnings
- export success and failure notifications

If the structure notification mapper is removed, remove the direct assertion for `getStructureErrorNotification`.

### E2E Tests

Add or adjust a `/explore` notification test that dispatches a synthetic `structure-error` event from `#myStructureViewer` and verifies:

- `Structure could not be loaded.` does not appear.
- the dispatched structure error message does not appear as a global toast.
- legacy notification helper artifacts remain absent.

This test should focus on the host notification layer. It does not need to trigger a real AlphaFold miss or assert Mol\* rendering behavior.

## Documentation Changes

Update developer-facing examples that currently show `structure-error` being converted into a toast. The examples should instead show either:

- logging the event for diagnostics, or
- ignoring the event when the inline viewer state is sufficient.

Keep the `structure-error` event documented in the API reference because integrators may still use it for telemetry, logging, or custom host behavior. The docs should continue to state that structure viewer empty/loading/error messaging stays inline by default.

## Data Flow

Before:

1. User selects a protein.
2. Structure viewer attempts to load the structure.
3. Load fails because no structure exists.
4. Structure viewer renders an inline error.
5. Structure viewer dispatches `structure-error`.
6. `/explore` converts the event into a Sonner error banner.

After:

1. User selects a protein.
2. Structure viewer attempts to load the structure.
3. Load fails because no structure exists.
4. Structure viewer renders an inline error.
5. Structure viewer dispatches `structure-error`.
6. `/explore` keeps the event non-visual, such as console diagnostics only.

## Error Handling

The inline structure viewer error remains the authoritative user-facing error for structure load failures. The host should not special-case expected versus unexpected structure failures because both are already represented in the component surface.

Unexpected structure failures may still be logged by the structure viewer itself and by the `/explore` host listener if the existing console warning is kept.

## Verification

Run focused checks after implementation:

- `pnpm --filter @protspace/app test:ci`
- the relevant Playwright notification spec, or the full app E2E suite if the focused spec is not easy to isolate
- `pnpm --filter @protspace/app type-check`

Success criteria:

- Dispatching `structure-error` from the structure viewer does not create a Sonner toast in `/explore`.
- Other notification tests continue to pass.
- The structure viewer still displays its inline missing-structure message.
