# Exporting Results

ProtSpace allows you to export images and data for further use.

## Export Button

Click **Export** in the control bar to see available options:

![Export options](./images/control-bar-export.png)

## Available Formats

| Format          | Description                                    |
| --------------- | ---------------------------------------------- |
| **PNG**         | Raster image of the current view               |
| **PDF**         | Raster image of the current view               |
| **JSON**        | Full data for isolated proteins (can be large) |
| **Protein IDs** | Text file with newline-separated identifiers   |

::: info Future
Customization export (colors, shapes, labels) is planned. Once available, you'll be able to export a customized `.parquetbundle` file.
:::

## What Gets Exported

| State             | Exported Data          |
| ----------------- | ---------------------- |
| Proteins isolated | Only isolated proteins |
| No isolation      | All proteins           |

Use isolation to export specific subsets.

## Next Steps

- [FAQ](/guide/faq) - Common questions
- [Data Format Reference](/guide/data-format) - Understanding the file format
