import { html, nothing, type TemplateResult } from 'lit';
import { LEGEND_DEFAULTS, FIRST_NUMBER_SORT_ANNOTATIONS } from './config';
import type { LegendSortMode } from './types';
import { renderCloseIcon } from './legend-other-dialog';

/**
 * Settings dialog state interface
 */
export interface SettingsDialogState {
  maxVisibleValues: number;
  shapeSize: number;
  includeShapes: boolean;
  enableDuplicateStackUI: boolean;
  selectedAnnotation: string;
  annotationSortModes: Record<string, LegendSortMode>;
  isMultilabelAnnotation: boolean;
  hasPersistedSettings: boolean;
}

/**
 * Settings dialog callbacks interface
 */
export interface SettingsDialogCallbacks {
  onMaxVisibleValuesChange: (value: number) => void;
  onShapeSizeChange: (value: number) => void;
  onIncludeShapesChange: (checked: boolean) => void;
  onEnableDuplicateStackUIChange: (checked: boolean) => void;
  onSortModeChange: (annotation: string, mode: LegendSortMode) => void;
  onSave: () => void;
  onClose: () => void;
  onReset: () => void;
  onKeydown: (e: KeyboardEvent) => void;
}

/**
 * Parses an input value as a positive integer
 */
function parsePositiveInt(value: string): number | null {
  const parsed = parseInt(value, 10);
  return !Number.isNaN(parsed) && parsed > 0 ? parsed : null;
}

/**
 * Renders the max visible values input
 */
function renderMaxVisibleInput(
  state: SettingsDialogState,
  callbacks: SettingsDialogCallbacks,
): TemplateResult {
  const onInput = (e: Event) => {
    const value = parsePositiveInt((e.target as HTMLInputElement).value);
    if (value !== null) callbacks.onMaxVisibleValuesChange(value);
  };

  return html`
    <div class="other-items-list-item">
      <label for="max-visible-input" class="other-items-list-item-label">Max legend items</label>
      <input
        id="max-visible-input"
        type="number"
        min="1"
        .value=${String(state.maxVisibleValues)}
        placeholder=${String(LEGEND_DEFAULTS.maxVisibleValues)}
        @input=${onInput}
        class="other-items-list-item-input"
      />
    </div>
  `;
}

/**
 * Renders the shape size input
 */
function renderShapeSizeInput(
  state: SettingsDialogState,
  callbacks: SettingsDialogCallbacks,
): TemplateResult {
  const onInput = (e: Event) => {
    const value = parsePositiveInt((e.target as HTMLInputElement).value);
    if (value !== null) callbacks.onShapeSizeChange(value);
  };

  return html`
    <div class="other-items-list-item">
      <label for="shape-size-input" class="other-items-list-item-label">Shape size</label>
      <input
        class="other-items-list-item-input"
        id="shape-size-input"
        type="number"
        min="6"
        max="64"
        .value=${String(state.shapeSize)}
        placeholder=${String(LEGEND_DEFAULTS.symbolSize)}
        @input=${onInput}
      />
    </div>
  `;
}

/**
 * Renders the checkbox options (shapes, duplicate stack)
 */
function renderCheckboxOptions(
  state: SettingsDialogState,
  callbacks: SettingsDialogCallbacks,
): TemplateResult {
  return html`
    <label
      class="other-items-list-label"
      style="${state.isMultilabelAnnotation ? 'color: #888;' : ''}"
    >
      <input
        class="other-items-list-label-input"
        type="checkbox"
        .checked=${state.includeShapes}
        .disabled=${state.isMultilabelAnnotation}
        @change=${(e: Event) =>
          callbacks.onIncludeShapesChange((e.target as HTMLInputElement).checked)}
      />
      Include shapes
    </label>

    ${state.isMultilabelAnnotation
      ? html`<div style="color: #888; font-size: 0.85em; margin-left: 24px; margin-top: -4px;">
          Disabled for multilabel annotations
        </div>`
      : nothing}

    <label class="other-items-list-label">
      <input
        class="other-items-list-label-input"
        type="checkbox"
        .checked=${state.enableDuplicateStackUI}
        @change=${(e: Event) =>
          callbacks.onEnableDuplicateStackUIChange((e.target as HTMLInputElement).checked)}
      />
      Show duplicate counts (badges + spiderfy)
    </label>
  `;
}

/**
 * Returns the appropriate sort mode for a given category
 */
function getSortModeForCategory(category: 'size' | 'alpha' | 'manual'): LegendSortMode {
  switch (category) {
    case 'size':
      return 'size-asc';
    case 'alpha':
      return 'alpha-asc';
    case 'manual':
      return 'manual';
  }
}

/**
 * Renders the sorting options section
 * Note: Direction (asc/desc) is toggled via the "Reverse z-order" button in the legend header
 */
function renderSortingSection(
  state: SettingsDialogState,
  callbacks: SettingsDialogCallbacks,
): TemplateResult {
  if (!state.selectedAnnotation) return html``;

  const aname = state.selectedAnnotation;
  const currentMode = state.annotationSortModes[aname] || 'size-desc';

  const isSize = currentMode.startsWith('size');
  const isAlphabetic = currentMode.startsWith('alpha');
  const isManual = currentMode.startsWith('manual');

  const handleTypeChange = (category: 'size' | 'alpha' | 'manual') => {
    callbacks.onSortModeChange(aname, getSortModeForCategory(category));
  };

  return html`
    <div class="other-items-list-item-sorting">
      <div class="other-items-list-item-sorting-title">Sorting</div>
      <div class="other-items-list-item-sorting-container">
        <div class="other-items-list-item-sorting-container-item">
          <span class="other-items-list-item-sorting-container-item-container">
            <label class="other-items-list-item-sorting-container-item-container-label">
              <input
                class="other-items-list-item-sorting-container-item-container-input"
                type="radio"
                name=${`sort-type-${aname}`}
                .checked=${isSize}
                @change=${() => handleTypeChange('size')}
              />
              by category size
            </label>
            <label>
              <input
                type="radio"
                name=${`sort-type-${aname}`}
                .checked=${isAlphabetic}
                @change=${() => handleTypeChange('alpha')}
              />
              alphanumerically
            </label>
            <label>
              <input
                type="radio"
                name=${`sort-type-${aname}`}
                .checked=${isManual}
                @change=${() => handleTypeChange('manual')}
              />
              manual (drag to reorder)
            </label>
          </span>
        </div>
      </div>
    </div>
  `;
}

/**
 * Renders the dialog header with close button
 */
function renderDialogHeader(callbacks: SettingsDialogCallbacks): TemplateResult {
  return html`
    <div class="modal-header">
      <h3 class="modal-title">Legend settings</h3>
      <button class="close-button" @click=${callbacks.onClose}>${renderCloseIcon()}</button>
    </div>
  `;
}

/**
 * Renders the dialog footer with action buttons
 */
function renderDialogFooter(
  callbacks: SettingsDialogCallbacks,
  hasPersistedSettings: boolean,
): TemplateResult {
  return html`
    <div class="modal-footer">
      ${hasPersistedSettings
        ? html`<button
            class="modal-reset-button"
            @click=${callbacks.onReset}
            title="Reset all settings to defaults and clear saved preferences"
          >
            Reset
          </button>`
        : nothing}
      <button class="modal-close-button" @click=${callbacks.onClose}>Cancel</button>
      <button class="extract-button" @click=${callbacks.onSave}>Save</button>
    </div>
  `;
}

/**
 * Initializes sort mode for an annotation if not already set
 */
export function initializeAnnotationSortMode(
  annotationSortModes: Record<string, LegendSortMode>,
  selectedAnnotation: string,
  currentAnnotationSortModes: Record<string, LegendSortMode>,
): Record<string, LegendSortMode> {
  if (!selectedAnnotation || annotationSortModes[selectedAnnotation]) {
    return annotationSortModes;
  }

  const existingMode = currentAnnotationSortModes[selectedAnnotation];
  const mode: LegendSortMode =
    existingMode ||
    (FIRST_NUMBER_SORT_ANNOTATIONS.has(selectedAnnotation) ? 'alpha-asc' : 'size-desc');

  return {
    ...annotationSortModes,
    [selectedAnnotation]: mode,
  };
}

/**
 * Renders the complete settings dialog
 */
export function renderSettingsDialog(
  state: SettingsDialogState,
  callbacks: SettingsDialogCallbacks,
): TemplateResult {
  return html`
    <div
      class="modal-overlay"
      part="dialog-overlay"
      @click=${callbacks.onClose}
      @keydown=${callbacks.onKeydown}
    >
      <div
        id="legend-settings-dialog"
        class="modal-content"
        part="dialog-content"
        tabindex="-1"
        @click=${(e: Event) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        ${renderDialogHeader(callbacks)}

        <div class="other-items-list">
          ${renderMaxVisibleInput(state, callbacks)} ${renderShapeSizeInput(state, callbacks)}
          ${renderCheckboxOptions(state, callbacks)} ${renderSortingSection(state, callbacks)}
        </div>

        ${renderDialogFooter(callbacks, state.hasPersistedSettings)}
      </div>
    </div>
  `;
}
