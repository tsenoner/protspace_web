import { html, nothing, type TemplateResult } from 'lit';
import { LEGEND_DEFAULTS, FIRST_NUMBER_SORT_FEATURES } from './config';
import type { LegendSortMode } from './types';
import { normalizeSortMode } from './legend-helpers';

/**
 * Settings dialog state interface
 */
export interface SettingsDialogState {
  maxVisibleValues: number;
  shapeSize: number;
  includeOthers: boolean;
  includeShapes: boolean;
  enableDuplicateStackUI: boolean;
  selectedFeature: string;
  featureSortModes: Record<string, LegendSortMode>;
  isMultilabelFeature: boolean;
}

/**
 * Settings dialog callbacks interface
 */
export interface SettingsDialogCallbacks {
  onMaxVisibleValuesChange: (value: number) => void;
  onShapeSizeChange: (value: number) => void;
  onIncludeOthersChange: (checked: boolean) => void;
  onIncludeShapesChange: (checked: boolean) => void;
  onEnableDuplicateStackUIChange: (checked: boolean) => void;
  onSortModeChange: (feature: string, mode: LegendSortMode) => void;
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
 * Renders the checkbox options (include others, shapes, duplicate stack)
 */
function renderCheckboxOptions(
  state: SettingsDialogState,
  callbacks: SettingsDialogCallbacks,
): TemplateResult {
  return html`
    <label class="other-items-list-label">
      <input
        class="other-items-list-label-input"
        type="checkbox"
        .checked=${state.includeOthers}
        @change=${(e: Event) =>
          callbacks.onIncludeOthersChange((e.target as HTMLInputElement).checked)}
      />
      Show "Other" category
    </label>

    <label
      class="other-items-list-label"
      style="${state.isMultilabelFeature ? 'color: #888;' : ''}"
    >
      <input
        class="other-items-list-label-input"
        type="checkbox"
        .checked=${state.includeShapes}
        .disabled=${state.isMultilabelFeature}
        @change=${(e: Event) =>
          callbacks.onIncludeShapesChange((e.target as HTMLInputElement).checked)}
      />
      Include shapes
    </label>

    ${state.isMultilabelFeature
      ? html`<div style="color: #888; font-size: 0.85em; margin-left: 24px; margin-top: -4px;">
          Disabled for multilabel features
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
 * Renders the sorting options section
 */
function renderSortingSection(
  state: SettingsDialogState,
  callbacks: SettingsDialogCallbacks,
): TemplateResult {
  if (!state.selectedFeature) return html``;

  const fname = state.selectedFeature;
  const currentMode = state.featureSortModes[fname] || 'size';
  const normalizedMode = normalizeSortMode(currentMode);
  const isAlphabetic = normalizedMode === 'alpha';

  return html`
    <div class="other-items-list-item-sorting">
      <div class="other-items-list-item-sorting-title">Sorting</div>
      <div class="other-items-list-item-sorting-container">
        <div class="other-items-list-item-sorting-container-item">
          <span class="other-items-list-item-sorting-container-item-name">${fname}</span>
          <span class="other-items-list-item-sorting-container-item-container">
            <label class="other-items-list-item-sorting-container-item-container-label">
              <input
                class="other-items-list-item-sorting-container-item-container-input"
                type="radio"
                name=${`sort-${fname}`}
                .checked=${!isAlphabetic}
                @change=${() => callbacks.onSortModeChange(fname, 'size')}
              />
              by category size
            </label>
            <label>
              <input
                type="radio"
                name=${`sort-${fname}`}
                .checked=${isAlphabetic}
                @change=${() => callbacks.onSortModeChange(fname, 'alpha')}
              />
              alphanumerically
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
      <button class="close-button" @click=${callbacks.onClose}>
        <svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M6 18L18 6M6 6l12 12"
          />
        </svg>
      </button>
    </div>
  `;
}

/**
 * Renders the dialog footer with action buttons
 */
function renderDialogFooter(callbacks: SettingsDialogCallbacks): TemplateResult {
  return html`
    <div class="modal-footer">
      <button
        class="modal-reset-button"
        @click=${callbacks.onReset}
        title="Reset all settings to defaults and clear saved preferences"
      >
        Reset
      </button>
      <button class="modal-close-button" @click=${callbacks.onClose}>Cancel</button>
      <button class="extract-button" @click=${callbacks.onSave}>Save</button>
    </div>
  `;
}

/**
 * Initializes sort mode for a feature if not already set
 */
export function initializeFeatureSortMode(
  featureSortModes: Record<string, LegendSortMode>,
  selectedFeature: string,
  currentFeatureSortModes: Record<string, LegendSortMode>,
): Record<string, LegendSortMode> {
  if (!selectedFeature || featureSortModes[selectedFeature]) {
    return featureSortModes;
  }

  const existingMode = currentFeatureSortModes[selectedFeature];
  const normalizedMode = existingMode
    ? normalizeSortMode(existingMode)
    : FIRST_NUMBER_SORT_FEATURES.has(selectedFeature)
      ? 'alpha'
      : 'size';

  return {
    ...featureSortModes,
    [selectedFeature]: normalizedMode,
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

        <div class="modal-description">Legend display options</div>

        <div class="other-items-list">
          ${renderMaxVisibleInput(state, callbacks)} ${renderShapeSizeInput(state, callbacks)}
          ${renderCheckboxOptions(state, callbacks)} ${renderSortingSection(state, callbacks)}
        </div>

        ${renderDialogFooter(callbacks)}
      </div>
    </div>
  `;
}
