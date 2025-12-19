# Using Google Colab

The easiest way to prepare your data for ProtSpace - no local installation required!

[![Open In Colab](https://colab.research.google.com/assets/colab-badge.svg)](https://colab.research.google.com/github/tsenoner/protspace_web/blob/main/notebooks/ProtSpace_Preparation.ipynb)

## What the Notebook Does

The Colab notebook takes protein embeddings and generates a visualization-ready `.parquetbundle` file:

1. **Reads your embeddings** from an HDF5 file (.h5)
2. **Applies dimensionality reduction** (PCA, UMAP, t-SNE, PaCMAP, MDS)
3. **Retrieves annotations** from UniProt, InterPro, and NCBI Taxonomy
4. **Creates the `.parquetbundle`** file ready for ProtSpace exploration

## Step 1: Get Protein Embeddings

You need an HDF5 file (.h5) containing protein embeddings. There are three ways to obtain this:

### Option A: Download from UniProt (Recommended)

1. Go to [uniprot.org](https://www.uniprot.org/)
2. Search for proteins using [UniProt query syntax](https://www.uniprot.org/help/query-fields) (e.g., `(ft_domain:phosphatase) AND (reviewed:true)`)
3. Click **"Downoad"** → Select Format **"Embeddings"** → submit job **"Submit"**
4. Download the results - check UniProts **Tools Dashboard** for the prepared embedding file

### Option B: Generate from FASTA

Use the dedicated embedding generation notebook:

[![Open Embedding Generator](https://colab.research.google.com/assets/colab-badge.svg)](https://colab.research.google.com/github/tsenoner/protspace/blob/main/examples/notebook/ClickThrough_GenerateEmbeddings.ipynb)

This notebook:

- Takes a FASTA file as input
- Generates embeddings using various protein language models (ProtT5, ESM2, etc.)
- Outputs an HDF5 file ready for ProtSpace

### Option C: Use Your Own Embeddings

For advanced users with custom embeddings, save them as an HDF5 file where each protein is stored as a dataset named by its identifier.

## Step 2: Run the ProtSpace Notebook

1. **Open the notebook**: Click the Colab badge above
2. **Install dependencies**: Run the first cell (~1 minute)
3. **Upload your embeddings**: Use the upload widget to select your `.h5` file

## Step 3: Configure Visualization Options

### Select Annotations

Choose which annotations to include for coloring your visualization:

| Source       | Available Annotations                                                    |
| ------------ | ------------------------------------------------------------------------ |
| **UniProt**  | annotation_score, subcellular_location, protein_families, reviewed, etc. |
| **InterPro** | CATH, Pfam, signal_peptide, superfamily                                  |
| **Taxonomy** | kingdom, phylum, class, order, family, genus, species                    |

::: tip First-Time Taxonomy
Selecting Taxonomy annotations for the first time will download the required database (~1 minute).
:::

### Select Dimensionality Reduction Methods

Choose which 2D projections to include:

- **PCA** - Fast, good for initial overview
- **UMAP** - Best balance of speed and quality
- **t-SNE** - Great for clusters, slower for large datasets
- **PaCMAP** - Good alternative to t-SNE/UMAP
- **MDS** - Preserves pairwise distances

### Adjust Parameters (Optional)

Fine-tune parameters for each method:

| Method | Parameters                      |
| ------ | ------------------------------- |
| UMAP   | N Neighbors, Min Dist           |
| t-SNE  | Perplexity, Learning Rate       |
| PaCMAP | N Neighbors, MN Ratio, FP Ratio |
| MDS    | N Init, Max Iter                |

## Step 4: Generate and Download

1. Click **"Generate Bundle"**
2. Wait for processing (time depends on dataset size)
3. Download your `.parquetbundle` file

## Step 5: Visualize in ProtSpace

1. Go to [protspace.app/explore](https://protspace.app/explore)
2. Drag & drop your `.parquetbundle` file onto the canvas
3. Start exploring!

## Tips

- **Start small**: Test with a subset of proteins first.
- **PCA is fastest**: All methods except PCA slow down exponentially as data size increases.
- **Try multiple methods**: For best results, include both PCA and UMAP.

## Alternative: Python CLI

For local processing, automation, or larger datasets, see the [Python CLI guide](/guide/python-cli).
