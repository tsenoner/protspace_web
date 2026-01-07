import { LitElement, html } from 'lit';
import { customElement, property, query, state } from 'lit/decorators.js';
import {
  generateDatasetHash,
  buildStorageKey,
  getStorageItem,
  setStorageItem,
  removeStorageItem,
} from '@protspace/utils';

// Import types and configuration
import { LEGEND_DEFAULTS, LEGEND_STYLES, FIRST_NUMBER_SORT_FEATURES } from './config';
import { legendStyles } from './legend.styles';
import { LegendDataProcessor } from './legend-data-processor';
import { LegendRenderer } from './legend-renderer';
import { LegendUtils } from './legend-utils';
import type {
  LegendDataInput,
  LegendFeatureData,
  LegendItem,
  LegendSortMode,
  OtherItem,
  ScatterplotElement,
  ScatterplotData,
  LegendPersistedSettings,
} from './types';

@customElement('protspace-legend')
export class ProtspaceLegend extends LitElement {
  static styles = legendStyles;

  @property({ type: String }) featureName = '';
  @property({ type: Object }) featureData: LegendFeatureData = {
    name: '',
    values: [] as (string | null)[],
  };
  @property({ type: Array }) featureValues: (string | null)[] = [];
  @property({ type: Array }) proteinIds: string[] = [];
  @property({ type: Number }) maxVisibleValues: number = LEGEND_DEFAULTS.maxVisibleValues;
  @property({ type: Array }) selectedItems: string[] = [];
  @property({ type: Boolean }) isolationMode = false;
  @property({ type: Array }) isolationHistory: string[][] = [];

  // Additional properties for wrapper compatibility
  @property({ type: Object }) data: LegendDataInput | null = null;
  @property({ type: String }) selectedFeature = '';

  @state() private legendItems: LegendItem[] = [];
  @state() private otherItems: OtherItem[] = [];
  @state() private showOtherDialog = false;
  @state() private showSettingsDialog = false;
  @state() private draggedItemIndex: number = -1;
  @state() private dragTimeout: number | null = null;
  @state() private settingsMaxVisibleValues: number = LEGEND_DEFAULTS.maxVisibleValues;
  @property({ type: Boolean }) includeOthers: boolean = LEGEND_DEFAULTS.includeOthers;
  @state() private settingsIncludeOthers: boolean = LEGEND_DEFAULTS.includeOthers;
  @property({ type: Boolean }) includeShapes: boolean = LEGEND_DEFAULTS.includeShapes;
  @state() private settingsIncludeShapes: boolean = LEGEND_DEFAULTS.includeShapes;
  @property({ type: Number }) shapeSize: number = LEGEND_DEFAULTS.symbolSize;
  @state() private settingsShapeSize: number = LEGEND_DEFAULTS.symbolSize;
  @state() private settingsEnableDuplicateStackUI: boolean = false;
  @state() private manualOtherValues: string[] = [];
  @state() private featureSortModes: Record<string, LegendSortMode> = {};
  @state() private settingsFeatureSortModes: Record<string, LegendSortMode> = {};

  // Auto-sync properties
  @property({ type: String, attribute: 'scatterplot-selector' })
  scatterplotSelector: string = LEGEND_DEFAULTS.scatterplotSelector;
  @property({ type: Boolean, attribute: 'auto-sync' })
  autoSync: boolean = true;
  @property({ type: Boolean, attribute: 'auto-hide' })
  autoHide: boolean = true; // Automatically hide values in scatterplot

  @state() private _hiddenValues: string[] = [];
  @state() private _scatterplotElement: Element | null = null;
  @state() private _datasetHash: string = '';
  @state() private _settingsLoaded: boolean = false;

  @query('#legend-settings-dialog')
  private _settingsDialogEl?: HTMLDivElement;

  private _onWindowKeydownCapture = (e: KeyboardEvent) => {
    if (!this.showSettingsDialog) return;

    if (e.key === 'Escape') {
      e.stopImmediatePropagation();
      e.preventDefault();
      this._handleSettingsClose();
    }
  };

  updated(changedProperties: Map<string, unknown>) {
    if (changedProperties.has('showSettingsDialog')) {
      if (this.showSettingsDialog) {
        window.addEventListener('keydown', this._onWindowKeydownCapture, true);
      } else {
        window.removeEventListener('keydown', this._onWindowKeydownCapture, true);
      }
    }

    // Update dataset hash when protein IDs change
    if (changedProperties.has('proteinIds') && this.proteinIds.length > 0) {
      this._updateDatasetHash(this.proteinIds);
    }

    // If data or selectedFeature changed, update featureData and load persisted settings
    if (changedProperties.has('data') || changedProperties.has('selectedFeature')) {
      this._updateFeatureDataFromData();
      this._ensureSortModeDefaults();

      // Load persisted settings for this dataset+feature combination
      // Only load if we have a dataset hash and haven't loaded settings yet for this feature
      if (this._datasetHash && this.selectedFeature && !this._settingsLoaded) {
        this._loadPersistedSettings();
      } else if (changedProperties.has('selectedFeature') && this._datasetHash) {
        // Feature changed - reset settings loaded flag and load new settings
        this._settingsLoaded = false;
        this._loadPersistedSettings();
      } else {
        // No persisted settings - reset to defaults
        this.manualOtherValues = [];
      }
    }

    if (
      changedProperties.has('data') ||
      changedProperties.has('selectedFeature') ||
      changedProperties.has('featureValues') ||
      changedProperties.has('proteinIds') ||
      changedProperties.has('maxVisibleValues') ||
      changedProperties.has('includeOthers') ||
      changedProperties.has('includeShapes')
    ) {
      this.updateLegendItems();

      // Apply pending z-order after legend items are created
      if (Object.keys(this._pendingZOrderMapping).length > 0) {
        this._applyPendingZOrder();
      }
    }
  }

  /**
   * Check if the current feature is multilabel (any protein has multiple values)
   * Mirrors the scatterplot renderer logic: colors.length > 1 means multilabel
   */
  private _isMultilabelFeature(): boolean {
    const currentData = (this._scatterplotElement as ScatterplotElement)?.getCurrentData?.();
    const featureData = currentData?.feature_data?.[this.selectedFeature];

    return (
      Array.isArray(featureData) &&
      featureData.some((data) => Array.isArray(data) && data.length > 1)
    );
  }

  /**
   * Public accessor for export consumers (PNG/PDF) to read the exact legend
   * state as currently rendered, including the synthetic "Other" bucket.
   * Returned items are sorted by z-order and include visibility flags.
   */
  public getLegendExportData(): {
    feature: string;
    includeShapes: boolean;
    items: Array<{
      value: string | null | 'Other';
      color: string;
      shape: string;
      count: number;
      isVisible: boolean;
      zOrder: number;
      extractedFromOther?: boolean;
    }>;
  } {
    const sorted = [...this.legendItems].sort((a, b) => a.zOrder - b.zOrder);
    const isMultilabel = this._isMultilabelFeature();
    return {
      feature: this.featureData.name || this.featureName || 'Legend',
      includeShapes: isMultilabel ? false : this.includeShapes,
      items: sorted.map((i) => ({ ...i })),
    };
  }

  connectedCallback() {
    super.connectedCallback();

    if (this.autoSync) {
      this._setupAutoSync();
    }
  }

  disconnectedCallback() {
    window.removeEventListener('keydown', this._onWindowKeydownCapture, true);
    super.disconnectedCallback();

    if (this._scatterplotElement) {
      this._scatterplotElement.removeEventListener(
        'data-change',
        this._handleDataChange.bind(this),
      );
      this._scatterplotElement.removeEventListener(
        'feature-change',
        this._handleFeatureChange.bind(this),
      );
    }
  }

  private _handleSettingsSave() {
    // Apply and close
    this.maxVisibleValues = this.settingsMaxVisibleValues;
    this.includeOthers = this.settingsIncludeOthers;
    this.includeShapes = this.settingsIncludeShapes;
    this.shapeSize = this.settingsShapeSize;
    // apply sorting preferences
    this.featureSortModes = this.settingsFeatureSortModes;
    this.showSettingsDialog = false;
    // Note: We preserve _hiddenValues and manualOtherValues across settings changes
    // Only clear legendItems to force recalculation with new settings
    this.legendItems = [];

    if (
      this.autoHide &&
      this._scatterplotElement &&
      'hiddenFeatureValues' in this._scatterplotElement
    ) {
      (this._scatterplotElement as ScatterplotElement).hiddenFeatureValues = [];
    }
    this.updateLegendItems();
    this.requestUpdate();

    // Update scatterplot point sizes to match shape size (approximate mapping)
    if (this._scatterplotElement && 'config' in this._scatterplotElement) {
      // d3.symbol size is area; approximate by multiplying pixel size by the same multiplier used in legend
      const baseSize = Math.max(
        10,
        Math.round(this.shapeSize * LEGEND_DEFAULTS.symbolSizeMultiplier),
      );
      const scatterplot = this._scatterplotElement as ScatterplotElement & {
        config: Record<string, unknown>;
      };
      const currentConfig = scatterplot.config || {};
      scatterplot.config = {
        ...currentConfig,
        pointSize: baseSize,
        enableDuplicateStackUI: this.settingsEnableDuplicateStackUI,
      };
    }

    // Persist settings to localStorage
    this._persistSettings();
  }

  private _handleSettingsClose() {
    this.showSettingsDialog = false;
  }

  private _handleDialogKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter') {
      e.stopImmediatePropagation();
      e.preventDefault();
      this._handleSettingsSave();
    }
  }

  private _handleSettingsReset() {
    // Remove persisted settings from localStorage
    const key = this._getStorageKey();
    if (key) {
      removeStorageItem(key);
    }

    // Reset all settings to defaults
    this.maxVisibleValues = LEGEND_DEFAULTS.maxVisibleValues;
    this.includeOthers = LEGEND_DEFAULTS.includeOthers;
    this.includeShapes = LEGEND_DEFAULTS.includeShapes;
    this.shapeSize = LEGEND_DEFAULTS.symbolSize;

    // Reset sort mode for current feature
    const defaultSortMode = FIRST_NUMBER_SORT_FEATURES.has(this.selectedFeature) ? 'alpha' : 'size';
    this.featureSortModes = {
      ...this.featureSortModes,
      [this.selectedFeature]: defaultSortMode,
    };

    // Clear customizations
    this._hiddenValues = [];
    this.manualOtherValues = [];
    this._pendingZOrderMapping = {};
    this.legendItems = [];

    // Close dialog
    this.showSettingsDialog = false;

    // Clear scatterplot hidden values
    if (
      this.autoHide &&
      this._scatterplotElement &&
      'hiddenFeatureValues' in this._scatterplotElement
    ) {
      (this._scatterplotElement as ScatterplotElement).hiddenFeatureValues = [];
    }

    // Update scatterplot config to defaults
    if (this._scatterplotElement && 'config' in this._scatterplotElement) {
      const baseSize = Math.max(
        10,
        Math.round(LEGEND_DEFAULTS.symbolSize * LEGEND_DEFAULTS.symbolSizeMultiplier),
      );
      const scatterplot = this._scatterplotElement as ScatterplotElement & {
        config: Record<string, unknown>;
      };
      const currentConfig = scatterplot.config || {};
      scatterplot.config = {
        ...currentConfig,
        pointSize: baseSize,
        enableDuplicateStackUI: false,
      };
    }

    // Recalculate legend items with default settings
    this.updateLegendItems();
    this.requestUpdate();
  }

  private _setupAutoSync() {
    // Find scatterplot element
    setTimeout(() => {
      this._scatterplotElement = document.querySelector(this.scatterplotSelector);
      if (this._scatterplotElement) {
        // Listen for data and feature changes
        this._scatterplotElement.addEventListener('data-change', this._handleDataChange.bind(this));

        // Listen for feature changes from control bar
        const controlBar = document.querySelector('protspace-control-bar');
        if (controlBar) {
          controlBar.addEventListener('feature-change', this._handleFeatureChange.bind(this));
        }

        // Initial sync
        this._syncWithScatterplot();
      }
    }, LEGEND_DEFAULTS.autoSyncDelay);
  }

  private _handleDataChange(event: Event) {
    const customEvent = event as CustomEvent;
    const { data } = customEvent.detail;

    if (data) {
      this.data = { features: data.features };
      this._updateFromScatterplotData();
    }
  }

  private _updateFromScatterplotData(): void {
    if (!this._scatterplotElement || !('getCurrentData' in this._scatterplotElement)) {
      return;
    }

    const currentData = (this._scatterplotElement as ScatterplotElement).getCurrentData();
    const selectedFeature = (this._scatterplotElement as ScatterplotElement).selectedFeature;

    if (!currentData || !selectedFeature) {
      return;
    }

    this.selectedFeature = selectedFeature;
    this._updateFeatureData(currentData, selectedFeature);
    this._updateFeatureValues(currentData, selectedFeature);
    this.proteinIds = currentData.protein_ids;
  }

  private _updateFeatureData(currentData: ScatterplotData, selectedFeature: string): void {
    this.featureData = {
      name: selectedFeature,
      values: currentData.features[selectedFeature].values,
    };
  }

  private _updateFeatureValues(currentData: ScatterplotData, selectedFeature: string): void {
    // Extract feature values for current data
    const featureValues = currentData.protein_ids.flatMap((_: string, index: number) => {
      const featureIdxData = currentData.feature_data[selectedFeature][index];
      // Handle both array and single value cases
      const featureIdxArray = Array.isArray(featureIdxData) ? featureIdxData : [featureIdxData];
      return featureIdxArray
        .map((featureIdx: number) => {
          return currentData.features[selectedFeature].values[featureIdx];
        })
        .filter((v) => v != null);
    });

    this.featureValues = featureValues;
  }

  private _expandHiddenValues(hiddenValues: string[]): string[] {
    const expanded: string[] = [];

    for (const value of hiddenValues) {
      if (value === 'Other') {
        // Expand the synthetic Other bucket to its actual values
        for (const otherItem of this.otherItems) {
          if (otherItem.value === null) {
            expanded.push('null');
          } else {
            expanded.push(otherItem.value);
          }
        }
      } else {
        expanded.push(value);
      }
    }

    // De-duplicate in case of overlaps
    return Array.from(new Set(expanded));
  }

  private _handleFeatureChange(event: Event) {
    const customEvent = event as CustomEvent;
    const { feature } = customEvent.detail;

    this.selectedFeature = feature;

    // Clear hidden values when feature changes
    this._hiddenValues = [];
    this.manualOtherValues = [];
    if (
      this.autoHide &&
      this._scatterplotElement &&
      'hiddenFeatureValues' in this._scatterplotElement
    ) {
      (this._scatterplotElement as ScatterplotElement).hiddenFeatureValues = [];
    }

    // Update feature values for new feature
    this._syncWithScatterplot();
  }

  private _updateFeatureDataFromData() {
    const featureInfo = this.data?.features?.[this.selectedFeature] ?? null;

    this.featureData = featureInfo
      ? { name: this.selectedFeature, values: featureInfo.values }
      : { name: '', values: [] };
  }

  private _ensureSortModeDefaults() {
    const featureNames = this.data?.features ? Object.keys(this.data.features) : [];
    if (featureNames.length === 0) return;
    const updated: Record<string, LegendSortMode> = {
      ...this.featureSortModes,
    };
    for (const fname of featureNames) {
      if (!(fname in updated)) {
        updated[fname] = FIRST_NUMBER_SORT_FEATURES.has(fname) ? 'alpha' : 'size';
      }
    }
    this.featureSortModes = updated;
  }

  /**
   * Generates a storage key for the current dataset and feature.
   */
  private _getStorageKey(): string | null {
    if (!this._datasetHash || !this.selectedFeature) {
      return null;
    }
    return buildStorageKey('legend', this._datasetHash, this.selectedFeature);
  }

  /**
   * Computes the dataset hash from protein IDs.
   * Should be called when protein IDs change (new dataset loaded).
   */
  private _updateDatasetHash(proteinIds: string[]): void {
    const newHash = generateDatasetHash(proteinIds);
    if (newHash !== this._datasetHash) {
      this._datasetHash = newHash;
      this._settingsLoaded = false; // Reset so settings are loaded for new dataset
    }
  }

  /**
   * Loads persisted settings for the current dataset and feature.
   * Returns default settings if none are found.
   */
  private _loadPersistedSettings(): void {
    const key = this._getStorageKey();
    if (!key) {
      return;
    }

    const defaultSettings: LegendPersistedSettings = {
      maxVisibleValues: LEGEND_DEFAULTS.maxVisibleValues,
      includeOthers: LEGEND_DEFAULTS.includeOthers,
      includeShapes: LEGEND_DEFAULTS.includeShapes,
      shapeSize: LEGEND_DEFAULTS.symbolSize,
      sortMode: FIRST_NUMBER_SORT_FEATURES.has(this.selectedFeature) ? 'alpha' : 'size',
      hiddenValues: [],
      manualOtherValues: [],
      zOrderMapping: {},
      enableDuplicateStackUI: LEGEND_DEFAULTS.enableDuplicateStackUI,
    };

    const saved = getStorageItem<LegendPersistedSettings>(key, defaultSettings);

    // Apply persisted settings
    this.maxVisibleValues = saved.maxVisibleValues;
    this.includeOthers = saved.includeOthers;
    this.includeShapes = saved.includeShapes;
    this.shapeSize = saved.shapeSize;
    this._hiddenValues = saved.hiddenValues;
    this.manualOtherValues = saved.manualOtherValues;

    // Apply sort mode for current feature
    this.featureSortModes = {
      ...this.featureSortModes,
      [this.selectedFeature]: saved.sortMode,
    };

    // Store z-order mapping to apply after legend items are created
    this._pendingZOrderMapping = saved.zOrderMapping;
    this._settingsLoaded = true;

    // Update scatterplot config if element exists
    if (this._scatterplotElement && 'config' in this._scatterplotElement) {
      const baseSize = Math.max(
        10,
        Math.round(this.shapeSize * LEGEND_DEFAULTS.symbolSizeMultiplier),
      );
      const scatterplot = this._scatterplotElement as ScatterplotElement & {
        config: Record<string, unknown>;
      };
      const currentConfig = scatterplot.config || {};
      scatterplot.config = {
        ...currentConfig,
        pointSize: baseSize,
        enableDuplicateStackUI: saved.enableDuplicateStackUI ?? false,
      };
    }
  }

  // Temporary storage for z-order mapping to apply after legend items are created
  private _pendingZOrderMapping: Record<string, number> = {};

  /**
   * Applies pending z-order mapping to legend items after they are created.
   */
  private _applyPendingZOrder(): void {
    if (Object.keys(this._pendingZOrderMapping).length === 0 || this.legendItems.length === 0) {
      return;
    }

    // Apply z-order from persisted mapping
    const hasMapping = this.legendItems.some(
      (item) => item.value !== null && this._pendingZOrderMapping[item.value] !== undefined,
    );

    if (hasMapping) {
      this.legendItems = this.legendItems.map((item) => {
        if (item.value !== null && this._pendingZOrderMapping[item.value] !== undefined) {
          return { ...item, zOrder: this._pendingZOrderMapping[item.value] };
        }
        return item;
      });
    }

    // Clear pending mapping after applying
    this._pendingZOrderMapping = {};
  }

  /**
   * Persists current settings to localStorage.
   */
  private _persistSettings(): void {
    const key = this._getStorageKey();
    if (!key) {
      return;
    }

    // Build z-order mapping from current legend items
    const zOrderMapping: Record<string, number> = {};
    this.legendItems.forEach((item) => {
      if (item.value !== null) {
        zOrderMapping[item.value] = item.zOrder;
      }
    });

    // Get current enableDuplicateStackUI from scatterplot config
    const scatterplot = this._scatterplotElement as ScatterplotElement & {
      config?: Record<string, unknown>;
    };
    const enableDuplicateStackUI = Boolean(scatterplot?.config?.enableDuplicateStackUI);

    const settings: LegendPersistedSettings = {
      maxVisibleValues: this.maxVisibleValues,
      includeOthers: this.includeOthers,
      includeShapes: this.includeShapes,
      shapeSize: this.shapeSize,
      sortMode: this.featureSortModes[this.selectedFeature] ?? 'size',
      hiddenValues: this._hiddenValues,
      manualOtherValues: this.manualOtherValues,
      zOrderMapping,
      enableDuplicateStackUI,
    };

    setStorageItem(key, settings);
  }

  private _syncWithScatterplot() {
    if (!this._scatterplotElement || !('getCurrentData' in this._scatterplotElement)) {
      return;
    }

    const currentData = (this._scatterplotElement as ScatterplotElement).getCurrentData();
    const selectedFeature = (this._scatterplotElement as ScatterplotElement).selectedFeature;

    if (!currentData || !selectedFeature) {
      return;
    }

    this.data = { features: currentData.features };
    this.selectedFeature = selectedFeature;
    this._updateFeatureData(currentData, selectedFeature);
    this._updateFeatureValues(currentData, selectedFeature);
    this.proteinIds = currentData.protein_ids;

    // Sync isolation state from scatterplot
    if ('isIsolationMode' in this._scatterplotElement) {
      const scatterplot = this._scatterplotElement as ScatterplotElement & {
        isIsolationMode(): boolean;
      };
      this.isolationMode = scatterplot.isIsolationMode();
    }
    if ('getIsolationHistory' in this._scatterplotElement) {
      const scatterplot = this._scatterplotElement as ScatterplotElement & {
        getIsolationHistory(): string[][];
      };
      this.isolationHistory = scatterplot.getIsolationHistory();
    }
  }

  /**
   * Public method to force synchronization with the scatterplot
   * Useful when you need to ensure the legend is up-to-date after state changes
   */
  public forceSync() {
    this._syncWithScatterplot();
  }

  private updateLegendItems() {
    if (
      !this.featureData ||
      !this.featureData.values ||
      this.featureData.values.length === 0 ||
      !this.featureValues ||
      this.featureValues.length === 0
    ) {
      this.legendItems = [];
      return;
    }

    // Use the data processor to handle all legend item processing
    const sortMode: LegendSortMode =
      this.featureSortModes[this.selectedFeature] ??
      (FIRST_NUMBER_SORT_FEATURES.has(this.selectedFeature) ? 'alpha' : 'size');
    const isMultilabel = this._isMultilabelFeature();
    const effectiveIncludeShapes = isMultilabel ? false : this.includeShapes;
    const { legendItems, otherItems } = LegendDataProcessor.processLegendItems(
      this.featureData.name || this.selectedFeature,
      this.featureValues,
      this.proteinIds,
      this.maxVisibleValues,
      this.isolationMode,
      this.isolationHistory,
      this.legendItems,
      this.includeOthers,
      this.manualOtherValues,
      sortMode,
      effectiveIncludeShapes,
    );

    // Apply persisted hidden values to legend items' visibility
    if (this._hiddenValues.length > 0) {
      this.legendItems = legendItems.map((item) => ({
        ...item,
        isVisible: !this._hiddenValues.includes(item.value === null ? 'null' : item.value!),
      }));
    } else {
      this.legendItems = legendItems;
    }
    this.otherItems = otherItems;

    // Dispatch z-order change to update scatterplot rendering order
    this._dispatchZOrderChange();

    // Dispatch color/shape mapping to scatterplot for consistent rendering
    this._dispatchColorMappingChange();

    // Update scatterplot with current Other bucket value list for consistent coloring
    if (this._scatterplotElement && 'otherFeatureValues' in this._scatterplotElement) {
      (this._scatterplotElement as ScatterplotElement).otherFeatureValues = this.includeOthers
        ? this._computeOtherConcreteValues()
        : [];
    }

    // Update scatterplot to toggle shapes(except for multilabel features)
    if (this._scatterplotElement && 'useShapes' in this._scatterplotElement) {
      const isMultilabel = this._isMultilabelFeature();
      const effectiveIncludeShapes = isMultilabel ? false : this.includeShapes;
      (this._scatterplotElement as ScatterplotElement).useShapes = effectiveIncludeShapes;
    }

    // Sync hidden values to scatterplot
    this._syncHiddenValuesToScatterplot();
  }

  /**
   * Syncs the current hidden values to the scatterplot element.
   */
  private _syncHiddenValuesToScatterplot(): void {
    if (
      !this.autoHide ||
      !this._scatterplotElement ||
      !('hiddenFeatureValues' in this._scatterplotElement)
    ) {
      return;
    }

    const expandedHidden = this._expandHiddenValues(this._hiddenValues);
    (this._scatterplotElement as ScatterplotElement).hiddenFeatureValues = [...expandedHidden];

    if ('otherFeatureValues' in this._scatterplotElement) {
      (this._scatterplotElement as ScatterplotElement).otherFeatureValues =
        this._computeOtherConcreteValues();
    }
  }

  private handleItemClick(value: string | null) {
    const valueKey = value === null ? 'null' : value;

    // Compute proposed hidden values
    const proposedHiddenValues = this._hiddenValues.includes(valueKey)
      ? this._hiddenValues.filter((v) => v !== valueKey)
      : [...this._hiddenValues, valueKey];

    // Compute visibility after the toggle
    const proposedLegendItems = this.legendItems.map((item) => ({
      ...item,
      isVisible: !proposedHiddenValues.includes(item.value === null ? 'null' : item.value!),
    }));

    // If no items would remain visible, reset to show everything
    const anyVisible = proposedLegendItems.some((item) => item.isVisible);
    if (!anyVisible) {
      this._hiddenValues = [];
      this.legendItems = this.legendItems.map((item) => ({
        ...item,
        isVisible: true,
      }));
    } else {
      this._hiddenValues = proposedHiddenValues;
      this.legendItems = proposedLegendItems;
    }

    // Update scatterplot if auto-hide is enabled
    if (
      this.autoHide &&
      this._scatterplotElement &&
      'hiddenFeatureValues' in this._scatterplotElement
    ) {
      const expandedHidden = this._expandHiddenValues(this._hiddenValues);
      (this._scatterplotElement as ScatterplotElement).hiddenFeatureValues = [...expandedHidden];
      // Also provide the list of concrete values that are in the Other bucket
      if ('otherFeatureValues' in this._scatterplotElement) {
        (this._scatterplotElement as ScatterplotElement).otherFeatureValues =
          this._computeOtherConcreteValues();
      }
    }

    // Dispatch event for external listeners
    this.dispatchEvent(
      new CustomEvent('legend-item-click', {
        detail: { value, action: 'toggle' },
        bubbles: true,
        composed: true,
      }),
    );

    // Persist visibility changes
    this._persistSettings();

    this.requestUpdate();
  }

  // Handle item double-click (show only this or show all)
  private handleItemDoubleClick(value: string | null) {
    // Get the clicked item
    const clickedItem = this.legendItems.find((item) => item.value === value);
    if (!clickedItem) return;

    // Check if it's the only visible item
    const visibleItems = this.legendItems.filter((item) => item.isVisible);
    const isOnlyVisible = visibleItems.length === 1 && visibleItems[0].value === value;

    // Case 1: It's the only visible item - show all
    if (isOnlyVisible) {
      this.legendItems = this.legendItems.map((item) => ({
        ...item,
        isVisible: true,
      }));
    }
    // Case 2: Show only this item
    else {
      this.legendItems = this.legendItems.map((item) => ({
        ...item,
        isVisible: item.value === value,
      }));
    }

    // Update hidden values to reflect current visibility state
    const newHiddenValues = this.legendItems
      .filter((item) => !item.isVisible)
      .map((item) => (item.value === null ? 'null' : item.value!));

    this._hiddenValues = newHiddenValues;

    // Sync hidden values with scatterplot when enabled
    if (
      this.autoHide &&
      this._scatterplotElement &&
      'hiddenFeatureValues' in this._scatterplotElement
    ) {
      const expandedHidden = this._expandHiddenValues(this._hiddenValues);
      (this._scatterplotElement as ScatterplotElement).hiddenFeatureValues = [...expandedHidden];
      if ('otherFeatureValues' in this._scatterplotElement) {
        (this._scatterplotElement as ScatterplotElement).otherFeatureValues =
          this._computeOtherConcreteValues();
      }
    }

    // Dispatch "isolate" action for double click
    this.dispatchEvent(
      new CustomEvent('legend-item-click', {
        detail: { value, action: 'isolate' },
        bubbles: true,
        composed: true,
      }),
    );

    // Persist visibility changes
    this._persistSettings();

    this.requestUpdate();
  }

  // Simple drag and drop implementation
  private handleDragStart(item: LegendItem) {
    const index = this.legendItems.findIndex((i) => i.value === item.value);
    this.draggedItemIndex = index !== -1 ? index : -1;

    // Clear any existing timeout
    if (this.dragTimeout) {
      clearTimeout(this.dragTimeout);
    }
  }

  // Handle element drag over
  private handleDragOver(event: DragEvent, item: LegendItem) {
    event.preventDefault();

    if (this.draggedItemIndex === -1) return;

    const targetIndex = this.legendItems.findIndex((i) => i.value === item.value);
    if (this.draggedItemIndex === targetIndex) return;

    // Provide move hint to the browser
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = 'move';
    }

    // Use a debounced approach to prevent too many re-renders
    if (this.dragTimeout) {
      clearTimeout(this.dragTimeout);
    }

    this.dragTimeout = window.setTimeout(() => {
      this._performDragReorder(item);
    }, LEGEND_DEFAULTS.dragTimeout);
  }

  // Handle drop on a legend item (supports merging extracted items back into Other)
  private handleDrop(event: DragEvent, targetItem: LegendItem) {
    event.preventDefault();

    // Only handle special case when dropping onto "Other"
    if (targetItem.value === 'Other' && this.draggedItemIndex !== -1) {
      const draggedItem = this.legendItems[this.draggedItemIndex];

      if (!draggedItem) {
        this.handleDragEnd();
        return;
      }

      // If the item was previously extracted, use the original merge flow
      if (draggedItem.extractedFromOther && draggedItem.value) {
        this._mergeExtractedBackToOther(draggedItem.value);
      } else if (draggedItem.value && draggedItem.value !== 'Other') {
        // Manually move any non-null, non-Other value into Other
        if (!this.manualOtherValues.includes(draggedItem.value)) {
          this.manualOtherValues = [...this.manualOtherValues, draggedItem.value];
        }
        // Recompute legend to reflect manual move
        this.updateLegendItems();

        // Notify parent with "merge-into-other" action
        this.dispatchEvent(
          new CustomEvent('legend-item-click', {
            detail: { value: draggedItem.value, action: 'merge-into-other' },
            bubbles: true,
            composed: true,
          }),
        );

        // Persist manual other values
        this._persistSettings();
      }
    }

    // Final reordering is handled by the drag over logic

    this.handleDragEnd();
  }

  // Merge an extracted value back into the synthetic Other bucket
  private _mergeExtractedBackToOther(value: string) {
    this.legendItems = this.legendItems.filter((i) => i.value !== value);

    this.updateLegendItems();

    this.dispatchEvent(
      new CustomEvent('legend-item-click', {
        detail: { value, action: 'merge-into-other' },
        bubbles: true,
        composed: true,
      }),
    );

    // Persist changes
    this._persistSettings();

    this.requestUpdate();
  }

  private _performDragReorder(targetItem: LegendItem): void {
    // Find the target index
    const targetIdx = this.legendItems.findIndex((i) => i.value === targetItem.value);

    if (this.draggedItemIndex === -1 || targetIdx === -1) return;

    // Create a new array with the item moved
    const newItems = [...this.legendItems];
    const [movedItem] = newItems.splice(this.draggedItemIndex, 1);

    // Adjust target index if dragging forward (target is after dragged item)
    // After removing the dragged item, items after it shift down by 1
    const adjustedTargetIdx = targetIdx > this.draggedItemIndex ? targetIdx - 1 : targetIdx;
    newItems.splice(adjustedTargetIdx, 0, movedItem);

    // Update z-order
    this.legendItems = newItems.map((item, idx) => ({
      ...item,
      zOrder: idx,
    }));

    // Update dragged index to reflect new position
    this.draggedItemIndex = adjustedTargetIdx;

    // Notify parent of z-order change
    this._dispatchZOrderChange();

    // Persist z-order changes
    this._persistSettings();

    this.requestUpdate();
  }

  private _dispatchZOrderChange(): void {
    const zOrderMap: Record<string, number> = {};
    this.legendItems.forEach((legendItem) => {
      if (legendItem.value !== null) {
        zOrderMap[legendItem.value] = legendItem.zOrder;
      }
    });

    // Dispatch event directly to scatterplot element if available
    if (this._scatterplotElement) {
      this._scatterplotElement.dispatchEvent(
        new CustomEvent('legend-zorder-change', {
          detail: { zOrderMapping: zOrderMap },
          bubbles: false,
        }),
      );
    } else {
      // Fallback to bubbling event
      this.dispatchEvent(
        new CustomEvent('legend-zorder-change', {
          detail: { zOrderMapping: zOrderMap },
          bubbles: true,
        }),
      );
    }
  }

  private _dispatchColorMappingChange(): void {
    const colorMap: Record<string, string> = {};
    const shapeMap: Record<string, string> = {};

    this.legendItems.forEach((legendItem) => {
      const key = legendItem.value === null ? 'null' : legendItem.value;
      colorMap[key] = legendItem.color;
      shapeMap[key] = legendItem.shape;
    });

    // Dispatch event directly to scatterplot element if available
    if (this._scatterplotElement) {
      this._scatterplotElement.dispatchEvent(
        new CustomEvent('legend-colormapping-change', {
          detail: { colorMapping: colorMap, shapeMapping: shapeMap },
          bubbles: false,
        }),
      );
    } else {
      // Fallback to bubbling event
      this.dispatchEvent(
        new CustomEvent('legend-colormapping-change', {
          detail: { colorMapping: colorMap, shapeMapping: shapeMap },
          bubbles: true,
        }),
      );
    }
  }

  /**
   * Reverse the CURRENTLY DISPLAYED legend z-order, without re-bucketing items into "Other".
   * Keeps the synthetic "Other" item (if present) at the end.
   */
  private _reverseCurrentLegendZOrderKeepOtherLast(): void {
    if (!this.legendItems || this.legendItems.length <= 1) return;

    // Start from current rendered order (zOrder), not array order.
    const sorted = [...this.legendItems].sort((a, b) => a.zOrder - b.zOrder);
    const otherItem = sorted.find((i) => i.value === 'Other') ?? null;

    const reversed = sorted.filter((i) => i.value !== 'Other').reverse();
    const reordered = otherItem ? [...reversed, otherItem] : reversed;

    this.legendItems = reordered.map((item, idx) => ({ ...item, zOrder: idx }));
    this._dispatchZOrderChange();

    // Persist z-order changes
    this._persistSettings();

    this.requestUpdate();
  }

  private handleDragEnd() {
    this.draggedItemIndex = -1;

    // Clear timeout if any
    if (this.dragTimeout) {
      clearTimeout(this.dragTimeout);
      this.dragTimeout = null;
    }
  }

  // Handle extract from Other
  private handleExtractFromOther(value: string) {
    // Find this item in otherItems
    const itemToExtract = this.otherItems.find((item) => item.value === value);
    if (!itemToExtract) return;

    // If this value was manually assigned to Other, remove it from the manual list
    if (this.manualOtherValues.includes(value)) {
      this.manualOtherValues = this.manualOtherValues.filter((v) => v !== value);
    }

    // Create a new legend item using visual encoding
    const isMultilabel = this._isMultilabelFeature();
    const effectiveIncludeShapes = isMultilabel ? false : this.includeShapes;
    const newItem = LegendUtils.createExtractedItem(
      value,
      itemToExtract.count,
      this.legendItems.length,
      effectiveIncludeShapes,
    );

    // Add to the legend items
    this.legendItems = [...this.legendItems, newItem];

    // Recompute legend to remove the extracted value from Other and update counts
    this.updateLegendItems();

    // Close the dialog
    this.showOtherDialog = false;

    // Notify parent with "extract" action
    this.dispatchEvent(
      new CustomEvent('legend-item-click', {
        detail: { value, action: 'extract' },
        bubbles: true,
      }),
    );

    // Persist extracted values
    this._persistSettings();

    this.requestUpdate();
  }

  /**
   * Compute list of concrete values that belong to the synthetic "Other" bucket
   */
  private _computeOtherConcreteValues(): string[] {
    const values: string[] = [];
    for (const item of this.otherItems) {
      if (item.value === null) values.push('null');
      else values.push(item.value);
    }
    return values;
  }

  private async handleCustomize() {
    // Initialize settings value from current maxVisibleValues
    this.settingsMaxVisibleValues = this.maxVisibleValues;
    this.settingsIncludeOthers = this.includeOthers;
    this.settingsIncludeShapes = this.includeShapes;
    this.settingsShapeSize = this.shapeSize;
    // Initialize settings sort modes from current modes (normalize away deprecated reverse modes)
    const normalized: Record<string, LegendSortMode> = {};
    for (const [k, v] of Object.entries(this.featureSortModes)) {
      normalized[k] = v === 'alpha-desc' ? 'alpha' : v === 'size-asc' ? 'size' : v;
    }
    this.settingsFeatureSortModes = normalized;
    // Initialize from scatterplot config (default is off)
    const scatterplot = this._scatterplotElement as ScatterplotElement & {
      config?: Record<string, unknown>;
    };
    this.settingsEnableDuplicateStackUI = !!scatterplot?.config?.enableDuplicateStackUI;
    this.showSettingsDialog = true;

    // Keep event for backward compatibility
    this.dispatchEvent(
      new CustomEvent('legend-customize', {
        bubbles: true,
      }),
    );

    this.requestUpdate();
    await this.updateComplete;
    this._settingsDialogEl?.focus();
  }

  private renderOtherDialog() {
    if (!this.showOtherDialog) return html``;

    return html`
      <div class="modal-overlay" @click=${() => (this.showOtherDialog = false)}>
        <div class="modal-content" @click=${(e: Event) => e.stopPropagation()}>
          <div class="modal-header">
            <h3 class="modal-title">Extract from 'Other' category</h3>
            <button class="close-button" @click=${() => (this.showOtherDialog = false)}>
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

          <div class="modal-description">
            Select items to extract from the 'Other' category. Extracted items will appear
            individually in the legend.
          </div>

          <div class="other-items-list">
            ${this.otherItems.map(
              (item) => html`
                <div class="other-item">
                  <div class="other-item-info">
                    <span class="other-item-name">
                      ${item.value === null ||
                      (typeof item.value === 'string' && item.value.trim() === '')
                        ? 'N/A'
                        : item.value}
                    </span>
                    <span class="other-item-count">(${item.count})</span>
                  </div>
                  <button
                    class="extract-button"
                    @click=${() => {
                      if (item.value !== null) {
                        this.handleExtractFromOther(item.value);
                      }
                    }}
                  >
                    Extract
                  </button>
                </div>
              `,
            )}
          </div>

          <div class="modal-footer">
            <button class="modal-close-button" @click=${() => (this.showOtherDialog = false)}>
              Close
            </button>
          </div>
        </div>
      </div>
    `;
  }

  async downloadAsImage() {
    // This would need to be implemented with a library like html2canvas
    // For now, dispatch an event that the parent can handle
    this.dispatchEvent(
      new CustomEvent('legend-download', {
        bubbles: true,
      }),
    );
  }

  render() {
    const sortedLegendItems = [...this.legendItems].sort((a, b) => a.zOrder - b.zOrder);
    const title = this.featureData.name || this.featureName || 'Legend';

    return html`
      <div class="legend-container">
        ${LegendRenderer.renderHeader(title, {
          onReverse: () => this._reverseCurrentLegendZOrderKeepOtherLast(),
          onCustomize: () => this.handleCustomize(),
        })}
        ${LegendRenderer.renderLegendContent(sortedLegendItems, (item) =>
          this._renderLegendItem(item),
        )}
      </div>
      ${this.renderOtherDialog()} ${this.renderSettingsDialog()}
    `;
  }

  private _renderLegendItem(item: LegendItem) {
    const isItemSelected = this._isItemSelected(item);
    const itemClasses = this._getItemClasses(item, isItemSelected);

    // For multilabel features, always use circles (pie charts with shapes would be too complex)
    const isMultilabel = this._isMultilabelFeature();
    const effectiveIncludeShapes = isMultilabel ? false : this.includeShapes;

    // Calculate the number of categories in "Other" for display
    const otherItemsCount = item.value === 'Other' ? this.otherItems.length : undefined;

    return LegendRenderer.renderLegendItem(
      item,
      itemClasses,
      isItemSelected,
      {
        onClick: () => this.handleItemClick(item.value),
        onDoubleClick: () => this.handleItemDoubleClick(item.value),
        onDragStart: () => this.handleDragStart(item),
        onDragOver: (e: DragEvent) => this.handleDragOver(e, item),
        onDrop: (e: DragEvent) => this.handleDrop(e, item),
        onDragEnd: () => this.handleDragEnd(),
        onViewOther: (e: Event) => {
          e.stopPropagation();
          this.showOtherDialog = true;
        },
      },
      effectiveIncludeShapes,
      LEGEND_STYLES.legendDisplaySize,
      otherItemsCount,
    );
  }

  private _isItemSelected(item: LegendItem): boolean {
    return (
      (item.value === null &&
        this.selectedItems.includes('null') &&
        this.selectedItems.length > 0) ||
      (item.value !== null && item.value !== 'Other' && this.selectedItems.includes(item.value))
    );
  }

  private _getItemClasses(item: LegendItem, isItemSelected: boolean): string {
    const classes = ['legend-item'];

    if (!item.isVisible) classes.push('hidden');
    const itemIndex = this.legendItems.findIndex((i) => i.value === item.value);
    if (this.draggedItemIndex === itemIndex && this.draggedItemIndex !== -1)
      classes.push('dragging');
    if (isItemSelected) classes.push('selected');
    if (item.extractedFromOther) classes.push('extracted');

    return classes.join(' ');
  }

  private renderSettingsDialog() {
    if (!this.showSettingsDialog) return html``;

    const onInputChange = (e: Event) => {
      const target = e.target as HTMLInputElement;
      const parsed = parseInt(target.value, 10);
      if (!Number.isNaN(parsed) && parsed > 0) {
        this.settingsMaxVisibleValues = parsed;
      }
    };

    const onToggleIncludeOthers = (e: Event) => {
      const target = e.target as HTMLInputElement;
      this.settingsIncludeOthers = target.checked;
    };

    const onSave = () => this._handleSettingsSave();
    const onClose = () => this._handleSettingsClose();

    // Initialize temp settings for the currently selected feature
    if (this.selectedFeature && !this.settingsFeatureSortModes[this.selectedFeature]) {
      this.settingsFeatureSortModes = {
        ...this.settingsFeatureSortModes,
        [this.selectedFeature]:
          (this.featureSortModes[this.selectedFeature] === 'alpha-desc'
            ? 'alpha'
            : this.featureSortModes[this.selectedFeature] === 'size-asc'
              ? 'size'
              : this.featureSortModes[this.selectedFeature]) ??
          (FIRST_NUMBER_SORT_FEATURES.has(this.selectedFeature) ? 'alpha' : 'size'),
      };
    }

    return html`
      <div class="modal-overlay" @click=${onClose} @keydown=${this._handleDialogKeydown}>
        <div
          id="legend-settings-dialog"
          class="modal-content"
          tabindex="-1"
          @click=${(e: Event) => e.stopPropagation()}
          role="dialog"
          aria-modal="true"
        >
          <div class="modal-header">
            <h3 class="modal-title">Legend settings</h3>
            <button class="close-button" @click=${onClose}>
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

          <div class="modal-description">Legend display options</div>

          <div class="other-items-list">
            <div class="other-items-list-item">
              <label for="max-visible-input" class="other-items-list-item-label"
                >Max legend items</label
              >
              <input
                id="max-visible-input"
                type="number"
                min="1"
                .value=${String(this.settingsMaxVisibleValues)}
                placeholder=${String(LEGEND_DEFAULTS.maxVisibleValues)}
                @input=${onInputChange}
                class="other-items-list-item-input"
              />
            </div>
            <div class="other-items-list-item">
              <label for="shape-size-input" class="other-items-list-item-label">Shape size</label>
              <input
                class="other-items-list-item-input"
                id="shape-size-input"
                type="number"
                min="6"
                max="64"
                .value=${String(this.settingsShapeSize)}
                placeholder=${String(LEGEND_DEFAULTS.symbolSize)}
                @input=${(e: Event) => {
                  const target = e.target as HTMLInputElement;
                  const parsed = parseInt(target.value, 10);
                  if (!Number.isNaN(parsed) && parsed > 0) {
                    this.settingsShapeSize = parsed;
                  }
                }}
              />
            </div>
            <label class="other-items-list-label">
              <input
                class="other-items-list-label-input"
                type="checkbox"
                .checked=${this.settingsIncludeOthers}
                @change=${onToggleIncludeOthers}
              />
              Show "Other" category
            </label>
            <label
              class="other-items-list-label"
              style="${this._isMultilabelFeature() ? 'color: #888;' : ''}"
            >
              <input
                class="other-items-list-label-input"
                type="checkbox"
                .checked=${this.settingsIncludeShapes}
                .disabled=${this._isMultilabelFeature()}
                @change=${(e: Event) => {
                  const t = e.target as HTMLInputElement;
                  this.settingsIncludeShapes = t.checked;
                }}
              />
              Include shapes
            </label>
            ${this._isMultilabelFeature()
              ? html`<div
                  style="color: #888; font-size: 0.85em; margin-left: 24px; margin-top: -4px;"
                >
                  Disabled for multilabel features
                </div>`
              : ''}
            <label class="other-items-list-label">
              <input
                class="other-items-list-label-input"
                type="checkbox"
                .checked=${this.settingsEnableDuplicateStackUI}
                @change=${(e: Event) => {
                  const t = e.target as HTMLInputElement;
                  this.settingsEnableDuplicateStackUI = t.checked;
                }}
              />
              Show duplicate counts (badges + spiderfy)
            </label>
            <div class="other-items-list-item-sorting">
              <div class="other-items-list-item-sorting-title">Sorting</div>
              <div class="other-items-list-item-sorting-container">
                ${this.selectedFeature
                  ? (() => {
                      const fname = this.selectedFeature;
                      const currentMode = this.settingsFeatureSortModes[fname] || 'size';
                      const normalizedMode: LegendSortMode =
                        currentMode === 'alpha-desc'
                          ? 'alpha'
                          : currentMode === 'size-asc'
                            ? 'size'
                            : currentMode;
                      const isAlphabetic = normalizedMode === 'alpha';

                      return html`
                        <div class="other-items-list-item-sorting-container-item">
                          <span class="other-items-list-item-sorting-container-item-name"
                            >${fname}</span
                          >
                          <span class="other-items-list-item-sorting-container-item-container">
                            <label
                              class="other-items-list-item-sorting-container-item-container-label"
                            >
                              <input
                                class="other-items-list-item-sorting-container-item-container-input"
                                type="radio"
                                name=${`sort-${fname}`}
                                .checked=${!isAlphabetic}
                                @change=${() => {
                                  const newMode: LegendSortMode = 'size';
                                  this.settingsFeatureSortModes = {
                                    ...this.settingsFeatureSortModes,
                                    [fname]: newMode,
                                  };
                                }}
                              />
                              by category size
                            </label>
                            <label>
                              <input
                                type="radio"
                                name=${`sort-${fname}`}
                                .checked=${isAlphabetic}
                                @change=${() => {
                                  const newMode: LegendSortMode = 'alpha';
                                  this.settingsFeatureSortModes = {
                                    ...this.settingsFeatureSortModes,
                                    [fname]: newMode,
                                  };
                                }}
                              />
                              alphanumerically
                            </label>
                          </span>
                        </div>
                      `;
                    })()
                  : ''}
              </div>
            </div>
          </div>

          <div class="modal-footer">
            <button
              class="modal-reset-button"
              @click=${() => this._handleSettingsReset()}
              title="Reset all settings to defaults and clear saved preferences"
            >
              Reset
            </button>
            <button class="modal-close-button" @click=${onClose}>Cancel</button>
            <button class="extract-button" @click=${onSave}>Save</button>
          </div>
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
