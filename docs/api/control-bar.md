# Control Bar Component

The `<protspace-control-bar>` component provides UI controls for projection selection, feature selection, search, and export functionality.

## Basic Usage

```html
<protspace-control-bar auto-sync scatterplot-selector="#plot"></protspace-control-bar>
```

## Properties

| Property                | Type                       | Default                   | Description                           |
| ----------------------- | -------------------------- | ------------------------- | ------------------------------------- |
| `autoSync`              | `boolean`                  | `true`                    | Automatically sync with scatterplot   |
| `scatterplotSelector`   | `string`                   | `'protspace-scatterplot'` | CSS selector for target scatterplot   |
| `projections`           | `string[]`                 | `[]`                      | Available projection methods          |
| `features`              | `string[]`                 | `[]`                      | Available features for coloring       |
| `selectedProjection`    | `string`                   | `''`                      | Currently selected projection         |
| `selectedFeature`       | `string`                   | `''`                      | Currently selected feature            |
| `projectionPlane`       | `'xy'` \| `'xz'` \| `'yz'` | `'xy'`                    | Active plane for 3D projections       |
| `selectionMode`         | `boolean`                  | `false`                   | Whether selection mode is active      |
| `selectedProteinsCount` | `number`                   | `0`                       | Number of currently selected proteins |
| `isolationMode`         | `boolean`                  | `false`                   | Whether data isolation is active      |

## Attributes

| Attribute              | Type    | Description                         |
| ---------------------- | ------- | ----------------------------------- |
| `auto-sync`            | Boolean | Enable automatic synchronization    |
| `scatterplot-selector` | String  | CSS selector for target scatterplot |
| `selected-projection`  | String  | Currently selected projection       |
| `selected-feature`     | String  | Currently selected feature          |

## Methods

### setProjection(projectionName)

Set the active projection method.

```javascript
const controlBar = document.querySelector('protspace-control-bar');
controlBar.setProjection('UMAP');
```

**Parameters:**

- `projectionName` (string): Name of the projection to activate

### setFeature(featureName)

Set the active feature for coloring.

```javascript
controlBar.setFeature('family');
```

**Parameters:**

- `featureName` (string): Name of the feature to use for coloring

### exportImage(format)

Trigger image export from the scatterplot.

```javascript
await controlBar.exportImage('png'); // or 'svg'
```

**Parameters:**

- `format` ('png' | 'svg'): Image format

### exportData(format)

Trigger data export.

```javascript
await controlBar.exportData('json'); // or 'csv'
```

**Parameters:**

- `format` ('json' | 'csv'): Data format

### clearSelection()

Clear the current protein selection.

```javascript
controlBar.clearSelection();
```

## Events

### projection-change

Fired when the selected projection changes.

```javascript
controlBar.addEventListener('projection-change', (e) => {
  console.log('New projection:', e.detail.projection);
});
```

**Detail:**

```typescript
{
  projection: string;
}
```

### feature-change

Fired when the selected feature changes.

```javascript
controlBar.addEventListener('feature-change', (e) => {
  console.log('New feature:', e.detail.feature);
});
```

**Detail:**

```typescript
{
  feature: string;
}
```

### plane-change

Fired when the projection plane changes (for 3D projections).

```javascript
controlBar.addEventListener('plane-change', (e) => {
  console.log('New plane:', e.detail.plane);
});
```

**Detail:**

```typescript
{
  plane: 'xy' | 'xz' | 'yz';
}
```

### search

Fired when a search is performed.

```javascript
controlBar.addEventListener('search', (e) => {
  console.log('Search query:', e.detail.query);
  console.log('Results:', e.detail.results);
});
```

**Detail:**

```typescript
{
  query: string;
  results: string[];  // Array of matching protein IDs
}
```

### export-request

Fired when export is requested.

```javascript
controlBar.addEventListener('export-request', (e) => {
  console.log('Export type:', e.detail.type);
  console.log('Export format:', e.detail.format);
});
```

**Detail:**

```typescript
{
  type: 'image' | 'data';
  format: string; // 'png', 'svg', 'json', 'csv'
}
```

### selection-clear

Fired when the selection is cleared.

```javascript
controlBar.addEventListener('selection-clear', (e) => {
  console.log('Selection cleared');
});
```

## Features

### Projection Selection

Dropdown menu for switching between dimensionality reduction methods:

```html
<protspace-control-bar></protspace-control-bar>

<!-- User can select from: PCA, UMAP, t-SNE, MDS, PaCMAP -->
```

For 3D projections, an additional plane selector appears:

- XY plane
- XZ plane
- YZ plane

### Feature Selection

Dropdown menu for choosing which feature to use for point coloring:

```javascript
// Example features: taxonomy, family, length, GO_terms
```

### Search Functionality

Built-in search for finding specific proteins:

```html
<protspace-control-bar></protspace-control-bar>

<!-- User can type protein IDs or names -->
<!-- Matching proteins are highlighted in the plot -->
```

**Search capabilities:**

- Case-insensitive matching
- Partial ID matching
- Multiple selection support
- Clear individual selections
- Clear all button

### Export Options

**Image Export:**

- PNG (raster, high resolution)
- SVG (vector, scalable)

**Data Export:**

- JSON (structured data with metadata)
- CSV (tabular format for spreadsheets)

### Selection Controls

- Clear selection button
- Selection count display
- Selection mode indicator

## Auto-Sync Behavior

When `auto-sync` is enabled, the control bar:

1. **Queries for scatterplot**: Finds target using `scatterplot-selector`
2. **Syncs dropdowns**: Updates projection/feature lists from data
3. **Applies changes**: Directly modifies scatterplot state
4. **Monitors selection**: Updates selection count automatically
5. **Handles exports**: Coordinates with scatterplot for exports

```html
<protspace-scatterplot id="plot"></protspace-scatterplot>
<protspace-control-bar auto-sync scatterplot-selector="#plot"></protspace-control-bar>
```

## Styling

The control bar uses Shadow DOM with CSS custom properties:

```css
protspace-control-bar {
  --control-bar-bg: white;
  --control-bar-border: #ddd;
  --control-bar-text: #333;
  --control-bar-primary: #3498db;
  --control-bar-hover: #2980b9;

  display: block;
  padding: 10px;
  background: var(--control-bar-bg);
  border: 1px solid var(--control-bar-border);
  border-radius: 8px;
}
```

### Custom Styling Example

```html
<style>
  protspace-control-bar {
    --control-bar-bg: #2c3e50;
    --control-bar-text: white;
    --control-bar-primary: #3498db;
    --control-bar-hover: #2980b9;

    font-family: 'Arial', sans-serif;
    padding: 15px;
  }
</style>
```

## Complete Example

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
        margin: 0;
        padding: 20px;
        font-family: system-ui;
      }
      .container {
        display: flex;
        flex-direction: column;
        gap: 15px;
      }
      .header {
        display: flex;
        gap: 10px;
        align-items: center;
      }

      protspace-control-bar {
        --control-bar-bg: white;
        --control-bar-border: #ddd;
        border: 1px solid var(--control-bar-border);
        padding: 10px;
        border-radius: 8px;
      }

      protspace-scatterplot {
        height: 600px;
        border: 1px solid #ddd;
        border-radius: 8px;
      }
    </style>
  </head>
  <body>
    <div class="container">
      <div class="header">
        <input type="file" id="fileInput" accept=".parquetbundle" />
        <span id="status">Load a file to begin</span>
      </div>

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

    <script type="module">
      const fileInput = document.getElementById('fileInput');
      const plot = document.getElementById('plot');
      const controlBar = document.getElementById('controlBar');
      const status = document.getElementById('status');

      // Load data
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

      // Monitor control bar events
      controlBar.addEventListener('projection-change', (e) => {
        console.log('Projection changed to:', e.detail.projection);
        status.textContent = `Projection: ${e.detail.projection}`;
      });

      controlBar.addEventListener('feature-change', (e) => {
        console.log('Feature changed to:', e.detail.feature);
        status.textContent = `Coloring by: ${e.detail.feature}`;
      });

      controlBar.addEventListener('search', (e) => {
        console.log('Search results:', e.detail.results);
        status.textContent = `Found ${e.detail.results.length} proteins`;
      });

      controlBar.addEventListener('export-request', async (e) => {
        status.textContent = `Exporting ${e.detail.format}...`;
        // Export handled automatically via auto-sync
      });
    </script>
  </body>
</html>
```

## Programmatic Control

```javascript
const controlBar = document.getElementById('controlBar');

// Change projection
controlBar.setProjection('UMAP');

// Change feature
controlBar.setFeature('taxonomy');

// For 3D projections, change plane
if (is3DProjection) {
  controlBar.projectionPlane = 'xz';
}

// Export
await controlBar.exportImage('png');
await controlBar.exportData('json');

// Clear selection
controlBar.clearSelection();
```

## TypeScript Support

```typescript
import type { ProtspaceControlBar } from '@protspace/core';

const controlBar = document.getElementById('controlBar') as ProtspaceControlBar;

controlBar.addEventListener('projection-change', (e: CustomEvent) => {
  const { projection } = e.detail;
  console.log(`Changed to: ${projection}`);
});
```

## Search Functionality Details

The built-in search component provides:

### Features

- **Autocomplete**: Suggestions as you type
- **Fuzzy matching**: Finds partial matches
- **Multiple selection**: Select multiple proteins
- **Visual feedback**: Chips show selected proteins
- **Clear options**: Remove individual or all selections

### Usage

```javascript
// Search is automatically available in the control bar
// User interactions trigger 'search' events

controlBar.addEventListener('search', (e) => {
  const { query, results } = e.detail;

  // Results contain matching protein IDs
  console.log(`Found ${results.length} matches for "${query}"`);

  // Selected proteins are automatically highlighted in the plot
});
```

## Export Functionality Details

### Image Export

```javascript
// User clicks export → image → PNG/SVG
// Or programmatically:
const blob = await controlBar.exportImage('png');

// Save to file
const url = URL.createObjectURL(blob);
const a = document.createElement('a');
a.href = url;
a.download = `protspace-${Date.now()}.png`;
a.click();
```

### Data Export

```javascript
// Export current selection or all visible proteins
const data = await controlBar.exportData('json');

// JSON format includes:
// - Protein IDs
// - Coordinates
// - Features
// - Selection state
```

## Accessibility

The control bar supports keyboard navigation:

- **Tab**: Navigate between controls
- **Enter/Space**: Activate dropdowns
- **Arrow keys**: Navigate dropdown options
- **Escape**: Close dropdowns
- **Ctrl+F**: Focus search

## Best Practices

### Layout

Position the control bar above or beside the scatterplot:

```html
<!-- Horizontal layout -->
<div style="display: flex; flex-direction: column;">
  <protspace-control-bar></protspace-control-bar>
  <protspace-scatterplot></protspace-scatterplot>
</div>
```

### Auto-Sync

Always use auto-sync for automatic coordination:

```html
<protspace-control-bar auto-sync scatterplot-selector="#plot"></protspace-control-bar>
```

### Responsive Design

The control bar adapts to container width. For narrow containers, consider stacking controls vertically.

## Known Limitations

- Search requires protein IDs to be loaded (after data is set)
- Export functions require WebGL context to be available
- 3D projection plane selection only appears for 3D projections

## Next Steps

- [Scatterplot API](/api/scatterplot) - Main visualization
- [Legend API](/api/legend) - Category filtering
- [Structure Viewer API](/api/structure-viewer) - 3D structures
- [API Overview](/api/) - All components
