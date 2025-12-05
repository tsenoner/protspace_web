# User Guide

This document explains all interactive features of ProtSpace in detail. No machine learning or computational biology background is required.

## Loading Data

ProtSpace uses `.parquetbundle` files. There are several ways to load your data:

### File Input

Use the file input control to select a `.parquetbundle` file from your computer:

1. Click the file input button
2. Navigate to your `.parquetbundle` file
3. Select the file
4. Wait a few seconds for loading

### Drag and Drop

If your application supports it, you can drag and drop files:

1. Find your `.parquetbundle` file
2. Drag it onto the visualization area
3. Drop when you see the drop indicator
4. Wait for loading

### Common Loading Issues

| Problem                          | Solution                                            |
| -------------------------------- | --------------------------------------------------- |
| "File type not recognized"       | Ensure the file ends with `.parquetbundle`          |
| "Bundle missing required tables" | See the [Data Format reference](/guide/data-format) |
| "Empty chart"                    | Verify projection tables are present in the bundle  |
| Browser freezes                  | File may be too large (>500MB)                      |

## Navigating the Scatterplot

### Pan

Click and drag on the background to move the view around.

### Zoom

- **Mouse wheel**: Scroll up to zoom in, down to zoom out
- **Touchpad**: Pinch to zoom in/out
- **Zoom range**: 30% to 500%

### Reset View

Click the **Home** icon in the control bar or press the **Home** key to reset the view to show all proteins.

## Selecting Proteins

### Single-Click

Click any point to select that protein and view its details.

### Box-Select

Click and drag to draw a selection rectangle around multiple proteins.

### Multi-Select

Hold **Shift** and click individual proteins to add them to the selection.

### Clear Selection

Click on empty space to deselect all proteins, or use the clear button in the control bar.

## Coloring Data

The legend on the right shows all available features for coloring. Click a feature in the control bar to change the coloring scheme.

### Categorical Features

**Examples**: taxonomy, family, domain, organism

- Each category has a unique color
- Legend shows all categories
- Click categories to hide/show them

### Numerical Features

**Examples**: length, score, confidence, mass

- Colors use gradients (blue → yellow → red)
- Legend shows min/max ranges
- Values are displayed on hover

### Multi-Label Features

**Examples**: GO terms, Pfam domains, EC numbers

- Proteins with multiple values show as pie charts
- Each slice represents a different value
- All values appear in the legend

## Using the Legend

### Click to Toggle

Click any category to hide/show those proteins:

- **One click**: Hides the category
- **Click again**: Shows the category

### Double-Click to Isolate

Double-click a category to show only that category:

- **First double-click**: Hides all other categories
- **Second double-click**: Shows all categories again

### "Others" Group

When there are many categories, less frequent ones are grouped into "Others":

- Click "Others" to expand and see all grouped values
- Each grouped value can be toggled individually

## Switching Projections

Use the projection dropdown in the control bar to switch between different dimensionality reduction methods:

- **PCA**: Linear projection, preserves global structure
- **UMAP**: Non-linear, balances local and global structure
- **t-SNE**: Non-linear, emphasizes local clusters
- **MDS**: Preserves pairwise distances
- **PaCMAP**: Alternative to t-SNE, faster

Each projection may reveal different patterns in the data.

### 3D Projections

If your data includes 3D projections, you can select which plane to view:

- **XY plane**: Standard top-down view
- **XZ plane**: Front view
- **YZ plane**: Side view

## Inspecting Individual Proteins

Click any point to view detailed information:

### Information Panel

Shows metadata for the selected protein:

- **Identifier**: Protein ID (e.g., UniProt accession)
- **Features**: All available metadata fields
- **Coordinates**: Position in the current projection

### Structure Viewer

If the protein has structure data (AlphaFold or PDB):

1. Structure viewer appears automatically
2. 3D structure loads from AlphaFold Database or PDB
3. Use mouse to rotate, pan, and zoom the structure
4. Close button to hide the viewer

**Structure controls**:

- **Left drag**: Rotate
- **Right drag**: Pan
- **Scroll**: Zoom
- **R key**: Reset view

## Search Functionality

Use the search bar in the control bar to find specific proteins:

1. Click the search input
2. Type a protein ID or name
3. Matching proteins appear as suggestions
4. Click a suggestion to select that protein
5. Selected protein is highlighted in the plot

**Search features**:

- Case-insensitive matching
- Partial ID matching
- Multiple selection support
- Clear individual selections with × button

## Exporting

### Export Images

Click the export button in the control bar and select:

- **PNG**: Raster image, good for presentations
- **SVG**: Vector image, scalable, good for publications

The exported image shows the current view exactly as displayed.

### Export Data

Export protein data in structured formats:

- **JSON**: Full data with metadata
- **CSV**: Tabular format for spreadsheets

Exports include:

- Selected proteins (if any are selected)
- Or all visible proteins (if none selected)
- Coordinates in current projection
- All feature values

## Performance Tips

### For Large Datasets (>100k proteins)

1. **Reduce point size**: Smaller points render faster
2. **Limit features**: Switch between features instead of showing all
3. **Use Chrome**: Best WebGL performance
4. **Close other tabs**: Free up memory

### If Browser Slows Down

1. **Clear selection**: Large selections can slow rendering
2. **Reset zoom**: Extreme zoom levels are slower
3. **Close structure viewer**: 3D rendering uses GPU
4. **Refresh page**: Clears memory leaks

### Optimal Dataset Sizes

| Size        | Performance | Recommendation                    |
| ----------- | ----------- | --------------------------------- |
| < 10K       | Excellent   | All features work smoothly        |
| 10K - 100K  | Good        | May slow on older devices         |
| 100K - 500K | Fair        | Reduce point size, limit features |
| > 500K      | Poor        | Consider subsetting data          |

## Keyboard Shortcuts

| Key            | Action            |
| -------------- | ----------------- |
| **Home**       | Reset view        |
| **+/-**        | Zoom in/out       |
| **Arrow keys** | Pan view          |
| **Escape**     | Clear selection   |
| **Ctrl+F**     | Focus search      |
| **Tab**        | Navigate controls |

## Troubleshooting

### Plot is Empty

**Causes**:

- Dataset missing projections
- Projection data corrupted
- All proteins filtered out

**Solutions**:

- Check legend - make sure categories aren't all hidden
- Try a different projection
- Regenerate the .parquetbundle file

### Colors Look Strange

**Cause**: Feature type misinterpreted (numeric as categorical or vice versa)

**Solution**: Check the data preparation - ensure features have consistent types

### Browser Freezes

**Causes**:

- Dataset too large
- Memory leak
- GPU throttling

**Solutions**:

- Try a smaller dataset
- Refresh the page
- Use Chrome instead of Firefox
- Close other browser tabs
- Update graphics drivers

### Structure Doesn't Load

**Causes**:

- No internet connection
- Protein has no structure available
- AlphaFold/PDB server down

**Solutions**:

- Check internet connection
- Try another protein
- Wait and retry later

### Selection Not Working

**Cause**: Selection mode disabled

**Solution**: Check that `enable-selection` is true on the scatterplot

## Tips and Tricks

### Finding Clusters

1. Use UMAP or t-SNE projection (best for clusters)
2. Color by a biological feature (family, function)
3. Look for groupings of similar colors
4. Use legend to isolate specific groups

### Comparing Projections

1. Note interesting patterns in PCA
2. Switch to UMAP - do patterns persist?
3. Try t-SNE for detailed cluster structure
4. Consistent patterns across projections are most reliable

### Identifying Outliers

1. Use PCA projection (good for outliers)
2. Look for isolated points far from main groups
3. Click them to see what makes them different
4. Check their feature values

### Exploring Multi-Label Data

1. Select feature with multiple values (GO terms, domains)
2. Points show as pie charts
3. Click to see full list of values
4. Use legend to filter by specific values

## Best Practices

### When Exploring New Data

1. **Start with PCA**: Quick overview of global structure
2. **Check features**: What metadata is available?
3. **Try UMAP**: Better separation of groups
4. **Use legend**: Understand what categories exist
5. **Search**: Find known proteins to validate

### For Presentations

1. **Choose clear projection**: UMAP often works well
2. **Select meaningful feature**: Color by function/family
3. **Adjust zoom**: Show area of interest clearly
4. **Hide irrelevant categories**: Focus viewer attention
5. **Export high-res PNG**: Better quality than screenshots

### For Publications

1. **Export SVG**: Scalable vector graphics
2. **Document settings**: Note projection method and parameters
3. **Consistent colors**: Use same coloring across figures
4. **Include scale**: Add size reference if needed

## Next Steps

- [Data Preparation](/guide/data-preparation) - Generate your own datasets
- [Installation](/guide/installation) - Embed in your own application
- [API Reference](/api/) - Programmatic control
- [FAQ](/guide/faq) - Common questions
