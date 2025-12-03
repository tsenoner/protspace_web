import * as d3 from 'd3';
import type { PlotDataPoint, ScatterplotConfig } from '@protspace/utils';
import {
  type WebGLStyleGetters,
  type ScalePair,
  type RenderMode,
  DENSITY_MODE_THRESHOLD,
  DENSITY_PER_PIXEL_THRESHOLD,
  DENSITY_GRID_SIZE,
  KERNEL_RADIUS,
  POINT_MODE_ZOOM_THRESHOLD,
  MAX_POINTS_DIRECT_RENDER,
} from './types';
import { resolveColor } from './color-utils';
import { getPointShaders, getDensityShaders } from './shaders';
import { createProgramFromSources } from './shader-utils';

// ============================================================================
// Hybrid Density/Point WebGL Renderer
// ============================================================================

export class WebGLRenderer {
  private gl: WebGL2RenderingContext | WebGLRenderingContext | null = null;
  private isWebGL2 = false;

  // Point rendering
  private pointProgram: WebGLProgram | null = null;
  private pointVao: WebGLVertexArrayObject | WebGLVertexArrayObjectOES | null = null;
  private pointAttribLocations: {
    dataPosition: number;
    size: number;
    color: number;
  } | null = null;
  private pointUniformLocations: {
    resolution: WebGLUniformLocation | null;
    transform: WebGLUniformLocation | null;
    dpr: WebGLUniformLocation | null;
  } | null = null;

  // Density rendering
  private densityProgram: WebGLProgram | null = null;
  private densityTexture: WebGLTexture | null = null;
  private densityQuadBuffer: WebGLBuffer | null = null;
  private densityUniformLocations: {
    densityTexture: WebGLUniformLocation | null;
    maxDensity: WebGLUniformLocation | null;
    opacity: WebGLUniformLocation | null;
    colorLow: WebGLUniformLocation | null;
    colorMid: WebGLUniformLocation | null;
    colorHigh: WebGLUniformLocation | null;
  } | null = null;

  // GPU Buffers
  private dataPositionBuffer: WebGLBuffer | null = null;
  private sizeBuffer: WebGLBuffer | null = null;
  private colorBuffer: WebGLBuffer | null = null;

  // CPU arrays
  private dataPositions = new Float32Array(0);
  private sizes = new Float32Array(0);
  private colors = new Float32Array(0);

  // Density grid
  private densityGrid = new Float32Array(0);
  private densityGridWidth = 0;
  private densityGridHeight = 0;
  private maxDensityValue = 1;

  // State
  private capacity = 0;
  private currentPointCount = 0;
  private positionsDirty = true;
  private stylesDirty = true;
  private densityDirty = true;
  private buffersInitialized = false;

  // Caching
  private lastDataSignature: string | null = null;
  private lastStyleSignature: string | null = null;

  // Rendering mode
  private renderMode: RenderMode = 'points';
  private hybridBlend = 1.0;

  // Config
  private dpr = window.devicePixelRatio || 1;
  private styleSignature: string | null = null;
  private _zOrderMapping: Record<string, number> = {};
  private selectedFeature = '';
  private vaoExtension: OES_vertex_array_object | null = null;
  private primaryColor: [number, number, number] = [0.3, 0.5, 0.8];

  constructor(
    private canvas: HTMLCanvasElement,
    private getScales: () => ScalePair | null,
    private getTransform: () => d3.ZoomTransform,
    private getConfig: () => ScatterplotConfig,
    private style: WebGLStyleGetters
  ) {}

  // ============================================================================
  // Public API
  // ============================================================================

  setStyleSignature(signature: string | null) {
    if (this.styleSignature !== signature) {
      this.styleSignature = signature;
      this.stylesDirty = true;
      this.densityDirty = true;
    }
  }

  setZOrderMapping(mapping: Record<string, number>) {
    this._zOrderMapping = { ...mapping };
    // Reserved for future z-ordering implementation
    void this._zOrderMapping;
  }

  setSelectedFeature(feature: string) {
    if (this.selectedFeature !== feature) {
      this.selectedFeature = feature;
      this.stylesDirty = true;
      this.densityDirty = true;
    }
  }

  invalidateStyleCache() {
    this.stylesDirty = true;
    this.densityDirty = true;
  }

  invalidatePositionCache() {
    this.positionsDirty = true;
    this.densityDirty = true;
  }

  resize(width: number, height: number) {
    const dpr = window.devicePixelRatio || 1;
    this.dpr = dpr;
    const physicalWidth = Math.max(1, Math.floor(width * dpr));
    const physicalHeight = Math.max(1, Math.floor(height * dpr));

    if (this.canvas.width !== physicalWidth || this.canvas.height !== physicalHeight) {
      this.canvas.width = physicalWidth;
      this.canvas.height = physicalHeight;
      this.canvas.style.width = `${width}px`;
      this.canvas.style.height = `${height}px`;
      this.gl?.viewport(0, 0, physicalWidth, physicalHeight);
      this.densityDirty = true;
    }
  }

  clear() {
    const gl = this.ensureGL();
    if (!gl) return;
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    this.currentPointCount = 0;
  }

  render(points: PlotDataPoint[]) {
    const gl = this.ensureGL();
    const scales = this.getScales();
    if (!gl || !scales) return;

    const config = this.getConfig();
    const width = config.width ?? 800;
    const height = config.height ?? 600;
    this.resize(width, height);

    const transform = this.getTransform();
    const totalPoints = points.length;
    this.determineRenderMode(totalPoints, transform.k, width, height);

    // Debug log
    console.log(`[WebGL] Mode: ${this.renderMode}, points: ${totalPoints}, zoom: ${transform.k.toFixed(2)}, blend: ${this.hybridBlend.toFixed(2)}`);

    const dataSignature = this.computeDataSignature(points);
    const styleSignature = this.computeStyleSignature(points);

    const needsPositionUpdate = this.positionsDirty || dataSignature !== this.lastDataSignature;
    const needsStyleUpdate = this.stylesDirty || styleSignature !== this.lastStyleSignature;

    if (needsPositionUpdate || needsStyleUpdate) {
      this.populateBuffers(points, scales, needsPositionUpdate, needsStyleUpdate);
      this.lastDataSignature = dataSignature;
      this.lastStyleSignature = styleSignature;
      this.positionsDirty = false;
      this.stylesDirty = false;
    }

    // Update density when in density/hybrid mode
    if ((this.renderMode === 'density' || this.renderMode === 'hybrid') &&
        (this.densityDirty || needsPositionUpdate)) {
      this.computeDensityGrid(points, scales, width, height, transform);
      this.uploadDensityTexture();
      this.densityDirty = false;
    }

    // Clear
    gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);

    // Render based on mode
    if (this.renderMode === 'density') {
      this.renderDensity(1.0);
    } else if (this.renderMode === 'hybrid') {
      this.renderDensity(1.0 - this.hybridBlend * 0.7);
      this.renderPoints(transform);
    } else {
      this.renderPoints(transform);
    }
  }

  dispose() {
    const gl = this.gl;
    if (!gl) return;

    if (this.pointVao) {
      if (this.isWebGL2) {
        (gl as WebGL2RenderingContext).deleteVertexArray(this.pointVao as WebGLVertexArrayObject);
      } else if (this.vaoExtension) {
        this.vaoExtension.deleteVertexArrayOES(this.pointVao as WebGLVertexArrayObjectOES);
      }
    }

    if (this.dataPositionBuffer) gl.deleteBuffer(this.dataPositionBuffer);
    if (this.sizeBuffer) gl.deleteBuffer(this.sizeBuffer);
    if (this.colorBuffer) gl.deleteBuffer(this.colorBuffer);
    if (this.densityQuadBuffer) gl.deleteBuffer(this.densityQuadBuffer);
    if (this.densityTexture) gl.deleteTexture(this.densityTexture);
    if (this.pointProgram) gl.deleteProgram(this.pointProgram);
    if (this.densityProgram) gl.deleteProgram(this.densityProgram);

    this.gl = null;
  }

  // ============================================================================
  // Render Mode Determination
  // ============================================================================

  private determineRenderMode(totalPoints: number, zoomLevel: number, width: number, height: number) {
    // Small datasets: always points
    if (totalPoints < DENSITY_MODE_THRESHOLD) {
      this.renderMode = 'points';
      this.hybridBlend = 1.0;
      return;
    }

    // Calculate density
    const viewportArea = width * height;
    const effectiveArea = viewportArea * zoomLevel * zoomLevel;
    const pointsPerPixel = totalPoints / effectiveArea;

    // High zoom = points
    if (zoomLevel >= POINT_MODE_ZOOM_THRESHOLD) {
      this.renderMode = 'points';
      this.hybridBlend = 1.0;
      return;
    }

    // Low density = points
    if (pointsPerPixel < DENSITY_PER_PIXEL_THRESHOLD) {
      this.renderMode = 'points';
      this.hybridBlend = 1.0;
      return;
    }

    // Very zoomed out with high density = density only
    if (zoomLevel < 1.2 && pointsPerPixel > DENSITY_PER_PIXEL_THRESHOLD * 2) {
      this.renderMode = 'density';
      this.hybridBlend = 0.0;
      return;
    }

    // Transition zone = hybrid
    this.renderMode = 'hybrid';
    this.hybridBlend = Math.min(1.0, (zoomLevel - 1.0) / (POINT_MODE_ZOOM_THRESHOLD - 1.0));
  }

  // ============================================================================
  // Density Grid Computation
  // ============================================================================

  private computeDensityGrid(
    points: PlotDataPoint[],
    scales: ScalePair,
    width: number,
    height: number,
    transform: d3.ZoomTransform
  ) {
    const aspectRatio = width / height;
    const gridWidth = Math.round(DENSITY_GRID_SIZE * Math.max(1, aspectRatio));
    const gridHeight = Math.round(DENSITY_GRID_SIZE / Math.min(1, aspectRatio));

    if (this.densityGridWidth !== gridWidth || this.densityGridHeight !== gridHeight) {
      this.densityGridWidth = gridWidth;
      this.densityGridHeight = gridHeight;
      this.densityGrid = new Float32Array(gridWidth * gridHeight);
    }

    this.densityGrid.fill(0);

    const cellWidth = width / gridWidth;
    const cellHeight = height / gridHeight;
    const colorCounts = new Map<string, number>();

    for (const point of points) {
      const opacity = this.style.getOpacity(point);
      if (opacity === 0) continue;

      // Transform point to screen coordinates
      const baseX = scales.x(point.x);
      const baseY = scales.y(point.y);
      const screenX = transform.applyX(baseX);
      const screenY = transform.applyY(baseY);

      // Skip points outside viewport
      if (screenX < 0 || screenX > width || screenY < 0 || screenY > height) continue;

      const gridX = Math.floor(screenX / cellWidth);
      const gridY = Math.floor(screenY / cellHeight);

      // Gaussian kernel
      for (let dy = -KERNEL_RADIUS; dy <= KERNEL_RADIUS; dy++) {
        for (let dx = -KERNEL_RADIUS; dx <= KERNEL_RADIUS; dx++) {
          const gx = gridX + dx;
          const gy = gridY + dy;

          if (gx >= 0 && gx < gridWidth && gy >= 0 && gy < gridHeight) {
            const dist = Math.sqrt(dx * dx + dy * dy);
            const weight = Math.exp(-(dist * dist) / (2 * KERNEL_RADIUS * 0.5));
            this.densityGrid[gy * gridWidth + gx] += weight * opacity;
          }
        }
      }

      // Track colors
      const colors = this.style.getColors(point);
      const colorKey = colors[0] || '#888888';
      colorCounts.set(colorKey, (colorCounts.get(colorKey) || 0) + 1);
    }

    // Find max density
    this.maxDensityValue = 0;
    for (let i = 0; i < this.densityGrid.length; i++) {
      if (this.densityGrid[i] > this.maxDensityValue) {
        this.maxDensityValue = this.densityGrid[i];
      }
    }
    if (this.maxDensityValue === 0) this.maxDensityValue = 1;

    // Find primary color
    let maxCount = 0;
    let primaryColorStr = '#4a90d9';
    for (const [color, count] of colorCounts) {
      if (count > maxCount) {
        maxCount = count;
        primaryColorStr = color;
      }
    }
    this.primaryColor = resolveColor(primaryColorStr);
  }

  private uploadDensityTexture() {
    const gl = this.gl;
    if (!gl || this.densityGrid.length === 0) return;

    if (!this.densityTexture) {
      this.densityTexture = gl.createTexture();
    }

    gl.bindTexture(gl.TEXTURE_2D, this.densityTexture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

    // Convert to RGBA for compatibility
    const rgbaData = new Uint8Array(this.densityGrid.length * 4);
    for (let i = 0; i < this.densityGrid.length; i++) {
      const normalized = Math.min(255, Math.floor((this.densityGrid[i] / this.maxDensityValue) * 255));
      rgbaData[i * 4] = normalized;
      rgbaData[i * 4 + 1] = normalized;
      rgbaData[i * 4 + 2] = normalized;
      rgbaData[i * 4 + 3] = 255;
    }

    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RGBA,
      this.densityGridWidth,
      this.densityGridHeight,
      0,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      rgbaData
    );
  }

  // ============================================================================
  // WebGL Setup
  // ============================================================================

  private ensureGL() {
    if (this.gl && this.pointProgram && this.pointAttribLocations && this.pointUniformLocations) {
      return this.gl;
    }

    const contextOptions: WebGLContextAttributes = {
      antialias: true,
      preserveDrawingBuffer: true,
      premultipliedAlpha: false,
      alpha: true,
      powerPreference: 'high-performance',
    };

    const gl2 = this.canvas.getContext('webgl2', contextOptions) as WebGL2RenderingContext | null;
    if (gl2) {
      this.isWebGL2 = true;
      this.gl = gl2;
    } else {
      const gl1 = (this.canvas.getContext('webgl', contextOptions) ||
        this.canvas.getContext('experimental-webgl', contextOptions)) as WebGLRenderingContext | null;
      if (!gl1) {
        console.error('WebGL not available');
        return null;
      }
      this.isWebGL2 = false;
      this.gl = gl1;
    }

    const gl = this.gl;

    if (!this.isWebGL2) {
      this.vaoExtension = gl.getExtension('OES_vertex_array_object');
    }

    if (!this.initializePointShaders(gl)) return null;
    this.initializeDensityShaders(gl);

    this.dataPositionBuffer = gl.createBuffer();
    this.sizeBuffer = gl.createBuffer();
    this.colorBuffer = gl.createBuffer();
    this.densityQuadBuffer = gl.createBuffer();

    this.createPointVAO();
    this.setupDensityQuad();

    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

    return gl;
  }

  private initializePointShaders(gl: WebGL2RenderingContext | WebGLRenderingContext): boolean {
    const shaders = getPointShaders(this.isWebGL2);
    this.pointProgram = createProgramFromSources(gl, shaders.vertex, shaders.fragment);
    if (!this.pointProgram) return false;

    this.pointAttribLocations = {
      dataPosition: gl.getAttribLocation(this.pointProgram, 'a_dataPosition'),
      size: gl.getAttribLocation(this.pointProgram, 'a_pointSize'),
      color: gl.getAttribLocation(this.pointProgram, 'a_color'),
    };

    this.pointUniformLocations = {
      resolution: gl.getUniformLocation(this.pointProgram, 'u_resolution'),
      transform: gl.getUniformLocation(this.pointProgram, 'u_transform'),
      dpr: gl.getUniformLocation(this.pointProgram, 'u_dpr'),
    };

    return true;
  }

  private initializeDensityShaders(gl: WebGL2RenderingContext | WebGLRenderingContext) {
    const shaders = getDensityShaders(this.isWebGL2);
    this.densityProgram = createProgramFromSources(gl, shaders.vertex, shaders.fragment);
    if (!this.densityProgram) return;

    this.densityUniformLocations = {
      densityTexture: gl.getUniformLocation(this.densityProgram, 'u_densityTexture'),
      maxDensity: gl.getUniformLocation(this.densityProgram, 'u_maxDensity'),
      opacity: gl.getUniformLocation(this.densityProgram, 'u_opacity'),
      colorLow: gl.getUniformLocation(this.densityProgram, 'u_colorLow'),
      colorMid: gl.getUniformLocation(this.densityProgram, 'u_colorMid'),
      colorHigh: gl.getUniformLocation(this.densityProgram, 'u_colorHigh'),
    };
  }

  // ============================================================================
  // VAO Setup
  // ============================================================================

  private createPointVAO() {
    const gl = this.gl;
    if (!gl || !this.pointAttribLocations) return;

    if (this.isWebGL2) {
      this.pointVao = (gl as WebGL2RenderingContext).createVertexArray();
    } else if (this.vaoExtension) {
      this.pointVao = this.vaoExtension.createVertexArrayOES();
    }

    this.bindPointVAO();

    gl.bindBuffer(gl.ARRAY_BUFFER, this.dataPositionBuffer);
    gl.enableVertexAttribArray(this.pointAttribLocations.dataPosition);
    gl.vertexAttribPointer(this.pointAttribLocations.dataPosition, 2, gl.FLOAT, false, 0, 0);

    gl.bindBuffer(gl.ARRAY_BUFFER, this.sizeBuffer);
    gl.enableVertexAttribArray(this.pointAttribLocations.size);
    gl.vertexAttribPointer(this.pointAttribLocations.size, 1, gl.FLOAT, false, 0, 0);

    gl.bindBuffer(gl.ARRAY_BUFFER, this.colorBuffer);
    gl.enableVertexAttribArray(this.pointAttribLocations.color);
    gl.vertexAttribPointer(this.pointAttribLocations.color, 4, gl.FLOAT, false, 0, 0);

    this.unbindVAO();
  }

  private setupDensityQuad() {
    const gl = this.gl;
    if (!gl || !this.densityQuadBuffer) return;

    // Full-screen quad in clip space
    const quadVertices = new Float32Array([
      -1, -1,
       1, -1,
      -1,  1,
      -1,  1,
       1, -1,
       1,  1,
    ]);

    gl.bindBuffer(gl.ARRAY_BUFFER, this.densityQuadBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, quadVertices, gl.STATIC_DRAW);
  }

  private bindPointVAO() {
    if (this.pointVao) {
      if (this.isWebGL2) {
        (this.gl as WebGL2RenderingContext).bindVertexArray(this.pointVao as WebGLVertexArrayObject);
      } else if (this.vaoExtension) {
        this.vaoExtension.bindVertexArrayOES(this.pointVao as WebGLVertexArrayObjectOES);
      }
    }
  }

  private unbindVAO() {
    if (this.isWebGL2) {
      (this.gl as WebGL2RenderingContext).bindVertexArray(null);
    } else if (this.vaoExtension) {
      this.vaoExtension.bindVertexArrayOES(null);
    }
  }

  // ============================================================================
  // Rendering
  // ============================================================================

  private renderPoints(transform: d3.ZoomTransform) {
    const gl = this.gl;
    if (!gl || this.currentPointCount === 0 || !this.pointProgram || !this.pointUniformLocations) return;

    gl.useProgram(this.pointProgram);
    gl.uniform2f(this.pointUniformLocations.resolution, this.canvas.width, this.canvas.height);
    gl.uniform3f(this.pointUniformLocations.transform, transform.x, transform.y, transform.k);
    gl.uniform1f(this.pointUniformLocations.dpr, this.dpr);

    this.bindPointVAO();
    gl.drawArrays(gl.POINTS, 0, this.currentPointCount);
    this.unbindVAO();
  }

  private renderDensity(opacity: number) {
    const gl = this.gl;
    if (!gl || !this.densityProgram || !this.densityUniformLocations || !this.densityTexture) return;

    gl.useProgram(this.densityProgram);

    gl.uniform1f(this.densityUniformLocations.maxDensity, this.maxDensityValue);
    gl.uniform1f(this.densityUniformLocations.opacity, opacity);

    // Color ramp
    const [r, g, b] = this.primaryColor;
    gl.uniform3f(this.densityUniformLocations.colorLow,
      Math.min(1, r * 0.3 + 0.7),
      Math.min(1, g * 0.3 + 0.7),
      Math.min(1, b * 0.3 + 0.7));
    gl.uniform3f(this.densityUniformLocations.colorMid, r, g, b);
    gl.uniform3f(this.densityUniformLocations.colorHigh, r * 0.5, g * 0.5, b * 0.5);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.densityTexture);
    gl.uniform1i(this.densityUniformLocations.densityTexture, 0);

    // Draw full-screen quad
    gl.bindBuffer(gl.ARRAY_BUFFER, this.densityQuadBuffer);
    const posLoc = gl.getAttribLocation(this.densityProgram, 'a_position');
    gl.enableVertexAttribArray(posLoc);
    gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);

    gl.drawArrays(gl.TRIANGLES, 0, 6);

    gl.disableVertexAttribArray(posLoc);
  }

  // ============================================================================
  // Buffer Management
  // ============================================================================

  private computeDataSignature(points: PlotDataPoint[]): string {
    if (points.length === 0) return 'empty';
    const len = points.length;
    const s1 = points[0];
    const s2 = points[Math.floor(len / 2)];
    const s3 = points[len - 1];
    return `${len}|${s1.x.toFixed(2)},${s1.y.toFixed(2)}|${s2.x.toFixed(2)},${s2.y.toFixed(2)}|${s3.x.toFixed(2)},${s3.y.toFixed(2)}`;
  }

  private computeStyleSignature(points: PlotDataPoint[]): string {
    if (points.length === 0) return 'empty';
    const len = points.length;
    const indices = [0, Math.floor(len / 4), Math.floor(len / 2), len - 1];
    const parts = indices.filter(i => i < len).map(i => {
      const p = points[i];
      return `${p.id}:${this.style.getOpacity(p).toFixed(2)}:${this.style.getColors(p)[0]}`;
    });
    return `${this.styleSignature}|${parts.join('|')}`;
  }

  private populateBuffers(points: PlotDataPoint[], scales: ScalePair, updatePositions: boolean, updateStyles: boolean) {
    const gl = this.gl;
    if (!gl) return;

    const maxPoints = Math.min(points.length, MAX_POINTS_DIRECT_RENDER);

    if (maxPoints > this.capacity) {
      this.expandCapacity(maxPoints);
      updatePositions = true;
      updateStyles = true;
    }

    let idx = 0;
    for (let i = 0; i < points.length && idx < maxPoints; i++) {
      const point = points[i];
      const opacity = this.style.getOpacity(point);
      if (opacity === 0) continue;

      if (updatePositions) {
        this.dataPositions[idx * 2] = scales.x(point.x);
        this.dataPositions[idx * 2 + 1] = scales.y(point.y);
      }

      if (updateStyles) {
        const [r, g, b] = resolveColor(this.style.getColors(point)[0] ?? '#888888');
        const size = Math.sqrt(this.style.getPointSize(point)) / 3;

        this.colors[idx * 4] = r;
        this.colors[idx * 4 + 1] = g;
        this.colors[idx * 4 + 2] = b;
        this.colors[idx * 4 + 3] = Math.min(1, Math.max(0, opacity));
        this.sizes[idx] = Math.max(1, size * 2 * this.dpr);
      }

      idx++;
    }

    this.currentPointCount = idx;

    this.bindPointVAO();

    if (updatePositions) {
      gl.bindBuffer(gl.ARRAY_BUFFER, this.dataPositionBuffer);
      if (this.buffersInitialized) {
        gl.bufferSubData(gl.ARRAY_BUFFER, 0, this.dataPositions.subarray(0, idx * 2));
      } else {
        gl.bufferData(gl.ARRAY_BUFFER, this.dataPositions, gl.DYNAMIC_DRAW);
      }
    }

    if (updateStyles) {
      gl.bindBuffer(gl.ARRAY_BUFFER, this.sizeBuffer);
      if (this.buffersInitialized) {
        gl.bufferSubData(gl.ARRAY_BUFFER, 0, this.sizes.subarray(0, idx));
      } else {
        gl.bufferData(gl.ARRAY_BUFFER, this.sizes, gl.DYNAMIC_DRAW);
      }

      gl.bindBuffer(gl.ARRAY_BUFFER, this.colorBuffer);
      if (this.buffersInitialized) {
        gl.bufferSubData(gl.ARRAY_BUFFER, 0, this.colors.subarray(0, idx * 4));
      } else {
        gl.bufferData(gl.ARRAY_BUFFER, this.colors, gl.DYNAMIC_DRAW);
      }
    }

    this.unbindVAO();
    this.buffersInitialized = true;
  }

  private expandCapacity(minCapacity: number) {
    const nextCapacity = Math.pow(2, Math.ceil(Math.log2(Math.max(minCapacity, 1024))));
    this.capacity = nextCapacity;
    this.dataPositions = new Float32Array(nextCapacity * 2);
    this.colors = new Float32Array(nextCapacity * 4);
    this.sizes = new Float32Array(nextCapacity);
    this.buffersInitialized = false;
  }
}

