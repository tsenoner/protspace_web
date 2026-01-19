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
import { handleDropdownEscape, isAnyDropdownOpen } from '../../utils/dropdown-helpers';
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
  @state() private projectionHighlightIndex: number = -1;
  @state() private filterHighlightIndex: number = -1;

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

  private toggleProjectionMenu(event?: Event) {
    event?.stopPropagation();
    this.showProjectionMenu = !this.showProjectionMenu;
    if (this.showProjectionMenu) {
      // Close other dropdowns when opening this one
      this.showFilterMenu = false;
      this.showExportMenu = false;
      // Close annotation via event
      this.shadowRoot
        ?.querySelector('protspace-annotation-select')
        ?.dispatchEvent(new CustomEvent('close-dropdown', { bubbles: false }));
      // Close search via event
      this.shadowRoot
        ?.querySelector('protspace-protein-search')
        ?.dispatchEvent(new CustomEvent('close-search', { bubbles: false }));
      // Initialize highlight to current selection or first item
      const currentIndex = this.projections.findIndex((p) => p === this.selectedProjection);
      this.projectionHighlightIndex = currentIndex >= 0 ? currentIndex : 0;
    } else {
      this.projectionHighlightIndex = -1;
    }
  }

  private selectProjection(projection: string) {
    this.selectedProjection = projection;
    this.showProjectionMenu = false;
    this.projectionHighlightIndex = -1;

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

  private handleProjectionKeydown(event: KeyboardEvent) {
    if (!this.showProjectionMenu) {
      // Handle trigger button keys
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        this.toggleProjectionMenu();
      }
      return;
    }

    this.handleDropdownKeydown(event, {
      items: this.projections,
      highlightIndex: this.projectionHighlightIndex,
      onHighlightChange: (index) => {
        this.projectionHighlightIndex = index;
      },
      onSelect: (index) => {
        this.selectProjection(this.projections[index]);
      },
      onClose: () => {
        this.showProjectionMenu = false;
        this.projectionHighlightIndex = -1;
      },
      supportHomeEnd: true,
    });
  }

  /**
   * Shared keyboard navigation handler for all dropdowns
   * Centralizes common keyboard navigation logic following DRY principle
   */
  private handleDropdownKeydown(
    event: KeyboardEvent,
    options: {
      items: unknown[];
      highlightIndex: number;
      onHighlightChange: (index: number) => void;
      onSelect: (index: number) => void;
      onClose: () => void;
      supportHomeEnd?: boolean;
    },
  ) {
    const { items, highlightIndex, onHighlightChange, onSelect, onClose, supportHomeEnd } = options;

    switch (event.key) {
      case 'Escape':
        handleDropdownEscape(event, onClose);
        break;
      case 'ArrowDown':
        event.preventDefault();
        if (items.length > 0) {
          const nextIndex = Math.min(highlightIndex + 1, items.length - 1);
          onHighlightChange(nextIndex);
          this.scrollDropdownItemIntoView();
        }
        break;
      case 'ArrowUp':
        event.preventDefault();
        if (items.length > 0) {
          const nextIndex = Math.max(highlightIndex - 1, 0);
          onHighlightChange(nextIndex);
          this.scrollDropdownItemIntoView();
        }
        break;
      case 'Home':
        if (supportHomeEnd) {
          event.preventDefault();
          if (items.length > 0) {
            onHighlightChange(0);
            this.scrollDropdownItemIntoView();
          }
        }
        break;
      case 'End':
        if (supportHomeEnd) {
          event.preventDefault();
          if (items.length > 0) {
            onHighlightChange(items.length - 1);
            this.scrollDropdownItemIntoView();
          }
        }
        break;
      case 'Enter':
      case ' ':
        event.preventDefault();
        if (highlightIndex >= 0 && highlightIndex < items.length) {
          onSelect(highlightIndex);
        }
        break;
    }
  }

  /**
   * Shared helper to scroll highlighted dropdown item into view
   * Works for all dropdown types (.dropdown-item, .filter-menu-list-item)
   */
  private scrollDropdownItemIntoView() {
    this.updateComplete.then(() => {
      const highlighted =
        this.shadowRoot?.querySelector('.dropdown-item.highlighted') ||
        this.shadowRoot?.querySelector('.filter-menu-list-item.highlighted');
      if (highlighted) {
        highlighted.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      }
    });
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

  private toggleExportMenu(event?: Event) {
    event?.stopPropagation();
    this.showExportMenu = !this.showExportMenu;
    if (this.showExportMenu) {
      // Close other dropdowns when opening this one
      this.showProjectionMenu = false;
      this.showFilterMenu = false;
      // Close annotation via event
      this.shadowRoot
        ?.querySelector('protspace-annotation-select')
        ?.dispatchEvent(new CustomEvent('close-dropdown', { bubbles: false }));
      // Close search via event
      this.shadowRoot
        ?.querySelector('protspace-protein-search')
        ?.dispatchEvent(new CustomEvent('close-search', { bubbles: false }));
      // Auto-focus first format button when opening
      this.updateComplete.then(() => {
        const firstFormatBtn = this.shadowRoot?.querySelector(
          '.export-format-options button',
        ) as HTMLButtonElement | null;
        firstFormatBtn?.focus();
      });
    }
  }

  private handleExportKeydown(event: KeyboardEvent) {
    if (!this.showExportMenu) {
      // Handle trigger button keys
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        this.toggleExportMenu();
      }
      return;
    }

    // Only handle Escape to close (native form navigation handles the rest)
    if (event.key === 'Escape') {
      handleDropdownEscape(event, () => {
        this.showExportMenu = false;
      });
    }
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
                @keydown=${this.handleProjectionKeydown}
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
                    <div
                      class="dropdown-menu align-left"
                      role="listbox"
                      @keydown=${this.handleProjectionKeydown}
                    >
                      <div class="dropdown-list">
                        ${this.projections.map(
                          (projection, index) => html`
                            <div
                              class="dropdown-item ${projection === this.selectedProjection
                                ? 'selected'
                                : ''} ${index === this.projectionHighlightIndex
                                ? 'highlighted'
                                : ''}"
                              role="option"
                              aria-selected=${projection === this.selectedProjection}
                              @click=${() => this.selectProjection(projection)}
                              @mouseenter=${() => {
                                this.projectionHighlightIndex = index;
                              }}
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
              ? 'btn-primary right-controls-button right-controls-select'
              : 'btn-secondary right-controls-select right-controls-button'}
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
            class="btn-secondary right-controls-button right-controls-clear"
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
            class="btn-secondary right-controls-button right-controls-split"
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
                  class="btn-secondary"
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
              @keydown=${this.handleFilterKeydown}
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
                  <div class="filter-menu" @keydown=${this.handleFilterKeydown}>
                    <ul class="filter-menu-list">
                      ${this.annotations.map((annotation, index) => {
                        const cfg = this.filterConfig[annotation] || {
                          enabled: false,
                          values: [],
                        };
                        const values = this.annotationValuesMap[annotation] || [];
                        return html` <li
                          class="filter-menu-list-item ${cfg.enabled
                            ? 'filter-enabled'
                            : ''} ${index === this.filterHighlightIndex ? 'highlighted' : ''}"
                          @mouseenter=${() => {
                            this.filterHighlightIndex = index;
                          }}
                        >
                          <div class="filter-item-header">
                            <label class="filter-item-checkbox-label">
                              <input
                                type="checkbox"
                                class="filter-item-checkbox"
                                .checked=${cfg.enabled}
                                @change=${(e: Event) => {
                                  const target = e.target as HTMLInputElement;
                                  this.handleFilterToggle(annotation, target.checked);
                                }}
                              />
                              <span class="filter-item-name">${annotation}</span>
                            </label>
                            ${cfg.enabled && cfg.values && cfg.values.length > 0
                              ? html`<span class="filter-item-badge"
                                  >${cfg.values.length} selected</span
                                >`
                              : ''}
                          </div>
                          <button
                            class="btn-secondary filter-item-values-button"
                            ?disabled=${!cfg.enabled}
                            @click=${() => this.toggleValueMenu(annotation)}
                          >
                            ${cfg.values && cfg.values.length > 0 ? 'Edit values' : 'Select values'}
                            <svg class="chevron-down" viewBox="0 0 24 24">
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
                                    <button
                                      class="btn-danger"
                                      @click=${() => this.clearAllValues(annotation)}
                                    >
                                      Clear all
                                    </button>
                                    <button
                                      class="btn-secondary"
                                      @click=${() => this.selectAllValues(annotation)}
                                    >
                                      Select all
                                    </button>
                                  </div>
                                  <div class="filter-menu-list-item-options-inputs">
                                    ${values.some((v) => v === LEGEND_VALUES.NA_VALUE)
                                      ? html`
                                          <label class="filter-value-label">
                                            <input
                                              type="checkbox"
                                              class="filter-value-checkbox"
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
                                            <span class="filter-value-text"
                                              >${LEGEND_VALUES.NA_DISPLAY}</span
                                            >
                                          </label>
                                        `
                                      : ''}
                                    ${Array.from(
                                      new Set(values.filter((v) => v !== LEGEND_VALUES.NA_VALUE)),
                                    ).map(
                                      (v) => html`
                                        <label class="filter-value-label">
                                          <input
                                            type="checkbox"
                                            class="filter-value-checkbox"
                                            .checked=${(cfg.values || []).includes(String(v))}
                                            @change=${(e: Event) =>
                                              this.handleValueToggle(
                                                annotation,
                                                String(v),
                                                (e.target as HTMLInputElement).checked,
                                              )}
                                          />
                                          <span class="filter-value-text">${String(v)}</span>
                                        </label>
                                      `,
                                    )}
                                  </div>
                                  <div class="filter-menu-list-item-options-done">
                                    <button
                                      class="btn-primary"
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
                        class="btn-secondary"
                        @click=${() => {
                          this.showFilterMenu = false;
                        }}
                      >
                        Cancel
                      </button>
                      <button class="btn-primary" @click=${this.applyFilters}>Apply</button>
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
              @keydown=${this.handleExportKeydown}
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
                  <div class="export-menu" @keydown=${this.handleExportKeydown}>
                    <div class="export-menu-header">
                      <span>Export Options</span>
                    </div>

                    <div class="export-menu-content">
                      <!-- Format Selection -->
                      <div class="export-option-group">
                        <label class="export-option-label">Format</label>
                        <div class="export-format-options">
                          <button
                            class="btn-secondary btn-compact ${this.exportFormat === 'png'
                              ? 'active'
                              : ''}"
                            @click=${() => {
                              this.exportFormat = 'png';
                            }}
                            title="Export as PNG image"
                          >
                            PNG
                          </button>
                          <button
                            class="btn-secondary btn-compact ${this.exportFormat === 'pdf'
                              ? 'active'
                              : ''}"
                            @click=${() => {
                              this.exportFormat = 'pdf';
                            }}
                            title="Export as PDF document"
                          >
                            PDF
                          </button>
                          <button
                            class="btn-secondary btn-compact ${this.exportFormat === 'json'
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
                            class="btn-secondary btn-compact ${this.exportFormat === 'ids'
                              ? 'active'
                              : ''}"
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
                                  <div class="export-option-value-wrapper">
                                    <input
                                      type="number"
                                      class="export-option-value-input"
                                      min="800"
                                      max="8192"
                                      step="128"
                                      .value=${String(this.exportImageWidth)}
                                      @input=${(e: Event) => {
                                        const value = parseInt(
                                          (e.target as HTMLInputElement).value,
                                        );
                                        if (!isNaN(value)) {
                                          this.handleWidthChange(
                                            Math.max(800, Math.min(8192, value)),
                                          );
                                        }
                                      }}
                                      @blur=${(e: Event) => {
                                        const input = e.target as HTMLInputElement;
                                        const value = parseInt(input.value);
                                        if (isNaN(value) || value < 800) {
                                          this.handleWidthChange(800);
                                        } else if (value > 8192) {
                                          this.handleWidthChange(8192);
                                        }
                                      }}
                                    />
                                    <span class="export-option-value-unit">px</span>
                                  </div>
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
                                  <div class="export-option-value-wrapper">
                                    <input
                                      type="number"
                                      class="export-option-value-input"
                                      min="600"
                                      max="8192"
                                      step="128"
                                      .value=${String(this.exportImageHeight)}
                                      @input=${(e: Event) => {
                                        const value = parseInt(
                                          (e.target as HTMLInputElement).value,
                                        );
                                        if (!isNaN(value)) {
                                          this.handleHeightChange(
                                            Math.max(600, Math.min(8192, value)),
                                          );
                                        }
                                      }}
                                      @blur=${(e: Event) => {
                                        const input = e.target as HTMLInputElement;
                                        const value = parseInt(input.value);
                                        if (isNaN(value) || value < 600) {
                                          this.handleHeightChange(600);
                                        } else if (value > 8192) {
                                          this.handleHeightChange(8192);
                                        }
                                      }}
                                    />
                                    <span class="export-option-value-unit">px</span>
                                  </div>
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

                              <label class="export-checkbox-label">
                                <input
                                  type="checkbox"
                                  class="export-checkbox"
                                  .checked=${this.exportLockAspectRatio}
                                  @change=${(e: Event) => {
                                    this.exportLockAspectRatio = (
                                      e.target as HTMLInputElement
                                    ).checked;
                                  }}
                                />
                                <span>Lock aspect ratio</span>
                              </label>
                            </div>

                            <div class="export-option-group">
                              <label class="export-option-label" for="export-legend-width">
                                Legend Width
                                <div class="export-option-value-wrapper">
                                  <input
                                    type="number"
                                    class="export-option-value-input"
                                    min="15"
                                    max="50"
                                    step="5"
                                    .value=${String(this.exportLegendWidthPercent)}
                                    @input=${(e: Event) => {
                                      const value = parseInt((e.target as HTMLInputElement).value);
                                      if (!isNaN(value)) {
                                        this.exportLegendWidthPercent = Math.max(
                                          15,
                                          Math.min(50, value),
                                        );
                                      }
                                    }}
                                    @blur=${(e: Event) => {
                                      const input = e.target as HTMLInputElement;
                                      const value = parseInt(input.value);
                                      if (isNaN(value) || value < 15) {
                                        this.exportLegendWidthPercent = 15;
                                      } else if (value > 50) {
                                        this.exportLegendWidthPercent = 50;
                                      }
                                    }}
                                  />
                                  <span class="export-option-value-unit">%</span>
                                </div>
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
                                <div class="export-option-value-wrapper">
                                  <input
                                    type="number"
                                    class="export-option-value-input"
                                    min="12"
                                    max="120"
                                    step="2"
                                    .value=${String(this.exportLegendFontSizePx)}
                                    @input=${(e: Event) => {
                                      const value = parseInt((e.target as HTMLInputElement).value);
                                      if (!isNaN(value)) {
                                        this.exportLegendFontSizePx = Math.max(
                                          12,
                                          Math.min(120, value),
                                        );
                                      }
                                    }}
                                    @blur=${(e: Event) => {
                                      const input = e.target as HTMLInputElement;
                                      const value = parseInt(input.value);
                                      if (isNaN(value) || value < 12) {
                                        this.exportLegendFontSizePx = 12;
                                      } else if (value > 120) {
                                        this.exportLegendFontSizePx = 120;
                                      }
                                    }}
                                  />
                                  <span class="export-option-value-unit">px</span>
                                </div>
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
                              <button class="btn-danger" @click=${this.resetExportSettings}>
                                Reset
                              </button>
                              <button class="btn-primary" @click=${this.handleExport}>
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
                            <button
                              class="btn-primary export-action-btn"
                              @click=${this.handleExport}
                            >
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
            <button class="btn-secondary" @click=${this.openFileDialog} title="Import Data">
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

  connectedCallback() {
    super.connectedCallback();
    document.addEventListener('click', this._onDocumentClick);
    document.addEventListener('keydown', this._onDocumentKeydown);

    // Listen for annotation opening
    this.addEventListener('annotation-opened', () => {
      this.showProjectionMenu = false;
      this.showFilterMenu = false;
      this.showExportMenu = false;
      // Close search when annotation opens
      this.shadowRoot
        ?.querySelector('protspace-protein-search')
        ?.dispatchEvent(new CustomEvent('close-search', { bubbles: false }));
    });

    // Listen for search opening
    this.addEventListener('search-opened', () => {
      this.showProjectionMenu = false;
      this.showFilterMenu = false;
      this.showExportMenu = false;
      // Close annotation when search opens
      this.shadowRoot
        ?.querySelector('protspace-annotation-select')
        ?.dispatchEvent(new CustomEvent('close-dropdown', { bubbles: false }));
    });

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
      // Don't handle Escape if any dropdown is open (they handle it themselves)
      if (
        isAnyDropdownOpen({
          projection: this.showProjectionMenu,
          filter: this.showFilterMenu,
          export: this.showExportMenu,
        })
      ) {
        return;
      }

      // First priority: Clear selections if any exist
      if (this.selectedProteinsCount > 0) {
        event.preventDefault();
        event.stopPropagation();
        this.handleClearSelections();
      }
      // Second priority: Turn off selection mode
      else if (this.selectionMode) {
        event.preventDefault();
        event.stopPropagation();
        this.handleToggleSelectionMode();
      }
    }
  }

  private handleDocumentClick(event: Event) {
    const path = (event as Event & { composedPath?: () => EventTarget[] }).composedPath?.() || [];

    // Check if click is inside ANY open dropdown menu
    const dropdownElements = [
      this.shadowRoot?.querySelector('.dropdown-menu.align-left'), // Projection
      this.shadowRoot?.querySelector('.filter-menu'), // Filter
      this.shadowRoot?.querySelector('.export-menu'), // Export
      // Get annotation-select element
      this.shadowRoot?.querySelector('protspace-annotation-select'),
      // Get search element
      this.shadowRoot?.querySelector('protspace-protein-search'),
    ].filter(Boolean);

    const clickInsideDropdown = dropdownElements.some((el) => {
      if (!el) return false;
      // Check both the element itself and its shadow root contents
      return path.includes(el) || (el as HTMLElement).contains(event.target as Node);
    });

    // Close ALL dropdowns if click is outside all dropdown menus
    if (!clickInsideDropdown) {
      // Close control-bar dropdowns
      this.showExportMenu = false;
      this.showFilterMenu = false;
      this.showProjectionMenu = false;
      this.openValueMenus = {};
      this.projectionHighlightIndex = -1;
      this.filterHighlightIndex = -1;

      // Close annotation dropdown via custom event
      const annotationSelect = this.shadowRoot?.querySelector('protspace-annotation-select');
      if (annotationSelect) {
        annotationSelect.dispatchEvent(new CustomEvent('close-dropdown', { bubbles: false }));
      }

      // Close search suggestions via custom event
      const searchElement = this.shadowRoot?.querySelector('protspace-protein-search');
      if (searchElement) {
        searchElement.dispatchEvent(new CustomEvent('close-search', { bubbles: false }));
      }
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

  private toggleFilterMenu(event?: Event) {
    event?.stopPropagation();
    const opening = !this.showFilterMenu;
    this.showFilterMenu = opening;
    if (opening) {
      // Close other dropdowns when opening this one
      this.showProjectionMenu = false;
      this.showExportMenu = false;
      // Close annotation via event
      this.shadowRoot
        ?.querySelector('protspace-annotation-select')
        ?.dispatchEvent(new CustomEvent('close-dropdown', { bubbles: false }));
      // Close search via event
      this.shadowRoot
        ?.querySelector('protspace-protein-search')
        ?.dispatchEvent(new CustomEvent('close-search', { bubbles: false }));
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
      // Initialize highlight to first item
      this.filterHighlightIndex = 0;
    } else {
      this.filterHighlightIndex = -1;
    }
  }

  private handleFilterKeydown(event: KeyboardEvent) {
    if (!this.showFilterMenu) {
      // Handle trigger button keys
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        this.toggleFilterMenu();
      }
      return;
    }

    // Check if any submenu is open - if so, allow native checkbox navigation
    const hasOpenSubmenu = Object.values(this.openValueMenus).some((isOpen) => isOpen);
    if (hasOpenSubmenu) {
      // Let Tab and Shift+Tab work naturally for checkboxes in submenu
      if (event.key === 'Tab') {
        return; // Allow default Tab behavior
      }
      // Escape closes the submenu
      if (event.key === 'Escape') {
        handleDropdownEscape(event, () => {
          this.openValueMenus = {};
        });
        return;
      }
      return;
    }

    // Special handling for Space and Enter/ArrowRight in filter menu
    if (event.key === ' ') {
      event.preventDefault();
      if (this.filterHighlightIndex >= 0 && this.filterHighlightIndex < this.annotations.length) {
        const annotation = this.annotations[this.filterHighlightIndex];
        const cfg = this.filterConfig[annotation] || { enabled: false, values: [] };
        this.handleFilterToggle(annotation, !cfg.enabled);
      }
      return;
    }

    if (event.key === 'Enter' || event.key === 'ArrowRight') {
      event.preventDefault();
      if (this.filterHighlightIndex >= 0 && this.filterHighlightIndex < this.annotations.length) {
        const annotation = this.annotations[this.filterHighlightIndex];
        const cfg = this.filterConfig[annotation] || { enabled: false, values: [] };
        if (cfg.enabled) {
          this.toggleValueMenu(annotation);
        }
      }
      return;
    }

    // Use shared dropdown keyboard handler for common keys
    this.handleDropdownKeydown(event, {
      items: this.annotations,
      highlightIndex: this.filterHighlightIndex,
      onHighlightChange: (index) => {
        this.filterHighlightIndex = index;
      },
      onSelect: () => {
        // Filter doesn't select on Enter, handled above
      },
      onClose: () => {
        this.showFilterMenu = false;
        this.filterHighlightIndex = -1;
      },
      supportHomeEnd: false,
    });
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
