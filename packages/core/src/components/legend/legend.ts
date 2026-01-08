import { LitElement, html } from 'lit';
import { customElement, property, query, state } from 'lit/decorators.js';

// Configuration and styles
import {
  LEGEND_DEFAULTS,
  LEGEND_STYLES,
  FIRST_NUMBER_SORT_FEATURES,
  LEGEND_VALUES,
  LEGEND_EVENTS,
} from './config';
import { legendStyles } from './legend.styles';

// Controllers
import { ScatterplotSyncController, PersistenceController, DragController } from './controllers';

// Processors and renderers
import {
  LegendDataProcessor,
  createProcessorContext,
  type LegendProcessorContext,
} from './legend-data-processor';
import { LegendRenderer } from './legend-renderer';

// Helpers
import {
  valueToKey,
  normalizeSortModes,
  reverseZOrderKeepOtherLast,
  calculatePointSize,
  getDefaultSortMode,
  getItemClasses,
  isItemSelected,
  createItemActionEvent,
  updateItemsVisibility,
  isolateItem,
  computeOtherConcreteValues,
} from './legend-helpers';

// Dialogs
import {
  renderSettingsDialog,
  initializeFeatureSortMode,
  type SettingsDialogState,
  type SettingsDialogCallbacks,
} from './legend-settings-dialog';
import { renderOtherDialog } from './legend-other-dialog';
import { createFocusTrap } from './focus-trap';

// Types
import type {
  LegendDataInput,
  LegendFeatureData,
  LegendItem,
  LegendSortMode,
  OtherItem,
  ScatterplotData,
  LegendPersistedSettings,
  LegendErrorEventDetail,
} from './types';

/**
 * Legend component for displaying and interacting with feature categories.
 *
 * @fires legend-item-click - When a legend item is clicked (toggled, isolated, extracted, or merged)
 * @fires legend-zorder-change - When the z-order of legend items changes
 * @fires legend-colormapping-change - When color/shape mappings change
 * @fires legend-customize - When the customize dialog is opened
 * @fires legend-download - When download is requested
 * @fires legend-error - When an error occurs during data processing, persistence, or syncing
 *
 * @csspart container - The main legend container
 *
 * @slot - Default slot for custom content
 */
@customElement('protspace-legend')
export class ProtspaceLegend extends LitElement {
  static styles = legendStyles;

  // ─────────────────────────────────────────────────────────────────
  // Public Properties (reflected to attributes where appropriate)
  // ─────────────────────────────────────────────────────────────────

  @property({ type: String }) featureName = '';
  @property({ type: Object }) featureData: LegendFeatureData = { name: '', values: [] };
  @property({ type: Array }) featureValues: (string | null)[] = [];
  @property({ type: Array }) proteinIds: string[] = [];
  @property({ type: Number, reflect: true }) maxVisibleValues: number =
    LEGEND_DEFAULTS.maxVisibleValues;
  @property({ type: Array }) selectedItems: string[] = [];
  @property({ type: Boolean, reflect: true }) isolationMode = false;
  @property({ type: Array }) isolationHistory: string[][] = [];
  @property({ type: Object }) data: LegendDataInput | null = null;
  @property({ type: String, reflect: true }) selectedFeature = '';
  @property({ type: Boolean, reflect: true }) includeOthers: boolean =
    LEGEND_DEFAULTS.includeOthers;
  @property({ type: Boolean, reflect: true }) includeShapes: boolean =
    LEGEND_DEFAULTS.includeShapes;
  @property({ type: Number, reflect: true }) shapeSize: number = LEGEND_DEFAULTS.symbolSize;

  @property({ type: String, attribute: 'scatterplot-selector' })
  scatterplotSelector: string = LEGEND_DEFAULTS.scatterplotSelector;

  @property({ type: Boolean, attribute: 'auto-sync' })
  autoSync: boolean = true;

  @property({ type: Boolean, attribute: 'auto-hide' })
  autoHide: boolean = true;

  // ─────────────────────────────────────────────────────────────────
  // Internal State
  // ─────────────────────────────────────────────────────────────────

  @state() private _legendItems: LegendItem[] = [];
  @state() private _sortedLegendItems: LegendItem[] = [];
  @state() private _otherItems: OtherItem[] = [];
  @state() private _hiddenValues: string[] = [];
  @state() private _manualOtherValues: string[] = [];
  @state() private _featureSortModes: Record<string, LegendSortMode> = {};
  @state() private _showOtherDialog = false;
  @state() private _showSettingsDialog = false;
  @state() private _statusMessage = '';

  // Settings dialog temporary state (consolidated into single object)
  @state() private _dialogSettings: {
    maxVisibleValues: number;
    includeOthers: boolean;
    includeShapes: boolean;
    shapeSize: number;
    enableDuplicateStackUI: boolean;
    featureSortModes: Record<string, LegendSortMode>;
  } = {
    maxVisibleValues: LEGEND_DEFAULTS.maxVisibleValues,
    includeOthers: LEGEND_DEFAULTS.includeOthers,
    includeShapes: LEGEND_DEFAULTS.includeShapes,
    shapeSize: LEGEND_DEFAULTS.symbolSize,
    enableDuplicateStackUI: false,
    featureSortModes: {},
  };

  @query('#legend-settings-dialog')
  private _settingsDialogEl?: HTMLDivElement;

  // Instance-specific processor context (avoids global state conflicts)
  private _processorContext: LegendProcessorContext = createProcessorContext();

  // Focus trap cleanup function (stored for proper cleanup)
  private _focusTrapCleanup: (() => void) | null = null;

  // ─────────────────────────────────────────────────────────────────
  // Controllers
  // ─────────────────────────────────────────────────────────────────

  private _scatterplotController = new ScatterplotSyncController(this, {
    onDataChange: (data, feature) => this._handleScatterplotDataChange(data, feature),
    onFeatureChange: (feature) => this._handleFeatureChange(feature),
    getHiddenValues: () => this._hiddenValues,
    getOtherItems: () => this._otherItems,
    getLegendItems: () => this._legendItems,
    getIncludeOthers: () => this.includeOthers,
    getEffectiveIncludeShapes: () => this._effectiveIncludeShapes,
    getOtherConcreteValues: () => computeOtherConcreteValues(this._otherItems),
  });

  private _persistenceController = new PersistenceController(this, {
    onSettingsLoaded: (settings) => this._applyPersistedSettings(settings),
    getLegendItems: () => this._legendItems,
    getHiddenValues: () => this._hiddenValues,
    getManualOtherValues: () => this._manualOtherValues,
    getCurrentSettings: () => ({
      maxVisibleValues: this.maxVisibleValues,
      includeOthers: this.includeOthers,
      includeShapes: this.includeShapes,
      shapeSize: this.shapeSize,
      sortMode: this._featureSortModes[this.selectedFeature] ?? 'size',
      enableDuplicateStackUI: this._dialogSettings.enableDuplicateStackUI,
    }),
  });

  private _dragController = new DragController(this, {
    getLegendItems: () => this._legendItems,
    setLegendItems: (items) => {
      this._legendItems = items;
    },
    getManualOtherValues: () => this._manualOtherValues,
    setManualOtherValues: (values) => {
      this._manualOtherValues = values;
    },
    onReorder: () => {
      this._scatterplotController.dispatchZOrderChange();
      this._persistenceController.saveSettings();
      this.requestUpdate();
    },
    onMergeToOther: (value) => {
      this._dispatchItemAction(value, 'merge-into-other');
      this._persistenceController.saveSettings();
    },
    updateLegendItems: () => this._updateLegendItems(),
  });

  // ─────────────────────────────────────────────────────────────────
  // Keyboard Handler
  // ─────────────────────────────────────────────────────────────────

  private _onWindowKeydownCapture = (e: KeyboardEvent) => {
    if (!this._showSettingsDialog) return;
    if (e.key === 'Escape') {
      e.stopImmediatePropagation();
      e.preventDefault();
      this._handleSettingsClose();
    }
  };

  private _handleItemKeyDown(e: KeyboardEvent, item: LegendItem, itemIndex: number): void {
    switch (e.key) {
      case 'ArrowDown':
      case 'ArrowRight': {
        e.preventDefault();
        const nextIndex = Math.min(itemIndex + 1, this._sortedLegendItems.length - 1);
        this._focusItem(nextIndex);
        break;
      }
      case 'ArrowUp':
      case 'ArrowLeft': {
        e.preventDefault();
        const prevIndex = Math.max(itemIndex - 1, 0);
        this._focusItem(prevIndex);
        break;
      }
      case 'Home': {
        e.preventDefault();
        this._focusItem(0);
        break;
      }
      case 'End': {
        e.preventDefault();
        this._focusItem(this._sortedLegendItems.length - 1);
        break;
      }
      case 'Enter':
      case ' ': {
        e.preventDefault();
        this._handleItemClick(item.value);
        break;
      }
    }
  }

  private _focusItem(index: number): void {
    // Focus the item directly
    const items = this.shadowRoot?.querySelectorAll('.legend-item');
    if (items?.[index]) {
      (items[index] as HTMLElement).focus();
    }
  }

  // ─────────────────────────────────────────────────────────────────
  // Computed Properties
  // ─────────────────────────────────────────────────────────────────

  private get _effectiveIncludeShapes(): boolean {
    return this._isMultilabelFeature() ? false : this.includeShapes;
  }

  private get _currentSortMode(): LegendSortMode {
    return (
      this._featureSortModes[this.selectedFeature] ??
      (FIRST_NUMBER_SORT_FEATURES.has(this.selectedFeature) ? 'alpha' : 'size')
    );
  }

  // ─────────────────────────────────────────────────────────────────
  // Lifecycle
  // ─────────────────────────────────────────────────────────────────

  connectedCallback(): void {
    super.connectedCallback();
    this._scatterplotController.scatterplotSelector = this.scatterplotSelector;
    this._scatterplotController.autoSync = this.autoSync;
    this._scatterplotController.autoHide = this.autoHide;
  }

  disconnectedCallback(): void {
    window.removeEventListener('keydown', this._onWindowKeydownCapture, true);
    this._cleanupFocusTrap();
    super.disconnectedCallback();
  }

  private _cleanupFocusTrap(): void {
    if (this._focusTrapCleanup) {
      this._focusTrapCleanup();
      this._focusTrapCleanup = null;
    }
  }

  private _setupFocusTrap(dialogId: string): void {
    this._cleanupFocusTrap();
    requestAnimationFrame(() => {
      const dialog = this.shadowRoot?.querySelector(`#${dialogId}`) as HTMLElement | null;
      if (dialog) {
        this._focusTrapCleanup = createFocusTrap(dialog);
      }
    });
  }

  updated(changedProperties: Map<string, unknown>): void {
    // Handle settings dialog keyboard events and focus trapping
    if (changedProperties.has('_showSettingsDialog')) {
      if (this._showSettingsDialog) {
        window.addEventListener('keydown', this._onWindowKeydownCapture, true);
        this._setupFocusTrap('legend-settings-dialog');
      } else {
        window.removeEventListener('keydown', this._onWindowKeydownCapture, true);
        this._cleanupFocusTrap();
      }
    }

    // Handle other dialog focus trapping
    if (changedProperties.has('_showOtherDialog')) {
      if (this._showOtherDialog) {
        this._setupFocusTrap('legend-other-dialog');
      } else {
        this._cleanupFocusTrap();
      }
    }

    // Update dataset hash when protein IDs change
    if (changedProperties.has('proteinIds') && this.proteinIds.length > 0) {
      this._persistenceController.updateDatasetHash(this.proteinIds);
    }

    // Handle data or feature changes
    if (changedProperties.has('data') || changedProperties.has('selectedFeature')) {
      this._updateFeatureDataFromData();
      this._ensureSortModeDefaults();

      const featureChanged = this._persistenceController.updateSelectedFeature(
        this.selectedFeature,
      );
      if (featureChanged || !this._persistenceController.settingsLoaded) {
        this._persistenceController.loadSettings();
      }
    }

    // Update legend items when relevant properties change
    if (
      changedProperties.has('data') ||
      changedProperties.has('selectedFeature') ||
      changedProperties.has('featureValues') ||
      changedProperties.has('proteinIds') ||
      changedProperties.has('maxVisibleValues') ||
      changedProperties.has('includeOthers') ||
      changedProperties.has('includeShapes')
    ) {
      this._updateLegendItems();

      if (this._persistenceController.hasPendingZOrder()) {
        this._legendItems = this._persistenceController.applyPendingZOrder(this._legendItems);
      }
    }

    // Update sorted items cache when legend items change
    if (changedProperties.has('_legendItems')) {
      this._sortedLegendItems = [...this._legendItems].sort((a, b) => a.zOrder - b.zOrder);
    }
  }

  // ─────────────────────────────────────────────────────────────────
  // Public API
  // ─────────────────────────────────────────────────────────────────

  /**
   * Force synchronization with scatterplot
   */
  public forceSync(): void {
    this._scatterplotController.forceSync();
  }

  /**
   * Get legend data for export (PNG/PDF)
   */
  public getLegendExportData(): {
    feature: string;
    includeShapes: boolean;
    items: Array<LegendItem & { extractedFromOther?: boolean }>;
  } {
    return {
      feature: this.featureData.name || this.featureName || 'Legend',
      includeShapes: this._effectiveIncludeShapes,
      items: this._sortedLegendItems.map((i) => ({ ...i })),
    };
  }

  /**
   * Download legend as image
   */
  public async downloadAsImage(): Promise<void> {
    this.dispatchEvent(new CustomEvent(LEGEND_EVENTS.DOWNLOAD, { bubbles: true, composed: true }));
  }

  // ─────────────────────────────────────────────────────────────────
  // Data Handling
  // ─────────────────────────────────────────────────────────────────

  private _handleScatterplotDataChange(data: ScatterplotData, selectedFeature: string): void {
    this.data = { features: data.features };
    this.selectedFeature = selectedFeature;
    this.featureData = {
      name: selectedFeature,
      values: data.features[selectedFeature].values,
    };
    this._updateFeatureValues(data, selectedFeature);
    this.proteinIds = data.protein_ids;

    // Sync isolation state
    const { isolationMode, isolationHistory } = this._scatterplotController.getIsolationState();
    this.isolationMode = isolationMode;
    this.isolationHistory = isolationHistory;
  }

  private _handleFeatureChange(feature: string): void {
    this.selectedFeature = feature;
    this._hiddenValues = [];
    this._manualOtherValues = [];
    this._scatterplotController.forceSync();
  }

  private _updateFeatureDataFromData(): void {
    const featureInfo = this.data?.features?.[this.selectedFeature] ?? null;
    this.featureData = featureInfo
      ? { name: this.selectedFeature, values: featureInfo.values }
      : { name: '', values: [] };
  }

  private _updateFeatureValues(data: ScatterplotData, selectedFeature: string): void {
    const featureValues = data.protein_ids.flatMap((_: string, index: number) => {
      const featureIdxData = data.feature_data[selectedFeature][index];
      const featureIdxArray = Array.isArray(featureIdxData) ? featureIdxData : [featureIdxData];
      return featureIdxArray
        .map((featureIdx: number) => data.features[selectedFeature].values[featureIdx])
        .filter((v) => v != null);
    });
    this.featureValues = featureValues;
  }

  private _ensureSortModeDefaults(): void {
    const featureNames = this.data?.features ? Object.keys(this.data.features) : [];
    if (featureNames.length === 0) return;

    const updated: Record<string, LegendSortMode> = { ...this._featureSortModes };
    for (const fname of featureNames) {
      if (!(fname in updated)) {
        updated[fname] = FIRST_NUMBER_SORT_FEATURES.has(fname) ? 'alpha' : 'size';
      }
    }
    this._featureSortModes = updated;
  }

  private _isMultilabelFeature(): boolean {
    return this._scatterplotController.isMultilabelFeature(this.selectedFeature);
  }

  // ─────────────────────────────────────────────────────────────────
  // Legend Item Processing
  // ─────────────────────────────────────────────────────────────────

  private _updateLegendItems(): void {
    if (!this.featureData?.values?.length || !this.featureValues?.length) {
      this._legendItems = [];
      return;
    }

    try {
      const { legendItems, otherItems } = LegendDataProcessor.processLegendItems(
        this._processorContext,
        this.featureData.name || this.selectedFeature,
        this.featureValues,
        this.proteinIds,
        this.maxVisibleValues,
        this.isolationMode,
        this.isolationHistory,
        this._legendItems,
        this.includeOthers,
        this._manualOtherValues,
        this._currentSortMode,
        this._effectiveIncludeShapes,
      );

      // Apply hidden values
      if (this._hiddenValues.length > 0) {
        this._legendItems = legendItems.map((item) => ({
          ...item,
          isVisible: !this._hiddenValues.includes(valueToKey(item.value)),
        }));
      } else {
        this._legendItems = legendItems;
      }
      this._otherItems = otherItems;

      // Sync with scatterplot
      this._scatterplotController.dispatchZOrderChange();
      this._scatterplotController.dispatchColorMappingChange();
      this._scatterplotController.syncOtherValues();
      this._scatterplotController.syncShapes();
      this._scatterplotController.syncHiddenValues();
    } catch (error) {
      this._dispatchError(
        'Failed to process legend data',
        'data-processing',
        error instanceof Error ? error : new Error(String(error)),
      );
    }
  }

  // ─────────────────────────────────────────────────────────────────
  // Settings Persistence
  // ─────────────────────────────────────────────────────────────────

  private _applyPersistedSettings(settings: LegendPersistedSettings): void {
    try {
      this.maxVisibleValues = settings.maxVisibleValues;
      this.includeOthers = settings.includeOthers;
      this.includeShapes = settings.includeShapes;
      this.shapeSize = settings.shapeSize;
      this._hiddenValues = settings.hiddenValues;
      this._manualOtherValues = settings.manualOtherValues;

      this._featureSortModes = {
        ...this._featureSortModes,
        [this.selectedFeature]: settings.sortMode,
      };

      this._scatterplotController.updateConfig({
        pointSize: calculatePointSize(this.shapeSize),
        enableDuplicateStackUI: settings.enableDuplicateStackUI ?? false,
      });
    } catch (error) {
      this._dispatchError(
        'Failed to apply persisted settings',
        'persistence',
        error instanceof Error ? error : new Error(String(error)),
      );
    }
  }

  // ─────────────────────────────────────────────────────────────────
  // Item Interactions
  // ─────────────────────────────────────────────────────────────────

  private _handleItemClick(value: string | null): void {
    const valueKey = valueToKey(value);
    const result = updateItemsVisibility(this._legendItems, this._hiddenValues, valueKey);

    this._legendItems = result.items;
    this._hiddenValues = result.hiddenValues;

    const item = this._legendItems.find((i) => valueToKey(i.value) === valueKey);
    const displayName = value ?? 'N/A';
    this._announceStatus(`${displayName} ${item?.isVisible ? 'shown' : 'hidden'}`);

    this._scatterplotController.syncHiddenValues();
    this._dispatchItemAction(value, 'toggle');
    this._persistenceController.saveSettings();
    this.requestUpdate();
  }

  private _handleItemDoubleClick(value: string | null): void {
    const result = isolateItem(this._legendItems, value);

    this._legendItems = result.items;
    this._hiddenValues = result.hiddenValues;

    const displayName = value ?? 'N/A';
    const visibleCount = result.items.filter((i) => i.isVisible).length;
    this._announceStatus(visibleCount === 1 ? `Isolated ${displayName}` : 'All items shown');

    this._scatterplotController.syncHiddenValues();
    this._dispatchItemAction(value, 'isolate');
    this._persistenceController.saveSettings();
    this.requestUpdate();
  }

  private _handleExtractFromOther(value: string): void {
    const itemToExtract = this._otherItems.find((item) => item.value === value);
    if (!itemToExtract) return;

    if (this._manualOtherValues.includes(value)) {
      this._manualOtherValues = this._manualOtherValues.filter((v) => v !== value);
    }

    const newItem = LegendDataProcessor.createExtractedItem(
      this._processorContext,
      value,
      itemToExtract.count,
      this._legendItems.length,
      this._effectiveIncludeShapes,
    );

    this._legendItems = [...this._legendItems, newItem];
    this._updateLegendItems();
    this._showOtherDialog = false;

    this._announceStatus(`Extracted ${value} from Other category`);

    this._dispatchItemAction(value, 'extract');
    this._persistenceController.saveSettings();
    this.requestUpdate();
  }

  private _reverseZOrder(): void {
    if (this._legendItems.length <= 1) return;

    this._legendItems = reverseZOrderKeepOtherLast(this._legendItems);
    this._scatterplotController.dispatchZOrderChange();
    this._persistenceController.saveSettings();
    this.requestUpdate();
  }

  private _dispatchItemAction(
    value: string | null,
    action: 'toggle' | 'isolate' | 'extract' | 'merge-into-other',
  ): void {
    this.dispatchEvent(createItemActionEvent(LEGEND_EVENTS.ITEM_CLICK, value, action));
  }

  private _announceStatus(message: string): void {
    this._statusMessage = message;
    // Clear after announcement to allow repeated messages
    setTimeout(() => {
      this._statusMessage = '';
    }, 1000);
  }

  private _dispatchError(
    message: string,
    source: LegendErrorEventDetail['source'],
    originalError?: Error,
  ): void {
    const detail: LegendErrorEventDetail = { message, source, originalError };
    this.dispatchEvent(
      new CustomEvent(LEGEND_EVENTS.ERROR, {
        detail,
        bubbles: true,
        composed: true,
      }),
    );
    console.error(`[protspace-legend] ${source}: ${message}`, originalError);
  }

  // ─────────────────────────────────────────────────────────────────
  // Settings Dialog
  // ─────────────────────────────────────────────────────────────────

  private async _handleCustomize(): Promise<void> {
    const scatterplot = this._scatterplotController.scatterplot;
    this._dialogSettings = {
      maxVisibleValues: this.maxVisibleValues,
      includeOthers: this.includeOthers,
      includeShapes: this.includeShapes,
      shapeSize: this.shapeSize,
      featureSortModes: normalizeSortModes(this._featureSortModes),
      enableDuplicateStackUI: Boolean(
        scatterplot &&
          'config' in scatterplot &&
          (scatterplot as { config?: Record<string, unknown> }).config?.enableDuplicateStackUI,
      ),
    };

    this._showSettingsDialog = true;
    this.dispatchEvent(new CustomEvent(LEGEND_EVENTS.CUSTOMIZE, { bubbles: true, composed: true }));

    this.requestUpdate();
    await this.updateComplete;
    this._settingsDialogEl?.focus();
  }

  private _handleSettingsSave(): void {
    this.maxVisibleValues = this._dialogSettings.maxVisibleValues;
    this.includeOthers = this._dialogSettings.includeOthers;
    this.includeShapes = this._dialogSettings.includeShapes;
    this.shapeSize = this._dialogSettings.shapeSize;
    this._featureSortModes = this._dialogSettings.featureSortModes;
    this._showSettingsDialog = false;
    this._legendItems = [];

    this._updateLegendItems();
    this._scatterplotController.syncHiddenValues();
    this._scatterplotController.updateConfig({
      pointSize: calculatePointSize(this.shapeSize),
      enableDuplicateStackUI: this._dialogSettings.enableDuplicateStackUI,
    });
    this._persistenceController.saveSettings();
    this.requestUpdate();
  }

  private _handleSettingsClose(): void {
    this._showSettingsDialog = false;
  }

  private _handleSettingsReset(): void {
    this._persistenceController.removeSettings();

    this.maxVisibleValues = LEGEND_DEFAULTS.maxVisibleValues;
    this.includeOthers = LEGEND_DEFAULTS.includeOthers;
    this.includeShapes = LEGEND_DEFAULTS.includeShapes;
    this.shapeSize = LEGEND_DEFAULTS.symbolSize;

    this._featureSortModes = {
      ...this._featureSortModes,
      [this.selectedFeature]: getDefaultSortMode(this.selectedFeature),
    };

    this._hiddenValues = [];
    this._manualOtherValues = [];
    this._legendItems = [];
    this._showSettingsDialog = false;

    this._scatterplotController.updateConfig({
      pointSize: calculatePointSize(LEGEND_DEFAULTS.symbolSize),
      enableDuplicateStackUI: false,
    });

    this._updateLegendItems();
    this.requestUpdate();
  }

  private _handleDialogKeydown(e: KeyboardEvent): void {
    if (e.key === 'Enter') {
      e.stopImmediatePropagation();
      e.preventDefault();
      this._handleSettingsSave();
    }
  }

  // ─────────────────────────────────────────────────────────────────
  // Rendering
  // ─────────────────────────────────────────────────────────────────

  render() {
    const title = this.featureData.name || this.featureName || 'Legend';

    return html`
      <div class="legend-container" part="container">
        <div class="sr-only" role="status" aria-live="polite" aria-atomic="true">
          ${this._statusMessage}
        </div>
        ${LegendRenderer.renderHeader(title, {
          onReverse: () => this._reverseZOrder(),
          onCustomize: () => this._handleCustomize(),
        })}
        ${LegendRenderer.renderLegendContent(this._sortedLegendItems, (item, index) =>
          this._renderLegendItem(item, index),
        )}
      </div>
      ${this._renderOtherDialog()} ${this._renderSettingsDialog()}
    `;
  }

  private _renderLegendItem(item: LegendItem, sortedIndex: number) {
    const selected = isItemSelected(item, this.selectedItems);
    const itemIndex = this._legendItems.findIndex((i) => i.value === item.value);
    const isDragging = this._dragController.isDragging(itemIndex);
    const classes = getItemClasses(item, selected, isDragging);
    const otherCount = item.value === LEGEND_VALUES.OTHER ? this._otherItems.length : undefined;

    return LegendRenderer.renderLegendItem(
      item,
      classes,
      selected,
      {
        onClick: () => this._handleItemClick(item.value),
        onDoubleClick: () => this._handleItemDoubleClick(item.value),
        onDragStart: () => this._dragController.handleDragStart(item),
        onDragOver: (e: DragEvent) => this._dragController.handleDragOver(e, item),
        onDrop: (e: DragEvent) => this._dragController.handleDrop(e, item),
        onDragEnd: () => this._dragController.handleDragEnd(),
        onViewOther: (e: Event) => {
          e.stopPropagation();
          this._showOtherDialog = true;
        },
        onKeyDown: (e: KeyboardEvent) => this._handleItemKeyDown(e, item, sortedIndex),
      },
      this._effectiveIncludeShapes,
      LEGEND_STYLES.legendDisplaySize,
      otherCount,
      sortedIndex,
    );
  }

  private _renderOtherDialog() {
    if (!this._showOtherDialog) return html``;

    return renderOtherDialog(
      { otherItems: this._otherItems },
      {
        onExtract: (value) => this._handleExtractFromOther(value),
        onClose: () => {
          this._showOtherDialog = false;
        },
      },
    );
  }

  private _renderSettingsDialog() {
    if (!this._showSettingsDialog) return html``;

    // Initialize sort mode for current feature if needed
    this._dialogSettings = {
      ...this._dialogSettings,
      featureSortModes: initializeFeatureSortMode(
        this._dialogSettings.featureSortModes,
        this.selectedFeature,
        this._featureSortModes,
      ),
    };

    const state: SettingsDialogState = {
      maxVisibleValues: this._dialogSettings.maxVisibleValues,
      shapeSize: this._dialogSettings.shapeSize,
      includeOthers: this._dialogSettings.includeOthers,
      includeShapes: this._dialogSettings.includeShapes,
      enableDuplicateStackUI: this._dialogSettings.enableDuplicateStackUI,
      selectedFeature: this.selectedFeature,
      featureSortModes: this._dialogSettings.featureSortModes,
      isMultilabelFeature: this._isMultilabelFeature(),
      hasPersistedSettings: this._persistenceController.hasPersistedSettings(),
    };

    const callbacks: SettingsDialogCallbacks = {
      onMaxVisibleValuesChange: (v) => {
        this._dialogSettings = { ...this._dialogSettings, maxVisibleValues: v };
      },
      onShapeSizeChange: (v) => {
        this._dialogSettings = { ...this._dialogSettings, shapeSize: v };
      },
      onIncludeOthersChange: (v) => {
        this._dialogSettings = { ...this._dialogSettings, includeOthers: v };
      },
      onIncludeShapesChange: (v) => {
        this._dialogSettings = { ...this._dialogSettings, includeShapes: v };
      },
      onEnableDuplicateStackUIChange: (v) => {
        this._dialogSettings = { ...this._dialogSettings, enableDuplicateStackUI: v };
      },
      onSortModeChange: (feature, mode) => {
        this._dialogSettings = {
          ...this._dialogSettings,
          featureSortModes: { ...this._dialogSettings.featureSortModes, [feature]: mode },
        };
      },
      onSave: () => this._handleSettingsSave(),
      onClose: () => this._handleSettingsClose(),
      onReset: () => this._handleSettingsReset(),
      onKeydown: (e) => this._handleDialogKeydown(e),
    };

    return renderSettingsDialog(state, callbacks);
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'protspace-legend': ProtspaceLegend;
  }
}
