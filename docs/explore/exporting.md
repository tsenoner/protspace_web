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

Publication export uses **fixed sizes in millimeters** and **300 DPI** raster output for the scatter panel (via native WebGL capture). You choose:

| Setting             | Options                                                               |
| ------------------- | --------------------------------------------------------------------- |
| **Figure size**     | One column (88×70 mm), two column (178×95 mm), full page (180×140 mm) |
| **Legend position** | Right or below (layout reserves a fixed band for the legend)          |

Legend text uses a condensed font stack when available; category labels wrap to **two lines** with ellipsis. **Only a bounded number of legend rows** are drawn per layout; if there are more categories, a **“+ N more categories”** line is shown. For the complete category list, use **Parquet** or **Protein IDs** exports.

PNG/PDF export **requires** native `captureAtResolution` on the scatterplot (no html2canvas fallback).

## Parquet export

Export a `.parquetbundle` file that can be loaded back into ProtSpace or shared with others.

- **Include legend settings**: When checked, your current legend customizations (colors, shapes, ordering, visibility, palette) are saved inside the file.
- **Include export options**: When checked, your current figure export preferences (preset size and legend placement) are saved inside the file.

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
