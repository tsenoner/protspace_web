# ProtSpace Web

[![License: Apache 2.0](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](https://www.apache.org/licenses/LICENSE-2.0)
[![DOI](https://img.shields.io/badge/DOI-10.1016%2Fj.jmb.2025.168940-blue)](https://doi.org/10.1016/j.jmb.2025.168940)

ProtSpace Web is a browser-based visualization tool for exploring protein language model (pLM) embeddings. Built with modular web components (canvas renderer, interactive legend, control bar), it enables interactive exploration through dimensionality reduction methods (PCA, UMAP, t-SNE) with zoom, pan, and selection. Color by features, view 3D protein structures, and export images or data files for sharing.

## 🌐 Try Online

**Demo**: https://protspace.app/ → Drag & drop `.parquetbundle` files

## 🚀 Prepare Your Data

**Option 1: Google Colab** _(no local installation needed)_

Generate `.parquetbundle` files directly in your browser:

[![Open In Colab](https://colab.research.google.com/assets/colab-badge.svg)](https://colab.research.google.com/github/tsenoner/protspace_web/blob/main/notebooks/ProtSpace_Preparation.ipynb)

**Option 2: Python ProtSpace** _(local installation)_

```bash
pip install protspace

# Query UniProt and generate visualization files
protspace-query -q "(ft_domain:phosphatase) AND (reviewed:true)" -o output_dir

# Or use your own embeddings
protspace-local -i embeddings.h5 -o output_dir
```

See the [Python ProtSpace repository](https://github.com/tsenoner/protspace) for details.

## 💻 Embed in Your Project

Use the web components in any HTML page or JavaScript framework:

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
  </head>
  <body>
    <input type="file" id="fileInput" accept=".parquetbundle" />

    <protspace-control-bar auto-sync scatterplot-selector="#plot"></protspace-control-bar>
    <protspace-scatterplot id="plot"></protspace-scatterplot>
    <protspace-legend auto-sync scatterplot-selector="#plot"></protspace-legend>
    <protspace-structure-viewer auto-sync scatterplot-selector="#plot"></protspace-structure-viewer>

    <script type="module">
      const fileInput = document.getElementById('fileInput');
      const plot = document.getElementById('plot');

      fileInput.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const arrayBuffer = await readFileOptimized(file);
        const rows = await extractRowsFromParquetBundle(arrayBuffer);
        const data = await convertParquetToVisualizationDataOptimized(rows);

        plot.data = data;
        plot.selectedProjectionIndex = 0;
        plot.selectedFeature = Object.keys(data.features)[0] || '';
      });
    </script>
  </body>
</html>
```

### Available Components

- `<protspace-scatterplot>`: Main 2D/3D visualization
- `<protspace-legend>`: Filter and color categories
- `<protspace-control-bar>`: Switch projections, features, and export
- `<protspace-structure-viewer>`: Display 3D protein structures

### Documentation

📚 **[Full Documentation](https://tsenoner.github.io/protspace_web/)** - Complete guides, API reference, and examples

## 🔧 Development

```bash
git clone https://github.com/tsenoner/protspace_web.git
cd protspace_web
pnpm install
pnpm dev  # starts local demo at http://localhost:5173
```

## 🧹 Code Style (Prettier + ESLint)

- **Prettier (formatting)**
  - Format all files: `pnpm run format`
  - Check without writing: `pnpm run format:check`

- **ESLint (code quality)**
  - Lint all packages: `pnpm run lint`
  - Auto-fix safe issues: `pnpm run lint:fix`

Prettier handles formatting and ESLint focuses on correctness and best practices. The ESLint config integrates `eslint-config-prettier` to avoid conflicts with Prettier's formatting.

## ⚖️ License

Apache License 2.0 - see [LICENSE](LICENSE)
