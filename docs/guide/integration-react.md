# React Integration

This guide shows how to integrate ProtSpace Web into React applications.

## Installation

```bash
npm install @protspace/core
# or
pnpm add @protspace/core
```

## Basic Component

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
  const [error, setError] = useState(null);

  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    try {
      setLoading(true);
      setError(null);

      const arrayBuffer = await readFileOptimized(file);
      const rows = await extractRowsFromParquetBundle(arrayBuffer);
      const data = await convertParquetToVisualizationDataOptimized(rows);

      if (plotRef.current) {
        plotRef.current.data = data;
        plotRef.current.selectedProjectionIndex = 0;
        plotRef.current.selectedFeature = Object.keys(data.features)[0];
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <input type="file" accept=".parquetbundle" onChange={handleFileChange} />
      {loading && <div>Loading...</div>}
      {error && <div>Error: {error}</div>}

      <protspace-scatterplot
        ref={plotRef}
        id="plot"
        show-grid="true"
        enable-zoom="true"
        enable-pan="true"
        enable-selection="true"
        style={{ height: '600px' }}
      />
    </div>
  );
}
```

## With All Components

```jsx
import { useEffect, useRef, useState } from 'react';
import '@protspace/core';
import {
  readFileOptimized,
  extractRowsFromParquetBundle,
  convertParquetToVisualizationDataOptimized,
} from '@protspace/core';

export default function ProtSpaceComplete() {
  const plotRef = useRef(null);
  const [selectedCount, setSelectedCount] = useState(0);

  useEffect(() => {
    const plot = plotRef.current;
    if (!plot) return;

    const handleSelectionChange = (e) => {
      setSelectedCount(e.detail.selected.length);
    };

    plot.addEventListener('selection-change', handleSelectionChange);

    return () => {
      plot.removeEventListener('selection-change', handleSelectionChange);
    };
  }, []);

  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const arrayBuffer = await readFileOptimized(file);
    const rows = await extractRowsFromParquetBundle(arrayBuffer);
    const data = await convertParquetToVisualizationDataOptimized(rows);

    plotRef.current.data = data;
    plotRef.current.selectedProjectionIndex = 0;
    plotRef.current.selectedFeature = Object.keys(data.features)[0];
  };

  return (
    <div style={{ padding: '20px' }}>
      <div style={{ marginBottom: '20px' }}>
        <input type="file" accept=".parquetbundle" onChange={handleFileChange} />
        <span style={{ marginLeft: '20px' }}>
          {selectedCount > 0 && `${selectedCount} selected`}
        </span>
      </div>

      <protspace-control-bar auto-sync="true" scatterplot-selector="#plot" />

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 300px',
          gap: '20px',
          marginTop: '20px',
        }}
      >
        <protspace-scatterplot
          ref={plotRef}
          id="plot"
          show-grid="true"
          enable-zoom="true"
          enable-pan="true"
          enable-selection="true"
          style={{ height: '600px', border: '1px solid #ddd' }}
        />

        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <protspace-legend
            auto-sync="true"
            scatterplot-selector="#plot"
            style={{ border: '1px solid #ddd', padding: '10px' }}
          />

          <protspace-structure-viewer
            auto-sync="true"
            auto-show="true"
            scatterplot-selector="#plot"
            height="400px"
            style={{ border: '1px solid #ddd' }}
          />
        </div>
      </div>
    </div>
  );
}
```

## TypeScript Support

```tsx
import type { ProtspaceScatterplot } from '@protspace/core';

const plotRef = useRef<ProtspaceScatterplot>(null);

useEffect(() => {
  const plot = plotRef.current;
  if (!plot) return;

  const handleClick = (e: CustomEvent) => {
    console.log('Protein:', e.detail.protein);
  };

  plot.addEventListener('point-click', handleClick as EventListener);

  return () => {
    plot.removeEventListener('point-click', handleClick as EventListener);
  };
}, []);
```

## Next Steps

- [Vue Integration](/guide/integration-vue)
- [HTML Integration](/guide/integration-html)
- [API Reference](/api/)
