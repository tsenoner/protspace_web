# Contributing

Guide for developers who want to contribute to ProtSpace.

## Repository Structure

```
protspace_web/
├── app/                    # Demo application (Vite + React)
│   ├── src/
│   │   ├── pages/          # React pages
│   │   └── components/     # React components
│   └── public/             # Static assets
├── packages/
│   ├── core/               # Main web components library
│   │   └── src/components/
│   │       ├── scatter-plot/
│   │       ├── legend/
│   │       ├── control-bar/
│   │       └── structure-viewer/
│   └── utils/              # Shared utilities
├── docs/                   # Documentation (VitePress)
├── data/                   # Example datasets
└── notebooks/              # Jupyter notebooks for data prep
```

## Technology Stack

| Area              | Technologies                     |
| ----------------- | -------------------------------- |
| **Components**    | Lit, TypeScript                  |
| **Build**         | Vite, Turbo (monorepo)           |
| **Demo App**      | React                            |
| **Visualization** | Canvas API, WebGL                |
| **3D Structures** | Mol\*                            |
| **Data**          | Parquet, hyparquet, Apache Arrow |

## Requirements

- Node.js 18+
- pnpm 8+
- Git

## Setup

```bash
# Clone repository
git clone https://github.com/tsenoner/protspace_web.git
cd protspace_web

# Install dependencies
pnpm install

# Build all packages
pnpm build

# Start development server
pnpm dev
```

The dev server runs at `http://localhost:5173`

## Development Commands

```bash
# Start dev server (watches for changes)
pnpm dev

# Build all packages
pnpm build

# Run linter
pnpm lint

# Fix linting issues
pnpm lint:fix

# Format code
pnpm format

# Type check
pnpm typecheck

# Build documentation
pnpm docs:build

# Preview documentation
pnpm docs:dev
```

## Architecture

### Web Components (Lit)

Components are built with Lit and follow this pattern:

```typescript
import { LitElement, html, css } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';

@customElement('protspace-example')
export class ProtspaceExample extends LitElement {
  @property({ type: String }) title = 'Example';
  @state() private _count = 0;

  static styles = css`
    :host {
      display: block;
    }
  `;

  render() {
    return html`
      <div>
        <h1>${this.title}</h1>
        <button @click=${this._increment}>Count: ${this._count}</button>
      </div>
    `;
  }

  private _increment() {
    this._count++;
    this.dispatchEvent(
      new CustomEvent('count-change', {
        detail: { count: this._count },
        bubbles: true,
        composed: true,
      }),
    );
  }
}
```

### Event Communication

Components communicate via custom events:

```typescript
// Dispatch event
this.dispatchEvent(
  new CustomEvent('selection-change', {
    detail: { selected: this.selectedIds },
    bubbles: true,
    composed: true,
  }),
);

// Listen for events
plot.addEventListener('selection-change', (e) => {
  console.log('Selected:', e.detail.selected);
});
```

### Canvas Rendering

The scatterplot uses Canvas for performance:

```typescript
private renderPoints() {
  const ctx = this.canvas.getContext('2d');
  ctx.clearRect(0, 0, this.width, this.height);

  for (const point of this.visiblePoints) {
    ctx.beginPath();
    ctx.arc(point.x, point.y, this.pointSize, 0, Math.PI * 2);
    ctx.fillStyle = point.color;
    ctx.fill();
  }
}
```

## Making Changes

### Branching Strategy

1. Create feature branch from `main`
2. Make changes
3. Submit pull request
4. Get review
5. Merge to `main`

```bash
git checkout -b feature/my-feature
# Make changes
git commit -m "Add my feature"
git push origin feature/my-feature
```

### Commit Messages

Use conventional commits:

```
feat: add new feature
fix: resolve bug
docs: update documentation
style: formatting changes
refactor: code restructuring
test: add tests
chore: maintenance
```

### Pull Requests

Include in your PR:

1. Clear description of changes
2. Screenshots for UI changes
3. Test coverage for new features
4. Documentation updates

## Testing

### Manual Testing

1. Start dev server: `pnpm dev`
2. Load example data from `data/` folder
3. Test all components work correctly

### Building for Production

```bash
pnpm build
```

Check `packages/core/dist/` for output.

## Documentation

Documentation uses VitePress:

```bash
# Start docs dev server
pnpm docs:dev

# Build documentation
pnpm docs:build
```

Edit files in `docs/` folder.

## Release Process

1. Update version in `package.json`
2. Update `CHANGELOG.md`
3. Create git tag
4. Push to GitHub
5. CI/CD handles npm publish

## Getting Help

- [GitHub Issues](https://github.com/tsenoner/protspace_web/issues) - Bug reports
- [GitHub Discussions](https://github.com/tsenoner/protspace_web/discussions) - Questions

## License

Apache 2.0 - See [LICENSE](https://github.com/tsenoner/protspace_web/blob/main/LICENSE)
