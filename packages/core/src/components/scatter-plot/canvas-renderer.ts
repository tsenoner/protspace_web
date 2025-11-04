import * as d3 from 'd3';
import type { PlotDataPoint } from '@protspace/utils';

export interface CanvasStyleGetters {
  getColors: (point: PlotDataPoint) => string[];
  getPointSize: (point: PlotDataPoint) => number;
  getOpacity: (point: PlotDataPoint) => number;
  getStrokeColor: (point: PlotDataPoint) => string;
  getStrokeWidth: (point: PlotDataPoint) => number;
  getShape: (point: PlotDataPoint) => d3.SymbolType;
}

function shallowCompareRecords(a: Record<string, number>, b: Record<string, number>): boolean {
  const keysA = Object.keys(a);
  const keysB = Object.keys(b);

  if (keysA.length !== keysB.length) {
    return false;
  }

  for (const key of keysA) {
    if (a[key] !== b[key]) {
      return false;
    }
  }

  return true;
}

export class CanvasRenderer {
  private canvas: HTMLCanvasElement;
  private getScales: () => {
    x: d3.ScaleLinear<number, number>;
    y: d3.ScaleLinear<number, number>;
  } | null;
  private getTransform: () => d3.ZoomTransform;
  private style: CanvasStyleGetters;
  private getSizeScaleExponent: () => number = () => 1;
  private cachedScreenX: Float32Array | null = null;
  private cachedScreenY: Float32Array | null = null;
  private cachedLen: number = 0;
  private cachedScaleSig: string | null = null;
  private cachedPointsRef: PlotDataPoint[] | null = null;
  private styleSignature: string | null = null;
  private zOrderMapping: Record<string, number> = {};
  private selectedFeature: string = '';
  private groupsCache: Array<{
    isCircle: boolean;
    isMultiLabel?: boolean;
    path?: Path2D;
    colors: string[];
    strokeColor: string;
    strokeWidth: number;
    opacity: number;
    basePointSize: number; // radius-like size before zoom adjustment
    indices: Uint32Array;
    zOrder: number; // z-order for sorting groups
  }> | null = null;

  constructor(
    canvas: HTMLCanvasElement,
    getScales: () => {
      x: d3.ScaleLinear<number, number>;
      y: d3.ScaleLinear<number, number>;
    } | null,
    getTransform: () => d3.ZoomTransform,
    style: CanvasStyleGetters,
    getSizeScaleExponent?: () => number
  ) {
    this.canvas = canvas;
    this.getScales = getScales;
    this.getTransform = getTransform;
    this.style = style;
    if (getSizeScaleExponent) this.getSizeScaleExponent = getSizeScaleExponent;
  }

  setStyleSignature(signature: string | null) {
    if (this.styleSignature !== signature) {
      this.styleSignature = signature;
      this.groupsCache = null;
    }
  }

  setZOrderMapping(zOrderMapping: Record<string, number>) {
    const hasChanged = !shallowCompareRecords(this.zOrderMapping, zOrderMapping);
    if (hasChanged) {
      this.zOrderMapping = { ...zOrderMapping };
      this.groupsCache = null; // Force re-grouping with new z-order
    }
  }

  setSelectedFeature(feature: string) {
    if (this.selectedFeature !== feature) {
      this.selectedFeature = feature;
      this.groupsCache = null; // Force re-grouping with new feature
    }
  }

  invalidateStyleCache() {
    this.groupsCache = null;
  }

  invalidatePositionCache() {
    this.cachedScreenX = null;
    this.cachedScreenY = null;
    this.cachedScaleSig = null;
    this.cachedPointsRef = null;
    this.cachedLen = 0;
  }

  setupHighDPICanvas(width: number, height: number) {
    const dpr = window.devicePixelRatio || 1;
    this.canvas.width = width * dpr;
    this.canvas.height = height * dpr;
    this.canvas.style.width = `${width}px`;
    this.canvas.style.height = `${height}px`;
    const ctx = this.canvas.getContext('2d');
    if (ctx) {
      ctx.scale(dpr, dpr);
      this.applyCanvasQualitySettings(ctx);
    }
  }

  applyCanvasQualitySettings(ctx: CanvasRenderingContext2D) {
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
  }

  render(pointsData: PlotDataPoint[]) {
    const scales = this.getScales();
    if (!scales) return;

    const ctx = this.canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    const transform = this.getTransform();
    ctx.save();
    ctx.translate(transform.x, transform.y);
    ctx.scale(transform.k, transform.k);

    // Precompute and cache screen-space positions (before zoom transform)
    const scaleSig = `${scales.x.domain().join(',')}|${scales.x.range().join(',')}|${scales.y.domain().join(',')}|${scales.y.range().join(',')}`;
    const needsPos =
      !this.cachedScreenX ||
      !this.cachedScreenY ||
      this.cachedLen !== pointsData.length ||
      this.cachedScaleSig !== scaleSig ||
      this.cachedPointsRef !== pointsData;
    if (needsPos) {
      this.cachedScreenX = new Float32Array(pointsData.length);
      this.cachedScreenY = new Float32Array(pointsData.length);
      for (let i = 0; i < pointsData.length; i++) {
        const p = pointsData[i];
        this.cachedScreenX[i] = scales.x(p.x);
        this.cachedScreenY[i] = scales.y(p.y);
      }
      this.cachedLen = pointsData.length;
      this.cachedScaleSig = scaleSig;
      this.cachedPointsRef = pointsData;
    }

    // Build or reuse style groups cache
    if (!this.groupsCache) {
      // Batch points by style and shape, store indices
      const tempGroups = new Map<string, { meta: any; idx: number[]; zOrders: number[] }>();

      for (let i = 0; i < pointsData.length; i++) {
        const point = pointsData[i];
        const opacity = this.style.getOpacity(point);
        if (opacity === 0) continue;
        const colors = this.style.getColors(point);
        const size = Math.sqrt(this.style.getPointSize(point)) / 3;
        const strokeColor = this.style.getStrokeColor(point);
        const strokeWidth = this.style.getStrokeWidth(point);
        const shape = this.style.getShape(point);
        const isCircle = shape === d3.symbolCircle;
        const area = Math.pow(size * 3, 2);
        const pathString = isCircle ? null : d3.symbol().type(shape).size(area)()!;
        const shapeKey = isCircle ? 'circle' : `path:${pathString}`;
        const isMultiLabel = colors.length > 1;

        const key = `${colors}_${size}_${strokeColor}_${strokeWidth}_${opacity}_${shapeKey}${isMultiLabel ? '_multilabel' : ''}`;

        // Get z-order for this point's feature value
        let pointZOrder = Number.MAX_SAFE_INTEGER; // Default to very high number (drawn last)
        if (point.featureValues && this.selectedFeature) {
          const featureValue = point.featureValues[this.selectedFeature];
          pointZOrder = Math.max(...featureValue.map((v) => this.zOrderMapping[v] ?? -1));

          if (pointZOrder === 0) {
            pointZOrder = Number.MAX_SAFE_INTEGER;
          }
        }

        let entry = tempGroups.get(key);
        if (!entry) {
          entry = {
            meta: {
              isCircle,
              isMultiLabel,
              path: isCircle ? undefined : new Path2D(pathString!),
              colors,
              strokeColor,
              strokeWidth,
              opacity,
              basePointSize: size,
            },
            idx: [],
            zOrders: [],
          };
          tempGroups.set(key, entry);
        }
        entry.idx.push(i);
        entry.zOrders.push(pointZOrder);
      }
      this.groupsCache = Array.from(tempGroups.values()).map((g) => ({
        isCircle: g.meta.isCircle,
        isMultiLabel: g.meta.isMultiLabel,
        path: g.meta.path,
        colors: g.meta.colors,
        strokeColor: g.meta.strokeColor,
        strokeWidth: g.meta.strokeWidth,
        opacity: g.meta.opacity,
        basePointSize: g.meta.basePointSize,
        indices: Uint32Array.from(g.idx),
        zOrder: g.zOrders.reduce((max, z) => Math.max(max, z), -Infinity), // Use maximum z-order for the group (drawn later = on top)
      }));
    }

    const exp = this.getSizeScaleExponent();
    const invKExp = 1 / Math.pow(transform.k, exp);

    // Sort groups by z-order (higher z-order = drawn later = appears on top)
    const sortedGroups = [...this.groupsCache].sort((a, b) => b.zOrder - a.zOrder);

    for (const group of sortedGroups) {
      if (group.indices.length === 0) continue;
      const pointSize = Math.max(0.5, group.basePointSize / Math.pow(transform.k, exp));
      ctx.globalAlpha = group.opacity;
      ctx.strokeStyle = group.strokeColor;
      ctx.lineWidth = group.strokeWidth / transform.k;

      if (group.isCircle) {
        const arc = (2 * Math.PI) / group.colors.length;

        if (group.isMultiLabel) {
          for (let i = 0; i < group.colors.length; i++) {
            ctx.fillStyle = group.colors[i];

            ctx.beginPath();

            for (let j = 0; j < group.indices.length; j++) {
              const idx = group.indices[j];
              const x = this.cachedScreenX![idx];
              const y = this.cachedScreenY![idx];
              ctx.moveTo(x, y);
              ctx.arc(x, y, pointSize, i * arc, (i + 1) * arc);
            }

            ctx.fill();
            if (group.strokeWidth > 0) {
              ctx.save();
              ctx.globalAlpha = 0.35 * group.opacity;
              ctx.stroke();
              ctx.restore();
            }
          }
        } else {
          ctx.fillStyle = group.colors[0];
          ctx.beginPath();
          for (let i = 0; i < group.indices.length; i++) {
            const idx = group.indices[i];
            const x = this.cachedScreenX![idx];
            const y = this.cachedScreenY![idx];
            ctx.moveTo(x + pointSize, y);
            ctx.arc(x, y, pointSize, 0, 2 * Math.PI);
          }

          ctx.fill();

          if (group.strokeWidth > 0) {
            ctx.save();
            ctx.globalAlpha = 0.35 * group.opacity;
            ctx.stroke();
            ctx.restore();
          }
        }
      } else if (group.colors.length === 1) {
        ctx.fillStyle = group.colors[0];
        const shapePath = group.path!;
        const combinedPath = new Path2D();
        for (let i = 0; i < group.indices.length; i++) {
          const idx = group.indices[i];
          const x = this.cachedScreenX![idx];
          const y = this.cachedScreenY![idx];
          const m = new DOMMatrix().translateSelf(x, y).scaleSelf(invKExp, invKExp);
          // @ts-ignore addPath with matrix is available on modern browsers
          combinedPath.addPath(shapePath, m);
        }
        ctx.fill(combinedPath);
        if (group.strokeWidth > 0) {
          ctx.save();
          ctx.globalAlpha = 0.35 * group.opacity;
          ctx.stroke(combinedPath);
          ctx.restore();
        }
      } else {
        throw new Error('Multilabel values only support circle shape');
      }
    }

    ctx.restore();
  }
}
