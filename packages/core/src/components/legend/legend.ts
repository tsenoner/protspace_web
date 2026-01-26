import { LitElement, html } from 'lit';
import { customElement, property, query, state } from 'lit/decorators.js';

// Configuration and styles
import {
  LEGEND_DEFAULTS,
  LEGEND_STYLES,
  FIRST_NUMBER_SORT_ANNOTATIONS,
  LEGEND_VALUES,
  LEGEND_EVENTS,
  toDisplayValue,
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
  initializeAnnotationSortMode,
  type SettingsDialogState,
  type SettingsDialogCallbacks,
} from './legend-settings-dialog';
import { renderOtherDialog } from './legend-other-dialog';
import { createFocusTrap } from './focus-trap';

// Types
import type {
  LegendDataInput,
  LegendAnnotationData,
  LegendItem,
  LegendSortMode,
  OtherItem,
  ScatterplotData,
  LegendPersistedSettings,
  PersistedCategoryData,
  LegendErrorEventDetail,
} from './types';

/**
 * Legend component for displaying and interacting with annotation categories.
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

  @property({ type: String }) annotationName = '';
  @property({ type: Object }) annotationData: LegendAnnotationData = { name: '', values: [] };
  @property({ type: Array }) annotationValues: (string | null)[] = [];
  @property({ type: Array }) proteinIds: string[] = [];
  @property({ type: Number, reflect: true }) maxVisibleValues: number =
    LEGEND_DEFAULTS.maxVisibleValues;
  @property({ type: Array }) selectedItems: string[] = [];
  @property({ type: Boolean, reflect: true }) isolationMode = false;
  @property({ type: Array }) isolationHistory: string[][] = [];
  @property({ type: Object }) data: LegendDataInput | null = null;
  @property({ type: String, reflect: true }) selectedAnnotation = '';
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
  @state() private _annotationSortModes: Record<string, LegendSortMode> = {};
  @state() private _showOtherDialog = false;
  @state() private _showSettingsDialog = false;
  @state() private _statusMessage = '';
  @state() private _colorPickerItem: string | null = null;
  @state() private _colorPickerPosition: { x: number; y: number } | null = null;

  // Pending extract/merge values for next update cycle.
  // undefined = no pending operation, string = value to extract/merge (including '__NA__' for N/A)
  private _pendingExtractValue: string | undefined = undefined;
  private _pendingMergeValue: string | undefined = undefined;

  // Settings dialog temporary state (consolidated into single object)
  @state() private _dialogSettings: {
    maxVisibleValues: number;
    includeShapes: boolean;
    shapeSize: number;
    enableDuplicateStackUI: boolean;
    annotationSortModes: Record<string, LegendSortMode>;
  } = {
    maxVisibleValues: LEGEND_DEFAULTS.maxVisibleValues,
    includeShapes: LEGEND_DEFAULTS.includeShapes,
    shapeSize: LEGEND_DEFAULTS.symbolSize,
    enableDuplicateStackUI: false,
    annotationSortModes: {},
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
    onDataChange: (data, annotation) => this._handleScatterplotDataChange(data, annotation),
    onAnnotationChange: (annotation) => this._handleAnnotationChange(annotation),
    getHiddenValues: () => this._hiddenValues,
    getOtherItems: () => this._otherItems,
    getLegendItems: () => this._legendItems,
    getEffectiveIncludeShapes: () => this._effectiveIncludeShapes,
    getOtherConcreteValues: () => computeOtherConcreteValues(this._otherItems),
  });

  private _persistenceController = new PersistenceController(this, {
    onSettingsLoaded: (settings) => this._applyPersistedSettings(settings),
    getLegendItems: () => this._legendItems,
    getHiddenValues: () => this._hiddenValues,
    getCurrentSettings: () => ({
      maxVisibleValues: this.maxVisibleValues,
      includeShapes: this.includeShapes,
      shapeSize: this.shapeSize,
      sortMode: this._annotationSortModes[this.selectedAnnotation] ?? 'size-desc',
      enableDuplicateStackUI: this._dialogSettings.enableDuplicateStackUI,
    }),
  });

  private _dragController = new DragController(this, {
    getLegendItems: () => this._legendItems,
    setLegendItems: (items) => {
      this._legendItems = items;
    },
    onReorder: () => {
      this._scatterplotController.dispatchZOrderChange();
      this._persistenceController.saveSettings();
      this.requestUpdate();
    },
    onMergeToOther: (value) => this._handleMergeToOther(value),
    onSortModeChange: (mode) => {
      this._annotationSortModes = {
        ...this._annotationSortModes,
        [this.selectedAnnotation]: mode,
      };
      this.requestUpdate();
    },
  });

  // ─────────────────────────────────────────────────────────────────
  // Keyboard Handler
  // ─────────────────────────────────────────────────────────────────

  private _onWindowKeydownCapture = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      // Close color picker first if open
      if (this._colorPickerItem !== null) {
        e.stopImmediatePropagation();
        e.preventDefault();
        this._colorPickerItem = null;
        return;
      }
      // Close Other dialog second if open
      if (this._showOtherDialog) {
        e.stopImmediatePropagation();
        e.preventDefault();
        this._showOtherDialog = false;
        return;
      }
      // Then close Settings dialog if open
      if (this._showSettingsDialog) {
        e.stopImmediatePropagation();
        e.preventDefault();
        this._handleSettingsClose();
        return;
      }
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
    return this._isMultilabelAnnotation() ? false : this.includeShapes;
  }

  private get _currentSortMode(): LegendSortMode {
    return (
      this._annotationSortModes[this.selectedAnnotation] ??
      (FIRST_NUMBER_SORT_ANNOTATIONS.has(this.selectedAnnotation) ? 'alpha-asc' : 'size-desc')
    );
  }

  /**
   * Get the set of currently visible values (from legend items, excluding "Other").
   * Used to preserve membership when sort mode changes.
   * N/A items use '__NA__' as their value.
   */
  private get _visibleValues(): Set<string> {
    const visible = new Set<string>();

    // Collect visible values from current _legendItems (excluding "Other")
    if (this._legendItems.length > 0) {
      this._legendItems.forEach((item) => {
        if (item.value !== LEGEND_VALUES.OTHER) {
          visible.add(item.value);
        }
      });
    }

    // If visible is empty but we have pendingCategories, use those instead.
    // This handles the case where _legendItems only has "Other" during restore.
    if (visible.size === 0) {
      const pendingCategories = this._persistenceController.pendingCategories;
      if (Object.keys(pendingCategories).length > 0) {
        for (const key of Object.keys(pendingCategories)) {
          if (key !== LEGEND_VALUES.OTHER) {
            visible.add(key);
          }
        }
      }
    }

    return visible;
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
    // Handle keyboard events for dialogs and color picker
    const dialogsChanged =
      changedProperties.has('_showSettingsDialog') ||
      changedProperties.has('_showOtherDialog') ||
      changedProperties.has('_colorPickerItem');
    if (dialogsChanged) {
      const anyDialogOpen =
        this._showSettingsDialog || this._showOtherDialog || this._colorPickerItem !== null;
      if (anyDialogOpen) {
        window.addEventListener('keydown', this._onWindowKeydownCapture, true);
      } else {
        window.removeEventListener('keydown', this._onWindowKeydownCapture, true);
      }
    }

    // Handle settings dialog focus trapping
    if (changedProperties.has('_showSettingsDialog')) {
      if (this._showSettingsDialog) {
        this._setupFocusTrap('legend-settings-dialog');
      } else if (!this._showOtherDialog) {
        this._cleanupFocusTrap();
      }
    }

    // Handle other dialog focus trapping
    if (changedProperties.has('_showOtherDialog')) {
      if (this._showOtherDialog) {
        this._setupFocusTrap('legend-other-dialog');
      } else if (!this._showSettingsDialog) {
        this._cleanupFocusTrap();
      }
    }

    // Update dataset hash when protein IDs change
    if (changedProperties.has('proteinIds') && this.proteinIds.length > 0) {
      const hashChanged = this._persistenceController.updateDatasetHash(this.proteinIds);
      // If hash changed and we have an annotation but settings weren't loaded yet,
      // try loading now (handles case where proteinIds arrives after data/selectedAnnotation)
      if (hashChanged && this.selectedAnnotation && !this._persistenceController.settingsLoaded) {
        this._persistenceController.loadSettings();
      }
    }

    // Handle data or annotation changes
    if (changedProperties.has('data') || changedProperties.has('selectedAnnotation')) {
      this._updateAnnotationDataFromData();
      this._ensureSortModeDefaults();

      const annotationChanged = this._persistenceController.updateSelectedAnnotation(
        this.selectedAnnotation,
      );
      if (annotationChanged || !this._persistenceController.settingsLoaded) {
        // Clear legend items before loading settings so _visibleValues falls back to pendingCategories
        if (annotationChanged) {
          this._legendItems = [];
        }
        this._persistenceController.loadSettings();
      }
    }

    // Update legend items when relevant properties change
    if (
      changedProperties.has('data') ||
      changedProperties.has('selectedAnnotation') ||
      changedProperties.has('annotationValues') ||
      changedProperties.has('proteinIds') ||
      changedProperties.has('maxVisibleValues') ||
      changedProperties.has('includeShapes')
    ) {
      this._updateLegendItems();

      if (this._persistenceController.hasPendingCategories()) {
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
    annotation: string;
    includeShapes: boolean;
    otherItemsCount: number;
    items: LegendItem[];
  } {
    return {
      annotation: this.annotationData.name || this.annotationName || 'Legend',
      includeShapes: this._effectiveIncludeShapes,
      otherItemsCount: this._otherItems.length,
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

  private _handleScatterplotDataChange(data: ScatterplotData, selectedAnnotation: string): void {
    this.data = { annotations: data.annotations };
    this.selectedAnnotation = selectedAnnotation;
    this.annotationData = {
      name: selectedAnnotation,
      values: data.annotations[selectedAnnotation].values,
    };
    this._updateAnnotationValues(data, selectedAnnotation);
    this.proteinIds = data.protein_ids;

    // Sync isolation state
    const { isolationMode, isolationHistory } = this._scatterplotController.getIsolationState();
    this.isolationMode = isolationMode;
    this.isolationHistory = isolationHistory;
  }

  private _handleAnnotationChange(annotation: string): void {
    this.selectedAnnotation = annotation;
    this._hiddenValues = [];
    this._scatterplotController.forceSync();
  }

  private _updateAnnotationDataFromData(): void {
    const annotationInfo = this.data?.annotations?.[this.selectedAnnotation] ?? null;
    this.annotationData = annotationInfo
      ? { name: this.selectedAnnotation, values: annotationInfo.values }
      : { name: '', values: [] };
  }

  private _updateAnnotationValues(data: ScatterplotData, selectedAnnotation: string): void {
    const annotationValues = data.protein_ids.flatMap((_: string, index: number) => {
      const annotationIdxData = data.annotation_data[selectedAnnotation][index];
      const annotationIdxArray = Array.isArray(annotationIdxData)
        ? annotationIdxData
        : [annotationIdxData];
      return annotationIdxArray
        .map((annotationIdx: number) => data.annotations[selectedAnnotation].values[annotationIdx])
        .filter((v) => v != null);
    });
    this.annotationValues = annotationValues;
  }

  private _ensureSortModeDefaults(): void {
    const annotationNames = this.data?.annotations ? Object.keys(this.data.annotations) : [];
    if (annotationNames.length === 0) return;

    const updated: Record<string, LegendSortMode> = { ...this._annotationSortModes };
    for (const aname of annotationNames) {
      if (!(aname in updated)) {
        updated[aname] = FIRST_NUMBER_SORT_ANNOTATIONS.has(aname) ? 'alpha-asc' : 'size-desc';
      }
    }
    this._annotationSortModes = updated;
  }

  private _isMultilabelAnnotation(): boolean {
    return this._scatterplotController.isMultilabelAnnotation(this.selectedAnnotation);
  }

  // ─────────────────────────────────────────────────────────────────
  // Legend Item Processing
  // ─────────────────────────────────────────────────────────────────

  private _updateLegendItems(): void {
    if (!this.annotationData?.values?.length || !this.annotationValues?.length) {
      this._legendItems = [];
      return;
    }

    try {
      // Get persisted categories from persistence controller
      const persistedCategories = this._persistenceController.pendingCategories;

      // Get pending values for extract/merge operations
      // undefined = no pending operation, string = value (including '__NA__' for N/A)
      const pendingExtract = this._pendingExtractValue;
      const pendingMerge = this._pendingMergeValue;

      // Use visibleValues when there are persisted settings OR when there are pending operations.
      // When there are pending merge/extract operations, we need the current visible set
      // to properly filter items even if localStorage hasn't been written yet.
      // When no localStorage key exists and no pending ops, use empty set so maxVisibleValues is respected.
      const hasPendingOps = pendingExtract !== undefined || pendingMerge !== undefined;
      const visibleValues =
        this._persistenceController.hasPersistedSettings() || hasPendingOps
          ? this._visibleValues
          : new Set<string>();

      const { legendItems, otherItems } = LegendDataProcessor.processLegendItems(
        this._processorContext,
        this.annotationData.name || this.selectedAnnotation,
        this.annotationValues,
        this.proteinIds,
        this.maxVisibleValues,
        this.isolationMode,
        this.isolationHistory,
        this._legendItems,
        this._currentSortMode,
        this._effectiveIncludeShapes,
        persistedCategories,
        visibleValues,
        pendingExtract,
        pendingMerge,
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

      // Clear pending extract/merge values after they've been applied
      this._pendingExtractValue = undefined;
      this._pendingMergeValue = undefined;
      // Note: We do NOT clear pendingCategories here because subsequent update cycles
      // (triggered by property changes in _applyPersistedSettings) may rebuild legend items
      // and need the persisted colors/shapes. Categories are cleared when loadSettings()
      // is called for a new annotation.

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
      this.includeShapes = settings.includeShapes;
      this.shapeSize = settings.shapeSize;
      this._hiddenValues = settings.hiddenValues;

      this._annotationSortModes = {
        ...this._annotationSortModes,
        [this.selectedAnnotation]: settings.sortMode,
      };

      this._scatterplotController.updateConfig({
        pointSize: calculatePointSize(this.shapeSize),
        enableDuplicateStackUI: settings.enableDuplicateStackUI,
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

  private _handleItemClick(value: string): void {
    const valueKey = valueToKey(value);
    const result = updateItemsVisibility(this._legendItems, this._hiddenValues, valueKey);

    this._legendItems = result.items;
    this._hiddenValues = result.hiddenValues;

    const item = this._legendItems.find((i) => valueToKey(i.value) === valueKey);
    this._announceStatus(`${toDisplayValue(value)} ${item?.isVisible ? 'shown' : 'hidden'}`);

    this._scatterplotController.syncHiddenValues();
    this._dispatchItemAction(value, 'toggle');
    this._persistenceController.saveSettings();
    this.requestUpdate();
  }

  private _handleItemDoubleClick(value: string): void {
    const result = isolateItem(this._legendItems, value);

    this._legendItems = result.items;
    this._hiddenValues = result.hiddenValues;

    const visibleCount = result.items.filter((i) => i.isVisible).length;
    this._announceStatus(
      visibleCount === 1 ? `Isolated ${toDisplayValue(value)}` : 'All items shown',
    );

    this._scatterplotController.syncHiddenValues();
    this._dispatchItemAction(value, 'isolate');
    this._persistenceController.saveSettings();
    this.requestUpdate();
  }

  private _handleExtractFromOther(value: string): void {
    // Set pending extract value - will be used by processor to add this item to visible set
    this._pendingExtractValue = value;

    // Increase maxVisibleValues to accommodate the extracted item
    // This triggers updated() which calls _updateLegendItems() with pending value still set
    this.maxVisibleValues = this.maxVisibleValues + 1;

    // Don't call _updateLegendItems() explicitly - the maxVisibleValues change will trigger
    // updated() which calls it. If we call it here, it will be called twice and the
    // pending value will be cleared after the first call, causing the second call to not
    // respect the extract operation.
    this._showOtherDialog = false;

    this._announceStatus(`Extracted ${toDisplayValue(value)} from Other category`);
    this._dispatchItemAction(value, 'extract');
    // Save settings after the update cycle completes
    this.updateComplete.then(() => {
      this._persistenceController.saveSettings();
    });
  }

  private _handleMergeToOther(value: string): void {
    // Set pending merge value - will be used by processor to remove this item from visible set
    this._pendingMergeValue = value;

    // Decrease maxVisibleValues to remove space for the merged item
    // This triggers updated() which calls _updateLegendItems() with pending value still set
    this.maxVisibleValues = Math.max(1, this.maxVisibleValues - 1);

    // Don't call _updateLegendItems() explicitly - the maxVisibleValues change will trigger
    // updated() which calls it. If we call it here, it will be called twice and the
    // pending value will be cleared after the first call, causing the second call to not
    // respect the merge operation.

    this._announceStatus(`Moved ${toDisplayValue(value)} to Other category`);
    // Save settings after the update cycle completes
    this.updateComplete.then(() => {
      this._persistenceController.saveSettings();
    });
  }

  private _reverseZOrder(): void {
    if (this._legendItems.length <= 1) return;

    const currentMode = this._currentSortMode;

    // Toggle direction: asc <-> desc, or manual <-> manual-reverse
    let newMode: LegendSortMode;
    if (currentMode === 'manual') {
      newMode = 'manual-reverse';
    } else if (currentMode === 'manual-reverse') {
      newMode = 'manual';
    } else if (currentMode.endsWith('-asc')) {
      newMode = currentMode.replace('-asc', '-desc') as LegendSortMode;
    } else {
      newMode = currentMode.replace('-desc', '-asc') as LegendSortMode;
    }

    // Update sort mode
    this._annotationSortModes = {
      ...this._annotationSortModes,
      [this.selectedAnnotation]: newMode,
    };

    // Always reverse the visible items directly, keeping "Other" at the end.
    // This preserves which items are visible vs in "Other" - we only change display order.
    const sorted = [...this._legendItems].sort((a, b) => a.zOrder - b.zOrder);
    const otherItem = sorted.find((i) => i.value === LEGEND_VALUES.OTHER);
    const nonOther = sorted.filter((i) => i.value !== LEGEND_VALUES.OTHER);

    // Reverse non-Other items
    const reversed = nonOther.reverse();
    const reordered = otherItem ? [...reversed, otherItem] : reversed;

    // Reassign zOrders
    this._legendItems = reordered.map((item, idx) => ({ ...item, zOrder: idx }));

    this._scatterplotController.dispatchZOrderChange();
    this._persistenceController.saveSettings();
    this.requestUpdate();
  }

  private _dispatchItemAction(value: string, action: 'toggle' | 'isolate' | 'extract'): void {
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
      includeShapes: this.includeShapes,
      shapeSize: this.shapeSize,
      annotationSortModes: this._annotationSortModes,
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

  private _handleSymbolClick(item: LegendItem, event: MouseEvent): void {
    event.stopPropagation();

    // Close if clicking the same item
    if (this._colorPickerItem === item.value) {
      this._colorPickerItem = null;
      return;
    }

    // Calculate position relative to the legend container
    const container = this.shadowRoot?.querySelector('.legend-container');
    if (!container) return;

    const containerRect = container.getBoundingClientRect();
    const targetRect = (event.currentTarget as HTMLElement).getBoundingClientRect();

    this._colorPickerPosition = {
      x: targetRect.left - containerRect.left + targetRect.width + 8,
      y: targetRect.top - containerRect.top,
    };
    this._colorPickerItem = item.value;
    this.requestUpdate();
  }

  private _handleSettingsSave(): void {
    this.maxVisibleValues = this._dialogSettings.maxVisibleValues;
    this.includeShapes = this._dialogSettings.includeShapes;
    this.shapeSize = this._dialogSettings.shapeSize;
    this._annotationSortModes = this._dialogSettings.annotationSortModes;
    this._showSettingsDialog = false;

    // Don't clear _legendItems - we want to preserve current zOrders when switching sort modes.
    // This ensures switching to manual mode keeps the current display order.
    this._updateLegendItems();
    this._scatterplotController.syncHiddenValues();
    this._scatterplotController.updateConfig({
      pointSize: calculatePointSize(this.shapeSize),
      enableDuplicateStackUI: this._dialogSettings.enableDuplicateStackUI,
    });
    this._persistenceController.saveSettings();
    this.requestUpdate();
  }

  private _handleColorChange(value: string, newColor: string): void {
    // Update the color immediately
    this._legendItems = this._legendItems.map((item) =>
      item.value === value ? { ...item, color: newColor } : item,
    );

    // Sync to persistence
    this._syncLegendColorsToPersistence();

    // Update scatterplot and save
    this._scatterplotController.dispatchColorMappingChange();
    this._persistenceController.saveSettings();
    this.requestUpdate();
  }

  private _handleSettingsClose(): void {
    this._showSettingsDialog = false;
  }

  private _handleSettingsReset(): void {
    // Remove localStorage and clear pending categories
    this._persistenceController.removeSettings();
    this._persistenceController.clearPendingCategories();

    // Reset all settings to defaults
    this.maxVisibleValues = LEGEND_DEFAULTS.maxVisibleValues;
    this.includeShapes = LEGEND_DEFAULTS.includeShapes;
    this.shapeSize = LEGEND_DEFAULTS.symbolSize;

    this._annotationSortModes = {
      ...this._annotationSortModes,
      [this.selectedAnnotation]: getDefaultSortMode(this.selectedAnnotation),
    };

    this._hiddenValues = [];

    // Reset slot tracker so colors are reassigned from scratch
    this._processorContext.slotTracker.reset();

    // Clear legend items so processor creates fresh ones with default colors
    this._legendItems = [];

    this._showSettingsDialog = false;

    this._scatterplotController.updateConfig({
      pointSize: calculatePointSize(LEGEND_DEFAULTS.symbolSize),
      enableDuplicateStackUI: false,
    });

    this._updateLegendItems();
    this._scatterplotController.dispatchColorMappingChange();
    this.requestUpdate();
  }

  private _handleDialogKeydown(e: KeyboardEvent): void {
    if (e.key === 'Enter') {
      e.stopImmediatePropagation();
      e.preventDefault();
      this._handleSettingsSave();
    }
  }

  private _syncLegendColorsToPersistence(): void {
    const categories: Record<string, PersistedCategoryData> = {};
    this._legendItems.forEach((item) => {
      if (item.value !== LEGEND_VALUES.OTHER) {
        categories[item.value] = {
          zOrder: item.zOrder,
          color: item.color,
          shape: item.shape,
        };
      }
    });
    this._persistenceController.setPendingCategories(categories);
  }

  // ─────────────────────────────────────────────────────────────────
  // Rendering
  // ─────────────────────────────────────────────────────────────────

  render() {
    const title = this.annotationData.name || this.annotationName || 'Legend';

    return html`
      <div
        class="legend-container"
        part="container"
        @click=${() => {
          this._colorPickerItem = null;
        }}
      >
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
        ${this._renderColorPicker()}
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
        onSymbolClick:
          item.value !== LEGEND_VALUES.OTHER
            ? (e: MouseEvent) => this._handleSymbolClick(item, e)
            : undefined,
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

    // Initialize sort mode for current annotation if needed
    this._dialogSettings = {
      ...this._dialogSettings,
      annotationSortModes: initializeAnnotationSortMode(
        this._dialogSettings.annotationSortModes,
        this.selectedAnnotation,
        this._annotationSortModes,
      ),
    };

    const state: SettingsDialogState = {
      maxVisibleValues: this._dialogSettings.maxVisibleValues,
      shapeSize: this._dialogSettings.shapeSize,
      includeShapes: this._dialogSettings.includeShapes,
      enableDuplicateStackUI: this._dialogSettings.enableDuplicateStackUI,
      selectedAnnotation: this.selectedAnnotation,
      annotationSortModes: this._dialogSettings.annotationSortModes,
      isMultilabelAnnotation: this._isMultilabelAnnotation(),
      hasPersistedSettings: this._persistenceController.hasPersistedSettings(),
    };

    const callbacks: SettingsDialogCallbacks = {
      onMaxVisibleValuesChange: (v) => {
        this._dialogSettings = { ...this._dialogSettings, maxVisibleValues: v };
      },
      onShapeSizeChange: (v) => {
        this._dialogSettings = { ...this._dialogSettings, shapeSize: v };
      },
      onIncludeShapesChange: (v) => {
        this._dialogSettings = { ...this._dialogSettings, includeShapes: v };
      },
      onEnableDuplicateStackUIChange: (v) => {
        this._dialogSettings = { ...this._dialogSettings, enableDuplicateStackUI: v };
      },
      onSortModeChange: (annotation, mode) => {
        this._dialogSettings = {
          ...this._dialogSettings,
          annotationSortModes: { ...this._dialogSettings.annotationSortModes, [annotation]: mode },
        };
      },
      onSave: () => this._handleSettingsSave(),
      onClose: () => this._handleSettingsClose(),
      onReset: () => this._handleSettingsReset(),
      onKeydown: (e) => this._handleDialogKeydown(e),
    };

    return renderSettingsDialog(state, callbacks);
  }

  private _renderColorPicker() {
    if (this._colorPickerItem === null || !this._colorPickerPosition) {
      return html``;
    }

    const item = this._legendItems.find((i) => i.value === this._colorPickerItem);
    if (!item) return html``;

    const displayLabel = toDisplayValue(item.value);

    return html`
      <div
        class="color-picker-popover"
        style="left: ${this._colorPickerPosition.x}px; top: ${this._colorPickerPosition.y}px;"
        @click=${(e: Event) => e.stopPropagation()}
      >
        <div class="color-picker-header">${displayLabel}</div>
        <div class="color-picker-content">
          <input
            type="color"
            class="color-picker-swatch"
            .value=${item.color}
            @input=${(e: Event) =>
              this._handleColorChange(item.value, (e.target as HTMLInputElement).value)}
          />
          <input
            type="text"
            class="color-picker-input"
            .value=${item.color.toUpperCase()}
            spellcheck="false"
            @input=${(e: Event) => {
              const value = (e.target as HTMLInputElement).value;
              if (/^#[0-9A-Fa-f]{6}$/.test(value)) {
                this._handleColorChange(item.value, value);
              }
            }}
          />
        </div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'protspace-legend': ProtspaceLegend;
  }
}
