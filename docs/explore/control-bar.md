# Control Bar Features

The control bar at the top provides tools for data management, selection, export, and import.

![Control bar overview](./images/control-bar-full.png)

## Import

Click **Import** to load a `.parquetbundle` file from your computer.

![Import button](./images/control-bar-import.png)

You can also drag & drop files directly onto the canvas.

## Projection Selector

Switch between different dimensionality reduction methods:

![Projection dropdown](./images/control-bar-projection.png)

| Method     | Best For                           |
| ---------- | ---------------------------------- |
| **PCA**    | Initial overview, finding outliers |
| **UMAP**   | General exploration, balanced view |
| **t-SNE**  | Finding clusters                   |
| **PaCMAP** | Fast alternative to t-SNE          |
| **MDS**    | Preserving distances               |

Different projections reveal different patterns - try switching between them!

## Color By (Annotation Selector)

Choose which annotation to use for coloring points:

![Color By dropdown](./images/control-bar-colorby.png)

Available annotations depend on your dataset (taxonomy, family, function, etc.).

## Search

Find specific proteins by ID:

![Search box](./images/control-bar-search.png)

1. Type a protein ID or partial match
2. Select from suggestions
3. Protein is selected in the scatterplot

::: tip Multiple IDs
Paste multiple IDs at once (newline or space separated) and all matching proteins will be selected. Useful for re-selecting a previously exported subset.
:::

## Select Button

Enable **box selection mode** to select multiple proteins at once:

![Select button and box selection](./images/control-bar-select.gif)

1. Click **Select** to enable
2. Drag on the canvas to draw a selection box
3. All proteins inside are selected

::: tip Additive Mode
When the Select button is active, all selections are **additive** - new selections add to existing ones instead of replacing them.
:::

## Clear Button

Click **Clear** to remove all current selections.

## Export

Click **Export** to save your visualization:

![Export options](./images/control-bar-export.png)

| Format          | Description                                  |
| --------------- | -------------------------------------------- |
| **PNG**         | Raster image                                 |
| **PDF**         | Vector image                                 |
| **JSON**        | Full data for isolated proteins              |
| **Protein IDs** | Text file with newline-separated identifiers |

## Tips

- **Compare projections**: Patterns that appear in multiple projections are more reliable
- **Use search**: Quickly find known proteins to orient yourself
- **Export often**: Save interesting views for later

## Next Steps

- [Viewing 3D Structures](/explore/structures) - AlphaFold integration
- [Exporting Results](/explore/exporting) - Detailed export options
