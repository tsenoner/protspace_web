# Exporting Results

ProtSpace allows you to export images and data for further use.

## Export Button

Click **Export** in the control bar to see available options:

![Export options](./images/control-bar-export.png)

## Available Formats

| Format          | Description                                               |
| --------------- | --------------------------------------------------------- |
| **PNG**         | Raster image of the current view with legend              |
| **PDF**         | PDF document of the current view with legend              |
| **Protein IDs** | Text file with newline-separated identifiers              |
| **Parquet**     | `.parquetbundle` file with all data and optional settings |

## Image Export (PNG / PDF)

When exporting as PNG or PDF, you can customize the output:

| Setting               | Range       | Default | Description                             |
| --------------------- | ----------- | ------- | --------------------------------------- |
| **Width**             | 800–8192 px | 2048    | Image width in pixels                   |
| **Height**            | 600–8192 px | 1024    | Image height in pixels                  |
| **Lock aspect ratio** | on/off      | on      | Maintain proportions when changing size |
| **Legend width**      | 15–50%      | 25%     | Percentage of image width for legend    |
| **Legend font size**  | 8–120 px    | 24      | Font size for legend labels             |

The exported image includes the scatterplot and legend side by side.

## Parquet Export

Export a `.parquetbundle` file that can be loaded back into ProtSpace or shared with others.

- **Include legend settings**: When checked, your current legend customizations (colors, shapes, ordering, visibility, palette) are saved inside the file. Anyone who loads it will see the same visual configuration.
- **Include export options**: When checked, your current image export settings (width, height, aspect ratio lock, legend width, legend font size) are saved inside the file. This lets you preserve consistent export dimensions across sessions or when sharing files.

## Protein IDs Export

Exports a plain text file with one protein ID per line. Useful for downstream analysis in other tools.

## What Gets Exported

| State             | Exported Data          |
| ----------------- | ---------------------- |
| Proteins isolated | Only isolated proteins |
| No isolation      | All proteins           |

Use isolation to export specific subsets.

## Next Steps

- [FAQ](/guide/faq) - Common questions
- [Data Format Reference](/guide/data-format) - Understanding the file format
