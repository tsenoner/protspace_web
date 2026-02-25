/**
 * ProtSpace Product Tour
 *
 * Self-contained module that defines and drives an overview tour of the
 * Explore page using driver.js.  All step definitions live here so that
 * the rest of the codebase only needs to:
 *   1. add `data-driver-id="…"` attributes to the elements it wants to
 *      highlight, and
 *   2. call `startProductTour()`.
 *
 * For elements inside Shadow DOM (e.g. inside <protspace-control-bar>) we
 * use the `() => Element` function form supported by driver.js, which
 * resolves the element lazily at step-activation time.
 */

import { type Config, driver, type DriveStep, type PopoverDOM, type State } from 'driver.js';
import { isMacOrIos } from '@protspace/utils';
import './product-tour.css';
import { waitForElement } from './wait-for-element';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const STORAGE_KEY = 'driver.overviewTour';

/** Host selector for the control-bar custom element. */
const CONTROL_BAR = '#myControlBar';

/** Host selector for the legend custom element. */
const LEGEND = '#myLegend';

// ---------------------------------------------------------------------------
// Driver instance (singleton)
// ---------------------------------------------------------------------------

const driverObj = driver();

// ---------------------------------------------------------------------------
// Shadow DOM helpers
// ---------------------------------------------------------------------------

/**
 * Resolve an element inside a host's Shadow DOM.
 * Returns `undefined` when the element cannot be found (driver.js treats
 * that as a centred popover with no highlight).
 */
function shadowEl(hostSelector: string, shadowSelector: string): Element | undefined {
  const host = document.querySelector(hostSelector);
  return host?.shadowRoot?.querySelector(shadowSelector) ?? undefined;
}

/**
 * Clean up driver.js classes/attributes that `document.querySelectorAll`
 * cannot reach inside Shadow DOM after a step is deselected.
 */
function cleanupShadowElement(element: Element | undefined) {
  if (!element) return;
  element.classList.remove('driver-active-element', 'driver-no-interaction');
  element.removeAttribute('aria-haspopup');
  element.removeAttribute('aria-expanded');
  element.removeAttribute('aria-controls');
}

// ---------------------------------------------------------------------------
// Navigation helpers
// ---------------------------------------------------------------------------

const moveNext = async (driverOpts: { config: Config; state: State }) => {
  if (driverObj.hasNextStep() && driverOpts.config.steps) {
    const stepIndex = driverObj.getActiveIndex() ?? 0;
    const nextStep = driverOpts.config.steps[stepIndex + 1];

    if (nextStep && typeof nextStep.element === 'string') {
      await waitForElement(nextStep.element).catch(() => {
        /* element may already be visible – continue anyway */
      });
    }

    driverObj.moveNext();
  }
};

const movePrevious = async (driverOpts: { config: Config; state: State }) => {
  if (driverObj.hasPreviousStep() && driverOpts.config.steps) {
    const stepIndex = driverObj.getActiveIndex() ?? 0;
    const previousStep = driverOpts.config.steps[stepIndex - 1];

    if (previousStep && typeof previousStep.element === 'string') {
      await waitForElement(previousStep.element).catch(() => {
        /* continue anyway */
      });
    }
  }

  driverObj.movePrevious();
};

// ---------------------------------------------------------------------------
// Popover render hook (shared)
// ---------------------------------------------------------------------------

const onPopoverRenderBase = (popover: PopoverDOM) => {
  setTimeout(() => {
    popover.wrapper.addEventListener('click', (e) => e.stopPropagation());
    // Prevent the close button from being automatically focused
    popover.closeButton?.blur();
  }, 5);
};

// ---------------------------------------------------------------------------
// Shadow-DOM step helper
// ---------------------------------------------------------------------------

/** Build a Shadow DOM step targeting a `data-driver-id` attribute. */
function shadowStep(host: string, driverId: string, popover: DriveStep['popover']): DriveStep {
  const selector = `[data-driver-id="${driverId}"]`;
  return {
    element: () => shadowEl(host, selector) as Element,
    popover: {
      ...popover,
      onPrevClick: async (_el, _step, opts) => movePrevious(opts),
      onNextClick: async (_el, _step, opts) => moveNext(opts),
    },
    onDeselected: () => cleanupShadowElement(shadowEl(host, selector)),
  };
}

// ---------------------------------------------------------------------------
// Step definitions
// ---------------------------------------------------------------------------

const steps: DriveStep[] = [
  // ── Step 1 – Welcome (centred, no element) ──────────────────
  {
    popover: {
      title: 'Welcome to ProtSpace',
      description:
        'This short tour will walk you through the main features of the interactive protein visualization tool.',
      nextBtnText: 'Start Tour',
      showButtons: ['close', 'next'],
      onPopoverRender: (popover) => {
        onPopoverRenderBase(popover);

        // Add a "Skip" button before "Start Tour"
        const skipButton = document.createElement('button');
        skipButton.innerText = 'Skip';
        skipButton.className = 'driver-tour-skip-btn';
        skipButton.addEventListener('click', () => driverObj.destroy());
        popover.nextButton.insertAdjacentElement('beforebegin', skipButton);
      },
      onNextClick: async (_el, _step, opts) => moveNext(opts),
    },
  },

  // ── Step 2 – Import button (Shadow DOM) ─────────────────────
  shadowStep(CONTROL_BAR, 'import', {
    title: 'Import Your Data',
    description:
      'Click <strong>Import</strong> or drag-and-drop a <code>.parquetbundle</code> file onto the canvas to load your own dataset. <a href="/docs/guide/data-preparation.html" target="_blank" rel="noopener">Learn how to prepare your data<svg class="external-link-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg></a>.',
  }),

  // ── Step 3 – Projections & Annotations (Shadow DOM) ─────────
  shadowStep(CONTROL_BAR, 'projections', {
    title: 'Projections & Annotations',
    description:
      'Switch between <strong>projections</strong> (UMAP, PCA, etc.) and choose which <strong>annotation</strong> to color the points by.',
  }),

  // ── Step 4 – Search (Shadow DOM) ────────────────────────────
  shadowStep(CONTROL_BAR, 'search', {
    title: 'Search Proteins',
    description: `Press <kbd>${isMacOrIos() ? '⌘' : 'Ctrl+'}K</kbd> or click here to search. Type a protein ID to find it instantly, or <strong>paste</strong> multiple IDs to select them all at once.`,
  }),

  // ── Step 5 – Selection Tools (Shadow DOM) ──────────────────
  shadowStep(CONTROL_BAR, 'selection', {
    title: 'Selection Tools',
    description:
      '<strong>Select</strong> enters selection mode\u2009—\u2009click points or drag to lasso. Press <kbd>Esc</kbd> to exit.<br><br><strong>Clear</strong> deselects all, <strong>Isolate</strong> focuses on selected proteins, and <strong>Reset</strong> restores the full dataset.',
  }),

  // ── Step 6 – Filter, Export & Import (Shadow DOM) ──────────
  shadowStep(CONTROL_BAR, 'data-actions', {
    title: 'Filter, Export & Import',
    description:
      '<strong>Filter</strong> narrows the dataset by annotation values. <strong>Export</strong> as PNG, PDF, protein IDs, or a <code>.parquetbundle</code> that preserves your legend customizations. <strong>Import</strong> loads a new dataset.',
  }),

  // ── Step 7 – Scatterplot ────────────────────────────────────
  {
    element: '[data-driver-id="scatterplot"]',
    popover: {
      title: 'Interactive Scatterplot',
      description:
        'Each point represents a protein. <strong>Hover</strong> over a point to see its details. <strong>Pan</strong> by dragging, <strong>zoom</strong> with the mouse wheel, and <strong>click</strong> a point to view its 3D structure (when available).',
      onPrevClick: async (_el, _step, opts) => movePrevious(opts),
      onNextClick: async (_el, _step, opts) => moveNext(opts),
    },
  },

  // ── Step 8 – Legend ─────────────────────────────────────────
  {
    element: '[data-driver-id="legend"]',
    popover: {
      title: 'Legend Panel',
      description:
        '<strong>Click</strong> to hide/show, <strong>double-click</strong> to isolate a category. Drag <kbd><svg style="vertical-align:middle;display:inline" width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M4 8h16M4 16h16"/></svg></kbd> to reorder\u2009—\u2009higher items are drawn on top.<br><br>Click a color swatch to change colors or shapes. Drag a category onto <strong>Other</strong> to merge it. Use <kbd><svg style="vertical-align:middle;display:inline" width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 16V4m0 0L3 8m4-4l4 4m6-2v12m0 0l4-4m-4 4l-4-4"/></svg></kbd> to reverse sort order or <kbd><svg style="vertical-align:middle;display:inline" width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"/></svg></kbd> for advanced settings.',
      onPrevClick: async (_el, _step, opts) => movePrevious(opts),
      onNextClick: async (_el, _step, opts) => moveNext(opts),
    },
  },

  // ── Step 9 – Expand hidden categories (Shadow DOM in legend)
  shadowStep(LEGEND, 'other-row', {
    title: 'Expand Hidden Categories',
    description:
      'When there are many annotation values, the least frequent are grouped into <strong>Other</strong>. Click <strong>(view)</strong> to see them and <strong>extract</strong> individual items back into the legend.',
  }),

  // ── Step 10 – Finish (centred, no element) ──────────────────
  {
    popover: {
      title: "You're All Set!",
      description:
        'You now know the essentials. To replay this tour at any time, hover over the <strong>tips</strong> icon in the scatterplot and click <em>"Take a Tour"</em>. For more details, visit the <a href="/docs/" target="_blank" rel="noopener">documentation<svg class="external-link-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg></a>. Happy exploring!',
      showButtons: ['close', 'previous', 'next'],
      nextBtnText: 'Finish',
      onPrevClick: async (_el, _step, opts) => movePrevious(opts),
      onNextClick: () => driverObj.destroy(),
    },
  },
];

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

driverObj.setConfig({
  showProgress: true,
  disableActiveInteraction: true,
  overlayColor: '#334155',
  overlayOpacity: 0.5,
  stagePadding: 8,
  stageRadius: 8,

  doneBtnText: 'Finish',
  nextBtnText: 'Next',
  prevBtnText: 'Back',

  onPopoverRender: onPopoverRenderBase,

  steps,
});

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface ProductTourOptions {
  /** When `true` the tour starts regardless of localStorage state. */
  force?: boolean;
}

/**
 * Start the ProtSpace overview tour.
 *
 * By default the tour only runs once (tracked via `localStorage`).
 * Pass `{ force: true }` to bypass the localStorage guard (e.g. when the
 * user explicitly clicks "Take a Tour").
 */
export function startProductTour(options: ProductTourOptions = {}) {
  const hasCompleted = localStorage.getItem(STORAGE_KEY) === 'true';

  if (!options.force && hasCompleted) {
    return;
  }

  // Mark as completed immediately so it won't auto-start again even if the
  // user closes the tour early.
  localStorage.setItem(STORAGE_KEY, 'true');

  driverObj.drive();
}

/**
 * Programmatically destroy the active tour (if any).
 */
export function destroyProductTour() {
  driverObj.destroy();
}
