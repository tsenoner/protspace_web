# Data Format

ProtSpace uses `.parquetbundle` files as its primary data format. This page explains the structure and how to work with it.

## Parquet Bundle Structure

A `.parquetbundle` is a bundled archive containing three Parquet files concatenated with delimiters:

```
.parquetbundle file
├── selected_features.parquet    # Protein metadata and features
├── ---PARQUET_DELIMITER---      # Separator
├── projections_metadata.parquet # Projection method information
├── ---PARQUET_DELIMITER---      # Separator
└── projections_data.parquet     # 2D/3D coordinates
```

The bundle format allows efficient streaming and selective loading in the browser.

## File Schemas

### 1. selected_features.parquet

Contains metadata and biological features for each protein.

| Column           | Type          | Description                                       |
| ---------------- | ------------- | ------------------------------------------------- |
| `identifier`     | string        | Unique protein ID (e.g., UniProt accession)       |
| `{feature_name}` | string/number | Feature values (taxonomy, family, GO terms, etc.) |

**Example:**

```csv
identifier,taxonomy,family,length,GO_molecular_function
P12345,Bacteria,Kinase,342,ATP binding
P67890,Archaea,Phosphatase,289,Hydrolase activity;Catalytic activity
Q54321,Eukaryota,Kinase,401,Transferase activity
```

### 2. projections_metadata.parquet

Metadata about available projection methods.

| Column       | Type   | Description                                  |
| ------------ | ------ | -------------------------------------------- |
| `method`     | string | Method identifier (pca2, umap2, tsne2, etc.) |
| `dimensions` | int32  | Number of dimensions (2 or 3)                |
| `parameters` | json   | Method-specific parameters (optional)        |

**Example:**

```csv
method,dimensions,parameters
pca2,2,"{\"explained_variance\": [0.34, 0.21]}"
umap2,2,"{\"n_neighbors\": 15, \"min_dist\": 0.1}"
tsne2,2,"{\"perplexity\": 30}"
```

### 3. projections_data.parquet

Contains 2D/3D coordinates for each protein across different projection methods.

| Column       | Type    | Description                                   |
| ------------ | ------- | --------------------------------------------- |
| `identifier` | string  | Unique protein ID (must match features table) |
| `x_{method}` | float64 | X coordinate for projection method            |
| `y_{method}` | float64 | Y coordinate for projection method            |
| `z_{method}` | float64 | Z coordinate (for 3D projections, optional)   |

**Example:**

```csv
identifier,x_pca2,y_pca2,x_umap2,y_umap2,x_tsne2,y_tsne2
P12345,-2.34,1.56,5.67,-3.21,12.45,-8.32
P67890,0.89,-4.12,-2.34,8.90,4.21,15.67
Q54321,3.45,2.78,1.23,-0.45,-9.87,2.11
```

## Multi-Label Features

Proteins often have multiple annotations for a single feature. These are encoded using semicolons as separators:

```csv
identifier,GO_terms,Pfam_domains
P12345,"DNA binding;RNA binding;Catalytic activity","PF00076;PF00271"
P67890,"Hydrolase","PF00561"
Q54321,"Kinase;Transferase","PF00069"
```

**Visualization**: Multi-label proteins are displayed as **pie charts** where each slice represents a different label with its corresponding color.

## TypeScript Interfaces

```typescript
interface ProtSpaceData {
  proteins: Protein[];
  projections: Projection[];
  features: Record<string, FeatureDefinition>;
  metadata?: DatasetMetadata;
}

interface Protein {
  id: string;
  name?: string;
  sequence?: string;
  coordinates: Record<string, Point2D | Point3D>;
  features: Record<string, string | string[]>;
}

interface Point2D {
  x: number;
  y: number;
}

interface Point3D extends Point2D {
  z: number;
}

interface Projection {
  method: string; // 'pca2', 'umap2', 'tsne2', etc.
  dimensions: 2 | 3;
  label: string; // Display name
  parameters?: Record<string, unknown>;
}

interface FeatureDefinition {
  name: string;
  type: 'categorical' | 'numerical' | 'multilabel';
  values: string[] | number[];
  colors?: Record<string, string>;
  shapes?: Record<string, string>;
}

interface DatasetMetadata {
  name: string;
  description?: string;
  source?: string;
  embeddingModel?: string;
  createdAt: string;
  proteinCount: number;
}
```

## Supported Projection Methods

| Method     | Code                 | Dimensions | Description                                                              |
| ---------- | -------------------- | ---------- | ------------------------------------------------------------------------ |
| **PCA**    | `pca2`, `pca3`       | 2D, 3D     | Principal Component Analysis - linear, preserves global structure        |
| **UMAP**   | `umap2`, `umap3`     | 2D, 3D     | Uniform Manifold Approximation - balances local/global structure         |
| **t-SNE**  | `tsne2`, `tsne3`     | 2D, 3D     | t-distributed Stochastic Neighbor Embedding - emphasizes local clusters  |
| **MDS**    | `mds2`, `mds3`       | 2D, 3D     | Multidimensional Scaling - preserves pairwise distances                  |
| **PaCMAP** | `pacmap2`, `pacmap3` | 2D, 3D     | Pairwise Controlled Manifold Approximation - recent alternative to t-SNE |

::: tip Choosing a Method

- **PCA**: Fast, interpretable, good for initial exploration
- **UMAP**: Best balance of speed and quality, recommended for most cases
- **t-SNE**: Excellent for finding clusters, slower for large datasets
- **MDS**: Good for preserving distances, computationally expensive
- **PaCMAP**: Similar to t-SNE but faster and more stable
  :::

## Feature Types

ProtSpace Web automatically detects feature types:

### Categorical Features

Examples: taxonomy, family, domain, organism

- Displayed with discrete colors
- Legend allows toggling visibility
- Click to filter, double-click to isolate

### Numerical Features

Examples: length, score, confidence, mass

- Displayed with color gradients
- Legend shows min/max range
- Can be binned into categories

### Multi-Label Features

Examples: GO terms, Pfam domains, EC numbers

- Multiple values per protein (semicolon-separated)
- Displayed as pie chart glyphs
- Each label gets a unique color

## Generating Data

### Using Python ProtSpace

```bash
# From UniProt query
protspace-query \
  -q "(ft_domain:kinase) AND (reviewed:true)" \
  -o output_dir \
  -m pca2,umap2,tsne2

# From your own embeddings
protspace-local \
  -i embeddings.h5 \
  -f features.csv \
  -o output_dir \
  -m pca2,umap2,tsne2,pacmap2
```

### Custom Data

If you have embeddings from any source, save them as HDF5:

```python
import h5py
import numpy as np

# Your embeddings (n_proteins x embedding_dim)
embeddings = np.random.randn(1000, 1024)
protein_ids = [f"P{i:05d}" for i in range(1000)]

with h5py.File('embeddings.h5', 'w') as f:
    for pid, emb in zip(protein_ids, embeddings):
        f.create_dataset(pid, data=emb)
```

Then use `protspace-local` to generate the visualization bundle.

## Bundle Validation

A valid `.parquetbundle` must have:

1. **Consistent identifiers** across all three tables
2. **At least one projection** in projections_data
3. **Matching column names** between projections_metadata and projections_data
4. **Valid parquet format** for each section
5. **Proper delimiters** between sections

You can validate your bundle:

```javascript
import { isParquetBundle, extractRowsFromParquetBundle } from '@protspace/core';

const arrayBuffer = await file.arrayBuffer();

// Check if it's a valid bundle
if (isParquetBundle(arrayBuffer)) {
  const rows = await extractRowsFromParquetBundle(arrayBuffer);
  console.log('Valid bundle with', rows.length, 'proteins');
} else {
  console.error('Invalid parquet bundle format');
}
```

## Why Parquet?

The Parquet format offers several advantages for browser-based visualization:

- **Columnar storage**: Efficient for analytical queries and selective loading
- **Compression**: Significantly smaller file sizes (often 10-20x smaller than CSV)
- **Browser-compatible**: Can be read with Apache Arrow JS and hyparquet
- **Selective loading**: Read only needed columns, improving performance
- **Type preservation**: Maintains data types accurately (integers, floats, strings)
- **Metadata support**: Embedded schema and statistics

## File Size Considerations

Typical file sizes:

| Proteins  | Features | Projections | Approximate Size |
| --------- | -------- | ----------- | ---------------- |
| 1,000     | 5        | 3           | 50-100 KB        |
| 10,000    | 10       | 5           | 500 KB - 1 MB    |
| 100,000   | 15       | 5           | 5-10 MB          |
| 1,000,000 | 20       | 5           | 50-100 MB        |

::: warning Large Datasets
Datasets with >500,000 proteins may cause performance issues on older devices. Consider filtering or creating smaller subsets for public demos.
:::

## Next Steps

- [Data Preparation](/guide/data-preparation) - Generate your own bundles
- [Getting Started](/guide/getting-started) - Load and visualize data
- [API Reference](/api/data-loading) - Programmatic data loading
