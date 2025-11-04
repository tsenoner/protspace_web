import type { PropertyValues } from 'lit';
import { LitElement, html } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { parquetReadObjects } from 'hyparquet';
import type { VisualizationData } from '@protspace/utils';
import { dataLoaderStyles } from './data-loader.styles';
import { readFileOptimized } from './utils/file-io';
import { isParquetBundle, extractRowsFromParquetBundle } from './utils/bundle';
import { convertParquetToVisualizationDataOptimized } from './utils/conversion';
import {
  assertWithinFileSizeLimit,
  assertValidParquetMagic,
  validateRowsBasic,
} from './utils/validation';

/**
 * Parquet Data Loader Web Component
 *
 * Loads protein data from Parquet (.parquet) format files and converts them
 * to the ProtSpace visualization data format. Categories from columns
 * become legend items with unique values as elements.
 */
@customElement('protspace-data-loader')
export class DataLoader extends LitElement {
  static styles = dataLoaderStyles;

  /** URL or File object for the Arrow data source */
  @property({ type: String })
  src = '';

  /** Auto-load when src is provided */
  @property({ type: Boolean, attribute: 'auto-load' })
  autoLoad = false;

  /** Accept drag and drop */
  @property({ type: Boolean, attribute: 'allow-drop' })
  allowDrop = true;

  /** Required column mappings for Arrow data */
  @property({ type: Object, attribute: 'column-mappings' })
  columnMappings: {
    proteinId?: string;
    projection_x?: string;
    projection_y?: string;
    projectionName?: string;
  } = {};

  private totalSteps = 0;
  private completedSteps = 0;

  @state()
  private error: string | null = null;

  connectedCallback() {
    super.connectedCallback();
    if (this.autoLoad && this.src) {
      this.loadFromUrl(this.src);
    }
  }

  updated(changedProperties: PropertyValues) {
    if (changedProperties.has('src') && this.src && this.autoLoad) {
      this.loadFromUrl(this.src);
    }
  }

  render() {
    return html`
      <input
        type="file"
        class="hidden-input"
        accept=".parquet,.parquetbundle"
        @change=${this.handleFileSelect}
        style="display:none"
      />
    `;
  }

  private handleFileSelect(e: Event) {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    if (file) {
      this.loadFromFile(file);
    }
  }

  /**
   * Load Parquet data from a URL
   */
  async loadFromUrl(url: string) {
    this.setLoading(true);
    this.error = null;

    try {
      // Steps: fetch -> read ArrayBuffer -> parse parquet -> convert to visualization
      this.beginProgress(4);

      // 1) Fetch
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`Failed to fetch: ${response.status} ${response.statusText}`);
      }
      this.completeStep();

      // 2) Read ArrayBuffer
      const arrayBuffer = await response.arrayBuffer();
      this.completeStep();

      // 3) Parse parquet
      const table = await parquetReadObjects({ file: arrayBuffer });
      this.completeStep();

      // 4) Convert
      const visualizationData = await convertParquetToVisualizationDataOptimized(table);
      this.completeStep();
      this.dispatchDataLoaded(visualizationData);
    } catch (error) {
      this.error = error instanceof Error ? error.message : 'Unknown error occurred';
      this.dispatchError(this.error);
    } finally {
      this.setLoading(false);
    }
  }

  /**
   * Load Parquet data from a File object with performance optimizations
   */
  async loadFromFile(file: File) {
    this.setLoading(true);
    this.error = null;

    // Performance optimization: disable inspection files for large files
    const disableInspection = file.size > 50 * 1024 * 1024; // 50MB threshold

    try {
      // Plan initial steps common to both branches: validate size, read ArrayBuffer
      this.beginProgress(2);

      // 1) Early size validation
      assertWithinFileSizeLimit(file.size);
      this.completeStep();

      // 2) Optimize ArrayBuffer reading for large files
      const arrayBuffer = await readFileOptimized(file);
      this.completeStep();

      // Branch-specific steps
      if (file.name.endsWith('.parquetbundle') || isParquetBundle(arrayBuffer)) {
        // For bundles: extract -> validate -> convert
        this.addSteps(3);
        const extractedData = await extractRowsFromParquetBundle(arrayBuffer, {
          disableInspection,
        });
        this.completeStep();
        validateRowsBasic(extractedData);
        this.completeStep();
        const visualizationData = await convertParquetToVisualizationDataOptimized(extractedData);
        this.completeStep();
        this.dispatchDataLoaded(visualizationData);
      } else {
        // For regular parquet: validate magic -> parse -> validate rows -> convert
        this.addSteps(4);
        assertValidParquetMagic(arrayBuffer);
        this.completeStep();
        const table = await parquetReadObjects({ file: arrayBuffer });
        this.completeStep();
        validateRowsBasic(table);
        this.completeStep();
        const visualizationData = await convertParquetToVisualizationDataOptimized(table);
        this.completeStep();
        this.dispatchDataLoaded(visualizationData);
      }
    } catch (error) {
      this.error = error instanceof Error ? error.message : 'Unknown error occurred';
      this.dispatchError(this.error);
    } finally {
      this.setLoading(false);
    }
  }

  private setLoading(loading: boolean) {
    if (loading) {
      this.setAttribute('loading', '');
    } else {
      this.removeAttribute('loading');
    }
  }

  private beginProgress(totalSteps: number) {
    this.totalSteps = totalSteps;
    this.completedSteps = 0;
  }

  private addSteps(additionalSteps: number) {
    this.totalSteps += additionalSteps;
  }

  private completeStep() {
    this.completedSteps += 1;
  }

  private dispatchDataLoaded(data: VisualizationData) {
    this.dispatchEvent(
      new CustomEvent('data-loaded', {
        detail: { data },
        bubbles: true,
        composed: true,
      })
    );
  }

  private dispatchError(error: string) {
    this.dispatchEvent(
      new CustomEvent('data-error', {
        detail: { error },
        bubbles: true,
        composed: true,
      })
    );
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'protspace-data-loader': DataLoader;
  }
}
