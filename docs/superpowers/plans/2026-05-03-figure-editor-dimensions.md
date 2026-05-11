# Figure Editor Dimensions — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rework the publish-modal Dimensions panel into a Photoshop-style Image-Size dialog with an explicit Resample toggle, embed real DPI metadata in PNG output, and make the PDF page size match the chosen mm width.

**Architecture:** The publish modal lives at `packages/core/src/components/publish/`. State changes go through pure helpers in `publish-modal-helpers.ts` that return `Partial<PublishState>`. PNG DPI metadata is added in a new `packages/utils/src/png/phys-chunk.ts` module via a `pHYs` chunk inserted post-encode. PDF generation switches from a fixed-A4 layout to a single-page document whose page size is the chosen figure's mm dimensions.

**Tech Stack:** TypeScript, Lit 3.3 (web components), Vitest (unit + jsdom), jsPDF.

**Spec:** `docs/superpowers/specs/2026-05-03-figure-editor-dimensions-design.md`

---

## File Structure

| File                                                                   | Status | Responsibility                                                                                                                                                                           |
| ---------------------------------------------------------------------- | ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/core/src/components/publish/dimension-utils.ts`              | Modify | Add `inToPx`/`pxToIn`/`cmToPx`/`pxToCm` helpers.                                                                                                                                         |
| `packages/core/src/components/publish/dimension-utils.test.ts`         | Modify | Add `in`/`cm` round-trip tests.                                                                                                                                                          |
| `packages/core/src/components/publish/publish-state.ts`                | Modify | Add `resample`, `aspectLocked`, `unit` fields with defaults.                                                                                                                             |
| `packages/core/src/components/publish/publish-state.test.ts`           | Modify | Cover new field defaults.                                                                                                                                                                |
| `packages/core/src/components/publish/publish-state-validator.ts`      | Modify | Sanitise the three new fields.                                                                                                                                                           |
| `packages/core/src/components/publish/publish-state-validator.test.ts` | Modify | Cover the new sanitisation.                                                                                                                                                              |
| `packages/core/src/components/publish/publish-modal-helpers.ts`        | Modify | New `computeWidthMmUpdate`/`computeHeightMmUpdate`; rewrite `computeWidthUpdate`/`computeHeightUpdate`/`computeDpiUpdate` as Resample-aware; preset application forces `resample: true`. |
| `packages/core/src/components/publish/publish-modal-helpers.test.ts`   | Modify | Resample × aspectLocked × preset matrix.                                                                                                                                                 |
| `packages/core/src/components/publish/publish-modal.ts`                | Modify | Replace dimension sliders with mm/px/in/cm inputs, chain-link icon, Resample checkbox, top readouts.                                                                                     |
| `packages/core/src/components/publish/publish-modal.styles.ts`         | Modify | Styles for the new input rows, chain-link, info icon, "preset turned on" note.                                                                                                           |
| `packages/core/src/components/publish/publish-modal.test.ts`           | Modify | Component-level interactions for the new Dimensions section.                                                                                                                             |
| `packages/utils/src/png/phys-chunk.ts`                                 | Create | `pngWithDpi(blob, dpi)` — inserts a `pHYs` chunk via pure JS.                                                                                                                            |
| `packages/utils/src/png/phys-chunk.test.ts`                            | Create | Round-trip and CRC32 correctness.                                                                                                                                                        |
| `packages/utils/src/index.ts`                                          | Modify | Re-export `pngWithDpi`.                                                                                                                                                                  |
| `packages/utils/src/visualization/export-utils.ts`                     | Modify | New `exportCanvasAsPdf({ widthMm, heightMm, filename })` signature; mm-accurate page size, no margin.                                                                                    |
| `packages/utils/src/visualization/export-utils.test.ts`                | Modify | Tests for the new `exportCanvasAsPdf` signature.                                                                                                                                         |
| `app/src/explore/export-handler.ts`                                    | Modify | Wire publish-export to `pngWithDpi` (PNG path) and the new mm-aware `exportCanvasAsPdf` (PDF path).                                                                                      |

---

## Task 1: Add `in`/`cm` conversions to dimension-utils

**Files:**

- Modify: `packages/core/src/components/publish/dimension-utils.ts`
- Test: `packages/core/src/components/publish/dimension-utils.test.ts`

- [ ] **Step 1: Write the failing tests**

Add to the bottom of `packages/core/src/components/publish/dimension-utils.test.ts`, just before the final `});` of `describe('dimension-utils', ...)`:

```ts
describe('inToMm / mmToIn', () => {
  it('converts 1 inch to 25.4 mm', () => {
    expect(inToMm(1)).toBeCloseTo(25.4, 4);
  });

  it('converts 25.4 mm to 1 inch', () => {
    expect(mmToIn(25.4)).toBeCloseTo(1, 4);
  });

  it('round-trips arbitrary values', () => {
    expect(mmToIn(inToMm(3.5))).toBeCloseTo(3.5, 4);
  });
});

describe('cmToMm / mmToCm', () => {
  it('converts 1 cm to 10 mm', () => {
    expect(cmToMm(1)).toBeCloseTo(10, 4);
  });

  it('converts 89 mm to 8.9 cm', () => {
    expect(mmToCm(89)).toBeCloseTo(8.9, 4);
  });

  it('round-trips arbitrary values', () => {
    expect(mmToCm(cmToMm(7.25))).toBeCloseTo(7.25, 4);
  });
});
```

Also extend the import at the top of the file:

```ts
import {
  pxToMm,
  mmToPx,
  adjustDpiForWidthMm,
  adjustWidthPxForDpi,
  clampHeight,
  SIZE_MODE_WIDTH_MM,
  inToMm,
  mmToIn,
  cmToMm,
  mmToCm,
  type SizeMode,
} from './dimension-utils';
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter @protspace/core test:ci -- --run dimension-utils`
Expected: 6 new tests fail with "inToMm is not defined" / "mmToIn is not defined" / "cmToMm is not defined" / "mmToCm is not defined".

- [ ] **Step 3: Add the helpers**

Edit `packages/core/src/components/publish/dimension-utils.ts`. After the existing `MM_PER_INCH` constant, add:

```ts
const MM_PER_CM = 10;

/** Convert inches to millimetres. */
export function inToMm(inches: number): number {
  return inches * MM_PER_INCH;
}

/** Convert millimetres to inches. */
export function mmToIn(mm: number): number {
  return mm / MM_PER_INCH;
}

/** Convert centimetres to millimetres. */
export function cmToMm(cm: number): number {
  return cm * MM_PER_CM;
}

/** Convert millimetres to centimetres. */
export function mmToCm(mm: number): number {
  return mm / MM_PER_CM;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter @protspace/core test:ci -- --run dimension-utils`
Expected: all dimension-utils tests pass.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/components/publish/dimension-utils.ts packages/core/src/components/publish/dimension-utils.test.ts
git commit -m "feat(publish): add in/cm conversion helpers to dimension-utils"
```

---

## Task 2: Add `resample`, `aspectLocked`, `unit` fields to PublishState

**Files:**

- Modify: `packages/core/src/components/publish/publish-state.ts`
- Test: `packages/core/src/components/publish/publish-state.test.ts`

- [ ] **Step 1: Write the failing tests**

Add to `packages/core/src/components/publish/publish-state.test.ts`, inside `describe('createDefaultPublishState', ...)` just before its closing `});`:

```ts
it('defaults resample to true', () => {
  expect(createDefaultPublishState().resample).toBe(true);
});

it('defaults aspectLocked to true', () => {
  expect(createDefaultPublishState().aspectLocked).toBe(true);
});

it('defaults unit to mm', () => {
  expect(createDefaultPublishState().unit).toBe('mm');
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter @protspace/core test:ci -- --run publish-state`
Expected: 3 tests fail because `resample`/`aspectLocked`/`unit` don't exist on `PublishState`.

- [ ] **Step 3: Extend the type and the default factory**

Edit `packages/core/src/components/publish/publish-state.ts`. In the `PublishState` interface (around line 105), add three fields right above `viewFingerprint`:

```ts
/** When true, changing dpi/mm recomputes pixels. When false, only metadata changes. */
resample: boolean;
/** Chain-link aspect ratio: when true, editing width also rescales height (and vice versa). */
aspectLocked: boolean;
/** Display unit for Width/Height inputs. Display-only; pixels are the internal source of truth. */
unit: 'px' | 'mm' | 'in' | 'cm';
```

In `createDefaultPublishState`, add the three defaults to the returned object (after `dpi: 300,`):

```ts
    dpi: 300,
    resample: true,
    aspectLocked: true,
    unit: 'mm',
    format: 'png',
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter @protspace/core test:ci -- --run publish-state`
Expected: all publish-state tests pass.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/components/publish/publish-state.ts packages/core/src/components/publish/publish-state.test.ts
git commit -m "feat(publish): add resample, aspectLocked, unit fields to PublishState"
```

---

## Task 3: Sanitise the new fields in publish-state-validator

**Files:**

- Modify: `packages/core/src/components/publish/publish-state-validator.ts`
- Test: `packages/core/src/components/publish/publish-state-validator.test.ts`

- [ ] **Step 1: Write the failing tests**

Append inside the existing `describe('sanitizePublishState', ...)`:

```ts
it('defaults resample/aspectLocked/unit when missing', () => {
  const result = sanitizePublishState({});
  expect(result.resample).toBe(true);
  expect(result.aspectLocked).toBe(true);
  expect(result.unit).toBe('mm');
});

it('preserves valid resample/aspectLocked/unit', () => {
  const result = sanitizePublishState({
    resample: false,
    aspectLocked: false,
    unit: 'in',
  });
  expect(result.resample).toBe(false);
  expect(result.aspectLocked).toBe(false);
  expect(result.unit).toBe('in');
});

it('rejects unknown unit and falls back to default', () => {
  const result = sanitizePublishState({ unit: 'parsec' });
  expect(result.unit).toBe('mm');
});

it('rejects non-boolean resample/aspectLocked and falls back to defaults', () => {
  const result = sanitizePublishState({ resample: 'yes', aspectLocked: 1 });
  expect(result.resample).toBe(true);
  expect(result.aspectLocked).toBe(true);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter @protspace/core test:ci -- --run publish-state-validator`
Expected: 4 tests fail — sanitiser doesn't yet read or default the new fields.

- [ ] **Step 3: Update the sanitiser**

Edit `packages/core/src/components/publish/publish-state-validator.ts`. In the `sanitizePublishState` function's returned object (around line 168), add three new fields after `dpi:`:

```ts
    dpi: isFiniteNumber(input.dpi) && input.dpi > 0 ? input.dpi : defaults.dpi,
    resample: typeof input.resample === 'boolean' ? input.resample : defaults.resample,
    aspectLocked:
      typeof input.aspectLocked === 'boolean' ? input.aspectLocked : defaults.aspectLocked,
    unit:
      input.unit === 'px' || input.unit === 'mm' || input.unit === 'in' || input.unit === 'cm'
        ? input.unit
        : defaults.unit,
    format: input.format === 'pdf' ? 'pdf' : 'png',
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter @protspace/core test:ci -- --run publish-state-validator`
Expected: all publish-state-validator tests pass.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/components/publish/publish-state-validator.ts packages/core/src/components/publish/publish-state-validator.test.ts
git commit -m "feat(publish): sanitise resample/aspectLocked/unit fields"
```

---

## Task 4: Resample-aware update helpers (px and mm inputs, aspect lock)

**Files:**

- Modify: `packages/core/src/components/publish/publish-modal-helpers.ts`
- Test: `packages/core/src/components/publish/publish-modal-helpers.test.ts`

- [ ] **Step 1: Write the failing tests**

Replace the `describe('computeWidthUpdate', ...)`, `describe('computeHeightUpdate', ...)`, and `describe('computeDpiUpdate', ...)` blocks in `publish-modal-helpers.test.ts` with the following (the existing preset-coupled tests are obsolete — Resample is now the source of truth):

```ts
describe('computeWidthPxUpdate', () => {
  it('Resample=ON: changes widthPx, leaves dpi fixed', () => {
    const state = makeState({ widthPx: 1051, heightPx: 591, dpi: 300, resample: true });
    const patch = computeWidthPxUpdate(state, 2102);
    expect(patch.widthPx).toBe(2102);
    expect(patch.dpi).toBeUndefined();
  });

  it('aspectLocked=true: scales height proportionally', () => {
    const state = makeState({
      widthPx: 1000,
      heightPx: 500,
      dpi: 300,
      resample: true,
      aspectLocked: true,
    });
    const patch = computeWidthPxUpdate(state, 2000);
    expect(patch.widthPx).toBe(2000);
    expect(patch.heightPx).toBe(1000);
  });

  it('aspectLocked=false: leaves height untouched', () => {
    const state = makeState({
      widthPx: 1000,
      heightPx: 500,
      dpi: 300,
      resample: true,
      aspectLocked: false,
    });
    const patch = computeWidthPxUpdate(state, 2000);
    expect(patch.widthPx).toBe(2000);
    expect(patch.heightPx).toBeUndefined();
  });

  it('marks preset as custom unless preset is already custom', () => {
    const state = makeState({ preset: 'nature-1col', widthPx: 1051, dpi: 300, resample: true });
    const patch = computeWidthPxUpdate(state, 2000);
    expect(patch.preset).toBe('custom');
  });
});

describe('computeWidthMmUpdate', () => {
  it('Resample=ON: changes widthPx, leaves dpi fixed', () => {
    const state = makeState({ widthPx: 1051, dpi: 300, resample: true });
    const patch = computeWidthMmUpdate(state, 178);
    expect(patch.widthPx).toBe(2102);
    expect(patch.dpi).toBeUndefined();
  });

  it('Resample=OFF: changes dpi, leaves widthPx fixed', () => {
    const state = makeState({ widthPx: 1051, heightPx: 591, dpi: 300, resample: false });
    const patch = computeWidthMmUpdate(state, 89);
    expect(patch.widthPx).toBeUndefined();
    expect(patch.dpi).toBe(300);
  });

  it('Resample=OFF, halving mm doubles dpi', () => {
    const state = makeState({ widthPx: 1051, dpi: 300, resample: false });
    const patch = computeWidthMmUpdate(state, 44.5);
    expect(patch.dpi).toBe(600);
  });

  it('Resample=ON aspectLocked=true: scales height proportionally', () => {
    const state = makeState({
      widthPx: 1000,
      heightPx: 500,
      dpi: 300,
      resample: true,
      aspectLocked: true,
    });
    const patch = computeWidthMmUpdate(state, 169.333);
    expect(patch.widthPx).toBe(2000);
    expect(patch.heightPx).toBe(1000);
  });
});

describe('computeHeightPxUpdate', () => {
  it('Resample=ON aspectLocked=true: scales width proportionally', () => {
    const state = makeState({
      widthPx: 1000,
      heightPx: 500,
      dpi: 300,
      resample: true,
      aspectLocked: true,
    });
    const patch = computeHeightPxUpdate(state, 1000);
    expect(patch.heightPx).toBe(1000);
    expect(patch.widthPx).toBe(2000);
  });

  it('aspectLocked=false: leaves width untouched', () => {
    const state = makeState({
      widthPx: 1000,
      heightPx: 500,
      dpi: 300,
      resample: true,
      aspectLocked: false,
    });
    const patch = computeHeightPxUpdate(state, 800);
    expect(patch.heightPx).toBe(800);
    expect(patch.widthPx).toBeUndefined();
  });
});

describe('computeHeightMmUpdate', () => {
  it('Resample=OFF: changes dpi (height-derived), widthPx untouched', () => {
    const state = makeState({ widthPx: 1051, heightPx: 591, dpi: 300, resample: false });
    const patch = computeHeightMmUpdate(state, 50);
    expect(patch.heightPx).toBeUndefined();
    expect(patch.dpi).toBeCloseTo(300, 0);
  });
});

describe('computeDpiUpdate', () => {
  it('Resample=ON: doubles widthPx and heightPx, mm fixed', () => {
    const state = makeState({ widthPx: 1051, heightPx: 591, dpi: 300, resample: true });
    const patch = computeDpiUpdate(state, 600);
    expect(patch.dpi).toBe(600);
    expect(patch.widthPx).toBe(2102);
    expect(patch.heightPx).toBe(1182);
  });

  it('Resample=ON: halves pixels at half DPI', () => {
    const state = makeState({ widthPx: 1051, heightPx: 591, dpi: 300, resample: true });
    const patch = computeDpiUpdate(state, 150);
    expect(patch.widthPx).toBe(526);
    expect(patch.heightPx).toBe(296);
  });

  it('Resample=OFF: dpi changes, pixels stay locked', () => {
    const state = makeState({ widthPx: 1051, heightPx: 591, dpi: 300, resample: false });
    const patch = computeDpiUpdate(state, 600);
    expect(patch.dpi).toBe(600);
    expect(patch.widthPx).toBeUndefined();
    expect(patch.heightPx).toBeUndefined();
  });

  it('Flexible mode + Resample=ON: pixels still recompute', () => {
    const state = makeState({
      preset: 'flexible',
      widthPx: 2048,
      heightPx: 1024,
      dpi: 300,
      resample: true,
    });
    const patch = computeDpiUpdate(state, 600);
    expect(patch.widthPx).toBe(4096);
    expect(patch.heightPx).toBe(2048);
  });

  it('preserves the active preset (DPI is part of preset semantics)', () => {
    const state = makeState({
      preset: 'nature-1col',
      widthPx: 1051,
      heightPx: 591,
      dpi: 300,
      resample: true,
    });
    const patch = computeDpiUpdate(state, 600);
    expect(patch.preset).toBeUndefined();
  });
});
```

Update the import line at the top of the test file:

```ts
import {
  getActivePresetConstraints,
  computeWidthPxUpdate,
  computeWidthMmUpdate,
  computeHeightPxUpdate,
  computeHeightMmUpdate,
  computeDpiUpdate,
  computePresetApplication,
  shouldShowFingerprintWarning,
} from './publish-modal-helpers';
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter @protspace/core test:ci -- --run publish-modal-helpers`
Expected: many failures — the new helper names don't exist yet, and the renamed `computeWidthUpdate`/`computeHeightUpdate` are gone.

- [ ] **Step 3: Rewrite the helpers**

Replace the body of `packages/core/src/components/publish/publish-modal-helpers.ts` with the following (preserving the leading docstring comment):

```ts
/**
 * Pure helper functions extracted from the publish modal component.
 *
 * Each function takes state as input and returns a partial state patch —
 * no DOM access, no side effects, fully testable. The Resample toggle
 * decides which axis the algebra (widthPx = widthMm × dpi / 25.4) resolves
 * around: Resample=ON keeps mm fixed and recomputes px; Resample=OFF keeps
 * px fixed and recomputes dpi (so mm follows).
 */

import type { PublishState } from './publish-state';
import { getPreset, resolvePresetDimensions, type PresetId } from './journal-presets';
import { mmToPx, pxToMm } from './dimension-utils';

type ViewFingerprint = { projection: string; dimensionality: number };

/** Return the active preset's mm constraints, or null for px-based / custom presets. */
export function getActivePresetConstraints(
  state: PublishState,
): { widthMm: number; maxHeightMm: number | undefined } | null {
  const preset = getPreset(state.preset);
  if (!preset || preset.widthMm === undefined) return null;
  return { widthMm: preset.widthMm, maxHeightMm: preset.maxHeightMm };
}

/** Width input in pixels. Only fires when unit === 'px' (Resample=OFF makes the input read-only). */
export function computeWidthPxUpdate(state: PublishState, widthPx: number): Partial<PublishState> {
  const patch: Partial<PublishState> = { widthPx, preset: 'custom' };
  if (state.aspectLocked && state.widthPx > 0) {
    const ratio = state.heightPx / state.widthPx;
    patch.heightPx = Math.max(1, Math.round(widthPx * ratio));
  }
  return patch;
}

/** Width input in mm/in/cm. Branches on `state.resample`. */
export function computeWidthMmUpdate(state: PublishState, widthMm: number): Partial<PublishState> {
  if (widthMm <= 0) return {};
  if (state.resample) {
    const widthPx = Math.max(1, mmToPx(widthMm, state.dpi));
    const patch: Partial<PublishState> = { widthPx, preset: 'custom' };
    if (state.aspectLocked && state.widthPx > 0) {
      const ratio = state.heightPx / state.widthPx;
      patch.heightPx = Math.max(1, Math.round(widthPx * ratio));
    }
    return patch;
  }
  // Resample=OFF: pixels locked, dpi recomputes.
  const dpi = Math.max(1, Math.round((state.widthPx * 25.4) / widthMm));
  return { dpi, preset: 'custom' };
}

/** Height input in pixels. Only fires when unit === 'px'. */
export function computeHeightPxUpdate(
  state: PublishState,
  heightPx: number,
): Partial<PublishState> {
  const patch: Partial<PublishState> = { heightPx, preset: 'custom' };
  if (state.aspectLocked && state.heightPx > 0) {
    const ratio = state.widthPx / state.heightPx;
    patch.widthPx = Math.max(1, Math.round(heightPx * ratio));
  }
  return patch;
}

/** Height input in mm/in/cm. Branches on `state.resample`. */
export function computeHeightMmUpdate(
  state: PublishState,
  heightMm: number,
): Partial<PublishState> {
  if (heightMm <= 0) return {};
  if (state.resample) {
    const heightPx = Math.max(1, mmToPx(heightMm, state.dpi));
    const patch: Partial<PublishState> = { heightPx, preset: 'custom' };
    if (state.aspectLocked && state.heightPx > 0) {
      const ratio = state.widthPx / state.heightPx;
      patch.widthPx = Math.max(1, Math.round(heightPx * ratio));
    }
    return patch;
  }
  const dpi = Math.max(1, Math.round((state.heightPx * 25.4) / heightMm));
  return { dpi, preset: 'custom' };
}

/** DPI input. Branches on `state.resample`. Preserves the active preset (DPI is part of preset semantics). */
export function computeDpiUpdate(state: PublishState, dpi: number): Partial<PublishState> {
  if (dpi <= 0) return {};
  if (state.resample) {
    const widthMm = pxToMm(state.widthPx, state.dpi);
    const heightMm = pxToMm(state.heightPx, state.dpi);
    return {
      dpi,
      widthPx: Math.max(1, mmToPx(widthMm, dpi)),
      heightPx: Math.max(1, mmToPx(heightMm, dpi)),
    };
  }
  return { dpi };
}

/** Compute state patch for applying a journal preset. Always forces resample=true. */
export function computePresetApplication(presetId: string): {
  preset: PresetId;
  widthPx: number;
  heightPx: number | undefined;
  dpi: number;
  resample: true;
} | null {
  const preset = getPreset(presetId);
  if (!preset) return null;
  const dims = resolvePresetDimensions(preset);
  return {
    preset: presetId as PresetId,
    widthPx: dims.widthPx,
    heightPx: dims.heightPx,
    dpi: preset.dpi,
    resample: true,
  };
}

/** Check whether saved overlays may be stale due to a projection change. */
export function shouldShowFingerprintWarning(
  saved: ViewFingerprint | undefined,
  current: ViewFingerprint | null,
): boolean {
  if (!saved || !current) return false;
  return saved.projection !== current.projection || saved.dimensionality !== current.dimensionality;
}
```

- [ ] **Step 4: Add a test for `computePresetApplication` forcing Resample=ON**

Inside the existing `describe('computePresetApplication', ...)`, add:

```ts
it('forces resample to true', () => {
  const patch = computePresetApplication('nature-1col');
  expect(patch).not.toBeNull();
  expect(patch!.resample).toBe(true);
});
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `pnpm --filter @protspace/core test:ci -- --run publish-modal-helpers`
Expected: all tests pass.

- [ ] **Step 6: Commit**

```bash
git add packages/core/src/components/publish/publish-modal-helpers.ts packages/core/src/components/publish/publish-modal-helpers.test.ts
git commit -m "feat(publish): Resample-aware dimension helpers + aspect lock"
```

---

## Task 5: Create the PNG `pHYs` chunk writer

**Files:**

- Create: `packages/utils/src/png/phys-chunk.ts`
- Create: `packages/utils/src/png/phys-chunk.test.ts`
- Modify: `packages/utils/src/index.ts`

- [ ] **Step 1: Write the failing tests**

Create `packages/utils/src/png/phys-chunk.test.ts`:

```ts
/**
 * @vitest-environment jsdom
 */
import { describe, it, expect } from 'vitest';
import { pngWithDpi } from './phys-chunk';

// 1×1 transparent PNG (no pHYs chunk). Bytes verified against `xxd` output.
const ONE_BY_ONE_PNG = new Uint8Array([
  0x89,
  0x50,
  0x4e,
  0x47,
  0x0d,
  0x0a,
  0x1a,
  0x0a, // PNG signature
  0x00,
  0x00,
  0x00,
  0x0d,
  0x49,
  0x48,
  0x44,
  0x52, // IHDR length + type
  0x00,
  0x00,
  0x00,
  0x01,
  0x00,
  0x00,
  0x00,
  0x01, // 1×1
  0x08,
  0x06,
  0x00,
  0x00,
  0x00,
  0x1f,
  0x15,
  0xc4,
  0x89, // IHDR data + CRC
  0x00,
  0x00,
  0x00,
  0x0d,
  0x49,
  0x44,
  0x41,
  0x54, // IDAT length + type
  0x78,
  0x9c,
  0x62,
  0x00,
  0x01,
  0x00,
  0x00,
  0x05,
  0x00,
  0x01,
  0x0d,
  0x0a,
  0x2d,
  0xb4, // IDAT data
  0x00,
  0x00,
  0x00,
  0x00,
  0x49,
  0x45,
  0x4e,
  0x44, // IEND
  0xae,
  0x42,
  0x60,
  0x82,
]);

function readUint32(buf: Uint8Array, offset: number): number {
  return (
    ((buf[offset] << 24) | (buf[offset + 1] << 16) | (buf[offset + 2] << 8) | buf[offset + 3]) >>> 0
  );
}

function findChunk(buf: Uint8Array, type: string): { dataOffset: number; length: number } | null {
  let offset = 8;
  while (offset < buf.length) {
    const length = readUint32(buf, offset);
    const tag = String.fromCharCode(
      buf[offset + 4],
      buf[offset + 5],
      buf[offset + 6],
      buf[offset + 7],
    );
    if (tag === type) return { dataOffset: offset + 8, length };
    offset += 12 + length;
  }
  return null;
}

describe('pngWithDpi', () => {
  it('inserts a pHYs chunk after IHDR for 300 DPI', async () => {
    const blob = new Blob([ONE_BY_ONE_PNG], { type: 'image/png' });
    const out = await pngWithDpi(blob, 300);
    const buf = new Uint8Array(await out.arrayBuffer());
    const phys = findChunk(buf, 'pHYs');
    expect(phys).not.toBeNull();
    expect(phys!.length).toBe(9);
    const ppmX = readUint32(buf, phys!.dataOffset);
    const ppmY = readUint32(buf, phys!.dataOffset + 4);
    const unit = buf[phys!.dataOffset + 8];
    expect(ppmX).toBe(11811); // 300 * 39.3701 rounded
    expect(ppmY).toBe(11811);
    expect(unit).toBe(1); // metres
  });

  it('round-trips 600 DPI', async () => {
    const blob = new Blob([ONE_BY_ONE_PNG], { type: 'image/png' });
    const out = await pngWithDpi(blob, 600);
    const buf = new Uint8Array(await out.arrayBuffer());
    const phys = findChunk(buf, 'pHYs');
    expect(phys).not.toBeNull();
    const ppmX = readUint32(buf, phys!.dataOffset);
    expect(ppmX).toBe(23622); // 600 * 39.3701 rounded
  });

  it('produces a valid PNG (CRC32) — IEND still parseable', async () => {
    const blob = new Blob([ONE_BY_ONE_PNG], { type: 'image/png' });
    const out = await pngWithDpi(blob, 300);
    const buf = new Uint8Array(await out.arrayBuffer());
    const iend = findChunk(buf, 'IEND');
    expect(iend).not.toBeNull();
    expect(iend!.length).toBe(0);
  });

  it('preserves IHDR contents', async () => {
    const blob = new Blob([ONE_BY_ONE_PNG], { type: 'image/png' });
    const out = await pngWithDpi(blob, 300);
    const buf = new Uint8Array(await out.arrayBuffer());
    const ihdr = findChunk(buf, 'IHDR');
    expect(ihdr).not.toBeNull();
    expect(ihdr!.length).toBe(13);
    // Width and height of original (1×1)
    expect(readUint32(buf, ihdr!.dataOffset)).toBe(1);
    expect(readUint32(buf, ihdr!.dataOffset + 4)).toBe(1);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter @protspace/utils test:ci -- --run phys-chunk`
Expected: 4 tests fail with "Cannot find module './phys-chunk'".

- [ ] **Step 3: Implement the writer**

Create `packages/utils/src/png/phys-chunk.ts`:

```ts
/**
 * Inject a `pHYs` chunk into a PNG so it carries the chosen DPI metadata.
 * Standalone, dependency-free implementation — no third-party libs in
 * the export path.
 *
 * PNG layout: 8-byte signature, then chunks of `length(4) | type(4) | data(N) | crc(4)`.
 * The pHYs chunk encodes pixels-per-metre (uint32 X, uint32 Y) and a 1-byte
 * unit specifier (1 = metres). DPI → pixels-per-metre = round(dpi × 39.3701).
 *
 * We insert pHYs immediately after IHDR (always the first chunk) and before
 * the rest. Existing pHYs chunks are removed first so we don't end up with
 * two of them.
 */

const PNG_SIGNATURE_LENGTH = 8;
const INCH_PER_METRE = 39.3700787401575;

const CRC_TABLE: Uint32Array = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(data: Uint8Array): number {
  let crc = 0xffffffff;
  for (let i = 0; i < data.length; i++) {
    crc = CRC_TABLE[(crc ^ data[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function readUint32(buf: Uint8Array, offset: number): number {
  return (
    ((buf[offset] << 24) | (buf[offset + 1] << 16) | (buf[offset + 2] << 8) | buf[offset + 3]) >>> 0
  );
}

function writeUint32(buf: Uint8Array, offset: number, value: number): void {
  buf[offset] = (value >>> 24) & 0xff;
  buf[offset + 1] = (value >>> 16) & 0xff;
  buf[offset + 2] = (value >>> 8) & 0xff;
  buf[offset + 3] = value & 0xff;
}

function buildPhysChunk(dpi: number): Uint8Array {
  const ppm = Math.round(dpi * INCH_PER_METRE);
  const chunk = new Uint8Array(21); // 4 length + 4 type + 9 data + 4 crc
  writeUint32(chunk, 0, 9); // length
  chunk[4] = 0x70; // 'p'
  chunk[5] = 0x48; // 'H'
  chunk[6] = 0x59; // 'Y'
  chunk[7] = 0x73; // 's'
  writeUint32(chunk, 8, ppm); // pixelsPerUnitX
  writeUint32(chunk, 12, ppm); // pixelsPerUnitY
  chunk[16] = 1; // unit = metres
  // CRC over type + data
  writeUint32(chunk, 17, crc32(chunk.slice(4, 17)));
  return chunk;
}

/**
 * Return a new PNG blob carrying the given DPI in its `pHYs` chunk.
 * Existing pHYs chunks (if any) are stripped first.
 */
export async function pngWithDpi(blob: Blob, dpi: number): Promise<Blob> {
  const buf = new Uint8Array(await blob.arrayBuffer());
  if (buf.length < PNG_SIGNATURE_LENGTH) return blob;

  // IHDR is always the first chunk, fixed-size: 4 length + 4 type + 13 data + 4 crc = 25 bytes.
  const ihdrEnd = PNG_SIGNATURE_LENGTH + 25;
  if (ihdrEnd > buf.length) return blob;

  const head = buf.slice(0, ihdrEnd);
  let tail = buf.slice(ihdrEnd);

  // Strip any existing pHYs chunks from the tail.
  let cursor = 0;
  const filtered: Uint8Array[] = [];
  while (cursor < tail.length) {
    if (cursor + 8 > tail.length) {
      filtered.push(tail.slice(cursor));
      break;
    }
    const length = readUint32(tail, cursor);
    const tag = String.fromCharCode(
      tail[cursor + 4],
      tail[cursor + 5],
      tail[cursor + 6],
      tail[cursor + 7],
    );
    const total = 12 + length;
    if (tag !== 'pHYs') {
      filtered.push(tail.slice(cursor, cursor + total));
    }
    cursor += total;
  }
  tail = concat(filtered);

  const phys = buildPhysChunk(dpi);
  return new Blob([head, phys, tail], { type: 'image/png' });
}

function concat(parts: Uint8Array[]): Uint8Array {
  let total = 0;
  for (const p of parts) total += p.length;
  const out = new Uint8Array(total);
  let offset = 0;
  for (const p of parts) {
    out.set(p, offset);
    offset += p.length;
  }
  return out;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter @protspace/utils test:ci -- --run phys-chunk`
Expected: all 4 tests pass.

- [ ] **Step 5: Re-export from utils package**

Edit `packages/utils/src/index.ts`. After the line `export * from './visualization/export-utils';`, add:

```ts
export { pngWithDpi } from './png/phys-chunk';
```

- [ ] **Step 6: Run full utils tests**

Run: `pnpm --filter @protspace/utils test:ci`
Expected: all tests pass.

- [ ] **Step 7: Commit**

```bash
git add packages/utils/src/png packages/utils/src/index.ts
git commit -m "feat(utils): add pngWithDpi for PNG pHYs DPI metadata"
```

---

## Task 6: Rewrite `exportCanvasAsPdf` for mm-aware page size

**Files:**

- Modify: `packages/utils/src/visualization/export-utils.ts`
- Modify: `packages/utils/src/visualization/export-utils.test.ts`
- Modify: `app/src/explore/export-handler.ts` (caller — updated in same commit so builds stay green)

- [ ] **Step 1: Write the failing tests**

Append to `packages/utils/src/visualization/export-utils.test.ts` (after the last `describe(...)` block):

```ts
describe('exportCanvasAsPdf', () => {
  it('uses [widthMm, heightMm] as the page format with no margin', async () => {
    const addImage = vi.fn();
    const setProperties = vi.fn();
    const save = vi.fn();
    const jsPdfCtor = vi.fn().mockImplementation(() => ({ addImage, setProperties, save }));

    vi.doMock('jspdf', () => ({ default: jsPdfCtor }));
    const { exportCanvasAsPdf } = await import('./export-utils');

    // Minimal canvas stub: only toDataURL is exercised.
    const canvas = {
      width: 1051,
      height: 591,
      toDataURL: () => 'data:image/png;base64,AAA=',
    } as unknown as HTMLCanvasElement;

    await exportCanvasAsPdf(canvas, { widthMm: 89, heightMm: 50, filename: 'fig.pdf' });

    expect(jsPdfCtor).toHaveBeenCalledWith(
      expect.objectContaining({
        unit: 'mm',
        format: [89, 50],
        orientation: 'landscape',
      }),
    );
    expect(addImage).toHaveBeenCalledWith('data:image/png;base64,AAA=', 'PNG', 0, 0, 89, 50);
    expect(save).toHaveBeenCalledWith('fig.pdf');
    vi.doUnmock('jspdf');
  });

  it('uses portrait orientation when heightMm > widthMm', async () => {
    const addImage = vi.fn();
    const setProperties = vi.fn();
    const save = vi.fn();
    const jsPdfCtor = vi.fn().mockImplementation(() => ({ addImage, setProperties, save }));

    vi.doMock('jspdf', () => ({ default: jsPdfCtor }));
    const { exportCanvasAsPdf } = await import('./export-utils');

    const canvas = {
      width: 1051,
      height: 2917,
      toDataURL: () => 'data:image/png;base64,AAA=',
    } as unknown as HTMLCanvasElement;

    await exportCanvasAsPdf(canvas, { widthMm: 89, heightMm: 247 });

    expect(jsPdfCtor).toHaveBeenCalledWith(expect.objectContaining({ orientation: 'portrait' }));
    vi.doUnmock('jspdf');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter @protspace/utils test:ci -- --run export-utils`
Expected: 2 new tests fail because the current `exportCanvasAsPdf` takes `(canvas, filename?)`, not the new options object.

- [ ] **Step 3: Rewrite `exportCanvasAsPdf`**

In `packages/utils/src/visualization/export-utils.ts`, replace the existing `exportCanvasAsPdf` function (currently around lines 1009-1041) with:

```ts
/**
 * Export an already-composited canvas as a single-page PDF whose page size
 * is exactly the chosen physical dimensions in mm. Drop into a Word/InDesign
 * placeholder at 100% and the figure lands at the journal's required width.
 */
export async function exportCanvasAsPdf(
  canvas: HTMLCanvasElement,
  opts: { widthMm: number; heightMm: number; filename?: string },
): Promise<void> {
  const { default: jsPDF } = await import('jspdf');
  const imgData = canvas.toDataURL('image/png', 1.0);
  const { widthMm, heightMm, filename } = opts;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pdf: any = new (jsPDF as any)({
    orientation: widthMm > heightMm ? 'landscape' : 'portrait',
    unit: 'mm',
    format: [widthMm, heightMm],
  });
  pdf.setProperties({
    title: 'ProtSpace Figure',
    subject: 'ProtSpace export',
    author: 'ProtSpace',
    creator: 'ProtSpace',
  });
  pdf.addImage(imgData, 'PNG', 0, 0, widthMm, heightMm);
  pdf.save(filename || 'protspace_figure.pdf');
}
```

- [ ] **Step 4: Update the only caller**

Edit `app/src/explore/export-handler.ts`. Find the `publish-export` event handler (around lines 102-125) and change the PDF branch:

```ts
// Old:
// if (state.format === 'pdf') {
//   await exportCanvasAsPdf(canvas, fname);
// }

// New:
if (state.format === 'pdf') {
  const widthMm = (canvas.width * 25.4) / state.dpi;
  const heightMm = (canvas.height * 25.4) / state.dpi;
  await exportCanvasAsPdf(canvas, { widthMm, heightMm, filename: fname });
}
```

The destructured event detail is `{ canvas, state }` and `state.dpi` is part of `PublishState`. Inside the existing type assertion (line 105), `dpi` is already in `PublishState`; widen the inline cast to include it:

```ts
const { canvas, state } = e.detail as {
  canvas: HTMLCanvasElement;
  state: Record<string, unknown> & {
    format: string;
    widthPx: number;
    heightPx: number;
    dpi: number;
  };
};
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `pnpm --filter @protspace/utils test:ci -- --run export-utils`
Expected: all export-utils tests pass.

Run: `pnpm --filter @protspace/app type-check` (verify the caller change compiles)
Expected: clean.

- [ ] **Step 6: Commit**

```bash
git add packages/utils/src/visualization/export-utils.ts packages/utils/src/visualization/export-utils.test.ts app/src/explore/export-handler.ts
git commit -m "feat(export): mm-accurate PDF page size from publish modal"
```

---

## Task 7: Rebuild the Dimensions section UI in publish-modal

**Files:**

- Modify: `packages/core/src/components/publish/publish-modal.ts`
- Modify: `packages/core/src/components/publish/publish-modal.styles.ts`
- Modify: `packages/core/src/components/publish/publish-modal.test.ts`

This is the largest task. The Dimensions section is currently at `publish-modal.ts:701-808` (`_renderDimensionsSection`). We rebuild it from scratch around the new helpers.

- [ ] **Step 1: Write the failing component tests**

Replace the body of `packages/core/src/components/publish/publish-modal.test.ts` with:

```ts
/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach } from 'vitest';
import './publish-modal';
import type { ProtspacePublishModal } from './publish-modal';

interface PublishInternals {
  _state: {
    widthPx: number;
    heightPx: number;
    dpi: number;
    resample: boolean;
    aspectLocked: boolean;
    unit: 'px' | 'mm' | 'in' | 'cm';
    preset: string;
  };
  _legendItems: Array<{ value: string }>;
  _legendTitle: string;
}

function makeModal(): ProtspacePublishModal {
  const modal = document.createElement('protspace-publish-modal') as ProtspacePublishModal;
  document.body.appendChild(modal);
  return modal;
}

describe('<protspace-publish-modal> legend reader', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('reads legend state from legendElement property when provided', async () => {
    const legend = document.createElement('div') as unknown as HTMLElement & {
      getLegendExportData: () => unknown;
    };
    legend.getLegendExportData = () => ({
      annotation: 'family',
      includeShapes: true,
      otherItemsCount: 0,
      items: [{ value: 'A', color: '#fff', shape: 'circle', count: 1, isVisible: true }],
    });

    const modal = makeModal();
    (modal as unknown as { legendElement: HTMLElement }).legendElement = legend;
    await modal.updateComplete;

    const internals = modal as unknown as PublishInternals;
    expect(internals._legendTitle).toBe('family');
    expect(internals._legendItems).toHaveLength(1);
  });
});

describe('<protspace-publish-modal> dimensions section', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('renders width input in mm by default', async () => {
    const modal = makeModal();
    await modal.updateComplete;
    const widthInput = modal.shadowRoot!.querySelector<HTMLInputElement>(
      '[data-publish-input="width"]',
    );
    expect(widthInput).not.toBeNull();
    // Default state is flexible, 2048 px @ 300 dpi → 173.4 mm
    expect(parseFloat(widthInput!.value)).toBeCloseTo(173.4, 0);
  });

  it('typing width-mm with Resample=ON updates widthPx', async () => {
    const modal = makeModal();
    await modal.updateComplete;
    const internals = modal as unknown as PublishInternals;
    const widthInput = modal.shadowRoot!.querySelector<HTMLInputElement>(
      '[data-publish-input="width"]',
    )!;
    widthInput.value = '89';
    widthInput.dispatchEvent(new Event('change'));
    await modal.updateComplete;
    // 89 mm @ 300 dpi = 1051 px
    expect(internals._state.widthPx).toBe(1051);
    expect(internals._state.resample).toBe(true);
  });

  it('toggling Resample=OFF then changing DPI does not change widthPx', async () => {
    const modal = makeModal();
    await modal.updateComplete;
    const internals = modal as unknown as PublishInternals;
    const initialPx = internals._state.widthPx;

    const resampleCb = modal.shadowRoot!.querySelector<HTMLInputElement>(
      '[data-publish-input="resample"]',
    )!;
    resampleCb.checked = false;
    resampleCb.dispatchEvent(new Event('change'));
    await modal.updateComplete;

    const dpiInput = modal.shadowRoot!.querySelector<HTMLInputElement>(
      '[data-publish-input="dpi"]',
    )!;
    dpiInput.value = '600';
    dpiInput.dispatchEvent(new Event('change'));
    await modal.updateComplete;

    expect(internals._state.widthPx).toBe(initialPx);
    expect(internals._state.dpi).toBe(600);
  });

  it('clicking the chain-link icon toggles aspectLocked', async () => {
    const modal = makeModal();
    await modal.updateComplete;
    const internals = modal as unknown as PublishInternals;
    expect(internals._state.aspectLocked).toBe(true);
    const chainBtn = modal.shadowRoot!.querySelector<HTMLButtonElement>(
      '[data-publish-input="aspect-lock"]',
    )!;
    chainBtn.click();
    await modal.updateComplete;
    expect(internals._state.aspectLocked).toBe(false);
  });

  it('clicking a preset while Resample=OFF flips Resample=ON', async () => {
    const modal = makeModal();
    await modal.updateComplete;
    const internals = modal as unknown as PublishInternals;

    // Turn Resample off first.
    const resampleCb = modal.shadowRoot!.querySelector<HTMLInputElement>(
      '[data-publish-input="resample"]',
    )!;
    resampleCb.checked = false;
    resampleCb.dispatchEvent(new Event('change'));
    await modal.updateComplete;
    expect(internals._state.resample).toBe(false);

    // Click Nature 1 col preset.
    const presetBtns = modal.shadowRoot!.querySelectorAll<HTMLButtonElement>('.publish-preset-btn');
    const nature1 = Array.from(presetBtns).find((b) => /Nature.*1 col/i.test(b.textContent ?? ''));
    expect(nature1).not.toBeUndefined();
    nature1!.click();
    await modal.updateComplete;

    expect(internals._state.resample).toBe(true);
    expect(internals._state.preset).toBe('nature-1col');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter @protspace/core test:ci -- --run publish-modal.test`
Expected: 5 new tests fail because the new selectors (`data-publish-input="..."`) don't exist yet.

- [ ] **Step 3: Update the modal helper imports and state-mutation methods**

Edit `packages/core/src/components/publish/publish-modal.ts`. Replace the existing `_updateWidthPx`, `_updateHeightPx`, `_updateDpi` methods (around lines 331-347) with mm-aware versions plus new helpers, and update the helper import (around line 33-40):

Replace:

```ts
import {
  getActivePresetConstraints,
  computeWidthUpdate,
  computeHeightUpdate,
  computeDpiUpdate,
  computePresetApplication,
  shouldShowFingerprintWarning,
} from './publish-modal-helpers';
```

with:

```ts
import {
  computeWidthPxUpdate,
  computeWidthMmUpdate,
  computeHeightPxUpdate,
  computeHeightMmUpdate,
  computeDpiUpdate,
  computePresetApplication,
  shouldShowFingerprintWarning,
} from './publish-modal-helpers';
```

Replace `import { pxToMm, mmToPx } from './dimension-utils';` with:

```ts
import { pxToMm, mmToPx, mmToIn, mmToCm, inToMm, cmToMm } from './dimension-utils';
```

Replace the `_updateWidthPx` / `_updateHeightPx` / `_updateDpi` methods, and remove `_getActivePresetConstraints`:

```ts
  private _updateWidthPx(widthPx: number) {
    this._state = { ...this._state, ...computeWidthPxUpdate(this._state, widthPx) };
    this._plotCacheKey = '';
    this._insetCacheKey = '';
  }

  private _updateWidthMm(widthMm: number) {
    this._state = { ...this._state, ...computeWidthMmUpdate(this._state, widthMm) };
    this._plotCacheKey = '';
    this._insetCacheKey = '';
  }

  private _updateHeightPx(heightPx: number) {
    this._state = { ...this._state, ...computeHeightPxUpdate(this._state, heightPx) };
    this._plotCacheKey = '';
    this._insetCacheKey = '';
  }

  private _updateHeightMm(heightMm: number) {
    this._state = { ...this._state, ...computeHeightMmUpdate(this._state, heightMm) };
    this._plotCacheKey = '';
    this._insetCacheKey = '';
  }

  private _updateDpi(dpi: number) {
    this._state = { ...this._state, ...computeDpiUpdate(this._state, dpi) };
    this._plotCacheKey = '';
    this._insetCacheKey = '';
  }
```

In `_applyPreset` (around lines 349-359), update the patch handling so it carries `resample: true` from the helper, and surface the "preset turned Resample on" note:

```ts
  private _applyPreset(presetId: PresetId) {
    const patch = computePresetApplication(presetId);
    if (!patch) return;
    const wasResampleOff = !this._state.resample;
    this._state = {
      ...this._state,
      ...patch,
      heightPx: patch.heightPx ?? this._state.heightPx,
    };
    this._plotCacheKey = '';
    this._insetCacheKey = '';
    if (wasResampleOff) {
      this._showResampleNote = true;
      // Clear the note on the next state mutation; tracked by a private flag.
    }
  }
```

Add a `@state` field next to the existing ones (around line 107):

```ts
  @state() private _showResampleNote = false;
```

And in `_updateState`, `_updateLegend`, and the various `_update*` methods that change state, append `this._showResampleNote = false;` so the note clears on the next user action. Concretely, add at the end of each helper that mutates `_state`:

```ts
this._showResampleNote = false;
```

(Apply to `_updateState`, `_updateLegend`, `_updateWidthPx`, `_updateWidthMm`, `_updateHeightPx`, `_updateHeightMm`, `_updateDpi`, `_setUnit`, `_toggleResample`, `_toggleAspectLock`.)

Then add the toggle/select helpers:

```ts
  private _toggleResample() {
    this._state = { ...this._state, resample: !this._state.resample };
    this._plotCacheKey = '';
    this._insetCacheKey = '';
    this._showResampleNote = false;
  }

  private _toggleAspectLock() {
    this._state = { ...this._state, aspectLocked: !this._state.aspectLocked };
    this._showResampleNote = false;
  }

  private _setUnit(unit: 'px' | 'mm' | 'in' | 'cm') {
    this._state = { ...this._state, unit };
    this._showResampleNote = false;
  }
```

- [ ] **Step 4: Replace `_renderDimensionsSection`**

Replace the entire method body (around lines 701-808) with:

```ts
  private _renderDimensionsSection() {
    const s = this._state;
    const widthMm = pxToMm(s.widthPx, s.dpi);
    const heightMm = pxToMm(s.heightPx, s.dpi);

    const widthDisplay = this._formatDimensionForUnit(s.widthPx, widthMm, s.unit);
    const heightDisplay = this._formatDimensionForUnit(s.heightPx, heightMm, s.unit);

    const dimsReadOnly = s.unit === 'px' && !s.resample;
    const sizeMb = this._estimatePngSizeMb(s.widthPx, s.heightPx);

    return html`
      <div class="publish-section">
        <div class="publish-section-title">Dimensions</div>

        <div class="publish-dim-readout">
          <div>Image Size: <strong>${sizeMb.toFixed(1)} MB</strong></div>
          <div>
            ${dimsReadOnly ? 'Pixel Dims (locked)' : 'Pixel Dims'}:
            <strong>${s.widthPx} × ${s.heightPx} px</strong>
          </div>
        </div>

        <div class="publish-dim-pair">
          <div class="publish-dim-row">
            <label>Width</label>
            <input
              type="number"
              class="publish-row-input"
              data-publish-input="width"
              ?disabled=${dimsReadOnly}
              .value=${String(widthDisplay)}
              step=${s.unit === 'px' ? '1' : '0.1'}
              @change=${(e: Event) => this._handleWidthChange(e)}
            />
          </div>
          <div class="publish-dim-row">
            <label>Height</label>
            <input
              type="number"
              class="publish-row-input"
              data-publish-input="height"
              ?disabled=${dimsReadOnly}
              .value=${String(heightDisplay)}
              step=${s.unit === 'px' ? '1' : '0.1'}
              @change=${(e: Event) => this._handleHeightChange(e)}
            />
          </div>
          <div class="publish-dim-pair-controls">
            <select
              class="publish-select publish-unit-select"
              data-publish-input="unit"
              .value=${s.unit}
              @change=${(e: Event) => {
                this._setUnit((e.target as HTMLSelectElement).value as PublishState['unit']);
              }}
            >
              <option value="px">px</option>
              <option value="mm">mm</option>
              <option value="in">in</option>
              <option value="cm">cm</option>
            </select>
            <button
              class="publish-aspect-lock ${s.aspectLocked ? 'locked' : ''}"
              data-publish-input="aspect-lock"
              @click=${() => this._toggleAspectLock()}
              title=${s.aspectLocked ? 'Unlink width/height' : 'Link width/height'}
            >
              <svg viewBox="0 0 24 24" width="14" height="14">
                ${s.aspectLocked
                  ? html`<path
                      d="M10 13a5 5 0 007 0l3-3a5 5 0 00-7-7l-1 1m-2 8a5 5 0 01-7 0l-3-3a5 5 0 017-7l1 1"
                    />`
                  : html`<path d="M9 11l-2 2-3-3a5 5 0 017-7l3 3M15 13l2-2 3 3a5 5 0 01-7 7l-3-3" />`}
              </svg>
            </button>
          </div>
        </div>

        <div class="publish-dim-row">
          <label>Resolution</label>
          <input
            type="number"
            class="publish-row-input"
            data-publish-input="dpi"
            min="1"
            max="2400"
            .value=${String(s.dpi)}
            @change=${(e: Event) => {
              this._updateDpi(parseInt((e.target as HTMLInputElement).value) || s.dpi);
            }}
          />
          <span class="publish-unit">Pixels/Inch</span>
        </div>

        <label class="publish-checkbox-label">
          <input
            type="checkbox"
            class="publish-checkbox"
            data-publish-input="resample"
            .checked=${s.resample}
            @change=${() => this._toggleResample()}
          />
          Resample
          <span class="publish-info" title=${RESAMPLE_TOOLTIP}>ⓘ</span>
        </label>
        ${this._showResampleNote
          ? html`<div class="publish-resample-note">Resample turned on to apply preset.</div>`
          : nothing}
      </div>
    `;
  }

  private _handleWidthChange(e: Event) {
    const value = parseFloat((e.target as HTMLInputElement).value);
    if (!Number.isFinite(value) || value <= 0) return;
    if (this._state.unit === 'px') {
      this._updateWidthPx(Math.round(value));
    } else {
      const mm = this._unitToMm(value, this._state.unit);
      this._updateWidthMm(mm);
    }
  }

  private _handleHeightChange(e: Event) {
    const value = parseFloat((e.target as HTMLInputElement).value);
    if (!Number.isFinite(value) || value <= 0) return;
    if (this._state.unit === 'px') {
      this._updateHeightPx(Math.round(value));
    } else {
      const mm = this._unitToMm(value, this._state.unit);
      this._updateHeightMm(mm);
    }
  }

  private _unitToMm(value: number, unit: 'px' | 'mm' | 'in' | 'cm'): number {
    if (unit === 'mm') return value;
    if (unit === 'in') return inToMm(value);
    if (unit === 'cm') return cmToMm(value);
    return value; // px branch unreachable here
  }

  private _formatDimensionForUnit(
    px: number,
    mm: number,
    unit: 'px' | 'mm' | 'in' | 'cm',
  ): string {
    if (unit === 'px') return String(px);
    if (unit === 'mm') return mm.toFixed(1);
    if (unit === 'in') return mmToIn(mm).toFixed(2);
    return mmToCm(mm).toFixed(2);
  }

  private _estimatePngSizeMb(widthPx: number, heightPx: number): number {
    // Rough heuristic: 32-bit RGBA × ~0.4 typical PNG compression.
    return (widthPx * heightPx * 4 * 0.4) / (1024 * 1024);
  }
```

Add a module-level constant near the top of the file (just below the imports):

```ts
const RESAMPLE_TOOLTIP =
  'When on, changing the resolution re-renders the figure at a new pixel count. ' +
  'When off, only print-size metadata changes — pixels stay the same.';
```

- [ ] **Step 5: Add CSS for the new layout**

Edit `packages/core/src/components/publish/publish-modal.styles.ts`. Append the following blocks just before the closing backtick of the styles template (search for the last `}` before the closing template literal):

```css
.publish-dim-readout {
  font-size: var(--text-xs);
  color: var(--muted);
  margin-bottom: 6px;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.publish-dim-readout strong {
  color: var(--fg);
}

.publish-dim-pair {
  display: grid;
  grid-template-columns: 1fr 1fr auto;
  align-items: end;
  gap: 6px 8px;
  margin-bottom: 6px;
}

.publish-dim-pair-controls {
  display: flex;
  flex-direction: column;
  gap: 4px;
  align-items: center;
}

.publish-unit-select {
  width: 60px;
  font-size: var(--text-xs);
}

.publish-aspect-lock {
  background: transparent;
  border: 1px solid var(--border);
  border-radius: 3px;
  cursor: pointer;
  padding: 2px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.publish-aspect-lock svg {
  fill: none;
  stroke: var(--muted);
  stroke-width: 2;
}

.publish-aspect-lock.locked svg {
  stroke: var(--accent, #3b82f6);
}

.publish-dim-row {
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.publish-dim-row label {
  font-size: var(--text-xs);
  color: var(--muted);
}

.publish-info {
  cursor: help;
  margin-left: 4px;
  color: var(--muted);
}

.publish-resample-note {
  font-size: var(--text-xs);
  color: var(--accent, #3b82f6);
  margin-top: 4px;
}
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `pnpm --filter @protspace/core test:ci -- --run publish-modal`
Expected: all 6 tests pass (1 existing + 5 new).

- [ ] **Step 7: Run the full core test suite to catch regressions**

Run: `pnpm --filter @protspace/core test:ci`
Expected: all tests pass.

- [ ] **Step 8: Commit**

```bash
git add packages/core/src/components/publish/publish-modal.ts packages/core/src/components/publish/publish-modal.styles.ts packages/core/src/components/publish/publish-modal.test.ts
git commit -m "feat(publish): Photoshop-style Dimensions panel with Resample toggle"
```

---

## Task 8: Wire `pngWithDpi` into the PNG export path

**Files:**

- Modify: `app/src/explore/export-handler.ts`

- [ ] **Step 1: Update the publish-export PNG branch**

Edit `app/src/explore/export-handler.ts`. The current PNG branch in the `publish-export` handler (around lines 113-118) uses `canvas.toDataURL('image/png')`. Replace it with a `toBlob` → `pngWithDpi` → object-URL pipeline.

Update the import at the top of the file:

```ts
import {
  createExporter,
  exportCanvasAsPdf,
  exportParquetBundle,
  generateBundleFilename,
  pngWithDpi,
} from '@protspace/utils';
```

Replace the entire `if (state.format === 'pdf') { ... } else { ... }` block inside the publish-export handler with:

```ts
if (state.format === 'pdf') {
  const widthMm = (canvas.width * 25.4) / state.dpi;
  const heightMm = (canvas.height * 25.4) / state.dpi;
  await exportCanvasAsPdf(canvas, { widthMm, heightMm, filename: fname });
} else {
  const blob: Blob = await new Promise((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error('canvas.toBlob produced no blob'))),
      'image/png',
    );
  });
  const withDpi = await pngWithDpi(blob, state.dpi);
  const url = URL.createObjectURL(withDpi);
  try {
    downloadFile(url, fname);
  } finally {
    URL.revokeObjectURL(url);
  }
}
```

- [ ] **Step 2: Type-check**

Run: `pnpm --filter @protspace/app type-check`
Expected: clean.

- [ ] **Step 3: Run all tests**

Run: `pnpm test:ci`
Expected: all tests pass.

- [ ] **Step 4: Commit**

```bash
git add app/src/explore/export-handler.ts
git commit -m "feat(export): inject pHYs DPI into figure-editor PNG output"
```

---

## Task 9: Manual browser verification on the default dataset

This is a manual checklist. The figure editor needs eyes-on verification — unit tests don't catch visual regressions or that the OS-level image dimensions actually update.

- [ ] **Step 1: Run precommit one final time**

Run: `pnpm precommit`
Expected: clean. Format/lint/type/test/docs all pass.

- [ ] **Step 2: Start the dev server**

Run: `pnpm dev`
Expected: app on `http://localhost:8080`, default dataset (`app/public/data.parquetbundle`) loads.

- [ ] **Step 3: Open the Figure Editor and exercise the new controls**

In the browser:

1. Click _Figure Editor_ in the control bar.
2. Confirm the Dimensions section now shows: _Image Size_, _Pixel Dims_, Width / Height with a unit dropdown and chain-link icon, Resolution, and a Resample checkbox.
3. With default state (Flexible / 2048×1024 / 300 DPI / Resample ON), confirm the Width input reads ~173.4 mm.

- [ ] **Step 4: Verify DPI actually changes pixels in Flexible mode**

1. Bump _Resolution_ from 300 → 600.
2. Confirm _Pixel Dims_ readout now shows 4096 × 2048 (or close), preview updates and looks crisper.
3. Drop back to 300; pixels return to 2048 × 1024.

- [ ] **Step 5: Verify Resample=OFF freezes pixels**

1. Uncheck Resample.
2. Confirm _Pixel Dims (locked)_ label appears, the Width/Height inputs grey out when unit=px.
3. Switch unit to mm. Confirm Width/Height become editable; inputs show ~173.4 / ~86.7.
4. Bump Resolution to 600. Confirm _Pixel Dims_ unchanged (2048 × 1024); Width/Height now read ~86.7 / ~43.3 mm.

- [ ] **Step 6: Verify journal preset → forces Resample ON**

1. With Resample OFF, click _Nature · 1 col_.
2. Confirm Resample auto-flips to ON.
3. Inline note appears: _"Resample turned on to apply preset."_
4. Width reads 89 mm, DPI reads 300, Pixel Dims read ~1051 px wide.

- [ ] **Step 7: Verify PNG export carries DPI metadata**

1. With Nature 1 col preset, DPI 600, click _Export PNG_.
2. Open the downloaded file in macOS Preview.
3. _Tools → Show Inspector → ⓘ tab_: confirm DPI (X/Y) reads 600, dimensions show 89.0 × ~50 mm (not the pixel dims).

- [ ] **Step 8: Verify PDF export uses mm page size**

1. Switch format to PDF, click _Export PDF_.
2. Open the file in Preview.
3. _Tools → Show Inspector → ⓘ tab_: page size reads ~89 × ~50 mm — **not** A4.

- [ ] **Step 9: Verify chain-link aspect ratio**

1. With aspect lock ON (chain icon highlighted), edit Width to 100 mm. Confirm Height auto-rescales proportionally.
2. Click chain icon to unlock; edit Width to 150 mm; Height stays put.

- [ ] **Step 10: Smoke check the rest of the modal**

Quickly confirm overlays (circle, arrow, label) and zoom insets still draw and export correctly with the new state shape — they shouldn't be touched by this work, but it's worth a 60-second sanity pass.

- [ ] **Step 11: Final commit if any docs or polish landed**

If anything was tweaked during manual verification, commit it. Otherwise nothing to commit here.

```bash
# Only run if there are changes from manual fixes
git status
```

---

## Done criteria

- [ ] All unit, component, and integration tests pass (`pnpm precommit`).
- [ ] Manual verification checklist (Task 9) all green on the default dataset.
- [ ] PNG exports declare the chosen DPI in their `pHYs` chunk (verified in Preview).
- [ ] PDF exports have a page size in mm matching the chosen figure size (verified in Preview).
- [ ] Resample toggle behaves per the spec algebra table.
- [ ] All commits land cleanly on the `feat/publish-editor` branch.
