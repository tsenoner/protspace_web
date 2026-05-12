# Remove "Include shapes" Toggle - Design Spec

**Issue:** [#252 - Remove "Include shapes" toggle from legend settings](https://github.com/tsenoner/protspace_web/issues/252)
**Date:** 2026-05-12

## Problem

The legend's "Include shapes" toggle (`packages/core/src/components/legend/legend-settings-dialog.ts:209-221`) is a global default-shape generator switch:

- **On**: auto-assigns 6 cycling shapes (circle, square, diamond, plus, triangle-up, triangle-down) to new categories.
- **Off**: every auto-generated shape is `circle`.

Two problems with this design:

1. **Redundant.** A per-item shape picker already exists. Clicking any legend swatch opens a popover with both color and shape sections (`legend.ts:2299-2378`). Users can already give any subset of categories distinct shapes without the global toggle.
2. **Footgun.** Flipping the toggle silently wipes persisted per-category shape customizations (`legend.ts:1855-1864` clears `shape: ''` from every pending category when the toggle value changes).

The default in `LEGEND_DEFAULTS.includeShapes` is `false`, so the project already ships with shapes off. The toggle's only role is "give me distinct shapes for every category in one click" — a niche convenience that does not justify the hidden override semantics or the six layers of code (UI, processor, persistence, validation, exporter, scatterplot) that thread the flag through.

## Goal

Eliminate the global "Include shapes" toggle. Every category defaults to a circle. Users who want shape encoding pick shapes one category at a time via the existing per-item shape picker.

## Non-Goals

- Do not change the per-item shape picker behavior, available shapes, or visual encoding semantics.
- Do not migrate existing `.parquetbundle` files. Old bundles continue to parse; the `includeShapes` field is silently dropped on read.
- Do not change how numeric or multilabel annotations render (they already force circles).
- Do not change the scatterplot's handling of legend-driven `shapeMap`. Custom shapes flow through unchanged.
- Do not redesign the shape picker UI.

## Recommended Approach

**Clean removal** of the `includeShapes` property across all layers, with one small backwards-compatibility accommodation in the persistence-validation layer so existing bundles still parse.

The exporter and scatterplot already render each item's stored shape regardless of the global flag (see `legend-renderer.ts:200` and `style-getters.ts:86`). Removing the flag therefore preserves visible behavior for any legend that has explicit shape assignments. Categories without an explicit shape become circles — which matches today's default-off behavior.

## Behavioral Contract

After removal:

| Scenario                                                         | Before                               | After                                                               |
| ---------------------------------------------------------------- | ------------------------------------ | ------------------------------------------------------------------- |
| Fresh categorical annotation, no customization                   | All circles (toggle defaults to off) | All circles                                                         |
| Toggle off, then user picks `diamond` for one category           | That one is `diamond`, rest circles  | (Per-item picker still works) — that one is `diamond`, rest circles |
| Toggle on (legacy), all 6 default shapes                         | 6 cycling shapes                     | All circles unless user assigns shapes per item                     |
| Numeric / multilabel annotation                                  | Forced circles                       | Forced circles                                                      |
| Bundle import with `includeShapes: true`, no per-category shapes | 6 cycling shapes                     | All circles                                                         |
| Bundle import with per-category shapes persisted                 | Custom shapes render                 | Custom shapes render                                                |

The only user-visible regression is the third row: legacy users who relied on the global toggle to auto-cycle shapes will see all circles after upgrade. They must use the per-item picker (already discoverable from the same swatch popover as color) to restore shape encoding. The current default-off setting means this affects only users who explicitly enabled the toggle.

## Component Changes

### Settings dialog (`packages/core/src/components/legend/legend-settings-dialog.ts`)

- Remove `includeShapes` field from `SettingsDialogState`.
- Remove `onIncludeShapesChange` from `SettingsDialogCallbacks`.
- In `renderCheckboxOptions`, delete the "Include shapes" `renderCheckboxCard` call and the `shapesDisabled`/`shapesDisabledNote` derivation. Keep the "Show duplicate counts and spread overlaps" card.

### Legend component (`packages/core/src/components/legend/legend.ts`)

- Remove `@property includeShapes` (line 120).
- Remove `_dialogSettings.includeShapes` from the state object (lines 170, 179).
- Remove the `_effectiveIncludeShapes` getter (lines 650-654). The `getEffectiveIncludeShapes` callback passed to `ScatterplotSyncController` (line 218) is no longer wired.
- In `getLegendExportData` (lines 897-909), drop `includeShapes` from the returned object.
- In `_applyPersistedSettings` (line 1393), drop the line setting `this.includeShapes`.
- In the `updated` lifecycle hook (lines 858-867), remove `changedProperties.has('includeShapes')` from the rebuild trigger.
- In `_handleSettingsSave` (lines 1819-1879), remove the entire branch that compares `nextIncludeShapes`, clears pending shapes, and assigns `this.includeShapes`. The "shapesSettingChanged" cleanup is no longer needed because the toggle no longer exists.
- In `_handleSettingsReset` (line 1989), remove the reset of `this.includeShapes`.
- In `_openSettingsDialog` (line 1768), remove `includeShapes` from `_dialogSettings`.
- In `_renderSettingsDialog` (lines 2181, 2188, 2208-2209), remove all `includeShapes` references and the `onIncludeShapesChange` callback.

### Scatterplot sync controller (`packages/core/src/components/legend/controllers/scatterplot-sync-controller.ts`)

- Remove the `syncShapes()` method (lines 137-141) and any call sites.
- Remove `getEffectiveIncludeShapes` from the `ScatterplotSyncCallbacks` interface.

### Scatterplot component (`packages/core/src/components/scatter-plot/scatter-plot.ts`)

- Remove `@property useShapes` (line 72).
- Remove `changedProperties.has('useShapes')` from the render-invalidation logic (line 529).
- Remove `useShapes` from the style config passed to `style-getters` (line 1762).
- Remove `useShapes` from the render cache key (line 2122).

### Style getters (`packages/core/src/components/scatter-plot/style-getters.ts`)

- Remove `useShapes` field from `StyleConfig` (line 16).
- In `buildLookupMaps`, delete the `else if (annotation && Array.isArray(annotation.values) && styleConfig.useShapes)` branch (lines 91-103). Custom shapes from `shapeMap` continue to flow through the preceding `if (shapeMap)` branch (lines 85-90). The raw `annotation.shapes` fallback is removed; legends without explicit shape mapping render all circles, which matches the new behavior.

### Scatterplot interface (`packages/core/src/components/legend/scatterplot-interface.ts`)

- Remove `useShapes` from `IScatterplotElement` (line 19).
- Delete the `supportsShapes` helper (line 57) and all call sites. With the property gone, the helper has no purpose.

### Visual encoding (`packages/core/src/components/legend/visual-encoding.ts`)

- Change `getVisualEncoding(slot, shapesEnabled, categoryName?)` to `getVisualEncoding(slot, categoryName?)`. The function always returns `circle` as the default shape now.
- Delete the file-local `SHAPES` const (line 18). It is only used internally by the rotation logic. The shape picker UI in `legend.ts:2250` maintains its own `availableShapes` list and uses `SHAPE_PATH_GENERATORS` from `@protspace/utils`, so removal here has no downstream impact.

### Legend data processor (`packages/core/src/components/legend/legend-data-processor.ts`)

- Remove `shapesEnabled` parameter from `createLegendItems` and `processLegendItems`. Update all call sites.
- In the shape-conflict resolution block (lines 356-365), since `shapesEnabled` is gone and default shape is always circle, the auto-conflict-resolution loop is dead code for default-generated shapes. Keep the persisted-shape branch unchanged. The conflict loop only matters when distinct shapes are auto-assigned, which no longer happens.

### Legend helpers (`packages/core/src/components/legend/legend-helpers.ts`)

- Remove `includeShapes: LEGEND_DEFAULTS.includeShapes` from `createDefaultSettings` (line 97).

### Legend config (`packages/core/src/components/legend/config.ts`)

- Remove `includeShapes: false` from `LEGEND_DEFAULTS` (line 22).

### Persistence controller (`packages/core/src/components/legend/controllers/persistence-controller.ts`)

- Remove `includeShapes: boolean` from `PersistenceCallbacks.getCurrentSettings` return type (line 26).
- Remove `includeShapes` from settings objects built in `_stripLegacyFields` (line 84), `saveSettings` (line 140), and `getCurrentSettingsForExport` (line 191).

### Types (`packages/utils/src/types.ts`)

- Make `includeShapes` **optional** in `LegendPersistedSettings` (line 117). Mark with a deprecation comment: `/** @deprecated Removed in v1.2.0 — field is ignored on read and never written. */`.

### Settings validation (`packages/utils/src/parquet/settings-validation.ts`)

- In `isValidLegendSettings` (line 64): change the check from `typeof s.includeShapes !== 'boolean'` rejecting to "accept `undefined` or `boolean`".
- In `sanitizeLegendSettingsEntry` (lines 201, 253): on parse, treat missing or invalid `includeShapes` as absent. Do not emit the field in the sanitized output.

### Export utilities (`packages/utils/src/visualization/export-utils.ts`)

- Remove `includeShapes` from the `LegendExportState` type (line 52).
- Remove `includeShapes` from `ExportOptions` (line 73) and from `getOptionsWithDefaults` (line 131).
- In `drawCanvasLegend` (lines 711-738), remove the `includeShapes` derivation. Always call `drawCanvasSymbol(ctx, it.shape, it.color, ...)`. Items without an explicit shape will have `shape === 'circle'`, which `drawCanvasSymbol` handles correctly. Delete the `else` branch that drew a plain `arc` — that path is no longer reachable.
- Remove `readUseShapesFromScatterplot` (lines 780-790) — no longer needed.

### Publish modal (`packages/core/src/components/publish/publish-modal.ts`)

- Remove `includeShapes: boolean` from the local `LegendExportState` interface (line 109).
- Grep the modal for any `includeShapes` reads from the export state or passes into `ProtSpaceExporter`. Remove every reference. The modal currently has only the type-level reference; expect a small surface.

## Data Flow

Before:

```
User toggle ──► legend.includeShapes ──► _effectiveIncludeShapes
                                          │
                                          ├──► scatterplot.useShapes (raw shapes fallback)
                                          ├──► legend-data-processor.shapesEnabled (default shape rotation)
                                          ├──► export-utils.includeShapes (legend image render mode)
                                          └──► persistence-controller.includeShapes (localStorage + bundle)
```

After:

```
(no global flag)
                                                ┌──► legend renders item.shape directly (already does)
User per-item picker ──► PersistedCategoryData.shape ──┤
                                                └──► scatterplot.shapeMap ──► style-getters
```

Default shape for any category lacking an explicit assignment is `circle`. The legend renderer, scatterplot, and exporter all already honor explicit shape assignments and fall back to circles in their absence, so no rendering layer needs new logic — only removals.

## Bundle Compatibility

The current bundle format (`BundleSettings.legendSettings[annotation].includeShapes`) is a required boolean. Strategy:

- **Reading old bundles**: validation accepts missing or boolean `includeShapes`. Sanitization drops it from the resulting `LegendPersistedSettings`.
- **Writing new bundles**: never emit `includeShapes`.
- **Reading new bundles by old code**: old clients require the field and will reject. This is the same break we'd get with any field removal. Document in the changelog.

No data migration tool is needed. The flag only controlled default auto-encoding behavior; explicit per-category shapes are stored in `categories[annotation][value].shape` and travel through untouched.

## Test Updates

Thirteen test files reference `includeShapes` or `useShapes`. Most updates are mechanical fixture cleanup. Test files to touch:

- `app/tests/numeric-binning.spec.ts` — remove the assertion that the toggle is disabled (lines 375-414, 842). Replace with an assertion that the toggle is absent.
- `packages/core/src/components/legend/legend-settings-dialog.test.ts` — delete the entire `includeShapes` toggle test suite and `includeShapes`/`onIncludeShapesChange` from `SettingsDialogState`/`SettingsDialogCallbacks` fixtures.
- `packages/core/src/components/legend/scatterplot-interface.test.ts` — remove `useShapes` from mock factory and the `supportsShapes` tests.
- `packages/core/src/components/legend/legend-extract.test.ts` — drop `includeShapes` from fixture settings (lines 190, 206).
- `packages/core/src/components/legend/controllers/persistence-controller.test.ts` — remove `includeShapes` from every fixture (~25 occurrences).
- `packages/core/src/components/legend/controllers/scatterplot-sync-controller.test.ts` — remove `useShapes` assertions and the test verifying `syncShapes` propagates the flag.
- `packages/core/src/components/data-loader/utils/bundle-roundtrip.test.ts` — drop `includeShapes` from mock settings.
- `packages/core/src/components/data-loader/utils/bundle.test.ts` — drop `includeShapes` from fixtures.
- `packages/core/src/components/publish/publish-modal.test.ts` — drop from any export-state fixtures.
- `packages/core/src/components/scatter-plot/style-getters.test.ts` — remove `useShapes: false` from style configs.
- `packages/utils/src/visualization/export-utils.test.ts` — drop `includeShapes` from `ExportOptions` fixtures; ensure exported legend still renders each item's stored shape.
- `packages/utils/src/parquet/bundle-writer.test.ts` — drop from fixtures.
- `packages/utils/src/parquet/settings-validation.test.ts` — add a new test that bundles missing `includeShapes` validate and sanitize cleanly. Keep one test that bundles with `includeShapes: true` (legacy) also validate.

New test to add:

- `packages/utils/src/parquet/settings-validation.test.ts`: a legacy bundle containing `includeShapes: true` reads successfully and the resulting `LegendPersistedSettings` has no `includeShapes` field.

## Documentation Updates

- `docs/explore/legend.md:45-46` — remove the "Include shapes" row from the settings table.
- `docs/explore/legend.md:155-166` — replace the "Shapes" section. Document that the default shape is circle for every category, and that users assign per-category shapes through the swatch popover.
- `docs/developers/api/index.md:97` — remove the `include-shapes` attribute row.

## Out-of-Scope but Worth Noting

The `useShapes` property on `protspace-scatterplot` is part of the component's public attribute surface. Removing it is technically a breaking change to embedders. Acceptable here because the project's API is documented as evolving (1.x), but flag in the release notes.

## Effort Estimate (LLM-assisted)

- Production code removal: 1.5 hours
- Test fixture cleanup: 1.5 hours
- Validation backward-compat tests: 0.5 hours
- Docs updates: 0.5 hours
- Verification in browser (Playwright + manual): 1 hour
- Total: ~5 hours

## Verification

Before declaring done:

1. `pnpm precommit` passes.
2. Open `localhost:8080` with `app/public/data.parquetbundle`. Confirm:
   - Categorical annotation: every category is a circle by default.
   - Per-item shape picker still works.
   - Numeric annotation: still all circles, no toggle visible.
   - Multilabel annotation: still all circles, no toggle visible.
3. Import an older bundle (created before this change). Confirm it loads without validation errors and shapes render as expected.
4. Export a bundle. Re-import. Confirm round-trip works.
5. Open settings dialog. Confirm "Include shapes" checkbox is gone, layout still reasonable.
