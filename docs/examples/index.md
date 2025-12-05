# Examples

This section contains practical examples for using ProtSpace in different scenarios and frameworks.

## Basic Complete Example

A full working example with all components:

```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>ProtSpace Visualization</title>
    <script type="module">
      import '@protspace/core';
      import {
        readFileOptimized,
        extractRowsFromParquetBundle,
        convertParquetToVisualizationDataOptimized,
      } from '@protspace/core';
    </script>
    <style>
      * {
        box-sizing: border-box;
        margin: 0;
        padding: 0;
      }
      body {
        font-family:
          system-ui,
          -apple-system,
          sans-serif;
      }

      .container {
        display: grid;
        grid-template-rows: auto auto 1fr auto;
        height: 100vh;
        gap: 1rem;
        padding: 1rem;
      }

      .header {
        display: flex;
        gap: 1rem;
        align-items: center;
        padding: 1rem;
        background: #f5f5f5;
        border-radius: 8px;
      }

      .main {
        display: grid;
        grid-template-columns: 1fr 320px;
        gap: 1rem;
        min-height: 0;
      }

      .viz-panel {
        display: flex;
        flex-direction: column;
        gap: 1rem;
        min-height: 0;
      }

      protspace-scatterplot {
        flex: 1;
        min-height: 400px;
        border: 1px solid #ddd;
        border-radius: 8px;
      }

      .sidebar {
        display: flex;
        flex-direction: column;
        gap: 1rem;
        min-height: 0;
      }

      protspace-legend {
        flex: 1;
        border: 1px solid #ddd;
        border-radius: 8px;
        padding: 1rem;
        overflow-y: auto;
        min-height: 200px;
      }

      protspace-structure-viewer {
        height: 400px;
        border: 1px solid #ddd;
        border-radius: 8px;
      }

      .status {
        padding: 0.5rem 1rem;
        background: #f5f5f5;
        border-radius: 8px;
        text-align: center;
      }

      .loading {
        display: none;
        justify-content: center;
        align-items: center;
        gap: 0.5rem;
      }

      .loading.active {
        display: flex;
      }

      .spinner {
        width: 20px;
        height: 20px;
        border: 2px solid #ddd;
        border-top-color: #3498db;
        border-radius: 50%;
        animation: spin 1s linear infinite;
      }

      @keyframes spin {
        to {
          transform: rotate(360deg);
        }
      }
    </style>
  </head>
  <body>
    <div class="container">
      <!-- Header with file input -->
      <div class="header">
        <input type="file" id="fileInput" accept=".parquetbundle" />
        <div class="loading" id="loading">
          <div class="spinner"></div>
          <span>Loading...</span>
        </div>
      </div>

      <!-- Control Bar -->
      <protspace-control-bar
        id="controlBar"
        auto-sync
        scatterplot-selector="#plot"
      ></protspace-control-bar>

      <!-- Main visualization area -->
      <div class="main">
        <div class="viz-panel">
          <protspace-scatterplot
            id="plot"
            show-grid
            enable-zoom
            enable-pan
            enable-selection
          ></protspace-scatterplot>
        </div>

        <div class="sidebar">
          <protspace-legend
            id="legend"
            auto-sync
            auto-hide
            scatterplot-selector="#plot"
            show-counts
          ></protspace-legend>

          <protspace-structure-viewer
            id="structureViewer"
            auto-sync
            auto-show
            scatterplot-selector="#plot"
            title="Protein Structure"
            height="400px"
          ></protspace-structure-viewer>
        </div>
      </div>

      <!-- Status Bar -->
      <div class="status" id="status">Load a .parquetbundle file to begin</div>
    </div>

    <script type="module">
      const fileInput = document.getElementById('fileInput');
      const plot = document.getElementById('plot');
      const status = document.getElementById('status');
      const loading = document.getElementById('loading');

      // Load data
      fileInput.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        try {
          loading.classList.add('active');
          status.textContent = 'Loading data...';

          // Read and parse the parquet bundle
          const arrayBuffer = await readFileOptimized(file);
          const rows = await extractRowsFromParquetBundle(arrayBuffer);
          const data = await convertParquetToVisualizationDataOptimized(rows);

          // Set data on the plot
          plot.data = data;
          plot.selectedProjectionIndex = 0;
          plot.selectedFeature = Object.keys(data.features)[0] || '';

          status.textContent = `Loaded ${data.proteins.length} proteins with ${data.projections.length} projections`;
        } catch (error) {
          status.textContent = `Error: ${error.message}`;
          console.error('Failed to load data:', error);
        } finally {
          loading.classList.remove('active');
        }
      });

      // Track selection changes
      plot.addEventListener('selection-change', (e) => {
        const count = e.detail.selected.length;
        if (count > 0) {
          status.textContent = `${count} protein(s) selected`;
        } else {
          const data = plot.data;
          if (data) {
            status.textContent = `${data.proteins.length} proteins loaded`;
          }
        }
      });

      // Track loading errors
      plot.addEventListener('load-error', (e) => {
        status.textContent = `Error: ${e.detail.error.message}`;
      });
    </script>
  </body>
</html>
```

## Framework Integration

### HTML/Vanilla JavaScript

See the complete example above or check the [HTML Integration Guide](/guide/integration-html) for more patterns.

### React

```jsx
import { useEffect, useRef, useState } from 'react';
import '@protspace/core';
import {
  readFileOptimized,
  extractRowsFromParquetBundle,
  convertParquetToVisualizationDataOptimized,
} from '@protspace/core';

export default function ProtSpaceViewer() {
  const plotRef = useRef(null);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState('Load a file to begin');

  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    try {
      setLoading(true);
      setStatus('Loading...');

      const arrayBuffer = await readFileOptimized(file);
      const rows = await extractRowsFromParquetBundle(arrayBuffer);
      const data = await convertParquetToVisualizationDataOptimized(rows);

      plotRef.current.data = data;
      plotRef.current.selectedProjectionIndex = 0;
      plotRef.current.selectedFeature = Object.keys(data.features)[0];

      setStatus(`Loaded ${data.proteins.length} proteins`);
    } catch (error) {
      setStatus(`Error: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: '20px' }}>
      <input type="file" accept=".parquetbundle" onChange={handleFileChange} />
      <div>{loading ? 'Loading...' : status}</div>

      <protspace-control-bar auto-sync="true" scatterplot-selector="#plot" />

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: '20px' }}>
        <protspace-scatterplot
          ref={plotRef}
          id="plot"
          show-grid="true"
          enable-zoom="true"
          enable-pan="true"
          enable-selection="true"
          style={{ height: '600px' }}
        />

        <div>
          <protspace-legend auto-sync="true" scatterplot-selector="#plot" />
          <protspace-structure-viewer
            auto-sync="true"
            scatterplot-selector="#plot"
            height="400px"
          />
        </div>
      </div>
    </div>
  );
}
```

See the [React Integration Guide](/guide/integration-react) for detailed information.

### Vue 3

```vue
<template>
  <div class="protspace-container">
    <input type="file" accept=".parquetbundle" @change="handleFileChange" />
    <div>{{ status }}</div>

    <protspace-control-bar auto-sync scatterplot-selector="#plot" />

    <div class="visualization">
      <protspace-scatterplot
        ref="plot"
        id="plot"
        show-grid
        enable-zoom
        enable-pan
        enable-selection
      />

      <div class="sidebar">
        <protspace-legend auto-sync scatterplot-selector="#plot" />
        <protspace-structure-viewer auto-sync scatterplot-selector="#plot" height="400px" />
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue';
import '@protspace/core';
import {
  readFileOptimized,
  extractRowsFromParquetBundle,
  convertParquetToVisualizationDataOptimized,
} from '@protspace/core';

const plot = ref(null);
const status = ref('Load a file to begin');

const handleFileChange = async (e) => {
  const file = e.target.files[0];
  if (!file) return;

  try {
    status.value = 'Loading...';

    const arrayBuffer = await readFileOptimized(file);
    const rows = await extractRowsFromParquetBundle(arrayBuffer);
    const data = await convertParquetToVisualizationDataOptimized(rows);

    plot.value.data = data;
    plot.value.selectedProjectionIndex = 0;
    plot.value.selectedFeature = Object.keys(data.features)[0];

    status.value = `Loaded ${data.proteins.length} proteins`;
  } catch (error) {
    status.value = `Error: ${error.message}`;
  }
};
</script>

<style scoped>
.visualization {
  display: grid;
  grid-template-columns: 1fr 300px;
  gap: 20px;
}

protspace-scatterplot {
  height: 600px;
}
</style>
```

See the [Vue Integration Guide](/guide/integration-vue) for detailed information.

## Common Patterns

### Drag and Drop

```javascript
const dropZone = document.getElementById('dropZone');

dropZone.addEventListener('dragover', (e) => {
  e.preventDefault();
  e.dataTransfer.dropEffect = 'copy';
});

dropZone.addEventListener('drop', async (e) => {
  e.preventDefault();
  const file = e.dataTransfer.files[0];

  if (file && file.name.endsWith('.parquetbundle')) {
    const arrayBuffer = await readFileOptimized(file);
    const rows = await extractRowsFromParquetBundle(arrayBuffer);
    const data = await convertParquetToVisualizationDataOptimized(rows);

    plot.data = data;
  }
});
```

### Loading from URL

```javascript
async function loadFromUrl(url) {
  const response = await fetch(url);
  const arrayBuffer = await response.arrayBuffer();
  const file = new File([arrayBuffer], 'data.parquetbundle');

  const buffer = await readFileOptimized(file);
  const rows = await extractRowsFromParquetBundle(buffer);
  const data = await convertParquetToVisualizationDataOptimized(rows);

  plot.data = data;
}

await loadFromUrl('./my-dataset.parquetbundle');
```

### Progressive Enhancement

```javascript
// Check if Web Components are supported
if ('customElements' in window) {
  // Load ProtSpace Web
  import('@protspace/core');
} else {
  // Fallback for older browsers
  document.getElementById('fallback').style.display = 'block';
}
```

## More Examples

- [HTML Integration](/guide/integration-html) - Detailed vanilla JS patterns
- [React Integration](/guide/integration-react) - React-specific examples
- [Vue Integration](/guide/integration-vue) - Vue 3 examples
- [API Reference](/api/) - Component API documentation

## Resources

- [Getting Started](/guide/getting-started) - Quick start guide
- [Data Preparation](/guide/data-preparation) - Generate your own data
- [User Guide](/guide/user-guide) - Feature documentation
