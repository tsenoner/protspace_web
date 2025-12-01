# HTML Integration

This guide shows how to integrate ProtSpace Web into vanilla HTML/JavaScript applications.

## Basic Setup

### Include via NPM

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
    <protspace-scatterplot id="plot"></protspace-scatterplot>
  </body>
</html>
```

### Include via CDN

```html
<!DOCTYPE html>
<html>
  <head>
    <script type="module" src="https://unpkg.com/@protspace/core"></script>
  </head>
  <body>
    <protspace-scatterplot id="plot"></protspace-scatterplot>
  </body>
</html>
```

## File Input Pattern

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
    <div id="status"></div>

    <protspace-control-bar auto-sync scatterplot-selector="#plot"></protspace-control-bar>
    <protspace-scatterplot id="plot" show-grid enable-zoom enable-pan></protspace-scatterplot>
    <protspace-legend auto-sync scatterplot-selector="#plot"></protspace-legend>

    <script type="module">
      const fileInput = document.getElementById('fileInput');
      const plot = document.getElementById('plot');
      const status = document.getElementById('status');

      fileInput.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        try {
          status.textContent = 'Loading...';

          const arrayBuffer = await readFileOptimized(file);
          const rows = await extractRowsFromParquetBundle(arrayBuffer);
          const data = await convertParquetToVisualizationDataOptimized(rows);

          plot.data = data;
          plot.selectedProjectionIndex = 0;
          plot.selectedFeature = Object.keys(data.features)[0];

          status.textContent = `Loaded ${data.proteins.length} proteins`;
        } catch (error) {
          status.textContent = `Error: ${error.message}`;
        }
      });
    </script>
  </body>
</html>
```

## Drag and Drop Pattern

```html
<div id="dropZone" style="border: 2px dashed #ccc; padding: 40px; text-align: center;">
  Drop .parquetbundle file here
</div>
<protspace-scatterplot id="plot"></protspace-scatterplot>

<script type="module">
  import {
    readFileOptimized,
    extractRowsFromParquetBundle,
    convertParquetToVisualizationDataOptimized,
  } from '@protspace/core';

  const dropZone = document.getElementById('dropZone');
  const plot = document.getElementById('plot');

  dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
    dropZone.style.borderColor = '#3498db';
  });

  dropZone.addEventListener('dragleave', () => {
    dropZone.style.borderColor = '#ccc';
  });

  dropZone.addEventListener('drop', async (e) => {
    e.preventDefault();
    dropZone.style.borderColor = '#ccc';

    const file = e.dataTransfer.files[0];
    if (!file || !file.name.endsWith('.parquetbundle')) {
      alert('Please drop a .parquetbundle file');
      return;
    }

    try {
      dropZone.textContent = 'Loading...';

      const arrayBuffer = await readFileOptimized(file);
      const rows = await extractRowsFromParquetBundle(arrayBuffer);
      const data = await convertParquetToVisualizationDataOptimized(rows);

      plot.data = data;
      plot.selectedProjectionIndex = 0;
      plot.selectedFeature = Object.keys(data.features)[0];

      dropZone.textContent = `Loaded ${data.proteins.length} proteins`;
    } catch (error) {
      dropZone.textContent = 'Drop file here';
      alert(`Error: ${error.message}`);
    }
  });
</script>
```

## Event Handling

```javascript
const plot = document.getElementById('plot');

// Selection changes
plot.addEventListener('selection-change', (e) => {
  console.log('Selected:', e.detail.selected.length);
});

// Point hover
plot.addEventListener('point-hover', (e) => {
  if (e.detail.protein) {
    showTooltip(e.detail.protein, e.detail.x, e.detail.y);
  } else {
    hideTooltip();
  }
});

// Point click
plot.addEventListener('point-click', (e) => {
  console.log('Clicked protein:', e.detail.protein.id);
});
```

## Complete Example

See [Examples](/examples/) for a complete working example.

## Next Steps

- [React Integration](/guide/integration-react)
- [Vue Integration](/guide/integration-vue)
- [API Reference](/api/)
