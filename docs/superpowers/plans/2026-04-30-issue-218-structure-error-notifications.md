# Structure Error Notification De-duplication Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stop `/explore` from showing a global Sonner notification for structure viewer errors while preserving the structure viewer inline error UI and `structure-error` event.

**Architecture:** Keep `structure-error` as a semantic component event from `@protspace/core`, but make the `/explore` host treat it as non-visual diagnostics. Remove the app notification mapper for structure errors, update tests to lock the no-toast behavior, and align docs examples with the inline ownership model.

**Tech Stack:** TypeScript, React/Vite app host, Lit web components from `@protspace/core`, Vitest, Playwright, VitePress docs.

---

## File Structure

- `app/src/explore/interaction-controller.ts`: owns `/explore` event handlers. Change `handleStructureError` so it logs only and does not call `notify.error(...)`.
- `app/src/explore/notifications.ts`: owns host notification mapping. Remove `getStructureErrorNotification` after the controller no longer uses it.
- `app/src/explore/notifications.test.ts`: unit coverage for notification mapper exports and remaining host-owned notifications.
- `app/tests/dataset-reload.spec.ts`: existing E2E notification coverage. Add the synthetic `structure-error` no-toast regression test here because it already initializes `/explore` and has `dispatchCustomEvent`.
- `docs/developers/embedding.md`: update host messaging examples so structure errors are not presented as toast notifications.
- `docs/developers/messaging.md`: leave the ownership guidance intact unless implementation reveals wording that needs tightening.
- `docs/superpowers/specs/2026-04-30-issue-218-structure-error-notifications-design.md`: source design spec, no implementation edits required.

## Task 1: Lock Notification Mapper Contract

**Files:**

- Modify: `app/src/explore/notifications.test.ts`
- Modify: `app/src/explore/notifications.ts`

- [ ] **Step 1: Write the failing unit test**

Update `app/src/explore/notifications.test.ts` imports so the file imports the namespace and stops importing the structure error type and mapper:

```ts
import { describe, expect, it } from 'vitest';
import type {
  DataErrorEventDetail,
  LegendErrorEventDetail,
  SelectionDisabledNotificationDetail,
} from '@protspace/core';
import * as notificationMappers from './notifications';
import {
  getCorruptedPersistedDatasetNotification,
  getDataLoadFailureNotification,
  getDatasetPersistenceFailureNotification,
  getExportFailureNotification,
  getExportSuccessNotification,
  getLegendErrorNotification,
  getSelectionDisabledNotification,
} from './notifications';
```

Replace the existing test named `maps legend and structure errors to host notifications` with this test:

```ts
it('maps legend errors to host notifications without exposing a structure toast mapper', () => {
  const legendDetail: LegendErrorEventDetail = {
    message: 'Failed to process legend data',
    severity: 'error',
    source: 'data-processing',
    context: {
      annotation: 'phylum',
    },
  };

  expect(getLegendErrorNotification(legendDetail).title).toBe('Legend update failed.');
  expect('getStructureErrorNotification' in notificationMappers).toBe(false);
});
```

- [ ] **Step 2: Run the focused unit test and verify it fails**

Run:

```bash
pnpm --filter @protspace/app test:ci -- src/explore/notifications.test.ts
```

Expected: FAIL because `getStructureErrorNotification` is still exported from `app/src/explore/notifications.ts`.

- [ ] **Step 3: Remove the unused structure notification mapper**

In `app/src/explore/notifications.ts`, remove `StructureErrorEventDetail` from the type import:

```ts
import type {
  DataErrorEventDetail,
  LegendErrorEventDetail,
  SelectionDisabledNotificationDetail,
} from '@protspace/core';
```

Delete the exported mapper at the bottom of the file:

```ts
export function getStructureErrorNotification(detail: StructureErrorEventDetail): NotifyOptions {
  return {
    title: 'Structure could not be loaded.',
    description: detail.message,
    durationMs: 8_000,
    dedupeKey: `structure-error:${detail.context?.proteinId ?? 'unknown'}:${detail.message}`,
  };
}
```

- [ ] **Step 4: Run the focused unit test and verify it passes**

Run:

```bash
pnpm --filter @protspace/app test:ci -- src/explore/notifications.test.ts
```

Expected: PASS with `src/explore/notifications.test.ts` passing.

- [ ] **Step 5: Commit the mapper cleanup**

Run:

```bash
git add app/src/explore/notifications.ts app/src/explore/notifications.test.ts
git commit -m "fix(explore): remove structure error notification mapper"
```

## Task 2: Stop `/explore` Structure Error Toasts

**Files:**

- Modify: `app/tests/dataset-reload.spec.ts`
- Modify: `app/src/explore/interaction-controller.ts`

- [ ] **Step 1: Write the failing E2E regression test**

In `app/tests/dataset-reload.spec.ts`, add this test inside `test.describe('Unified app notifications', () => { ... })`, after the existing `selection-disabled-notification uses the unified warning toast path` test:

```ts
test('structure-error events stay inline and do not create global toasts', async ({ page }) => {
  await dispatchCustomEvent(page, '#myStructureViewer', 'structure-error', {
    message: 'No 3D structure was found for P12345.',
    severity: 'error',
    source: 'structure-viewer',
    context: {
      proteinId: 'P12345',
    },
  });

  await page.waitForTimeout(500);

  await expect(page.getByText('Structure could not be loaded.')).toHaveCount(0);
  await expect(page.getByText('No 3D structure was found for P12345.')).toHaveCount(0);
  expect(await hasLegacyNotificationHelperArtifacts(page)).toBe(false);
});
```

- [ ] **Step 2: Run the focused E2E test and verify it fails**

Run:

```bash
pnpm test:e2e -- app/tests/dataset-reload.spec.ts -g "structure-error events stay inline"
```

Expected: FAIL because the current `handleStructureError` calls `notify.error(...)`, creating a Sonner toast with title `Structure could not be loaded.` and the dispatched message.

- [ ] **Step 3: Remove the toast call from the structure error handler**

In `app/src/explore/interaction-controller.ts`, change the import from:

```ts
import { getLegendErrorNotification, getStructureErrorNotification } from './notifications';
```

to:

```ts
import { getLegendErrorNotification } from './notifications';
```

Change `handleStructureError` from:

```ts
handleStructureError(event) {
  const customEvent = event as CustomEvent<StructureErrorEventDetail>;
  console.warn('Structure viewer error:', customEvent.detail);
  notify.error(getStructureErrorNotification(customEvent.detail));
},
```

to:

```ts
handleStructureError(event) {
  const customEvent = event as CustomEvent<StructureErrorEventDetail>;
  console.warn('Structure viewer error:', customEvent.detail);
},
```

- [ ] **Step 4: Run the focused E2E test and verify it passes**

Run:

```bash
pnpm test:e2e -- app/tests/dataset-reload.spec.ts -g "structure-error events stay inline"
```

Expected: PASS. The test should not find either `Structure could not be loaded.` or `No 3D structure was found for P12345.` as a global toast after dispatching the synthetic event.

- [ ] **Step 5: Run the app type-check**

Run:

```bash
pnpm --filter @protspace/app type-check
```

Expected: PASS. This confirms the removed notification mapper import is gone and the controller still compiles.

- [ ] **Step 6: Commit the host behavior change**

Run:

```bash
git add app/src/explore/interaction-controller.ts app/tests/dataset-reload.spec.ts
git commit -m "fix(explore): keep structure errors inline"
```

## Task 3: Align Developer Docs

**Files:**

- Modify: `docs/developers/embedding.md`

- [ ] **Step 1: Update the host messaging example**

In `docs/developers/embedding.md`, in the `Host Messaging Pattern` section, replace this block:

```js
viewer.addEventListener('structure-error', (event) => {
  notify({
    level: 'error',
    title: 'Structure could not be loaded.',
    description: event.detail.message,
  });
});
```

with:

```js
viewer.addEventListener('structure-error', (event) => {
  console.error('Structure viewer error:', event.detail.message);
});
```

Keep the sentence immediately after the example:

```md
Keep structure viewer empty/loading/error messaging inline in the component itself instead of duplicating it with a global toast.
```

- [ ] **Step 2: Check the second event example**

In the later `Events` example in `docs/developers/embedding.md`, keep the existing diagnostic-only structure error listener:

```js
viewer.addEventListener('structure-error', (e) => {
  console.error('Structure could not be loaded:', e.detail.message);
});
```

No code change is needed in that later block because it already logs instead of notifying.

- [ ] **Step 3: Search for stale toast copy**

Run:

```bash
rg -n "getStructureErrorNotification|title: ['\"]Structure could not be loaded\\." app/src docs/developers
```

Expected: no app source or docs examples remain that define a host notification title for `structure-error`. The API reference may still list `structure-error` as an event, and diagnostic `console.error(...)` examples may remain.

- [ ] **Step 4: Build docs**

Run:

```bash
pnpm docs:build
```

Expected: PASS with VitePress build complete.

- [ ] **Step 5: Commit docs alignment**

Run:

```bash
git add docs/developers/embedding.md
git commit -m "docs(embedding): show structure errors as inline-owned"
```

## Task 4: Final Verification

**Files:**

- Verify: full changed surface

- [ ] **Step 1: Run focused app tests**

Run:

```bash
pnpm --filter @protspace/app test:ci
```

Expected: PASS with all app Vitest files passing.

- [ ] **Step 2: Run focused E2E notification coverage**

Run:

```bash
pnpm test:e2e -- app/tests/dataset-reload.spec.ts -g "Unified app notifications"
```

Expected: PASS. This includes the new structure-error no-toast regression and existing notification flows.

- [ ] **Step 3: Run app type-check**

Run:

```bash
pnpm --filter @protspace/app type-check
```

Expected: PASS.

- [ ] **Step 4: Run docs build**

Run:

```bash
pnpm docs:build
```

Expected: PASS.

- [ ] **Step 5: Inspect final diff**

Run:

```bash
git status --short
git log --oneline -4
git diff --stat main...HEAD
```

Expected:

- Working tree is clean.
- Recent commits include the design spec commit and three implementation commits from this plan.
- Diff touches only the planned app test/source files and docs.

## Self-Review Notes

- Spec coverage: Task 1 removes the unused mapper, Task 2 stops the host toast and adds regression coverage, Task 3 updates docs examples, Task 4 verifies the changed surfaces.
- Scope: no changes to structure loading, inline viewer copy, or the `structure-error` event contract.
- Type consistency: the plan keeps `StructureErrorEventDetail` in `interaction-controller.ts` because the host still types and logs the event, but removes it from `notifications.ts` and `notifications.test.ts`.
