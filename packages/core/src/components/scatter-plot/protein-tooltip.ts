import { LitElement, html } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import type { PlotDataPoint } from '@protspace/utils';
import { proteinTooltipStyles } from './protein-tooltip.styles';

@customElement('protspace-protein-tooltip')
export class ProtspaceProteinTooltip extends LitElement {
  @property({ type: Object }) protein: PlotDataPoint | null = null;
  @property({ type: String }) selectedAnnotation = '';
  @property({ type: Boolean }) showScores = false;

  static styles = proteinTooltipStyles;

  render() {
    if (!this.protein) {
      return html``;
    }

    const geneName = this._getGeneName(this.protein);
    const proteinName = this._getProteinName(this.protein);
    const uniprotKbId = this._getUniprotKbId(this.protein);
    const tooltipAnnotationValues = this.protein.annotationValues[this.selectedAnnotation] ?? [];
    const tooltipAnnotationScores = this.protein.annotationScores?.[this.selectedAnnotation] ?? [];

    return html`
      <div class="tooltip">
        <div class="tooltip-header">
          <div class="tooltip-protein-id">
            <span class="tooltip-protein-id-main">${this.protein.id}</span>
            ${uniprotKbId
              ? html`<span class="tooltip-uniprot-separator"> · </span>
                  <span class="tooltip-uniprot-id">${uniprotKbId}</span>`
              : ''}
          </div>
        </div>
        <div class="tooltip-content">
          ${proteinName
            ? html`<div class="tooltip-protein-name">
                <span class="label">Protein:</span> ${proteinName}
              </div>`
            : ''}
          ${geneName
            ? html`<div class="tooltip-gene-name">
                <span class="label">Gene:</span> ${geneName}
              </div>`
            : ''}
          <div class="tooltip-annotations">
            ${tooltipAnnotationValues.map((value, idx) => {
              const score = this.showScores ? tooltipAnnotationScores[idx] : null;
              const scoreText =
                typeof score === 'number' && Number.isFinite(score) ? `${score}` : '';
              return html`<div class="tooltip-annotation">
                <span>${value || 'N/A'}</span><span>${scoreText}</span>
              </div>`;
            })}
          </div>
        </div>
      </div>
    `;
  }

  /**
   * Extract gene name from protein annotations
   */
  private _getGeneName(protein: PlotDataPoint): string | null {
    const values = protein.annotationValues?.gene_name || protein.annotationValues?.['Gene name'];
    if (!values || values.length === 0) return null;
    const filtered = values.map((value) => value.trim()).filter((value) => value.length > 0);
    if (filtered.length === 0) return null;
    return filtered.join(', ');
  }

  /**
   * Extract protein name from protein annotations
   */
  private _getProteinName(protein: PlotDataPoint): string | null {
    const values =
      protein.annotationValues?.protein_name || protein.annotationValues?.['Protein name'];
    if (!values || values.length === 0) return null;
    const filtered = values.map((value) => value.trim()).filter((value) => value.length > 0);
    if (filtered.length === 0) return null;
    return filtered.join(', ');
  }

  /**
   * Extract UniProtKB ID from protein annotations
   */
  private _getUniprotKbId(protein: PlotDataPoint): string | null {
    const values = protein.annotationValues?.uniprot_kb_id;
    if (!values || values.length === 0) return null;
    const filtered = values.map((value) => value.trim()).filter((value) => value.length > 0);
    if (filtered.length === 0) return null;
    return filtered.join(', ');
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'protspace-protein-tooltip': ProtspaceProteinTooltip;
  }
}
