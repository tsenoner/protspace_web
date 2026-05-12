# Remove "Include shapes" Toggle — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the global "Include shapes" toggle from the legend. Every category defaults to a circle. Users assign shapes per-category via the existing swatch popover.

**Architecture:** Clean removal across UI, persistence, exports, and the scatterplot. `LegendPersistedSettings.includeShapes` becomes optional and is ignored on read, never emitted on write — old `.parquetbundle` files still parse. The per-item shape picker UI is unchanged.

**Tech Stack:** TypeScript, Lit 3.3 (web components), Vitest (unit + jsdom), Playwright (E2E).

**Spec:** `docs/superpowers/specs/2026-05-12-remove-include-shapes-toggle-design.md`

**Branch:** `refactor/issue-252-remove-include-shapes` (already created off `main`, contains the spec commit `1b0b11b`).

**Issue:** [#252](https://github.com/tsenoner/protspace_web/issues/252)

**Commit style:** Angular (`feat`, `fix`, `refactor`, `docs`, `test`, `chore`) per `.claude/CLAUDE.md`. Subject ≤ 72 chars. Always run `pnpm precommit` before committing.

---

## File Structure

| File                                                                                  | Status | Responsibility                                                                                              |
| ------------------------------------------------------------------------------------- | ------ | ----------------------------------------------------------------------------------------------------------- |
| `packages/utils/src/types.ts`                                                         | Modify | Make `LegendPersistedSettings.includeShapes` optional + `@deprecated`.                                      |
| `packages/utils/src/parquet/settings-validation.ts`                                   | Modify | `isValidLegendSettings` accepts missing; `sanitizeLegendSettingsEntry` never emits.                         |
| `packages/utils/src/parquet/settings-validation.test.ts`                              | Modify | Add legacy-bundle compat tests.                                                                             |
| `packages/core/src/components/legend/visual-encoding.ts`                              | Modify | Drop `shapesEnabled` param and the `SHAPES` const.                                                          |
| `packages/core/src/components/legend/visual-encoding.test.ts`                         | Modify | Update tests to new signature.                                                                              |
| `packages/core/src/components/legend/legend-data-processor.ts`                        | Modify | Drop `shapesEnabled` parameter from `createLegendItems` and `processLegendItems`.                           |
| `packages/core/src/components/legend/legend-data-processor.test.ts`                   | Modify | Drop param from test calls.                                                                                 |
| `packages/core/src/components/scatter-plot/style-getters.ts`                          | Modify | Drop `useShapes` from `StyleConfig` + raw-shapes fallback branch.                                           |
| `packages/core/src/components/scatter-plot/style-getters.test.ts`                     | Modify | Drop `useShapes` from fixtures.                                                                             |
| `packages/core/src/components/scatter-plot/scatter-plot.ts`                           | Modify | Drop `@property useShapes`, cache key, and style-config propagation.                                        |
| `packages/core/src/components/legend/scatterplot-interface.ts`                        | Modify | Drop `useShapes` from `IScatterplotElement` and remove `supportsShapes`.                                    |
| `packages/core/src/components/legend/scatterplot-interface.test.ts`                   | Modify | Delete `supportsShapes` test suite; drop `useShapes` from mock factory.                                     |
| `packages/core/src/components/legend/controllers/scatterplot-sync-controller.ts`      | Modify | Delete `syncShapes()` and `getEffectiveIncludeShapes` callback.                                             |
| `packages/core/src/components/legend/controllers/scatterplot-sync-controller.test.ts` | Modify | Drop `syncShapes` test suite.                                                                               |
| `packages/core/src/components/legend/controllers/persistence-controller.ts`           | Modify | Drop `includeShapes` from `PersistenceCallbacks.getCurrentSettings` and from save/strip/export.             |
| `packages/core/src/components/legend/controllers/persistence-controller.test.ts`      | Modify | Drop `includeShapes` from fixtures.                                                                         |
| `packages/core/src/components/legend/legend-settings-dialog.ts`                       | Modify | Remove checkbox UI + `includeShapes`/`onIncludeShapesChange`.                                               |
| `packages/core/src/components/legend/legend-settings-dialog.test.ts`                  | Modify | Delete toggle tests.                                                                                        |
| `packages/core/src/components/legend/legend.ts`                                       | Modify | Remove property, getter, dialog wiring, save/reset/applyPersisted/export-data handling, `syncShapes` calls. |
| `packages/core/src/components/legend/legend-extract.test.ts`                          | Modify | Drop `includeShapes` from fixtures.                                                                         |
| `packages/core/src/components/legend/legend-helpers.ts`                               | Modify | Drop `includeShapes` from `createDefaultSettings`.                                                          |
| `packages/core/src/components/legend/config.ts`                                       | Modify | Drop `includeShapes: false` from `LEGEND_DEFAULTS`.                                                         |
| `packages/utils/src/visualization/export-utils.ts`                                    | Modify | Drop `includeShapes` from types/options, remove `readUseShapesFromScatterplot`, simplify legend draw.       |
| `packages/utils/src/visualization/export-utils.test.ts`                               | Modify | Drop `includeShapes` from fixtures + assert legend always renders stored shape.                             |
| `packages/core/src/components/publish/publish-modal.ts`                               | Modify | Drop `includeShapes` from local `LegendExportState`.                                                        |
| `packages/core/src/components/publish/publish-modal.test.ts`                          | Modify | Drop `includeShapes` from fixtures if any.                                                                  |
| `packages/core/src/components/data-loader/utils/bundle.test.ts`                       | Modify | Drop `includeShapes` from settings fixtures (keep one legacy `includeShapes: true` fixture).                |
| `packages/core/src/components/data-loader/utils/bundle-roundtrip.test.ts`             | Modify | Drop from inline settings.                                                                                  |
| `packages/utils/src/parquet/bundle-writer.test.ts`                                    | Modify | Drop from fixtures.                                                                                         |
| `app/tests/numeric-binning.spec.ts`                                                   | Modify | Replace "toggle disabled" assertion with "toggle absent".                                                   |
| `docs/explore/legend.md`                                                              | Modify | Remove "Include shapes" row + rewrite "Shapes" section.                                                     |
| `docs/developers/api/index.md`                                                        | Modify | Remove `include-shapes` attribute row.                                                                      |

---

## Task 1: Make `includeShapes` optional and legacy-tolerate in validators

**Files:**

- Modify: `packages/utils/src/types.ts`
- Modify: `packages/utils/src/parquet/settings-validation.ts`
- Test: `packages/utils/src/parquet/settings-validation.test.ts`

- [ ] **Step 1: Add failing tests for legacy bundle compat**

Open `packages/utils/src/parquet/settings-validation.test.ts` and add this `describe` block at the end of the file, before the closing of the top-level describe (or as a new top-level describe — match the file's style):

```ts
describe('LegendPersistedSettings — includeShapes backward compat', () => {
  it('isValidLegendSettings accepts a settings object missing includeShapes', () => {
    const legacyMinusFlag = {
      maxVisibleValues: 10,
      shapeSize: 5,
      sortMode: 'size-desc',
      hiddenValues: [],
      categories: {},
      enableDuplicateStackUI: false,
      selectedPaletteId: 'kellys',
    };
    expect(isValidLegendSettings(legacyMinusFlag)).toBe(true);
  });

  it('isValidLegendSettings accepts a settings object with includeShapes: true', () => {
    const legacyWithFlag = {
      maxVisibleValues: 10,
      includeShapes: true,
      shapeSize: 5,
      sortMode: 'size-desc',
      hiddenValues: [],
      categories: {},
      enableDuplicateStackUI: false,
      selectedPaletteId: 'kellys',
    };
    expect(isValidLegendSettings(legacyWithFlag)).toBe(true);
  });

  it('sanitizeLegendSettingsMap drops includeShapes from the sanitised output', () => {
    const input = {
      annotation: {
        maxVisibleValues: 10,
        includeShapes: true,
        shapeSize: 5,
        sortMode: 'size-desc',
        hiddenValues: [],
        categories: {},
        enableDuplicateStackUI: false,
        selectedPaletteId: 'kellys',
      },
    };
    const sanitised = sanitizeLegendSettingsMap(input);
    expect(sanitised).not.toBeNull();
    expect(sanitised!.annotation).not.toHaveProperty('includeShapes');
  });
});
```

If `sanitizeLegendSettingsMap` is not already imported at the top of the file, add it to the import list.

- [ ] **Step 2: Run tests to confirm they fail (or pass — depends on starting state)**

Run: `pnpm --filter @protspace/utils test -- settings-validation`

Expected: The first two pass already (the validator accepts extra fields). The third FAILS because the current sanitizer copies `includeShapes` through.

- [ ] **Step 3: Make `LegendPersistedSettings.includeShapes` optional in types**

Edit `packages/utils/src/types.ts` line 115-131 — change the `includeShapes` field:

```ts
export interface LegendPersistedSettings {
  maxVisibleValues: number;
  /** @deprecated Removed in the upcoming release — ignored on read, never emitted on write. */
  includeShapes?: boolean;
  shapeSize: number;
  sortMode: LegendSortMode;
  hiddenValues: string[];
  categories: Record<string, PersistedCategoryData>;
  enableDuplicateStackUI: boolean;
  selectedPaletteId: string;
  numericSettings?: {
    strategy: NumericBinningStrategy;
    signature: string;
    topologySignature?: string;
    manualOrderIds?: string[];
    reverseGradient?: boolean;
  };
}
```

- [ ] **Step 4: Relax the validator and stop emitting from the sanitizer**

Edit `packages/utils/src/parquet/settings-validation.ts`.

At line 64, replace `if (typeof s.includeShapes !== 'boolean') return false;` with:

```ts
if (s.includeShapes !== undefined && typeof s.includeShapes !== 'boolean') return false;
```

At line 201, replace `if (typeof s.includeShapes !== 'boolean') return null;` with:

```ts
if (s.includeShapes !== undefined && typeof s.includeShapes !== 'boolean') return null;
```

At line 253 (inside the return object of `sanitizeLegendSettingsEntry`), delete the `includeShapes: s.includeShapes,` line entirely. The returned object now omits the field.

- [ ] **Step 5: Run tests to verify all three pass**

Run: `pnpm --filter @protspace/utils test -- settings-validation`

Expected: All `settings-validation` tests pass, including the three new ones.

- [ ] **Step 6: Run the wider type-check + test sweep**

Run: `pnpm type-check && pnpm test:ci`

Expected: PASS. Existing fixtures with `includeShapes` keep validating; consumer code still compiles because the field is optional, not removed.

- [ ] **Step 7: Commit**

```bash
git add packages/utils/src/types.ts \
        packages/utils/src/parquet/settings-validation.ts \
        packages/utils/src/parquet/settings-validation.test.ts
pnpm precommit
git commit -m "refactor(types): make legend includeShapes optional + drop on sanitize"
```

---

## Task 2: Drop shape rotation from `visual-encoding` and `legend-data-processor`

**Files:**

- Modify: `packages/core/src/components/legend/visual-encoding.ts`
- Modify: `packages/core/src/components/legend/visual-encoding.test.ts`
- Modify: `packages/core/src/components/legend/legend-data-processor.ts`
- Modify: `packages/core/src/components/legend/legend-data-processor.test.ts`
- Modify (caller): `packages/core/src/components/legend/legend.ts`

- [ ] **Step 1: Update `visual-encoding.ts` — drop the `shapesEnabled` parameter and the `SHAPES` const**

Edit `packages/core/src/components/legend/visual-encoding.ts`. Replace lines 17-52 (the `SHAPES` const, `VisualEncoding` type, and `getVisualEncoding` function) with:

```ts
const KELLYS_COLORS = COLOR_SCHEMES.kellys;

/** Special slot values for reserved categories */
export const SPECIAL_SLOTS = {
  OTHER: -1,
} as const;

/** Fixed color for the synthetic "Other" category. */
const OTHER_COLOR = '#999999';

interface VisualEncoding {
  color: string;
  shape: string;
}

/**
 * Get visual encoding for a category based on its slot.
 *
 * The default shape is always `circle`. Users assign per-category shapes
 * through the per-item shape picker; those persist via `PersistedCategoryData.shape`.
 *
 * NA color is NOT special-cased here — that's the legend processor's job.
 * This function only knows about "Other" (fixed) vs slot-indexed regulars.
 */
export function getVisualEncoding(slot: number, categoryName?: string): VisualEncoding {
  if (categoryName === LEGEND_VALUES.OTHER) {
    return { color: OTHER_COLOR, shape: 'circle' };
  }

  const color = KELLYS_COLORS[slot % KELLYS_COLORS.length];
  return { color, shape: 'circle' };
}
```

Keep the `SlotTracker` class and the `COLOR_SCHEMES` import unchanged.

- [ ] **Step 2: Update `visual-encoding.test.ts` to match the new signature**

Edit `packages/core/src/components/legend/visual-encoding.test.ts`. Any test that invokes `getVisualEncoding(slot, true, ...)` or `getVisualEncoding(slot, false, ...)` should change to `getVisualEncoding(slot, ...)`.

Specifically:

- Tests that previously asserted distinct shapes (`square`, `diamond`, etc.) when `shapesEnabled === true` must be removed or rewritten to assert `shape === 'circle'`.
- Tests that asserted `circle` when `shapesEnabled === false` continue to hold — just drop the bool arg.

Run: `pnpm --filter @protspace/core test -- visual-encoding`

Expected: Compile errors first. After fixing every call site, all tests pass.

- [ ] **Step 3: Update `legend-data-processor.ts` — drop `shapesEnabled` parameter**

Edit `packages/core/src/components/legend/legend-data-processor.ts`.

At line 219, in the `createLegendItems` signature, remove the `shapesEnabled: boolean,` parameter:

```ts
static createLegendItems(
  ctx: LegendProcessorContext,
  topItems: Array<[string, number]>,
  otherCount: number,
  existingLegendItems: LegendItem[],
  sortMode: LegendSortMode = 'size-desc',
  passedZOrders: Map<string, number> = new Map(),
  persistedCategories: Record<string, PersistedCategoryData> = {},
  isNumericSource: boolean = false,
): LegendItem[] {
```

At line 313, replace `let encoding = getVisualEncoding(slot, shapesEnabled, displayName);` with:

```ts
let encoding = getVisualEncoding(slot, displayName);
```

At lines 350 and 353, replace the two `getVisualEncoding(altSlot, false, displayName)` calls with `getVisualEncoding(altSlot, displayName)`.

At lines 357-365, delete the entire shape-conflict resolution block:

```ts
// Resolve shape conflicts (only when shapes are enabled)
if (shapesEnabled && claimedShapes.has(shape)) {
  // Same probing approach for shapes (6 unique shapes, cap at 30 for safety)
  let altSlot = slot + 1;
  shape = getVisualEncoding(altSlot, true, displayName).shape;
  while (claimedShapes.has(shape) && altSlot < slot + 30) {
    altSlot++;
    shape = getVisualEncoding(altSlot, true, displayName).shape;
  }
}
```

The default shape is always `'circle'`, so the conflict probing is dead code.

At line 383, replace `const encoding = getVisualEncoding(-1, shapesEnabled, LEGEND_VALUES.OTHER);` with:

```ts
const encoding = getVisualEncoding(-1, LEGEND_VALUES.OTHER);
```

At line 414, in the `processLegendItems` signature, remove the `shapesEnabled: boolean = false,` parameter.

At line 467, in the call to `createLegendItems(...)`, remove the `shapesEnabled` argument from the argument list. (It appears between `sortMode` and `passedZOrders` — match the new parameter order.)

- [ ] **Step 4: Update `legend.ts` caller**

Edit `packages/core/src/components/legend/legend.ts`. At line 1296, inside the call to `LegendDataProcessor.processLegendItems(...)`, remove the line `this._effectiveIncludeShapes,`. The argument order shifts but the rest is unchanged.

Note: this removes the only use of `_effectiveIncludeShapes` inside `processLegendItems`. The getter at line 650 is still referenced elsewhere (`getEffectiveIncludeShapes` callback, `getLegendExportData`, etc.). Leave the getter in place for now — Task 5 removes it.

- [ ] **Step 5: Update `legend-data-processor.test.ts`**

Edit `packages/core/src/components/legend/legend-data-processor.test.ts`. Find every call to `LegendDataProcessor.processLegendItems(...)` and `LegendDataProcessor.createLegendItems(...)` and remove the `shapesEnabled` argument from each. The current test calls pass `false` or `true` as that argument — drop it.

Run: `pnpm --filter @protspace/core test -- legend-data-processor`

Expected: PASS. If any test was specifically checking shape rotation when `shapesEnabled: true`, replace its expectation with "shape is `'circle'`" or delete it as obsolete.

- [ ] **Step 6: Run full unit test sweep**

Run: `pnpm type-check && pnpm test:ci`

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add packages/core/src/components/legend/visual-encoding.ts \
        packages/core/src/components/legend/visual-encoding.test.ts \
        packages/core/src/components/legend/legend-data-processor.ts \
        packages/core/src/components/legend/legend-data-processor.test.ts \
        packages/core/src/components/legend/legend.ts
pnpm precommit
git commit -m "refactor(legend): drop shapesEnabled from visual encoding + processor"
```

---

## Task 3: Drop `useShapes` from scatterplot + style getters

**Files:**

- Modify: `packages/core/src/components/scatter-plot/style-getters.ts`
- Modify: `packages/core/src/components/scatter-plot/style-getters.test.ts`
- Modify: `packages/core/src/components/scatter-plot/scatter-plot.ts`

- [ ] **Step 1: Drop `useShapes` from `StyleConfig`**

Edit `packages/core/src/components/scatter-plot/style-getters.ts` line 16. Remove the `useShapes?: boolean;` field from `StyleConfig`.

- [ ] **Step 2: Drop the raw-shapes fallback branch in `buildLookupMaps`**

In the same file at lines 91-103, delete the entire `else if (annotation && Array.isArray(annotation.values) && styleConfig.useShapes) { ... }` branch. The preceding `if (shapeMap) { ... }` branch is the only path that populates `valueToShape`. Absent a shape map, the map stays empty and renderers fall back to circles, matching the new behavior.

The remaining code around the deletion should read:

```ts
if (shapeMap) {
  // Use legend-provided shape mapping - always apply custom shapes from legend
  for (const [key, shape] of Object.entries(shapeMap)) {
    valueToShape.set(key, normalizeShapeName(shape));
  }
}
// Detect if the user has effectively hidden all values for the selected annotation
```

- [ ] **Step 3: Update `style-getters.test.ts`**

Edit `packages/core/src/components/scatter-plot/style-getters.test.ts`. Remove `useShapes: false` (and any `useShapes: true`) entries from every `StyleConfig` fixture in the test file. If any test specifically exercises the raw-shape fallback (`styleConfig.useShapes` true with `annotation.shapes` populated and no `shapeMap`), delete that test — it's no longer reachable behavior.

Run: `pnpm --filter @protspace/core test -- style-getters`

Expected: PASS.

- [ ] **Step 4: Drop `@property useShapes` from `scatter-plot.ts`**

Edit `packages/core/src/components/scatter-plot/scatter-plot.ts`.

- Line 72: delete the entire line `@property({ type: Boolean }) useShapes: boolean = false;`.
- Line 529: in the `changedProperties.has(...)` chain inside `updated()` or equivalent, remove `changedProperties.has('useShapes') ||`. Preserve the surrounding `||` operators correctly.
- Line 1762: in the style config object passed to `style-getters`, remove the `useShapes: this.useShapes,` field.
- Line 2122: in the render-cache-key composition, remove the `` `sh:${this.useShapes ? 1 : 0}`, `` line.

- [ ] **Step 5: Run wider type-check (legend.ts and sync-controller still reference `useShapes` via `this._scatterplotElement.useShapes`, so expect failures)**

Run: `pnpm type-check`

Expected: FAIL with errors in `scatterplot-sync-controller.ts` and `scatterplot-interface.ts` referencing the now-removed `useShapes` property. This is expected — Task 4 cleans those up. Do **not** commit yet.

- [ ] **Step 6: Move to Task 4 to complete the cascade before committing**

Skip the commit step and proceed to Task 4. The scatter-plot and style-getters changes will be committed together with the interface/sync-controller changes.

---

## Task 4: Remove `useShapes` from `IScatterplotElement` + delete `supportsShapes` + drop `syncShapes`

**Files:**

- Modify: `packages/core/src/components/legend/scatterplot-interface.ts`
- Modify: `packages/core/src/components/legend/scatterplot-interface.test.ts`
- Modify: `packages/core/src/components/legend/controllers/scatterplot-sync-controller.ts`
- Modify: `packages/core/src/components/legend/controllers/scatterplot-sync-controller.test.ts`
- Modify (caller): `packages/core/src/components/legend/legend.ts`

- [ ] **Step 1: Drop `useShapes` from `IScatterplotElement` and delete `supportsShapes`**

Edit `packages/core/src/components/legend/scatterplot-interface.ts`.

- Line 19: remove `useShapes: boolean;` from `IScatterplotElement`.
- Lines 56-58 (or wherever `supportsShapes` lives): delete the entire `supportsShapes` function.

- [ ] **Step 2: Update `scatterplot-interface.test.ts`**

Edit `packages/core/src/components/legend/scatterplot-interface.test.ts`.

- Drop `supportsShapes` from the import list at line 9.
- Delete the entire `describe('supportsShapes', ...)` suite (lines ~75-90).
- In `createMockScatterplot` (the helper factory used across the file), remove the `useShapes: false` default property. Other mocks that explicitly set `useShapes` should also drop it.

- [ ] **Step 3: Delete `syncShapes` and `getEffectiveIncludeShapes` from `scatterplot-sync-controller.ts`**

Edit `packages/core/src/components/legend/controllers/scatterplot-sync-controller.ts`.

- Line 9: remove `supportsShapes` from the import list.
- Lines 134-141: delete the entire `syncShapes()` method including its JSDoc.
- Find the `ScatterplotSyncCallbacks` interface (top of file) and remove the `getEffectiveIncludeShapes: () => boolean;` callback field.

- [ ] **Step 4: Update `scatterplot-sync-controller.test.ts`**

Edit `packages/core/src/components/legend/controllers/scatterplot-sync-controller.test.ts`.

- Delete the `describe('syncShapes', ...)` suite (around line 275).
- Anywhere a callbacks fixture provides `getEffectiveIncludeShapes`, remove that property.
- The mock scatterplot at line ~546 sets `element.useShapes = false;` — remove that line.
- Any assertion on `mockScatterplot.useShapes` after a sync call (e.g. line 287) — delete the assertion and surrounding test if it was the only test in its `it(...)` block.

- [ ] **Step 5: Update `legend.ts` callers**

Edit `packages/core/src/components/legend/legend.ts`.

- Line 218: in the `ScatterplotSyncController` constructor's callbacks object, remove the `getEffectiveIncludeShapes: () => this._effectiveIncludeShapes,` property.
- Line 1337: delete `this._scatterplotController.syncShapes();`.
- Line 1928: delete `this._scatterplotController.syncShapes();`.

Note: `_effectiveIncludeShapes` getter and the `@property includeShapes` are still referenced by other paths (export-data, applyPersisted, dialog state, settings save/reset). Task 5 removes them.

- [ ] **Step 6: Run type-check**

Run: `pnpm type-check`

Expected: PASS. All `useShapes`/`syncShapes`/`getEffectiveIncludeShapes`/`supportsShapes` references are gone from non-legend.ts files; legend.ts still has the property and getter but no longer wires them into the sync controller.

- [ ] **Step 7: Run full test sweep**

Run: `pnpm test:ci`

Expected: PASS. If any test still references `syncShapes` or `useShapes`, fix the test and re-run.

- [ ] **Step 8: Commit (together with Task 3 changes)**

```bash
git add packages/core/src/components/scatter-plot/style-getters.ts \
        packages/core/src/components/scatter-plot/style-getters.test.ts \
        packages/core/src/components/scatter-plot/scatter-plot.ts \
        packages/core/src/components/legend/scatterplot-interface.ts \
        packages/core/src/components/legend/scatterplot-interface.test.ts \
        packages/core/src/components/legend/controllers/scatterplot-sync-controller.ts \
        packages/core/src/components/legend/controllers/scatterplot-sync-controller.test.ts \
        packages/core/src/components/legend/legend.ts
pnpm precommit
git commit -m "refactor(scatterplot): drop useShapes + syncShapes from scatterplot stack"
```

---

## Task 5: Strip `includeShapes` from persistence controller wiring

**Files:**

- Modify: `packages/core/src/components/legend/controllers/persistence-controller.ts`
- Modify: `packages/core/src/components/legend/controllers/persistence-controller.test.ts`
- Modify (caller): `packages/core/src/components/legend/legend.ts`

- [ ] **Step 1: Drop `includeShapes` from `PersistenceCallbacks.getCurrentSettings`**

Edit `packages/core/src/components/legend/controllers/persistence-controller.ts` line 26. Remove the `includeShapes: boolean;` field from the inline return-type literal:

```ts
getCurrentSettings: () => {
  maxVisibleValues: number;
  shapeSize: number;
  sortMode: LegendSortMode;
  enableDuplicateStackUI: boolean;
  selectedPaletteId: string;
  numericSettings?: LegendPersistedSettings['numericSettings'];
};
```

- [ ] **Step 2: Drop `includeShapes` from save / strip / export**

In the same file:

- Line 84: in `_stripLegacyFields`, delete the `includeShapes: settings.includeShapes,` line.
- Line 140: in `saveSettings`'s `settings` object literal, delete the `includeShapes: currentSettings.includeShapes,` line.
- Line 191: in `getCurrentSettingsForExport`'s return literal, delete the `includeShapes: currentSettings.includeShapes,` line.

- [ ] **Step 3: Update `legend.ts` getCurrentSettings callback**

Edit `packages/core/src/components/legend/legend.ts` line 236. Inside the `getCurrentSettings: () => { return { ... } }` callback (passed to `PersistenceController`), delete the `includeShapes: this.includeShapes,` line.

Note: `this.includeShapes` is still referenced from `_dialogSettings`, the `updated()` watcher, `getLegendExportData`, `_applyPersistedSettings`, `_handleSettingsSave`, `_handleSettingsReset`, and `_openSettingsDialog`. Task 6 removes the property and all remaining references in one pass.

- [ ] **Step 4: Update `persistence-controller.test.ts` fixtures**

Edit `packages/core/src/components/legend/controllers/persistence-controller.test.ts`. The fixture literals on lines 67, 90, 116, 147, 176, 215, 227, 251, 268, 323, 401, 427, 443, 477, 505, 517, 618, 632, 645, 681, 707, 717, 745, 755, 771 all reference `includeShapes`.

Strategy:

- For fixtures that simulate **input from callbacks** (`getCurrentSettings`) into the controller: delete the `includeShapes` field from those objects. The controller's callback type no longer declares it, so test fixtures must also drop it for TypeScript compile.
- For fixtures that simulate **localStorage payloads** (legacy persisted settings the controller reads): keep the `includeShapes: ...` field in _one_ test as a regression check that legacy payloads still load. Drop it from the rest.
- The line 717 assertion `expect(settings.includeShapes).toBe(true);` — replace with `expect(settings.includeShapes).toBeUndefined();` because the sanitiser drops it; or, if the test is exercising the load path before sanitisation, leave it and adjust the comment. **Read the surrounding test context before deciding.**

After edits, run: `pnpm --filter @protspace/core test -- persistence-controller`

Expected: PASS.

- [ ] **Step 5: Run full sweep**

Run: `pnpm type-check && pnpm test:ci`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/core/src/components/legend/controllers/persistence-controller.ts \
        packages/core/src/components/legend/controllers/persistence-controller.test.ts \
        packages/core/src/components/legend/legend.ts
pnpm precommit
git commit -m "refactor(persistence): stop persisting includeShapes for legend settings"
```

---

## Task 6: Remove the toggle UI + `@property includeShapes` + remaining wiring in `legend.ts`

This is the biggest task. Production code change is sizable but mechanical. Tests change in lockstep.

**Files:**

- Modify: `packages/core/src/components/legend/legend.ts`
- Modify: `packages/core/src/components/legend/legend-settings-dialog.ts`
- Modify: `packages/core/src/components/legend/legend-settings-dialog.test.ts`
- Modify: `packages/core/src/components/legend/legend-extract.test.ts`

- [ ] **Step 1: Remove the toggle from the settings dialog UI**

Edit `packages/core/src/components/legend/legend-settings-dialog.ts`.

- Line 20: remove `includeShapes: boolean;` from `SettingsDialogState`.
- Line 39: remove `onIncludeShapesChange: (checked: boolean) => void;` from `SettingsDialogCallbacks`.
- In `renderCheckboxOptions` (lines 165-227), delete:
  - The `shapesDisabled` and `shapesDisabledNote` derivations (lines 169-172).
  - The entire `renderCheckboxCard('Include shapes', ...)` block at lines 209-221.

The function should now just render the "Show duplicate counts and spread overlaps" card and any other checkboxes:

```ts
function renderCheckboxOptions(
  state: SettingsDialogState,
  callbacks: SettingsDialogCallbacks,
): TemplateResult {
  return html`
    ${renderCheckboxCard(
      'Show duplicate counts and spread overlaps',
      state.enableDuplicateStackUI,
      (checked) => callbacks.onEnableDuplicateStackUIChange(checked),
    )}
  `;
}
```

Keep the `renderCheckboxCard` helper as-is — it's still used.

- [ ] **Step 2: Remove `includeShapes` from `legend.ts`**

Edit `packages/core/src/components/legend/legend.ts`.

Delete in order (line numbers from the spec — the file may have shifted by now, grep for each token to confirm):

1. The `@property` declaration:
   ```ts
   @property({ type: Boolean, reflect: true }) includeShapes: boolean =
     LEGEND_DEFAULTS.includeShapes;
   ```
2. The `includeShapes` field inside `_dialogSettings` type literal (around line 170) and its default value `includeShapes: LEGEND_DEFAULTS.includeShapes,` (around line 179).
3. The `_effectiveIncludeShapes` getter (lines ~650-654):
   ```ts
   private get _effectiveIncludeShapes(): boolean { ... }
   ```
4. In `getLegendExportData` (around line 897), drop `includeShapes` from the return type literal and the returned object. The return type becomes:
   ```ts
   public getLegendExportData(): {
     annotation: string;
     otherItemsCount: number;
     items: LegendItem[];
   } {
     return {
       annotation: this.annotationData.name || this.annotationName || 'Legend',
       otherItemsCount: this._otherItems.length,
       items: this._sortedLegendItems.map((i) => ({ ...i })),
     };
   }
   ```
5. In `_applyPersistedSettings` (around line 1393), delete the line `this.includeShapes = isNumericAnnotation ? false : settings.includeShapes;`.
6. In the `updated()` lifecycle method (around line 858-867), remove `changedProperties.has('includeShapes') ||` from the change-detection chain.
7. In `_openSettingsDialog` (around line 1766-1779), delete the `includeShapes: this.includeShapes,` field from the `_dialogSettings` assignment.
8. In `_handleSettingsSave` (lines ~1819-1879), delete:
   - The `nextIncludeShapes` derivation (line 1821).
   - The `shapesSettingChanged` derivation (line 1832).
   - The `this.includeShapes = nextIncludeShapes;` assignment (line 1835).
   - The entire `if (shapesSettingChanged) { ... }` block (lines 1855-1864) that clears pending shape data.
9. In `_handleSettingsReset` (around line 1989), delete `this.includeShapes = LEGEND_DEFAULTS.includeShapes;`.
10. In `_renderSettingsDialog` (around lines 2179-2199), delete:
    - The `includeShapes: isNumericAnnotation ? false : this._dialogSettings.includeShapes,` line from the `_dialogSettings = { ... }` reassignment (line 2181).
    - The `includeShapes: this._dialogSettings.includeShapes,` field from the `state: SettingsDialogState` object (line 2188).
11. In the callbacks object inside `_renderSettingsDialog` (around line 2208), delete:
    ```ts
    onIncludeShapesChange: (v) => {
      this._dialogSettings = { ...this._dialogSettings, includeShapes: v };
    },
    ```

After step 2 the `legend.ts` file has no remaining references to `includeShapes` or `_effectiveIncludeShapes`. Confirm with:

```bash
grep -n "includeShapes\|_effectiveIncludeShapes" packages/core/src/components/legend/legend.ts
```

Expected output: empty.

- [ ] **Step 3: Update `legend-settings-dialog.test.ts`**

Edit `packages/core/src/components/legend/legend-settings-dialog.test.ts`.

- Remove `includeShapes: boolean;` from any local type declarations (lines 27, 32 are tied to the `SettingsDialogState` shape).
- Drop `includeShapes: true,` (or `false`) from every fixture object (lines 110, 156, 289 etc.).
- Delete the test that queries `input[aria-describedby="include-shapes-note"]` (around line 194) — that element no longer exists.
- Delete `expect(el.includeShapes).toBe(false);` style assertions (lines 216, 237, 299). The property is gone.
- Replace any "toggle disabled" test with a single new test asserting the checkbox is absent from the rendered dialog:

```ts
it('does not render an "Include shapes" checkbox', () => {
  // Assumes `container` is the rendered dialog element used elsewhere in this file
  const labels = Array.from(container.querySelectorAll('label')).map((l) =>
    (l.textContent ?? '').trim(),
  );
  expect(labels).not.toContain('Include shapes');
});
```

Run: `pnpm --filter @protspace/core test -- legend-settings-dialog`

Expected: PASS.

- [ ] **Step 4: Update `legend-extract.test.ts`**

Edit `packages/core/src/components/legend/legend-extract.test.ts`. Drop `includeShapes: false,` from the settings fixtures at lines 190 and 206. Run:

```bash
pnpm --filter @protspace/core test -- legend-extract
```

Expected: PASS.

- [ ] **Step 5: Run the full unit suite + type-check**

Run: `pnpm type-check && pnpm test:ci`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/core/src/components/legend/legend.ts \
        packages/core/src/components/legend/legend-settings-dialog.ts \
        packages/core/src/components/legend/legend-settings-dialog.test.ts \
        packages/core/src/components/legend/legend-extract.test.ts
pnpm precommit
git commit -m "refactor(legend): remove Include shapes toggle from settings dialog"
```

---

## Task 7: Drop `includeShapes` from defaults + helpers

**Files:**

- Modify: `packages/core/src/components/legend/config.ts`
- Modify: `packages/core/src/components/legend/legend-helpers.ts`

- [ ] **Step 1: Delete the default**

Edit `packages/core/src/components/legend/config.ts` line 22. Remove `includeShapes: false,` from `LEGEND_DEFAULTS`. The resulting object should not contain that key.

- [ ] **Step 2: Update `createDefaultSettings`**

Edit `packages/core/src/components/legend/legend-helpers.ts` line 97. Remove the `includeShapes: LEGEND_DEFAULTS.includeShapes,` line from the returned `LegendPersistedSettings` object. The function continues to set all remaining required fields.

- [ ] **Step 3: Confirm no remaining references**

```bash
grep -rn "LEGEND_DEFAULTS\.includeShapes" packages/ --include="*.ts"
```

Expected: empty.

- [ ] **Step 4: Run sweep**

Run: `pnpm type-check && pnpm test:ci`

Expected: PASS. If any `legend-helpers.test.ts` test expected `includeShapes` in the defaults, drop the assertion.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/components/legend/config.ts \
        packages/core/src/components/legend/legend-helpers.ts
pnpm precommit
git commit -m "refactor(legend): remove includeShapes from LEGEND_DEFAULTS"
```

---

## Task 8: Drop `includeShapes` from export utilities

**Files:**

- Modify: `packages/utils/src/visualization/export-utils.ts`
- Modify: `packages/utils/src/visualization/export-utils.test.ts`

- [ ] **Step 1: Remove from types and options**

Edit `packages/utils/src/visualization/export-utils.ts`.

- Line 52: remove `includeShapes: boolean;` from the `LegendExportState` type.
- Line 73: remove `includeShapes?: boolean;` (and its JSDoc) from `ExportOptions`.
- Line 131: in `getOptionsWithDefaults`, remove the `includeShapes: options.includeShapes,` line from the returned object.

- [ ] **Step 2: Simplify legend rendering**

In the same file, lines 711-738 (`drawCanvasLegend` or equivalent function):

- Delete the `const includeShapes = ...` derivation.
- Replace the `if (includeShapes) { ... } else { ... }` block with the single `drawCanvasSymbol` call. Items without an explicit shape have `shape === 'circle'`, which `drawCanvasSymbol` already handles. The else-branch that drew a plain `arc` is no longer reachable.

Resulting block:

```ts
this.drawCanvasSymbol(ctx, it.shape, it.color, cx, cy, symbolSize);
```

- [ ] **Step 3: Remove `readUseShapesFromScatterplot`**

Delete the entire method `readUseShapesFromScatterplot` (lines 780-790 or thereabouts). Grep for any remaining references in the file:

```bash
grep -n "readUseShapesFromScatterplot" packages/utils/src/visualization/export-utils.ts
```

Expected: empty.

- [ ] **Step 4: Update `export-utils.test.ts`**

Edit `packages/utils/src/visualization/export-utils.test.ts`.

- Drop `includeShapes` from every `ExportOptions` fixture and from `LegendExportState` fixtures.
- If a test asserted "with `includeShapes: false`, legend draws plain arcs" — replace with: "legend always renders each item's stored shape; default shape is `circle` which renders as a filled circle." Use `drawCanvasSymbol` behavior as the contract.

Run: `pnpm --filter @protspace/utils test -- export-utils`

Expected: PASS.

- [ ] **Step 5: Run sweep**

Run: `pnpm type-check && pnpm test:ci`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/utils/src/visualization/export-utils.ts \
        packages/utils/src/visualization/export-utils.test.ts
pnpm precommit
git commit -m "refactor(export): drop includeShapes from canvas legend export"
```

---

## Task 9: Drop `includeShapes` from publish modal

**Files:**

- Modify: `packages/core/src/components/publish/publish-modal.ts`
- Modify: `packages/core/src/components/publish/publish-modal.test.ts`

- [ ] **Step 1: Drop from local `LegendExportState` interface**

Edit `packages/core/src/components/publish/publish-modal.ts` line 109. Remove `includeShapes: boolean;` from the local `LegendExportState` interface.

- [ ] **Step 2: Verify no reads remain**

```bash
grep -n "includeShapes" packages/core/src/components/publish/publish-modal.ts
```

Expected: empty. If any read remains (e.g. passing it into `ProtSpaceExporter`), remove that reference.

- [ ] **Step 3: Update `publish-modal.test.ts` fixtures**

Edit `packages/core/src/components/publish/publish-modal.test.ts`. If any fixture supplies `includeShapes: true` (or `false`) to a `LegendExportState` mock, remove that field. Grep first to find references:

```bash
grep -n "includeShapes" packages/core/src/components/publish/publish-modal.test.ts
```

Drop every match.

Run: `pnpm --filter @protspace/core test -- publish-modal`

Expected: PASS.

- [ ] **Step 4: Run sweep**

Run: `pnpm type-check && pnpm test:ci`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/components/publish/publish-modal.ts \
        packages/core/src/components/publish/publish-modal.test.ts
pnpm precommit
git commit -m "refactor(publish): drop includeShapes from publish modal"
```

---

## Task 10: Clean up bundle + app test fixtures

**Files:**

- Modify: `packages/core/src/components/data-loader/utils/bundle.test.ts`
- Modify: `packages/core/src/components/data-loader/utils/bundle-roundtrip.test.ts`
- Modify: `packages/utils/src/parquet/bundle-writer.test.ts`
- Modify: `app/tests/numeric-binning.spec.ts`

- [ ] **Step 1: Bundle test fixtures**

Edit `packages/core/src/components/data-loader/utils/bundle.test.ts`.

The file has `includeShapes: true` at lines 143, 189, 213, 225. Strategy:

- Drop `includeShapes` from _all_ fixtures except **one**, which retains `includeShapes: true` as a regression case proving legacy bundles still parse. Add a test comment to that fixture: `// Legacy field — kept to verify backward-compat parsing.`

Edit `packages/core/src/components/data-loader/utils/bundle-roundtrip.test.ts`. Drop `includeShapes: true` from the inline mock settings (around line 60).

Edit `packages/utils/src/parquet/bundle-writer.test.ts`. Drop `includeShapes: true` from the fixture at line 51.

- [ ] **Step 2: Update `app/tests/numeric-binning.spec.ts`**

Edit `app/tests/numeric-binning.spec.ts`.

- At lines ~375-414, replace the block that finds the "Include shapes" label and reads its `disabled` state with a block that asserts the label is absent. Replace `includeShapesDisabled` (returned at line 414) with a boolean like `includeShapesAbsent`.

Approximate replacement:

```ts
const labels = Array.from(root?.querySelectorAll('label') ?? []);
const includeShapesPresent = labels.some(
  (l) => (l.textContent ?? '').trim() === 'Include shapes',
);
// in the returned dialog state object:
includeShapesAbsent: !includeShapesPresent,
```

- At line ~842, replace `expect(initialDialog.includeShapesDisabled).toBe(true);` with `expect(initialDialog.includeShapesAbsent).toBe(true);`.

Confirm the assertion still makes sense in its surrounding context — the test was checking that for numeric annotations the toggle was disabled. Post-removal, the toggle should be absent regardless of annotation type, so the assertion still passes for the numeric case and effectively becomes a generic "toggle removed" check. If the test name mentions "disabled toggle", rename it.

- [ ] **Step 3: Run tests**

Run unit tests:

```bash
pnpm type-check && pnpm test:ci
```

Run the Playwright spec locally if you have a dev server running, otherwise leave it for the verification task. The Playwright suite normally executes in CI.

- [ ] **Step 4: Commit**

```bash
git add packages/core/src/components/data-loader/utils/bundle.test.ts \
        packages/core/src/components/data-loader/utils/bundle-roundtrip.test.ts \
        packages/utils/src/parquet/bundle-writer.test.ts \
        app/tests/numeric-binning.spec.ts
pnpm precommit
git commit -m "test: drop includeShapes from bundle + numeric-binning fixtures"
```

---

## Task 11: Update user + developer docs

**Files:**

- Modify: `docs/explore/legend.md`
- Modify: `docs/developers/api/index.md`

- [ ] **Step 1: Update `docs/explore/legend.md`**

Edit `docs/explore/legend.md`.

- Around line 46, delete the entire `| **Include shapes** | ... |` row from the settings table.
- Around lines 155-166, replace the "Shapes" section with:

```markdown
### Shapes

Every category renders as a circle by default. To assign a different shape (square, diamond, plus, triangle-up, triangle-down) to an individual category, click the category's color/shape swatch in the legend — the popover has a Shape section underneath the color picker.

Numeric and multi-label annotations always render as circles; per-category shape assignment is not available for those.
```

- [ ] **Step 2: Update `docs/developers/api/index.md`**

Edit `docs/developers/api/index.md` line 97. Delete the entire `| `include-shapes` | boolean | true | Enable different shapes per category |` row from the attribute table.

- [ ] **Step 3: Verify docs build**

Run: `pnpm docs:build` (this is part of `pnpm precommit`, but worth checking in isolation if something looks off).

Expected: build completes successfully.

- [ ] **Step 4: Commit**

```bash
git add docs/explore/legend.md docs/developers/api/index.md
pnpm precommit
git commit -m "docs: remove Include shapes toggle from legend + API docs"
```

---

## Task 12: Browser verification + final sweep

This task is **mandatory** before finishing — `feedback_browser_verification.md` in user memory: protspace_web fixes must be verified in the browser, not just by tests.

**Files:** None modified unless verification surfaces an issue.

- [ ] **Step 1: Confirm no stragglers remain**

Run:

```bash
grep -rn "includeShapes\|useShapes\|include-shapes\|include_shapes" \
  packages/ app/ docs/ --include="*.ts" --include="*.tsx" --include="*.md" \
  | grep -v "dist/" | grep -v "docs/superpowers/"
```

Expected: empty output, or only the deliberate legacy fixture in `bundle.test.ts` and the optional `@deprecated` field in `types.ts`.

- [ ] **Step 2: Start the dev server**

Run: `pnpm dev`

Open `http://localhost:8080` in a browser.

- [ ] **Step 3: Manual checks**

Walk through each scenario:

1. Load the default dataset. Open the legend settings dialog. Confirm the "Include shapes" checkbox is **not present**. Layout should still look sensible.
2. Pick a categorical annotation. Confirm every legend item renders as a circle.
3. Click any legend item's color swatch. Confirm the popover has both Color and Shape sections. Pick `diamond` for one category. Confirm both the legend swatch and the scatterplot point render as a diamond.
4. Switch annotations. Confirm the per-category shape choice persists for the original annotation when you switch back.
5. Switch to a numeric annotation. Confirm circles everywhere; no shape picker available on individual items.
6. Switch to a multi-label annotation (if available in the dataset). Confirm circles; no shape picker.
7. **Legacy bundle import:** before this branch, create or take an existing `.parquetbundle` that includes `legendSettings.includeShapes: true`. Import it. Confirm the file loads without errors and renders as expected (all circles unless explicit per-category shapes were saved).
8. **Roundtrip:** export the current dataset as a `.parquetbundle`. Re-import the resulting file. Confirm settings restore correctly and no `includeShapes` field appears in the exported file (open the relevant Parquet table in a JSON inspector if available).
9. Open the Publish modal. Run an export. Confirm the rendered legend shows each category's stored shape (circles by default, custom shapes if assigned).

- [ ] **Step 4: Playwright spec**

Run: `pnpm --filter @protspace/app test:e2e -- numeric-binning` (adjust to the project's actual Playwright invocation if different).

Expected: PASS with the updated absence assertion.

- [ ] **Step 5: Final precommit sweep**

```bash
pnpm precommit
```

Expected: PASS.

- [ ] **Step 6: Push the branch and open a PR linking issue #252**

```bash
git push -u origin refactor/issue-252-remove-include-shapes
gh pr create --title "refactor: remove \"Include shapes\" toggle (closes #252)" \
  --body "$(cat <<'EOF'
## Summary
- Removes the global "Include shapes" toggle and the `useShapes` plumbing
- Defaults all categories to circles; users assign shapes per-category via the existing swatch popover
- `LegendPersistedSettings.includeShapes` becomes optional + `@deprecated`; legacy bundles still parse

Closes #252.

Spec: `docs/superpowers/specs/2026-05-12-remove-include-shapes-toggle-design.md`
EOF
)"
```

Per `feedback_pr_style.md`, do not add a Claude footer or test-plan section.

- [ ] **Step 7: Final commit if anything was tweaked during verification**

If any minor issues surfaced during steps 3/4, commit the fixes with descriptive messages before declaring done.

---

## Out-of-Scope (do not touch in this plan)

- Per-item shape picker UI changes (`legend.ts:2299-2378`).
- Numeric/multilabel rendering paths.
- `SHAPE_PATH_GENERATORS` / `PointShape` types in `@protspace/utils`.
- The `enableDuplicateStackUI` field and its toggle in the settings dialog.
- Reactive `numericSettings` plumbing inside the persistence controller (unrelated).
