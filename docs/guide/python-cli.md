# Using Python CLI

For local processing or automation, use the ProtSpace Python package.

## Installation

```bash
pip install protspace
```

## Commands

### From UniProt Query

```bash
protspace-query -q "(ft_domain:kinase) AND (reviewed:true)" -m pca2,umap2
```

### From Your Own Embeddings

```bash
protspace-local -i embeddings.h5 -m pca2,umap2
```

## Parameters

Both commands share similar parameters. The key difference:

- `protspace-query` uses `-q` to specify a UniProt query
- `protspace-local` uses `-i` to specify an input embeddings file

| Parameter | Description                     | Command    |
| --------- | ------------------------------- | ---------- |
| `-q`      | UniProt query string            | query only |
| `-i`      | Input embeddings (HDF5)         | local only |
| `-o`      | Output directory                | both       |
| `-m`      | Projection methods              | both       |
| `-f`      | Annotations (names or CSV path) | both       |

### Annotations

Specify annotations with `-f`:

```bash
# By name (auto-retrieved)
-f protein_family,reviewed,pfam,genus,species

# Or provide a CSV file
-f annotations.csv
```

**CSV format:**

```csv
identifier,taxonomy,family,function
P12345,Bacteria,Kinase,ATP binding
P67890,Archaea,Phosphatase,Hydrolase
Q54321,Eukaryota,Kinase,Transferase
```

The `identifier` column must match protein IDs in your embeddings file.

## Projection Methods

Methods require a dimension suffix: `2` for 2D, `3` for 3D.

::: warning
`pca` alone throws an error. Use `pca2` or `pca3`.
:::

| Method | 2D        | 3D        | Description                            |
| ------ | --------- | --------- | -------------------------------------- |
| PCA    | `pca2`    | `pca3`    | Principal Component Analysis           |
| UMAP   | `umap2`   | `umap3`   | Uniform Manifold Approximation         |
| t-SNE  | `tsne2`   | `tsne3`   | t-distributed Stochastic Neighbor Emb. |
| PaCMAP | `pacmap2` | `pacmap3` | Pairwise Controlled Manifold Approx.   |
| MDS    | `mds2`    | `mds3`    | Multidimensional Scaling               |

**Use 2D projections** - ProtSpace is optimized for 2D visualization.

## More Info

Find full docs and more examples on the [ProtSpace Python GitHub](https://github.com/tsenoner/protspace).
