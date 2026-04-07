# Exporting Results

ProtSpace allows you to export print-oriented figures, protein identifiers, and full datasets.

## Export Button

Click **Export** in the control bar to see available options:

![Export options](./images/control-bar-export.png)

## Available Formats

| Format          | Description                                               |
| --------------- | --------------------------------------------------------- |
| **PNG**         | Raster figure at 300 DPI with fixed journal-style layout  |
| **PDF**         | Single-page PDF matching the figure size in millimeters   |
| **Protein IDs** | Text file with newline-separated identifiers              |
| **Parquet**     | `.parquetbundle` file with all data and optional settings |

## Figure export (PNG / PDF)

Publication export uses **fixed sizes in millimeters** and **300 DPI** raster output for the scatter panel (via native WebGL capture). The **Layout** selector offers four options:

| Layout | Dimensions | Legend |
|--------|-----------|--------|
| **One column (legend below)** | 88×70 mm | Below scatter, 2 sub-columns |
| **Two column (legend right)** | 178×95 mm | Right of scatter, single column |
| **Two column (legend below)** | 178×95 mm | Below scatter, 3 sub-columns |
| **Full page (legend top)** | 180×250 mm | Above scatter, 3 sub-columns |

Legend categories fill columns **top-to-bottom** (column-major), then continue into the next column. Long labels wrap to two lines and truncate with `…` if needed. When more categories exist than the layout can fit, a `+ N more categories` line appears below the legend grid; for the complete list, export Protein IDs or use the Parquet export instead.

PNG/PDF export **requires** native `captureAtResolution` on the scatterplot (no html2canvas fallback).

## Parquet export

Export a `.parquetbundle` file that can be loaded back into ProtSpace or shared with others.

- **Include legend settings**: When checked, your current legend customizations (colors, shapes, ordering, visibility, palette) are saved inside the file.
- **Include export options**: When checked, your current figure export preferences (layout choice) are saved inside the file.

## Protein IDs export

Exports a plain text file with one protein ID per line. Useful for downstream analysis in other tools.

## What Gets Exported

| State             | Exported data / figure behavior                                                                          |
| ----------------- | -------------------------------------------------------------------------------------------------------- |
| Proteins isolated | Only isolated proteins (IDs); scatter shows isolated subset                                              |
| Selection active  | Legend **counts** in PNG/PDF reflect the selected subset; ordering and visibility follow the live legend |
| No isolation      | Full dataset                                                                                             |

Use isolation or selection to export specific subsets.

## Next Steps

- [FAQ](/guide/faq) - Common questions
- [Data Format Reference](/guide/data-format) - Understanding the file format
