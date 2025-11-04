import { LitElement, html } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { controlBarStyles } from './control-bar.styles';
import type { DataChangeDetail, ProtspaceData, ScatterplotElementLike } from './types';

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
  @property({ type: Boolean, attribute: 'split-mode' })
  splitMode: boolean = false;
  @property({ type: Array, attribute: 'split-history' })
  splitHistory: string[][] = [];

  @state() private _selectionDisabled: boolean = false;

  // Auto-sync properties (optional, can be derived from events)
  @property({ type: String, attribute: 'scatterplot-selector' })
  scatterplotSelector: string = 'protspace-scatterplot';
  @property({ type: Boolean, attribute: 'auto-sync' })
  autoSync: boolean = true;

  @state() private showExportMenu: boolean = false;
  @state() private showFilterMenu: boolean = false;
  @state() private featureValuesMap: Record<string, (string | null)[]> = {};
  @state() private filterConfig: Record<string, { enabled: boolean; values: (string | null)[] }> =
    {};
  @state() private lastAppliedFilterConfig: Record<
    string,
    { enabled: boolean; values: (string | null)[] }
  > = {};
  @state() private openValueMenus: Record<string, boolean> = {};
  private _scatterplotElement: ScatterplotElementLike | null = null;

  // Stable listeners for proper add/remove
  private _onDocumentClick = (event: Event) => this.handleDocumentClick(event);
  private _onDataChange = (event: Event) => this._handleDataChange(event);
  private _onProteinClick = (event: Event) => this._handleProteinSelection(event);
  private _onDataSplit = (event: Event) => this._handleDataSplit(event);
  private _onDataSplitReset = (event: Event) => this._handleDataSplitReset(event);
  private _onAutoDisableSelection = (event: Event) => this._handleAutoDisableSelection(event);

  static styles = controlBarStyles;

  private handleProjectionChange(event: Event) {
    const target = event.target as HTMLSelectElement;
    // If auto-sync is enabled, directly update the scatterplot
    if (this.autoSync && this._scatterplotElement) {
      const projectionIndex = this.projections.findIndex((p) => p === target.value);
      if (projectionIndex !== -1 && 'selectedProjectionIndex' in this._scatterplotElement) {
        (this._scatterplotElement as any).selectedProjectionIndex = projectionIndex;
        this.selectedProjection = target.value;

        // If projection is 3D, keep current plane; otherwise, reset to XY
        const meta = this.projectionsMeta.find((p) => p.name === this.selectedProjection);
        const is3D = meta?.metadata?.dimension === 3;
        const nextPlane: 'xy' | 'xz' | 'yz' = is3D ? this.projectionPlane : 'xy';
        if ('projectionPlane' in this._scatterplotElement) {
          (this._scatterplotElement as any).projectionPlane = nextPlane;
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
      (this._scatterplotElement as any).projectionPlane = plane;
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
        (this._scatterplotElement as any).selectedFeature = target.value;
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
        (this._scatterplotElement as any).selectedProteinIds = [];
        this.selectedProteinsCount = 0;
      }
    }
  }

  private handleSplitData() {
    const customEvent = new CustomEvent('split-data', {
      detail: {},
      bubbles: true,
      composed: true,
    });
    this.dispatchEvent(customEvent);

    if (this.autoSync && this._scatterplotElement) {
      const scatterplot = this._scatterplotElement as ScatterplotElementLike;
      scatterplot.splitDataBySelection?.();
    }
  }

  private handleResetSplit() {
    const customEvent = new CustomEvent('reset-split', {
      detail: {},
      bubbles: true,
      composed: true,
    });
    this.dispatchEvent(customEvent);

    if (this.autoSync && this._scatterplotElement) {
      const scatterplot = this._scatterplotElement as ScatterplotElementLike;
      scatterplot.resetSplit?.();
      this.splitMode = false;
      this.splitHistory = [];
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

  private openFileDialog() {
    const loader = document.querySelector('protspace-data-loader') as any;
    loader?.shadowRoot?.querySelector('input[type="file"]')?.click();
  }

  render() {
    return html`
      <div class="control-bar">
        <!-- Left side controls -->
        <div class="left-controls">
          <!-- Projection selection -->
          <div class="control-group">
            <label for="projection-select">Projection:</label>
            <select
              id="projection-select"
              .value=${this.selectedProjection}
              @change=${this.handleProjectionChange}
            >
              ${this.projections.map(
                (projection) => html`<option value=${projection}>${projection}</option>`
              )}
            </select>
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

          <!-- Split data button -->
          <button
            class="right-controls-button right-controls-split"
            ?disabled=${this.selectedProteinsCount === 0}
            @click=${this.handleSplitData}
            title="Split data to show only selected proteins"
          >
            <svg class="icon" viewBox="0 0 24 24">
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
              />
            </svg>
            Split
          </button>

          <!-- Reset split button -->
          ${this.splitMode
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
                                            (e.target as HTMLInputElement).checked
                                          )}
                                      />
                                      <span>N/A</span>
                                    </label>
                                    ${Array.from(new Set(values.filter((v) => v !== null))).map(
                                      (v) => html`
                                        <label>
                                          <input
                                            type="checkbox"
                                            .checked=${(cfg.values || []).includes(String(v))}
                                            @change=${(e: Event) =>
                                              this.handleValueToggle(
                                                feature,
                                                String(v),
                                                (e.target as HTMLInputElement).checked
                                              )}
                                          />
                                          <span>${String(v)}</span>
                                        </label>
                                      `
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
      this._scatterplotElement.removeEventListener('data-split', this._onDataSplit);
      this._scatterplotElement.removeEventListener('data-split-reset', this._onDataSplitReset);
      this._scatterplotElement.removeEventListener(
        'auto-disable-selection',
        this._onAutoDisableSelection
      );
    }
  }

  private handleDocumentClick(event: Event) {
    if (!this.contains(event.target as Node)) {
      this.showExportMenu = false;
      this.showFilterMenu = false;
      this.openValueMenus = {};
    }
  }

  private _setupAutoSync() {
    // Find scatterplot element with retries
    const trySetup = (attempts: number = 0) => {
      this._scatterplotElement = document.querySelector(
        this.scatterplotSelector
      ) as ScatterplotElementLike | null;

      if (this._scatterplotElement) {
        // Listen for data changes
        this._scatterplotElement.addEventListener('data-change', this._onDataChange);

        // Listen for protein selection changes
        this._scatterplotElement.addEventListener('protein-click', this._onProteinClick);

        // Listen for data split events
        this._scatterplotElement.addEventListener('data-split', this._onDataSplit);

        this._scatterplotElement.addEventListener('data-split-reset', this._onDataSplitReset);

        this._scatterplotElement.addEventListener(
          'auto-disable-selection',
          this._onAutoDisableSelection
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
          this.scatterplotSelector
        );
      }
    };

    trySetup();
  }

  private _handleDataChange(event: Event) {
    const { data } = (event as CustomEvent<DataChangeDetail>).detail || {};
    if (!data) return;

    this._updateOptionsFromData(data);
    // Update feature value options for filter UI
    try {
      const features = (data as any).features || {};
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

  private _handleProteinSelection(_event: Event) {
    // Update selected proteins count when proteins are selected/deselected
    if (this._scatterplotElement && 'selectedProteinIds' in this._scatterplotElement) {
      const selectedIds =
        (this._scatterplotElement as ScatterplotElementLike).selectedProteinIds || [];
      this.selectedProteinsCount = selectedIds.length;
      this.requestUpdate();
    }
  }

  private _handleDataSplit(event: Event) {
    const customEvent = event as CustomEvent;
    const { splitHistory, splitMode } = customEvent.detail;
    this.splitHistory = splitHistory;
    this.splitMode = splitMode;
    this.selectedProteinsCount = 0;
    this.requestUpdate();
  }

  private _handleDataSplitReset(event: Event) {
    const customEvent = event as CustomEvent;
    const { splitHistory, splitMode } = customEvent.detail;
    this.splitHistory = splitHistory;
    this.splitMode = splitMode;
    this.selectedProteinsCount = 0;

    // Re-enable selection when split is reset (back to full data)
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
      })
    );
  }

  private _updateOptionsFromData(data: ProtspaceData) {
    // Update projections and features
    this.projectionsMeta = (data.projections as any) || [];
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
          const features = (data as any).features || {};
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
        }

        this.splitMode = scatterplot.isSplitMode?.() ?? false;
        this.splitHistory = scatterplot.getSplitHistory?.() ?? [];

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
    const sp = this._scatterplotElement as any;
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
        const featureIdxArr: number[] | undefined = data.feature_data?.[feature];
        const valuesArr: (string | null)[] | undefined = data.features?.[feature]?.values;
        if (!featureIdxArr || !valuesArr) {
          isMatch = false;
          break;
        }
        const vi = featureIdxArr[i];
        const v = vi != null && vi >= 0 && vi < valuesArr.length ? valuesArr[vi] : null;
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
    const newFeatures = { ...data.features };
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
      [customName]: newFeatures[customName].values as unknown as (string | null)[],
    };
    this.updateComplete.then(() => {
      const featureSelect = this.renderRoot?.querySelector(
        '#feature-select'
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
      })
    );

    this.showFilterMenu = false;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'protspace-control-bar': ProtspaceControlBar;
  }
}
