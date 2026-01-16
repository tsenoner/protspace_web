import { LitElement, html } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { controlBarStyles } from './control-bar.styles';
import type {
  DataChangeDetail,
  ProtspaceData,
  ScatterplotElementLike,
  DataLoaderElement,
  StructureViewerElement,
} from './types';
import { LEGEND_VALUES } from '@protspace/utils';
import { toInternalValue } from '../legend/config';
import './search';
import './annotation-select';

@customElement('protspace-control-bar')
export class ProtspaceControlBar extends LitElement {
  @property({ type: Array }) projections: string[] = [];
  @state() private projectionsMeta: Array<{
    name: string;
    metadata?: { dimension?: 2 | 3 };
  }> = [];
  @property({ type: Array }) annotations: string[] = [];
  @property({ type: String, attribute: 'selected-projection' })
  selectedProjection: string = '';
  @property({ type: String, attribute: 'selected-annotation' })
  selectedAnnotation: string = '';
  @property({ type: String, attribute: 'projection-plane' })
  projectionPlane: 'xy' | 'xz' | 'yz' = 'xy';
  @property({ type: Boolean, attribute: 'selection-mode' })
  selectionMode: boolean = false;
  @property({ type: Number, attribute: 'selected-proteins-count' })
  selectedProteinsCount: number = 0;
  @property({ type: Boolean, attribute: 'isolation-mode' })
  isolationMode: boolean = false;
  @property({ type: Array, attribute: 'isolation-history' })
  isolationHistory: string[][] = [];

  @state() private _selectionDisabled: boolean = false;

  // Auto-sync properties (optional, can be derived from events)
  @property({ type: String, attribute: 'scatterplot-selector' })
  scatterplotSelector: string = 'protspace-scatterplot';
  @property({ type: Boolean, attribute: 'auto-sync' })
  autoSync: boolean = true;

  @state() private showExportMenu: boolean = false;
  @state() private showFilterMenu: boolean = false;
  @state() private showProjectionMenu: boolean = false;
  @state() private annotationValuesMap: Record<string, string[]> = {};
  @state() private filterConfig: Record<string, { enabled: boolean; values: string[] }> = {};
  @state() private lastAppliedFilterConfig: Record<string, { enabled: boolean; values: string[] }> =
    {};
  @state() private openValueMenus: Record<string, boolean> = {};

  // Export defaults - single source of truth
  static readonly EXPORT_DEFAULTS = {
    FORMAT: 'png' as const,
    IMAGE_WIDTH: 2048,
    IMAGE_HEIGHT: 1024,
    LEGEND_WIDTH_PERCENT: 25,
    LEGEND_FONT_SIZE_PX: 48,
    BASE_FONT_SIZE: 24, // Base size for scale factor calculation
    LOCK_ASPECT_RATIO: true,
  };

  // Export configuration state
  @state() private exportFormat: 'png' | 'pdf' | 'json' | 'ids' =
    ProtspaceControlBar.EXPORT_DEFAULTS.FORMAT;
  @state() private exportImageWidth: number = ProtspaceControlBar.EXPORT_DEFAULTS.IMAGE_WIDTH;
  @state() private exportImageHeight: number = ProtspaceControlBar.EXPORT_DEFAULTS.IMAGE_HEIGHT;
  @state() private exportLegendWidthPercent: number =
    ProtspaceControlBar.EXPORT_DEFAULTS.LEGEND_WIDTH_PERCENT;
  @state() private exportLegendFontSizePx: number =
    ProtspaceControlBar.EXPORT_DEFAULTS.LEGEND_FONT_SIZE_PX;
  @state() private exportLockAspectRatio: boolean =
    ProtspaceControlBar.EXPORT_DEFAULTS.LOCK_ASPECT_RATIO;
  private _scatterplotElement: ScatterplotElementLike | null = null;

  // Search state
  @state() private allProteinIds: string[] = [];
  @state() private selectedIdsChips: string[] = [];

  // Stable listeners for proper add/remove
  private _onDocumentClick = (event: Event) => this.handleDocumentClick(event);
  private _onDocumentKeydown = (event: KeyboardEvent) => this.handleDocumentKeydown(event);
  private _onDataChange = (event: Event) => this._handleDataChange(event);
  private _onProteinClick = (event: Event) => this._handleProteinSelection(event);
  private _onDataIsolation = (event: Event) => this._handleDataIsolation(event);
  private _onDataIsolationReset = (event: Event) => this._handleDataIsolationReset(event);
  private _onAutoDisableSelection = (event: Event) => this._handleAutoDisableSelection(event);
  private _onBrushSelection = (event: Event) => this._handleBrushSelection(event);

  static styles = controlBarStyles;

  private toggleProjectionMenu() {
    this.showProjectionMenu = !this.showProjectionMenu;
  }

  private selectProjection(projection: string) {
    this.selectedProjection = projection;
    this.showProjectionMenu = false;

    // If auto-sync is enabled, directly update the scatterplot
    if (this.autoSync && this._scatterplotElement) {
      const projectionIndex = this.projections.findIndex((p) => p === projection);
      if (projectionIndex !== -1 && 'selectedProjectionIndex' in this._scatterplotElement) {
        (this._scatterplotElement as ScatterplotElementLike).selectedProjectionIndex =
          projectionIndex;

        // If projection is 3D, keep current plane; otherwise, reset to XY
        const meta = this.projectionsMeta.find((p) => p.name === this.selectedProjection);
        const is3D = meta?.metadata?.dimension === 3;
        const nextPlane: 'xy' | 'xz' | 'yz' = is3D ? this.projectionPlane : 'xy';
        if ('projectionPlane' in this._scatterplotElement) {
          (this._scatterplotElement as ScatterplotElementLike).projectionPlane = nextPlane;
        }
        this.projectionPlane = nextPlane;
      }
    }

    const customEvent = new CustomEvent('projection-change', {
      detail: { projection },
      bubbles: true,
      composed: true,
    });
    this.dispatchEvent(customEvent);
  }

  private handlePlaneChange(event: Event) {
    const target = event.target as HTMLSelectElement;
    const plane = target.value as 'xy' | 'xz' | 'yz';
    if (
      this.autoSync &&
      this._scatterplotElement &&
      'projectionPlane' in this._scatterplotElement
    ) {
      (this._scatterplotElement as ScatterplotElementLike).projectionPlane = plane;
      this.projectionPlane = plane;
    }
    const customEvent = new CustomEvent('projection-plane-change', {
      detail: { plane },
      bubbles: true,
      composed: true,
    });
    this.dispatchEvent(customEvent);
  }

  private handleAnnotationSelected(event: CustomEvent<{ annotation: string }>) {
    const annotation = event.detail.annotation;
    // If auto-sync is enabled, directly update the scatterplot
    if (this.autoSync && this._scatterplotElement) {
      if ('selectedAnnotation' in this._scatterplotElement) {
        (this._scatterplotElement as ScatterplotElementLike).selectedAnnotation = annotation;
        this.selectedAnnotation = annotation;
      }
    }

    const customEvent = new CustomEvent('annotation-change', {
      detail: { annotation },
      bubbles: true,
      composed: true,
    });
    this.dispatchEvent(customEvent);
  }

  private handleToggleSelectionMode() {
    // Compute and set the new selection mode locally first
    const newSelectionMode = !this.selectionMode;
    this.selectionMode = newSelectionMode;

    // If auto-sync is enabled, update the scatterplot BEFORE notifying listeners
    if (this.autoSync && this._scatterplotElement) {
      const scatterplot = this._scatterplotElement as ScatterplotElementLike;
      if (scatterplot.selectionMode !== undefined) {
        scatterplot.selectionMode = newSelectionMode;
      }
    }

    // Now dispatch the event with the updated state so listeners read the correct value
    const customEvent = new CustomEvent('toggle-selection-mode', {
      detail: { selectionMode: newSelectionMode },
      bubbles: true,
      composed: true,
    });
    this.dispatchEvent(customEvent);
  }

  private handleClearSelections() {
    const customEvent = new CustomEvent('clear-selections', {
      detail: {},
      bubbles: true,
      composed: true,
    });
    this.dispatchEvent(customEvent);

    // If auto-sync is enabled, directly clear selections in scatterplot
    if (this.autoSync && this._scatterplotElement) {
      if ('selectedProteinIds' in this._scatterplotElement) {
        (this._scatterplotElement as ScatterplotElementLike).selectedProteinIds = [];
        this.selectedProteinsCount = 0;
      }
    }

    // Clear search chips
    this.selectedIdsChips = [];

    // Dispatch a single, consistent event for all selection changes
    this.dispatchEvent(
      new CustomEvent('protein-selection-change', {
        detail: { proteinIds: [] },
        bubbles: true,
        composed: true,
      }),
    );
  }

  private handleSplitData() {
    const customEvent = new CustomEvent('isolate-data', {
      detail: {},
      bubbles: true,
      composed: true,
    });
    this.dispatchEvent(customEvent);

    if (this.autoSync && this._scatterplotElement) {
      const scatterplot = this._scatterplotElement as ScatterplotElementLike;
      scatterplot.isolateSelection?.();
    }
  }

  private handleResetSplit() {
    const customEvent = new CustomEvent('reset-isolation', {
      detail: {},
      bubbles: true,
      composed: true,
    });
    this.dispatchEvent(customEvent);

    if (this.autoSync && this._scatterplotElement) {
      const scatterplot = this._scatterplotElement as ScatterplotElementLike;
      scatterplot.resetIsolation?.();
      this.isolationMode = false;
      this.isolationHistory = [];
    }
  }

  private handleExport() {
    const customEvent = new CustomEvent('export', {
      detail: {
        type: this.exportFormat,
        imageWidth: this.exportImageWidth,
        imageHeight: this.exportImageHeight,
        legendWidthPercent: this.exportLegendWidthPercent,
        legendFontSizePx: this.exportLegendFontSizePx,
      },
      bubbles: true,
      composed: true,
    });
    this.dispatchEvent(customEvent);
    this.showExportMenu = false;
  }

  private toggleExportMenu() {
    this.showExportMenu = !this.showExportMenu;
  }

  private resetExportSettings() {
    const defaults = ProtspaceControlBar.EXPORT_DEFAULTS;
    this.exportImageWidth = defaults.IMAGE_WIDTH;
    this.exportImageHeight = defaults.IMAGE_HEIGHT;
    this.exportLegendWidthPercent = defaults.LEGEND_WIDTH_PERCENT;
    this.exportLegendFontSizePx = defaults.LEGEND_FONT_SIZE_PX;
    this.exportLockAspectRatio = defaults.LOCK_ASPECT_RATIO;
  }

  private handleWidthChange(newWidth: number) {
    const oldWidth = this.exportImageWidth;
    this.exportImageWidth = newWidth;

    // Adjust height proportionally if aspect ratio is locked
    if (this.exportLockAspectRatio && oldWidth > 0) {
      const ratio = newWidth / oldWidth;
      this.exportImageHeight = Math.round(this.exportImageHeight * ratio);
    }
  }

  private handleHeightChange(newHeight: number) {
    const oldHeight = this.exportImageHeight;
    this.exportImageHeight = newHeight;

    // Adjust width proportionally if aspect ratio is locked
    if (this.exportLockAspectRatio && oldHeight > 0) {
      const ratio = newHeight / oldHeight;
      this.exportImageWidth = Math.round(this.exportImageWidth * ratio);
    }
  }

  private openFileDialog() {
    const loader = document.querySelector('protspace-data-loader') as DataLoaderElement;
    const fileInput = loader?.shadowRoot?.querySelector(
      'input[type="file"]',
    ) as HTMLInputElement | null;
    fileInput?.click();
  }

  render() {
    return html`
      <div class="control-bar">
        <!-- Left side controls -->
        <div class="left-controls">
          <!-- Projection selection -->
          <div class="control-group">
            <label for="projection-trigger">Projection:</label>
            <div class="projection-container">
              <button
                id="projection-trigger"
                class="dropdown-trigger ${this.showProjectionMenu ? 'open' : ''}"
                @click=${this.toggleProjectionMenu}
                aria-haspopup="listbox"
                aria-expanded=${this.showProjectionMenu}
              >
                <span class="dropdown-trigger-text">
                  ${this.selectedProjection || 'Select projection'}
                </span>
                <svg class="chevron-down" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              ${this.showProjectionMenu
                ? html`
                    <div class="dropdown-menu align-left" role="listbox">
                      <div class="dropdown-list">
                        ${this.projections.map(
                          (projection) => html`
                            <div
                              class="dropdown-item ${projection === this.selectedProjection
                                ? 'selected'
                                : ''}"
                              role="option"
                              aria-selected=${projection === this.selectedProjection}
                              @click=${() => this.selectProjection(projection)}
                            >
                              ${projection}
                            </div>
                          `,
                        )}
                      </div>
                    </div>
                  `
                : ''}
            </div>
          </div>

          ${(() => {
            const meta = this.projectionsMeta.find((p) => p.name === this.selectedProjection);
            const is3D = meta?.metadata?.dimension === 3;
            return is3D
              ? html`
                  <div class="control-group">
                    <label for="plane-select">Plane:</label>
                    <select
                      id="plane-select"
                      .value=${this.projectionPlane}
                      @change=${this.handlePlaneChange}
                    >
                      <option value="xy">XY</option>
                      <option value="xz">XZ</option>
                      <option value="yz">YZ</option>
                    </select>
                  </div>
                `
              : null;
          })()}

          <!-- Annotation selection -->
          <div class="control-group">
            <label for="annotation-select">Annotation:</label>
            <protspace-annotation-select
              id="annotation-select"
              .annotations=${this.annotations}
              .selectedAnnotation=${this.selectedAnnotation}
              @annotation-select=${this.handleAnnotationSelected}
            ></protspace-annotation-select>
          </div>
        </div>

        <!-- Search selection -->
        <div class="control-group search-group">
          <protspace-protein-search
            .availableProteinIds=${this.allProteinIds}
            .selectedProteinIds=${this.selectedIdsChips}
            @selection-change=${this._handleSearchSelectionChange}
            @add-selection=${this._handleSearchSelectionAdd}
            @add-selection-multiple=${this._handleSearchSelectionAddMultiple}
          ></protspace-protein-search>
        </div>

        <!-- Right side controls -->
        <div class="right-controls">
          <!-- Selection mode toggle -->

          <button
            class=${this.selectionMode
              ? 'right-controls-button right-controls-select active'
              : 'right-controls-select right-controls-button'}
            ?disabled=${this._selectionDisabled}
            @click=${this.handleToggleSelectionMode}
            title=${this._selectionDisabled
              ? 'Selection disabled: Insufficient data points'
              : 'Select proteins by clicking or dragging to enclose multiple points'}
          >
            <svg class="icon" viewBox="0 0 24 24">
              <rect
                x="3"
                y="3"
                width="18"
                height="18"
                rx="1"
                stroke="currentColor"
                stroke-dasharray="2 1"
                fill="none"
              />
              <circle cx="8" cy="8" r="1.5" fill="currentColor" />
              <circle cx="12" cy="14" r="1.5" fill="currentColor" />
              <circle cx="16" cy="10" r="1.5" fill="currentColor" />
              <circle cx="7" cy="16" r="1.5" fill="currentColor" />
              <circle cx="17" cy="17" r="1.5" fill="currentColor" />
            </svg>
            Select
          </button>

          <!-- Clear selections button -->
          <button
            class="right-controls-button right-controls-clear"
            ?disabled=${this.selectedProteinsCount === 0}
            @click=${this.handleClearSelections}
            title="Clear all selected proteins"
          >
            <svg class="icon" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
            Clear
          </button>

          <!-- Isolate data button -->
          <button
            class="right-controls-button right-controls-split"
            ?disabled=${this.selectedProteinsCount === 0}
            @click=${this.handleSplitData}
            title="Isolate selected proteins to focus on them"
          >
            <svg class="icon" viewBox="0 0 24 24">
              <circle cx="12" cy="12" r="2" fill="currentColor" />
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="1.5"
                d="M12 1v5m0 12v5M3.93 3.93l3.54 3.54m9.06 9.06l3.54 3.54M1 12h5m12 0h5M3.93 20.07l3.54-3.54m9.06-9.06l3.54-3.54"
                opacity="0.6"
              />
            </svg>
            Isolate
          </button>

          <!-- Reset split button -->
          ${this.isolationMode
            ? html`
                <button
                  @click=${this.handleResetSplit}
                  title="Reset to original dataset"
                  class="active"
                >
                  <svg class="icon" viewBox="0 0 24 24">
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0V9a8.002 8.002 0 0115.356 2m-15.356-2L4 4m15.356 6l2.5-2.5"
                    />
                  </svg>
                  Reset
                </button>
              `
            : ''}

          <!-- Filter dropdown -->
          <div class="filter-container right-controls-filter">
            <button
              class="dropdown-trigger ${this.showFilterMenu ? 'open' : ''}"
              @click=${this.toggleFilterMenu}
              title="Filter Options"
            >
              <svg class="icon" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" d="M3 5h18M6 12h12M10 19h4" />
              </svg>
              Filter
              <svg class="chevron-down" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            ${this.showFilterMenu
              ? html`
                  <div class="filter-menu">
                    <ul class="filter-menu-list">
                      ${this.annotations.map((annotation) => {
                        const cfg = this.filterConfig[annotation] || {
                          enabled: false,
                          values: [],
                        };
                        const values = this.annotationValuesMap[annotation] || [];
                        return html` <li class="filter-menu-list-item">
                          <label
                            >${annotation}
                            <input
                              type="checkbox"
                              .checked=${cfg.enabled}
                              @change=${(e: Event) => {
                                const target = e.target as HTMLInputElement;
                                this.handleFilterToggle(annotation, target.checked);
                              }}
                            />
                          </label>
                          <button
                            ?disabled=${!cfg.enabled}
                            @click=${() => this.toggleValueMenu(annotation)}
                          >
                            ${cfg.values && cfg.values.length > 0
                              ? `${cfg.values.length} selected`
                              : 'Select values'}
                            <svg
                              class="chevron-down"
                              viewBox="0 0 24 24"
                              style="vertical-align: middle;"
                            >
                              <path
                                stroke-linecap="round"
                                stroke-linejoin="round"
                                d="M19 9l-7 7-7-7"
                              />
                            </svg>
                          </button>
                          ${this.openValueMenus[annotation] && cfg.enabled
                            ? html`
                                <div class="filter-menu-list-item-options">
                                  <div class="filter-menu-list-item-options-selection">
                                    <button @click=${() => this.selectAllValues(annotation)}>
                                      Select all
                                    </button>
                                    <button @click=${() => this.clearAllValues(annotation)}>
                                      None
                                    </button>
                                  </div>
                                  <div class="filter-menu-list-item-options-inputs">
                                    ${values.some((v) => v === LEGEND_VALUES.NA_VALUE)
                                      ? html`
                                          <label>
                                            <input
                                              type="checkbox"
                                              .checked=${(cfg.values || []).includes(
                                                LEGEND_VALUES.NA_VALUE,
                                              )}
                                              @change=${(e: Event) =>
                                                this.handleValueToggle(
                                                  annotation,
                                                  LEGEND_VALUES.NA_VALUE,
                                                  (e.target as HTMLInputElement).checked,
                                                )}
                                            />
                                            <span>${LEGEND_VALUES.NA_DISPLAY}</span>
                                          </label>
                                        `
                                      : ''}
                                    ${Array.from(
                                      new Set(values.filter((v) => v !== LEGEND_VALUES.NA_VALUE)),
                                    ).map(
                                      (v) => html`
                                        <label>
                                          <input
                                            type="checkbox"
                                            .checked=${(cfg.values || []).includes(String(v))}
                                            @change=${(e: Event) =>
                                              this.handleValueToggle(
                                                annotation,
                                                String(v),
                                                (e.target as HTMLInputElement).checked,
                                              )}
                                          />
                                          <span>${String(v)}</span>
                                        </label>
                                      `,
                                    )}
                                  </div>
                                  <div class="filter-menu-list-item-options-done">
                                    <button
                                      class="active"
                                      @click=${() => this.toggleValueMenu(annotation)}
                                    >
                                      Done
                                    </button>
                                  </div>
                                </div>
                              `
                            : ''}
                        </li>`;
                      })}
                    </ul>
                    <div class="filter-menu-buttons">
                      <button
                        @click=${() => {
                          this.showFilterMenu = false;
                        }}
                      >
                        Cancel
                      </button>
                      <button @click=${this.applyFilters} class="active">Apply</button>
                    </div>
                  </div>
                `
              : ''}
          </div>

          <!-- Export dropdown -->
          <div class="export-container right-controls-export">
            <button
              class="dropdown-trigger ${this.showExportMenu ? 'open' : ''}"
              @click=${this.toggleExportMenu}
              title="Export Options"
            >
              <svg class="icon" viewBox="0 0 24 24">
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                />
              </svg>
              Export
              <svg class="chevron-down" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            ${this.showExportMenu
              ? html`
                  <div class="export-menu">
                    <div class="export-menu-header">
                      <span>Export Options</span>
                    </div>

                    <div class="export-menu-content">
                      <!-- Format Selection -->
                      <div class="export-option-group">
                        <label class="export-option-label">Format</label>
                        <div class="export-format-options">
                          <button
                            class="export-format-btn ${this.exportFormat === 'png' ? 'active' : ''}"
                            @click=${() => {
                              this.exportFormat = 'png';
                            }}
                            title="Export as PNG image"
                          >
                            PNG
                          </button>
                          <button
                            class="export-format-btn ${this.exportFormat === 'pdf' ? 'active' : ''}"
                            @click=${() => {
                              this.exportFormat = 'pdf';
                            }}
                            title="Export as PDF document"
                          >
                            PDF
                          </button>
                          <button
                            class="export-format-btn ${this.exportFormat === 'json'
                              ? 'active'
                              : ''}"
                            @click=${() => {
                              this.exportFormat = 'json';
                            }}
                            title="Export as JSON data"
                          >
                            JSON
                          </button>
                          <button
                            class="export-format-btn ${this.exportFormat === 'ids' ? 'active' : ''}"
                            @click=${() => {
                              this.exportFormat = 'ids';
                            }}
                            title="Export protein IDs list"
                          >
                            IDs
                          </button>
                        </div>
                      </div>

                      <!-- Image Settings (for PNG/PDF only) -->
                      ${this.exportFormat === 'png' || this.exportFormat === 'pdf'
                        ? html`
                            <div class="export-dimensions-group">
                              <div class="export-option-group">
                                <label class="export-option-label" for="export-width">
                                  Width
                                  <span class="export-option-value"
                                    >${this.exportImageWidth}px</span
                                  >
                                </label>
                                <input
                                  type="range"
                                  id="export-width"
                                  class="export-slider"
                                  min="800"
                                  max="8192"
                                  step="128"
                                  .value=${String(this.exportImageWidth)}
                                  @input=${(e: Event) => {
                                    this.handleWidthChange(
                                      parseInt((e.target as HTMLInputElement).value),
                                    );
                                  }}
                                />
                                <div class="export-slider-labels">
                                  <span>800px</span>
                                  <span>8192px</span>
                                </div>
                              </div>

                              <div class="export-option-group">
                                <label class="export-option-label" for="export-height">
                                  Height
                                  <span class="export-option-value"
                                    >${this.exportImageHeight}px</span
                                  >
                                </label>
                                <input
                                  type="range"
                                  id="export-height"
                                  class="export-slider"
                                  min="600"
                                  max="8192"
                                  step="128"
                                  .value=${String(this.exportImageHeight)}
                                  @input=${(e: Event) => {
                                    this.handleHeightChange(
                                      parseInt((e.target as HTMLInputElement).value),
                                    );
                                  }}
                                />
                                <div class="export-slider-labels">
                                  <span>600px</span>
                                  <span>8192px</span>
                                </div>
                              </div>

                              <label class="export-aspect-lock">
                                <input
                                  type="checkbox"
                                  .checked=${this.exportLockAspectRatio}
                                  @change=${(e: Event) => {
                                    this.exportLockAspectRatio = (
                                      e.target as HTMLInputElement
                                    ).checked;
                                  }}
                                />
                                Lock aspect ratio
                              </label>
                            </div>

                            <div class="export-option-group">
                              <label class="export-option-label" for="export-legend-width">
                                Legend Width
                                <span class="export-option-value"
                                  >${this.exportLegendWidthPercent}%</span
                                >
                              </label>
                              <input
                                type="range"
                                id="export-legend-width"
                                class="export-slider"
                                min="15"
                                max="50"
                                step="5"
                                .value=${String(this.exportLegendWidthPercent)}
                                @input=${(e: Event) => {
                                  this.exportLegendWidthPercent = parseInt(
                                    (e.target as HTMLInputElement).value,
                                  );
                                }}
                              />
                              <div class="export-slider-labels">
                                <span>15%</span>
                                <span>50%</span>
                              </div>
                            </div>

                            <div class="export-option-group">
                              <label class="export-option-label" for="export-legend-font">
                                Legend Font
                                <span class="export-option-value"
                                  >${this.exportLegendFontSizePx}px</span
                                >
                              </label>
                              <input
                                type="range"
                                id="export-legend-font"
                                class="export-slider"
                                min="12"
                                max="120"
                                step="2"
                                .value=${String(this.exportLegendFontSizePx)}
                                @input=${(e: Event) => {
                                  this.exportLegendFontSizePx = parseInt(
                                    (e.target as HTMLInputElement).value,
                                  );
                                }}
                              />
                              <div class="export-slider-labels">
                                <span>12px</span>
                                <span>120px</span>
                              </div>
                            </div>

                            <div class="export-actions">
                              <button class="export-reset-btn" @click=${this.resetExportSettings}>
                                Reset
                              </button>
                              <button class="export-action-btn active" @click=${this.handleExport}>
                                <svg class="icon" viewBox="0 0 24 24">
                                  <path
                                    stroke-linecap="round"
                                    stroke-linejoin="round"
                                    d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                                  />
                                </svg>
                                Export
                              </button>
                            </div>
                          `
                        : html`
                            <button class="export-action-btn" @click=${this.handleExport}>
                              <svg class="icon" viewBox="0 0 24 24">
                                <path
                                  stroke-linecap="round"
                                  stroke-linejoin="round"
                                  d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                                />
                              </svg>
                              Export ${this.exportFormat.toUpperCase()}
                            </button>
                          `}
                    </div>
                  </div>
                `
              : ''}
          </div>
          <div class="export-container right-controls-data">
            <button @click=${this.openFileDialog} title="Import Data">
              <svg class="icon" viewBox="0 0 24 24">
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L9 8m3-4v12"
                />
              </svg>
              Import
            </button>
          </div>
        </div>
      </div>
    `;
  }

  // Close export menu when clicking outside
  connectedCallback() {
    super.connectedCallback();
    document.addEventListener('click', this._onDocumentClick);
    document.addEventListener('keydown', this._onDocumentKeydown);

    if (this.autoSync) {
      this._setupAutoSync();
    }
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    document.removeEventListener('click', this._onDocumentClick);
    document.removeEventListener('keydown', this._onDocumentKeydown);

    if (this._scatterplotElement) {
      this._scatterplotElement.removeEventListener('data-change', this._onDataChange);
      this._scatterplotElement.removeEventListener('protein-click', this._onProteinClick);
      this._scatterplotElement.removeEventListener('brush-selection', this._onBrushSelection);
      this._scatterplotElement.removeEventListener('data-isolation', this._onDataIsolation);
      this._scatterplotElement.removeEventListener(
        'data-isolation-reset',
        this._onDataIsolationReset,
      );
      this._scatterplotElement.removeEventListener(
        'auto-disable-selection',
        this._onAutoDisableSelection,
      );
    }
  }

  private handleDocumentKeydown(event: KeyboardEvent) {
    const path = event.composedPath?.() ?? [];
    const inAriaModal = path.some(
      (n) => n instanceof HTMLElement && n.getAttribute('aria-modal') === 'true',
    );
    if (inAriaModal) return;

    if (event.key === 'Escape') {
      if (this.selectedProteinsCount > 0) {
        event.preventDefault();
        event.stopPropagation();
        this.handleClearSelections();
      } else if (this.selectionMode) {
        event.preventDefault();
        event.stopPropagation();
        this.handleToggleSelectionMode();
      }
    }
  }

  private handleDocumentClick(event: Event) {
    if (!this.contains(event.target as Node)) {
      this.showExportMenu = false;
      this.showFilterMenu = false;
      this.showProjectionMenu = false;
      this.openValueMenus = {};
    }
  }

  private _setupAutoSync() {
    // Find scatterplot element with retries
    const trySetup = (attempts: number = 0) => {
      this._scatterplotElement = document.querySelector(
        this.scatterplotSelector,
      ) as ScatterplotElementLike | null;

      if (this._scatterplotElement) {
        // Listen for data changes
        this._scatterplotElement.addEventListener('data-change', this._onDataChange);

        // Listen for protein selection changes
        this._scatterplotElement.addEventListener('protein-click', this._onProteinClick);

        // Listen for brush selection events
        this._scatterplotElement.addEventListener('brush-selection', this._onBrushSelection);

        // Listen for data isolation events
        this._scatterplotElement.addEventListener('data-isolation', this._onDataIsolation);

        this._scatterplotElement.addEventListener(
          'data-isolation-reset',
          this._onDataIsolationReset,
        );

        this._scatterplotElement.addEventListener(
          'auto-disable-selection',
          this._onAutoDisableSelection,
        );

        // Initial sync after a short delay to ensure scatterplot is ready
        setTimeout(() => {
          this._syncWithScatterplot();
        }, 50);
      } else if (attempts < 10) {
        // Retry up to 10 times with increasing delay
        setTimeout(() => trySetup(attempts + 1), 100 + attempts * 50);
      } else {
        console.warn(
          '❌ Control bar could not find scatterplot element:',
          this.scatterplotSelector,
        );
      }
    };

    trySetup();
  }

  private _handleDataChange(event: Event) {
    const { data } = (event as CustomEvent<DataChangeDetail>).detail || {};
    if (!data) return;

    this._updateOptionsFromData(data);

    // Update protein ids for search
    try {
      const ids = data.protein_ids;
      this.allProteinIds = Array.isArray(ids) ? ids : [];
      // Keep chips in sync with scatterplot's selection if available
      if (this._scatterplotElement && 'selectedProteinIds' in this._scatterplotElement) {
        const current = (this._scatterplotElement as ScatterplotElementLike).selectedProteinIds;
        this.selectedIdsChips = Array.isArray(current) ? current : [];
        this.selectedProteinsCount = this.selectedIdsChips.length;
      }
    } catch (e) {
      console.error(e);
    }
    // Update annotation value options for filter UI
    try {
      const annotations = data.annotations || {};
      const map: Record<string, string[]> = {};
      Object.keys(annotations).forEach((k) => {
        const vals = annotations[k]?.values as (string | null)[] | undefined;
        if (Array.isArray(vals)) {
          // Normalize values to internal format (N/A values become '__NA__')
          map[k] = vals.map(toInternalValue);
        }
      });
      this.annotationValuesMap = map;
      // Initialize filter config entries for new annotations (preserve existing selections)
      const nextConfig: typeof this.filterConfig = { ...this.filterConfig };
      Object.keys(map).forEach((k) => {
        if (!nextConfig[k]) nextConfig[k] = { enabled: false, values: [] };
      });
      this.filterConfig = nextConfig;
    } catch (e) {
      console.error(e);
    }
    this.requestUpdate();
  }

  private _handleProteinSelection(event: Event) {
    const customEvent = event as CustomEvent<{
      proteinId: string;
      modifierKeys: { ctrl: boolean; meta: boolean; shift: boolean };
    }>;
    const { proteinId, modifierKeys } = customEvent.detail;
    if (!proteinId) return;
    const currentSelection = new Set(this.selectedIdsChips);
    const isCurrentlySelected = currentSelection.has(proteinId);
    let newSelection: string[];

    // Toggle mode: When selectionMode is active OR modifier keys are pressed
    if (this.selectionMode || modifierKeys.ctrl || modifierKeys.meta) {
      if (isCurrentlySelected) {
        currentSelection.delete(proteinId);
      } else {
        currentSelection.add(proteinId);
      }
      newSelection = Array.from(currentSelection);
    }
    // Replace mode: No modifier keys and selectionMode inactive
    else {
      if (isCurrentlySelected && currentSelection.size === 1) {
        newSelection = [];
      } else {
        newSelection = [proteinId];
      }
    }
    this.selectedIdsChips = newSelection;
    this.selectedProteinsCount = newSelection.length;
    if (
      this.autoSync &&
      this._scatterplotElement &&
      'selectedProteinIds' in this._scatterplotElement
    ) {
      (this._scatterplotElement as ScatterplotElementLike).selectedProteinIds = [...newSelection];
    }
    this.dispatchEvent(
      new CustomEvent('protein-selection-change', {
        detail: { proteinIds: newSelection.slice() },
        bubbles: true,
        composed: true,
      }),
    );
    this.requestUpdate();
  }

  private _handleDataIsolation(event: Event) {
    const customEvent = event as CustomEvent;
    const { isolationHistory, isolationMode } = customEvent.detail;
    this.isolationHistory = isolationHistory;
    this.isolationMode = isolationMode;
    this.selectedProteinsCount = 0;
    this.selectedIdsChips = [];
    this.requestUpdate();
  }

  private _handleDataIsolationReset(event: Event) {
    const customEvent = event as CustomEvent;
    const { isolationHistory, isolationMode } = customEvent.detail;
    this.isolationHistory = isolationHistory;
    this.isolationMode = isolationMode;
    this.selectedProteinsCount = 0;
    this.selectedIdsChips = [];

    // Re-enable selection when isolation is reset (back to full data)
    this._selectionDisabled = false;

    this.requestUpdate();
  }

  private _handleAutoDisableSelection(event: Event) {
    const customEvent = event as CustomEvent;
    const { reason, dataSize } = customEvent.detail;

    // Handle the business logic
    this.selectionMode = false;

    // Disable the selection mode toggle when insufficient data
    if (reason === 'insufficient-data' && dataSize <= 1) {
      this._selectionDisabled = true;
    }

    this.requestUpdate();

    // Dispatch a separate notification event for the UI layer to handle
    // This separates business logic from presentation concerns
    const message =
      reason === 'insufficient-data'
        ? `Selection mode disabled: Only ${dataSize} point${dataSize !== 1 ? 's' : ''} remaining`
        : 'Selection mode disabled';

    this.dispatchEvent(
      new CustomEvent('selection-disabled-notification', {
        detail: {
          reason,
          dataSize,
          message,
          type: 'warning',
        },
        bubbles: true,
        composed: true,
      }),
    );
  }

  private _updateOptionsFromData(data: ProtspaceData) {
    // Update projections and annotations
    this.projectionsMeta = data.projections || [];
    this.projections = this.projectionsMeta.map((p) => p.name) || [];
    this.annotations = Object.keys(data.annotations || {});

    // Default selections if invalid
    if (!this.selectedProjection || !this.projections.includes(this.selectedProjection)) {
      this.selectedProjection = this.projections[0] || '';
    }
    if (!this.selectedAnnotation || !this.annotations.includes(this.selectedAnnotation)) {
      this.selectedAnnotation = this.annotations[0] || '';
    }
  }

  private _syncWithScatterplot() {
    if (this._scatterplotElement && 'getCurrentData' in this._scatterplotElement) {
      const scatterplot = this._scatterplotElement as ScatterplotElementLike;
      let data: ProtspaceData | undefined;
      data = scatterplot.getCurrentData?.();

      if (data) {
        // Extract projections and annotations
        this._updateOptionsFromData(data);

        // Build annotation values map for filter UI
        try {
          const annotations = data.annotations || {};
          const map: Record<string, string[]> = {};
          Object.keys(annotations).forEach((k) => {
            const vals = annotations[k]?.values as (string | null)[] | undefined;
            if (Array.isArray(vals)) {
              // Normalize values to internal format (N/A values become '__NA__')
              map[k] = vals.map(toInternalValue);
            }
          });
          this.annotationValuesMap = map;
          const nextConfig: typeof this.filterConfig = { ...this.filterConfig };
          Object.keys(map).forEach((k) => {
            if (!nextConfig[k]) nextConfig[k] = { enabled: false, values: [] };
          });
          this.filterConfig = nextConfig;
        } catch (e) {
          console.error(e);
        }

        // Sync current values from scatterplot
        if (scatterplot.selectedAnnotation !== undefined) {
          // Only use the scatterplot's selected annotation if it's still available
          const scatterplotAnnotation = scatterplot.selectedAnnotation;
          if (scatterplotAnnotation && this.annotations.includes(scatterplotAnnotation)) {
            this.selectedAnnotation = scatterplotAnnotation;
          } else {
            this.selectedAnnotation = this.annotations[0] || '';
          }
        }

        if ('selectedProjectionIndex' in scatterplot) {
          const projIndex = scatterplot.selectedProjectionIndex as number | undefined;
          if (
            typeof projIndex === 'number' &&
            projIndex >= 0 &&
            projIndex < this.projections.length
          ) {
            this.selectedProjection = this.projections[projIndex];
          }
        }

        if ('selectionMode' in scatterplot) {
          this.selectionMode = Boolean(scatterplot.selectionMode);
        }

        if ('selectedProteinIds' in scatterplot) {
          this.selectedProteinsCount = ((scatterplot.selectedProteinIds as unknown[]) || []).length;
          this.selectedIdsChips = Array.isArray(scatterplot.selectedProteinIds)
            ? (scatterplot.selectedProteinIds as string[])
            : [];
        }

        this.isolationMode = scatterplot.isIsolationMode?.() ?? false;
        this.isolationHistory = scatterplot.getIsolationHistory?.() ?? [];

        // Set defaults if not already set
        if (!this.selectedProjection && this.projections.length > 0) {
          this.selectedProjection = this.projections[0];
        }
        if (!this.selectedAnnotation && this.annotations.length > 0) {
          this.selectedAnnotation = this.annotations[0];
        }

        this.requestUpdate();
      }
    }
  }

  // Search selection handler
  private _handleSearchSelectionChange(event: CustomEvent<{ proteinIds: string[] }>) {
    // This handles programmatic changes and clearing from within the search component
    const newSelection = event.detail.proteinIds;
    this.selectedIdsChips = newSelection;
    this.selectedProteinsCount = newSelection.length;
    if (
      this.autoSync &&
      this._scatterplotElement &&
      'selectedProteinIds' in this._scatterplotElement
    ) {
      (this._scatterplotElement as ScatterplotElementLike).selectedProteinIds = [...newSelection];
    }
    this.dispatchEvent(
      new CustomEvent('protein-selection-change', {
        detail: { proteinIds: newSelection.slice() },
        bubbles: true,
        composed: true,
      }),
    );
  }

  private _handleSearchSelectionAdd(event: CustomEvent<{ proteinId: string }>) {
    const { proteinId } = event.detail;
    if (!proteinId || this.selectedIdsChips.includes(proteinId)) return;

    const newSelection = [...this.selectedIdsChips, proteinId];
    this.selectedIdsChips = newSelection;
    this.selectedProteinsCount = newSelection.length;

    if (
      this.autoSync &&
      this._scatterplotElement &&
      'selectedProteinIds' in this._scatterplotElement
    ) {
      (this._scatterplotElement as ScatterplotElementLike).selectedProteinIds = [...newSelection];
    }

    const viewers = Array.from(
      document.querySelectorAll('protspace-structure-viewer'),
    ) as StructureViewerElement[];
    viewers.forEach((v) => v?.loadProtein?.(proteinId));

    this.dispatchEvent(
      new CustomEvent('protein-selection-change', {
        detail: { proteinIds: newSelection.slice() },
        bubbles: true,
        composed: true,
      }),
    );
  }

  private _handleSearchSelectionAddMultiple(event: CustomEvent<{ proteinIds: string[] }>) {
    const { proteinIds } = event.detail;
    if (!proteinIds || proteinIds.length === 0) return;

    const currentSelectedSet = new Set(this.selectedIdsChips);
    const newUniqueIds = proteinIds.filter((id) => !currentSelectedSet.has(id));

    if (newUniqueIds.length === 0) return;

    const newSelection = [...this.selectedIdsChips, ...newUniqueIds];
    this.selectedIdsChips = newSelection;
    this.selectedProteinsCount = newSelection.length;

    if (
      this.autoSync &&
      this._scatterplotElement &&
      'selectedProteinIds' in this._scatterplotElement
    ) {
      (this._scatterplotElement as ScatterplotElementLike).selectedProteinIds = [...newSelection];
    }

    const lastAddedId = newUniqueIds[newUniqueIds.length - 1];
    const viewers = Array.from(
      document.querySelectorAll('protspace-structure-viewer'),
    ) as StructureViewerElement[];
    viewers.forEach((v) => v?.loadProtein?.(lastAddedId));

    this.dispatchEvent(
      new CustomEvent('protein-selection-change', {
        detail: { proteinIds: newSelection.slice() },
        bubbles: true,
        composed: true,
      }),
    );
  }

  private _handleBrushSelection(event: Event) {
    const customEvent = event as CustomEvent<{ proteinIds: string[]; isMultiple: boolean }>;
    const ids = Array.isArray(customEvent.detail?.proteinIds) ? customEvent.detail.proteinIds : [];

    let newSelection: string[];
    // When selectionMode is active, append brushed selections to existing selection
    if (this.selectionMode) {
      const currentSelection = new Set(this.selectedIdsChips);
      ids.forEach((id) => currentSelection.add(id));
      newSelection = Array.from(currentSelection);
    }
    // When selectionMode is inactive, replace the selection
    else {
      newSelection = ids.slice();
    }

    this.selectedIdsChips = newSelection;
    this.selectedProteinsCount = newSelection.length;

    // Sync with scatterplot if auto-sync is enabled
    if (
      this.autoSync &&
      this._scatterplotElement &&
      'selectedProteinIds' in this._scatterplotElement
    ) {
      (this._scatterplotElement as ScatterplotElementLike).selectedProteinIds = [...newSelection];
    }

    // Dispatch a single, consistent event for all selection changes
    this.dispatchEvent(
      new CustomEvent('protein-selection-change', {
        detail: { proteinIds: newSelection.slice() },
        bubbles: true,
        composed: true,
      }),
    );
  }

  private toggleFilterMenu() {
    const opening = !this.showFilterMenu;
    this.showFilterMenu = opening;
    if (opening) {
      // Restore last applied configuration if available
      if (this.lastAppliedFilterConfig && Object.keys(this.lastAppliedFilterConfig).length > 0) {
        const merged: typeof this.filterConfig = { ...this.filterConfig };
        for (const key of Object.keys(this.lastAppliedFilterConfig)) {
          const prev = merged[key] || { enabled: false, values: [] };
          const applied = this.lastAppliedFilterConfig[key];
          merged[key] = { ...prev, ...applied };
        }
        this.filterConfig = merged;
        this.openValueMenus = {};
      }
    }
  }

  private handleFilterToggle(annotation: string, enabled: boolean) {
    const current = this.filterConfig[annotation] || {
      enabled: false,
      values: [],
    };
    this.filterConfig = {
      ...this.filterConfig,
      [annotation]: { ...current, enabled },
    };
    if (!enabled) this.openValueMenus = { ...this.openValueMenus, [annotation]: false };
  }

  private toggleValueMenu(annotation: string) {
    this.openValueMenus = {
      ...this.openValueMenus,
      [annotation]: !this.openValueMenus[annotation],
    };
  }

  private handleValueToggle(annotation: string, value: string, checked: boolean) {
    const current = this.filterConfig[annotation] || {
      enabled: false,
      values: [],
    };
    const next = new Set(current.values || []);
    if (checked) next.add(value);
    else next.delete(value);
    this.filterConfig = {
      ...this.filterConfig,
      [annotation]: { ...current, values: Array.from(next) },
    };
  }

  private selectAllValues(annotation: string) {
    const all = this.annotationValuesMap[annotation] || [];
    const current = this.filterConfig[annotation] || {
      enabled: false,
      values: [],
    };
    this.filterConfig = {
      ...this.filterConfig,
      [annotation]: { ...current, values: Array.from(new Set(all)) },
    };
  }

  private clearAllValues(annotation: string) {
    const current = this.filterConfig[annotation] || {
      enabled: false,
      values: [],
    };
    this.filterConfig = {
      ...this.filterConfig,
      [annotation]: { ...current, values: [] },
    };
  }

  private applyFilters() {
    if (!this._scatterplotElement || !('getCurrentData' in this._scatterplotElement)) {
      return;
    }
    const sp = this._scatterplotElement as ScatterplotElementLike;
    const data = sp.getCurrentData?.();
    if (!data) return;

    // Collect active filters
    const activeFilters = Object.entries(this.filterConfig)
      .filter(([, cfg]) => cfg.enabled && Array.isArray(cfg.values) && cfg.values.length > 0)
      .map(([annotation, cfg]) => ({
        annotation,
        values: cfg.values,
      }));

    if (activeFilters.length === 0) {
      this.showFilterMenu = false;
      return;
    }

    // Compute membership for each protein
    const numProteins: number = Array.isArray(data.protein_ids) ? data.protein_ids.length : 0;
    const indices: number[] = new Array(numProteins);

    for (let i = 0; i < numProteins; i++) {
      let isMatch = true;
      for (const { annotation, values } of activeFilters) {
        const annotationIdxData = data.annotation_data?.[annotation];
        const valuesArr: (string | null)[] | undefined = data.annotations?.[annotation]?.values;
        if (!annotationIdxData || !valuesArr) {
          isMatch = false;
          break;
        }
        // Handle both number[] and number[][] formats
        const annotationValue = Array.isArray(annotationIdxData[i])
          ? (annotationIdxData[i] as number[])[0]
          : (annotationIdxData as number[])[i];
        const rawValue =
          annotationValue != null && annotationValue >= 0 && annotationValue < valuesArr.length
            ? valuesArr[annotationValue]
            : null;
        // Normalize raw value to internal format for comparison
        const normalizedValue = toInternalValue(rawValue);
        if (!values.some((allowed) => allowed === normalizedValue)) {
          isMatch = false;
          break;
        }
      }
      // 0 => Filtered Proteins, 1 => Other Proteins
      indices[i] = isMatch ? 0 : 1;
    }

    // Add or replace synthetic Custom annotation
    const customName = 'Custom';
    const newAnnotations: Record<
      string,
      { values: (string | null)[]; colors?: string[]; shapes?: string[] }
    > = {
      ...data.annotations,
    };
    newAnnotations[customName] = {
      values: ['Filtered Proteins', 'Other Proteins'],
      colors: ['#00A35A', '#9AA0A6'],
      shapes: ['circle', 'circle'],
    };
    const newAnnotationData = { ...data.annotation_data, [customName]: indices };

    const newData = {
      ...data,
      annotations: newAnnotations,
      annotation_data: newAnnotationData,
    };

    this.lastAppliedFilterConfig = JSON.parse(JSON.stringify(this.filterConfig));

    // Apply to scatterplot and select the Custom annotation
    sp.data = newData;
    if ('selectedAnnotation' in sp) sp.selectedAnnotation = customName;
    this.annotations = Object.keys(newData.annotations || {});
    this.selectedAnnotation = customName;
    this.annotationValuesMap = {
      ...this.annotationValuesMap,
      [customName]: newAnnotations[customName].values.map(toInternalValue),
    };
    // Annotation select component will automatically update via selectedAnnotation property binding

    // Let listeners know the annotation changed to Custom
    this.dispatchEvent(
      new CustomEvent('annotation-change', {
        detail: { annotation: customName },
        bubbles: true,
        composed: true,
      }),
    );

    this.showFilterMenu = false;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'protspace-control-bar': ProtspaceControlBar;
  }
}
