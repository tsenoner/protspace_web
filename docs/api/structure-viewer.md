# Structure Viewer Component

The `<protspace-structure-viewer>` component displays 3D protein structures using the Molstar viewer, with support for AlphaFold and PDB structures.

## Basic Usage

```html
<protspace-structure-viewer
  auto-sync
  auto-show
  scatterplot-selector="#plot"
  height="400px"
></protspace-structure-viewer>
```

## Properties

| Property              | Type             | Default                   | Description                                 |
| --------------------- | ---------------- | ------------------------- | ------------------------------------------- |
| `proteinId`           | `string \| null` | `null`                    | Protein ID to display structure for         |
| `title`               | `string`         | `'Protein Structure'`     | Title shown in the header                   |
| `height`              | `string`         | `'400px'`                 | Height of the viewer container              |
| `showHeader`          | `boolean`        | `true`                    | Show/hide the header bar                    |
| `showCloseButton`     | `boolean`        | `true`                    | Show/hide the close button                  |
| `showTips`            | `boolean`        | `true`                    | Show/hide usage tips                        |
| `autoSync`            | `boolean`        | `true`                    | Automatically sync with scatterplot         |
| `autoShow`            | `boolean`        | `true`                    | Automatically show/hide based on selections |
| `scatterplotSelector` | `string`         | `'protspace-scatterplot'` | CSS selector for target scatterplot         |

## Attributes

| Attribute              | Type    | Description                              |
| ---------------------- | ------- | ---------------------------------------- |
| `protein-id`           | String  | Protein ID to load                       |
| `auto-sync`            | Boolean | Enable automatic synchronization         |
| `auto-show`            | Boolean | Automatically show when protein selected |
| `scatterplot-selector` | String  | CSS selector for target scatterplot      |
| `show-header`          | Boolean | Display header bar                       |
| `show-close-button`    | Boolean | Display close button                     |
| `show-tips`            | Boolean | Display usage tips                       |

## Methods

### loadStructure(proteinId, source?)

Load a protein structure by ID.

```javascript
const viewer = document.querySelector('protspace-structure-viewer');
await viewer.loadStructure('P12345');

// Or specify source
await viewer.loadStructure('1ABC', 'pdb');
```

**Parameters:**

- `proteinId` (string): Protein or structure ID
- `source` (optional, 'alphafold' | 'pdb'): Structure database source

**Returns:** `Promise<void>`

### close()

Close the structure viewer and clear the current structure.

```javascript
viewer.close();
```

### show()

Show the structure viewer.

```javascript
viewer.show();
```

### hide()

Hide the structure viewer.

```javascript
viewer.hide();
```

### resetView()

Reset the camera view to default position.

```javascript
viewer.resetView();
```

## Events

### structure-load

Fired when a structure is successfully loaded.

```javascript
viewer.addEventListener('structure-load', (e) => {
  console.log('Loaded structure for:', e.detail.proteinId);
  console.log('Source:', e.detail.source);
});
```

**Detail:**

```typescript
{
  proteinId: string;
  source: 'alphafold' | 'pdb';
  metadata?: any;
}
```

### structure-error

Fired when structure loading fails.

```javascript
viewer.addEventListener('structure-error', (e) => {
  console.error('Failed to load:', e.detail.proteinId);
  console.error('Error:', e.detail.error);
});
```

**Detail:**

```typescript
{
  proteinId: string;
  error: string;
}
```

### structure-close

Fired when the structure viewer is closed.

```javascript
viewer.addEventListener('structure-close', (e) => {
  console.log('Viewer closed');
});
```

### viewer-ready

Fired when the Molstar viewer is initialized.

```javascript
viewer.addEventListener('viewer-ready', (e) => {
  console.log('Molstar viewer ready');
});
```

## Structure Sources

### AlphaFold Database

Automatically fetches predicted structures from AlphaFold:

```javascript
// Loads from AlphaFold DB using UniProt ID
viewer.loadStructure('P12345', 'alphafold');
```

**Supported IDs:**

- UniProt accessions (e.g., P12345, Q9Y6K9)
- AlphaFold IDs (e.g., AF-P12345-F1)

### Protein Data Bank (PDB)

Fetches experimental structures from RCSB PDB:

```javascript
// Loads from PDB using PDB ID
viewer.loadStructure('1ABC', 'pdb');
```

**Supported IDs:**

- 4-character PDB codes (e.g., 1ABC, 3J3Q)

### Auto-Detection

If source is not specified, the component automatically detects:

```javascript
// Auto-detects based on ID format
viewer.loadStructure('P12345'); // → AlphaFold
viewer.loadStructure('1ABC'); // → PDB
```

## Auto-Sync Behavior

When `auto-sync` and `auto-show` are enabled:

1. **Monitors selection**: Listens for protein selection in scatterplot
2. **Auto-loads**: Fetches structure when protein is selected
3. **Auto-shows**: Makes viewer visible when structure loads
4. **Auto-hides**: Hides when selection is cleared (optional)

```html
<protspace-scatterplot id="plot"></protspace-scatterplot>

<protspace-structure-viewer
  auto-sync
  auto-show
  scatterplot-selector="#plot"
></protspace-structure-viewer>
```

**Behavior:**

- User clicks protein in plot
- Viewer automatically loads structure
- Viewer appears with structure loaded
- User clicks elsewhere → viewer can hide

## Styling

The structure viewer uses Shadow DOM with CSS custom properties:

```css
protspace-structure-viewer {
  --structure-viewer-bg: white;
  --structure-viewer-border: #ddd;
  --structure-viewer-header-bg: #f5f5f5;
  --structure-viewer-text: #333;
  --structure-viewer-button-hover: #e0e0e0;

  width: 100%;
  border: 1px solid var(--structure-viewer-border);
  border-radius: 8px;
}
```

### Custom Styling Example

```html
<style>
  protspace-structure-viewer {
    --structure-viewer-bg: #1e1e1e;
    --structure-viewer-header-bg: #2d2d2d;
    --structure-viewer-text: white;
    --structure-viewer-border: #444;

    height: 500px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
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
        display: grid;
        grid-template-columns: 1fr 400px;
        gap: 20px;
        height: 600px;
      }

      protspace-scatterplot {
        border: 1px solid #ddd;
        border-radius: 8px;
      }

      protspace-structure-viewer {
        border: 1px solid #ddd;
        border-radius: 8px;
        height: 100%;
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

      <protspace-structure-viewer
        id="structureViewer"
        title="AlphaFold Structure"
        auto-sync
        auto-show
        scatterplot-selector="#plot"
        show-header
        show-close-button
        show-tips
      ></protspace-structure-viewer>
    </div>

    <script type="module">
      const fileInput = document.getElementById('fileInput');
      const plot = document.getElementById('plot');
      const viewer = document.getElementById('structureViewer');

      // Load data
      fileInput.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const arrayBuffer = await readFileOptimized(file);
        const rows = await extractRowsFromParquetBundle(arrayBuffer);
        const data = await convertParquetToVisualizationDataOptimized(rows);

        plot.data = data;
        plot.selectedProjectionIndex = 0;
        plot.selectedFeature = 'family';
      });

      // Monitor structure viewer events
      viewer.addEventListener('structure-load', (e) => {
        console.log(`Loaded structure for ${e.detail.proteinId}`);
      });

      viewer.addEventListener('structure-error', (e) => {
        console.error(`Failed to load structure: ${e.detail.error}`);
      });

      viewer.addEventListener('structure-close', () => {
        console.log('Structure viewer closed');
      });
    </script>
  </body>
</html>
```

## Manual Control Example

```javascript
const viewer = document.getElementById('structureViewer');

// Load specific structure
await viewer.loadStructure('P12345', 'alphafold');

// Or from PDB
await viewer.loadStructure('1ABC', 'pdb');

// Show/hide manually
viewer.show();
viewer.hide();

// Reset camera view
viewer.resetView();

// Close and clear
viewer.close();

// Change title dynamically
viewer.title = 'My Protein Structure';
```

## Molstar Controls

The Molstar viewer provides built-in controls:

### Mouse Controls

| Action             | Effect                 |
| ------------------ | ---------------------- |
| **Left drag**      | Rotate structure       |
| **Right drag**     | Pan view               |
| **Scroll**         | Zoom in/out            |
| **Ctrl+Left drag** | Adjust slab (clipping) |

### Keyboard Shortcuts

| Key   | Action                |
| ----- | --------------------- |
| **R** | Reset view            |
| **S** | Toggle spin animation |
| **F** | Focus on selection    |
| **H** | Toggle help           |

## Advanced Features

### Custom Styling of Structure

```javascript
// Access Molstar plugin (advanced)
viewer.addEventListener('viewer-ready', () => {
  // Molstar plugin is now accessible
  // Can customize representation, colors, etc.
});
```

### Loading Custom Structures

```javascript
// Load from custom URL
await viewer.loadStructureFromUrl('https://example.com/structure.pdb');
```

### Highlighting Residues

```javascript
// Highlight specific residues (requires custom implementation)
await viewer.loadStructure('P12345');
// Then use Molstar API to highlight residues
```

## Performance Considerations

### Large Structures

Complex structures with many atoms may take time to load:

```javascript
viewer.addEventListener('structure-load', () => {
  console.log('Structure loaded and rendered');
});

// Show loading indicator while waiting
```

### Memory Management

```javascript
// Clear structure when done
viewer.close();

// Or hide without clearing
viewer.hide();
```

### Caching

Structures are cached by the browser. Reload the same protein for instant display.

## Error Handling

```javascript
viewer.addEventListener('structure-error', (e) => {
  const { proteinId, error } = e.detail;

  if (error.includes('not found')) {
    console.log(`No structure available for ${proteinId}`);
    // Show message to user
  } else if (error.includes('network')) {
    console.log('Network error, try again');
    // Retry logic
  } else {
    console.error('Unknown error:', error);
  }
});
```

## TypeScript Support

```typescript
import type { ProtspaceStructureViewer } from '@protspace/core';

const viewer = document.getElementById('structureViewer') as ProtspaceStructureViewer;

viewer.addEventListener('structure-load', (e: CustomEvent) => {
  const { proteinId, source } = e.detail;
  console.log(`Loaded ${proteinId} from ${source}`);
});
```

## Accessibility

The structure viewer supports:

- **Keyboard navigation**: Tab through controls
- **Screen reader**: Announces loading states
- **High contrast**: Respects system preferences
- **Focus management**: Proper focus trapping in modals

## Integration Tips

### With Scatterplot

Always use auto-sync for seamless integration:

```html
<protspace-structure-viewer
  auto-sync
  auto-show
  scatterplot-selector="#plot"
></protspace-structure-viewer>
```

### Standalone Usage

Use without scatterplot for direct structure viewing:

```html
<protspace-structure-viewer protein-id="P12345" auto-sync="false"></protspace-structure-viewer>
```

### Multiple Viewers

Show multiple structures simultaneously:

```html
<protspace-structure-viewer id="viewer1" protein-id="P12345"></protspace-structure-viewer>
<protspace-structure-viewer id="viewer2" protein-id="P67890"></protspace-structure-viewer>
```

## Known Limitations

- Requires internet connection to fetch structures
- Very large structures (>10,000 atoms) may be slow
- Some proteins may not have structures available
- AlphaFold structures are predictions (not experimental)
- PDB structures may be partial (not full sequence)

## Data Sources

### AlphaFold Database

- URL: https://alphafold.ebi.ac.uk/
- Coverage: 200+ million protein structures
- Type: Predicted structures
- Quality: High confidence predictions

### RCSB PDB

- URL: https://www.rcsb.org/
- Coverage: 200,000+ experimental structures
- Type: X-ray, NMR, Cryo-EM
- Quality: Experimental data

## Next Steps

- [Scatterplot API](/api/scatterplot) - Main visualization
- [Legend API](/api/legend) - Category filtering
- [Control Bar API](/api/control-bar) - UI controls
- [API Overview](/api/) - All components
