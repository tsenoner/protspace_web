import { LitElement, html } from 'lit';
import { customElement, property, state, query } from 'lit/decorators.js';
import { StructureService } from '@protspace/utils';
import type { StructureData } from '@protspace/utils';
import { structureViewerStyles } from './structure-viewer.styles';
import { createMolstarViewer, type MolstarViewer } from './molstar-loader';
import type { StructureLoadEvent } from './types';

@customElement('protspace-structure-viewer')
export class ProtspaceStructureViewer extends LitElement {
  static styles = structureViewerStyles;

  // Properties
  @property({ type: String }) proteinId: string | null = null;
  @property({ type: String }) title = 'Protein Structure';
  @property({ type: Boolean }) showHeader = true;
  @property({ type: Boolean }) showCloseButton = true;
  @property({ type: Boolean }) showTips = true;
  @property({ type: String }) height = '400px';

  // Auto-sync properties
  @property({ type: String, attribute: 'scatterplot-selector' })
  scatterplotSelector: string = 'protspace-scatterplot';
  @property({ type: Boolean, attribute: 'auto-sync' })
  autoSync: boolean = true;
  @property({ type: Boolean, attribute: 'auto-show' })
  autoShow: boolean = true; // Automatically show/hide based on selections

  // State
  @state() private _isLoading = false;
  @state() private _error: string | null = null;
  @state() private _viewer: MolstarViewer | null = null;
  @state() private _structureData: StructureData | null = null;
  private _scatterplotElement: Element | null = null;

  // Refs
  @query('.viewer-content') private _viewerContainer!: HTMLElement;

  protected updated(changedProperties: Map<string | number | symbol, unknown>) {
    if (changedProperties.size > 0) {
    }
    if (changedProperties.has('proteinId')) {
      if (this.proteinId) {
        this._loadStructure();
      } else {
        this._cleanup();
      }
    }
    if (changedProperties.has('height')) {
      this.style.setProperty('14rem', this.height);
    }
  }

  connectedCallback() {
    super.connectedCallback();

    if (this.autoSync) {
      this._setupAutoSync();
    }
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this._cleanup();

    if (this._scatterplotElement && this._proteinClickHandler) {
      this._scatterplotElement.removeEventListener('protein-click', this._proteinClickHandler);
    }
  }

  private _proteinClickHandler: (e: Event) => void = (e: Event) => this._handleProteinClick(e);

  private _setupAutoSync() {
    // Find scatterplot element
    setTimeout(() => {
      this._scatterplotElement = document.querySelector(this.scatterplotSelector);

      if (this._scatterplotElement) {
        // Listen for protein clicks
        this._scatterplotElement.addEventListener('protein-click', this._proteinClickHandler);

        // Initially hide if autoShow is enabled
        if (this.autoShow && !this.proteinId) {
          this.style.display = 'none';
        }
      }
    }, 100);
  }

  private _handleProteinClick(event: Event) {
    const customEvent = event as CustomEvent;
    const { proteinId, modifierKeys } = customEvent.detail;

    // Only respond to single clicks (not multi-selection)
    if (!modifierKeys.ctrl && !modifierKeys.shift && this.autoShow) {
      // Show structure viewer and load protein
      this.proteinId = proteinId;
      this.style.display = 'flex';
    }
  }

  // Public methods for external control
  public hide() {
    if (this.autoShow) {
      this.style.display = 'none';
      this.proteinId = null;
      this._cleanup();
      this._dispatchCloseEvent();
    }
  }

  public show(proteinId?: string) {
    if (this.autoShow) {
      this.style.display = 'block';
      if (proteinId) {
        this.proteinId = proteinId;
      }
    }
  }

  public close() {
    // Internal close functionality
    this.proteinId = null;
    this._cleanup();
    if (this.autoShow) {
      this.style.display = 'none';
    }
    this._dispatchCloseEvent();
  }

  public loadProtein(proteinId: string) {
    // Public method to load a specific protein
    this.proteinId = proteinId;
    if (this.autoShow) {
      this.style.display = 'block';
    }
  }

  private async _loadStructure() {
    if (!this.proteinId) {
      this._cleanup();
      return;
    }

    this._isLoading = true;
    this._error = null;
    this._structureData = null;

    // Dispatch loading event
    this._dispatchStructureEvent('loading');

    try {
      // Clean up any existing viewer
      this._cleanup();

      // Use service to load structure data
      this._structureData = await StructureService.loadStructure(this.proteinId);

      // Create Mol* viewer
      await this.updateComplete;
      if (!this._viewerContainer) {
        throw new Error('Viewer container not available');
      }
      this._viewer = await createMolstarViewer(this._viewerContainer);

      // Load structure into viewer based on source
      await this._displayStructure(this._structureData);

      this._isLoading = false;
      this._dispatchStructureEvent('loaded');
    } catch (error) {
      console.error('[StructureViewer] Structure loading error:', error);
      const formattedId = this.proteinId?.split('.')[0] ?? this.proteinId ?? '';
      const genericMessage = `No 3D structure was found for ${formattedId}.`;
      const fallbackMessage = 'Failed to load structure. Please try again.';
      if (error instanceof Error) {
        // Map low-level errors to a user-friendly message
        const message = error.message.toLowerCase();
        if (
          message.includes('failed to load structure from both alphafold and pdb') ||
          message.includes('alphafold structure not available')
        ) {
          this._error = genericMessage;
        } else {
          this._error = fallbackMessage;
        }
      } else {
        this._error = fallbackMessage;
      }
      this._isLoading = false;
      this._dispatchStructureEvent('error', this._error);
    }
  }

  // Removed _loadMolstarResources and _createViewer; logic moved to molstar-loader

  private async _displayStructure(structureData: StructureData): Promise<void> {
    if (!this._viewer) {
      throw new Error('Viewer not initialized');
    }

    // Load structure based on source
    switch (structureData.source) {
      case 'alphafold':
        if (structureData.url) {
          await this._viewer.loadStructureFromUrl(structureData.url, structureData.format);
        } else {
          throw new Error('AlphaFold structure URL not available');
        }
        break;
      default:
        throw new Error(`Unsupported structure source: ${structureData.source}`);
    }
  }

  private _cleanup() {
    if (this._viewer) {
      try {
        this._viewer.dispose();
      } catch (error) {
        console.warn('[StructureViewer] Error disposing viewer:', error);
      }
      this._viewer = null;
    }

    if (this._viewerContainer) {
      this._viewerContainer.innerHTML = '';
    }

    // Clean up blob URL to prevent memory leaks
    if (this._structureData?.url && this._structureData.url.startsWith('blob:')) {
      try {
        URL.revokeObjectURL(this._structureData.url);
      } catch (error) {
        console.warn('[StructureViewer] Error revoking blob URL:', error);
      }
    }

    this._structureData = null;
  }

  private _dispatchStructureEvent(status: 'loading' | 'loaded' | 'error', error?: string) {
    this.dispatchEvent(
      new CustomEvent('structure-load', {
        detail: {
          proteinId: this.proteinId!,
          status,
          error,
          data: this._structureData,
        },
        bubbles: true,
      }) as StructureLoadEvent
    );
  }

  private _dispatchCloseEvent() {
    this.dispatchEvent(
      new CustomEvent('structure-close', {
        detail: {
          proteinId: this.proteinId,
        },
        bubbles: true,
      })
    );
  }

  private _handleClose() {
    this.close(); // Use internal close method
  }

  render() {
    if (!this.proteinId) {
      return html`
        <div class="viewer-container">
          <div class="empty-container">
            <div class="empty-title">No protein selected</div>
            <div class="empty-message">
              Select a point in the scatter plot to view its 3D structure.
            </div>
          </div>
          <div class="viewer-content"></div>
        </div>
      `;
    }

    return html`
      ${this.showHeader
        ? html`
            <div class="header">
              <div>
                <a
                  class="title"
                  href=${`https://alphafold.ebi.ac.uk/entry/${encodeURIComponent(
                    this.proteinId.split('.')[0]
                  )}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  title="Open in AlphaFold DB"
                >
                  ${this.title}
                </a>
                <a
                  class="protein-id"
                  href=${`https://www.uniprot.org/uniprotkb/${encodeURIComponent(
                    this.proteinId.split('.')[0]
                  )}/entry`}
                  target="_blank"
                  rel="noopener noreferrer"
                  title="Open in UniProt"
                >
                  ${this.proteinId}
                </a>
              </div>
              <div class="header-actions">
                ${this.showCloseButton
                  ? html` <button class="close-button" @click=${this._handleClose}>✕</button> `
                  : ''}
              </div>
            </div>
          `
        : ''}

      <div class="viewer-container">
        ${this._isLoading
          ? html`
              <div class="loading-overlay">
                <div class="loading-spinner"></div>
                <div class="loading-text">Loading protein structure...</div>
              </div>
            `
          : ''}
        ${this._error
          ? html`
              <div class="error-container">
                <div class="error-title">${this._error}</div>
              </div>
            `
          : ''}

        <div class="viewer-content"></div>
      </div>

      ${this.showTips && !this._error
        ? html`
            <div class="tips">
              <strong>Tip:</strong> Left-click and drag to rotate. Click and drag to move. Scroll to
              zoom.
            </div>
          `
        : ''}
    `;
  }
}

// Global type declarations
declare global {
  interface HTMLElementTagNameMap {
    'protspace-structure-viewer': ProtspaceStructureViewer;
  }
}
