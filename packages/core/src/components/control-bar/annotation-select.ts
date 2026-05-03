import { LitElement, html } from 'lit';
import { property, state } from 'lit/decorators.js';
import { customElement } from '../../utils/safe-custom-element';
import { annotationSelectStyles } from './annotation-select.styles';
import { handleDropdownEscape } from '../../utils/dropdown-helpers';
import { groupAnnotations, type GroupedAnnotation } from './annotation-categories';

/**
 * Custom dropdown component for annotation selection with section headers and search
 */
@customElement('protspace-annotation-select')
class ProtspaceAnnotationSelect extends LitElement {
  static styles = annotationSelectStyles;

  @property({ type: Array }) annotations: string[] = [];
  @property({ type: String, attribute: 'selected-annotation' }) selectedAnnotation: string = '';
  @property({ type: String }) placeholder: string = 'Select annotation';

  @state() private open: boolean = false;
  @state() private query: string = '';
  @state() private highlightIndex: number = -1;

  connectedCallback() {
    super.connectedCallback();
    // Listen for parent-initiated close
    this.addEventListener('close-dropdown', () => {
      this.open = false;
      this.query = '';
      this.highlightIndex = -1;
    });
  }

  private toggleDropdown(event?: Event) {
    event?.stopPropagation();
    this.open = !this.open;
    if (this.open) {
      // Notify parent to close its dropdowns
      this.dispatchEvent(
        new CustomEvent('annotation-opened', {
          bubbles: true,
          composed: true,
        }),
      );
      // Focus search input when opening
      this.updateComplete.then(() => {
        const searchInput = this.shadowRoot?.querySelector(
          '#annotation-search-input',
        ) as HTMLInputElement | null;
        searchInput?.focus();
      });
    } else {
      this.query = '';
      this.highlightIndex = -1;
    }
  }

  private handleSearchInput(event: Event) {
    const target = event.target as HTMLInputElement;
    this.query = target.value;
    this.highlightIndex = -1; // Reset highlight when query changes
  }

  private handleKeydown(event: KeyboardEvent) {
    if (!this.open) {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        this.toggleDropdown(event);
      }
      return;
    }

    const filtered = this.getFilteredGroupedAnnotations();
    const flatAnnotations = this.flattenGroupedAnnotations(filtered);

    if (event.key === 'Escape') {
      handleDropdownEscape(event, () => {
        this.open = false;
        this.query = '';
        this.highlightIndex = -1;
      });
    } else if (event.key === 'ArrowDown') {
      event.preventDefault();
      if (flatAnnotations.length > 0) {
        this.highlightIndex = Math.min(this.highlightIndex + 1, flatAnnotations.length - 1);
        this.scrollToHighlighted();
      }
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      if (flatAnnotations.length > 0) {
        this.highlightIndex = Math.max(this.highlightIndex - 1, 0);
        this.scrollToHighlighted();
      }
    } else if (event.key === 'Enter') {
      event.preventDefault();
      if (this.highlightIndex >= 0 && this.highlightIndex < flatAnnotations.length) {
        this.selectAnnotation(flatAnnotations[this.highlightIndex], event);
      }
    }
  }

  private scrollToHighlighted() {
    this.updateComplete.then(() => {
      const highlighted = this.shadowRoot?.querySelector('.dropdown-item.highlighted');
      if (highlighted) {
        highlighted.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      }
    });
  }

  private selectAnnotation(annotation: string, event?: Event) {
    if (event) {
      event.stopPropagation();
    }
    this.selectedAnnotation = annotation;
    this.open = false;
    this.query = '';
    this.highlightIndex = -1;

    // Dispatch annotation-select event
    this.dispatchEvent(
      new CustomEvent('annotation-select', {
        detail: { annotation },
        bubbles: true,
        composed: true,
      }),
    );
  }

  /**
   * Categorize annotations using the shared utility.
   */
  private categorizeAnnotations(annotations: string[]): GroupedAnnotation[] {
    return groupAnnotations(annotations);
  }

  /**
   * Filter annotations based on search query
   */
  private getFilteredGroupedAnnotations(): GroupedAnnotation[] {
    const grouped = this.categorizeAnnotations(this.annotations);
    const queryLower = this.query.trim().toLowerCase();

    if (!queryLower) {
      return grouped;
    }

    // Filter each category's annotations
    return grouped
      .map((group) => ({
        ...group,
        annotations: group.annotations.filter((annotation) =>
          annotation.toLowerCase().includes(queryLower),
        ),
      }))
      .filter((group) => group.annotations.length > 0); // Remove empty categories
  }

  /**
   * Flatten grouped annotations into a single array for keyboard navigation
   */
  private flattenGroupedAnnotations(grouped: GroupedAnnotation[]): string[] {
    const flat: string[] = [];
    for (const group of grouped) {
      flat.push(...group.annotations);
    }
    return flat;
  }

  render() {
    const filtered = this.getFilteredGroupedAnnotations();
    const displayText = this.selectedAnnotation || this.placeholder;

    return html`
      <div class="annotation-select-container">
        <button
          class="dropdown-trigger ${this.open ? 'open' : ''}"
          @click=${this.toggleDropdown}
          @keydown=${this.handleKeydown}
          aria-expanded=${this.open}
          aria-haspopup="listbox"
        >
          <span class="dropdown-trigger-text">${displayText}</span>
          <svg class="chevron-down" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        ${this.open
          ? html`
              <div class="dropdown-menu align-left" @click=${(e: Event) => e.stopPropagation()}>
                <div class="annotation-search-container">
                  <input
                    id="annotation-search-input"
                    class="annotation-search-input"
                    type="text"
                    .value=${this.query}
                    placeholder="Search annotations..."
                    @input=${this.handleSearchInput}
                    @keydown=${this.handleKeydown}
                  />
                </div>

                <div class="annotation-list-container">
                  ${filtered.length === 0
                    ? html` <div class="no-results">No matching annotations</div> `
                    : filtered.map((group) => {
                        let currentIndex = 0;
                        // Find starting index for this group
                        for (const g of filtered) {
                          if (g === group) break;
                          currentIndex += g.annotations.length;
                        }

                        return html`
                          <div class="annotation-section">
                            <div class="annotation-section-header">${group.category}</div>
                            <div class="annotation-section-items">
                              ${group.annotations.map((annotation) => {
                                const itemIndex = currentIndex++;
                                const isHighlighted = itemIndex === this.highlightIndex;
                                const isSelected = annotation === this.selectedAnnotation;
                                return html`
                                  <div
                                    class="dropdown-item ${isHighlighted
                                      ? 'highlighted'
                                      : ''} ${isSelected ? 'selected' : ''}"
                                    @click=${(e: Event) => this.selectAnnotation(annotation, e)}
                                    @mouseenter=${() => {
                                      this.highlightIndex = itemIndex;
                                    }}
                                  >
                                    ${annotation}
                                  </div>
                                `;
                              })}
                            </div>
                          </div>
                        `;
                      })}
                </div>
              </div>
            `
          : ''}
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'protspace-annotation-select': ProtspaceAnnotationSelect;
  }
}
