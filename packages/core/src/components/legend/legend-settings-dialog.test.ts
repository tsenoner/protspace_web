/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import { render } from 'lit';
import { renderSettingsDialog, type SettingsDialogCallbacks } from './legend-settings-dialog';
import type { LegendSortMode } from './types';
import type { AnnotationTypeOverride, NumericBinningStrategy } from '@protspace/utils';

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
