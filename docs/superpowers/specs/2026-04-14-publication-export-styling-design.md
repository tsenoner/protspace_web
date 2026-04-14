# Publication Export Styling Fix — Design Spec

**Date:** 2026-04-14  
**Branch:** t03i/issue177  
**Status:** Approved

---

## Problem Statement

The publication export pipeline produces figures with several styling defects:

1. **Single-column legend squished** — symbols too large, font fills full cell height, no inter-cell breathing room
2. **Line-break misalignment** — symbol aligns to cell center rather than first text line; intra-label line spacing too loose; inter-cell gap too tight
3. **Fixed 4/3 scatter viewport** — all layouts hard-code `scatterAspect: 4/3` regardless of the user's actual viewport geometry
4. **Count numbers too dominant** — same weight and color as labels, visually competing instead of subordinate
5. **Blurred elements pixelated** — deselected points rendered as low-alpha colored dots; at 300 DPI this looks pixelated rather than desaturated
6. **No scatter-only export** — there is no layout that exports just the scatter plot without a legend

---

## Approach

**Approach B — Centralized styling constants + targeted structural fixes.**

All visual proportion constants are extracted into a single `publication-style.ts` module. Structural fixes (viewport aspect, desaturation, scatter-only layouts) are threaded through existing interfaces with minimal surface-area changes. No per-layout style overrides (over-engineering) and no scattered inline constants (hard to tune).

---

## Section 1: Styling Constants Module

**New file:** `packages/utils/src/visualization/publication-export/publication-style.ts`

Owns all visual proportion constants. `legend-canvas.ts` imports from here and removes its inline multipliers.

```ts
// Symbol and cell geometry
export const SYMBOL_TO_BODY_RATIO = 0.8; // was 1.15 — symbols were oversized
export const SYMBOL_PAD_RATIO = 0.4; // horizontal pad around symbol
export const LABEL_GAP_RATIO = 0.45; // gap between symbol and label text
export const CELL_GAP_RATIO = 0.2; // fraction of cellH reserved as inter-item whitespace
// text+symbol occupy (1 - CELL_GAP_RATIO) of cellH

// Multi-line label spacing
export const LINE_HEIGHT_RATIO = 1.08; // was 1.15 — tighter intra-label line spacing

// Count annotation (subordinate styling)
export const COUNT_SIZE_RATIO = 0.75; // relative to bodyPx
export const COUNT_FONT_WEIGHT = 300; // was 500
export const COUNT_COLOR = '#9ca3af'; // was '#4b5563'

// Desaturation for publication capture
export const PUBLICATION_DESAT_FACTOR = 0.75; // unselected points: 25% original hue retained
```

---

## Section 2: Legend Cell Layout and Alignment Fixes

**File:** `packages/utils/src/visualization/publication-export/legend-canvas.ts`

### Symbol alignment

Symbol `cy` moves from cell-center to align with the vertical midpoint of line 1:

```
activeTop = cellY + cellH * (CELL_GAP_RATIO / 2)
cy        = activeTop + lineHeight / 2   // symbol centers on first line
```

For 1-line labels: symbol and text are effectively centered in the active area.  
For 2-line labels: symbol sits beside line 1; line 2 hangs below with `LINE_HEIGHT_RATIO` spacing.

### Cell breathing room

Text and symbol are constrained to `activeH = cellH * (1 - CELL_GAP_RATIO)`. The remaining fraction sits as whitespace between rows automatically — no geometry change needed beyond the `activeTop` offset.

### Count styling

Drawn at `bodyPx * COUNT_SIZE_RATIO`, weight `COUNT_FONT_WEIGHT`, color `COUNT_COLOR`. Position (right-aligned) unchanged.

### Remove `ctx.scale(0.9, 1)`

This horizontal squeeze was a workaround for wide labels. `labelMaxWidth` clamping already handles overflow; the scale distorts print output and shifts perceived label position. Remove it.

---

## Section 3: Dynamic Scatter Aspect Ratio

**Files:** `layout.ts`, `export-publication.ts`, `presets.ts`, `app/src/explore/publication-export-bridge.ts`

### Interface changes

`PublicationExportRequest` gains:

```ts
viewportAspect?: number   // clientWidth / clientHeight of the WebGL element at export time
```

`computePublicationLayout(layout, viewportAspect?)` uses the passed ratio when present; falls back to `layout.scatterAspect` when absent (backward-compatible).

### App-side

`publication-export-bridge.ts` reads `element.clientWidth / element.clientHeight` from the scatter DOM element and passes it as `viewportAspect`.

### What does not change

The scatter capture path (`captureAtResolution`) is unchanged. The dynamic aspect only determines the `scatterMm` bounding box dimensions; capture then renders the current view into that box.

---

## Section 4: Deselected Point Desaturation

**Files:** `scatter-capture.ts`, `webgl-renderer.ts` (fragment shader + capture method)

### Shader change

Add uniform `u_desatFactor` (float 0–1) to the point fragment shader:

```glsl
if (v_color.a < 0.5) {  // unselected point
  float luma = dot(finalColor, vec3(0.299, 0.587, 0.114));
  finalColor = mix(finalColor, vec3(luma), u_desatFactor);
}
```

- Normal rendering: `u_desatFactor = 0.0` (no behavior change)
- Publication export: `u_desatFactor = PUBLICATION_DESAT_FACTOR` (0.75 — faded color, 25% hue retained)

### Interface changes

`ScatterCaptureOptions` gains `desaturateUnselected?: boolean`.  
`ScatterplotCaptureElement.captureAtResolution` options gain `desaturateUnselected?: boolean`.  
`captureScatterForLayout` passes `desaturateUnselected: true` unconditionally for all publication exports.

### What does not change

Two-pass rendering, alpha values, blend modes — untouched. The uniform affects color only.

---

## Section 5: Scatter-Only Layout Presets

**Files:** `presets.ts`, `layout.ts`, `figure-composer.ts`

### New layout IDs

```ts
'one_column_scatter_only'; // 88 mm wide
'two_column_scatter_only'; // 178 mm wide
'full_page_scatter_only'; // 180 mm wide
```

### `LegendPlacement` extended

```ts
export type LegendPlacement = 'top' | 'right' | 'below' | 'none';
```

### Preset shape

```ts
one_column_scatter_only: {
  widthMm: 88, heightMm: 66, paddingMm: 2,
  legendBandMm: 0, scatterAspect: 4/3,   // fallback only
  legend: { placement: 'none', columns: 0 },
},
```

`heightMm` in the preset is a fallback. When `viewportAspect` is provided and `placement === 'none'`, `computePublicationLayout` derives `heightMm` dynamically from `widthMm / viewportAspect` so the figure height matches the scatter content exactly.

### `computePublicationLayout`

New branch for `placement === 'none'`:

- Scatter fills entire inner area
- `legendMm` is a zero-size rect (does not affect compositing)

### `figure-composer.ts`

No change needed. When `legendMm` is zero-size, `ctx.clip()` clips to an empty region and `legendDrawer` produces no visible output — the existing code handles this correctly.

---

## File Change Summary

| File                           | Change                                                                                   |
| ------------------------------ | ---------------------------------------------------------------------------------------- |
| `publication-style.ts`         | **New** — all styling constants                                                          |
| `legend-canvas.ts`             | Import constants; fix symbol align; fix cell gap; fix count styling; remove scale(0.9,1) |
| `presets.ts`                   | Add 3 scatter-only IDs; extend `LegendPlacement` with `'none'`                           |
| `layout.ts`                    | Accept `viewportAspect?`; handle `placement === 'none'`; derive height dynamically       |
| `export-publication.ts`        | Thread `viewportAspect` and `desaturateUnselected`                                       |
| `scatter-capture.ts`           | Add `desaturateUnselected` to `ScatterCaptureOptions`                                    |
| `webgl-renderer.ts`            | Add `u_desatFactor` uniform to shader; wire through `captureAtResolution`                |
| `publication-export-bridge.ts` | Read viewport dimensions; pass `viewportAspect`                                          |

---

## Out of Scope

- Per-layout independent styling overrides (no `legendStyle` sub-object on `FigureLayout`)
- Changes to PDF output geometry or DPI handling
- Any changes to the interactive legend component
