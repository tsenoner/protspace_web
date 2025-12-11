# What is ProtSpace?

**ProtSpace** is a browser-based, interactive visualization tool for exploring protein language model (pLM) embeddings. It helps researchers and biologists understand high-dimensional protein data by visualizing it in 2D.

## Why Use ProtSpace?

Protein language models (like ProtT5, ESM2, Ankh) create embeddings that capture biological information in hundreds or thousands of dimensions. ProtSpace helps you:

- **See patterns**: Visualize how proteins cluster based on their embeddings
- **Explore relationships**: Find proteins with similar properties
- **Discover insights**: Identify functional groupings and evolutionary clusters
- **Share findings**: Export figures or the dataset itself for others to explore

## Key Features

| Feature              | Description                                                             |
| -------------------- | ----------------------------------------------------------------------- |
| **No Installation**  | Runs entirely in your browser at [protspace.app](https://protspace.app) |
| **Privacy-First**    | Your data never leaves your computer - all processing is client-side    |
| **Multiple Views**   | PCA, UMAP, t-SNE, MDS, and PaCMAP projections                           |
| **Rich Annotations** | Color by taxonomy, function, family, or any annotation                  |
| **3D Structures**    | View protein structures from AlphaFold via 3D-Beacons API               |
| **Export Options**   | Save images (PNG, PDF), data (JSON), and protein IDs                    |

## How It Works

1. **Prepare your data**: Use our [Google Colab notebook](/guide/data-preparation) or [Python CLI](/guide/python-cli) to generate a `.parquetbundle` file from your protein embeddings
2. **Load into ProtSpace**: Drag & drop the file onto the [Explore page](https://protspace.app/explore)
3. **Explore**: Navigate the visualization, filter categories, switch projections, and discover patterns

## Privacy and Security

ProtSpace processes everything locally in your browser:

- **No uploads**: Files are never sent to any server
- **No tracking**: We don't collect usage data
- **Offline capable**: Works without internet (except for 3D structures)
- **Open source**: Fully transparent [codebase on GitHub](https://github.com/tsenoner/protspace_web)

## Use Cases

- **Functional Analysis**: Group proteins by predicted function
- **Evolutionary Studies**: Identify convergent evolution patterns
- **Quality Control**: Check embedding model outputs for biases
- **Education**: Teach protein bioinformatics interactively
- **Publication**: Create figures for papers and presentations

## Performance

ProtSpace can handle datasets with **200,000+ proteins** directly in your browser without server uploads.

## Next Steps

- **[Quick Start](/)** - Get started in 5 minutes
- **[Using Google Colab](/guide/data-preparation)** - Prepare your data
- **[Using the Explore Page](/explore/)** - Learn all the features
- **[For Developers](/developers/installation)** - Embed components in your app
