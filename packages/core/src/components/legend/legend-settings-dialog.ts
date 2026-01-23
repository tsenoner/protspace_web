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
  colorItems: Array<{ value: string; label: string; color: string }>;
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
  onColorChange: (value: string, color: string) => void;
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
 * Renders the color management section
 */
function renderColorManagementSection(
  colorItems: Array<{ value: string; label: string; color: string }>,
  onColorChange: (value: string, color: string) => void,
): TemplateResult {
  if (colorItems.length === 0) return html``;

  const handleTextInput = (value: string, colorInput: string) => {
    const normalized = colorInput.startsWith('#') ? colorInput : `#${colorInput}`;
    const isValid = /^#([0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.test(normalized);
    if (isValid) {
      onColorChange(value, normalized);
    }
  };

  return html`
    <div class="color-settings">
      <div class="color-settings-header">Category colors</div>
      <div class="color-settings-list">
        ${colorItems.map(
          (item) => html`
            <div class="color-settings-row">
              <span class="color-settings-label" title=${item.label}>${item.label}</span>
              <input
                class="color-settings-swatch"
                type="color"
                .value=${item.color}
                @input=${(e: Event) =>
                  onColorChange(item.value, (e.target as HTMLInputElement).value)}
              />
              <input
                class="color-settings-input"
                type="text"
                .value=${item.color}
                spellcheck="false"
                @input=${(e: Event) =>
                  handleTextInput(item.value, (e.target as HTMLInputElement).value)}
              />
            </div>
          `,
        )}
      </div>
    </div>
  `;
}

/**
 * Renders the dialog header with close button
 */
function renderDialogHeader(title: string, onClose: () => void): TemplateResult {
  return html`
    <div class="modal-header">
      <h3 class="modal-title">${title}</h3>
      <button class="btn-close close-button" @click=${onClose}>${renderCloseIcon()}</button>
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
            class="btn-danger modal-reset-button"
            @click=${callbacks.onReset}
            title="Reset all settings to defaults and clear saved preferences"
          >
            Reset
          </button>`
        : nothing}
      <button class="btn-secondary modal-close-button" @click=${callbacks.onClose}>Cancel</button>
      <button class="btn-primary extract-button" @click=${callbacks.onSave}>Save</button>
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
        ${renderDialogHeader('Legend settings', callbacks.onClose)}

        <div class="other-items-list">
          ${renderMaxVisibleInput(state, callbacks)} ${renderShapeSizeInput(state, callbacks)}
          ${renderCheckboxOptions(state, callbacks)} ${renderSortingSection(state, callbacks)}
        </div>

        ${renderDialogFooter(callbacks, state.hasPersistedSettings)}
      </div>
    </div>
  `;
}

export interface ColorDialogState {
  colorItems: Array<{ value: string; label: string; color: string }>;
  hasColorOverrides: boolean;
  paletteOptions: PaletteOption[];
  selectedPaletteId: string;
  statusMessage: string;
  toastPosition?: { x: number; y: number };
}

export interface ColorDialogCallbacks {
  onColorChange: (value: string, color: string) => void;
  onPaletteSelect: (paletteId: string) => void;
  onApplyPalette: () => void;
  onPaletteColorCopy: (color: string, event: MouseEvent) => void;
  onSave: () => void;
  onClose: () => void;
  onReset: () => void;
  onKeydown: (e: KeyboardEvent) => void;
}

export interface PaletteOption {
  id: string;
  label: string;
  colors: string[];
}

function renderPaletteSection(
  state: ColorDialogState,
  callbacks: ColorDialogCallbacks,
): TemplateResult {
  if (!state.paletteOptions || state.paletteOptions.length === 0) return html``;

  const selected =
    state.paletteOptions.find((option) => option.id === state.selectedPaletteId) ??
    state.paletteOptions[0];

  return html`
    <div class="color-palette-section">
      <div class="color-settings-header">Palettes</div>
      <div class="color-palette-row">
        <select
          class="color-palette-select"
          @change=${(e: Event) => callbacks.onPaletteSelect((e.target as HTMLSelectElement).value)}
        >
          ${state.paletteOptions.map(
            (option) => html`
              <option value=${option.id} ?selected=${option.id === state.selectedPaletteId}>
                ${option.label}
              </option>
            `,
          )}
        </select>
        <button class="btn-secondary color-palette-apply" @click=${callbacks.onApplyPalette}>
          Apply palette
        </button>
      </div>
      <div class="color-palette-preview" aria-hidden="true">
        ${selected.colors.map(
          (color) => html`
            <button
              class="color-palette-swatch"
              type="button"
              title=${`Copy ${color}`}
              style="background:${color}"
              @click=${(e: MouseEvent) => callbacks.onPaletteColorCopy(color, e)}
            ></button>
          `,
        )}
      </div>
    </div>
  `;
}

export function renderColorDialog(
  state: ColorDialogState,
  callbacks: ColorDialogCallbacks,
): TemplateResult {
  return html`
    <div
      class="modal-overlay"
      part="dialog-overlay"
      @click=${callbacks.onClose}
      @keydown=${callbacks.onKeydown}
    >
      <div
        id="legend-color-dialog"
        class="modal-content"
        part="dialog-content"
        tabindex="-1"
        @click=${(e: Event) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        ${renderDialogHeader('Legend colors', callbacks.onClose)}
        ${state.statusMessage
          ? html`
              <div
                class="color-palette-toast"
                role="status"
                style=${state.toastPosition
                  ? `left:${state.toastPosition.x}px; top:${state.toastPosition.y}px;`
                  : ''}
              >
                ${state.statusMessage}
              </div>
            `
          : nothing}

        <div class="other-items-list">
          ${renderPaletteSection(state, callbacks)}
          ${renderColorManagementSection(state.colorItems, callbacks.onColorChange)}
        </div>

        <div class="modal-footer">
          ${state.hasColorOverrides
            ? html`
                <button class="btn-danger modal-reset-button" @click=${callbacks.onReset}>
                  Reset colors
                </button>
              `
            : nothing}
          <button class="btn-secondary modal-close-button" @click=${callbacks.onClose}>
            Cancel
          </button>
          <button class="btn-primary extract-button" @click=${callbacks.onSave}>Save</button>
        </div>
      </div>
    </div>
  `;
}
