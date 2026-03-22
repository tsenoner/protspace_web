# Embedding Components

ProtSpace provides four web components that work in any HTML page or JavaScript framework.

## Components Overview

| Component        | Tag                            | Purpose                         |
| ---------------- | ------------------------------ | ------------------------------- |
| Scatterplot      | `<protspace-scatterplot>`      | Main 2D visualization           |
| Legend           | `<protspace-legend>`           | Category filtering              |
| Control Bar      | `<protspace-control-bar>`      | Projection/annotation selection |
| Structure Viewer | `<protspace-structure-viewer>` | 3D protein structures           |

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
        plot.selectedAnnotation = Object.keys(data.annotations)[0];
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

## Host Messaging Pattern

ProtSpace components emit semantic warning and error events, but the host application owns transient notifications.

```javascript
function notify({ level, title, description }) {
  // Replace this with your app's toast system.
  console[level === 'error' ? 'error' : 'log'](title, description ?? '');
}

const controlBar = document.querySelector('protspace-control-bar');
const dataLoader = document.querySelector('protspace-data-loader');
const legend = document.querySelector('protspace-legend');
const viewer = document.querySelector('protspace-structure-viewer');

controlBar.addEventListener('selection-disabled-notification', (event) => {
  notify({
    level: 'warning',
    title: 'Selection mode disabled.',
    description: event.detail.message,
  });
});

dataLoader.addEventListener('data-error', (event) => {
  notify({
    level: 'error',
    title: 'Dataset import failed.',
    description: event.detail.message,
  });
});

legend.addEventListener('legend-error', (event) => {
  notify({
    level: 'error',
    title: 'Legend update failed.',
    description: event.detail.message,
  });
});

viewer.addEventListener('structure-error', (event) => {
  notify({
    level: 'error',
    title: 'Structure could not be loaded.',
    description: event.detail.message,
  });
});
```

Keep structure viewer empty/loading/error messaging inline in the component itself instead of duplicating it with a global toast.

## React Integration

```jsx
import { useRef } from 'react';
import '@protspace/core';
import {
  readFileOptimized,
  extractRowsFromParquetBundle,
  convertParquetToVisualizationDataOptimized,
} from '@protspace/core';

export default function ProtSpaceViewer() {
  const plotRef = useRef(null);
  const notify = (level, title, description) => {
    console[level === 'error' ? 'error' : 'log'](title, description ?? '');
  };

  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    try {
      const arrayBuffer = await readFileOptimized(file);
      const rows = await extractRowsFromParquetBundle(arrayBuffer);
      const data = await convertParquetToVisualizationDataOptimized(rows);

      plotRef.current.data = data;
      plotRef.current.selectedProjectionIndex = 0;
      plotRef.current.selectedAnnotation = Object.keys(data.annotations)[0];

      notify('log', 'Dataset loaded.', `Loaded ${data.protein_ids.length} proteins.`);
    } catch (error) {
      notify(
        'error',
        'Dataset import failed.',
        error instanceof Error ? error.message : 'Unknown error',
      );
    }
  };

  return (
    <div>
      <input type="file" accept=".parquetbundle" onChange={handleFileChange} />

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
const notify = (level, title, description) => {
  console[level === 'error' ? 'error' : 'log'](title, description ?? '');
};

const handleFileChange = async (e) => {
  const file = e.target.files[0];
  if (!file) return;

  try {
    const arrayBuffer = await readFileOptimized(file);
    const rows = await extractRowsFromParquetBundle(arrayBuffer);
    const data = await convertParquetToVisualizationDataOptimized(rows);

    plot.value.data = data;
    plot.value.selectedProjectionIndex = 0;
    plot.value.selectedAnnotation = Object.keys(data.annotations)[0];

    notify('log', 'Dataset loaded.', `Loaded ${data.protein_ids.length} proteins.`);
  } catch (error) {
    notify(
      'error',
      'Dataset import failed.',
      error instanceof Error ? error.message : 'Unknown error',
    );
  }
};
</script>
```

## Event Handling

All components dispatch custom events, and host apps can choose how to surface semantic warning/error events:

```javascript
const plot = document.getElementById('plot');
const dataLoader = document.querySelector('protspace-data-loader');
const legend = document.querySelector('protspace-legend');
const viewer = document.querySelector('protspace-structure-viewer');

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

// Legend item interactions
legend.addEventListener('legend-item-click', (e) => {
  console.log(`${e.detail.value}: ${e.detail.action}`);
});

dataLoader.addEventListener('data-error', (e) => {
  console.error('Dataset import failed:', e.detail.message);
});

legend.addEventListener('legend-error', (e) => {
  console.error('Legend update failed:', e.detail.message);
});

viewer.addEventListener('structure-error', (e) => {
  console.error('Structure could not be loaded:', e.detail.message);
});
```

For the ownership model behind these events, see [Messaging Conventions](/developers/messaging).

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
