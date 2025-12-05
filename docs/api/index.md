# API Reference

ProtSpace provides four main web components that work together to create interactive protein embedding visualizations.

## Component Overview

| Component                                 | Tag Name                       | Purpose                                  |
| ----------------------------------------- | ------------------------------ | ---------------------------------------- |
| [Scatterplot](/api/scatterplot)           | `<protspace-scatterplot>`      | Render 2D/3D visualization with canvas   |
| [Legend](/api/legend)                     | `<protspace-legend>`           | Filter and color categories              |
| [Control Bar](/api/control-bar)           | `<protspace-control-bar>`      | Switch projections, features, and export |
| [Structure Viewer](/api/structure-viewer) | `<protspace-structure-viewer>` | Display 3D protein structures            |

## Quick Reference

### Scatterplot

```html
<protspace-scatterplot
  id="plot"
  show-grid
  enable-zoom
  enable-pan
  enable-selection
></protspace-scatterplot>
```

**Key Properties**: `data`, `selectedProjectionIndex`, `selectedFeature`, `pointSize`, `pointOpacity`

**Key Methods**: `selectProteins()`, `clearSelection()`, `resetView()`, `exportImage()`

**Key Events**: `point-hover`, `point-click`, `selection-change`, `view-change`

### Legend

```html
<protspace-legend auto-sync scatterplot-selector="#plot" show-counts></protspace-legend>
```

**Key Properties**: `autoSync`, `scatterplotSelector`, `showCounts`, `autoHide`

**Key Events**: `category-toggle`, `category-isolate`, `all-visible`

### Control Bar

```html
<protspace-control-bar
  auto-sync
  scatterplot-selector="#plot"
  show-projection-select
  show-feature-select
  show-export
></protspace-control-bar>
```

**Key Properties**: `autoSync`, `scatterplotSelector`, `selectedProjection`, `selectedFeature`

**Key Events**: `projection-change`, `feature-change`, `search`, `export-request`

### Structure Viewer

```html
<protspace-structure-viewer
  auto-sync
  auto-show
  scatterplot-selector="#plot"
  height="400px"
></protspace-structure-viewer>
```

**Key Properties**: `proteinId`, `title`, `height`, `autoSync`, `autoShow`

**Key Events**: `structure-load`, `structure-error`, `structure-close`

## Data Loading Utilities

ProtSpace uses programmatic data loading. See [Data Loading](/api/data-loading) for utilities:

- `readFileOptimized(file)` - Efficiently read large files
- `isParquetBundle(arrayBuffer)` - Validate bundle format
- `extractRowsFromParquetBundle(arrayBuffer)` - Extract data from bundle
- `convertParquetToVisualizationDataOptimized(rows)` - Convert to visualization format

## Auto-Sync Feature

Components with the `auto-sync` attribute automatically listen to changes in the target scatterplot and update accordingly. Use the `scatterplot-selector` attribute to specify which scatterplot to sync with.

```html
<!-- These components auto-sync with #plot -->
<protspace-legend auto-sync scatterplot-selector="#plot"></protspace-legend>
<protspace-control-bar auto-sync scatterplot-selector="#plot"></protspace-control-bar>
<protspace-structure-viewer auto-sync scatterplot-selector="#plot"></protspace-structure-viewer>

<!-- Target scatterplot -->
<protspace-scatterplot id="plot"></protspace-scatterplot>
```

**How it works:**

1. Auto-sync components query the DOM for the target scatterplot
2. They listen for state changes via custom events
3. They automatically update their UI when data/selection changes
4. They can also control the scatterplot (change projection, feature, etc.)

## Event Handling

All components dispatch custom events that bubble up through the DOM:

```javascript
// Listen for selection changes
document.querySelector('#plot').addEventListener('selection-change', (e) => {
  console.log('Selected:', e.detail.selected);
  console.log('Added:', e.detail.added);
  console.log('Removed:', e.detail.removed);
});

// Listen for category toggles
document.querySelector('protspace-legend').addEventListener('category-toggle', (e) => {
  console.log(`${e.detail.category}: ${e.detail.visible ? 'shown' : 'hidden'}`);
});

// Listen for projection changes
document.querySelector('protspace-control-bar').addEventListener('projection-change', (e) => {
  console.log('New projection:', e.detail.projection);
});

// Listen for structure loading
document.querySelector('protspace-structure-viewer').addEventListener('structure-load', (e) => {
  console.log('Loaded structure for:', e.detail.proteinId);
});
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
      .container {
        display: grid;
        grid-template-rows: auto 1fr;
        height: 100vh;
        gap: 10px;
        padding: 10px;
      }
      .controls {
        display: flex;
        gap: 10px;
      }
      .main {
        display: grid;
        grid-template-columns: 1fr 300px;
        gap: 10px;
      }
      .viz-panel {
        display: flex;
        flex-direction: column;
        gap: 10px;
      }
      .side-panel {
        display: flex;
        flex-direction: column;
        gap: 10px;
      }
      protspace-scatterplot {
        height: 100%;
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
      <!-- Controls -->
      <div class="controls">
        <input type="file" id="fileInput" accept=".parquetbundle" />
        <protspace-control-bar auto-sync scatterplot-selector="#plot"></protspace-control-bar>
      </div>

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

        <div class="side-panel">
          <protspace-legend auto-sync scatterplot-selector="#plot" show-counts></protspace-legend>

          <protspace-structure-viewer
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

      // Load data
      fileInput.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const arrayBuffer = await readFileOptimized(file);
        const rows = await extractRowsFromParquetBundle(arrayBuffer);
        const data = await convertParquetToVisualizationDataOptimized(rows);

        plot.data = data;
        plot.selectedProjectionIndex = 0;
        plot.selectedFeature = Object.keys(data.features)[0] || '';
      });

      // Monitor events
      plot.addEventListener('selection-change', (e) => {
        console.log(`${e.detail.selected.length} proteins selected`);
      });
    </script>
  </body>
</html>
```

## TypeScript Support

All components are written in TypeScript and include full type definitions:

```typescript
import type {
  ProtspaceScatterplot,
  ProtspaceLegend,
  ProtspaceControlBar,
  ProtspaceStructureViewer,
} from '@protspace/core';

import type { VisualizationData, Protein, Projection, FeatureDefinition } from '@protspace/utils';

const plot = document.getElementById('plot') as ProtspaceScatterplot;
```

## Browser Compatibility

All components work in modern browsers with:

- Web Components (Custom Elements v1)
- Shadow DOM v1
- ES2020+
- WebGL 2.0 (for scatterplot)

Tested in:

- Chrome 80+
- Firefox 75+
- Safari 13.1+
- Edge 80+

## Next Steps

- [Scatterplot API](/api/scatterplot) - Detailed scatterplot documentation
- [Legend API](/api/legend) - Legend component reference
- [Control Bar API](/api/control-bar) - Control bar reference
- [Structure Viewer API](/api/structure-viewer) - Structure viewer reference
- [Data Loading](/api/data-loading) - Data loading utilities
