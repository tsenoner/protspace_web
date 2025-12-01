# Developer Guide

This guide is for developers who want to contribute to ProtSpace Web or understand its internal architecture.

## Repository Structure

```
protspace_web/
├── app/                    # Demo application (Vite + React)
│   ├── src/
│   │   ├── pages/          # React pages
│   │   ├── components/     # React components
│   │   └── demo/           # Demo initialization logic
│   └── public/             # Static assets
├── packages/
│   ├── core/               # Main web components library
│   │   ├── src/
│   │   │   └── components/
│   │   │       ├── scatter-plot/
│   │   │       ├── legend/
│   │   │       ├── control-bar/
│   │   │       └── structure-viewer/
│   │   └── dist/           # Built components
│   ├── utils/              # Shared utilities
│   │   ├── src/
│   │   │   ├── visualization/  # Color schemes, scales
│   │   │   └── structure/      # Structure loading
│   │   └── dist/
│   └── react-bridge/       # React wrappers (if needed)
├── docs/                   # Documentation (VitePress)
├── data/                   # Example datasets
├── notebooks/              # Jupyter notebooks for data prep
└── .github/workflows/      # CI/CD configuration
```

## Technology Stack

### Frontend

- **Lit**: Web components framework
- **TypeScript**: Type-safe JavaScript
- **Vite**: Build tool and dev server
- **React**: Demo application UI

### Visualization

- **Canvas API**: High-performance 2D rendering
- **WebGL**: GPU-accelerated graphics
- **Molstar**: 3D protein structure viewer

### Data

- **Apache Parquet**: Columnar data format
- **hyparquet**: Browser parquet reader
- **Apache Arrow**: In-memory data structures

### Development

- **pnpm**: Package manager
- **Turbo**: Monorepo build system
- **ESLint**: Code linting
- **Prettier**: Code formatting

## Requirements

- **Node.js**: 18 or higher
- **pnpm**: 8 or higher
- **Git**: For version control

## Setup

### Initial Setup

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

### Development Commands

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

# Check formatting
pnpm format:check

# Type check
pnpm type-check

# Clean build artifacts
pnpm clean

# Build documentation
pnpm docs:build

# Preview documentation
pnpm docs:preview
```

## Monorepo Structure

ProtSpace Web uses a monorepo managed by Turbo:

### Workspaces

- `@protspace/app`: Demo application
- `@protspace/core`: Web components
- `@protspace/utils`: Shared utilities
- `@protspace/react-bridge`: React wrappers

### Dependencies

```
@protspace/app
  ├─ @protspace/core
  └─ @protspace/utils

@protspace/core
  └─ @protspace/utils

@protspace/react-bridge
  └─ @protspace/core
```

## Adding a New Component

### 1. Create Component Directory

```bash
mkdir -p packages/core/src/components/my-component
cd packages/core/src/components/my-component
```

### 2. Create Component Files

```typescript
// my-component.ts
import { LitElement, html } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { myComponentStyles } from './my-component.styles';

@customElement('protspace-my-component')
export class ProtspaceMyComponent extends LitElement {
  static styles = myComponentStyles;

  @property({ type: String })
  myProp = '';

  render() {
    return html` <div class="my-component">${this.myProp}</div> `;
  }
}
```

```typescript
// my-component.styles.ts
import { css } from 'lit';

export const myComponentStyles = css`
  .my-component {
    padding: 1rem;
    border: 1px solid #ddd;
  }
`;
```

### 3. Export Component

```typescript
// packages/core/src/index.ts
export * from './components/my-component/my-component';
```

### 4. Add to Demo

```typescript
// app/src/demo/main.ts
const myComponent = document.getElementById('myComponent');
// Initialize and configure
```

### 5. Write Documentation

Create `docs/api/my-component.md` with usage, properties, methods, and events.

## Component Guidelines

### Naming Conventions

- **Component**: `ProtspaceMyComponent`
- **Tag**: `protspace-my-component`
- **File**: `my-component.ts`
- **Styles**: `my-component.styles.ts`

### Properties

Use decorators for reactive properties:

```typescript
@property({ type: String })
myProp = '';

@property({ type: Boolean, attribute: 'my-flag' })
myFlag = false;

@state()
private _internalState = 0;
```

### Events

Dispatch custom events for component interactions:

```typescript
this.dispatchEvent(
  new CustomEvent('my-event', {
    detail: { value: this.myProp },
    bubbles: true,
    composed: true,
  }),
);
```

### Shadow DOM

Use Shadow DOM for encapsulation:

```typescript
render() {
  return html`<div>Content</div>`;
}
```

### Performance

- Use `requestAnimationFrame` for animations
- Debounce expensive operations
- Lazy-load large dependencies
- Implement virtual scrolling for large lists

## Testing

### Unit Tests

```typescript
// my-component.test.ts
import { fixture, expect } from '@open-wc/testing';
import './my-component';

describe('ProtspaceMyComponent', () => {
  it('renders with default props', async () => {
    const el = await fixture('<protspace-my-component></protspace-my-component>');
    expect(el).to.exist;
  });

  it('updates on prop change', async () => {
    const el = await fixture('<protspace-my-component my-prop="test"></protspace-my-component>');
    expect(el.myProp).to.equal('test');
  });
});
```

### E2E Tests

```typescript
// Use Playwright for end-to-end testing
test('loads data and displays plot', async ({ page }) => {
  await page.goto('http://localhost:5173');
  // Test interactions
});
```

## Code Style

### TypeScript

```typescript
// ✅ Good
interface MyData {
  id: string;
  value: number;
}

function processData(data: MyData[]): number {
  return data.reduce((sum, item) => sum + item.value, 0);
}

// ❌ Bad
function processData(data: any) {
  return data.reduce((sum: any, item: any) => sum + item.value, 0);
}
```

### Lit Components

```typescript
// ✅ Good
render() {
  return html`
    <div class="container">
      ${this.items.map(item => html`
        <span>${item}</span>
      `)}
    </div>
  `;
}

// ❌ Bad
render() {
  let content = '';
  for (const item of this.items) {
    content += `<span>${item}</span>`;
  }
  return html`<div>${content}</div>`;
}
```

## Lint and Format

The project uses ESLint and Prettier:

```bash
# Auto-fix linting issues
pnpm lint:fix

# Format all files
pnpm format

# Check before committing
pnpm lint && pnpm format:check
```

### Pre-commit Hooks

TODO: Configure Husky for auto-formatting

## Build Process

### Development Build

```bash
pnpm dev  # Watches for changes, fast rebuild
```

### Production Build

```bash
pnpm build  # Optimized build for all packages
```

### Build Output

```
packages/core/dist/
├── core.js           # UMD bundle
├── core.mjs          # ES module
└── index.d.ts        # TypeScript definitions
```

## Release Process

### Version Bump

```bash
# Use changesets for versioning
pnpm changeset

# Follow prompts to describe changes
# Commit the changeset file
```

### Publish

```bash
# Build all packages
pnpm build

# Version packages based on changesets
pnpm version-packages

# Publish to npm
pnpm release
```

### GitHub Release

1. Tag the release: `git tag v1.0.0`
2. Push tags: `git push --tags`
3. GitHub Actions automatically deploys

## Contributing

### Getting Started

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/my-feature`
3. Make your changes
4. Run tests: `pnpm test`
5. Lint and format: `pnpm lint && pnpm format`
6. Commit: `git commit -m "Add my feature"`
7. Push: `git push origin feature/my-feature`
8. Create a pull request

### Pull Request Guidelines

- Clear description of changes
- Reference related issues
- Include tests for new features
- Update documentation
- Follow code style guidelines
- Keep commits focused and atomic

### Code Review

All pull requests require:

- Passing CI checks
- Code review from maintainer
- Up-to-date with main branch
- No merge conflicts

## Debugging

### Browser DevTools

```javascript
// Access component instance
const plot = document.getElementById('plot');
console.log(plot.data);

// Trigger methods
plot.resetView();
```

### Lit DevTools

Install the Lit DevTools browser extension for:

- Component tree inspection
- Property/state monitoring
- Event tracking

### Performance Profiling

```javascript
// Use Performance API
performance.mark('start');
// ... code to profile
performance.mark('end');
performance.measure('operation', 'start', 'end');
```

## Architecture Decisions

### Why Lit?

- Lightweight (5KB)
- Standards-based (Web Components)
- Fast rendering
- TypeScript support
- Framework agnostic

### Why Canvas for Visualization?

- GPU-accelerated rendering
- Handles 100k+ points smoothly
- Better performance than SVG/DOM
- Precise control over rendering

### Why Parquet?

- Columnar format (efficient queries)
- Excellent compression
- Browser-compatible
- Type preservation
- Industry standard

## Performance Optimization

### Canvas Rendering

```typescript
// Use requestAnimationFrame
requestAnimationFrame(() => {
  this.renderPoints();
});

// Batch operations
const points = this.calculatePositions();
this.drawAll(points); // Single draw call
```

### Data Processing

```typescript
// Use Web Workers for heavy computation
const worker = new Worker('./data-worker.js');
worker.postMessage(largeDataset);
worker.onmessage = (e) => {
  this.processedData = e.data;
};
```

### Memory Management

```typescript
// Clear references when done
componentDisconnected() {
  this.data = null;
  this.viewer?.dispose();
}
```

## Resources

- [Lit Documentation](https://lit.dev/)
- [Web Components](https://developer.mozilla.org/en-US/docs/Web/Web_Components)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
- [Turbo Documentation](https://turbo.build/repo/docs)

## Getting Help

- **Issues**: [GitHub Issues](https://github.com/tsenoner/protspace_web/issues)
- **Discussions**: [GitHub Discussions](https://github.com/tsenoner/protspace_web/discussions)
- **Contributing**: See [CONTRIBUTING.md](https://github.com/tsenoner/protspace_web/blob/main/CONTRIBUTING.md)
