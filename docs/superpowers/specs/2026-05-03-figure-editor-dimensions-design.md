# Figure Editor — Dimensions panel rework

**Date:** 2026-05-03
**Scope:** `packages/core/src/components/publish/`, `packages/utils/src/visualization/export-utils.ts`, new `packages/utils/src/png/phys-chunk.ts`.

## Motivation

Users report that turning up the DPI slider in the Figure Editor produces no visible quality improvement. Root-cause analysis surfaced three real defects plus a UX gap:

1. **In Flexible / Custom mode, DPI is purely metadata.** `computeDpiUpdate` (`publish-modal-helpers.ts:47-57`) only recomputes `widthPx` for journal-preset mode. The default opening state is Flexible (`publish-state.ts:135`), so the first thing most users try — moving the DPI slider — has zero effect on output pixels.
2. **The exported PNG advertises 96 DPI regardless of the chosen value.** `canvas.toDataURL('image/png')` writes 96 ppi by spec. Word and InDesign rescale the image to its declared print size, so a "300 DPI" figure lands ~3× too large in a journal column.
3. **The exported PDF ignores the chosen mm width.** `exportCanvasAsPdf` (`export-utils.ts:1013-1041`) always fits the canvas to A4. Picking "Nature · 1 col (89 mm)" produces a ~206 mm-wide image — completely useless for journal placement.
4. **The dimensions panel doesn't make the px-vs-mm-vs-DPI relationship legible.** Users can't tell which knob actually changes pixels and which changes only metadata.

The fix is to (a) adopt the Photoshop "Image Size" mental model with an explicit `Resample` toggle, (b) embed real DPI in PNG output, and (c) make the PDF page size match the chosen physical width.

## Goals

- Picking a journal preset and bumping DPI re-renders the figure at proportionally more pixels — every time, in every mode.
- Exported PNGs declare the chosen DPI in their `pHYs` chunk, so InDesign/Word place them at the correct physical size.
- Exported PDFs are single-page documents whose page size _is_ the chosen figure size in mm — drop into a placeholder at 100 % and it lands correctly.
- The dimensions panel mirrors Photoshop's Image Size dialog closely enough to be self-explanatory to scientists who already know that tool.

## Non-goals

- Backwards compatibility with previously-saved `publishState` blobs in localStorage or `.parquetbundle` files. The schema changes; old blobs are sanitised to defaults.
- Reworking the legacy export path (`app/src/explore/export-handler.ts:160-228`, the plain control-bar Export buttons). Only the publish-modal export pipeline is rewired.
- A bicubic-vs-nearest-neighbour resampling-method dropdown. Our renderer is WebGL-native, so "Resample" means "re-render at new pixel count" — interpolation choices don't apply.

## Architecture and state shape

All UI changes live in `packages/core/src/components/publish/`. Bug-fix touch list:

- `publish-state.ts`, `publish-state-validator.ts` — three new fields, defaulted in the sanitiser.
- `publish-modal-helpers.ts` — Resample-aware update functions; preset application forces `resample = true`.
- `publish-modal.ts` — rewired Dimensions section; new chain-link icon, unit selector, Resample checkbox.
- `packages/utils/src/visualization/export-utils.ts:exportCanvasAsPdf` — new signature accepting explicit mm dimensions.
- `app/src/explore/export-handler.ts` — passes mm dims through to PDF export, swaps `toDataURL` for `toBlob → pngWithDpi` for PNG.
- New `packages/utils/src/png/phys-chunk.ts` (~50 lines, no dependencies).

### New `PublishState` fields

```ts
resample: boolean; // default true
aspectLocked: boolean; // default true (chain-link engaged)
unit: 'px' | 'mm' | 'in' | 'cm'; // default 'mm', display-only
```

### Algebra

One ground truth: `widthPx = widthMm × dpi / 25.4`. The Resample toggle decides which axis the equation resolves around when the user changes a value.

| User changes         | Resample = ON                                | Resample = OFF                                |
| -------------------- | -------------------------------------------- | --------------------------------------------- |
| Width in mm/in/cm    | recompute `widthPx`; `dpi` fixed             | recompute `dpi`; `widthPx` locked             |
| Width in px          | recompute `widthMm`; `dpi` fixed             | input is read-only (px locked)                |
| Height (mm/in/cm/px) | symmetric to Width, gated by `aspectLocked`  | symmetric                                     |
| Resolution (DPI)     | recompute `widthPx` and `heightPx`; mm fixed | recompute `widthMm` and `heightMm`; px locked |
| Toggle Resample      | no recompute                                 | no recompute                                  |
| Toggle aspect-lock   | no recompute on toggle                       |

When `unit = 'px'` and Resample = OFF, the Width/Height inputs are disabled (the user can still read them but not edit). This matches Photoshop's behaviour and is the only consistent interpretation of "pixels locked".

UI display values: mm/in/cm to one decimal, dpi to integer, px to integer. Internal state stores precise floats so back-to-back conversions don't drift.

## UI layout

The journal-preset grid stays as the headline action at the top of the sidebar. Below it, the Dimensions section is replaced wholesale:

```
┌─ Dimensions ─────────────────────────────────────┐
│  Image Size: 4.2 MB             ⓘ                │
│  Pixel Dims: 1051 × 591 px                       │
│                                                  │
│  ┌─ Width  [ 89.0 ]  [ mm ▾ ]  ┐                 │
│  │                              │  ⛓             │
│  └─ Height [ 50.1 ]  [ mm ▾ ]  ┘                 │
│                                                  │
│  Resolution: [ 300 ]  [ Pixels/Inch ▾ ]          │
│                                                  │
│  ☑ Resample  ⓘ                                   │
└──────────────────────────────────────────────────┘
```

- **Image Size** (top, informational): estimated PNG size as `widthPx × heightPx × 4 bytes / 1024² × 0.4` (compression heuristic), to one decimal MB.
- **Pixel Dims** (top, informational): always in `px` regardless of the Width/Height unit selector — this is the contract with the printer. With Resample = OFF, label becomes _Pixel Dims (locked)_.
- **Width / Height**: numeric inputs sharing one unit dropdown (`px / mm / in / cm`), with a Lit-rendered chain-link SVG to the right that toggles `aspectLocked`. Sliders are removed — Photoshop has none and they encourage random scrubbing.
- **Resolution**: numeric input + unit dropdown (`Pixels/Inch | Pixels/Centimeter`).
- **Resample**: checkbox plus info icon. Tooltip: _"When on, changing the resolution re-renders the figure at a new pixel count. When off, only print-size metadata changes — pixels stay the same."_
- The legend section's sliders (size %, font, columns) stay; sliders only disappear from dimension inputs.

## Interaction model

Each input maps to one pure helper that returns a `Partial<PublishState>` patch (today's pattern). All math goes through `widthPx = widthMm × dpi / 25.4`.

**Aspect lock.** When `aspectLocked = true`, edits preserve the _current_ `widthPx / heightPx` ratio computed at the moment of the edit. We do not persist a target ratio — toggling lock off, freely resizing, and toggling lock back on snaps the new ratio.

**Preset clicks.** Always set `widthMm`, `heightMm` (from `maxHeightMm` if present, else proportional to current aspect), and `dpi` from the preset table. Always force `resample = true` — the user's intent only makes sense if pixels can change. If Resample was OFF, surface an inline note next to the checkbox: _"Resample turned on to apply preset."_ The note clears on the next state change. Pixel-based presets (Slide · 16:9 etc.) set `widthPx`, `heightPx`, `dpi` directly and likewise force Resample = ON.

**Constrained-preset behaviour.** Journal presets carrying `maxHeightMm` continue to clamp height while the preset is active. As soon as the user types a custom width or height, `preset` becomes `'custom'` and the cap drops away (current behaviour).

**Hard caps.** Dimensions above WebGL's `MAX_DIMENSION = 8192` or `MAX_AREA = ~268M` (`webgl-renderer.ts:720-731`) are rejected at the input boundary with a tooltip explaining the cap.

## Bug fixes

### (a) DPI in Flexible mode actually changes pixels

Falls out of the Resample-aware `computeDpiUpdate`. With Resample = ON (default), `dpi: 300 → 600` doubles `widthPx` and `heightPx` regardless of preset. No additional code beyond the helper rewrite.

### (b) PNG carries real DPI metadata

New file `packages/utils/src/png/phys-chunk.ts`, ~50 lines, no dependencies:

```ts
export function pngWithDpi(blob: Blob, dpi: number): Promise<Blob>;
```

Implementation: read the PNG bytes, locate the `IHDR` chunk (always at offset 8, 25 bytes total), insert a freshly-built `pHYs` chunk between IHDR and the next chunk. The chunk holds 9 bytes: `pixelsPerUnitX (uint32)`, `pixelsPerUnitY (uint32)`, `unitSpecifier (1 byte = 1, metres)`. `pixelsPerMetre = round(dpi × 39.3701)`. Standard PNG framing: 4-byte length + 4-byte type tag (`pHYs`) + data + 4-byte CRC32 of `type + data`. CRC32 implemented in pure JS via a precomputed 256-entry table (~20 lines).

The publish-modal export path switches from `canvas.toDataURL` to `canvas.toBlob` → `pngWithDpi(blob, state.dpi)` → object URL → download. The PDF path keeps `toDataURL` (PDF doesn't need pHYs).

### (c) PDF page size matches the chosen mm width

Rewrite `exportCanvasAsPdf` to take an explicit physical size:

```ts
export async function exportCanvasAsPdf(
  canvas: HTMLCanvasElement,
  opts: { widthMm: number; heightMm: number; filename?: string },
): Promise<void>;
```

```ts
new jsPDF({
  unit: 'mm',
  format: [opts.widthMm, opts.heightMm],
  orientation: opts.widthMm > opts.heightMm ? 'landscape' : 'portrait',
});
pdf.addImage(dataUrl, 'PNG', 0, 0, opts.widthMm, opts.heightMm);
```

No margin. The single-page output _is_ the figure at print size — drop into Word/InDesign at 100 % and it lands at the journal's column width. The publish modal already has `state.widthMm` and `state.heightMm` as `widthPx / dpi × 25.4` and `heightPx / dpi × 25.4`.

## Testing strategy

### Unit tests

- `dimension-utils.test.ts` — extend with `in` and `cm` round-trips.
- `publish-modal-helpers.test.ts` — parameterized matrix over `(Resample on/off) × (aspectLocked on/off) × (preset / Flexible)`. Key invariants:
  - Resample = ON, `dpi: 300 → 600` doubles `widthPx`, leaves `widthMm` unchanged.
  - Resample = OFF, `dpi: 300 → 600` halves `widthMm`, leaves `widthPx` unchanged.
  - Picking any preset always sets `resample = true`.
  - With `aspectLocked = true`, editing width updates height to preserve `widthPx / heightPx` at the moment of the edit.
- `phys-chunk.test.ts` — new. Inject `pHYs` into a hardcoded 1×1 PNG byte array, parse the result back, assert round-tripped DPI and CRC32 correctness.
- `publish-state-validator.test.ts` — extend with new field defaults.
- `export-utils.test.ts` — assert `exportCanvasAsPdf` calls jsPDF with `{ format: [widthMm, heightMm], unit: 'mm' }` and `addImage` with `(_, _, 0, 0, widthMm, heightMm)`.

### Component tests

- `publish-modal.test.ts` — extend with:
  - Typing into Width-mm with Resample = ON updates `widthPx` and triggers redraw.
  - Toggling Resample = OFF then changing DPI updates the displayed mm but does not change `widthPx`.
  - Clicking the chain-link icon flips `aspectLocked`.
  - Clicking a preset while Resample = OFF flips Resample = ON and surfaces the inline note.

### Browser verification (manual, default dataset)

`pnpm dev` → load the bundled default dataset (`app/public/data.parquetbundle`) → open Figure Editor.

1. Pick "Nature · 1 col". Bump DPI 300 → 600. Export PNG. Open in macOS Preview, confirm dimensions show 89 mm × ~50 mm at 600 DPI (not 96 DPI default), file size roughly quadruples.
2. Same flow with PDF export. Open in Preview; bottom shows ~89 mm × ~50 mm page, not A4.
3. Toggle Resample OFF, change DPI from 600 → 300. Re-export PNG. Pixel dims unchanged in Preview; DPI metadata reflects 300.

A Playwright spec is _not_ in scope — verifying exact PNG byte-level metadata is fiddlier than its value.

## Risks and open questions

- **CRC32 implementation correctness.** The `phys-chunk.test.ts` round-trip is the canary; one buggy table entry breaks every export silently. Tests must include a non-trivial DPI value (e.g. 600) to catch wrap-around bugs.
- **PDF page-size limits.** jsPDF accepts arbitrary `[widthMm, heightMm]` formats; we don't expect issues, but very large posters (e.g. 1000 mm) may hit jsPDF internals. Verified informally during browser testing.
- **Image-Size readout heuristic.** `× 0.4` PNG-compression factor is a rough guess. We could compute precisely by encoding once, but that costs a full PNG encode per state mutation. The heuristic is good enough for an "estimated" label; if reviewers find it misleading, drop it or run the precise encode in a `requestIdleCallback`.

## File touch list

| File                                                                   | Change                                                                                                     |
| ---------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `packages/core/src/components/publish/publish-state.ts`                | Add `resample`, `aspectLocked`, `unit` fields; update `createDefaultPublishState`.                         |
| `packages/core/src/components/publish/publish-state-validator.ts`      | Sanitise the three new fields.                                                                             |
| `packages/core/src/components/publish/publish-modal-helpers.ts`        | Resample-aware `compute*Update`; preset application forces `resample = true`.                              |
| `packages/core/src/components/publish/publish-modal.ts`                | Replace dimension sliders with mm/px/in/cm inputs, chain-link icon, Resample checkbox, Image-Size readout. |
| `packages/core/src/components/publish/publish-modal.styles.ts`         | Styles for the new input rows, chain-link icon, info-tooltip.                                              |
| `packages/core/src/components/publish/dimension-utils.ts`              | Add `in` and `cm` conversion helpers.                                                                      |
| `packages/core/src/components/publish/index.ts`                        | Re-export new types/helpers as needed.                                                                     |
| `packages/utils/src/png/phys-chunk.ts`                                 | New — `pngWithDpi(blob, dpi)`.                                                                             |
| `packages/utils/src/index.ts`                                          | Export `pngWithDpi`.                                                                                       |
| `packages/utils/src/visualization/export-utils.ts`                     | New `exportCanvasAsPdf({ widthMm, heightMm, filename })` signature.                                        |
| `app/src/explore/export-handler.ts`                                    | Wire publish-export to `pngWithDpi` (PNG path) and the new mm-aware `exportCanvasAsPdf` (PDF path).        |
| `packages/core/src/components/publish/dimension-utils.test.ts`         | New cases for `in`/`cm`.                                                                                   |
| `packages/core/src/components/publish/publish-modal-helpers.test.ts`   | Resample × aspectLocked × preset matrix.                                                                   |
| `packages/core/src/components/publish/publish-state-validator.test.ts` | New field defaults.                                                                                        |
| `packages/core/src/components/publish/publish-modal.test.ts`           | Component-level interactions.                                                                              |
| `packages/utils/src/png/phys-chunk.test.ts`                            | New — round-trip and CRC32.                                                                                |
| `packages/utils/src/visualization/export-utils.test.ts`                | Updated `exportCanvasAsPdf` assertions.                                                                    |

## Effort estimate

LLM-assisted, single contributor:

- State + helpers + tests: ~2 hours.
- New Dimensions UI in `publish-modal.ts` + styles: ~3 hours.
- `phys-chunk.ts` + tests: ~1 hour.
- `exportCanvasAsPdf` rewrite + tests + caller updates: ~1 hour.
- Browser verification + polish: ~1 hour.

**Total: ~8 hours.**
