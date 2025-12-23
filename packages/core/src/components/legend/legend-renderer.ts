import type { TemplateResult } from 'lit';
import { html } from 'lit';
import type { LegendItem } from './types';
import { SHAPE_PATH_GENERATORS, LEGEND_DEFAULTS, LEGEND_STYLES } from './config';

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
    },
  ): TemplateResult {
    return html`
      <div class="legend-header">
        <h3 class="legend-title">${title}</h3>
        <div class="legend-header-actions">
          ${actions.onReverse
            ? html`
                <button
                  class="customize-button reverse-button"
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
          <button
            class="customize-button"
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
    renderItemCallback: (item: LegendItem) => TemplateResult,
  ): TemplateResult {
    if (sortedLegendItems.length === 0) {
      return html`<div class="legend-empty">No data available</div>`;
    }

    return html`
      <div class="legend-items">${sortedLegendItems.map((item) => renderItemCallback(item))}</div>
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
   * Render the item symbol (either "Other" default or feature-specific symbol)
   */
  static renderItemSymbol(
    item: LegendItem,
    isItemSelected: boolean,
    includeShapes: boolean = true,
    size: number = LEGEND_DEFAULTS.symbolSize,
  ): TemplateResult {
    return html`
      <div class="mr-2">
        ${item.value === 'Other'
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
   * Render the item text label
   */
  static renderItemText(item: LegendItem, otherItemsCount?: number): TemplateResult {
    const isEmptyString = typeof item.value === 'string' && item.value.trim() === '';
    let displayText = item.value === null || isEmptyString ? 'N/A' : item.value;

    // For "Other" items, append the number of categories if provided
    if (item.value === 'Other' && otherItemsCount !== undefined && otherItemsCount > 0) {
      displayText = `${displayText} (${otherItemsCount} categories)`;
    }

    return html`<span class="legend-text">${displayText}</span>`;
  }

  /**
   * Render item actions (like "view" button for "Other" category)
   */
  static renderItemActions(item: LegendItem, onViewOther: (e: Event) => void): TemplateResult {
    if (item.value !== 'Other') {
      return html``;
    }

    return html`
      <button class="view-button" @click=${onViewOther} title="Extract items from Other">
        (view)
      </button>
    `;
  }

  /**
   * Render a complete legend item
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
    },
    includeShapes: boolean = true,
    symbolSize: number = LEGEND_DEFAULTS.symbolSize,
    otherItemsCount?: number,
  ): TemplateResult {
    return html`
      <div
        class="${itemClasses}"
        @click=${eventHandlers.onClick}
        @dblclick=${eventHandlers.onDoubleClick}
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
        <span class="legend-count">${item.count}</span>
      </div>
    `;
  }
}
