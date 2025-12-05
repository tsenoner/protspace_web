# Data Preparation

This guide explains how to generate `.parquetbundle` files for use with ProtSpace.

## Overview

ProtSpace requires data in a specific format that combines:

- Protein embeddings reduced to 2D/3D coordinates
- Metadata and biological features
- Projection method information

There are three main approaches to generate this data.

## Method 1: Google Colab (Recommended)

The easiest way to prepare your data - no local installation required!

[![Open In Colab](https://colab.research.google.com/assets/colab-badge.svg)](https://colab.research.google.com/github/tsenoner/protspace_web/blob/main/notebooks/ProtSpace_Preparation.ipynb)

### Features

- Upload FASTA files or fetch from UniProt
- Automatic embedding generation with ProtT5 or ESM2
- Multiple dimensionality reduction methods
- Feature annotation from UniProt
- Direct download of `.parquetbundle` file

### Steps

1. **Open the notebook** - Click the badge above
2. **Choose your data source**:
   - Upload a FASTA file, OR
   - Enter a UniProt query
3. **Select embedding model** (ProtT5 recommended)
4. **Choose projection methods** (PCA, UMAP, t-SNE, etc.)
5. **Run all cells** - Takes 5-30 minutes depending on dataset size
6. **Download** the generated `.parquetbundle` file

::: tip GPU Acceleration
Colab provides free GPU access. Enable it via Runtime → Change runtime type → GPU for faster embedding generation.
:::

## Method 2: Python ProtSpace CLI

For local processing with more control and reproducibility.

### Installation

```bash
pip install protspace
```

For GPU support:

```bash
pip install protspace[gpu]
```

### From UniProt Query

Generate embeddings and visualizations directly from UniProt:

```bash
protspace-query \
  -q "(ft_domain:kinase) AND (reviewed:true)" \
  -o output_dir \
  -m pca2,umap2,tsne2 \
  --model esm2 \
  --max-sequences 10000
```

**Parameters:**

- `-q`: UniProt query string
- `-o`: Output directory
- `-m`: Projection methods (comma-separated)
- `--model`: Embedding model (esm2, prott5, prot-bert)
- `--max-sequences`: Limit number of proteins

### From Your Own Embeddings

If you already have embeddings:

```bash
protspace-local \
  -i embeddings.h5 \
  -f features.csv \
  -o output_dir \
  -m pca2,umap2,tsne2,pacmap2
```

**Input format for embeddings.h5:**

```python
import h5py
import numpy as np

# Create HDF5 file with embeddings
with h5py.File('embeddings.h5', 'w') as f:
    # Each protein is a dataset named by its ID
    f.create_dataset('P12345', data=embedding_vector)
    f.create_dataset('P67890', data=embedding_vector)
    # ... more proteins
```

**Input format for features.csv:**

```csv
identifier,taxonomy,family,length,organism
P12345,Bacteria,Kinase,342,Escherichia coli
P67890,Archaea,Phosphatase,289,Sulfolobus solfataricus
Q54321,Eukaryota,Kinase,401,Homo sapiens
```

::: tip Required Column
The `identifier` column must match the dataset names in the HDF5 file.
:::

### Available Projection Methods

Specify multiple methods with `-m`:

```bash
# 2D projections
-m pca2,umap2,tsne2,mds2,pacmap2

# Mix of 2D and 3D
-m pca2,pca3,umap2,umap3,tsne2

# All methods
-m pca2,pca3,umap2,umap3,tsne2,tsne3,mds2,pacmap2
```

### Advanced Options

```bash
protspace-local \
  -i embeddings.h5 \
  -f features.csv \
  -o output_dir \
  -m umap2,tsne2 \
  --umap-n-neighbors 30 \
  --umap-min-dist 0.1 \
  --tsne-perplexity 50 \
  --seed 42
```

## Method 3: Custom Workflow

For complete control over the process.

### Step 1: Generate Embeddings

Use any protein language model to generate embeddings:

```python
from transformers import AutoTokenizer, AutoModel
import torch

model_name = "Rostlab/prot_t5_xl_half_uniref50-enc"
tokenizer = AutoTokenizer.from_pretrained(model_name)
model = AutoModel.from_pretrained(model_name)

sequences = ["MKTAYIAKQRQISFVKSHFSRQ", "MQIFVKTLTGKTITLEVEPS"]

# Tokenize and generate embeddings
inputs = tokenizer(sequences, return_tensors="pt", padding=True)
with torch.no_grad():
    outputs = model(**inputs)
    embeddings = outputs.last_hidden_state.mean(dim=1)  # Mean pooling
```

### Step 2: Apply Dimensionality Reduction

```python
from sklearn.decomposition import PCA
from umap import UMAP
from sklearn.manifold import TSNE
import pandas as pd

# PCA
pca = PCA(n_components=2)
coords_pca = pca.fit_transform(embeddings)

# UMAP
umap = UMAP(n_components=2, n_neighbors=15, min_dist=0.1)
coords_umap = umap.fit_transform(embeddings)

# t-SNE
tsne = TSNE(n_components=2, perplexity=30)
coords_tsne = tsne.fit_transform(embeddings)

# Create DataFrame
projections_data = pd.DataFrame({
    'identifier': protein_ids,
    'x_pca2': coords_pca[:, 0],
    'y_pca2': coords_pca[:, 1],
    'x_umap2': coords_umap[:, 0],
    'y_umap2': coords_umap[:, 1],
    'x_tsne2': coords_tsne[:, 0],
    'y_tsne2': coords_tsne[:, 1],
})
```

### Step 3: Prepare Feature Data

```python
# Create features DataFrame
features_data = pd.DataFrame({
    'identifier': protein_ids,
    'taxonomy': ['Bacteria', 'Archaea', 'Eukaryota'],
    'family': ['Kinase', 'Phosphatase', 'Kinase'],
    'length': [342, 289, 401],
    'GO_terms': ['GO:0001;GO:0002', 'GO:0003', 'GO:0001;GO:0004'],
})
```

### Step 4: Create Projection Metadata

```python
projections_metadata = pd.DataFrame({
    'method': ['pca2', 'umap2', 'tsne2'],
    'dimensions': [2, 2, 2],
    'parameters': [
        '{"explained_variance": [0.34, 0.21]}',
        '{"n_neighbors": 15, "min_dist": 0.1}',
        '{"perplexity": 30}'
    ]
})
```

### Step 5: Bundle into Parquet Bundle

```python
import pyarrow.parquet as pq
import pyarrow as pa

# Save to individual parquet files
pq.write_table(pa.Table.from_pandas(features_data), 'features.parquet')
pq.write_table(pa.Table.from_pandas(projections_metadata), 'metadata.parquet')
pq.write_table(pa.Table.from_pandas(projections_data), 'projections.parquet')

# Concatenate with delimiters
DELIMITER = b'---PARQUET_DELIMITER---'

with open('output.parquetbundle', 'wb') as outfile:
    with open('features.parquet', 'rb') as f:
        outfile.write(f.read())
    outfile.write(DELIMITER)
    with open('metadata.parquet', 'rb') as f:
        outfile.write(f.read())
    outfile.write(DELIMITER)
    with open('projections.parquet', 'rb') as f:
        outfile.write(f.read())
```

## Adding Custom Metadata

### From External Sources

Merge additional annotations into your features table:

```python
import pandas as pd

# Load existing features
features = pd.read_parquet('selected_features.parquet')

# Load your custom annotations
custom_data = pd.read_csv('my_annotations.csv')

# Merge on identifier
features_enriched = features.merge(custom_data, on='identifier', how='left')

# Save updated features
features_enriched.to_parquet('selected_features_updated.parquet')
```

### Multi-Label Features

Use semicolons to separate multiple values:

```python
# Create multi-label column
features['GO_terms'] = features['GO_terms'].apply(
    lambda x: ';'.join(x) if isinstance(x, list) else x
)
```

## Validation Checklist

Before using your `.parquetbundle` file, verify:

- [ ] File ends with `.parquetbundle` extension
- [ ] Contains exactly two `---PARQUET_DELIMITER---` markers
- [ ] All three parquet sections are valid
- [ ] `identifier` column exists in all tables
- [ ] Identifiers are consistent across tables
- [ ] At least one projection method exists
- [ ] Projection data has `x_{method}` and `y_{method}` columns
- [ ] No missing values in coordinate columns
- [ ] Feature columns are properly formatted

### Test Your Bundle

```javascript
import {
  isParquetBundle,
  extractRowsFromParquetBundle,
  convertParquetToVisualizationDataOptimized
} from '@protspace/core';

const file = // ... your file
const arrayBuffer = await file.arrayBuffer();

// Validate format
if (!isParquetBundle(arrayBuffer)) {
  console.error('Invalid bundle format');
}

// Try to load
try {
  const rows = await extractRowsFromParquetBundle(arrayBuffer);
  const data = await convertParquetToVisualizationDataOptimized(rows);
  console.log('Success!', data.proteins.length, 'proteins loaded');
} catch (error) {
  console.error('Failed to load:', error);
}
```

## Performance Recommendations

### Dataset Size

| Size       | Proteins    | Recommendation               |
| ---------- | ----------- | ---------------------------- |
| Small      | < 10K       | All methods work well        |
| Medium     | 10K - 100K  | Use UMAP or PCA, limit t-SNE |
| Large      | 100K - 500K | Use PCA and UMAP only        |
| Very Large | > 500K      | Consider subsetting data     |

### Projection Method Selection

For most use cases, include:

- **PCA** - Fast, linear, interpretable
- **UMAP** - Best quality-speed tradeoff
- **t-SNE** (optional) - If dataset < 50K proteins

### Feature Selection

Include features that are:

- Biologically meaningful
- Well-annotated (< 20% missing values)
- Discriminative (not all proteins have the same value)
- Human-readable (avoid internal IDs)

## Troubleshooting

### "Bundle missing required tables"

Ensure all three parquet sections exist and are properly delimited.

### "Projection columns not found"

Check that column names match the pattern `x_{method}`, `y_{method}`.

### "Identifier mismatch"

Verify all tables have the same set of identifiers.

### "File too large"

- Reduce number of proteins
- Remove unnecessary features
- Use fewer projection methods
- Compress more aggressively

## Next Steps

- [Data Format](/guide/data-format) - Understand the file structure
- [Getting Started](/guide/getting-started) - Load your data
- [API Reference](/api/data-loading) - Programmatic loading
