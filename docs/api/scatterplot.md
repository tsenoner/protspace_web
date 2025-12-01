# Scatterplot Component

The `<protspace-scatterplot>` component renders the 2D scatter plot visualization using the Canvas API for optimal performance.

## Basic Usage

```html
<protspace-scatterplot
  id="plot"
  show-grid
  enable-zoom
  enable-pan
  enable-selection
></protspace-scatterplot>
```

## Properties

| Property                  | Type                | Default | Description                                          |
| ------------------------- | ------------------- | ------- | ---------------------------------------------------- |
| `data`                    | `VisualizationData` | `null`  | The protein dataset to visualize                     |
| `selectedProjectionIndex` | `number`            | `0`     | Index of active projection method                    |
| `selectedFeature`         | `string`            | `''`    | Currently selected feature for coloring              |
| `pointSize`               | `number`            | `6`     | Size of protein points in pixels                     |
| `pointOpacity`            | `number`            | `0.8`   | Base opacity of points (0-1)                         |
| `selectedOpacity`         | `number`            | `1.0`   | Opacity of selected points                           |
| `fadedOpacity`            | `number`            | `0.2`   | Opacity of non-selected points when selection active |

## Attributes

| Attribute          | Type    | Description                        |
| ------------------ | ------- | ---------------------------------- |
| `show-grid`        | Boolean | Display background grid lines      |
| `show-axes`        | Boolean | Display coordinate axes            |
| `enable-zoom`      | Boolean | Enable mouse wheel zoom (30%-500%) |
| `enable-pan`       | Boolean | Enable click-and-drag panning      |
| `enable-selection` | Boolean | Enable point selection on click    |

## Methods

### selectProteins(ids)

Select proteins programmatically by their IDs.

```javascript
const plot = document.querySelector('protspace-scatterplot');
plot.selectProteins(['P12345', 'P67890', 'Q54321']);
```

**Parameters:**

- `ids` (string[]): Array of protein identifiers

### clearSelection()

Clear all current selections.

```javascript
plot.clearSelection();
```

### resetView()

Reset zoom and pan to the default view showing all proteins.

```javascript
plot.resetView();
```

### exportImage(format)

Export the current view as an image.

```javascript
const blob = await plot.exportImage('png'); // or 'svg'

// Download the image
const url = URL.createObjectURL(blob);
const a = document.createElement('a');
a.href = url;
a.download = 'protspace-export.png';
a.click();
```

**Parameters:**

- `format` ('png' | 'svg'): Image format

**Returns:** `Promise<Blob>`

### getVisibleProteins()

Get array of currently visible proteins (respects legend filtering).

```javascript
const visible = plot.getVisibleProteins();
console.log(`${visible.length} proteins visible`);
```

**Returns:** `Protein[]`

### getSelectedProteins()

Get array of currently selected proteins.

```javascript
const selected = plot.getSelectedProteins();
selected.forEach((p) => console.log(p.id));
```

**Returns:** `Protein[]`

### zoomTo(x, y, scale)

Zoom to specific coordinates with given scale.

```javascript
plot.zoomTo(0, 0, 2.0); // Center at origin, 2x zoom
```

**Parameters:**

- `x` (number): X coordinate
- `y` (number): Y coordinate
- `scale` (number): Zoom level (1.0 = 100%)

### panToProtein(id)

Pan the view to center on a specific protein.

```javascript
plot.panToProtein('P12345');
```

**Parameters:**

- `id` (string): Protein identifier

## Events

### point-hover

Fired when hovering over a protein point.

```javascript
plot.addEventListener('point-hover', (e) => {
  if (e.detail.protein) {
    console.log('Hovering:', e.detail.protein.id);
  } else {
    console.log('Not hovering any point');
  }
});
```

**Detail:**

```typescript
{
  protein: Protein | null;
  x: number; // Mouse X position
  y: number; // Mouse Y position
}
```

### point-click

Fired when clicking on a protein point.

```javascript
plot.addEventListener('point-click', (e) => {
  console.log('Clicked:', e.detail.protein.id);
  console.log('Features:', e.detail.protein.features);
});
```

**Detail:**

```typescript
{
  protein: Protein;
  x: number; // Click X position
  y: number; // Click Y position
}
```

### selection-change

Fired when the selection changes.

```javascript
plot.addEventListener('selection-change', (e) => {
  console.log(
    'Selected proteins:',
    e.detail.selected.map((p) => p.id),
  );
  console.log(
    'Added:',
    e.detail.added.map((p) => p.id),
  );
  console.log(
    'Removed:',
    e.detail.removed.map((p) => p.id),
  );
});
```

**Detail:**

```typescript
{
  selected: Protein[];  // All currently selected
  added: Protein[];     // Newly added to selection
  removed: Protein[];   // Removed from selection
}
```

### view-change

Fired when zoom or pan changes.

```javascript
plot.addEventListener('view-change', (e) => {
  console.log('Zoom:', e.detail.zoom);
  console.log('Pan:', e.detail.panX, e.detail.panY);
});
```

**Detail:**

```typescript
{
  zoom: number;
  panX: number;
  panY: number;
  bounds: {
    minX: number;
    maxX: number;
    minY: number;
    maxY: number;
  }
}
```

### projection-change

Fired when the active projection changes.

```javascript
plot.addEventListener('projection-change', (e) => {
  console.log('New projection:', e.detail.projection.method);
});
```

**Detail:**

```typescript
{
  projection: Projection;
  index: number;
}
```

### feature-change

Fired when the coloring feature changes.

```javascript
plot.addEventListener('feature-change', (e) => {
  console.log('New feature:', e.detail.feature);
});
```

**Detail:**

```typescript
{
  feature: string;
}
```

## Styling

The component uses Shadow DOM. Style the host element:

```css
protspace-scatterplot {
  width: 100%;
  height: 500px;
  border: 1px solid #ddd;
  border-radius: 8px;
  background: white;
}
```

## Example: Complete Setup with Data Loading

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
      protspace-scatterplot {
        width: 100%;
        height: 600px;
        border: 1px solid #ddd;
      }
    </style>
  </head>
  <body>
    <input type="file" id="fileInput" accept=".parquetbundle" />

    <protspace-scatterplot
      id="plot"
      show-grid
      enable-zoom
      enable-pan
      enable-selection
    ></protspace-scatterplot>

    <script type="module">
      const fileInput = document.getElementById('fileInput');
      const plot = document.getElementById('plot');

      // Load data
      fileInput.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        try {
          // Read and parse the parquet bundle
          const arrayBuffer = await readFileOptimized(file);
          const rows = await extractRowsFromParquetBundle(arrayBuffer);
          const data = await convertParquetToVisualizationDataOptimized(rows);

          // Set data on the plot
          plot.data = data;
          plot.selectedProjectionIndex = 0;
          plot.selectedFeature = Object.keys(data.features)[0] || '';

          // Customize appearance
          plot.pointSize = 8;
          plot.pointOpacity = 0.7;

          console.log(`Loaded ${data.proteins.length} proteins`);
        } catch (error) {
          console.error('Failed to load data:', error);
        }
      });

      // Listen for events
      plot.addEventListener('selection-change', (e) => {
        console.log(`Selected: ${e.detail.selected.length} proteins`);
      });

      plot.addEventListener('point-hover', (e) => {
        if (e.detail.protein) {
          // Show tooltip with protein info
          console.log('Hovering:', e.detail.protein.id);
        }
      });

      plot.addEventListener('view-change', (e) => {
        console.log(`Zoom: ${e.detail.zoom.toFixed(2)}x`);
      });
    </script>
  </body>
</html>
```

## Example: Programmatic Control

```javascript
import '@protspace/core';
import {
  readFileOptimized,
  extractRowsFromParquetBundle,
  convertParquetToVisualizationDataOptimized,
} from '@protspace/core';

// Get the plot element
const plot = document.getElementById('plot');

// Load data from URL
const response = await fetch('./data.parquetbundle');
const arrayBuffer = await response.arrayBuffer();
const file = new File([arrayBuffer], 'data.parquetbundle');

const buffer = await readFileOptimized(file);
const rows = await extractRowsFromParquetBundle(buffer);
const data = await convertParquetToVisualizationDataOptimized(rows);

// Set data
plot.data = data;

// Configure visualization
plot.selectedProjectionIndex = 1; // Use second projection (e.g., UMAP)
plot.selectedFeature = 'family'; // Color by family
plot.pointSize = 5;
plot.pointOpacity = 0.8;

// Select specific proteins
plot.selectProteins(['P12345', 'P67890']);

// Pan to a protein
plot.panToProtein('P12345');

// Export the current view
const blob = await plot.exportImage('png');
const url = URL.createObjectURL(blob);
console.log('Export URL:', url);
```

## Performance Considerations

### Large Datasets

For datasets with >100,000 proteins:

1. **Reduce point size**: Smaller points render faster

   ```javascript
   plot.pointSize = 3;
   ```

2. **Disable selection temporarily**: During pan/zoom

   ```javascript
   plot.enableSelection = false;
   ```

3. **Use simpler projections**: PCA is faster than t-SNE

### Interaction Optimization

The component automatically:

- Uses requestAnimationFrame for smooth rendering
- Implements spatial indexing for fast hit detection
- Batches rendering updates
- Uses WebGL when available

### Memory Management

```javascript
// Clear data when no longer needed
plot.data = null;

// Or remove from DOM
plot.remove();
```

## Accessibility

The scatterplot supports keyboard navigation:

- **Tab**: Focus the plot
- **Arrow keys**: Pan the view
- **+/-**: Zoom in/out
- **Home**: Reset view
- **Escape**: Clear selection

## Known Limitations

- Maximum recommended dataset size: 500,000 proteins
- 3D projections require WebGL 2.0
- Safari may have reduced performance compared to Chrome
- Very dense clusters may overlap (use zoom to resolve)

## Next Steps

- [Legend API](/api/legend) - Filter and color categories
- [Control Bar API](/api/control-bar) - UI controls
- [Structure Viewer API](/api/structure-viewer) - 3D structures
- [Data Loading](/api/data-loading) - Data loading utilities
