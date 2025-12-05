# Installation

There are multiple ways to use ProtSpace depending on your needs.

## Browser Only (No Installation)

The simplest option - just visit the demo:

**[https://protspace.app/](https://protspace.app/)**

No installation required. Load your `.parquetbundle` files and start exploring immediately.

## NPM Package

Install the `@protspace/core` package to embed ProtSpace in your own project.

::: code-group

```bash [npm]
npm install @protspace/core
```

```bash [pnpm]
pnpm add @protspace/core
```

```bash [yarn]
yarn add @protspace/core
```

:::

Then import in your JavaScript/TypeScript:

```javascript
import '@protspace/core';
import {
  readFileOptimized,
  extractRowsFromParquetBundle,
  convertParquetToVisualizationDataOptimized,
} from '@protspace/core';
```

Or use directly in HTML:

```html
<script type="module">
  import '@protspace/core';
</script>
```

## CDN

Use directly from a CDN without installation:

```html
<script type="module" src="https://unpkg.com/@protspace/core"></script>
```

::: warning Version Pinning
For production use, pin to a specific version:

```html
<script type="module" src="https://unpkg.com/@protspace/core@1.0.0"></script>
```

:::

## Development Setup

Clone and run the development server:

```bash
# Clone repository
git clone https://github.com/tsenoner/protspace_web.git
cd protspace_web

# Install dependencies
pnpm install

# Start development server
pnpm dev
```

The dev server runs at `http://localhost:5173`

## Python Data Generation

To generate `.parquetbundle` files, install the Python package:

```bash
pip install protspace
```

### Generate from UniProt Query

```bash
protspace-query \
  -q "(ft_domain:kinase) AND (reviewed:true)" \
  -o output_dir \
  -m pca2,umap2,tsne2
```

### Generate from Your Embeddings

```bash
protspace-local \
  -i embeddings.h5 \
  -f features.csv \
  -o output_dir \
  -m pca2,umap2,tsne2
```

See [Data Preparation](/guide/data-preparation) for detailed instructions.

## Requirements

### Browser Support

ProtSpace requires modern browsers with WebGL support:

- Chrome 80+
- Firefox 75+
- Safari 13.1+
- Edge 80+

::: tip Best Performance
Chrome/Edge provide the best performance for large datasets due to optimized canvas rendering.
:::

### Development Requirements

- Node.js 18+
- pnpm 8+

### Python Data Generation

- Python 3.9+
- For GPU acceleration: CUDA 11.0+ (optional but recommended)

## Verifying Installation

After installing the package, verify it works:

```html
<!DOCTYPE html>
<html>
  <head>
    <script type="module">
      import '@protspace/core';

      // Verify components are registered
      window.addEventListener('DOMContentLoaded', () => {
        console.log('Scatterplot:', customElements.get('protspace-scatterplot'));
        console.log('Legend:', customElements.get('protspace-legend'));
        console.log('Control Bar:', customElements.get('protspace-control-bar'));
        console.log('Structure Viewer:', customElements.get('protspace-structure-viewer'));
      });
    </script>
  </head>
  <body>
    <protspace-scatterplot></protspace-scatterplot>
  </body>
</html>
```

If all four components are defined, the installation is successful!

## Troubleshooting

### Module not found

If you see module resolution errors:

```bash
# Clear node_modules and reinstall
rm -rf node_modules package-lock.json
npm install
```

### Components not rendering

Check the browser console for errors. Common issues:

1. **Shadow DOM not supported**: Update to a modern browser
2. **WebGL not available**: Check graphics drivers
3. **Import path incorrect**: Verify the import statement matches your package manager

### TypeScript errors

Install type definitions:

```bash
npm install --save-dev @types/node
```

And ensure your `tsconfig.json` includes:

```json
{
  "compilerOptions": {
    "moduleResolution": "node",
    "esModuleInterop": true,
    "skipLibCheck": true
  }
}
```

## Next Steps

- [Getting Started](/guide/getting-started) - Quick start guide
- [Data Preparation](/guide/data-preparation) - Generate your data
- [Examples](/examples/) - Integration examples
- [API Reference](/api/) - Component documentation
