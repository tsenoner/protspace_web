import * as d3 from 'd3';
import type { VisualizationData } from '../types.js';
import type { ColumnarData, AnnotationStore } from './columnar-types.js';
import { toInternalValue } from '../visualization/shapes.js';

type ScalePair = {
  x: d3.ScaleLinear<number, number>;
  y: d3.ScaleLinear<number, number>;
};

/**
 * Processes VisualizationData into columnar format.
 * Annotations are built once and shared across projection switches.
 */
export class ColumnarDataProcessor {
  /**
   * Build full columnar data from VisualizationData.
   * Call this on initial data load or when annotations change.
   */
  static buildColumnarData(
    data: VisualizationData,
    projectionIndex: number,
    projectionPlane: 'xy' | 'xz' | 'yz' = 'xy',
  ): ColumnarData {
    const n = data.protein_ids.length;
    const x = new Float32Array(n);
    const y = new Float32Array(n);
    let z: Float32Array | null = null;
    const originalIndices = new Uint32Array(n);

    const projection = data.projections[projectionIndex];
    if (!projection) {
      return {
        ids: data.protein_ids,
        x,
        y,
        z: null,
        length: n,
        annotationStore: this.buildAnnotationStore(data),
        originalIndices,
      };
    }

    const is3D =
      projection.metadata?.dimension === 3 ||
      (projection.data.length > 0 && projection.data[0].length === 3);

    if (is3D) {
      z = new Float32Array(n);
    }

    for (let i = 0; i < n; i++) {
      const coords = projection.data[i];
      if (!coords) {
        x[i] = 0;
        y[i] = 0;
        if (z) z[i] = 0;
      } else if (coords.length === 3) {
        switch (projectionPlane) {
          case 'xz':
            x[i] = coords[0];
            y[i] = coords[2];
            break;
          case 'yz':
            x[i] = coords[1];
            y[i] = coords[2];
            break;
          default: // 'xy'
            x[i] = coords[0];
            y[i] = coords[1];
            break;
        }
        if (z) z[i] = coords[2];
      } else {
        x[i] = coords[0];
        y[i] = coords[1];
      }
      originalIndices[i] = i;
    }

    return {
      ids: data.protein_ids,
      x,
      y,
      z,
      length: n,
      annotationStore: this.buildAnnotationStore(data),
      originalIndices,
    };
  }

  /**
   * Switch projection by only swapping coordinate arrays.
   * The annotation store is reused (zero copy).
   */
  static switchProjection(
    current: ColumnarData,
    data: VisualizationData,
    newProjectionIndex: number,
    projectionPlane: 'xy' | 'xz' | 'yz' = 'xy',
  ): ColumnarData {
    const n = current.length;
    const x = new Float32Array(n);
    const y = new Float32Array(n);
    let z: Float32Array | null = null;

    const projection = data.projections[newProjectionIndex];
    if (!projection) {
      return { ...current, x, y, z: null };
    }

    const is3D =
      projection.metadata?.dimension === 3 ||
      (projection.data.length > 0 && projection.data[0].length === 3);

    if (is3D) {
      z = new Float32Array(n);
    }

    for (let i = 0; i < n; i++) {
      const coords = projection.data[i];
      if (!coords) {
        x[i] = 0;
        y[i] = 0;
        if (z) z[i] = 0;
      } else if (coords.length === 3) {
        switch (projectionPlane) {
          case 'xz':
            x[i] = coords[0];
            y[i] = coords[2];
            break;
          case 'yz':
            x[i] = coords[1];
            y[i] = coords[2];
            break;
          default:
            x[i] = coords[0];
            y[i] = coords[1];
            break;
        }
        if (z) z[i] = coords[2];
      } else {
        x[i] = coords[0];
        y[i] = coords[1];
      }
    }

    // Reuse annotation store — zero copy
    return {
      ...current,
      x,
      y,
      z,
    };
  }

  /**
   * Build annotation store from VisualizationData.
   * Called once on data load, shared across all projection switches.
   */
  private static buildAnnotationStore(data: VisualizationData): AnnotationStore {
    const n = data.protein_ids.length;
    const store: AnnotationStore = {
      annotations: {},
      indices: {},
      scores: {},
      evidence: {},
    };

    for (const [key, annotation] of Object.entries(data.annotations)) {
      // Normalize annotation values (null → '__NA__')
      const normalizedValues = annotation.values.map((v) => toInternalValue(v));
      store.annotations[key] = {
        ...annotation,
        values: normalizedValues,
      };

      // Build per-point index arrays
      const pointIndices: Uint16Array[] = new Array(n) as Uint16Array[];
      const annotationData = data.annotation_data[key];

      for (let i = 0; i < n; i++) {
        const rawIndices = annotationData?.[i];
        if (rawIndices == null) {
          // Find or create __NA__ index
          let naIdx = normalizedValues.indexOf('__NA__');
          if (naIdx === -1) naIdx = normalizedValues.length;
          pointIndices[i] = new Uint16Array([naIdx]);
        } else {
          const arr = Array.isArray(rawIndices) ? rawIndices : [rawIndices];
          const valid = arr.filter(
            (idx) => typeof idx === 'number' && idx >= 0 && idx < normalizedValues.length,
          );
          if (valid.length === 0) {
            let naIdx = normalizedValues.indexOf('__NA__');
            if (naIdx === -1) naIdx = normalizedValues.length;
            pointIndices[i] = new Uint16Array([naIdx]);
          } else {
            pointIndices[i] = new Uint16Array(valid);
          }
        }
      }
      store.indices[key] = pointIndices;

      // Copy scores and evidence references (not duplicated per projection)
      if (data.annotation_scores?.[key]) {
        store.scores[key] = data.annotation_scores[key];
      }
      if (data.annotation_evidence?.[key]) {
        store.evidence[key] = data.annotation_evidence[key];
      }
    }

    return store;
  }

  /**
   * Create D3 scales from columnar coordinate data.
   */
  static createScales(
    data: ColumnarData,
    width: number,
    height: number,
    margin: { top: number; right: number; bottom: number; left: number },
  ): ScalePair | null {
    if (data.length === 0) return null;

    let xMin = Infinity;
    let xMax = -Infinity;
    let yMin = Infinity;
    let yMax = -Infinity;

    for (let i = 0; i < data.length; i++) {
      const xv = data.x[i];
      const yv = data.y[i];
      if (xv < xMin) xMin = xv;
      if (xv > xMax) xMax = xv;
      if (yv < yMin) yMin = yv;
      if (yv > yMax) yMax = yv;
    }

    if (!isFinite(xMin) || !isFinite(xMax) || !isFinite(yMin) || !isFinite(yMax)) {
      return null;
    }

    const xPadding = Math.abs(xMax - xMin) * 0.05 || 1;
    const yPadding = Math.abs(yMax - yMin) * 0.05 || 1;

    return {
      x: d3
        .scaleLinear()
        .domain([xMin - xPadding, xMax + xPadding])
        .range([margin.left, width - margin.right]),
      y: d3
        .scaleLinear()
        .domain([yMin - yPadding, yMax + yPadding])
        .range([height - margin.bottom, margin.top]),
    };
  }
}
