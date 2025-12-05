# Getting Started

This guide will help you get up and running with ProtSpace in minutes.

## Try the Demo (No Installation)

The quickest way to try ProtSpace:

1. Visit **[https://protspace.app/](https://protspace.app/)**
2. Load a `.parquetbundle` file using the file picker
3. Start exploring!

::: tip Don't have data?
Use the [Google Colab notebook](https://colab.research.google.com/github/tsenoner/protspace_web/blob/main/notebooks/ProtSpace_Preparation.ipynb) to generate sample data, or download example datasets from the [data folder](https://github.com/tsenoner/protspace_web/tree/main/data).
:::

## Generate Your Data

### Option 1: Google Colab (Recommended)

Generate `.parquetbundle` files directly in your browser using our Colab notebook - no installation required!

[![Open In Colab](https://colab.research.google.com/assets/colab-badge.svg)](https://colab.research.google.com/github/tsenoner/protspace_web/blob/main/notebooks/ProtSpace_Preparation.ipynb)

**Steps:**

1. Open the notebook
2. Upload your FASTA file or fetch from UniProt
3. Run all cells
4. Download the generated `.parquetbundle` file

### Option 2: Python CLI

For local processing with more control:

```bash
# Install Python package
pip install protspace

# Query UniProt and generate visualization files
protspace-query -q "(ft_domain:phosphatase) AND (reviewed:true)" -o output_dir

# Or use your own embeddings
protspace-local -i embeddings.h5 -o output_dir -m pca2,umap2,tsne2
```

See the [Python ProtSpace repository](https://github.com/tsenoner/protspace) for details.

## Basic Usage

### HTML with Programmatic Loading

```html
<!DOCTYPE html>
<html>
  <head>
    <script type="module">
      import '@protspace/core';
      import {
        readFileOptimized,
        extractRowsFromParquetBundle,
        convertParquetToVisualizationDataOptimized,
      } from '@protspace/core';
    </script>
    <style>
      body {
        font-family: system-ui, sans-serif;
        margin: 0;
        padding: 20px;
      }
      .container {
        display: grid;
        grid-template-rows: auto 1fr;
        gap: 20px;
        height: 100vh;
      }
      .controls {
        display: flex;
        gap: 10px;
        align-items: center;
      }
      .visualization {
        display: grid;
        grid-template-columns: 1fr 300px;
        gap: 20px;
      }
      protspace-scatterplot {
        height: 600px;
        border: 1px solid #ddd;
      }
      protspace-legend {
        border: 1px solid #ddd;
        padding: 10px;
      }
    </style>
  </head>
  <body>
    <div class="container">
      <!-- File input for loading data -->
      <div class="controls">
        <input type="file" id="fileInput" accept=".parquetbundle" />
        <span id="status">Load a .parquetbundle file to begin</span>
      </div>

      <div class="visualization">
        <!-- Main visualization -->
        <div>
          <protspace-control-bar
            id="controlBar"
            auto-sync
            scatterplot-selector="#plot"
          ></protspace-control-bar>

          <protspace-scatterplot
            id="plot"
            show-grid
            enable-zoom
            enable-pan
            enable-selection
          ></protspace-scatterplot>
        </div>

        <!-- Sidebar -->
        <div>
          <protspace-legend
            id="legend"
            auto-sync
            scatterplot-selector="#plot"
            show-counts
          ></protspace-legend>

          <protspace-structure-viewer
            id="structureViewer"
            auto-sync
            auto-show
            scatterplot-selector="#plot"
            height="400px"
          ></protspace-structure-viewer>
        </div>
      </div>
    </div>

    <script type="module">
      const fileInput = document.getElementById('fileInput');
      const plot = document.getElementById('plot');
      const status = document.getElementById('status');

      fileInput.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        try {
          status.textContent = 'Loading...';

          // Read and parse the parquet bundle
          const arrayBuffer = await readFileOptimized(file);
          const rows = await extractRowsFromParquetBundle(arrayBuffer);
          const data = await convertParquetToVisualizationDataOptimized(rows);

          // Set data on the plot
          plot.data = data;
          plot.selectedProjectionIndex = 0;
          plot.selectedFeature = Object.keys(data.features)[0] || '';

          status.textContent = `Loaded ${data.proteins.length} proteins`;
        } catch (error) {
          status.textContent = `Error: ${error.message}`;
          console.error('Failed to load data:', error);
        }
      });

      // Track selection changes
      plot.addEventListener('selection-change', (e) => {
        const count = e.detail.selected.length;
        if (count > 0) {
          status.textContent = `${count} protein(s) selected`;
        }
      });
    </script>
  </body>
</html>
```

## Core Components

ProtSpace consists of four main components that work together:

| Component                      | Purpose                             |
| ------------------------------ | ----------------------------------- |
| `<protspace-scatterplot>`      | Renders 2D scatter plot with canvas |
| `<protspace-legend>`           | Filtering and category colors       |
| `<protspace-control-bar>`      | Switch projections/features, export |
| `<protspace-structure-viewer>` | Display 3D protein structures       |

::: tip Auto-Sync
Components with `auto-sync` attribute automatically communicate with the scatterplot. Use `scatterplot-selector` to specify which plot to sync with.
:::

## Interaction Guide

### Mouse Controls

| Action          | Effect                                  |
| --------------- | --------------------------------------- |
| **Scroll**      | Zoom in/out                             |
| **Drag**        | Pan the view                            |
| **Click point** | Select protein (view details/structure) |
| **Shift+Click** | Add to selection                        |
| **Click empty** | Clear selection                         |
| **Box select**  | Drag to select multiple proteins        |

### Legend Interactions

| Action                         | Effect                         |
| ------------------------------ | ------------------------------ |
| **Click category**             | Toggle visibility              |
| **Double-click**               | Isolate category (hide others) |
| **Double-click when isolated** | Show all categories            |

### Control Bar

- **Projection dropdown**: Switch between PCA, UMAP, t-SNE, MDS, PaCMAP
- **Feature dropdown**: Color points by different metadata
- **Search**: Find specific proteins by ID or name
- **Export**: Save images (PNG/SVG) or data (JSON/CSV)

### Structure Viewer

- Automatically shows when selecting proteins with structure data
- Supports AlphaFold and PDB structures
- Click protein points to load their 3D structure
- Close button to hide the viewer

## Loading Data

ProtSpace uses programmatic data loading. Here are common patterns:

### File Input

```javascript
const fileInput = document.createElement('input');
fileInput.type = 'file';
fileInput.accept = '.parquetbundle';

fileInput.addEventListener('change', async (e) => {
  const file = e.target.files[0];
  const arrayBuffer = await readFileOptimized(file);
  const rows = await extractRowsFromParquetBundle(arrayBuffer);
  const data = await convertParquetToVisualizationDataOptimized(rows);

  plot.data = data;
  plot.selectedProjectionIndex = 0;
  plot.selectedFeature = Object.keys(data.features)[0];
});
```

### Drag and Drop

```javascript
plot.addEventListener('dragover', (e) => {
  e.preventDefault();
  e.dataTransfer.dropEffect = 'copy';
});

plot.addEventListener('drop', async (e) => {
  e.preventDefault();
  const file = e.dataTransfer.files[0];

  const arrayBuffer = await readFileOptimized(file);
  const rows = await extractRowsFromParquetBundle(arrayBuffer);
  const data = await convertParquetToVisualizationDataOptimized(rows);

  plot.data = data;
});
```

### Fetch from URL

```javascript
const response = await fetch('./data.parquetbundle');
const arrayBuffer = await response.arrayBuffer();
const file = new File([arrayBuffer], 'data.parquetbundle');

const buffer = await readFileOptimized(file);
const rows = await extractRowsFromParquetBundle(buffer);
const data = await convertParquetToVisualizationDataOptimized(rows);

plot.data = data;
```

## What's Next?

- [What is ProtSpace?](/guide/) - Learn about the architecture
- [Installation](/guide/installation) - Package installation options
- [Data Format](/guide/data-format) - Understanding the data structure
- [Data Preparation](/guide/data-preparation) - Generate your own datasets
- [User Guide](/guide/user-guide) - Detailed feature documentation
- [API Reference](/api/) - Component API documentation
- [Examples](/examples/) - Code examples and recipes
