import type { TemplateResult } from 'lit';
import { html } from 'lit';
import type { LegendItem } from './types';
import {
  LEGEND_DEFAULTS,
  LEGEND_STYLES,
  LEGEND_VALUES,
  SHAPE_PATH_GENERATORS,
  toDisplayValue,
} from './config';

/**
 * Utility class for rendering legend components
 */
export class LegendRenderer {
  /**
   * Render a symbol using custom SVG paths that match WebGL shader geometry.
   */
  static renderSymbol(
    shape: string | null,
    color: string,
    size: number = LEGEND_DEFAULTS.symbolSize,
    isSelected: boolean = false,
  ): TemplateResult {
    // Add padding to accommodate shapes that extend beyond circles
    const padding = 4;
    const canvasSize = size + padding * 2;
    const centerOffset = canvasSize / 2;

    // Safely handle null or undefined shape
    const shapeKey = (shape || 'circle').toLowerCase();

    // Get the path generator (default to circle if not found)
    const pathGenerator = SHAPE_PATH_GENERATORS[shapeKey] || SHAPE_PATH_GENERATORS.circle;

    // Generate the SVG path
    const path = pathGenerator(size);

    // Some symbol types should be rendered as outlines only (plus sign)
    const isOutlineOnly = LEGEND_STYLES.outlineShapes.has(shapeKey);

    // Determine stroke width based on selection state
    const strokeWidth = isSelected
      ? LEGEND_STYLES.strokeWidth.selected
      : LEGEND_STYLES.strokeWidth.default;

    // Determine stroke color based on selection state
    const strokeColor = isSelected
      ? LEGEND_STYLES.colors.selectedStroke
      : LEGEND_STYLES.colors.defaultStroke;

    // Ensure we have a valid color
    const validColor = color || '#888888';

    return html`
      <svg width="${canvasSize}" height="${canvasSize}" class="legend-symbol">
        <g transform="translate(${centerOffset}, ${centerOffset})">
          <path
            d="${path}"
            fill="${isOutlineOnly ? 'none' : validColor}"
            stroke="${isOutlineOnly ? validColor : strokeColor}"
            stroke-width="${isOutlineOnly ? LEGEND_STYLES.strokeWidth.outline : strokeWidth}"
          />
        </g>
      </svg>
    `;
  }

  /**
   * Render the legend header with title and customize button
   */
  static renderHeader(
    title: string,
    actions: {
      onReverse?: () => void;
      onCustomize: () => void;
      onColorPanel?: () => void;
    },
  ): TemplateResult {
    return html`
      <div class="legend-header" part="header">
        <h3 class="legend-title">${title}</h3>
        <div class="legend-header-actions">
          ${actions.onReverse
            ? html`
                <button
                  class="btn-icon customize-button reverse-button"
                  title="Reverse z-order (keep Other last)"
                  aria-label="Reverse z-order (keep Other last)"
                  @click=${actions.onReverse}
                >
                  <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="2"
                      d="M7 16V4m0 0L3 8m4-4l4 4m6-2v12m0 0l4-4m-4 4l-4-4"
                    />
                  </svg>
                </button>
              `
            : null}
          ${actions.onColorPanel
            ? html`
                <button
                  class="btn-icon customize-button"
                  title="Legend colors"
                  aria-label="Legend colors"
                  @click=${actions.onColorPanel}
                >
                  <svg width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
                    <path
                      d="M8 5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3m4 3a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3M5.5 7a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0m.5 6a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3"
                    />
                    <path
                      d="M16 8c0 3.15-1.866 2.585-3.567 2.07C11.42 9.763 10.465 9.473 10 10c-.603.683-.475 1.819-.351 2.92C9.826 14.495 9.996 16 8 16a8 8 0 1 1 8-8m-8 7c.611 0 .654-.171.655-.176.078-.146.124-.464.07-1.119-.014-.168-.037-.37-.061-.591-.052-.464-.112-1.005-.118-1.462-.01-.707.083-1.61.704-2.314.369-.417.845-.578 1.272-.618.404-.038.812.026 1.16.104.343.077.702.186 1.025.284l.028.008c.346.105.658.199.953.266.653.148.904.083.991.024C14.717 9.38 15 9.161 15 8a7 7 0 1 0-7 7"
                    />
                  </svg>
                </button>
              `
            : null}
          <button
            class="btn-icon customize-button"
            title="Legend settings"
            aria-label="Legend settings"
            @click=${actions.onCustomize}
          >
            <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
              />
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
              />
            </svg>
          </button>
        </div>
      </div>
    `;
  }

  /**
   * Render the main legend content or empty state
   */
  static renderLegendContent(
    sortedLegendItems: LegendItem[],
    renderItemCallback: (item: LegendItem, index: number) => TemplateResult,
  ): TemplateResult {
    if (sortedLegendItems.length === 0) {
      return html`<div class="legend-empty" part="empty">No data available</div>`;
    }

    return html`
      <div class="legend-items" part="items" role="listbox" aria-label="Legend items">
        ${sortedLegendItems.map((item, index) => renderItemCallback(item, index))}
      </div>
    `;
  }

  /**
   * Render the drag handle icon
   */
  static renderDragHandle(): TemplateResult {
    return html`
      <div class="drag-handle">
        <svg
          width="16"
          height="16"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          @mousedown=${(e: Event) => e.stopPropagation()}
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M4 8h16M4 16h16"
          />
        </svg>
      </div>
    `;
  }

  /**
   * Render the item symbol (either "Other" default or annotation-specific symbol)
   */
  static renderItemSymbol(
    item: LegendItem,
    isItemSelected: boolean,
    includeShapes: boolean = true,
    size: number = LEGEND_DEFAULTS.symbolSize,
  ): TemplateResult {
    return html`
      <div class="mr-2" part="symbol">
        ${item.value === LEGEND_VALUES.OTHER
          ? this.renderSymbol('circle', '#888', size)
          : this.renderSymbol(
              includeShapes ? item.shape : 'circle',
              item.color,
              size,
              isItemSelected,
            )}
      </div>
    `;
  }

  /**
   * Render the item text label.
   * N/A items have '__NA__' as value and display as 'N/A'.
   */
  static renderItemText(item: LegendItem, otherItemsCount?: number): TemplateResult {
    const displayText = toDisplayValue(item.value, otherItemsCount);
    return html`<span class="legend-text" part="text">${displayText}</span>`;
  }

  /**
   * Render item actions (like "view" button for "Other" category)
   */
  static renderItemActions(item: LegendItem, onViewOther: (e: Event) => void): TemplateResult {
    if (item.value === LEGEND_VALUES.OTHER) {
      return html`
        <span class="legend-item-actions">
          <button
            class="btn-link view-button"
            @click=${onViewOther}
            title="Extract items from Other"
          >
            (view)
          </button>
        </span>
      `;
    }

    return html``;
  }

  /**
   * Render a complete legend item.
   * N/A items have '__NA__' as value and display as 'N/A'.
   */
  static renderLegendItem(
    item: LegendItem,
    itemClasses: string,
    isItemSelected: boolean,
    eventHandlers: {
      onClick: () => void;
      onDoubleClick: () => void;
      onDragStart: () => void;
      onDragOver: (e: DragEvent) => void;
      onDrop: (e: DragEvent) => void;
      onDragEnd: () => void;
      onViewOther: (e: Event) => void;
      onKeyDown?: (e: KeyboardEvent) => void;
    },
    includeShapes: boolean = true,
    symbolSize: number = LEGEND_DEFAULTS.symbolSize,
    otherItemsCount?: number,
    itemIndex?: number,
  ): TemplateResult {
    const displayLabel = toDisplayValue(item.value);

    return html`
      <div
        class="${itemClasses}"
        part="item"
        role="option"
        aria-selected="${item.isVisible}"
        aria-label="${displayLabel}: ${item.count} items${!item.isVisible ? ' (hidden)' : ''}"
        tabindex="${itemIndex === 0 ? '0' : '-1'}"
        @click=${eventHandlers.onClick}
        @dblclick=${eventHandlers.onDoubleClick}
        @keydown=${eventHandlers.onKeyDown}
        draggable="true"
        @dragstart=${eventHandlers.onDragStart}
        @dragover=${eventHandlers.onDragOver}
        @drop=${eventHandlers.onDrop}
        @dragend=${eventHandlers.onDragEnd}
      >
        <div class="legend-item-content">
          ${this.renderDragHandle()}
          ${this.renderItemSymbol(item, isItemSelected, includeShapes, symbolSize)}
          ${this.renderItemText(item, otherItemsCount)}
          ${this.renderItemActions(item, eventHandlers.onViewOther)}
        </div>
        <span class="legend-count" part="count">${item.count}</span>
      </div>
    `;
  }
}
