/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import { render } from 'lit';
import { renderSettingsDialog, type SettingsDialogCallbacks } from './legend-settings-dialog';
import type { LegendPersistedSettings, LegendSortMode } from './types';
import {
  DEFAULT_NUMERIC_PALETTE_ID,
  type AnnotationTypeOverride,
  type NumericBinningStrategy,
} from '@protspace/utils';

// Import the component to register the custom element for integration coverage.
import './legend';

type LegendTestElement = HTMLElement & {
  selectedAnnotation: string;
  data?: {
    annotations?: Record<string, { kind?: 'categorical' | 'numeric'; values: string[] }>;
    protein_ids?: string[];
    numeric_annotation_data?: Record<string, Array<number | null>>;
  };
  proteinIds: string[];
  annotationData: { name: string; values: string[] };
  maxVisibleValues: number;
  includeShapes: boolean;
  updated: (changedProperties: Map<string, unknown>) => void;
  _showSettingsDialog: boolean;
  _dialogSettings: {
    maxVisibleValues: number;
    includeShapes: boolean;
    shapeSize: number;
    enableDuplicateStackUI: boolean;
    annotationTypeOverride: AnnotationTypeOverride;
    annotationSortModes: Record<string, LegendSortMode>;
    selectedPaletteId: string;
    numericStrategy: NumericBinningStrategy;
    reverseGradient: boolean;
  };
  _renderSettingsDialog: () => unknown;
  _handlePaletteChange: (paletteId: string) => void;
  _handleSettingsSave: () => void;
  _handleSettingsReset: () => void;
  _applyPersistedSettings: (settings: LegendPersistedSettings) => void;
  _syncNumericSettingsFromPersistence: () => void;
  _updateLegendItems: () => void;
  _dispatchLegendStateChange: () => void;
  _scatterplotController: {
    scatterplot: {
      data?: {
        protein_ids?: string[];
        annotations?: Record<string, { kind?: 'categorical' | 'numeric'; values: string[] }>;
        numeric_annotation_data?: Record<string, Array<number | null>>;
      };
      dispatchEvent?: (event: Event) => boolean;
    } | null;
    syncNumericAnnotationSettings: () => void;
  };
  _selectedPaletteId: string;
  _annotationSortModes: Record<string, LegendSortMode>;
  _annotationTypeOverridesByAnnotation: Record<string, AnnotationTypeOverride>;
  _numericSettingsByAnnotation: Record<
    string,
    {
      binCount: number;
      strategy: NumericBinningStrategy;
      paletteId: string;
      reverseGradient: boolean;
    }
  >;
  _persistenceController: {
    updateDatasetHash: (data: unknown) => boolean;
    callbacks: {
      getCurrentSettings: () => {
        sortMode: LegendSortMode;
        annotationTypeOverride?: AnnotationTypeOverride;
        numericSettings?: {
          strategy: NumericBinningStrategy;
          reverseGradient?: boolean;
          manualOrderIds?: string[];
        };
      };
    };
  };
  getAllPersistedSettings: () => Record<string, LegendPersistedSettings>;
};

function renderSettingsDialogToContainer(overrides = {}) {
  const callbacks = {
    onMaxVisibleValuesChange: vi.fn(),
    onShapeSizeChange: vi.fn(),
    onIncludeShapesChange: vi.fn(),
    onEnableDuplicateStackUIChange: vi.fn(),
    onSortModeChange: vi.fn<(annotation: string, mode: LegendSortMode) => void>(),
    onPaletteChange: vi.fn(),
    onNumericStrategyChange: vi.fn<(strategy: NumericBinningStrategy) => void>(),
    onReverseGradientChange: vi.fn(),
    onAnnotationTypeOverrideChange: vi.fn<(value: AnnotationTypeOverride) => void>(),
    onSave: vi.fn(),
    onClose: vi.fn(),
    onReset: vi.fn(),
    onKeydown: vi.fn(),
    onOverlayMouseDown: vi.fn(),
    onOverlayMouseUp: vi.fn(),
  } as SettingsDialogCallbacks;

  const container = document.createElement('div');
  render(
    renderSettingsDialog(
      {
        maxVisibleValues: 25,
        shapeSize: 12,
        includeShapes: true,
        enableDuplicateStackUI: false,
        selectedAnnotation: 'score',
        annotationSortModes: {},
        annotationTypeOverride: 'numeric',
        isMultilabelAnnotation: false,
        isNumericAnnotation: true,
        selectedNumericStrategy: 'linear',
        logBinningAvailable: true,
        hasPersistedSettings: false,
        selectedPaletteId: 'viridis',
        reverseGradient: false,
        ...overrides,
      },
      callbacks,
    ),
    container,
  );

  return { container, callbacks };
}

describe('renderSettingsDialog', () => {
  it('renders annotation type override controls before display settings', () => {
    const { container } = renderSettingsDialogToContainer();
    const select = container.querySelector('#annotation-type-override') as HTMLSelectElement | null;

    expect(select).not.toBeNull();
    expect(select?.value).toBe('numeric');
    expect(
      [...select!.options].map((option) => [option.textContent?.trim(), option.value]),
    ).toEqual([
      ['Auto', 'auto'],
      ['String', 'string'],
      ['Numeric', 'numeric'],
    ]);

    const sections = [...container.querySelectorAll('.settings-section-title')].map((section) =>
      section.textContent?.trim(),
    );
    expect(sections.indexOf('Annotation type')).toBeLessThan(sections.indexOf('Display'));
  });

  it('notifies when annotation type override changes', () => {
    const { container, callbacks } = renderSettingsDialogToContainer();
    const select = container.querySelector('#annotation-type-override') as HTMLSelectElement;

    select.value = 'string';
    select.dispatchEvent(new Event('change', { bubbles: true }));

    expect(callbacks.onAnnotationTypeOverrideChange).toHaveBeenCalledWith('string');
  });
});

describe('ProtspaceLegend settings dialog type override integration', () => {
  function createLegend(): LegendTestElement {
    return document.createElement('protspace-legend') as LegendTestElement;
  }

  function configureOpenSettingsDialog(
    el: LegendTestElement,
    annotationTypeOverride: AnnotationTypeOverride,
    selectedPaletteId = 'kellys',
  ) {
    el.selectedAnnotation = 'score';
    el.annotationData = { name: 'score', values: ['1', '2'] };
    el._showSettingsDialog = true;
    el._dialogSettings = {
      maxVisibleValues: 5,
      includeShapes: true,
      shapeSize: 12,
      enableDuplicateStackUI: false,
      annotationTypeOverride,
      annotationSortModes: {},
      selectedPaletteId,
      numericStrategy: 'linear',
      reverseGradient: false,
    };
  }

  function setSourceAnnotationKind(el: LegendTestElement, kind: 'categorical' | 'numeric'): void {
    Object.defineProperty(el._scatterplotController, 'scatterplot', {
      configurable: true,
      value: {
        data: {
          annotations: {
            score: { kind, values: [] },
          },
        },
      },
    });
  }

  it('renders numeric-dependent controls when pending type override is numeric', () => {
    const el = createLegend();
    configureOpenSettingsDialog(el, 'numeric', DEFAULT_NUMERIC_PALETTE_ID);
    el._dialogSettings.annotationSortModes = { score: 'alpha-asc' };
    const container = document.createElement('div');

    render(el._renderSettingsDialog(), container);

    expect(container.querySelector('#numeric-distribution-select')).not.toBeNull();
    expect(
      [...container.querySelectorAll('.settings-section-title')].map((section) =>
        section.textContent?.trim(),
      ),
    ).toContain('Bin order');
    expect(
      container.querySelector<HTMLInputElement>('input[aria-describedby="include-shapes-note"]')
        ?.disabled,
    ).toBe(true);
  });

  it('normalizes pending shape and sort state when changing override to numeric', () => {
    const el = createLegend();
    configureOpenSettingsDialog(el, 'string');
    el._dialogSettings.annotationSortModes = { score: 'size-desc' };
    const container = document.createElement('div');

    render(el._renderSettingsDialog(), container);
    const select = container.querySelector('#annotation-type-override') as HTMLSelectElement;

    select.value = 'numeric';
    select.dispatchEvent(new Event('change', { bubbles: true }));

    expect(el._dialogSettings.annotationTypeOverride).toBe('numeric');
    expect(el._dialogSettings.includeShapes).toBe(false);
    expect(el._dialogSettings.annotationSortModes.score).toBe('alpha-asc');

    render(el._renderSettingsDialog(), container);
    const includeShapesInput = container.querySelector<HTMLInputElement>(
      'input[aria-describedby="include-shapes-note"]',
    );
    const checkedSortLabels = [
      ...container.querySelectorAll<HTMLInputElement>('input[name="sort-type-score"]:checked'),
    ].map((input) => input.closest('label')?.textContent?.trim());

    expect(includeShapesInput?.disabled).toBe(true);
    expect(includeShapesInput?.checked).toBe(false);
    expect(checkedSortLabels).toEqual(['By numeric value']);
    expect(container.textContent).not.toContain('By category size');
  });

  it('normalizes palette changes using the pending type override', () => {
    const el = createLegend();
    configureOpenSettingsDialog(el, 'numeric');

    el._handlePaletteChange('kellys');

    expect(el._dialogSettings.selectedPaletteId).toBe(DEFAULT_NUMERIC_PALETTE_ID);
  });

  it('saves numeric-only settings using the pending type override', () => {
    const el = createLegend();
    configureOpenSettingsDialog(el, 'numeric');
    el._updateLegendItems = vi.fn();
    el._dispatchLegendStateChange = vi.fn();

    el._handleSettingsSave();

    expect(el.includeShapes).toBe(false);
    expect(el._annotationSortModes.score).toBe('alpha-asc');
    expect(el._selectedPaletteId).toBe(DEFAULT_NUMERIC_PALETTE_ID);
    expect(el._annotationTypeOverridesByAnnotation.score).toBe('numeric');
    expect(el._numericSettingsByAnnotation.score).toMatchObject({
      binCount: 5,
      strategy: 'linear',
      paletteId: DEFAULT_NUMERIC_PALETTE_ID,
      reverseGradient: false,
    });
  });

  it('saves auto as numeric when the source annotation is numeric after a string override', () => {
    const el = createLegend();
    configureOpenSettingsDialog(el, 'auto');
    el.annotationData = { name: 'score', values: ['1', '2'] };
    setSourceAnnotationKind(el, 'numeric');
    el._updateLegendItems = vi.fn();
    el._dispatchLegendStateChange = vi.fn();

    el._handleSettingsSave();

    expect(el.includeShapes).toBe(false);
    expect(el._annotationSortModes.score).toBe('alpha-asc');
    expect(el._selectedPaletteId).toBe(DEFAULT_NUMERIC_PALETTE_ID);
    expect(el._annotationTypeOverridesByAnnotation.score).toBe('auto');
    expect(el._numericSettingsByAnnotation.score).toMatchObject({
      binCount: 5,
      strategy: 'linear',
      paletteId: DEFAULT_NUMERIC_PALETTE_ID,
      reverseGradient: false,
    });
  });

  it('resets to numeric defaults when the source annotation is numeric after a string override', () => {
    const el = createLegend();
    el.selectedAnnotation = 'score';
    el.annotationData = { name: 'score', values: ['1', '2'] };
    el._annotationTypeOverridesByAnnotation = { score: 'string' };
    el._selectedPaletteId = 'kellys';
    el._updateLegendItems = vi.fn();
    setSourceAnnotationKind(el, 'numeric');

    el._handleSettingsReset();

    expect(el.includeShapes).toBe(false);
    expect(el._annotationTypeOverridesByAnnotation.score).toBe('auto');
    expect(el._annotationSortModes.score).toBe('alpha-asc');
    expect(el._selectedPaletteId).toBe(DEFAULT_NUMERIC_PALETTE_ID);
    expect(el._numericSettingsByAnnotation.score).toMatchObject({
      binCount: 10,
      strategy: 'linear',
      paletteId: DEFAULT_NUMERIC_PALETTE_ID,
      reverseGradient: false,
    });
  });

  it('emits numeric settings when stored type override is numeric', () => {
    const el = createLegend();
    el.selectedAnnotation = 'score';
    el.annotationData = { name: 'score', values: ['1', '2'] };
    el.maxVisibleValues = 7;
    el._annotationTypeOverridesByAnnotation = { score: 'numeric' };
    el._numericSettingsByAnnotation = {
      score: {
        binCount: 7,
        strategy: 'quantile',
        paletteId: DEFAULT_NUMERIC_PALETTE_ID,
        reverseGradient: true,
      },
    };

    const settings = el._persistenceController.callbacks.getCurrentSettings();

    expect(settings.annotationTypeOverride).toBe('numeric');
    expect(settings.numericSettings).toMatchObject({
      strategy: 'quantile',
      reverseGradient: true,
      manualOrderIds: undefined,
    });
  });

  it('normalizes persisted sort mode when stored type override is numeric', () => {
    const el = createLegend();
    el.selectedAnnotation = 'score';
    el.annotationData = { name: 'score', values: ['1', '2'] };
    el._annotationTypeOverridesByAnnotation = { score: 'numeric' };
    el._annotationSortModes = { score: 'size-desc' };

    const settings = el._persistenceController.callbacks.getCurrentSettings();

    expect(settings.annotationTypeOverride).toBe('numeric');
    expect(settings.sortMode).toBe('alpha-asc');
  });

  it('normalizes loaded sort mode using the persisted numeric override', () => {
    const el = createLegend();
    el.selectedAnnotation = 'score';
    el.annotationData = { name: 'score', values: ['1', '2'] };

    el._applyPersistedSettings({
      maxVisibleValues: 5,
      includeShapes: true,
      shapeSize: 12,
      sortMode: 'size-desc',
      hiddenValues: [],
      categories: {},
      enableDuplicateStackUI: false,
      selectedPaletteId: DEFAULT_NUMERIC_PALETTE_ID,
      annotationTypeOverride: 'numeric',
    });

    expect(el._annotationTypeOverridesByAnnotation.score).toBe('numeric');
    expect(el._annotationSortModes.score).toBe('alpha-asc');
  });

  it('keeps override map identity when reapplying the same persisted override', () => {
    const el = createLegend();
    el.selectedAnnotation = 'score';
    el.annotationData = { name: 'score', values: ['1', '2'] };
    el._annotationTypeOverridesByAnnotation = { score: 'string' };
    const previousOverrides = el._annotationTypeOverridesByAnnotation;

    el._applyPersistedSettings({
      maxVisibleValues: 5,
      includeShapes: true,
      shapeSize: 12,
      sortMode: 'size-desc',
      hiddenValues: [],
      categories: {},
      enableDuplicateStackUI: false,
      selectedPaletteId: 'kellys',
      annotationTypeOverride: 'string',
    });

    expect(el._annotationTypeOverridesByAnnotation).toBe(previousOverrides);
  });

  it('hashes source scatterplot data instead of the materialized override view', () => {
    const el = createLegend();
    el.selectedAnnotation = 'score';
    el.proteinIds = ['p1', 'p2'];
    el.data = {
      protein_ids: ['p1', 'p2'],
      annotations: {
        score: { kind: 'categorical', values: ['1', '2'] },
      },
    };
    Object.defineProperty(el._scatterplotController, 'scatterplot', {
      configurable: true,
      value: {
        data: {
          protein_ids: ['p1', 'p2'],
          annotations: {
            score: { kind: 'numeric', values: [] },
          },
          numeric_annotation_data: {
            score: [1, 2],
          },
        },
      },
    });
    const updateDatasetHash = vi
      .spyOn(el._persistenceController, 'updateDatasetHash')
      .mockReturnValue(false);

    el.updated(new Map([['data', null]]));

    expect(updateDatasetHash).toHaveBeenCalledWith({
      protein_ids: ['p1', 'p2'],
      annotations: {
        score: { kind: 'numeric', values: [] },
      },
      numeric_annotation_data: {
        score: [1, 2],
      },
    });
  });

  it('falls back to legend data when scatterplot source data is stale', () => {
    const el = createLegend();
    el.selectedAnnotation = 'score';
    el.proteinIds = ['p1', 'p2'];
    el.data = {
      protein_ids: ['p1', 'p2'],
      annotations: {
        score: { kind: 'categorical', values: ['1', '2'] },
      },
    };
    Object.defineProperty(el._scatterplotController, 'scatterplot', {
      configurable: true,
      value: {
        data: {
          protein_ids: ['old-p1', 'old-p2'],
          annotations: {
            score: { kind: 'numeric', values: [] },
          },
          numeric_annotation_data: {
            score: [1, 2],
          },
        },
      },
    });
    const updateDatasetHash = vi
      .spyOn(el._persistenceController, 'updateDatasetHash')
      .mockReturnValue(false);

    el.updated(new Map([['data', null]]));

    expect(updateDatasetHash).toHaveBeenCalledWith({
      protein_ids: ['p1', 'p2'],
      annotations: {
        score: { kind: 'categorical', values: ['1', '2'] },
      },
      numeric_annotation_data: undefined,
    });
  });

  it('does not manually redispatch data-change while syncing numeric settings', () => {
    const el = createLegend();
    el.data = {
      protein_ids: ['p1', 'p2'],
      annotations: {
        score: { kind: 'numeric', values: [] },
      },
      numeric_annotation_data: {
        score: [1, 2],
      },
    };
    el._numericSettingsByAnnotation = {};
    el.getAllPersistedSettings = vi.fn().mockReturnValue({});
    const dispatchEvent = vi.fn().mockReturnValue(true);
    Object.defineProperty(el._scatterplotController, 'scatterplot', {
      configurable: true,
      value: {
        data: el.data,
        dispatchEvent,
      },
    });
    const syncNumericAnnotationSettings = vi.spyOn(
      el._scatterplotController,
      'syncNumericAnnotationSettings',
    );

    el._syncNumericSettingsFromPersistence();

    expect(syncNumericAnnotationSettings).toHaveBeenCalled();
    expect(dispatchEvent).not.toHaveBeenCalled();
  });
});
