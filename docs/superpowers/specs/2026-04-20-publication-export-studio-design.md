# Publication Export Studio — Design Spec

**Date:** 2026-04-20
**Status:** Draft
**PR #224 dependency:** Builds on t03i's `feature(export): add publication ready export` (branch `t03i/issue177`)

## Overview

Add publication-quality figure composition tools to ProtSpace: inline canvas annotations (indicator arrows, insets) during exploration, and an Export Studio modal for final figure composition with layout presets, legend tuning, and WYSIWYG preview.

**Workflow model:** Hybrid — annotate on the canvas while exploring, open Export Studio to compose and export.

## Features

### 1. Right-Click Context Menu

A context menu on the scatterplot canvas triggered by the `contextmenu` event.

**On a point:**
| Action | Behavior |
|--------|----------|
| Indicate | Places an indicator arrow at the point |
| Select | Adds point to current selection (additive) |
| Copy ID | Copies protein ID to clipboard, shows toast via `notify` |
| View in UniProt | Opens UniProt page in new tab. Disabled if no accession |

**On empty space:**
| Action | Behavior |
|--------|----------|
| Add inset here | Enters inset framing mode centered on click position |

Inset framing is also accessible from the control bar toolbar (button next to selection tools) for discoverability.

Hit-testing uses the existing `QuadtreeIndex` to resolve which point (if any) is under the cursor.

Dismissed by: click outside, `Esc`, scroll.

### 2. Indicator Arrows

Black arrows on the scatter canvas that point at specific proteins. They persist during exploration and carry into the Export Studio.

**Rendering:**

- DOM elements in a dedicated overlay layer (not WebGL) — this makes them zoom-invariant
- Black shaft (2px) + triangular head pointing at the target point
- Label above the arrow (defaults to protein ID)

**State model:**

```typescript
interface Indicator {
  id: string;
  proteinId: string;
  label: string; // defaults to proteinId, editable via double-click
  dataCoords: [number, number]; // position in data space
  offsetPx: [number, number]; // drag offset from point (shaft moves, head stays aimed)
}
```

**Interactions:**

- Created via right-click → Indicate
- Drag to adjust offset (head stays pointing at original data coords)
- Double-click label to edit text inline
- `Del` removes focused indicator
- Arrows reposition on zoom/pan (following data coords) but stay the same pixel size

**At export time:** Arrows are rendered onto the composition canvas at fixed pixel sizes proportional to figure dimensions, not to zoom level.

### 3. Inset Tool

Three-step workflow: **Frame → Snap → Position**.

#### Step 1: Frame

- Activated via right-click → "Add inset here" or keyboard shortcut `I`
- Main canvas zoom/pan is temporarily hijacked for framing
- User scrolls to zoom into the region of interest, drags to pan
- The viewport itself defines the capture boundary
- Status badge shows "FRAMING" state
- `Enter` or "Snap" button to proceed, `Esc` to cancel

#### Step 2: Snap

- Captures current WebGL canvas via `captureAtResolution()`
- Locks the inset content
- Restores main canvas to its pre-framing zoom/pan state
- Inset appears as a draggable DOM element overlaying the canvas
- Status badge shows "SNAPPED ✓"

#### Step 3: Position

- Drag inset anywhere on the scatter area
- Corner handle to resize (aspect ratio locked)
- Dashed connector lines auto-drawn from source region to inset
- `Enter` to confirm, `Esc` to cancel
- Shape toggle available: rectangle or circle

**State model:**

```typescript
interface Inset {
  id: string;
  sourceTransform: { x: number; y: number; scale: number };
  capturedCanvas: HTMLCanvasElement;
  position: { x: number; y: number }; // 0–1 normalized
  size: { width: number; height: number }; // 0–1 normalized
  shape: 'rectangle' | 'circle';
  label?: string;
  zoomFactor: number;
}
```

**At export time:** `sourceTransform` is used to re-render the inset at export DPI (via `captureAtResolution()` with the stored transform) rather than using the screen-resolution capture. Connector lines are drawn on the composition canvas.

### 4. Export Studio

A modal dialog opened from the control bar. Inherits all annotations (indicators + insets) from the canvas.

#### Layout

- **Left:** Live preview canvas showing the composed figure at actual proportions. Checkerboard background outside figure bounds.
- **Right:** Controls panel (~280px), scrollable.

#### Controls (top to bottom)

**Layout Preset:**
Grid of preset buttons + freeform option.

- 7 presets from PR #224's `FIGURE_LAYOUTS` (single-column through full-page)
- "Native" — exports at current screen pixel dimensions
- "Freeform" — custom width × height via sliders (replaces current export approach)

**Legend:**

- Toggle on/off
- Placement: right / below / top / none
- Width % slider (10–50%)
- Font scale slider
- Column count selector
- All controls update preview live — this solves the "legend blocking" problem

**Indicators:**

- List of all indicators from canvas
- Per-indicator: label, visibility toggle, delete
- No add/edit here — that happens on the canvas

**Insets:**

- List of all insets from canvas
- Per-inset: shape toggle (rectangle/circle), label, delete
- Insets are repositionable by dragging directly on the preview

**Output:**

- Background color picker
- DPI: 150 / 300 / 600
- Format: PNG / PDF

**Action buttons:**

- Primary: "Download PNG"
- Secondary: "PDF"

#### Preview rendering

The preview is a re-render, not a screenshot. Pipeline:

1. `captureAtResolution()` with layout dimensions for the scatter
2. `drawPublicationLegend()` (PR #224) for the legend
3. Re-capture insets at export DPI from stored `sourceTransform`
4. Draw indicator arrows at fixed sizes relative to figure dimensions
5. Composite all layers via `composePublicationFigureRaster()` (extended)

Preview updates live as controls change. Debounced to avoid excessive re-renders.

## Component Architecture

### New Lit Components (`packages/core/src/components/`)

| File                              | Element                       | Renders in                        | Purpose                      |
| --------------------------------- | ----------------------------- | --------------------------------- | ---------------------------- |
| `scatter-plot/context-menu.ts`    | `<protspace-context-menu>`    | scatter-plot shadow DOM           | Right-click menu             |
| `scatter-plot/indicator-layer.ts` | `<protspace-indicator-layer>` | scatter-plot shadow DOM (overlay) | Zoom-invariant arrows        |
| `scatter-plot/inset-tool.ts`      | `<protspace-inset-tool>`      | scatter-plot shadow DOM (overlay) | Frame→snap→position workflow |
| `export-studio/export-studio.ts`  | `<protspace-export-studio>`   | Top-level (modal dialog)          | Preview + controls           |

### New Controller (`app/src/explore/`)

**`annotation-controller.ts`** — factory function (same pattern as `interaction-controller.ts`):

- Manages `Indicator[]` and `Inset[]` state
- Handles events from context menu, indicator layer, inset tool
- Bridges canvas annotations ↔ Export Studio
- Serializable snapshot for parquet bundle persistence (matching PR #224's settings pattern)

### Changes to existing files

| File                          | Change                                                                                                                           |
| ----------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `scatter-plot.ts`             | Add `contextmenu` event forwarding, expose `hitTest(x, y): PlotDataPoint \| null`, render 3 new child components in `render()`   |
| `runtime.ts`                  | Create annotation controller, wire new events, pass to export handler                                                            |
| `export-handler.ts`           | Accept annotation state, pass to Export Studio instead of direct export                                                          |
| PR #224 `publication-export/` | Extend `composePublicationFigureRaster()` to composite insets + indicators. Add Native and Freeform presets alongside existing 7 |

### Data flow

```
Right-click point → scatter-plot contextmenu event
  → <protspace-context-menu> resolves hit via hitTest()
  → User clicks action
  → CustomEvent dispatched (e.g. 'add-indicator', 'add-to-selection')
  → annotation-controller updates state
  → <protspace-indicator-layer> / <protspace-inset-tool> re-renders
  → Export Studio reads same state for composition
```

### Cross-component communication

All via CustomEvents, consistent with the existing codebase:

- `'add-indicator'` — from context menu
- `'remove-indicator'` — from indicator layer or Export Studio
- `'inset-frame-start'` — from context menu
- `'inset-snapped'` — from inset tool
- `'inset-positioned'` — from inset tool
- `'open-export-studio'` — from control bar
- `'export-studio-download'` — from Export Studio

## Styling Constraints

**Hard rule:** No new design system, no custom palette, no ad-hoc styling.

- Reuse existing Lit component styles (CSS custom properties, dark theme tokens)
- Modal/dialog: follow the pattern from legend "Other" dialog and settings dialog
- Buttons, toggles, sliders: extract from control-bar and legend settings
- Sections/panels: match legend panel layout patterns
- Icons: inline SVG, same as control bar
- Toast notifications: use existing `notify` utility from `app/src/lib/notify.ts`
- Radix UI primitives where already used (tooltips, selects)
- Tailwind utilities only in the React layer (Explore.tsx), not in Lit components

## Integration with PR #224

This spec builds on and extends PR #224's publication export module. Strategy:

1. **Adopt as-is:** `FIGURE_LAYOUTS`, `computePublicationLayout()`, `drawPublicationLegend()`, `captureScatterForLayout()`, typography utilities, legend model building
2. **Extend:** `composePublicationFigureRaster()` gains an optional `annotations` parameter containing indicators and insets to composite onto the figure
3. **Add:** Native preset (screen dimensions) and Freeform mode (custom dimensions) alongside the existing 7 layout presets
4. **Replace:** The current direct-export flow in `export-handler.ts` routes through the Export Studio modal instead of immediately downloading

PR #224 should be merged first (or rebased onto) before this work begins. The Export Studio replaces the simple "Export" button with a richer workflow while preserving the ability to do a quick export for users who don't need annotations.

## Development Approach

**Tests before functions.** Every new component and controller gets its test file written first. Tests define the expected behavior, then implementation follows to satisfy them. This applies to all new code: context menu hit-testing, indicator state management, inset lifecycle, Export Studio composition, and annotation controller event handling.

## Out of scope

- 3D insets (only 2D scatter capture for now)
- Annotation persistence across sessions (future: save in parquet bundle)
- Collaborative annotations
- Custom arrow styles (color, thickness) — always black, always 2px
- Text annotations beyond indicator labels
