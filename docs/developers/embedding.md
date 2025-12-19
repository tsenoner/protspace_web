# Embedding Components

ProtSpace provides four web components that work in any HTML page or JavaScript framework.

## Components Overview

| Component        | Tag                            | Purpose                      |
| ---------------- | ------------------------------ | ---------------------------- |
| Scatterplot      | `<protspace-scatterplot>`      | Main 2D visualization        |
| Legend           | `<protspace-legend>`           | Category filtering           |
| Control Bar      | `<protspace-control-bar>`      | Projection/feature selection |
| Structure Viewer | `<protspace-structure-viewer>` | 3D protein structures        |

## Basic HTML Setup

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
  </head>
  <body>
    <input type="file" id="fileInput" accept=".parquetbundle" />

    <protspace-control-bar auto-sync scatterplot-selector="#plot"></protspace-control-bar>
    <protspace-scatterplot
      id="plot"
      show-grid
      enable-zoom
      enable-pan
      enable-selection
    ></protspace-scatterplot>
    <protspace-legend auto-sync scatterplot-selector="#plot" show-counts></protspace-legend>
    <protspace-structure-viewer
      auto-sync
      auto-show
      scatterplot-selector="#plot"
    ></protspace-structure-viewer>

    <script type="module">
      const fileInput = document.getElementById('fileInput');
      const plot = document.getElementById('plot');

      fileInput.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const arrayBuffer = await readFileOptimized(file);
        const rows = await extractRowsFromParquetBundle(arrayBuffer);
        const data = await convertParquetToVisualizationDataOptimized(rows);

        plot.data = data;
        plot.selectedProjectionIndex = 0;
        plot.selectedFeature = Object.keys(data.features)[0];
      });
    </script>
  </body>
</html>
```

## Auto-Sync Feature

Components with `auto-sync` attribute automatically communicate with the scatterplot:

```html
<protspace-scatterplot id="plot"></protspace-scatterplot>

<!-- These components auto-sync with #plot -->
<protspace-legend auto-sync scatterplot-selector="#plot"></protspace-legend>
<protspace-control-bar auto-sync scatterplot-selector="#plot"></protspace-control-bar>
<protspace-structure-viewer auto-sync scatterplot-selector="#plot"></protspace-structure-viewer>
```

## React Integration

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
  const [status, setStatus] = useState('Load a file to begin');

  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    try {
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
    }
  };

  return (
    <div>
      <input type="file" accept=".parquetbundle" onChange={handleFileChange} />
      <div>{status}</div>

      <protspace-control-bar auto-sync scatterplot-selector="#plot" />
      <protspace-scatterplot
        ref={plotRef}
        id="plot"
        show-grid
        enable-zoom
        enable-pan
        enable-selection
      />
      <protspace-legend auto-sync scatterplot-selector="#plot" />
      <protspace-structure-viewer auto-sync scatterplot-selector="#plot" />
    </div>
  );
}
```

## Vue 3 Integration

```vue
<template>
  <div>
    <input type="file" accept=".parquetbundle" @change="handleFileChange" />
    <div>{{ status }}</div>

    <protspace-control-bar auto-sync scatterplot-selector="#plot" />
    <protspace-scatterplot ref="plot" id="plot" show-grid enable-zoom enable-pan enable-selection />
    <protspace-legend auto-sync scatterplot-selector="#plot" />
    <protspace-structure-viewer auto-sync scatterplot-selector="#plot" />
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
```

## Event Handling

All components dispatch custom events:

```javascript
const plot = document.getElementById('plot');

// Selection changes
plot.addEventListener('selection-change', (e) => {
  console.log('Selected:', e.detail.selected);
  console.log('Added:', e.detail.added);
  console.log('Removed:', e.detail.removed);
});

// Point hover
plot.addEventListener('point-hover', (e) => {
  if (e.detail.protein) {
    console.log('Hovering:', e.detail.protein.id);
  }
});

// Point click
plot.addEventListener('point-click', (e) => {
  console.log('Clicked:', e.detail.protein.id);
});

// Legend category toggle
document.querySelector('protspace-legend').addEventListener('category-toggle', (e) => {
  console.log(`${e.detail.category}: ${e.detail.visible ? 'shown' : 'hidden'}`);
});
```

## Programmatic Control

```javascript
const plot = document.getElementById('plot');

// Select proteins
plot.selectProteins(['P12345', 'P67890']);

// Clear selection
plot.clearSelection();

// Reset view
plot.resetView();

// Export image
const imageData = plot.exportImage('png');
```

## Drag and Drop Pattern

```javascript
const plot = document.getElementById('plot');

plot.addEventListener('dragover', (e) => {
  e.preventDefault();
  e.dataTransfer.dropEffect = 'copy';
});

plot.addEventListener('drop', async (e) => {
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

## Loading from URL

```javascript
async function loadFromUrl(url) {
  const response = await fetch(url);
  const arrayBuffer = await response.arrayBuffer();
  const file = new File([arrayBuffer], 'data.parquetbundle');

  const buffer = await readFileOptimized(file);
  const rows = await extractRowsFromParquetBundle(buffer);
  const data = await convertParquetToVisualizationDataOptimized(rows);

  document.getElementById('plot').data = data;
}
```

## Next Steps

- [API Reference](/developers/api/) - Detailed component documentation
- [Contributing](/developers/contributing) - Development guide
