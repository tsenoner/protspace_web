import { LitElement, html } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import type { PlotDataPoint } from '@protspace/utils';
import { proteinTooltipStyles } from './protein-tooltip.styles';

const SUPERSCRIPT_DIGITS: Record<string, string> = {
  '0': '\u2070',
  '1': '\u00B9',
  '2': '\u00B2',
  '3': '\u00B3',
  '4': '\u2074',
  '5': '\u2075',
  '6': '\u2076',
  '7': '\u2077',
  '8': '\u2078',
  '9': '\u2079',
  '-': '\u207B',
};

function formatScore(value: number): string {
  const abs = Math.abs(value);
  // Display as plain number when within 0.01 to 999 (or zero)
  if (abs === 0 || (abs >= 0.01 && abs < 1000)) {
    // Use up to 2 significant decimals, strip trailing zeros
    return Number(value.toPrecision(3)).toString();
  }
  const exp = value.toExponential(1);
  const [mantissa, exponent] = exp.split('e');
  // Strip the leading '+' from the exponent (e.g., e+2 → e2)
  const cleanExp = (exponent ?? '').replace(/^\+/, '');
  const superExp = cleanExp.replace(/[0-9\-]/g, (ch) => SUPERSCRIPT_DIGITS[ch] ?? ch);
  return `${mantissa}\u00D710${superExp}`;
}

@customElement('protspace-protein-tooltip')
export class ProtspaceProteinTooltip extends LitElement {
  @property({ type: Object }) protein: PlotDataPoint | null = null;
  @property({ type: String }) selectedAnnotation = '';

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
    const tooltipAnnotationEvidence =
      this.protein.annotationEvidence?.[this.selectedAnnotation] ?? [];

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
              const scores = tooltipAnnotationScores[idx];
              const evidence = tooltipAnnotationEvidence[idx];
              const MAX_VISIBLE_SCORES = 3;
              let scoreText = '';
              if (Array.isArray(scores) && scores.length > 0) {
                const visible = scores.slice(0, MAX_VISIBLE_SCORES).map(formatScore);
                scoreText =
                  scores.length > MAX_VISIBLE_SCORES
                    ? visible.join(', ') + ', \u2026'
                    : visible.join(', ');
              }
              return html`<div class="tooltip-annotation">
                <span class="tooltip-annotation-label" title="${value || 'N/A'}"
                  >${value || 'N/A'}</span
                >${scoreText
                  ? html`<span class="tooltip-annotation-score">${scoreText}</span>`
                  : evidence
                    ? html`<span class="tooltip-annotation-evidence">${evidence}</span>`
                    : ''}
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
