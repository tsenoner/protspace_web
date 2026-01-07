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
import './search';

@customElement('protspace-control-bar')
export class ProtspaceControlBar extends LitElement {
  @property({ type: Array }) projections: string[] = [];
  @state() private projectionsMeta: Array<{
    name: string;
    metadata?: { dimension?: 2 | 3 };
  }> = [];
  @property({ type: Array }) features: string[] = [];
  @property({ type: String, attribute: 'selected-projection' })
  selectedProjection: string = '';
  @property({ type: String, attribute: 'selected-feature' })
  selectedFeature: string = '';
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
  @state() private featureValuesMap: Record<string, (string | null)[]> = {};
  @state() private filterConfig: Record<string, { enabled: boolean; values: (string | null)[] }> =
    {};
  @state() private lastAppliedFilterConfig: Record<
    string,
    { enabled: boolean; values: (string | null)[] }
  > = {};
  @state() private openValueMenus: Record<string, boolean> = {};
  private _scatterplotElement: ScatterplotElementLike | null = null;

  // Search state
  @state() private allProteinIds: string[] = [];
  @state() private selectedIdsChips: string[] = [];

  // Stable listeners for proper add/remove
  private _onDocumentClick = (event: Event) => this.handleDocumentClick(event);
  private _onDataChange = (event: Event) => this._handleDataChange(event);
  private _onProteinClick = (event: Event) => this._handleProteinSelection(event);
  private _onDataIsolation = (event: Event) => this._handleDataIsolation(event);
  private _onDataIsolationReset = (event: Event) => this._handleDataIsolationReset(event);
  private _onAutoDisableSelection = (event: Event) => this._handleAutoDisableSelection(event);
  private _onBrushSelection = (event: Event) => this._handleBrushSelection(event);

  static styles = controlBarStyles;

  private handleProjectionChange(event: Event) {
    const target = event.target as HTMLSelectElement;
    // If auto-sync is enabled, directly update the scatterplot
    if (this.autoSync && this._scatterplotElement) {
      const projectionIndex = this.projections.findIndex((p) => p === target.value);
      if (projectionIndex !== -1 && 'selectedProjectionIndex' in this._scatterplotElement) {
        (this._scatterplotElement as ScatterplotElementLike).selectedProjectionIndex =
          projectionIndex;
        this.selectedProjection = target.value;

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
      detail: { projection: target.value },
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

  private handleFeatureChange(event: Event) {
    const target = event.target as HTMLSelectElement;
    // If auto-sync is enabled, directly update the scatterplot
    if (this.autoSync && this._scatterplotElement) {
      if ('selectedFeature' in this._scatterplotElement) {
        (this._scatterplotElement as ScatterplotElementLike).selectedFeature = target.value;
        this.selectedFeature = target.value;
      }
    }

    const customEvent = new CustomEvent('feature-change', {
      detail: { feature: target.value },
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

  private handleExport(type: 'json' | 'ids' | 'png' | 'pdf') {
    const customEvent = new CustomEvent('export', {
      detail: { type },
      bubbles: true,
      composed: true,
    });
    this.dispatchEvent(customEvent);
    this.showExportMenu = false;
  }

  private toggleExportMenu() {
    this.showExportMenu = !this.showExportMenu;
  }

  private toggleProjectionMenu() {
    this.showProjectionMenu = !this.showProjectionMenu;
    // Close other menus when opening projection menu
    if (this.showProjectionMenu) {
      this.showExportMenu = false;
      this.showFilterMenu = false;
    }
  }

  private selectProjection(name: string) {
    // Create a synthetic event to reuse existing handleProjectionChange logic
    const syntheticEvent = {
      target: { value: name },
    } as Event & { target: HTMLSelectElement };

    this.handleProjectionChange(syntheticEvent);
    this.showProjectionMenu = false;
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
          <div class="control-group projection-container">
            <label for="projection-trigger">Projection:</label>
            <button
              id="projection-trigger"
              class="projection-trigger ${this.showProjectionMenu ? 'active' : ''}"
              @click=${this.toggleProjectionMenu}
              aria-haspopup="listbox"
              aria-expanded=${this.showProjectionMenu}
            >
              ${this.selectedProjection || 'Select projection'}
              <svg class="chevron-down" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            ${this.showProjectionMenu
              ? html`
                  <div class="projection-menu" role="listbox">
                    <ul class="projection-menu-list">
                      ${this.projections.map(
                        (projection) => html`
                          <li class="projection-menu-list-item">
                            <button
                              class="projection-option ${projection === this.selectedProjection
                                ? 'active'
                                : ''}"
                              role="option"
                              aria-selected=${projection === this.selectedProjection}
                              @click=${() => this.selectProjection(projection)}
                            >
                              ${projection}
                            </button>
                          </li>
                        `,
                      )}
                    </ul>
                  </div>
                `
              : ''}
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

          <!-- Feature selection -->
          <div class="control-group">
            <label for="feature-select">Color by:</label>
            <select
              id="feature-select"
              .value=${this.selectedFeature}
              @change=${this.handleFeatureChange}
            >
              ${this.features.map((feature) => html`<option value=${feature}>${feature}</option>`)}
            </select>
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
              class=${this.showFilterMenu ? 'active' : ''}
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
                      ${this.features.map((feature) => {
                        const cfg = this.filterConfig[feature] || {
                          enabled: false,
                          values: [],
                        };
                        const values = this.featureValuesMap[feature] || [];
                        return html` <li class="filter-menu-list-item">
                          <label
                            >${feature}
                            <input
                              type="checkbox"
                              .checked=${cfg.enabled}
                              @change=${(e: Event) => {
                                const target = e.target as HTMLInputElement;
                                this.handleFilterToggle(feature, target.checked);
                              }}
                            />
                          </label>
                          <button
                            ?disabled=${!cfg.enabled}
                            @click=${() => this.toggleValueMenu(feature)}
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
                          ${this.openValueMenus[feature] && cfg.enabled
                            ? html`
                                <div class="filter-menu-list-item-options">
                                  <div class="filter-menu-list-item-options-selection">
                                    <button @click=${() => this.selectAllValues(feature)}>
                                      Select all
                                    </button>
                                    <button @click=${() => this.clearAllValues(feature)}>
                                      None
                                    </button>
                                  </div>
                                  <div class="filter-menu-list-item-options-inputs">
                                    <label>
                                      <input
                                        type="checkbox"
                                        .checked=${(cfg.values || []).includes(null)}
                                        @change=${(e: Event) =>
                                          this.handleValueToggle(
                                            feature,
                                            null,
                                            (e.target as HTMLInputElement).checked,
                                          )}
                                      />
                                      <span>N/A</span>
                                    </label>
                                    ${Array.from(new Set(values.filter((v) => v != null))).map(
                                      (v) => html`
                                        <label>
                                          <input
                                            type="checkbox"
                                            .checked=${(cfg.values || []).includes(String(v))}
                                            @change=${(e: Event) =>
                                              this.handleValueToggle(
                                                feature,
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
                                    <button @click=${() => this.toggleValueMenu(feature)}>
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
              @click=${this.toggleExportMenu}
              class=${this.showExportMenu ? 'active' : ''}
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
                    <ul class="export-menu-list">
                      <li class="export-menu-list-item">
                        <button
                          class="export-menu-list-item-button"
                          @click=${() => this.handleExport('json')}
                        >
                          Export JSON
                        </button>
                      </li>
                      <li class="export-menu-list-item">
                        <button
                          class="export-menu-list-item-button"
                          @click=${() => this.handleExport('ids')}
                        >
                          Export Protein IDs
                        </button>
                      </li>
                      <li class="export-menu-list-item">
                        <button
                          class="export-menu-list-item-button"
                          @click=${() => this.handleExport('png')}
                        >
                          Export PNG
                        </button>
                      </li>
                      <li class="export-menu-list-item">
                        <button
                          class="export-menu-list-item-button"
                          @click=${() => this.handleExport('pdf')}
                        >
                          Export PDF
                        </button>
                      </li>
                    </ul>
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

    if (this.autoSync) {
      this._setupAutoSync();
    }
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    document.removeEventListener('click', this._onDocumentClick);

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

    // // Sync projection index and feature to scatterplot after updating options
    // // This ensures the scatterplot uses the correct index/feature for the new data
    // if (this.autoSync && this._scatterplotElement) {
    //   if ('selectedProjectionIndex' in this._scatterplotElement) {
    //     const projectionIndex = this.projections.findIndex((p) => p === this.selectedProjection);
    //     if (projectionIndex !== -1) {
    //       (this._scatterplotElement as any).selectedProjectionIndex = projectionIndex;
    //     }
    //   }

    //   if ('selectedFeature' in this._scatterplotElement) {
    //     (this._scatterplotElement as any).selectedFeature = this.selectedFeature;
    //   }
    // }

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
    // Update feature value options for filter UI
    try {
      const features = data.features || {};
      const map: Record<string, (string | null)[]> = {};
      Object.keys(features).forEach((k) => {
        const vals = features[k]?.values as (string | null)[] | undefined;
        if (Array.isArray(vals)) map[k] = vals;
      });
      this.featureValuesMap = map;
      // Initialize filter config entries for new features (preserve existing selections)
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
    // Update projections and features
    this.projectionsMeta = data.projections || [];
    this.projections = this.projectionsMeta.map((p) => p.name) || [];
    this.features = Object.keys(data.features || {});

    // Default selections if invalid
    if (!this.selectedProjection || !this.projections.includes(this.selectedProjection)) {
      this.selectedProjection = this.projections[0] || '';
    }
    if (!this.selectedFeature || !this.features.includes(this.selectedFeature)) {
      this.selectedFeature = this.features[0] || '';
    }
  }

  private _syncWithScatterplot() {
    if (this._scatterplotElement && 'getCurrentData' in this._scatterplotElement) {
      const scatterplot = this._scatterplotElement as ScatterplotElementLike;
      let data: ProtspaceData | undefined;
      data = scatterplot.getCurrentData?.();

      if (data) {
        // Extract projections and features
        this._updateOptionsFromData(data);

        // Build feature values map for filter UI
        try {
          const features = data.features || {};
          const map: Record<string, (string | null)[]> = {};
          Object.keys(features).forEach((k) => {
            const vals = features[k]?.values as (string | null)[] | undefined;
            if (Array.isArray(vals)) map[k] = vals;
          });
          this.featureValuesMap = map;
          const nextConfig: typeof this.filterConfig = { ...this.filterConfig };
          Object.keys(map).forEach((k) => {
            if (!nextConfig[k]) nextConfig[k] = { enabled: false, values: [] };
          });
          this.filterConfig = nextConfig;
        } catch (e) {
          console.error(e);
        }

        // Sync current values from scatterplot
        if (scatterplot.selectedFeature !== undefined) {
          // Only use the scatterplot's selected feature if it's still available
          const scatterplotFeature = scatterplot.selectedFeature;
          if (scatterplotFeature && this.features.includes(scatterplotFeature)) {
            this.selectedFeature = scatterplotFeature;
          } else {
            this.selectedFeature = this.features[0] || '';
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
        if (!this.selectedFeature && this.features.length > 0) {
          this.selectedFeature = this.features[0];
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

  private handleFilterToggle(feature: string, enabled: boolean) {
    const current = this.filterConfig[feature] || {
      enabled: false,
      values: [],
    };
    this.filterConfig = {
      ...this.filterConfig,
      [feature]: { ...current, enabled },
    };
    if (!enabled) this.openValueMenus = { ...this.openValueMenus, [feature]: false };
  }

  private toggleValueMenu(feature: string) {
    this.openValueMenus = {
      ...this.openValueMenus,
      [feature]: !this.openValueMenus[feature],
    };
  }

  private handleValueToggle(feature: string, value: string | null, checked: boolean) {
    const current = this.filterConfig[feature] || {
      enabled: false,
      values: [],
    };
    const next = new Set(current.values || []);
    if (checked) next.add(value);
    else next.delete(value);
    this.filterConfig = {
      ...this.filterConfig,
      [feature]: { ...current, values: Array.from(next) },
    };
  }

  private selectAllValues(feature: string) {
    const all = this.featureValuesMap[feature] || [];
    const current = this.filterConfig[feature] || {
      enabled: false,
      values: [],
    };
    this.filterConfig = {
      ...this.filterConfig,
      [feature]: { ...current, values: Array.from(new Set(all)) },
    };
  }

  private clearAllValues(feature: string) {
    const current = this.filterConfig[feature] || {
      enabled: false,
      values: [],
    };
    this.filterConfig = {
      ...this.filterConfig,
      [feature]: { ...current, values: [] },
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
      .map(([feature, cfg]) => ({
        feature,
        values: cfg.values as (string | null)[],
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
      for (const { feature, values } of activeFilters) {
        const featureIdxData = data.feature_data?.[feature];
        const valuesArr: (string | null)[] | undefined = data.features?.[feature]?.values;
        if (!featureIdxData || !valuesArr) {
          isMatch = false;
          break;
        }
        // Handle both number[] and number[][] formats
        const featureValue = Array.isArray(featureIdxData[i])
          ? (featureIdxData[i] as number[])[0]
          : (featureIdxData as number[])[i];
        const v =
          featureValue != null && featureValue >= 0 && featureValue < valuesArr.length
            ? valuesArr[featureValue]
            : null;
        if (!values.some((allowed) => allowed === v)) {
          isMatch = false;
          break;
        }
      }
      // 0 => Filtered Proteins, 1 => Other Proteins
      indices[i] = isMatch ? 0 : 1;
    }

    // Add or replace synthetic Custom feature
    const customName = 'Custom';
    const newFeatures: Record<
      string,
      { values: (string | null)[]; colors?: string[]; shapes?: string[] }
    > = {
      ...data.features,
    };
    newFeatures[customName] = {
      values: ['Filtered Proteins', 'Other Proteins'],
      colors: ['#00A35A', '#9AA0A6'],
      shapes: ['circle', 'circle'],
    };
    const newFeatureData = { ...data.feature_data, [customName]: indices };

    const newData = {
      ...data,
      features: newFeatures,
      feature_data: newFeatureData,
    };

    this.lastAppliedFilterConfig = JSON.parse(JSON.stringify(this.filterConfig));

    // Apply to scatterplot and select the Custom feature
    sp.data = newData;
    if ('selectedFeature' in sp) sp.selectedFeature = customName;
    this.features = Object.keys(newData.features || {});
    this.selectedFeature = customName;
    this.featureValuesMap = {
      ...this.featureValuesMap,
      [customName]: newFeatures[customName].values,
    };
    this.updateComplete.then(() => {
      const featureSelect = this.renderRoot?.querySelector(
        '#feature-select',
      ) as HTMLSelectElement | null;
      if (featureSelect && featureSelect.value !== customName) {
        featureSelect.value = customName;
      }
    });

    // Let listeners know the feature changed to Custom
    this.dispatchEvent(
      new CustomEvent('feature-change', {
        detail: { feature: customName },
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
