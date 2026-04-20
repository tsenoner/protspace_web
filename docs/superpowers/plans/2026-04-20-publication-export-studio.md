# Publication Export Studio Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add inline canvas annotations (indicator arrows, insets) and an Export Studio modal for publication-quality figure composition to ProtSpace.

**Architecture:** Hybrid workflow — annotate on the scatter canvas during exploration, open Export Studio to compose and export. New Lit web components for context menu, indicator layer, inset tool, and export studio. New annotation controller (factory function pattern) manages state and bridges canvas ↔ studio. Builds on PR #224's publication-export module.

**Tech Stack:** Lit 3, TypeScript, D3 (zoom/quadtree), WebGL2 (scatter capture), vitest, Canvas 2D API (composition)

**Spec:** `docs/superpowers/specs/2026-04-20-publication-export-studio-design.md`

---

## File Structure

### New files

| File                                                                   | Responsibility                                            |
| ---------------------------------------------------------------------- | --------------------------------------------------------- |
| `packages/core/src/components/scatter-plot/annotation-types.ts`        | Shared types: `Indicator`, `Inset`, `AnnotationState`     |
| `packages/core/src/components/scatter-plot/context-menu.ts`            | `<protspace-context-menu>` Lit element                    |
| `packages/core/src/components/scatter-plot/context-menu.styles.ts`     | Styles for context menu                                   |
| `packages/core/src/components/scatter-plot/context-menu.test.ts`       | Tests for context menu                                    |
| `packages/core/src/components/scatter-plot/indicator-layer.ts`         | `<protspace-indicator-layer>` Lit element                 |
| `packages/core/src/components/scatter-plot/indicator-layer.styles.ts`  | Styles for indicator arrows                               |
| `packages/core/src/components/scatter-plot/indicator-layer.test.ts`    | Tests for indicator layer                                 |
| `packages/core/src/components/scatter-plot/inset-tool.ts`              | `<protspace-inset-tool>` Lit element                      |
| `packages/core/src/components/scatter-plot/inset-tool.styles.ts`       | Styles for inset tool                                     |
| `packages/core/src/components/scatter-plot/inset-tool.test.ts`         | Tests for inset tool                                      |
| `packages/core/src/components/export-studio/export-studio.ts`          | `<protspace-export-studio>` modal Lit element             |
| `packages/core/src/components/export-studio/export-studio.styles.ts`   | Styles for export studio                                  |
| `packages/core/src/components/export-studio/export-studio-controls.ts` | Right panel controls                                      |
| `packages/core/src/components/export-studio/export-studio-preview.ts`  | Left panel live preview                                   |
| `packages/core/src/components/export-studio/export-studio.test.ts`     | Tests for export studio                                   |
| `app/src/explore/annotation-controller.ts`                             | Factory function managing `Indicator[]` + `Inset[]` state |
| `app/src/explore/annotation-controller.test.ts`                        | Tests for annotation controller                           |

### Modified files

| File                                                               | Change                                                                                        |
| ------------------------------------------------------------------ | --------------------------------------------------------------------------------------------- |
| `packages/core/src/components/scatter-plot/scatter-plot.ts`        | Add `contextmenu` forwarding, expose `hitTest()`, render 3 new child components in `render()` |
| `packages/core/src/components/scatter-plot/scatter-plot.styles.ts` | Add z-index layers for indicator-layer, inset-tool, context-menu                              |
| `packages/core/src/index.ts`                                       | Export new components and types                                                               |
| `app/src/explore/runtime.ts`                                       | Create annotation controller, wire events                                                     |
| `app/src/explore/export-handler.ts`                                | Route to Export Studio instead of direct download                                             |
| `app/src/explore/elements.ts`                                      | Add export-studio to element references                                                       |

---

## Task 1: Annotation Types

**Files:**

- Create: `packages/core/src/components/scatter-plot/annotation-types.ts`

- [ ] **Step 1: Create the shared types file**

```typescript
// packages/core/src/components/scatter-plot/annotation-types.ts

export interface Indicator {
  id: string;
  proteinId: string;
  label: string;
  dataCoords: [number, number];
  offsetPx: [number, number];
}

export interface Inset {
  id: string;
  sourceTransform: { x: number; y: number; scale: number };
  capturedCanvas: HTMLCanvasElement | null;
  position: { x: number; y: number };
  size: { width: number; height: number };
  shape: 'rectangle' | 'circle';
  label: string;
  zoomFactor: number;
}

export type InsetStep = 'idle' | 'framing' | 'snapped' | 'positioning';

export interface AnnotationSnapshot {
  indicators: Indicator[];
  insets: Omit<Inset, 'capturedCanvas'>[];
}

export interface ContextMenuAction {
  type: 'indicate' | 'select' | 'copy-id' | 'view-uniprot' | 'add-inset';
  proteinId?: string;
  dataCoords?: [number, number];
}
```

- [ ] **Step 2: Export from package index**

Add to `packages/core/src/index.ts` at the end of the file:

```typescript
// Annotation types
export type {
  Indicator,
  Inset,
  InsetStep,
  AnnotationSnapshot,
  ContextMenuAction,
} from './components/scatter-plot/annotation-types';
```

- [ ] **Step 3: Commit**

```bash
git add packages/core/src/components/scatter-plot/annotation-types.ts packages/core/src/index.ts
git commit -m "feat(scatter-plot): add annotation type definitions for indicators, insets, and context menu"
```

---

## Task 2: Annotation Controller

**Files:**

- Create: `app/src/explore/annotation-controller.test.ts`
- Create: `app/src/explore/annotation-controller.ts`

- [ ] **Step 1: Write the failing tests**

```typescript
// app/src/explore/annotation-controller.test.ts
import { describe, it, expect, vi } from 'vitest';
import { createAnnotationController } from './annotation-controller';

function makeController() {
  return createAnnotationController();
}

describe('annotation-controller', () => {
  describe('indicators', () => {
    it('starts with no indicators', () => {
      const ctrl = makeController();
      expect(ctrl.getIndicators()).toEqual([]);
    });

    it('adds an indicator and assigns an id', () => {
      const ctrl = makeController();
      ctrl.addIndicator({ proteinId: 'P0DM09', label: 'P0DM09', dataCoords: [10, 20] });
      const indicators = ctrl.getIndicators();
      expect(indicators).toHaveLength(1);
      expect(indicators[0].proteinId).toBe('P0DM09');
      expect(indicators[0].label).toBe('P0DM09');
      expect(indicators[0].dataCoords).toEqual([10, 20]);
      expect(indicators[0].offsetPx).toEqual([0, 0]);
      expect(indicators[0].id).toBeTruthy();
    });

    it('removes an indicator by id', () => {
      const ctrl = makeController();
      ctrl.addIndicator({ proteinId: 'P1', label: 'P1', dataCoords: [0, 0] });
      const id = ctrl.getIndicators()[0].id;
      ctrl.removeIndicator(id);
      expect(ctrl.getIndicators()).toEqual([]);
    });

    it('updates indicator label', () => {
      const ctrl = makeController();
      ctrl.addIndicator({ proteinId: 'P1', label: 'P1', dataCoords: [0, 0] });
      const id = ctrl.getIndicators()[0].id;
      ctrl.updateIndicator(id, { label: 'Custom Label' });
      expect(ctrl.getIndicators()[0].label).toBe('Custom Label');
    });

    it('updates indicator offset', () => {
      const ctrl = makeController();
      ctrl.addIndicator({ proteinId: 'P1', label: 'P1', dataCoords: [0, 0] });
      const id = ctrl.getIndicators()[0].id;
      ctrl.updateIndicator(id, { offsetPx: [15, -10] as [number, number] });
      expect(ctrl.getIndicators()[0].offsetPx).toEqual([15, -10]);
    });
  });

  describe('insets', () => {
    it('starts with no insets', () => {
      const ctrl = makeController();
      expect(ctrl.getInsets()).toEqual([]);
    });

    it('adds an inset in framing state', () => {
      const ctrl = makeController();
      ctrl.startInsetFraming();
      expect(ctrl.getInsetStep()).toBe('framing');
    });

    it('snaps an inset with transform data', () => {
      const ctrl = makeController();
      ctrl.startInsetFraming();
      ctrl.snapInset({
        sourceTransform: { x: 100, y: 50, scale: 2.4 },
        capturedCanvas: null,
        zoomFactor: 2.4,
      });
      expect(ctrl.getInsetStep()).toBe('snapped');
    });

    it('confirms inset with position and adds to list', () => {
      const ctrl = makeController();
      ctrl.startInsetFraming();
      ctrl.snapInset({
        sourceTransform: { x: 100, y: 50, scale: 2.4 },
        capturedCanvas: null,
        zoomFactor: 2.4,
      });
      ctrl.confirmInset({
        position: { x: 0.8, y: 0.1 },
        size: { width: 0.25, height: 0.2 },
        shape: 'rectangle',
        label: 'Kunitz cluster',
      });
      expect(ctrl.getInsetStep()).toBe('idle');
      expect(ctrl.getInsets()).toHaveLength(1);
      expect(ctrl.getInsets()[0].label).toBe('Kunitz cluster');
      expect(ctrl.getInsets()[0].shape).toBe('rectangle');
    });

    it('cancels inset framing and resets step', () => {
      const ctrl = makeController();
      ctrl.startInsetFraming();
      ctrl.cancelInset();
      expect(ctrl.getInsetStep()).toBe('idle');
      expect(ctrl.getInsets()).toEqual([]);
    });

    it('removes an inset by id', () => {
      const ctrl = makeController();
      ctrl.startInsetFraming();
      ctrl.snapInset({
        sourceTransform: { x: 0, y: 0, scale: 1 },
        capturedCanvas: null,
        zoomFactor: 1,
      });
      ctrl.confirmInset({
        position: { x: 0, y: 0 },
        size: { width: 0.2, height: 0.2 },
        shape: 'rectangle',
        label: '',
      });
      const id = ctrl.getInsets()[0].id;
      ctrl.removeInset(id);
      expect(ctrl.getInsets()).toEqual([]);
    });
  });

  describe('snapshot', () => {
    it('produces a serializable snapshot without canvas references', () => {
      const ctrl = makeController();
      ctrl.addIndicator({ proteinId: 'P1', label: 'P1', dataCoords: [5, 10] });
      ctrl.startInsetFraming();
      ctrl.snapInset({
        sourceTransform: { x: 0, y: 0, scale: 2 },
        capturedCanvas: null,
        zoomFactor: 2,
      });
      ctrl.confirmInset({
        position: { x: 0.5, y: 0.5 },
        size: { width: 0.3, height: 0.3 },
        shape: 'circle',
        label: 'Test',
      });

      const snap = ctrl.getSnapshot();
      expect(snap.indicators).toHaveLength(1);
      expect(snap.insets).toHaveLength(1);
      expect(snap.insets[0]).not.toHaveProperty('capturedCanvas');
    });
  });

  describe('change callback', () => {
    it('fires onChange when indicators change', () => {
      const onChange = vi.fn();
      const ctrl = createAnnotationController({ onChange });
      ctrl.addIndicator({ proteinId: 'P1', label: 'P1', dataCoords: [0, 0] });
      expect(onChange).toHaveBeenCalledTimes(1);
    });

    it('fires onChange when inset is confirmed', () => {
      const onChange = vi.fn();
      const ctrl = createAnnotationController({ onChange });
      ctrl.startInsetFraming();
      ctrl.snapInset({
        sourceTransform: { x: 0, y: 0, scale: 1 },
        capturedCanvas: null,
        zoomFactor: 1,
      });
      ctrl.confirmInset({
        position: { x: 0, y: 0 },
        size: { width: 0.2, height: 0.2 },
        shape: 'rectangle',
        label: '',
      });
      // onChange called for snap and confirm
      expect(onChange).toHaveBeenCalled();
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd /Users/jcoludar/CascadeProjects/SpeciesEmbedding/externals/protspace_web && pnpm vitest run app/src/explore/annotation-controller.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Write the implementation**

```typescript
// app/src/explore/annotation-controller.ts
import type { Indicator, Inset, InsetStep, AnnotationSnapshot } from '@protspace/core';

interface AddIndicatorInput {
  proteinId: string;
  label: string;
  dataCoords: [number, number];
}

interface SnapInsetInput {
  sourceTransform: { x: number; y: number; scale: number };
  capturedCanvas: HTMLCanvasElement | null;
  zoomFactor: number;
}

interface ConfirmInsetInput {
  position: { x: number; y: number };
  size: { width: number; height: number };
  shape: 'rectangle' | 'circle';
  label: string;
}

interface AnnotationControllerOptions {
  onChange?: () => void;
}

export interface AnnotationController {
  getIndicators(): Indicator[];
  addIndicator(input: AddIndicatorInput): void;
  removeIndicator(id: string): void;
  updateIndicator(id: string, patch: Partial<Pick<Indicator, 'label' | 'offsetPx'>>): void;

  getInsets(): Inset[];
  getInsetStep(): InsetStep;
  startInsetFraming(): void;
  snapInset(input: SnapInsetInput): void;
  confirmInset(input: ConfirmInsetInput): void;
  cancelInset(): void;
  removeInset(id: string): void;

  getSnapshot(): AnnotationSnapshot;
}

let nextId = 1;
function genId(prefix: string): string {
  return `${prefix}-${nextId++}`;
}

export function createAnnotationController(
  options?: AnnotationControllerOptions,
): AnnotationController {
  const onChange = options?.onChange;
  let indicators: Indicator[] = [];
  let insets: Inset[] = [];
  let insetStep: InsetStep = 'idle';
  let pendingInset: Partial<Inset> | null = null;

  function notify() {
    onChange?.();
  }

  return {
    getIndicators() {
      return [...indicators];
    },

    addIndicator(input) {
      indicators = [
        ...indicators,
        {
          id: genId('ind'),
          proteinId: input.proteinId,
          label: input.label,
          dataCoords: input.dataCoords,
          offsetPx: [0, 0],
        },
      ];
      notify();
    },

    removeIndicator(id) {
      indicators = indicators.filter((i) => i.id !== id);
      notify();
    },

    updateIndicator(id, patch) {
      indicators = indicators.map((i) => (i.id === id ? { ...i, ...patch } : i));
      notify();
    },

    getInsets() {
      return [...insets];
    },

    getInsetStep() {
      return insetStep;
    },

    startInsetFraming() {
      insetStep = 'framing';
      pendingInset = {};
    },

    snapInset(input) {
      if (insetStep !== 'framing') return;
      pendingInset = {
        ...pendingInset,
        sourceTransform: input.sourceTransform,
        capturedCanvas: input.capturedCanvas,
        zoomFactor: input.zoomFactor,
      };
      insetStep = 'snapped';
    },

    confirmInset(input) {
      if (insetStep !== 'snapped' || !pendingInset) return;
      insets = [
        ...insets,
        {
          id: genId('inset'),
          sourceTransform: pendingInset.sourceTransform!,
          capturedCanvas: pendingInset.capturedCanvas ?? null,
          position: input.position,
          size: input.size,
          shape: input.shape,
          label: input.label,
          zoomFactor: pendingInset.zoomFactor ?? 1,
        },
      ];
      pendingInset = null;
      insetStep = 'idle';
      notify();
    },

    cancelInset() {
      pendingInset = null;
      insetStep = 'idle';
    },

    removeInset(id) {
      insets = insets.filter((i) => i.id !== id);
      notify();
    },

    getSnapshot(): AnnotationSnapshot {
      return {
        indicators: [...indicators],
        insets: insets.map(({ capturedCanvas: _, ...rest }) => rest),
      };
    },
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd /Users/jcoludar/CascadeProjects/SpeciesEmbedding/externals/protspace_web && pnpm vitest run app/src/explore/annotation-controller.test.ts`
Expected: All 10 tests PASS

- [ ] **Step 5: Commit**

```bash
git add app/src/explore/annotation-controller.ts app/src/explore/annotation-controller.test.ts
git commit -m "feat(explore): add annotation controller for indicators and insets"
```

---

## Task 3: Context Menu Component

**Files:**

- Create: `packages/core/src/components/scatter-plot/context-menu.test.ts`
- Create: `packages/core/src/components/scatter-plot/context-menu.styles.ts`
- Create: `packages/core/src/components/scatter-plot/context-menu.ts`

- [ ] **Step 1: Write the failing tests**

```typescript
// packages/core/src/components/scatter-plot/context-menu.test.ts
import { describe, it, expect, vi } from 'vitest';
import type { ContextMenuAction } from './annotation-types';

// Unit-test the action resolution logic, not DOM rendering (Lit components
// need a browser-like environment for full render tests).

import { resolveMenuItems } from './context-menu';

describe('context-menu', () => {
  describe('resolveMenuItems', () => {
    it('returns point actions when a point is hit', () => {
      const items = resolveMenuItems({
        proteinId: 'P0DM09',
        hasAccession: true,
        dataCoords: [10, 20],
      });
      const types = items.map((i) => i.action.type);
      expect(types).toContain('indicate');
      expect(types).toContain('select');
      expect(types).toContain('copy-id');
      expect(types).toContain('view-uniprot');
    });

    it('disables view-uniprot when no accession', () => {
      const items = resolveMenuItems({
        proteinId: 'custom_001',
        hasAccession: false,
        dataCoords: [10, 20],
      });
      const uniprotItem = items.find((i) => i.action.type === 'view-uniprot');
      expect(uniprotItem?.disabled).toBe(true);
    });

    it('returns empty-space actions when no point is hit', () => {
      const items = resolveMenuItems(null);
      const types = items.map((i) => i.action.type);
      expect(types).toContain('add-inset');
      expect(types).not.toContain('indicate');
      expect(types).not.toContain('select');
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd /Users/jcoludar/CascadeProjects/SpeciesEmbedding/externals/protspace_web && pnpm vitest run packages/core/src/components/scatter-plot/context-menu.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Write the styles**

```typescript
// packages/core/src/components/scatter-plot/context-menu.styles.ts
import { css } from 'lit';

export const contextMenuStyles = css`
  :host {
    position: absolute;
    z-index: 200;
    pointer-events: auto;
  }

  .menu {
    background: var(--surface-overlay, #1e1e2e);
    border: 1px solid var(--border-color, #444);
    border-radius: 8px;
    padding: 4px 0;
    min-width: 180px;
    box-shadow: 0 8px 30px rgba(0, 0, 0, 0.5);
    font-size: 12px;
    font-family: inherit;
  }

  .menu-item {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 7px 14px;
    color: var(--text-primary, #ddd);
    cursor: pointer;
    border: none;
    background: none;
    width: 100%;
    text-align: left;
    font: inherit;
  }

  .menu-item:hover {
    background: var(--surface-hover, #2a3a5a);
  }

  .menu-item[aria-disabled='true'] {
    color: var(--text-disabled, #555);
    cursor: default;
    pointer-events: none;
  }

  .menu-item .icon {
    width: 16px;
    text-align: center;
    font-size: 13px;
    flex-shrink: 0;
  }

  .menu-item .shortcut {
    margin-left: auto;
    font-size: 10px;
    color: var(--text-secondary, #667);
  }

  .separator {
    height: 1px;
    background: var(--border-color, #333);
    margin: 4px 0;
  }
`;
```

- [ ] **Step 4: Write the implementation**

```typescript
// packages/core/src/components/scatter-plot/context-menu.ts
import { LitElement, html, nothing } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import type { ContextMenuAction } from './annotation-types';
import { contextMenuStyles } from './context-menu.styles';

export interface MenuItem {
  label: string;
  icon: string;
  action: ContextMenuAction;
  shortcut?: string;
  disabled?: boolean;
  separator?: boolean;
}

interface PointHit {
  proteinId: string;
  hasAccession: boolean;
  dataCoords: [number, number];
}

export function resolveMenuItems(hit: PointHit | null): MenuItem[] {
  if (hit) {
    return [
      {
        label: 'Indicate',
        icon: '↗',
        action: { type: 'indicate', proteinId: hit.proteinId, dataCoords: hit.dataCoords },
      },
      {
        label: 'Select',
        icon: '◻',
        action: { type: 'select', proteinId: hit.proteinId },
      },
      { label: '', icon: '', action: { type: 'indicate' }, separator: true },
      {
        label: 'Copy ID',
        icon: '📋',
        action: { type: 'copy-id', proteinId: hit.proteinId },
        shortcut: '⌘C',
      },
      {
        label: 'View in UniProt',
        icon: '🔗',
        action: { type: 'view-uniprot', proteinId: hit.proteinId },
        disabled: !hit.hasAccession,
      },
    ];
  }

  return [
    {
      label: 'Add inset here',
      icon: '🔍',
      action: { type: 'add-inset' },
      shortcut: 'I',
    },
  ];
}

@customElement('protspace-context-menu')
export class ProtspaceContextMenu extends LitElement {
  static styles = contextMenuStyles;

  @property({ type: Number }) x = 0;
  @property({ type: Number }) y = 0;
  @property({ type: Boolean }) open = false;
  @property({ type: Array }) items: MenuItem[] = [];

  private _onClickOutside = (e: MouseEvent) => {
    if (!this.contains(e.target as Node)) {
      this._close();
    }
  };

  private _onEscape = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      this._close();
    }
  };

  connectedCallback() {
    super.connectedCallback();
    document.addEventListener('mousedown', this._onClickOutside);
    document.addEventListener('keydown', this._onEscape);
  }

  disconnectedCallback() {
    document.removeEventListener('mousedown', this._onClickOutside);
    document.removeEventListener('keydown', this._onEscape);
    super.disconnectedCallback();
  }

  private _close() {
    this.open = false;
    this.dispatchEvent(new CustomEvent('context-menu-close'));
  }

  private _handleItemClick(item: MenuItem) {
    if (item.disabled) return;
    this.dispatchEvent(
      new CustomEvent<ContextMenuAction>('context-menu-action', {
        detail: item.action,
        bubbles: true,
        composed: true,
      }),
    );
    this._close();
  }

  render() {
    if (!this.open) return nothing;

    return html`
      <div class="menu" style="left:${this.x}px;top:${this.y}px;" role="menu">
        ${this.items.map((item) =>
          item.separator
            ? html`<div class="separator"></div>`
            : html`
                <button
                  class="menu-item"
                  role="menuitem"
                  aria-disabled="${item.disabled ? 'true' : 'false'}"
                  @click="${() => this._handleItemClick(item)}"
                >
                  <span class="icon">${item.icon}</span>
                  <span>${item.label}</span>
                  ${item.shortcut ? html`<span class="shortcut">${item.shortcut}</span>` : nothing}
                </button>
              `,
        )}
      </div>
    `;
  }
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd /Users/jcoludar/CascadeProjects/SpeciesEmbedding/externals/protspace_web && pnpm vitest run packages/core/src/components/scatter-plot/context-menu.test.ts`
Expected: All 3 tests PASS

- [ ] **Step 6: Commit**

```bash
git add packages/core/src/components/scatter-plot/context-menu.ts packages/core/src/components/scatter-plot/context-menu.styles.ts packages/core/src/components/scatter-plot/context-menu.test.ts
git commit -m "feat(scatter-plot): add right-click context menu component"
```

---

## Task 4: Indicator Layer Component

**Files:**

- Create: `packages/core/src/components/scatter-plot/indicator-layer.test.ts`
- Create: `packages/core/src/components/scatter-plot/indicator-layer.styles.ts`
- Create: `packages/core/src/components/scatter-plot/indicator-layer.ts`

- [ ] **Step 1: Write the failing tests**

```typescript
// packages/core/src/components/scatter-plot/indicator-layer.test.ts
import { describe, it, expect } from 'vitest';
import { computeArrowScreenPosition } from './indicator-layer';
import type { Indicator } from './annotation-types';

describe('indicator-layer', () => {
  describe('computeArrowScreenPosition', () => {
    const transform = { x: 0, y: 0, k: 1 }; // d3.ZoomTransform-like
    const scaleX = (v: number) => v * 10; // data-to-pixel scale
    const scaleY = (v: number) => v * 10;

    it('computes screen position from data coords and transform', () => {
      const indicator: Indicator = {
        id: 'ind-1',
        proteinId: 'P1',
        label: 'P1',
        dataCoords: [5, 8],
        offsetPx: [0, 0],
      };
      const pos = computeArrowScreenPosition(indicator, scaleX, scaleY, transform);
      // data 5 -> scale 50 -> transform (identity) -> 50
      expect(pos.tipX).toBe(50);
      expect(pos.tipY).toBe(80);
    });

    it('applies pixel offset to shaft but not tip', () => {
      const indicator: Indicator = {
        id: 'ind-1',
        proteinId: 'P1',
        label: 'P1',
        dataCoords: [5, 8],
        offsetPx: [20, -15],
      };
      const pos = computeArrowScreenPosition(indicator, scaleX, scaleY, transform);
      expect(pos.tipX).toBe(50);
      expect(pos.tipY).toBe(80);
      expect(pos.shaftX).toBe(70); // 50 + 20
      expect(pos.shaftY).toBe(65); // 80 + (-15)
    });

    it('applies zoom transform', () => {
      const indicator: Indicator = {
        id: 'ind-1',
        proteinId: 'P1',
        label: 'P1',
        dataCoords: [5, 8],
        offsetPx: [0, 0],
      };
      const zoomed = { x: 100, y: 50, k: 2 };
      const pos = computeArrowScreenPosition(indicator, scaleX, scaleY, zoomed);
      // data 5 -> scale 50 -> zoom: 50*2 + 100 = 200
      expect(pos.tipX).toBe(200);
      // data 8 -> scale 80 -> zoom: 80*2 + 50 = 210
      expect(pos.tipY).toBe(210);
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd /Users/jcoludar/CascadeProjects/SpeciesEmbedding/externals/protspace_web && pnpm vitest run packages/core/src/components/scatter-plot/indicator-layer.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Write the styles**

```typescript
// packages/core/src/components/scatter-plot/indicator-layer.styles.ts
import { css } from 'lit';

export const indicatorLayerStyles = css`
  :host {
    position: absolute;
    inset: 0;
    pointer-events: none;
    z-index: 4;
    overflow: hidden;
  }

  .indicator {
    position: absolute;
    pointer-events: auto;
    cursor: grab;
  }

  .indicator:active {
    cursor: grabbing;
  }

  .arrow-shaft {
    width: 2px;
    height: 32px;
    background: #111;
    position: absolute;
    bottom: 0;
    left: 50%;
    transform: translateX(-50%);
  }

  .arrow-head {
    width: 0;
    height: 0;
    border-left: 6px solid transparent;
    border-right: 6px solid transparent;
    border-top: 9px solid #111;
    position: absolute;
    bottom: -9px;
    left: 50%;
    transform: translateX(-50%);
  }

  .arrow-label {
    position: absolute;
    bottom: 34px;
    left: 50%;
    transform: translateX(-50%);
    font-size: 10px;
    font-weight: 600;
    color: #111;
    background: rgba(255, 255, 255, 0.9);
    padding: 1px 6px;
    border-radius: 3px;
    white-space: nowrap;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.15);
    cursor: text;
  }

  .arrow-label[contenteditable='true']:focus {
    outline: 2px solid var(--accent-color, #5b8fd9);
    outline-offset: 1px;
  }
`;
```

- [ ] **Step 4: Write the implementation**

```typescript
// packages/core/src/components/scatter-plot/indicator-layer.ts
import { LitElement, html, nothing } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import type { Indicator } from './annotation-types';
import { indicatorLayerStyles } from './indicator-layer.styles';

interface ZoomTransformLike {
  x: number;
  y: number;
  k: number;
}

export interface ArrowScreenPosition {
  tipX: number;
  tipY: number;
  shaftX: number;
  shaftY: number;
}

export function computeArrowScreenPosition(
  indicator: Indicator,
  scaleX: (v: number) => number,
  scaleY: (v: number) => number,
  transform: ZoomTransformLike,
): ArrowScreenPosition {
  const rawX = scaleX(indicator.dataCoords[0]);
  const rawY = scaleY(indicator.dataCoords[1]);
  const tipX = rawX * transform.k + transform.x;
  const tipY = rawY * transform.k + transform.y;
  return {
    tipX,
    tipY,
    shaftX: tipX + indicator.offsetPx[0],
    shaftY: tipY + indicator.offsetPx[1],
  };
}

@customElement('protspace-indicator-layer')
export class ProtspaceIndicatorLayer extends LitElement {
  static styles = indicatorLayerStyles;

  @property({ type: Array }) indicators: Indicator[] = [];
  @property({ type: Object }) transform: ZoomTransformLike = { x: 0, y: 0, k: 1 };
  @property({ attribute: false }) scaleX: ((v: number) => number) | null = null;
  @property({ attribute: false }) scaleY: ((v: number) => number) | null = null;

  private _dragState: {
    id: string;
    startX: number;
    startY: number;
    startOffset: [number, number];
  } | null = null;

  private _onPointerDown(e: PointerEvent, indicator: Indicator) {
    e.preventDefault();
    this._dragState = {
      id: indicator.id,
      startX: e.clientX,
      startY: e.clientY,
      startOffset: [...indicator.offsetPx],
    };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }

  private _onPointerMove(e: PointerEvent) {
    if (!this._dragState) return;
    const dx = e.clientX - this._dragState.startX;
    const dy = e.clientY - this._dragState.startY;
    this.dispatchEvent(
      new CustomEvent('indicator-update', {
        detail: {
          id: this._dragState.id,
          offsetPx: [this._dragState.startOffset[0] + dx, this._dragState.startOffset[1] + dy],
        },
        bubbles: true,
        composed: true,
      }),
    );
  }

  private _onPointerUp() {
    this._dragState = null;
  }

  private _onLabelEdit(e: FocusEvent, id: string) {
    const text = (e.target as HTMLElement).textContent?.trim() ?? '';
    this.dispatchEvent(
      new CustomEvent('indicator-update', {
        detail: { id, label: text },
        bubbles: true,
        composed: true,
      }),
    );
  }

  private _onKeyDown(e: KeyboardEvent, id: string) {
    if (e.key === 'Delete' || e.key === 'Backspace') {
      // Only delete indicator if not editing the label
      if ((e.target as HTMLElement).contentEditable !== 'true') {
        this.dispatchEvent(
          new CustomEvent('indicator-remove', {
            detail: { id },
            bubbles: true,
            composed: true,
          }),
        );
      }
    }
  }

  render() {
    if (!this.scaleX || !this.scaleY) return nothing;

    return html`
      ${this.indicators.map((ind) => {
        const pos = computeArrowScreenPosition(ind, this.scaleX!, this.scaleY!, this.transform);
        return html`
          <div
            class="indicator"
            style="left:${pos.shaftX}px;top:${pos.shaftY - 32}px;"
            tabindex="0"
            @pointerdown="${(e: PointerEvent) => this._onPointerDown(e, ind)}"
            @pointermove="${this._onPointerMove}"
            @pointerup="${this._onPointerUp}"
            @keydown="${(e: KeyboardEvent) => this._onKeyDown(e, ind.id)}"
          >
            <div
              class="arrow-label"
              contenteditable="true"
              @blur="${(e: FocusEvent) => this._onLabelEdit(e, ind.id)}"
            >
              ${ind.label}
            </div>
            <div class="arrow-shaft"></div>
            <div class="arrow-head"></div>
          </div>
        `;
      })}
    `;
  }
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd /Users/jcoludar/CascadeProjects/SpeciesEmbedding/externals/protspace_web && pnpm vitest run packages/core/src/components/scatter-plot/indicator-layer.test.ts`
Expected: All 3 tests PASS

- [ ] **Step 6: Commit**

```bash
git add packages/core/src/components/scatter-plot/indicator-layer.ts packages/core/src/components/scatter-plot/indicator-layer.styles.ts packages/core/src/components/scatter-plot/indicator-layer.test.ts
git commit -m "feat(scatter-plot): add indicator layer for zoom-invariant arrows"
```

---

## Task 5: Wire Context Menu + Indicators into Scatter Plot

**Files:**

- Modify: `packages/core/src/components/scatter-plot/scatter-plot.ts` (lines 2040-2122 render method, lines 1861-1902 mouse handling)
- Modify: `packages/core/src/components/scatter-plot/scatter-plot.styles.ts`

- [ ] **Step 1: Add imports to scatter-plot.ts**

Add at the top of `scatter-plot.ts` (after line 29):

```typescript
import './context-menu';
import './indicator-layer';
import type { Indicator, ContextMenuAction } from './annotation-types';
import { resolveMenuItems, type MenuItem } from './context-menu';
```

- [ ] **Step 2: Add properties to the ProtspaceScatterplot class**

Add after the existing `@property` declarations (after line 76):

```typescript
  @property({ type: Array }) indicators: Indicator[] = [];
  @state() private _contextMenuOpen = false;
  @state() private _contextMenuX = 0;
  @state() private _contextMenuY = 0;
  @state() private _contextMenuItems: MenuItem[] = [];
```

- [ ] **Step 3: Add public hitTest method**

Add as a public method on the class (near the existing `captureAtResolution` method around line 2343):

```typescript
  /**
   * Public hit-test: resolve which point (if any) is at the given screen coordinates.
   */
  public hitTest(screenX: number, screenY: number): { proteinId: string; dataCoords: [number, number] } | null {
    if (!this._quadtreeIndex) return null;
    const svgEl = this._svgElement;
    if (!svgEl) return null;
    const rect = svgEl.getBoundingClientRect();
    const localX = screenX - rect.left;
    const localY = screenY - rect.top;
    const transform = this._currentTransform;
    const dataX = (localX - transform.x) / transform.k;
    const dataY = (localY - transform.y) / transform.k;
    const searchRadius = (this._mergedConfig.pointSize + 4) / transform.k;
    const nearest = this._quadtreeIndex.findNearest(dataX, dataY, searchRadius);
    if (!nearest) return null;
    return { proteinId: nearest.id, dataCoords: [nearest.x, nearest.y] };
  }
```

- [ ] **Step 4: Add contextmenu event handler**

Add as a private method on the class:

```typescript
  private _handleContextMenu(e: MouseEvent) {
    e.preventDefault();
    const hit = this.hitTest(e.clientX, e.clientY);
    const hasAccession = hit
      ? /^[A-Z][0-9][A-Z0-9]{3}[0-9]|^[A-Z]{2}_\d+/.test(hit.proteinId)
      : false;
    this._contextMenuItems = resolveMenuItems(
      hit ? { proteinId: hit.proteinId, hasAccession, dataCoords: hit.dataCoords } : null,
    );
    const rect = this.getBoundingClientRect();
    this._contextMenuX = e.clientX - rect.left;
    this._contextMenuY = e.clientY - rect.top;
    this._contextMenuOpen = true;
  }

  private _handleContextMenuAction(e: CustomEvent<ContextMenuAction>) {
    const action = e.detail;
    this.dispatchEvent(
      new CustomEvent('context-menu-action', {
        detail: action,
        bubbles: true,
        composed: true,
      }),
    );
  }

  private _handleContextMenuClose() {
    this._contextMenuOpen = false;
  }
```

- [ ] **Step 5: Update render() to include new child components**

In the `render()` method (around line 2040), add `@contextmenu` handler to the container div and add the two new components before the closing `</div>`. The existing render returns a container div — add the contextmenu listener to it, and insert the new components after the existing children (after the numeric-recomputation indicator, around line 2119):

```typescript
        <protspace-indicator-layer
          .indicators="${this.indicators}"
          .transform="${this._currentTransform}"
          .scaleX="${this._scales?.x ?? null}"
          .scaleY="${this._scales?.y ?? null}"
        ></protspace-indicator-layer>
        <protspace-context-menu
          .x="${this._contextMenuX}"
          .y="${this._contextMenuY}"
          .open="${this._contextMenuOpen}"
          .items="${this._contextMenuItems}"
          @context-menu-action="${this._handleContextMenuAction}"
          @context-menu-close="${this._handleContextMenuClose}"
        ></protspace-context-menu>
```

Also add `@contextmenu="${this._handleContextMenu}"` to the host container div in the render template.

- [ ] **Step 6: Add z-index styles for new layers**

Add to `scatter-plot.styles.ts` (after the existing styles, before the closing backtick):

```typescript
  protspace-indicator-layer {
    position: absolute;
    inset: 0;
    z-index: 4;
    pointer-events: none;
  }

  protspace-context-menu {
    position: absolute;
    z-index: 200;
  }
```

- [ ] **Step 7: Build and verify no type errors**

Run: `cd /Users/jcoludar/CascadeProjects/SpeciesEmbedding/externals/protspace_web && pnpm type-check`
Expected: No errors

- [ ] **Step 8: Commit**

```bash
git add packages/core/src/components/scatter-plot/scatter-plot.ts packages/core/src/components/scatter-plot/scatter-plot.styles.ts
git commit -m "feat(scatter-plot): wire context menu and indicator layer into render"
```

---

## Task 6: Wire Annotation Controller into Runtime

**Files:**

- Modify: `app/src/explore/runtime.ts`
- Modify: `app/src/explore/elements.ts`

- [ ] **Step 1: Import and create annotation controller in runtime.ts**

Add import at top of `runtime.ts`:

```typescript
import { createAnnotationController } from './annotation-controller';
```

Add after the `interactionController` creation (after line 84):

```typescript
const annotationController = createAnnotationController({
  onChange() {
    plotElement.indicators = annotationController.getIndicators();
  },
});
```

- [ ] **Step 2: Wire context-menu-action events**

Add after the existing event listeners (after line 166, before the `bindControlBarEvents` call):

```typescript
addTrackedEventListener(lifecycle, plotElement, 'context-menu-action', (event: Event) => {
  const action = (event as CustomEvent).detail;
  switch (action.type) {
    case 'indicate':
      if (action.proteinId && action.dataCoords) {
        annotationController.addIndicator({
          proteinId: action.proteinId,
          label: action.proteinId,
          dataCoords: action.dataCoords,
        });
      }
      break;
    case 'select':
      if (action.proteinId) {
        const current = plotElement.selectedProteinIds ?? [];
        plotElement.selectedProteinIds = [...current, action.proteinId];
      }
      break;
    case 'copy-id':
      if (action.proteinId) {
        void navigator.clipboard.writeText(action.proteinId);
      }
      break;
    case 'view-uniprot':
      if (action.proteinId) {
        window.open(`https://www.uniprot.org/uniprot/${action.proteinId}`, '_blank');
      }
      break;
    case 'add-inset':
      annotationController.startInsetFraming();
      break;
  }
});

addTrackedEventListener(lifecycle, plotElement, 'indicator-update', (event: Event) => {
  const { id, ...patch } = (event as CustomEvent).detail;
  annotationController.updateIndicator(id, patch);
});

addTrackedEventListener(lifecycle, plotElement, 'indicator-remove', (event: Event) => {
  const { id } = (event as CustomEvent).detail;
  annotationController.removeIndicator(id);
});
```

- [ ] **Step 3: Build and verify**

Run: `cd /Users/jcoludar/CascadeProjects/SpeciesEmbedding/externals/protspace_web && pnpm type-check && pnpm vitest run`
Expected: Type check passes, all existing tests still pass

- [ ] **Step 4: Commit**

```bash
git add app/src/explore/runtime.ts
git commit -m "feat(explore): wire annotation controller and context menu events into runtime"
```

---

## Task 7: Inset Tool Component

**Files:**

- Create: `packages/core/src/components/scatter-plot/inset-tool.test.ts`
- Create: `packages/core/src/components/scatter-plot/inset-tool.styles.ts`
- Create: `packages/core/src/components/scatter-plot/inset-tool.ts`

- [ ] **Step 1: Write the failing tests**

```typescript
// packages/core/src/components/scatter-plot/inset-tool.test.ts
import { describe, it, expect } from 'vitest';
import { computeConnectorLines } from './inset-tool';

describe('inset-tool', () => {
  describe('computeConnectorLines', () => {
    it('returns two lines from source corners to inset corners', () => {
      const source = { x: 100, y: 100, width: 200, height: 150 };
      const inset = { x: 500, y: 50, width: 180, height: 135 };
      const lines = computeConnectorLines(source, inset);
      expect(lines).toHaveLength(2);
      // Top-left of source to top-left of inset
      expect(lines[0]).toEqual({ x1: 100, y1: 100, x2: 500, y2: 50 });
      // Bottom-right of source to bottom-right of inset
      expect(lines[1]).toEqual({ x1: 300, y1: 250, x2: 680, y2: 185 });
    });

    it('handles source to the right of inset', () => {
      const source = { x: 500, y: 100, width: 100, height: 100 };
      const inset = { x: 50, y: 50, width: 120, height: 90 };
      const lines = computeConnectorLines(source, inset);
      expect(lines).toHaveLength(2);
      // Top-right of source to top-right of inset
      expect(lines[0]).toEqual({ x1: 600, y1: 100, x2: 170, y2: 50 });
      // Bottom-left of source to bottom-left of inset
      expect(lines[1]).toEqual({ x1: 500, y1: 200, x2: 50, y2: 140 });
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd /Users/jcoludar/CascadeProjects/SpeciesEmbedding/externals/protspace_web && pnpm vitest run packages/core/src/components/scatter-plot/inset-tool.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Write the styles**

```typescript
// packages/core/src/components/scatter-plot/inset-tool.styles.ts
import { css } from 'lit';

export const insetToolStyles = css`
  :host {
    position: absolute;
    inset: 0;
    z-index: 5;
    pointer-events: none;
  }

  .source-region {
    position: absolute;
    border: 1.5px dashed #333;
    pointer-events: none;
  }

  .inset-box {
    position: absolute;
    border: 2.5px solid #333;
    background: #fff;
    box-shadow: 0 3px 12px rgba(0, 0, 0, 0.25);
    pointer-events: auto;
    cursor: move;
    overflow: hidden;
  }

  .inset-box.circle {
    border-radius: 50%;
  }

  .inset-box canvas {
    width: 100%;
    height: 100%;
    display: block;
  }

  .resize-handle {
    position: absolute;
    top: -6px;
    right: -6px;
    width: 12px;
    height: 12px;
    background: var(--accent-color, #5b8fd9);
    border-radius: 50%;
    cursor: nwse-resize;
    border: 2px solid #fff;
    pointer-events: auto;
  }

  .inset-label {
    position: absolute;
    bottom: -18px;
    left: 0;
    font-size: 9px;
    font-weight: 600;
    color: #333;
    white-space: nowrap;
  }

  .connector-svg {
    position: absolute;
    inset: 0;
    pointer-events: none;
  }

  .framing-overlay {
    position: absolute;
    inset: 0;
    pointer-events: auto;
    cursor: crosshair;
  }

  .framing-badge {
    position: absolute;
    top: 8px;
    right: 8px;
    background: var(--accent-color, #5b8fd9);
    color: #fff;
    padding: 4px 12px;
    border-radius: 4px;
    font-size: 11px;
    font-weight: 600;
    pointer-events: none;
  }

  .snap-badge {
    position: absolute;
    top: 50px;
    left: 50%;
    transform: translateX(-50%);
    background: #2ecc71;
    color: #fff;
    padding: 6px 16px;
    border-radius: 6px;
    font-size: 12px;
    font-weight: 600;
    pointer-events: none;
    box-shadow: 0 2px 8px rgba(46, 204, 113, 0.3);
  }

  .toolbar-hint {
    position: absolute;
    bottom: 16px;
    left: 50%;
    transform: translateX(-50%);
    background: rgba(30, 30, 46, 0.9);
    color: #aaa;
    padding: 8px 20px;
    border-radius: 8px;
    font-size: 12px;
    pointer-events: none;
    white-space: nowrap;
  }

  .toolbar-hint kbd {
    background: #334;
    padding: 2px 6px;
    border-radius: 3px;
    font-size: 10px;
    color: #ddd;
    border: 1px solid #444;
  }
`;
```

- [ ] **Step 4: Write the implementation**

```typescript
// packages/core/src/components/scatter-plot/inset-tool.ts
import { LitElement, html, svg, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import type { Inset, InsetStep } from './annotation-types';
import { insetToolStyles } from './inset-tool.styles';

interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface Line {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export function computeConnectorLines(source: Rect, inset: Rect): Line[] {
  const sourceLeft = source.x;
  const sourceRight = source.x + source.width;
  const sourceTop = source.y;
  const sourceBottom = source.y + source.height;
  const insetLeft = inset.x;
  const insetRight = inset.x + inset.width;
  const insetTop = inset.y;
  const insetBottom = inset.y + inset.height;

  if (sourceLeft <= insetLeft) {
    // Source is left of or overlapping inset: top-left to top-left, bottom-right to bottom-right
    return [
      { x1: sourceLeft, y1: sourceTop, x2: insetLeft, y2: insetTop },
      { x1: sourceRight, y1: sourceBottom, x2: insetRight, y2: insetBottom },
    ];
  }
  // Source is right of inset: top-right to top-right, bottom-left to bottom-left
  return [
    { x1: sourceRight, y1: sourceTop, x2: insetRight, y2: insetTop },
    { x1: sourceLeft, y1: sourceBottom, x2: insetLeft, y2: insetBottom },
  ];
}

@customElement('protspace-inset-tool')
export class ProtspaceInsetTool extends LitElement {
  static styles = insetToolStyles;

  @property({ type: String }) step: InsetStep = 'idle';
  @property({ type: Array }) insets: Inset[] = [];
  @property({ type: Object }) containerSize: { width: number; height: number } = {
    width: 0,
    height: 0,
  };

  @state() private _dragState: {
    id: string;
    startX: number;
    startY: number;
    startPos: { x: number; y: number };
  } | null = null;

  private _onInsetPointerDown(e: PointerEvent, inset: Inset) {
    e.preventDefault();
    this._dragState = {
      id: inset.id,
      startX: e.clientX,
      startY: e.clientY,
      startPos: { ...inset.position },
    };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }

  private _onInsetPointerMove(e: PointerEvent) {
    if (!this._dragState || !this.containerSize.width) return;
    const dx = (e.clientX - this._dragState.startX) / this.containerSize.width;
    const dy = (e.clientY - this._dragState.startY) / this.containerSize.height;
    this.dispatchEvent(
      new CustomEvent('inset-reposition', {
        detail: {
          id: this._dragState.id,
          position: {
            x: this._dragState.startPos.x + dx,
            y: this._dragState.startPos.y + dy,
          },
        },
        bubbles: true,
        composed: true,
      }),
    );
  }

  private _onInsetPointerUp() {
    this._dragState = null;
  }

  private _onKeyDown(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      this.dispatchEvent(new CustomEvent('inset-cancel', { bubbles: true, composed: true }));
    } else if (e.key === 'Enter') {
      this.dispatchEvent(new CustomEvent('inset-confirm', { bubbles: true, composed: true }));
    }
  }

  connectedCallback() {
    super.connectedCallback();
    document.addEventListener('keydown', this._onKeyDown.bind(this));
  }

  disconnectedCallback() {
    document.removeEventListener('keydown', this._onKeyDown.bind(this));
    super.disconnectedCallback();
  }

  private _renderConnectors(inset: Inset) {
    // Source region is computed from the original transform relative to current view.
    // For now, render connector lines from a placeholder source rect to the inset position.
    // The actual source rect calculation depends on scatter-plot's current transform and
    // the inset's sourceTransform — this will be wired when integrating with scatter-plot.
    return nothing;
  }

  private _renderInset(inset: Inset) {
    const { width: cw, height: ch } = this.containerSize;
    const left = inset.position.x * cw;
    const top = inset.position.y * ch;
    const width = inset.size.width * cw;
    const height = inset.size.height * ch;

    return html`
      <div
        class="inset-box ${inset.shape === 'circle' ? 'circle' : ''}"
        style="left:${left}px;top:${top}px;width:${width}px;height:${height}px;"
        @pointerdown="${(e: PointerEvent) => this._onInsetPointerDown(e, inset)}"
        @pointermove="${this._onInsetPointerMove}"
        @pointerup="${this._onInsetPointerUp}"
      >
        ${inset.capturedCanvas
          ? html`<canvas
              .width="${inset.capturedCanvas.width}"
              .height="${inset.capturedCanvas.height}"
              style="width:100%;height:100%;"
            ></canvas>`
          : nothing}
        <div class="resize-handle"></div>
        ${inset.label
          ? html`<div class="inset-label">${inset.label} · ${inset.zoomFactor.toFixed(1)}×</div>`
          : nothing}
      </div>
    `;
  }

  render() {
    if (this.step === 'idle' && this.insets.length === 0) return nothing;

    return html`
      ${this.step === 'framing'
        ? html`
            <div class="framing-badge">FRAMING</div>
            <div class="toolbar-hint">
              Zoom &amp; pan to frame · Press <kbd>Enter</kbd> to snap · <kbd>Esc</kbd> to cancel
            </div>
          `
        : nothing}
      ${this.step === 'snapped'
        ? html`<div class="snap-badge">Content locked — drag to position</div>`
        : nothing}
      <svg class="connector-svg" width="100%" height="100%">
        ${this.insets.map(() => this._renderConnectors)}
      </svg>
      ${this.insets.map((inset) => this._renderInset(inset))}
    `;
  }
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd /Users/jcoludar/CascadeProjects/SpeciesEmbedding/externals/protspace_web && pnpm vitest run packages/core/src/components/scatter-plot/inset-tool.test.ts`
Expected: All 2 tests PASS

- [ ] **Step 6: Add import to scatter-plot.ts**

Add to the imports at the top of `scatter-plot.ts`:

```typescript
import './inset-tool';
import type { InsetStep, Inset as InsetType } from './annotation-types';
```

Add properties to the class:

```typescript
  @property({ type: Array }) insets: InsetType[] = [];
  @property({ type: String, attribute: 'inset-step' }) insetStep: InsetStep = 'idle';
```

Add in the render() method alongside the other new components:

```typescript
        <protspace-inset-tool
          .step="${this.insetStep}"
          .insets="${this.insets}"
          .containerSize="${{ width: this.clientWidth, height: this.clientHeight }}"
        ></protspace-inset-tool>
```

- [ ] **Step 7: Build and verify**

Run: `cd /Users/jcoludar/CascadeProjects/SpeciesEmbedding/externals/protspace_web && pnpm type-check`
Expected: No errors

- [ ] **Step 8: Commit**

```bash
git add packages/core/src/components/scatter-plot/inset-tool.ts packages/core/src/components/scatter-plot/inset-tool.styles.ts packages/core/src/components/scatter-plot/inset-tool.test.ts packages/core/src/components/scatter-plot/scatter-plot.ts
git commit -m "feat(scatter-plot): add inset tool component with frame-snap-position workflow"
```

---

## Task 8: Export Studio — Modal Shell

**Files:**

- Create: `packages/core/src/components/export-studio/export-studio.test.ts`
- Create: `packages/core/src/components/export-studio/export-studio.styles.ts`
- Create: `packages/core/src/components/export-studio/export-studio.ts`

- [ ] **Step 1: Write the failing tests**

```typescript
// packages/core/src/components/export-studio/export-studio.test.ts
import { describe, it, expect } from 'vitest';
import { computePreviewDimensions } from './export-studio';

describe('export-studio', () => {
  describe('computePreviewDimensions', () => {
    it('scales figure to fit within preview area maintaining aspect ratio', () => {
      const result = computePreviewDimensions(
        { widthMm: 183, heightMm: 120 },
        { width: 800, height: 600 },
      );
      // 183:120 = 1.525 aspect ratio
      // Available: 800x600 -> limited by width? 800 / 1.525 = 524.6 < 600 -> yes
      expect(result.width).toBeCloseTo(800, 0);
      expect(result.height).toBeCloseTo(524.6, 0);
    });

    it('constrains by height when figure is tall', () => {
      const result = computePreviewDimensions(
        { widthMm: 89, heightMm: 247 },
        { width: 800, height: 600 },
      );
      // 89:247 = 0.36 aspect ratio
      // Limited by height: 600 * 0.36 = 216
      expect(result.height).toBeCloseTo(600, 0);
      expect(result.width).toBeCloseTo(216, 0);
    });

    it('handles native preset (pixel dimensions)', () => {
      const result = computePreviewDimensions(
        { widthPx: 1920, heightPx: 1080 },
        { width: 800, height: 600 },
      );
      // 1920:1080 = 1.778 -> limited by width: 800 / 1.778 = 450
      expect(result.width).toBeCloseTo(800, 0);
      expect(result.height).toBeCloseTo(450, 0);
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd /Users/jcoludar/CascadeProjects/SpeciesEmbedding/externals/protspace_web && pnpm vitest run packages/core/src/components/export-studio/export-studio.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Write the styles**

```typescript
// packages/core/src/components/export-studio/export-studio.styles.ts
import { css } from 'lit';

export const exportStudioStyles = css`
  :host {
    display: block;
  }

  .overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.6);
    z-index: 1000;
    display: flex;
    backdrop-filter: blur(2px);
  }

  .studio {
    display: flex;
    width: 100%;
    height: 100%;
  }

  .preview-area {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--surface-base, #111);
    position: relative;
    overflow: hidden;
  }

  .checkerboard {
    position: absolute;
    inset: 0;
    opacity: 0.03;
    background-image: repeating-conic-gradient(#fff 0% 25%, transparent 0% 50%);
    background-size: 20px 20px;
    pointer-events: none;
  }

  .figure-frame {
    position: relative;
    background: #fff;
    box-shadow: 0 8px 40px rgba(0, 0, 0, 0.5);
    z-index: 1;
  }

  .dim-badge {
    position: absolute;
    bottom: -24px;
    left: 50%;
    transform: translateX(-50%);
    font-size: 9px;
    color: #aaa;
    white-space: nowrap;
    background: rgba(0, 0, 0, 0.6);
    padding: 2px 8px;
    border-radius: 3px;
  }

  .controls-panel {
    width: 280px;
    background: var(--surface-elevated, #16213e);
    border-left: 1px solid var(--border-color, #333);
    overflow-y: auto;
    flex-shrink: 0;
  }

  .studio-header {
    padding: 12px 16px;
    background: var(--surface-elevated, #16213e);
    border-bottom: 1px solid var(--border-color, #333);
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .studio-header h2 {
    font-size: 16px;
    font-weight: 600;
    color: var(--text-primary, #fff);
    margin: 0;
  }

  .studio-header .close-btn {
    margin-left: auto;
    background: none;
    border: none;
    color: var(--text-secondary, #888);
    cursor: pointer;
    font-size: 18px;
    padding: 4px 8px;
    border-radius: 4px;
  }

  .studio-header .close-btn:hover {
    background: var(--surface-hover, #2a3a5a);
    color: var(--text-primary, #fff);
  }

  .control-section {
    padding: 14px 16px;
    border-bottom: 1px solid var(--border-subtle, #2a2a4a);
  }

  .control-section h3 {
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.8px;
    color: var(--text-secondary, #8899aa);
    margin: 0 0 10px;
  }

  .btn-row {
    display: flex;
    gap: 8px;
    padding: 14px 16px;
  }

  .btn {
    padding: 8px 16px;
    border-radius: 6px;
    border: none;
    font-size: 12px;
    cursor: pointer;
    font-weight: 500;
  }

  .btn-primary {
    background: var(--accent-color, #5b8fd9);
    color: #fff;
    flex: 1;
  }

  .btn-primary:hover {
    opacity: 0.9;
  }

  .btn-secondary {
    background: var(--surface-hover, #2a2a4a);
    color: var(--text-secondary, #aab);
    border: 1px solid var(--border-color, #444);
  }

  .btn-secondary:hover {
    background: var(--surface-active, #3a3a5a);
  }
`;
```

- [ ] **Step 4: Write the implementation**

```typescript
// packages/core/src/components/export-studio/export-studio.ts
import { LitElement, html, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import type { Indicator, Inset, AnnotationSnapshot } from '../scatter-plot/annotation-types';
import { exportStudioStyles } from './export-studio.styles';

interface FigureSizeMm {
  widthMm: number;
  heightMm: number;
  widthPx?: undefined;
  heightPx?: undefined;
}

interface FigureSizePx {
  widthPx: number;
  heightPx: number;
  widthMm?: undefined;
  heightMm?: undefined;
}

type FigureSize = FigureSizeMm | FigureSizePx;

export function computePreviewDimensions(
  figure: FigureSize,
  available: { width: number; height: number },
): { width: number; height: number } {
  const aspect =
    figure.widthMm != null ? figure.widthMm / figure.heightMm : figure.widthPx! / figure.heightPx!;

  const fitByWidth = { width: available.width, height: available.width / aspect };
  const fitByHeight = { width: available.height * aspect, height: available.height };

  return fitByWidth.height <= available.height ? fitByWidth : fitByHeight;
}

@customElement('protspace-export-studio')
export class ProtspaceExportStudio extends LitElement {
  static styles = exportStudioStyles;

  @property({ type: Boolean }) open = false;
  @property({ type: Array }) indicators: Indicator[] = [];
  @property({ type: Array }) insets: Inset[] = [];

  @state() private _layoutId = 'two_column_right';
  @state() private _dpi = 300;
  @state() private _format: 'png' | 'pdf' = 'png';

  private _close() {
    this.open = false;
    this.dispatchEvent(new CustomEvent('export-studio-close', { bubbles: true, composed: true }));
  }

  private _handleDownload() {
    this.dispatchEvent(
      new CustomEvent('export-studio-download', {
        detail: {
          layoutId: this._layoutId,
          dpi: this._dpi,
          format: this._format,
          indicators: this.indicators,
          insets: this.insets,
        },
        bubbles: true,
        composed: true,
      }),
    );
  }

  private _onOverlayClick(e: MouseEvent) {
    if (e.target === e.currentTarget) {
      this._close();
    }
  }

  private _onKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape') this._close();
  };

  connectedCallback() {
    super.connectedCallback();
    document.addEventListener('keydown', this._onKeyDown);
  }

  disconnectedCallback() {
    document.removeEventListener('keydown', this._onKeyDown);
    super.disconnectedCallback();
  }

  render() {
    if (!this.open) return nothing;

    return html`
      <div
        class="overlay"
        @click="${this._onOverlayClick}"
        role="dialog"
        aria-modal="true"
        aria-label="Export Studio"
      >
        <div class="studio">
          <div class="preview-area">
            <div class="checkerboard"></div>
            <div class="figure-frame" style="width:400px;height:300px;">
              <!-- Preview canvas will be rendered here by export-studio-preview -->
              <div class="dim-badge">Preview</div>
            </div>
          </div>
          <div class="controls-panel">
            <div class="studio-header">
              <h2>Export Studio</h2>
              <button class="close-btn" @click="${this._close}" aria-label="Close">✕</button>
            </div>

            <div class="control-section">
              <h3>Layout Preset</h3>
              <p style="font-size:11px;color:var(--text-secondary,#aab);">
                Presets will be wired to PR #224 layouts
              </p>
            </div>

            <div class="control-section">
              <h3>Legend</h3>
              <p style="font-size:11px;color:var(--text-secondary,#aab);">Legend controls here</p>
            </div>

            <div class="control-section">
              <h3>Indicators (${this.indicators.length})</h3>
              ${this.indicators.length === 0
                ? html`<p style="font-size:10px;color:var(--text-disabled,#667);">
                    Right-click a point on canvas to add
                  </p>`
                : this.indicators.map(
                    (ind) => html`
                      <div
                        style="display:flex;align-items:center;gap:8px;padding:4px 0;font-size:11px;color:var(--text-primary,#ddd);"
                      >
                        <span>↗</span>
                        <span>${ind.label}</span>
                      </div>
                    `,
                  )}
            </div>

            <div class="control-section">
              <h3>Insets (${this.insets.length})</h3>
              ${this.insets.length === 0
                ? html`<p style="font-size:10px;color:var(--text-disabled,#667);">
                    Use inset tool on canvas to add
                  </p>`
                : this.insets.map(
                    (inset) => html`
                      <div
                        style="display:flex;align-items:center;gap:8px;padding:4px 0;font-size:11px;color:var(--text-primary,#ddd);"
                      >
                        <span>${inset.shape === 'circle' ? '●' : '■'}</span>
                        <span>${inset.label || 'Inset'} · ${inset.zoomFactor.toFixed(1)}×</span>
                      </div>
                    `,
                  )}
            </div>

            <div class="control-section">
              <h3>Output</h3>
              <div
                style="display:flex;align-items:center;justify-content:space-between;font-size:11px;color:var(--text-secondary,#aab);margin-bottom:6px;"
              >
                <span>DPI</span>
                <span style="color:var(--accent-color,#5b8fd9);">${this._dpi}</span>
              </div>
              <div
                style="display:flex;align-items:center;justify-content:space-between;font-size:11px;color:var(--text-secondary,#aab);"
              >
                <span>Format</span>
                <span style="color:var(--accent-color,#5b8fd9);"
                  >${this._format.toUpperCase()}</span
                >
              </div>
            </div>

            <div class="btn-row">
              <button class="btn btn-primary" @click="${this._handleDownload}">Download PNG</button>
              <button
                class="btn btn-secondary"
                @click="${() => {
                  this._format = 'pdf';
                  this._handleDownload();
                }}"
              >
                PDF
              </button>
            </div>
          </div>
        </div>
      </div>
    `;
  }
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd /Users/jcoludar/CascadeProjects/SpeciesEmbedding/externals/protspace_web && pnpm vitest run packages/core/src/components/export-studio/export-studio.test.ts`
Expected: All 3 tests PASS

- [ ] **Step 6: Register component in package index**

Add to `packages/core/src/index.ts`:

```typescript
// Export Studio
export './components/export-studio/export-studio';
export type { ProtspaceExportStudio } from './components/export-studio/export-studio';
```

- [ ] **Step 7: Build and verify**

Run: `cd /Users/jcoludar/CascadeProjects/SpeciesEmbedding/externals/protspace_web && pnpm type-check`
Expected: No errors

- [ ] **Step 8: Commit**

```bash
git add packages/core/src/components/export-studio/ packages/core/src/index.ts
git commit -m "feat(export-studio): add modal shell with preview area and controls panel"
```

---

## Task 9: Wire Export Studio into Runtime + Control Bar

**Files:**

- Modify: `app/src/explore/runtime.ts`
- Modify: `app/src/explore/export-handler.ts`
- Modify: `app/src/pages/Explore.tsx` (add `<protspace-export-studio>` to page)
- Modify: `packages/core/src/components/control-bar/control-bar.ts` (add inset tool button for discoverability)

- [ ] **Step 1: Add export-studio element to Explore page**

Find the visualization container in `app/src/pages/Explore.tsx` and add the export-studio component. It renders at the page level (not inside scatter-plot) as a modal overlay:

```tsx
<protspace-export-studio id="export-studio"></protspace-export-studio>
```

- [ ] **Step 2: Add element reference**

In `app/src/explore/elements.ts`, add to the element getters:

```typescript
exportStudio: document.querySelector<HTMLElement & { open: boolean; indicators: any[]; insets: any[] }>('protspace-export-studio'),
```

- [ ] **Step 3: Update runtime to wire Export Studio**

In `runtime.ts`, after creating the annotation controller, add:

```typescript
  const { exportStudio } = elements as any; // or update elements type

  // Open Export Studio instead of direct export for PNG/PDF
  addTrackedEventListener(lifecycle, plotElement, 'context-menu-action', ...); // already added in Task 6

  // When annotation state changes, sync to Export Studio
  const syncAnnotationsToStudio = () => {
    if (exportStudio) {
      exportStudio.indicators = annotationController.getIndicators();
      exportStudio.insets = annotationController.getInsets();
    }
  };
```

Update the annotation controller's `onChange` to also call `syncAnnotationsToStudio()`:

```typescript
const annotationController = createAnnotationController({
  onChange() {
    plotElement.indicators = annotationController.getIndicators();
    syncAnnotationsToStudio();
  },
});
```

- [ ] **Step 4: Route export button to Export Studio**

In `export-handler.ts`, modify the handler so that PNG/PDF formats open the Export Studio instead of directly exporting:

```typescript
if (format === 'png' || format === 'pdf') {
  const studio = document.querySelector('protspace-export-studio') as any;
  if (studio) {
    studio.open = true;
    return;
  }
}
```

Keep the existing parquet/IDs export path unchanged.

- [ ] **Step 5: Build and verify**

Run: `cd /Users/jcoludar/CascadeProjects/SpeciesEmbedding/externals/protspace_web && pnpm type-check && pnpm build`
Expected: Build succeeds

- [ ] **Step 6: Manual smoke test**

Run: `cd /Users/jcoludar/CascadeProjects/SpeciesEmbedding/externals/protspace_web && pnpm dev`

Test in browser:

1. Load a dataset
2. Right-click a point → context menu appears with Indicate, Select, Copy ID, View in UniProt
3. Click "Indicate" → arrow appears at the point
4. Click Export (PNG) → Export Studio modal opens showing the indicator in the list
5. Close modal with Escape or X button

- [ ] **Step 7: Commit**

```bash
git add app/src/pages/Explore.tsx app/src/explore/elements.ts app/src/explore/runtime.ts app/src/explore/export-handler.ts
git commit -m "feat(explore): wire export studio into runtime, route PNG/PDF export to studio modal"
```

---

## Task 10: Export Studio Preview + Composition

**Files:**

- Create: `packages/core/src/components/export-studio/export-studio-preview.ts`
- Modify: `packages/core/src/components/export-studio/export-studio.ts`

This task integrates with PR #224's publication-export module. It requires PR #224 to be merged or the branch to be rebased onto it.

- [ ] **Step 1: Create the preview component**

```typescript
// packages/core/src/components/export-studio/export-studio-preview.ts
import { LitElement, html, css } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';

/**
 * Renders a live preview of the composed publication figure.
 * Receives a pre-composed canvas and displays it scaled to fit.
 */
@customElement('protspace-export-studio-preview')
export class ProtspaceExportStudioPreview extends LitElement {
  static styles = css`
    :host {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 100%;
      height: 100%;
      position: relative;
    }

    canvas {
      max-width: 90%;
      max-height: 90%;
      box-shadow: 0 8px 40px rgba(0, 0, 0, 0.5);
    }
  `;

  @property({ attribute: false }) previewCanvas: HTMLCanvasElement | null = null;

  updated(changed: Map<string, unknown>) {
    if (changed.has('previewCanvas') && this.previewCanvas) {
      const slot = this.shadowRoot?.querySelector('canvas');
      if (slot) {
        const ctx = slot.getContext('2d');
        if (ctx) {
          slot.width = this.previewCanvas.width;
          slot.height = this.previewCanvas.height;
          ctx.drawImage(this.previewCanvas, 0, 0);
        }
      }
    }
  }

  render() {
    return html`<canvas></canvas>`;
  }
}
```

- [ ] **Step 2: Wire preview into export-studio.ts**

Replace the placeholder figure-frame div in export-studio.ts's render method with:

```typescript
import './export-studio-preview';

// In the preview-area div:
<protspace-export-studio-preview
  .previewCanvas="${this._previewCanvas}"
></protspace-export-studio-preview>
```

The `_previewCanvas` is generated by calling the composition pipeline (from PR #224's `composePublicationFigureRaster()`) whenever layout or annotation state changes. This wiring depends on PR #224 being available.

- [ ] **Step 3: Build and verify**

Run: `cd /Users/jcoludar/CascadeProjects/SpeciesEmbedding/externals/protspace_web && pnpm type-check`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add packages/core/src/components/export-studio/export-studio-preview.ts packages/core/src/components/export-studio/export-studio.ts
git commit -m "feat(export-studio): add preview component for live figure composition"
```

---

## Task 11: Extend Publication Export Module for Annotations

**Files:**

- Modify: `packages/utils/src/visualization/publication-export/figure-composer.ts`
- Modify: `packages/utils/src/visualization/publication-export/presets.ts`
- Modify: `packages/utils/src/visualization/publication-export/index.ts`

This task requires PR #224 to be merged. It extends the composition pipeline.

- [ ] **Step 1: Add Native and Freeform presets to presets.ts**

Add after the existing preset definitions:

```typescript
export const NATIVE_LAYOUT_ID = 'native' as const;
export const FREEFORM_LAYOUT_ID = 'freeform' as const;
```

These are handled specially in the layout computation — native uses the current viewport dimensions, freeform uses user-provided dimensions.

- [ ] **Step 2: Extend composePublicationFigureRaster for annotations**

Add an optional `annotations` parameter to `composePublicationFigureRaster()` in `figure-composer.ts`:

```typescript
interface AnnotationOverlay {
  indicators: Array<{
    label: string;
    x: number; // pixel position on figure
    y: number;
  }>;
  insets: Array<{
    canvas: HTMLCanvasElement;
    x: number;
    y: number;
    width: number;
    height: number;
    shape: 'rectangle' | 'circle';
    sourceRect?: { x: number; y: number; width: number; height: number };
  }>;
}
```

After compositing scatter + legend, draw:

1. Inset canvases at their positioned coordinates (clipped to circle if shape is 'circle')
2. Connector lines from source regions to insets (dashed, black)
3. Indicator arrows at their positioned coordinates (fixed 32px shaft + 9px head at figure scale)

- [ ] **Step 3: Export new types from index.ts**

Add to the publication-export index:

```typescript
export type { AnnotationOverlay } from './figure-composer';
export { NATIVE_LAYOUT_ID, FREEFORM_LAYOUT_ID } from './presets';
```

- [ ] **Step 4: Build and verify**

Run: `cd /Users/jcoludar/CascadeProjects/SpeciesEmbedding/externals/protspace_web && pnpm type-check`
Expected: No errors

- [ ] **Step 5: Commit**

```bash
git add packages/utils/src/visualization/publication-export/
git commit -m "feat(publication-export): extend composition for annotation overlays, native and freeform presets"
```

---

## Task 12: Final Integration + Cleanup

**Files:**

- Modify: `packages/core/src/index.ts` (ensure all new exports)
- Run full test suite
- Run lint

- [ ] **Step 1: Verify all exports are registered**

Ensure `packages/core/src/index.ts` exports:

- `ProtspaceContextMenu` from `./components/scatter-plot/context-menu`
- `ProtspaceIndicatorLayer` from `./components/scatter-plot/indicator-layer`
- `ProtspaceInsetTool` from `./components/scatter-plot/inset-tool`
- `ProtspaceExportStudio` from `./components/export-studio/export-studio`
- All types from `./components/scatter-plot/annotation-types`

- [ ] **Step 2: Run full test suite**

Run: `cd /Users/jcoludar/CascadeProjects/SpeciesEmbedding/externals/protspace_web && pnpm test`
Expected: All tests pass (existing + new)

- [ ] **Step 3: Run lint**

Run: `cd /Users/jcoludar/CascadeProjects/SpeciesEmbedding/externals/protspace_web && pnpm lint`
Expected: No errors (fix any that appear)

- [ ] **Step 4: Run type-check**

Run: `cd /Users/jcoludar/CascadeProjects/SpeciesEmbedding/externals/protspace_web && pnpm type-check`
Expected: No errors

- [ ] **Step 5: Final commit**

```bash
git add -A
git commit -m "chore: final integration — export all new components and types"
```

- [ ] **Step 6: Create draft PR**

```bash
gh pr create --draft --title "feat: publication export studio with inline annotations" --body "$(cat <<'EOF'
## Summary
- Right-click context menu on scatter canvas (Indicate, Select, Copy ID, View in UniProt)
- Indicator arrows: zoom-invariant, draggable, editable labels
- Inset tool: frame → snap → position workflow (rectangle + circle)
- Export Studio modal: WYSIWYG preview, layout presets (7 + native + freeform), legend tuning, DPI/format controls
- Builds on PR #224's publication-export module

## Spec
docs/superpowers/specs/2026-04-20-publication-export-studio-design.md

## Test plan
- [ ] Right-click point → context menu appears with all 4 actions
- [ ] Indicate → arrow appears, survives zoom/pan, stays fixed size
- [ ] Drag arrow → offset updates, head still points at target
- [ ] Double-click label → editable, blur saves
- [ ] Del key → removes indicator
- [ ] Select → point added to selection
- [ ] Copy ID → clipboard
- [ ] View in UniProt → opens correct URL
- [ ] Inset tool: frame a cluster, snap, position, confirm
- [ ] Export Studio: opens with annotations listed
- [ ] Layout presets change preview dimensions
- [ ] Download PNG at 300 DPI with indicators + insets composited
- [ ] All existing tests still pass

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```
