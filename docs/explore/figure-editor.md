# Figure Editor

The Figure Editor is a full-screen tool for creating publication-ready figures from your ProtSpace visualization. It provides live preview, journal-specific dimension presets, annotation overlays, zoom insets, and legend customization — all in a single interface.

## Opening the Figure Editor

1. Click **Export** in the control bar
2. Select **PNG** or **PDF** format
3. Click **Figure Editor**

The editor opens as a full-screen modal with a **preview canvas** on the left (65%) and a **settings sidebar** on the right (35%).

## Journal Presets

The presets grid lets you instantly configure dimensions and DPI for specific journals:

| Preset        | Width   | DPI | Max Height |
| ------------- | ------- | --- | ---------- |
| Nature 1 col  | 89 mm   | 300 | 247 mm     |
| Nature 2 col  | 183 mm  | 300 | 247 mm     |
| Science 1 col | 57 mm   | 300 | —          |
| Science 2 col | 121 mm  | 300 | —          |
| Cell 1 col    | 85 mm   | 300 | 225 mm     |
| Cell 1.5 col  | 114 mm  | 300 | 225 mm     |
| Cell 2 col    | 174 mm  | 300 | 225 mm     |
| PNAS 1 col    | 87 mm   | 300 | 225 mm     |
| PNAS 2 col    | 178 mm  | 300 | 225 mm     |
| PLOS 1 col    | 132 mm  | 300 | 222 mm     |
| PLOS 2 col    | 190 mm  | 300 | 222 mm     |
| Slide 16:9    | 1920 px | 96  | 1080 px    |
| Slide 4:3     | 1440 px | 96  | 1080 px    |
| Flexible      | 2048 px | 300 | —          |

Selecting a journal preset locks the width in millimetres. Changing the pixel width adjusts DPI to maintain the physical size, and vice versa. The **Flexible** preset allows free pixel dimensions.

## Dimensions

Three controls govern the output size:

- **Width** (400–8192 px) — pixel width of the exported image. For journal presets, the computed mm equivalent is displayed.
- **Height** (400–8192 px) — pixel height. Journal presets with a max height constraint enforce an upper limit.
- **DPI** (72–1000) — dots per inch. For journal presets, changing DPI recalculates the pixel dimensions to maintain the same physical width.

Each control has both a slider for quick adjustment and an input field for precise values.

### How DPI/mm/px linkage works

When a journal preset is active, the width in millimetres is fixed. The relationship is:

```
widthPx = widthMm × DPI / 25.4
```

- Changing **width px** → DPI adjusts to keep mm constant
- Changing **DPI** → width px adjusts to keep mm constant
- Changing to **Flexible** → px and DPI are independent

## Legend

Control how the legend appears in the exported figure:

| Setting     | Range                          | Default | Description                                                         |
| ----------- | ------------------------------ | ------- | ------------------------------------------------------------------- |
| Show legend | on/off                         | on      | Toggle legend visibility                                            |
| Position    | right, left, top, bottom, free | right   | Legend placement relative to the plot                               |
| Size %      | 10–100%                        | 20%     | Legend area as percentage of image width (or height for top/bottom) |
| Font size   | 8–120 px                       | 15 px   | Font size for legend text                                           |
| Columns     | 1–6                            | 1       | Number of columns for legend items                                  |

### Legend positions

- **Side positions** (right, left, top, bottom) — the legend occupies a dedicated strip alongside the plot. The plot area shrinks accordingly.
- **Free** — the legend floats over the plot. Drag it to any position on the canvas using the Select tool.

### Legend rendering

- **Underscore removal** — underscores in annotation names and category labels are automatically replaced with spaces for cleaner display.
- **Text wrapping** — long category labels wrap within their column width.
- **Corner positions** (tr, tl, br, bl) — available programmatically; the legend overlays the plot with a semi-transparent white background.

## Overlay Tools

The toolbar at the bottom of the preview provides tools for drawing annotations on the figure:

### Select Tool

Click to select existing overlays and insets. Selected items show resize/rotate handles. Drag to move items. Click empty space to deselect.

### Circle Tool

Click and drag to draw an ellipse. The center is placed at the mouse-down position, and the radius extends to the release position. After creation, use the Select tool to:

- **Drag** the 4 cardinal handles to resize rx/ry independently
- **Drag** the rotate handle (above the top handle) to rotate the ellipse
- **Drag** the body to move it

### Arrow Tool

Click and drag to draw an arrow from start to end. The arrowhead appears at the end point. After creation, use the Select tool to:

- **Drag** the circle handles at either endpoint to reposition them
- **Drag** the arrow body to move the entire arrow

### Label Tool

Click to place a text label. Labels default to "Label" and can be renamed in the sidebar. After creation, use the Select tool to:

- **Drag** the body to move it
- **Drag** the rotate handle to rotate the text

### Zoom Inset Tool

Creates a magnified view of a region. This is a **two-phase workflow**:

1. **Draw the source rectangle** — drag to select the region you want to magnify
2. **Draw the target rectangle** — drag to place where the magnified view should appear

After creation, the inset shows:

- A dashed border around the source region
- The magnified content in the target rectangle with a solid border
- Connector lines between the closest corners of source and target

Use the Select tool to:

- **Drag** corner handles on source or target to resize
- **Drag** the interior of source or target to move

Insets are rendered at boosted resolution (up to 4x) to ensure the magnified content stays crisp.

## Per-Overlay Properties

Each overlay has editable properties in the sidebar:

| Overlay | Properties                        |
| ------- | --------------------------------- |
| Circle  | Stroke width (0.5–10 px)          |
| Arrow   | Stroke width (0.5–10 px)          |
| Label   | Text content, font size (8–72 px) |
| Inset   | Border width (0.5–10 px)          |

All overlays default to black (`#000000`). Hover over an overlay in the sidebar list to highlight it on the canvas. Click the × button to delete it.

## Options

- **Format** — toggle between PNG and PDF output
- **Background** — white or transparent (PNG only; PDF always has a white background)

## Footer Buttons

| Button         | Action                                                                                                                                                                               |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **New Figure** | Clears all overlays and insets but keeps layout settings (dimensions, DPI, preset, legend, format). Useful when you've changed the underlying visualization and want a fresh canvas. |
| **Reset**      | Resets everything to defaults — dimensions, DPI, preset, legend, overlays, insets, format, background.                                                                               |
| **Cancel**     | Closes the editor. Your current state is saved to localStorage.                                                                                                                      |
| **Export**     | Renders the figure at full resolution and downloads it. State is saved to localStorage.                                                                                              |

## State Persistence

The Figure Editor saves your settings automatically so you can close and reopen without losing work.

### Where state is stored

1. **localStorage** — saved on every close and export. Restored when you reopen the editor in the same browser.
2. **Parquet bundle** — when you export a `.parquetbundle` with "Include legend settings" checked, the Figure Editor state is included. Anyone who loads the file gets your figure layout.

Priority on open: bundle settings > localStorage > defaults.

### What is saved

All settings are persisted: preset, dimensions, DPI, format, background, legend layout (position, size, font, columns, free position), overlays (type, position, properties), insets (source rect, target rect, border, connector), and the reference width for overlay scaling.

### View fingerprint

The editor tracks which projection and dimensionality (2D/3D) was active when overlays were placed. If you change the projection or dimensionality between sessions, a warning appears:

> "Overlays were placed on UMAP 2D. Current view: PaCMAP 2D."

This tells you that overlay positions (which are stored as normalized 0–1 coordinates over the plot area) may no longer align with the data. You can:

- **Keep working** — overlays stay where they are
- **Clear overlays** — remove stale overlays and keep the layout

## Coordinate System

All overlay and inset positions use **normalized 0–1 coordinates** within the plot area. This means:

- Overlays survive resolution changes (switching presets, changing width/height)
- Overlays survive DPI changes
- Overlays do **not** survive projection changes (the data moves, but overlay positions don't)

Pixel-based properties (stroke width, font size) are scaled proportionally when the output width differs from the width at which they were authored (`referenceWidth`).

## Keyboard and Mouse

| Action                        | Effect                      |
| ----------------------------- | --------------------------- |
| Click overlay backdrop        | Close the editor            |
| Click × in sidebar header     | Close the editor            |
| Click toolbar button          | Switch active tool          |
| Hover sidebar overlay item    | Highlight overlay on canvas |
| Drag on canvas (drawing tool) | Create overlay/inset        |
| Drag on canvas (select tool)  | Move selected item          |
| Drag handle (select tool)     | Resize/rotate selected item |
