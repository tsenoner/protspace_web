# Data Loading Utilities

ProtSpace uses programmatic data loading through utility functions. This page documents the available utilities for loading and processing `.parquetbundle` files.

## Why Programmatic Loading?

Instead of a `<protspace-data-loader>` component, ProtSpace provides utility functions that give you more control over:

- **Error handling**: Custom error messages and recovery
- **Loading UI**: Your own loading indicators and progress bars
- **File sources**: File input, drag-drop, fetch from URL
- **Validation**: Custom validation logic before loading
- **Integration**: Easier integration with frameworks

## Import

```javascript
import {
  readFileOptimized,
  isParquetBundle,
  extractRowsFromParquetBundle,
  convertParquetToVisualizationDataOptimized,
} from '@protspace/core';
```

## Functions

### readFileOptimized(file)

Efficiently reads large files into an ArrayBuffer with optimizations for performance.

```javascript
const file = event.target.files[0];
const arrayBuffer = await readFileOptimized(file);
```

**Parameters:**

- `file` (File): File object to read

**Returns:** `Promise<ArrayBuffer>`

**Features:**

- Optimized for large files (>100MB)
- Chunk-based reading for better memory management
- Progress tracking support
- Browser-native performance optimizations

### isParquetBundle(arrayBuffer)

Validates if an ArrayBuffer contains a valid `.parquetbundle` format.

```javascript
const isValid = isParquetBundle(arrayBuffer);
if (!isValid) {
  throw new Error('Invalid parquet bundle format');
}
```

**Parameters:**

- `arrayBuffer` (ArrayBuffer): Buffer to validate

**Returns:** `boolean`

**Checks for:**

- Proper delimiter markers (`---PARQUET_DELIMITER---`)
- Correct number of sections (3)
- Valid parquet magic numbers

### extractRowsFromParquetBundle(arrayBuffer)

Extracts and parses data from a `.parquetbundle` file.

```javascript
const rows = await extractRowsFromParquetBundle(arrayBuffer);
// rows contains the parsed data from all three sections
```

**Parameters:**

- `arrayBuffer` (ArrayBuffer): Valid parquet bundle buffer

**Returns:** `Promise<Rows>`

**Process:**

1. Splits bundle into three sections
2. Validates each parquet file
3. Parses projection data, metadata, and features
4. Merges data by protein identifiers
5. Returns combined rows

**Throws:**

- `Error` if bundle format is invalid
- `Error` if parquet parsing fails
- `Error` if identifiers don't match

### convertParquetToVisualizationDataOptimized(rows)

Converts parsed rows into ProtSpace visualization format.

```javascript
const visualizationData = await convertParquetToVisualizationDataOptimized(rows);

// Now ready to set on scatterplot
plot.data = visualizationData;
```

**Parameters:**

- `rows` (Rows): Parsed rows from `extractRowsFromParquetBundle`

**Returns:** `Promise<VisualizationData>`

**Output structure:**

```typescript
interface VisualizationData {
  proteins: Protein[];
  projections: Projection[];
  features: Record<string, FeatureDefinition>;
  metadata?: DatasetMetadata;
}
```

**Features:**

- Detects feature types (categorical, numerical, multi-label)
- Generates color schemes automatically
- Optimized for large datasets
- Validates data integrity

## Complete Loading Workflow

### Basic Example

```javascript
import {
  readFileOptimized,
  extractRowsFromParquetBundle,
  convertParquetToVisualizationDataOptimized,
} from '@protspace/core';

async function loadData(file) {
  try {
    // Step 1: Read file to ArrayBuffer
    const arrayBuffer = await readFileOptimized(file);

    // Step 2: Extract and parse parquet bundle
    const rows = await extractRowsFromParquetBundle(arrayBuffer);

    // Step 3: Convert to visualization format
    const data = await convertParquetToVisualizationDataOptimized(rows);

    // Step 4: Set on scatterplot
    const plot = document.getElementById('plot');
    plot.data = data;
    plot.selectedProjectionIndex = 0;
    plot.selectedFeature = Object.keys(data.features)[0] || '';

    return data;
  } catch (error) {
    console.error('Failed to load data:', error);
    throw error;
  }
}
```

### With Validation

```javascript
import {
  readFileOptimized,
  isParquetBundle,
  extractRowsFromParquetBundle,
  convertParquetToVisualizationDataOptimized,
} from '@protspace/core';

async function loadDataWithValidation(file) {
  // Validate file size
  const MAX_SIZE = 500 * 1024 * 1024; // 500MB
  if (file.size > MAX_SIZE) {
    throw new Error('File too large. Maximum size is 500MB.');
  }

  // Validate file extension
  if (!file.name.endsWith('.parquetbundle')) {
    throw new Error('File must be a .parquetbundle file');
  }

  // Read file
  const arrayBuffer = await readFileOptimized(file);

  // Validate format
  if (!isParquetBundle(arrayBuffer)) {
    throw new Error('Invalid parquet bundle format');
  }

  // Extract and convert
  const rows = await extractRowsFromParquetBundle(arrayBuffer);
  const data = await convertParquetToVisualizationDataOptimized(rows);

  // Validate data
  if (data.proteins.length === 0) {
    throw new Error('No proteins found in dataset');
  }

  if (data.projections.length === 0) {
    throw new Error('No projections found in dataset');
  }

  return data;
}
```

### With Progress Tracking

```javascript
async function loadDataWithProgress(file, onProgress) {
  // Step 1: Read file (25%)
  onProgress({ step: 'Reading file', percent: 0 });
  const arrayBuffer = await readFileOptimized(file);
  onProgress({ step: 'Reading file', percent: 25 });

  // Step 2: Extract rows (50%)
  onProgress({ step: 'Parsing data', percent: 25 });
  const rows = await extractRowsFromParquetBundle(arrayBuffer);
  onProgress({ step: 'Parsing data', percent: 50 });

  // Step 3: Convert data (75%)
  onProgress({ step: 'Processing', percent: 50 });
  const data = await convertParquetToVisualizationDataOptimized(rows);
  onProgress({ step: 'Processing', percent: 75 });

  // Step 4: Complete (100%)
  onProgress({ step: 'Complete', percent: 100 });

  return data;
}

// Usage
await loadDataWithProgress(file, (progress) => {
  console.log(`${progress.step}: ${progress.percent}%`);
  document.getElementById('progress').textContent = `${progress.step} (${progress.percent}%)`;
});
```

## Loading Patterns

### File Input

```html
<input type="file" id="fileInput" accept=".parquetbundle" />

<script type="module">
  import {
    readFileOptimized,
    extractRowsFromParquetBundle,
    convertParquetToVisualizationDataOptimized,
  } from '@protspace/core';

  document.getElementById('fileInput').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    try {
      const arrayBuffer = await readFileOptimized(file);
      const rows = await extractRowsFromParquetBundle(arrayBuffer);
      const data = await convertParquetToVisualizationDataOptimized(rows);

      document.getElementById('plot').data = data;
    } catch (error) {
      alert(`Error loading file: ${error.message}`);
    }
  });
</script>
```

### Drag and Drop

```html
<div id="dropZone">Drop .parquetbundle file here</div>

<script type="module">
  import {
    readFileOptimized,
    extractRowsFromParquetBundle,
    convertParquetToVisualizationDataOptimized,
  } from '@protspace/core';

  const dropZone = document.getElementById('dropZone');

  dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
    dropZone.classList.add('drag-over');
  });

  dropZone.addEventListener('dragleave', () => {
    dropZone.classList.remove('drag-over');
  });

  dropZone.addEventListener('drop', async (e) => {
    e.preventDefault();
    dropZone.classList.remove('drag-over');

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

      document.getElementById('plot').data = data;
      dropZone.textContent = `Loaded ${data.proteins.length} proteins`;
    } catch (error) {
      dropZone.textContent = 'Drop .parquetbundle file here';
      alert(`Error: ${error.message}`);
    }
  });
</script>
```

### Fetch from URL

```javascript
import {
  readFileOptimized,
  extractRowsFromParquetBundle,
  convertParquetToVisualizationDataOptimized,
} from '@protspace/core';

async function loadFromUrl(url) {
  // Fetch the file
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  // Convert to File object
  const arrayBuffer = await response.arrayBuffer();
  const file = new File([arrayBuffer], 'data.parquetbundle', {
    type: 'application/octet-stream',
  });

  // Process using utilities
  const buffer = await readFileOptimized(file);
  const rows = await extractRowsFromParquetBundle(buffer);
  const data = await convertParquetToVisualizationDataOptimized(rows);

  return data;
}

// Usage
const data = await loadFromUrl('./data.parquetbundle');
document.getElementById('plot').data = data;
```

## Error Handling

### Common Errors

```javascript
try {
  const arrayBuffer = await readFileOptimized(file);
  const rows = await extractRowsFromParquetBundle(arrayBuffer);
  const data = await convertParquetToVisualizationDataOptimized(rows);

  plot.data = data;
} catch (error) {
  if (error.message.includes('not recognized')) {
    console.error('Invalid file format');
  } else if (error.message.includes('delimiter')) {
    console.error('Corrupted bundle file');
  } else if (error.message.includes('identifier')) {
    console.error('Data inconsistency - identifiers do not match');
  } else if (error.message.includes('projection')) {
    console.error('Missing projection data');
  } else {
    console.error('Unknown error:', error);
  }
}
```

### User-Friendly Error Messages

```javascript
async function loadWithUserFriendlyErrors(file) {
  try {
    const arrayBuffer = await readFileOptimized(file);
    const rows = await extractRowsFromParquetBundle(arrayBuffer);
    const data = await convertParquetToVisualizationDataOptimized(rows);
    return data;
  } catch (error) {
    // Map technical errors to user-friendly messages
    const userMessage = {
      'not recognized':
        'This file is not a valid .parquetbundle file. Please check the file format.',
      delimiter: 'The file appears to be corrupted. Please try generating it again.',
      identifier: 'The data in this file is inconsistent. Please regenerate the bundle.',
      projection: 'This file is missing required projection data.',
      memory: 'This file is too large for your browser to process.',
    };

    for (const [key, message] of Object.entries(userMessage)) {
      if (error.message.toLowerCase().includes(key)) {
        throw new Error(message);
      }
    }

    throw new Error('An unexpected error occurred. Please try again.');
  }
}
```

## Performance Optimization

### Large Files

For files >100MB, consider:

```javascript
async function loadLargeFile(file) {
  console.log(`Loading ${(file.size / 1024 / 1024).toFixed(2)} MB file...`);

  // Show loading indicator
  showLoadingIndicator();

  try {
    // readFileOptimized handles large files efficiently
    const arrayBuffer = await readFileOptimized(file);
    const rows = await extractRowsFromParquetBundle(arrayBuffer);
    const data = await convertParquetToVisualizationDataOptimized(rows);

    return data;
  } finally {
    hideLoadingIndicator();
  }
}
```

### Memory Management

```javascript
async function loadAndClear(file) {
  let arrayBuffer, rows;

  try {
    // Load data
    arrayBuffer = await readFileOptimized(file);
    rows = await extractRowsFromParquetBundle(arrayBuffer);
    const data = await convertParquetToVisualizationDataOptimized(rows);

    // Clear intermediate data
    arrayBuffer = null;
    rows = null;

    return data;
  } finally {
    // Force garbage collection hint
    arrayBuffer = null;
    rows = null;
  }
}
```

## TypeScript Types

```typescript
import type {
  VisualizationData,
  Protein,
  Projection,
  FeatureDefinition,
  Rows,
} from '@protspace/utils';

async function loadData(file: File): Promise<VisualizationData> {
  const arrayBuffer: ArrayBuffer = await readFileOptimized(file);
  const rows: Rows = await extractRowsFromParquetBundle(arrayBuffer);
  const data: VisualizationData = await convertParquetToVisualizationDataOptimized(rows);

  return data;
}
```

## Best Practices

### Always Validate

```javascript
// ✅ Good: Validate before processing
if (file.name.endsWith('.parquetbundle')) {
  const arrayBuffer = await readFileOptimized(file);
  if (isParquetBundle(arrayBuffer)) {
    // Process file
  }
}

// ❌ Bad: No validation
const arrayBuffer = await readFileOptimized(file);
const rows = await extractRowsFromParquetBundle(arrayBuffer);
```

### Handle All Errors

```javascript
// ✅ Good: Comprehensive error handling
try {
  const data = await loadData(file);
  plot.data = data;
} catch (error) {
  console.error('Load failed:', error);
  showErrorMessage(error.message);
}

// ❌ Bad: No error handling
const data = await loadData(file);
plot.data = data;
```

### Show Progress

```javascript
// ✅ Good: User feedback
showLoadingSpinner();
try {
  const data = await loadData(file);
  plot.data = data;
  showSuccessMessage(`Loaded ${data.proteins.length} proteins`);
} finally {
  hideLoadingSpinner();
}
```

## Next Steps

- [Getting Started](/guide/getting-started) - Basic usage guide
- [Data Format](/guide/data-format) - Understanding the file structure
- [Data Preparation](/guide/data-preparation) - Generate your own files
- [API Overview](/api/) - All components
