# Vue Integration

This guide shows how to integrate ProtSpace into Vue 3 applications.

## Installation

```bash
npm install @protspace/core
# or
pnpm add @protspace/core
```

## Basic Component

```vue
<template>
  <div>
    <input type="file" accept=".parquetbundle" @change="handleFileChange" />
    <div v-if="loading">Loading...</div>
    <div v-if="error">Error: {{ error }}</div>

    <protspace-scatterplot
      ref="plot"
      id="plot"
      show-grid
      enable-zoom
      enable-pan
      enable-selection
      style="height: 600px"
    />
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import '@protspace/core';
import {
  readFileOptimized,
  extractRowsFromParquetBundle,
  convertParquetToVisualizationDataOptimized,
} from '@protspace/core';

const plot = ref(null);
const loading = ref(false);
const error = ref(null);

const handleFileChange = async (e) => {
  const file = e.target.files[0];
  if (!file) return;

  try {
    loading.value = true;
    error.value = null;

    const arrayBuffer = await readFileOptimized(file);
    const rows = await extractRowsFromParquetBundle(arrayBuffer);
    const data = await convertParquetToVisualizationDataOptimized(rows);

    plot.value.data = data;
    plot.value.selectedProjectionIndex = 0;
    plot.value.selectedFeature = Object.keys(data.features)[0];
  } catch (err) {
    error.value = err.message;
  } finally {
    loading.value = false;
  }
};
</script>
```

## With All Components

```vue
<template>
  <div class="protspace-container">
    <div class="header">
      <input type="file" accept=".parquetbundle" @change="handleFileChange" />
      <span v-if="selectedCount > 0">{{ selectedCount }} selected</span>
    </div>

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

        <protspace-structure-viewer
          auto-sync
          auto-show
          scatterplot-selector="#plot"
          height="400px"
        />
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue';
import '@protspace/core';
import {
  readFileOptimized,
  extractRowsFromParquetBundle,
  convertParquetToVisualizationDataOptimized,
} from '@protspace/core';

const plot = ref(null);
const selectedCount = ref(0);

const handleFileChange = async (e) => {
  const file = e.target.files[0];
  if (!file) return;

  const arrayBuffer = await readFileOptimized(file);
  const rows = await extractRowsFromParquetBundle(arrayBuffer);
  const data = await convertParquetToVisualizationDataOptimized(rows);

  plot.value.data = data;
  plot.value.selectedProjectionIndex = 0;
  plot.value.selectedFeature = Object.keys(data.features)[0];
};

const handleSelectionChange = (e) => {
  selectedCount.value = e.detail.selected.length;
};

onMounted(() => {
  plot.value?.addEventListener('selection-change', handleSelectionChange);
});

onUnmounted(() => {
  plot.value?.removeEventListener('selection-change', handleSelectionChange);
});
</script>

<style scoped>
.protspace-container {
  padding: 20px;
}

.header {
  margin-bottom: 20px;
  display: flex;
  gap: 20px;
  align-items: center;
}

.visualization {
  display: grid;
  grid-template-columns: 1fr 300px;
  gap: 20px;
}

protspace-scatterplot {
  height: 600px;
  border: 1px solid #ddd;
}

.sidebar {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

protspace-legend {
  border: 1px solid #ddd;
  padding: 10px;
}

protspace-structure-viewer {
  border: 1px solid #ddd;
}
</style>
```

## TypeScript Support

```vue
<script setup lang="ts">
import type { ProtspaceScatterplot } from '@protspace/core';
import type { Ref } from 'vue';

const plot: Ref<ProtspaceScatterplot | null> = ref(null);

onMounted(() => {
  plot.value?.addEventListener('point-click', (e: CustomEvent) => {
    console.log('Protein:', e.detail.protein);
  });
});
</script>
```

## Next Steps

- [React Integration](/guide/integration-react)
- [HTML Integration](/guide/integration-html)
- [API Reference](/api/)
