import { LitElement, html } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { featureSelectStyles } from './feature-select.styles';

/**
 * Feature categories as defined in the plan
 */
const FEATURE_CATEGORIES = {
  UniProt: [
    'annotation_score',
    'cc_subcellular_location',
    'fragment',
    'length_fixed',
    'length_quantile',
    'protein_existence',
    'protein_families',
    'reviewed',
    'xref_pdb',
  ],
  InterPro: ['cath', 'pfam', 'signal_peptide', 'superfamily'],
  Taxonomy: ['root', 'domain', 'kingdom', 'phylum', 'class', 'order', 'family', 'genus', 'species'],
} as const;

/**
 * Taxonomy order for sorting (as specified in plan)
 */
const TAXONOMY_ORDER = [
  'root',
  'domain',
  'kingdom',
  'phylum',
  'class',
  'order',
  'family',
  'genus',
  'species',
] as const;

type CategoryName = 'UniProt' | 'InterPro' | 'Taxonomy' | 'Other';

interface GroupedFeature {
  category: CategoryName;
  features: string[];
}

/**
 * Custom dropdown component for feature selection with section headers and search
 */
@customElement('protspace-feature-select')
export class ProtspaceFeatureSelect extends LitElement {
  static styles = featureSelectStyles;

  @property({ type: Array }) features: string[] = [];
  @property({ type: String, attribute: 'selected-feature' }) selectedFeature: string = '';
  @property({ type: String }) placeholder: string = 'Select feature';

  @state() private open: boolean = false;
  @state() private query: string = '';
  @state() private highlightIndex: number = -1;

  // Stable listener for document clicks
  private _onDocumentClick = (event: Event) => this.handleDocumentClick(event);

  connectedCallback() {
    super.connectedCallback();
    document.addEventListener('click', this._onDocumentClick);
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    document.removeEventListener('click', this._onDocumentClick);
  }

  private handleDocumentClick(event: Event) {
    // Check if click is outside the component
    // For shadow DOM, we need to check if the click path includes this element
    const path = (event as any).composedPath?.() || [];
    const clickedInside = path.includes(this) || this.contains(event.target as Node);

    if (!clickedInside) {
      this.open = false;
      this.query = '';
      this.highlightIndex = -1;
    }
  }

  private toggleDropdown(event?: Event) {
    // Stop event propagation to prevent document click handler from interfering
    event?.stopPropagation();
    this.open = !this.open;
    if (this.open) {
      // Focus search input when opening
      this.updateComplete.then(() => {
        const searchInput = this.shadowRoot?.querySelector(
          '#feature-search-input',
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

    const filtered = this.getFilteredGroupedFeatures();
    const flatFeatures = this.flattenGroupedFeatures(filtered);

    if (event.key === 'Escape') {
      event.preventDefault();
      this.open = false;
      this.query = '';
      this.highlightIndex = -1;
    } else if (event.key === 'ArrowDown') {
      event.preventDefault();
      if (flatFeatures.length > 0) {
        this.highlightIndex = Math.min(this.highlightIndex + 1, flatFeatures.length - 1);
        this.scrollToHighlighted();
      }
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      if (flatFeatures.length > 0) {
        this.highlightIndex = Math.max(this.highlightIndex - 1, 0);
        this.scrollToHighlighted();
      }
    } else if (event.key === 'Enter') {
      event.preventDefault();
      if (this.highlightIndex >= 0 && this.highlightIndex < flatFeatures.length) {
        this.selectFeature(flatFeatures[this.highlightIndex], event);
      }
    }
  }

  private scrollToHighlighted() {
    this.updateComplete.then(() => {
      const highlighted = this.shadowRoot?.querySelector('.feature-item.highlighted');
      if (highlighted) {
        highlighted.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      }
    });
  }

  private selectFeature(feature: string, event?: Event) {
    if (event) {
      event.stopPropagation();
    }
    this.selectedFeature = feature;
    this.open = false;
    this.query = '';
    this.highlightIndex = -1;

    // Dispatch feature-select event
    this.dispatchEvent(
      new CustomEvent('feature-select', {
        detail: { feature },
        bubbles: true,
        composed: true,
      }),
    );
  }

  /**
   * Categorize features according to the plan
   */
  private categorizeFeatures(features: string[]): GroupedFeature[] {
    const categorized: Record<CategoryName, string[]> = {
      UniProt: [],
      InterPro: [],
      Taxonomy: [],
      Other: [],
    };

    for (const feature of features) {
      let found = false;
      for (const [category, categoryFeatures] of Object.entries(FEATURE_CATEGORIES)) {
        if ((categoryFeatures as readonly string[]).includes(feature)) {
          categorized[category as CategoryName].push(feature);
          found = true;
          break;
        }
      }
      if (!found) {
        categorized.Other.push(feature);
      }
    }

    // Sort features within each category
    categorized.UniProt.sort((a, b) => a.localeCompare(b));
    categorized.InterPro.sort((a, b) => a.localeCompare(b));
    categorized.Other.sort((a, b) => a.localeCompare(b));
    // Taxonomy uses predefined order
    categorized.Taxonomy.sort((a, b) => {
      const aIndex = TAXONOMY_ORDER.indexOf(a as any);
      const bIndex = TAXONOMY_ORDER.indexOf(b as any);
      if (aIndex === -1 && bIndex === -1) return a.localeCompare(b);
      if (aIndex === -1) return 1;
      if (bIndex === -1) return -1;
      return aIndex - bIndex;
    });

    // Build grouped array, sorting categories alphabetically (Other last)
    const groups: GroupedFeature[] = [];
    const categoryOrder: CategoryName[] = ['InterPro', 'Taxonomy', 'UniProt', 'Other'];
    for (const category of categoryOrder) {
      if (categorized[category].length > 0) {
        groups.push({ category, features: categorized[category] });
      }
    }

    return groups;
  }

  /**
   * Filter features based on search query
   */
  private getFilteredGroupedFeatures(): GroupedFeature[] {
    const grouped = this.categorizeFeatures(this.features);
    const queryLower = this.query.trim().toLowerCase();

    if (!queryLower) {
      return grouped;
    }

    // Filter each category's features
    return grouped
      .map((group) => ({
        ...group,
        features: group.features.filter((feature) => feature.toLowerCase().includes(queryLower)),
      }))
      .filter((group) => group.features.length > 0); // Remove empty categories
  }

  /**
   * Flatten grouped features into a single array for keyboard navigation
   */
  private flattenGroupedFeatures(grouped: GroupedFeature[]): string[] {
    const flat: string[] = [];
    for (const group of grouped) {
      flat.push(...group.features);
    }
    return flat;
  }

  render() {
    const filtered = this.getFilteredGroupedFeatures();
    const displayText = this.selectedFeature || this.placeholder;

    return html`
      <div class="feature-select-container">
        <button
          class="feature-select-trigger ${this.open ? 'open' : ''}"
          @click=${this.toggleDropdown}
          @keydown=${this.handleKeydown}
          aria-expanded=${this.open}
          aria-haspopup="listbox"
        >
          <span class="feature-select-text">${displayText}</span>
          <svg class="chevron-down" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        ${this.open
          ? html`
              <div class="feature-select-menu" @click=${(e: Event) => e.stopPropagation()}>
                <div class="feature-search-container">
                  <input
                    id="feature-search-input"
                    class="feature-search-input"
                    type="text"
                    .value=${this.query}
                    placeholder="Search features..."
                    @input=${this.handleSearchInput}
                    @keydown=${this.handleKeydown}
                  />
                </div>

                <div class="feature-list-container">
                  ${filtered.length === 0
                    ? html` <div class="no-results">No matching features</div> `
                    : filtered.map((group) => {
                        let currentIndex = 0;
                        // Find starting index for this group
                        for (const g of filtered) {
                          if (g === group) break;
                          currentIndex += g.features.length;
                        }

                        return html`
                          <div class="feature-section">
                            <div class="feature-section-header">${group.category}</div>
                            <div class="feature-section-items">
                              ${group.features.map((feature) => {
                                const itemIndex = currentIndex++;
                                const isHighlighted = itemIndex === this.highlightIndex;
                                const isSelected = feature === this.selectedFeature;
                                return html`
                                  <div
                                    class="feature-item ${isHighlighted
                                      ? 'highlighted'
                                      : ''} ${isSelected ? 'selected' : ''}"
                                    @click=${(e: Event) => this.selectFeature(feature, e)}
                                    @mouseenter=${() => {
                                      this.highlightIndex = itemIndex;
                                    }}
                                  >
                                    ${feature}
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
    'protspace-feature-select': ProtspaceFeatureSelect;
  }
}
