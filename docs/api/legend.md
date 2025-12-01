# Legend Component

The `<protspace-legend>` component displays feature categories with colors and allows filtering through interactive controls.

## Basic Usage

```html
<protspace-legend auto-sync scatterplot-selector="#plot" show-counts></protspace-legend>
```

## Properties

| Property              | Type                | Default                   | Description                                         |
| --------------------- | ------------------- | ------------------------- | --------------------------------------------------- |
| `autoSync`            | `boolean`           | `true`                    | Automatically sync with scatterplot                 |
| `scatterplotSelector` | `string`            | `'protspace-scatterplot'` | CSS selector for target scatterplot                 |
| `autoHide`            | `boolean`           | `true`                    | Automatically hide/show values in scatterplot       |
| `featureName`         | `string`            | `''`                      | Name of the currently displayed feature             |
| `featureData`         | `LegendFeatureData` | `{}`                      | Feature data including values, colors, shapes       |
| `maxVisibleValues`    | `number`            | `10`                      | Maximum number of values to display before grouping |
| `includeOthers`       | `boolean`           | `true`                    | Group less frequent values into "Others"            |
| `includeShapes`       | `boolean`           | `true`                    | Display shape indicators for categories             |
| `shapeSize`           | `number`            | `16`                      | Size of shape indicators in pixels                  |
| `isolationMode`       | `boolean`           | `false`                   | Whether a category is isolated (showing only one)   |

## Attributes

| Attribute              | Type    | Description                                       |
| ---------------------- | ------- | ------------------------------------------------- |
| `auto-sync`            | Boolean | Enable automatic synchronization with scatterplot |
| `scatterplot-selector` | String  | CSS selector to find the target scatterplot       |
| `auto-hide`            | Boolean | Automatically apply visibility changes to plot    |

## Methods

### toggleValue(value)

Toggle the visibility of a specific category value.

```javascript
const legend = document.querySelector('protspace-legend');
legend.toggleValue('Kinase');
```

**Parameters:**

- `value` (string): The category value to toggle

### isolateValue(value)

Show only the specified category value (hide all others).

```javascript
legend.isolateValue('Kinase');
```

**Parameters:**

- `value` (string): The category value to isolate

### showAllValues()

Show all category values (clear isolation/filtering).

```javascript
legend.showAllValues();
```

### getVisibleValues()

Get array of currently visible category values.

```javascript
const visible = legend.getVisibleValues();
console.log('Visible categories:', visible);
```

**Returns:** `string[]`

### getHiddenValues()

Get array of currently hidden category values.

```javascript
const hidden = legend.getHiddenValues();
console.log('Hidden categories:', hidden);
```

**Returns:** `string[]`

## Events

### category-toggle

Fired when a category's visibility is toggled.

```javascript
legend.addEventListener('category-toggle', (e) => {
  console.log(`Category: ${e.detail.category}`);
  console.log(`Visible: ${e.detail.visible}`);
});
```

**Detail:**

```typescript
{
  category: string;
  visible: boolean;
}
```

### category-isolate

Fired when a category is isolated (double-click).

```javascript
legend.addEventListener('category-isolate', (e) => {
  console.log(`Isolated: ${e.detail.category}`);
});
```

**Detail:**

```typescript
{
  category: string;
}
```

### all-visible

Fired when all categories are made visible.

```javascript
legend.addEventListener('all-visible', (e) => {
  console.log('All categories now visible');
});
```

### legend-change

Fired when legend state changes (visibility, order, etc.).

```javascript
legend.addEventListener('legend-change', (e) => {
  console.log('Hidden values:', e.detail.hiddenValues);
});
```

**Detail:**

```typescript
{
  hiddenValues: string[];
  isolationMode: boolean;
}
```

## Interaction Patterns

### Click to Toggle

Click any category to toggle its visibility:

```javascript
// Categories default to visible
// Click once → hidden
// Click again → visible
```

### Double-Click to Isolate

Double-click a category to show only that category:

```javascript
// Double-click "Kinase" → hides all except Kinase
// Double-click again → shows all categories
```

### Drag to Reorder

Drag categories to reorder them in the legend:

```javascript
// Click and hold on a category
// Drag up or down
// Release to set new position
```

## Auto-Sync Behavior

When `auto-sync` is enabled, the legend:

1. **Queries for scatterplot**: Finds the target using `scatterplot-selector`
2. **Listens for changes**: Updates when feature or data changes
3. **Applies filtering**: Automatically hides/shows points in the plot
4. **Syncs state**: Maintains consistent visibility across components

```html
<!-- Auto-sync example -->
<protspace-scatterplot id="plot"></protspace-scatterplot>
<protspace-legend auto-sync scatterplot-selector="#plot"></protspace-legend>
```

## Styling

The legend uses Shadow DOM and CSS custom properties:

```css
protspace-legend {
  --legend-bg: white;
  --legend-border: #ddd;
  --legend-text: #333;
  --legend-hover: #f5f5f5;
  --legend-hidden: #ccc;

  width: 300px;
  border: 1px solid var(--legend-border);
  border-radius: 8px;
  padding: 10px;
}
```

### Custom Styling Example

```html
<style>
  protspace-legend {
    --legend-bg: #f9f9f9;
    --legend-border: #2c3e50;
    --legend-text: #2c3e50;
    --legend-hover: #ecf0f1;
    --legend-hidden: #95a5a6;

    font-family: 'Arial', sans-serif;
    max-height: 500px;
    overflow-y: auto;
  }
</style>
```

## Multi-Label Features

For features with multiple values per protein (e.g., GO terms), the legend displays all unique values:

```javascript
// Example: protein has "Kinase;Transferase"
// Legend shows both:
// ● Kinase
// ● Transferase

// Clicking either will affect proteins with that value
```

## "Others" Grouping

When there are many unique values, less frequent ones are grouped:

```html
<protspace-legend max-visible-values="10"></protspace-legend>
```

- Shows top 10 most frequent categories
- Groups remaining into "Others"
- Click "Others" to expand and see all grouped values

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
      .container {
        display: grid;
        grid-template-columns: 1fr 300px;
        gap: 20px;
      }

      protspace-scatterplot {
        height: 600px;
        border: 1px solid #ddd;
      }

      protspace-legend {
        --legend-bg: white;
        --legend-border: #ddd;
        border: 1px solid var(--legend-border);
        padding: 15px;
        border-radius: 8px;
        max-height: 600px;
        overflow-y: auto;
      }
    </style>
  </head>
  <body>
    <input type="file" id="fileInput" accept=".parquetbundle" />

    <div class="container">
      <protspace-scatterplot
        id="plot"
        show-grid
        enable-zoom
        enable-pan
        enable-selection
      ></protspace-scatterplot>

      <protspace-legend
        id="legend"
        auto-sync
        auto-hide
        scatterplot-selector="#plot"
        max-visible-values="15"
      ></protspace-legend>
    </div>

    <script type="module">
      const fileInput = document.getElementById('fileInput');
      const plot = document.getElementById('plot');
      const legend = document.getElementById('legend');

      // Load data
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

      // Monitor legend events
      legend.addEventListener('category-toggle', (e) => {
        console.log(`${e.detail.category}: ${e.detail.visible ? 'shown' : 'hidden'}`);
      });

      legend.addEventListener('category-isolate', (e) => {
        console.log(`Isolated: ${e.detail.category}`);
      });

      legend.addEventListener('all-visible', () => {
        console.log('All categories visible');
      });
    </script>
  </body>
</html>
```

## Programmatic Control

```javascript
const legend = document.getElementById('legend');

// Hide specific categories
legend.toggleValue('Unknown');
legend.toggleValue('Not annotated');

// Isolate a category
legend.isolateValue('Kinase');

// Show all
legend.showAllValues();

// Get current state
const visible = legend.getVisibleValues();
const hidden = legend.getHiddenValues();
console.log('Visible:', visible);
console.log('Hidden:', hidden);
```

## TypeScript Support

```typescript
import type { ProtspaceLegend } from '@protspace/core';

const legend = document.getElementById('legend') as ProtspaceLegend;

legend.addEventListener('category-toggle', (e: CustomEvent) => {
  const { category, visible } = e.detail;
  console.log(`${category}: ${visible}`);
});
```

## Accessibility

The legend supports keyboard navigation:

- **Tab**: Navigate between categories
- **Space**: Toggle category visibility
- **Enter**: Isolate category (show only this one)
- **Escape**: Show all categories

## Best Practices

### Performance

For large datasets with many unique values:

```html
<!-- Limit visible categories -->
<protspace-legend max-visible-values="20"></protspace-legend>
```

### User Experience

```html
<!-- Enable auto-hide for immediate feedback -->
<protspace-legend auto-hide="true"></protspace-legend>

<!-- Show shapes for better distinction -->
<protspace-legend include-shapes="true"></protspace-legend>
```

### Integration

Always use with `auto-sync` for seamless integration:

```html
<protspace-legend auto-sync scatterplot-selector="#plot"></protspace-legend>
```

## Known Limitations

- Maximum recommended unique values: ~1000 (may slow down with more)
- Shape rendering uses SVG (may impact performance on very large legends)
- Drag-and-drop reordering not supported on touch devices

## Next Steps

- [Scatterplot API](/api/scatterplot) - Main visualization component
- [Control Bar API](/api/control-bar) - Control panel
- [Structure Viewer API](/api/structure-viewer) - 3D structures
- [API Overview](/api/) - All components
