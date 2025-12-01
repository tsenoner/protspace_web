# What is ProtSpace Web?

**ProtSpace Web** is a browser-based, interactive visualization tool specifically designed for exploring protein language model (pLM) embeddings. Built entirely with modular web components, it provides a lightweight, framework-agnostic solution for visualizing high-dimensional protein data.

## Core Purpose

Protein language models create embeddings (typically 1000+ dimensions) that capture complex biological information. Understanding these representations requires reducing them to 2D or 3D space for human visualization and interpretation. ProtSpace Web addresses this challenge by providing:

- **Dimensionality reduction visualization** using PCA, UMAP, t-SNE, MDS, and PaCMAP
- **Interactive exploration** with zoom, pan, selection, and filtering
- **Feature-based coloring** to identify patterns and clusters
- **3D structure viewing** alongside 2D embeddings

## Architecture Overview

```
┌────────────────────────────────────────────────────────────────────┐
│                        Browser Environment                         │
├────────────────────────────────────────────────────────────────────┤
│                                                                    │
│  ┌─────────────────┐    ┌────────────────────────────────────────┐ │
│  │  File Input /   │───▶│           ProtSpace Core               │ │
│  │  Data Loading   │    │  ┌────────────┐  ┌──────────────────┐  │ │
│  └─────────────────┘    │  │ Scatterplot│  │   Control Bar    │  │ │
│                         │  │  (Canvas)  │  │   (Dropdowns)    │  │ │
│                         │  └─────┬──────┘  └────────┬─────────┘  │ │
│                         │        │                  │            │ │
│                         │  ┌─────▼──────────────────▼─────────┐  │ │
│                         │  │          Shared State            │  │ │
│                         │  └─────▲──────────────────▲─────────┘  │ │
│                         │        │                  │            │ │
│                         │  ┌─────┴──────┐  ┌───────┴────────┐    │ │
│                         │  │   Legend   │  │  3D Structure  │    │ │
│                         │  │  (Filter)  │  │    (Molstar)   │    │ │
│                         │  └────────────┘  └────────────────┘    │ │
│                         └────────────────────────────────────────┘ │
└────────────────────────────────────────────────────────────────────┘
```

## Web Components

ProtSpace Web provides four main web components:

| Component            | Tag Name                       | Purpose                                     |
| -------------------- | ------------------------------ | ------------------------------------------- |
| **Scatterplot**      | `<protspace-scatterplot>`      | Main 2D visualization with canvas rendering |
| **Legend**           | `<protspace-legend>`           | Category filtering and color mapping        |
| **Control Bar**      | `<protspace-control-bar>`      | Projection/feature selection and export     |
| **Structure Viewer** | `<protspace-structure-viewer>` | 3D protein structure display with Molstar   |

## Key Features

| Feature                 | Description                           |
| ----------------------- | ------------------------------------- |
| **Zero Installation**   | Runs entirely in the browser          |
| **Framework Agnostic**  | Web components work anywhere          |
| **High Performance**    | Canvas rendering for large datasets   |
| **Rich Interactions**   | Zoom, pan, select, filter             |
| **Multiple DR Methods** | PCA, UMAP, t-SNE, MDS, PaCMAP         |
| **3D Structures**       | Molstar integration for AlphaFold/PDB |
| **Export Options**      | PNG, SVG, JSON, CSV                   |

## Use Cases

- **Phage Protein Analysis**: Discover functional clusters and training biases
- **Venom Protein Studies**: Identify convergent evolution patterns
- **Function Prediction**: Find proteins with similar embeddings
- **Model Comparison**: Compare different pLM representations
- **Educational Tools**: Interactive protein bioinformatics teaching
- **Research Platforms**: Embed visualizations in custom applications

## Client-Side Architecture

ProtSpace Web operates entirely in the browser with no backend server required:

- **Data stays local**: Files never leave your computer
- **Privacy-first**: No uploads, no tracking, no external dependencies
- **Offline capable**: Works without internet connection after initial load
- **Fast**: Direct browser processing with WebGL acceleration

## Next Steps

- [Getting Started](/guide/getting-started) - Quick setup guide
- [Installation](/guide/installation) - Detailed installation options
- [Data Format](/guide/data-format) - Understanding .parquetbundle files
- [API Reference](/api/) - Component documentation
