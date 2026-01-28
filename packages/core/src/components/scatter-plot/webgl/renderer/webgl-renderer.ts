/**
 * WebGL2 Renderer with Gamma-Correct Rendering Pipeline
 *
 * This renderer implements a two-pass gamma-correct rendering pipeline:
 * 1. Render points to a linear RGB framebuffer
 * 2. Apply gamma correction to convert to sRGB for display
 *
 * Falls back to direct rendering if gamma pipeline is unavailable.
 */

import * as d3 from 'd3';
import type { PlotDataPoint, ScatterplotConfig } from '@protspace/utils';
import { getShapeIndex } from '@protspace/utils';
import {
  type WebGLStyleGetters,
  type ScalePair,
  type FramebufferResources,
  MAX_POINTS_DIRECT_RENDER,
  DEFAULT_GAMMA,
} from '../types';
import { resolveColor } from '../color-utils';
import { createProgramFromSources } from '../shader-utils';

// ============================================================================
// Shader Sources
// ============================================================================

// Constants
const POINT_SIZE_DIVISOR = 3;
const MIN_POINT_SIZE = 1;
const MIN_CAPACITY = 1024;
const MAX_LABELS = 8;
const LABEL_TEXTURE_WIDTH = 2048;
const DIAMOND_SIZE_SCALE = 1.25;

const POINT_VERTEX_SHADER = `#version 300 es
precision highp float;

in vec2 a_dataPosition;
in float a_pointSize;
in vec4 a_color;
in float a_depth;
in float a_labelCount;
in float a_shape;

uniform vec2 u_resolution;
uniform vec3 u_transform;
uniform float u_dpr;
uniform float u_gamma;

out vec4 v_color;
out float v_labelCount;
flat out float v_shape;
flat out int v_pointIndex;

void main() {
  vec2 cssTransformed = a_dataPosition * u_transform.z + u_transform.xy;
  vec2 physicalPos = cssTransformed * u_dpr;
  vec2 clipSpace = (physicalPos / u_resolution) * 2.0 - 1.0;

  // Depth is computed per-point on the CPU (opacity + legend z-order tie-break)
  gl_Position = vec4(clipSpace.x, -clipSpace.y, a_depth, 1.0);
  gl_PointSize = max(1.0, a_pointSize);

  // Convert sRGB input to linear RGB for proper blending
  vec3 linearColor = pow(max(a_color.rgb, vec3(0.0)), vec3(u_gamma));
  v_color = vec4(linearColor, a_color.a);
  v_labelCount = a_labelCount;
  v_shape = a_shape;
  v_pointIndex = gl_VertexID;
}`;

const POINT_FRAGMENT_SHADER = `#version 300 es
precision highp float;

in vec4 v_color;
in float v_labelCount;
flat in float v_shape;
flat in int v_pointIndex;

uniform sampler2D u_labelColors;
uniform vec2 u_labelTextureSize;
uniform int u_maxLabels;
uniform float u_gamma;

out vec4 fragColor;

const float PI = 3.14159265359;
const float SQRT3 = 1.73205080757;

void main() {
  vec2 coord = gl_PointCoord * 2.0 - 1.0;
  bool discard_fragment = false;

  // Shape rendering (0=circle, 1=square, 2=diamond, 3=triangle-up, 4=triangle-down, 5=plus)
  if (v_shape < 0.5) { // Circle
    discard_fragment = dot(coord, coord) > 1.0;
  } else if (v_shape < 1.5) { // Square
    discard_fragment = abs(coord.x) > 1.0 || abs(coord.y) > 1.0;
  } else if (v_shape < 2.5) { // Diamond
    // Match d3.symbolDiamond proportions (same mapping as D3's "tan30" constant, i.e. sqrt(1/3))
    discard_fragment = abs(coord.x) * SQRT3 + abs(coord.y) > 1.0;
  } else if (v_shape < 3.5) { // Triangle Up
    discard_fragment = abs(coord.x) * SQRT3 > 1.0 + coord.y;
  } else if (v_shape < 4.5) { // Triangle Down
    discard_fragment = abs(coord.x) * SQRT3 > 1.0 - coord.y;
  } else { // Plus
    float thickness = 0.35;
    bool inVertical = abs(coord.x) < thickness;
    bool inHorizontal = abs(coord.y) < thickness;
    discard_fragment = !(inVertical || inHorizontal);
  }

  if (discard_fragment) discard;

  vec3 finalColor = v_color.rgb;

  // Pie Chart Logic (only for multi-label points, which always use circle shape)
  if (v_labelCount > 1.5) {
    float angle = atan(coord.y, coord.x); // -PI to PI
    // Map to 0..1
    float normalizedAngle = (angle + PI) / (2.0 * PI);

    float count = floor(v_labelCount + 0.5);
    float sliceIndex = floor(normalizedAngle * count);

    // Calculate texture lookup index
    int globalIndex = v_pointIndex * u_maxLabels + int(sliceIndex);
    int texW = int(u_labelTextureSize.x);
    int tx = globalIndex % texW;
    int ty = globalIndex / texW;

    vec4 texColor = texelFetch(u_labelColors, ivec2(tx, ty), 0);

    // Linearize texture color
    finalColor = pow(max(texColor.rgb, vec3(0.0)), vec3(u_gamma));
  }

  // Apply a cheap "outline" effect by darkening near the edge of each shape.
  // (This is distinct from the SVG renderer's true stroke color/width.)
  //
  // NOTE: Users expect "non-circle" shapes to also have a border similar to circles.
  // We implement a simple per-shape edge-distance metric and darken near the edge.
  // This is not a true stroke color/width pipeline; it's an inexpensive outline effect.
  float strokeWidth = 0.15;
  float edgeDist = 1e6; // larger = far from edge

  if (v_shape < 0.5) { // Circle
    float dist = length(coord);
    edgeDist = 1.0 - dist;
  } else if (v_shape < 1.5) { // Square
    edgeDist = 1.0 - max(abs(coord.x), abs(coord.y));
  } else if (v_shape < 2.5) { // Diamond
    edgeDist = 1.0 - (abs(coord.x) * SQRT3 + abs(coord.y));
  } else if (v_shape < 3.5) { // Triangle Up
    // Inside region: abs(x)*SQRT3 <= 1 + y, clipped to point quad [-1,1]^2.
    // Triangle apex at (0, -1), slanted sides meet point sprite at (±1, sqrt(3)-1).
    // Perpendicular distance to slanted edge (normalized by edge length factor 2).
    float eSides = (1.0 + coord.y - abs(coord.x) * SQRT3) / 2.0;
    float eBottom = 1.0 - coord.y;  // distance to y = 1 (point sprite bottom)
    float eLR = 1.0 - abs(coord.x); // distance to x = ±1 (point sprite sides)
    edgeDist = min(eSides, min(eBottom, eLR));
  } else if (v_shape < 4.5) { // Triangle Down
    // Inside region: abs(x)*SQRT3 <= 1 - y, clipped to point quad [-1,1]^2.
    // Triangle apex at (0, 1), slanted sides meet point sprite at (±1, -(sqrt(3)-1)).
    // Perpendicular distance to slanted edge (normalized by edge length factor 2).
    float eSides = (1.0 - coord.y - abs(coord.x) * SQRT3) / 2.0;
    float eTop = 1.0 + coord.y;     // distance to y = -1 (point sprite top)
    float eLR = 1.0 - abs(coord.x); // distance to x = ±1 (point sprite sides)
    edgeDist = min(eSides, min(eTop, eLR));
  } else { // Plus
    float thickness = 0.35;
    bool inVertical = abs(coord.x) < thickness;
    bool inHorizontal = abs(coord.y) < thickness;
    // For each rectangle arm, edge distance is min distance to its 4 edges.
    float edgeV = 1e6;
    float edgeH = 1e6;
    if (inVertical) {
      edgeV = min(thickness - abs(coord.x), 1.0 - abs(coord.y));
    }
    if (inHorizontal) {
      edgeH = min(thickness - abs(coord.y), 1.0 - abs(coord.x));
    }
    edgeDist = min(edgeV, edgeH);
  }

  // Darken near the edge to mimic a border/outline.
  // Clamp to avoid NaNs if something goes slightly negative due to precision.
  if (max(edgeDist, 0.0) < strokeWidth) {
    finalColor = finalColor * 0.5;
  }

  float finalAlpha = v_color.a;
  fragColor = vec4(finalColor * finalAlpha, finalAlpha);
}`;
const GAMMA_VERTEX_SHADER = `#version 300 es
precision highp float;

in vec2 a_position;
out vec2 v_texCoord;

void main() {
  gl_Position = vec4(a_position, 0.0, 1.0);
  v_texCoord = (a_position + 1.0) * 0.5;
}`;

const GAMMA_FRAGMENT_SHADER = `#version 300 es
precision highp float;

uniform sampler2D u_linearTexture;
uniform float u_gamma;

in vec2 v_texCoord;
out vec4 fragColor;

void main() {
  vec4 linear = texture(u_linearTexture, v_texCoord);

  // Apply gamma correction to RGB, preserve alpha
  vec3 corrected = pow(max(linear.rgb, vec3(0.0)), vec3(1.0 / u_gamma));

  fragColor = vec4(corrected, linear.a);
}`;

// ============================================================================
// WebGL2 Renderer Implementation
// ============================================================================

export class WebGLRenderer {
  private gl: WebGL2RenderingContext | null = null;

  // Point rendering
  private pointProgram: WebGLProgram | null = null;
  private pointVao: WebGLVertexArrayObject | null = null;
  private pointAttribLocations: {
    dataPosition: number;
    size: number;
    color: number;
    depth: number;
    labelCount: number;
    shape: number;
  } | null = null;
  private pointUniformLocations: {
    resolution: WebGLUniformLocation | null;
    transform: WebGLUniformLocation | null;
    dpr: WebGLUniformLocation | null;
    gamma: WebGLUniformLocation | null;
    labelColors: WebGLUniformLocation | null;
    labelTextureSize: WebGLUniformLocation | null;
    maxLabels: WebGLUniformLocation | null;
  } | null = null;

  // Full-screen quad for gamma correction
  private quadBuffer: WebGLBuffer | null = null;

  // Gamma correction (final pass)
  private gammaCorrectionProgram: WebGLProgram | null = null;
  private gammaCorrectionUniformLocations: {
    linearTexture: WebGLUniformLocation | null;
    gamma: WebGLUniformLocation | null;
  } | null = null;

  // Linear RGB framebuffer for gamma-correct rendering
  private linearFramebuffer: FramebufferResources | null = null;
  private gamma = DEFAULT_GAMMA;

  // GPU Buffers
  private dataPositionBuffer: WebGLBuffer | null = null;
  private sizeBuffer: WebGLBuffer | null = null;
  private colorBuffer: WebGLBuffer | null = null;
  private depthBuffer: WebGLBuffer | null = null;
  private labelCountBuffer: WebGLBuffer | null = null;
  private shapeBuffer: WebGLBuffer | null = null;
  private labelColorTexture: WebGLTexture | null = null;

  // CPU arrays
  private dataPositions = new Float32Array(0);
  private sizes = new Float32Array(0);
  private colors = new Float32Array(0);
  private depths = new Float32Array(0);
  private labelCounts = new Float32Array(0);
  private shapes = new Float32Array(0);
  private labelColorData = new Uint8Array(0);

  // State
  private capacity = 0;

  private currentPointCount = 0;
  private positionsDirty = true;
  private stylesDirty = true;
  private buffersInitialized = false;

  // Store last rendered points for off-screen export rendering
  private lastRenderedPoints: PlotDataPoint[] | null = null;

  // Caching
  private lastDataSignature: string | null = null;
  private lastStyleSignature: string | null = null;

  private selectionActive = false;

  // Track rendered point IDs for hover detection
  private trackRenderedPointIds = false;
  private renderedPointIds = new Set<string>();

  // Config
  private dpr = window.devicePixelRatio || 1;
  private styleSignature: string | null = null;
  private gammaPipelineAvailable = true;
  private warnedGammaFallback = false;
  private contextLost = false;
  private readonly handleContextLost = (event: Event) => {
    event.preventDefault();
    this.markContextLost();
    this.onContextLost?.();
  };
  private readonly handleContextRestored = () => {
    this.contextLost = false;
    this.resetRendererState();
    if (this.lastRenderedPoints && this.lastRenderedPoints.length > 0) {
      requestAnimationFrame(() => {
        if (!this.contextLost) {
          this.render(this.lastRenderedPoints ?? []);
        }
      });
    }
  };

  constructor(
    private canvas: HTMLCanvasElement,
    private getScales: () => ScalePair | null,
    private getTransform: () => d3.ZoomTransform,
    private getConfig: () => ScatterplotConfig,
    private style: WebGLStyleGetters,
    private onContextLost?: () => void,
  ) {
    this.canvas.addEventListener('webglcontextlost', this.handleContextLost, { passive: false });
    this.canvas.addEventListener('webglcontextrestored', this.handleContextRestored);
  }

  destroy() {
    this.canvas.removeEventListener('webglcontextlost', this.handleContextLost);
    this.canvas.removeEventListener('webglcontextrestored', this.handleContextRestored);
  }

  // ============================================================================
  // Public API
  // ============================================================================

  /**
   * Set the gamma value for display.
   * Standard sRGB displays use gamma ~2.2.
   * @param gamma Gamma value (clamped between 1.0 and 3.0)
   */
  setGamma(gamma: number) {
    this.gamma = Math.max(1.0, Math.min(3.0, gamma));
  }

  /**
   * Get the current gamma value.
   * @returns Current gamma value
   */
  getGamma(): number {
    return this.gamma;
  }

  setStyleSignature(signature: string | null) {
    if (this.styleSignature !== signature) {
      this.styleSignature = signature;
      this.stylesDirty = true;
    }
  }

  setSelectionActive(active: boolean) {
    if (this.selectionActive !== active) {
      this.selectionActive = active;
    }
  }

  /**
   * @deprecated Selected annotation is now handled via style signature.
   * Kept for backward compatibility.
   */
  setSelectedAnnotation(_annotation: string) {
    // No-op: selected annotation is now part of style signature
  }

  invalidateStyleCache() {
    this.stylesDirty = true;
  }

  /**
   * Enable/disable tracking of the exact set of rendered point IDs.
   *
   * This exists to guard hover/click behavior when the renderer truncates the
   * number of points (e.g. datasets > MAX_POINTS_DIRECT_RENDER).
   *
   * For typical datasets (<= MAX_POINTS_DIRECT_RENDER), tracking is unnecessary
   * and expensive (it adds/clears ~N string IDs on every buffer rebuild), so it
   * should be kept disabled.
   */
  setTrackRenderedPointIds(enabled: boolean) {
    this.trackRenderedPointIds = enabled;
    if (!enabled) {
      this.renderedPointIds.clear();
    }
  }

  isPointRendered(pointId: string): boolean {
    if (!this.trackRenderedPointIds) return true;
    return this.renderedPointIds.has(pointId);
  }

  invalidatePositionCache() {
    this.positionsDirty = true;
  }

  resize(width: number, height: number) {
    if (this.isContextLost()) return;
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

      // Resize linear framebuffer
      if (this.gl && this.gammaPipelineAvailable) {
        const success = this.resizeLinearFramebuffer(physicalWidth, physicalHeight);
        if (!success) {
          this.handleGammaFallback('resize');
        }
      }
    }
  }

  private resizeLinearFramebuffer(width: number, height: number): boolean {
    if (!this.gl) return false;
    const gl = this.gl;

    // Reuse existing framebuffer if dimensions match
    if (this.linearFramebuffer) {
      if (this.linearFramebuffer.width === width && this.linearFramebuffer.height === height) {
        return true;
      }
      // Clean up old framebuffer
      gl.deleteFramebuffer(this.linearFramebuffer.framebuffer);
      gl.deleteTexture(this.linearFramebuffer.texture);
      gl.deleteRenderbuffer(this.linearFramebuffer.depthBuffer);
      this.linearFramebuffer = null;
    }

    const framebuffer = gl.createFramebuffer();
    const texture = gl.createTexture();
    const depthBuffer = gl.createRenderbuffer();

    if (!framebuffer || !texture || !depthBuffer) {
      return false;
    }

    gl.bindTexture(gl.TEXTURE_2D, texture);

    // Use RGBA16F for linear color space with good precision
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, width, height, 0, gl.RGBA, gl.HALF_FLOAT, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

    gl.bindRenderbuffer(gl.RENDERBUFFER, depthBuffer);
    gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT16, width, height);

    gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
    gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, depthBuffer);

    const status = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
    if (status !== gl.FRAMEBUFFER_COMPLETE) {
      console.error('Linear framebuffer not complete:', status);
      gl.deleteFramebuffer(framebuffer);
      gl.deleteTexture(texture);
      gl.deleteRenderbuffer(depthBuffer);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.bindTexture(gl.TEXTURE_2D, null);
      gl.bindRenderbuffer(gl.RENDERBUFFER, null);
      return false;
    }

    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.bindTexture(gl.TEXTURE_2D, null);
    gl.bindRenderbuffer(gl.RENDERBUFFER, null);

    this.linearFramebuffer = { framebuffer, texture, depthBuffer, width, height };
    return true;
  }

  private handleGammaFallback(reason?: string) {
    if (!this.gammaPipelineAvailable) return;

    this.gammaPipelineAvailable = false;

    if (!this.warnedGammaFallback) {
      const suffix = reason ? ` (${reason})` : '';
      console.warn(`WebGLRenderer: falling back to direct rendering${suffix}.`);
      this.warnedGammaFallback = true;
    }

    const gl = this.gl;
    if (!gl) {
      this.cleanupGammaResources();
      return;
    }

    if (this.gammaCorrectionProgram) {
      gl.deleteProgram(this.gammaCorrectionProgram);
      this.gammaCorrectionProgram = null;
    }

    if (this.linearFramebuffer) {
      gl.deleteFramebuffer(this.linearFramebuffer.framebuffer);
      gl.deleteTexture(this.linearFramebuffer.texture);
      gl.deleteRenderbuffer(this.linearFramebuffer.depthBuffer);
      this.linearFramebuffer = null;
    }

    this.gammaCorrectionUniformLocations = null;
  }

  private cleanupGammaResources() {
    this.gammaCorrectionProgram = null;
    this.gammaCorrectionUniformLocations = null;
    this.linearFramebuffer = null;
  }

  private shouldUseGammaPipeline(): boolean {
    return (
      this.gammaPipelineAvailable &&
      !!this.linearFramebuffer &&
      !!this.gammaCorrectionProgram &&
      !!this.gammaCorrectionUniformLocations
    );
  }

  private getEffectiveGamma(): number {
    return this.shouldUseGammaPipeline() ? this.gamma : 1.0;
  }

  clear() {
    const gl = this.ensureGL();
    if (!gl) return;
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    this.currentPointCount = 0;
  }

  render(points: PlotDataPoint[]) {
    // Store points for potential off-screen export rendering
    this.lastRenderedPoints = points;

    const gl = this.ensureGL();
    const scales = this.getScales();
    if (!gl || !scales || this.isContextLost()) return;

    const config = this.getConfig();
    const width = config.width ?? 800;
    const height = config.height ?? 600;
    this.resize(width, height);

    const transform = this.getTransform();

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

    // Render with gamma-correct pipeline
    this.renderWithGammaCorrection(transform);
  }

  /**
   * Render using gamma-correct pipeline:
   * 1. Render points to linear RGB framebuffer
   * 2. Apply gamma correction pass to convert to sRGB for display
   * Falls back to direct rendering if pipeline is unavailable.
   */
  private renderWithGammaCorrection(transform: d3.ZoomTransform) {
    if (!this.gl) return;

    if (!this.shouldUseGammaPipeline()) {
      if (this.gammaPipelineAvailable) {
        this.handleGammaFallback('gamma pipeline unavailable during render');
      }
      this.renderDirect(transform);
      return;
    }

    const framebuffer = this.linearFramebuffer;
    if (!framebuffer) {
      this.renderDirect(transform);
      return;
    }

    const gl = this.gl;

    // Pass 1: Render to linear RGB framebuffer
    gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer.framebuffer);
    const status = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
    if (status !== gl.FRAMEBUFFER_COMPLETE) {
      this.handleGammaFallback('framebuffer incomplete during render');
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      this.renderDirect(transform);
      return;
    }
    gl.viewport(0, 0, framebuffer.width, framebuffer.height);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    if (this.selectionActive) {
      gl.disable(gl.BLEND);
    } else {
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    }
    this.renderPoints(transform);

    // Pass 2: Gamma correction to canvas
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    this.renderGammaCorrection();
  }

  private renderGammaCorrection() {
    if (
      !this.gl ||
      !this.gammaCorrectionProgram ||
      !this.linearFramebuffer ||
      !this.gammaCorrectionUniformLocations
    ) {
      return;
    }

    const gl = this.gl;
    gl.disable(gl.BLEND);
    gl.useProgram(this.gammaCorrectionProgram);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.linearFramebuffer.texture);
    gl.uniform1i(this.gammaCorrectionUniformLocations.linearTexture, 0);
    gl.uniform1f(this.gammaCorrectionUniformLocations.gamma, this.gamma);

    // Draw full-screen quad
    gl.bindBuffer(gl.ARRAY_BUFFER, this.quadBuffer);
    const posLoc = gl.getAttribLocation(this.gammaCorrectionProgram, 'a_position');
    gl.enableVertexAttribArray(posLoc);
    gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);

    gl.drawArrays(gl.TRIANGLES, 0, 6);

    gl.disableVertexAttribArray(posLoc);
    gl.bindTexture(gl.TEXTURE_2D, null);
  }

  private renderDirect(transform: d3.ZoomTransform) {
    if (!this.gl) return;
    const gl = this.gl;

    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    if (this.selectionActive) {
      gl.disable(gl.BLEND);
    } else {
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    }

    this.renderPoints(transform);
  }

  dispose() {
    if (!this.gl) return;
    const gl = this.gl;

    if (this.pointVao) gl.deleteVertexArray(this.pointVao);
    if (this.dataPositionBuffer) gl.deleteBuffer(this.dataPositionBuffer);
    if (this.sizeBuffer) gl.deleteBuffer(this.sizeBuffer);
    if (this.colorBuffer) gl.deleteBuffer(this.colorBuffer);
    if (this.depthBuffer) gl.deleteBuffer(this.depthBuffer);
    if (this.labelCountBuffer) gl.deleteBuffer(this.labelCountBuffer);
    if (this.shapeBuffer) gl.deleteBuffer(this.shapeBuffer);
    if (this.quadBuffer) gl.deleteBuffer(this.quadBuffer);
    if (this.labelColorTexture) gl.deleteTexture(this.labelColorTexture);
    if (this.pointProgram) gl.deleteProgram(this.pointProgram);
    if (this.gammaCorrectionProgram) gl.deleteProgram(this.gammaCorrectionProgram);

    if (this.linearFramebuffer) {
      gl.deleteFramebuffer(this.linearFramebuffer.framebuffer);
      gl.deleteTexture(this.linearFramebuffer.texture);
      gl.deleteRenderbuffer(this.linearFramebuffer.depthBuffer);
      this.linearFramebuffer = null;
    }

    this.gl = null;
  }

  // ============================================================================
  // Off-Screen Export Rendering
  // ============================================================================

  /**
   * Render visualization at arbitrary dimensions to a new off-screen canvas.
   * Creates a temporary WebGL context, renders at requested size, returns 2D canvas.
   *
   * @param width Target width in CSS pixels (will be multiplied by DPR)
   * @param height Target height in CSS pixels
   * @param dpr Device pixel ratio to use (defaults to 1 for max resolution control)
   * @returns 2D canvas containing the rendered frame
   */
  public renderToCanvas(width: number, height: number, dpr: number = 1): HTMLCanvasElement {
    // Validate dimensions
    const physicalWidth = Math.floor(width * dpr);
    const physicalHeight = Math.floor(height * dpr);

    const MAX_DIMENSION = 8192;
    const MAX_AREA = 268435456; // ~268M pixels

    if (physicalWidth > MAX_DIMENSION || physicalHeight > MAX_DIMENSION) {
      throw new Error(
        `Export dimensions ${physicalWidth}×${physicalHeight} exceed browser limit of ${MAX_DIMENSION}px`,
      );
    }
    if (physicalWidth * physicalHeight > MAX_AREA) {
      throw new Error(
        `Export area ${(physicalWidth * physicalHeight).toLocaleString()} exceeds limit of ${MAX_AREA.toLocaleString()} pixels`,
      );
    }

    // Ensure we have points to render
    const points = this.lastRenderedPoints;
    if (!points || points.length === 0) {
      throw new Error('No points available to render. Call render() first.');
    }

    // Create scales for export dimensions
    const exportScales = this.createExportScales(points, physicalWidth, physicalHeight);
    if (!exportScales) {
      throw new Error('Could not create scales for export rendering');
    }

    // Create off-screen WebGL canvas
    const offscreenCanvas = document.createElement('canvas');
    offscreenCanvas.width = physicalWidth;
    offscreenCanvas.height = physicalHeight;

    // Get WebGL2 context with same options as main canvas
    const gl = offscreenCanvas.getContext('webgl2', {
      antialias: true,
      preserveDrawingBuffer: true,
      premultipliedAlpha: false,
      alpha: true,
      powerPreference: 'high-performance',
    });

    if (!gl) {
      throw new Error('Failed to create WebGL2 context for export');
    }

    try {
      // Initialize WebGL state for the off-screen context
      this.initializeOffscreenContext(gl, physicalWidth, physicalHeight, points, exportScales, dpr);

      // Copy WebGL canvas to 2D canvas for safe export
      const outputCanvas = document.createElement('canvas');
      outputCanvas.width = physicalWidth;
      outputCanvas.height = physicalHeight;

      const ctx = outputCanvas.getContext('2d');
      if (!ctx) {
        throw new Error('Failed to create 2D context for export');
      }

      ctx.drawImage(offscreenCanvas, 0, 0);

      return outputCanvas;
    } finally {
      // Clean up off-screen context
      const loseContext = gl.getExtension('WEBGL_lose_context');
      if (loseContext) {
        loseContext.loseContext();
      }
    }
  }

  /**
   * Create scales appropriate for export dimensions.
   * Scales the margin proportionally to maintain visual consistency.
   */
  private createExportScales(
    points: PlotDataPoint[],
    exportWidth: number,
    exportHeight: number,
  ): ScalePair | null {
    if (points.length === 0) return null;

    const config = this.getConfig();
    const displayWidth = config.width ?? 800;
    const displayHeight = config.height ?? 600;

    // Default margin if not specified
    const margin = config.margin ?? { top: 20, right: 20, bottom: 20, left: 20 };

    // Scale margins proportionally to export size
    const scaleX = exportWidth / displayWidth;
    const scaleY = exportHeight / displayHeight;

    const scaledMargin = {
      top: margin.top * scaleY,
      right: margin.right * scaleX,
      bottom: margin.bottom * scaleY,
      left: margin.left * scaleX,
    };

    // Compute data extent
    let xMin = Infinity,
      xMax = -Infinity,
      yMin = Infinity,
      yMax = -Infinity;
    for (const p of points) {
      if (p.x < xMin) xMin = p.x;
      if (p.x > xMax) xMax = p.x;
      if (p.y < yMin) yMin = p.y;
      if (p.y > yMax) yMax = p.y;
    }

    // Add padding (same as ScaleManager.createScales uses 5% padding)
    const padding = 0.05;
    const xPadding = Math.abs(xMax - xMin) * padding;
    const yPadding = Math.abs(yMax - yMin) * padding;

    // Create d3 scales for export dimensions
    const xScale = d3
      .scaleLinear()
      .domain([xMin - xPadding, xMax + xPadding])
      .range([scaledMargin.left, exportWidth - scaledMargin.right]);

    const yScale = d3
      .scaleLinear()
      .domain([yMin - yPadding, yMax + yPadding])
      .range([exportHeight - scaledMargin.bottom, scaledMargin.top]);

    return { x: xScale, y: yScale };
  }

  /**
   * Initialize and render to an off-screen WebGL context
   */
  private initializeOffscreenContext(
    gl: WebGL2RenderingContext,
    width: number,
    height: number,
    points: PlotDataPoint[],
    scales: ScalePair,
    dpr: number,
  ): void {
    // Calculate size scale factor based on export vs display dimensions
    const config = this.getConfig();
    const displayWidth = config.width ?? 800;
    const displayHeight = config.height ?? 600;
    const sizeScaleFactor = Math.sqrt((width * height) / (displayWidth * displayHeight));
    // Enable extensions for float textures (needed for gamma pipeline)
    const colorBufferFloatExt = gl.getExtension('EXT_color_buffer_float');
    const floatBlendExt = gl.getExtension('EXT_float_blend');
    gl.getExtension('OES_texture_float_linear');

    const useGammaPipeline = !!colorBufferFloatExt && !!floatBlendExt;

    // Create shader programs
    const pointProgram = createProgramFromSources(gl, POINT_VERTEX_SHADER, POINT_FRAGMENT_SHADER);
    if (!pointProgram) {
      throw new Error('Failed to create point shader program for export');
    }

    let gammaCorrectionProgram: WebGLProgram | null = null;
    if (useGammaPipeline) {
      gammaCorrectionProgram = createProgramFromSources(
        gl,
        GAMMA_VERTEX_SHADER,
        GAMMA_FRAGMENT_SHADER,
      );
    }

    // Get attribute and uniform locations
    const attribs = {
      dataPosition: gl.getAttribLocation(pointProgram, 'a_dataPosition'),
      size: gl.getAttribLocation(pointProgram, 'a_pointSize'),
      color: gl.getAttribLocation(pointProgram, 'a_color'),
      depth: gl.getAttribLocation(pointProgram, 'a_depth'),
      labelCount: gl.getAttribLocation(pointProgram, 'a_labelCount'),
      shape: gl.getAttribLocation(pointProgram, 'a_shape'),
    };

    const uniforms = {
      resolution: gl.getUniformLocation(pointProgram, 'u_resolution'),
      transform: gl.getUniformLocation(pointProgram, 'u_transform'),
      dpr: gl.getUniformLocation(pointProgram, 'u_dpr'),
      gamma: gl.getUniformLocation(pointProgram, 'u_gamma'),
      labelColors: gl.getUniformLocation(pointProgram, 'u_labelColors'),
      labelTextureSize: gl.getUniformLocation(pointProgram, 'u_labelTextureSize'),
      maxLabels: gl.getUniformLocation(pointProgram, 'u_maxLabels'),
    };

    // Prepare point data using existing CPU arrays (reuse from main renderer)
    const maxPoints = Math.min(points.length, MAX_POINTS_DIRECT_RENDER);

    // Populate buffers for off-screen rendering
    const {
      dataPositions,
      sizes,
      colors,
      depths,
      labelCounts,
      shapes,
      labelColorData,
      pointCount,
    } = this.prepareOffscreenBufferData(points, scales, maxPoints, dpr, sizeScaleFactor);

    // Create and upload buffers
    const dataPositionBuffer = gl.createBuffer();
    const sizeBuffer = gl.createBuffer();
    const colorBuffer = gl.createBuffer();
    const depthBuffer = gl.createBuffer();
    const labelCountBuffer = gl.createBuffer();
    const shapeBuffer = gl.createBuffer();
    const labelColorTexture = gl.createTexture();

    gl.bindBuffer(gl.ARRAY_BUFFER, dataPositionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, dataPositions.subarray(0, pointCount * 2), gl.STATIC_DRAW);

    gl.bindBuffer(gl.ARRAY_BUFFER, sizeBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, sizes.subarray(0, pointCount), gl.STATIC_DRAW);

    gl.bindBuffer(gl.ARRAY_BUFFER, colorBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, colors.subarray(0, pointCount * 4), gl.STATIC_DRAW);

    gl.bindBuffer(gl.ARRAY_BUFFER, depthBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, depths.subarray(0, pointCount), gl.STATIC_DRAW);

    gl.bindBuffer(gl.ARRAY_BUFFER, labelCountBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, labelCounts.subarray(0, pointCount), gl.STATIC_DRAW);

    gl.bindBuffer(gl.ARRAY_BUFFER, shapeBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, shapes.subarray(0, pointCount), gl.STATIC_DRAW);

    // Setup label color texture
    gl.bindTexture(gl.TEXTURE_2D, labelColorTexture);
    const texHeight = labelColorData.length / 4 / LABEL_TEXTURE_WIDTH;
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RGBA8,
      LABEL_TEXTURE_WIDTH,
      texHeight,
      0,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      labelColorData,
    );
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);

    // Create VAO
    const pointVao = gl.createVertexArray();
    gl.bindVertexArray(pointVao);

    gl.bindBuffer(gl.ARRAY_BUFFER, dataPositionBuffer);
    gl.enableVertexAttribArray(attribs.dataPosition);
    gl.vertexAttribPointer(attribs.dataPosition, 2, gl.FLOAT, false, 0, 0);

    gl.bindBuffer(gl.ARRAY_BUFFER, sizeBuffer);
    gl.enableVertexAttribArray(attribs.size);
    gl.vertexAttribPointer(attribs.size, 1, gl.FLOAT, false, 0, 0);

    gl.bindBuffer(gl.ARRAY_BUFFER, colorBuffer);
    gl.enableVertexAttribArray(attribs.color);
    gl.vertexAttribPointer(attribs.color, 4, gl.FLOAT, false, 0, 0);

    gl.bindBuffer(gl.ARRAY_BUFFER, depthBuffer);
    gl.enableVertexAttribArray(attribs.depth);
    gl.vertexAttribPointer(attribs.depth, 1, gl.FLOAT, false, 0, 0);

    gl.bindBuffer(gl.ARRAY_BUFFER, labelCountBuffer);
    gl.enableVertexAttribArray(attribs.labelCount);
    gl.vertexAttribPointer(attribs.labelCount, 1, gl.FLOAT, false, 0, 0);

    gl.bindBuffer(gl.ARRAY_BUFFER, shapeBuffer);
    gl.enableVertexAttribArray(attribs.shape);
    gl.vertexAttribPointer(attribs.shape, 1, gl.FLOAT, false, 0, 0);

    gl.bindVertexArray(null);

    // Get current transform and scale it for export dimensions
    const displayTransform = this.getTransform();
    // Scale transform's translation to export dimensions
    const scaleFactorX = width / displayWidth;
    const scaleFactorY = height / displayHeight;
    // Create a scaled transform that preserves the current view at export resolution
    const exportTransform = {
      x: displayTransform.x * scaleFactorX,
      y: displayTransform.y * scaleFactorY,
      k: displayTransform.k, // Zoom level stays the same
    } as d3.ZoomTransform;
    const gamma = useGammaPipeline ? this.gamma : 1.0;

    // Setup linear framebuffer if using gamma pipeline
    let linearFramebuffer: FramebufferResources | null = null;
    if (useGammaPipeline && gammaCorrectionProgram) {
      linearFramebuffer = this.createOffscreenLinearFramebuffer(gl, width, height);
    }

    // Render
    if (linearFramebuffer && gammaCorrectionProgram) {
      // Gamma-correct pipeline
      gl.bindFramebuffer(gl.FRAMEBUFFER, linearFramebuffer.framebuffer);
      gl.viewport(0, 0, width, height);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

      gl.enable(gl.BLEND);
      gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
      gl.disable(gl.DEPTH_TEST);
      gl.depthMask(false);

      this.renderOffscreenPoints(
        gl,
        pointProgram,
        pointVao,
        uniforms,
        width,
        height,
        dpr,
        gamma,
        exportTransform,
        labelColorTexture,
        labelColorData.length,
        pointCount,
      );

      // Apply gamma correction
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.viewport(0, 0, width, height);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      gl.disable(gl.BLEND);

      this.renderOffscreenGammaCorrection(gl, gammaCorrectionProgram, linearFramebuffer, gamma);
    } else {
      // Direct rendering
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.viewport(0, 0, width, height);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

      gl.enable(gl.BLEND);
      gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
      gl.disable(gl.DEPTH_TEST);
      gl.depthMask(false);

      this.renderOffscreenPoints(
        gl,
        pointProgram,
        pointVao,
        uniforms,
        width,
        height,
        dpr,
        gamma,
        exportTransform,
        labelColorTexture,
        labelColorData.length,
        pointCount,
      );
    }

    // Cleanup
    gl.deleteVertexArray(pointVao);
    gl.deleteBuffer(dataPositionBuffer);
    gl.deleteBuffer(sizeBuffer);
    gl.deleteBuffer(colorBuffer);
    gl.deleteBuffer(depthBuffer);
    gl.deleteBuffer(labelCountBuffer);
    gl.deleteBuffer(shapeBuffer);
    gl.deleteTexture(labelColorTexture);
    gl.deleteProgram(pointProgram);
    if (gammaCorrectionProgram) gl.deleteProgram(gammaCorrectionProgram);
    if (linearFramebuffer) {
      gl.deleteFramebuffer(linearFramebuffer.framebuffer);
      gl.deleteTexture(linearFramebuffer.texture);
      gl.deleteRenderbuffer(linearFramebuffer.depthBuffer);
    }
  }

  /**
   * Prepare buffer data for off-screen rendering
   */
  private prepareOffscreenBufferData(
    points: PlotDataPoint[],
    scales: ScalePair,
    maxPoints: number,
    dpr: number,
    sizeScaleFactor: number = 1,
  ): {
    dataPositions: Float32Array;
    sizes: Float32Array;
    colors: Float32Array;
    depths: Float32Array;
    labelCounts: Float32Array;
    shapes: Float32Array;
    labelColorData: Uint8Array;
    pointCount: number;
  } {
    const capacity = Math.max(MIN_CAPACITY, maxPoints);
    const dataPositions = new Float32Array(capacity * 2);
    const sizes = new Float32Array(capacity);
    const colors = new Float32Array(capacity * 4);
    const depths = new Float32Array(capacity);
    const labelCounts = new Float32Array(capacity);
    const shapes = new Float32Array(capacity);
    const requiredPixels = capacity * MAX_LABELS;
    const texHeight = Math.ceil(requiredPixels / LABEL_TEXTURE_WIDTH);
    const labelColorData = new Uint8Array(LABEL_TEXTURE_WIDTH * texHeight * 4);

    // Stage and sort points by depth (painter's algorithm)
    const staged: Array<{ point: PlotDataPoint; opacity: number; depth: number }> = [];
    for (let i = 0; i < points.length && staged.length < maxPoints; i++) {
      const point = points[i];
      const opacity = this.style.getOpacity(point);
      if (opacity === 0) continue;
      const depth = this.style.getDepth(point);
      staged.push({ point, opacity, depth });
    }
    staged.sort((a, b) => b.depth - a.depth);

    let idx = 0;
    for (let s = 0; s < staged.length; s++) {
      const { point, opacity, depth } = staged[s];

      dataPositions[idx * 2] = scales.x(point.x);
      dataPositions[idx * 2 + 1] = scales.y(point.y);

      const pointColors = this.style.getColors(point);
      const [r, g, b] = resolveColor(pointColors[0] ?? '#888888');
      const size = Math.sqrt(this.style.getPointSize(point)) / POINT_SIZE_DIVISOR;
      const shapeType = this.style.getShape(point);
      const shapeIndex = getShapeIndex(shapeType);

      colors[idx * 4] = r;
      colors[idx * 4 + 1] = g;
      colors[idx * 4 + 2] = b;
      colors[idx * 4 + 3] = Math.min(1, Math.max(0, opacity));
      // Scale point sizes proportionally to export dimensions
      const basePointSize = Math.max(MIN_POINT_SIZE, size * 2 * dpr * sizeScaleFactor);
      sizes[idx] = shapeIndex === 2 ? basePointSize * DIAMOND_SIZE_SCALE : basePointSize;
      depths[idx] = depth;
      labelCounts[idx] = pointColors.length;
      shapes[idx] = shapeIndex;

      // Fill label color texture data
      for (let j = 0; j < MAX_LABELS; j++) {
        if (j < pointColors.length) {
          const [lr, lg, lb] = resolveColor(pointColors[j]);
          const texIndex = (idx * MAX_LABELS + j) * 4;
          if (texIndex < labelColorData.length) {
            labelColorData[texIndex] = Math.round(lr * 255);
            labelColorData[texIndex + 1] = Math.round(lg * 255);
            labelColorData[texIndex + 2] = Math.round(lb * 255);
            labelColorData[texIndex + 3] = 255;
          }
        }
      }

      idx++;
    }

    return {
      dataPositions,
      sizes,
      colors,
      depths,
      labelCounts,
      shapes,
      labelColorData,
      pointCount: idx,
    };
  }

  /**
   * Create linear framebuffer for off-screen gamma-correct rendering
   */
  private createOffscreenLinearFramebuffer(
    gl: WebGL2RenderingContext,
    width: number,
    height: number,
  ): FramebufferResources | null {
    const framebuffer = gl.createFramebuffer();
    const texture = gl.createTexture();
    const depthBuffer = gl.createRenderbuffer();

    if (!framebuffer || !texture || !depthBuffer) {
      return null;
    }

    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, width, height, 0, gl.RGBA, gl.HALF_FLOAT, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

    gl.bindRenderbuffer(gl.RENDERBUFFER, depthBuffer);
    gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT16, width, height);

    gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
    gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, depthBuffer);

    const status = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
    if (status !== gl.FRAMEBUFFER_COMPLETE) {
      gl.deleteFramebuffer(framebuffer);
      gl.deleteTexture(texture);
      gl.deleteRenderbuffer(depthBuffer);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      return null;
    }

    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.bindTexture(gl.TEXTURE_2D, null);
    gl.bindRenderbuffer(gl.RENDERBUFFER, null);

    return { framebuffer, texture, depthBuffer, width, height };
  }

  /**
   * Render points in off-screen context
   */
  private renderOffscreenPoints(
    gl: WebGL2RenderingContext,
    program: WebGLProgram,
    vao: WebGLVertexArrayObject,
    uniforms: {
      resolution: WebGLUniformLocation | null;
      transform: WebGLUniformLocation | null;
      dpr: WebGLUniformLocation | null;
      gamma: WebGLUniformLocation | null;
      labelColors: WebGLUniformLocation | null;
      labelTextureSize: WebGLUniformLocation | null;
      maxLabels: WebGLUniformLocation | null;
    },
    width: number,
    height: number,
    dpr: number,
    gamma: number,
    transform: d3.ZoomTransform,
    labelColorTexture: WebGLTexture | null,
    labelColorDataLength: number,
    pointCount: number,
  ): void {
    gl.useProgram(program);

    gl.uniform2f(uniforms.resolution, width, height);
    gl.uniform3f(uniforms.transform, transform.x, transform.y, transform.k);
    gl.uniform1f(uniforms.dpr, dpr);
    gl.uniform1f(uniforms.gamma, gamma);
    gl.uniform1i(uniforms.maxLabels, MAX_LABELS);
    gl.uniform2f(
      uniforms.labelTextureSize,
      LABEL_TEXTURE_WIDTH,
      labelColorDataLength / 4 / LABEL_TEXTURE_WIDTH,
    );

    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, labelColorTexture);
    gl.uniform1i(uniforms.labelColors, 1);

    gl.bindVertexArray(vao);
    gl.drawArrays(gl.POINTS, 0, pointCount);
    gl.bindVertexArray(null);
  }

  /**
   * Apply gamma correction in off-screen context
   */
  private renderOffscreenGammaCorrection(
    gl: WebGL2RenderingContext,
    program: WebGLProgram,
    framebuffer: FramebufferResources,
    gamma: number,
  ): void {
    gl.useProgram(program);

    const linearTextureLocation = gl.getUniformLocation(program, 'u_linearTexture');
    const gammaLocation = gl.getUniformLocation(program, 'u_gamma');

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, framebuffer.texture);
    gl.uniform1i(linearTextureLocation, 0);
    gl.uniform1f(gammaLocation, gamma);

    // Create and draw full-screen quad
    const quadBuffer = gl.createBuffer();
    const quadVertices = new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]);

    gl.bindBuffer(gl.ARRAY_BUFFER, quadBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, quadVertices, gl.STATIC_DRAW);

    const posLoc = gl.getAttribLocation(program, 'a_position');
    gl.enableVertexAttribArray(posLoc);
    gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);

    gl.drawArrays(gl.TRIANGLES, 0, 6);

    gl.disableVertexAttribArray(posLoc);
    gl.deleteBuffer(quadBuffer);
  }

  // ============================================================================
  // WebGL Setup
  // ============================================================================

  private ensureGL(): WebGL2RenderingContext | null {
    if (this.contextLost) return null;
    if (this.gl) {
      if (this.gl.isContextLost && this.gl.isContextLost()) {
        this.markContextLost();
        return null;
      }
      if (!this.isRendererStateValid(this.gl)) {
        this.resetRendererState();
      }
    }
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

    const gl = this.canvas.getContext('webgl2', contextOptions);
    if (!gl) {
      console.error('WebGL2 not available');
      return null;
    }

    this.gl = gl;

    // Enable extensions for float textures
    const colorBufferFloatExt = gl.getExtension('EXT_color_buffer_float');
    const floatBlendExt = gl.getExtension('EXT_float_blend');
    gl.getExtension('OES_texture_float_linear');

    this.gammaPipelineAvailable = !!colorBufferFloatExt && !!floatBlendExt;
    if (!this.gammaPipelineAvailable) {
      this.handleGammaFallback('required extensions missing');
    }

    if (!this.initializePointShaders(gl)) return null;

    if (this.gammaPipelineAvailable) {
      if (!this.initializeGammaCorrectionShaders(gl)) {
        this.handleGammaFallback('gamma shader init failed');
      }
    }

    this.dataPositionBuffer = gl.createBuffer();
    this.sizeBuffer = gl.createBuffer();
    this.colorBuffer = gl.createBuffer();
    this.depthBuffer = gl.createBuffer();
    this.labelCountBuffer = gl.createBuffer();
    this.shapeBuffer = gl.createBuffer();
    this.quadBuffer = gl.createBuffer();
    this.labelColorTexture = gl.createTexture();

    this.createPointVAO();

    this.setupQuad();

    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

    // We want overlapping points to remain visible, so we do NOT use the depth buffer to cull.
    // Z-order is preserved via painter's algorithm (CPU sorting) in populateBuffers().
    gl.disable(gl.DEPTH_TEST);
    gl.depthMask(false);

    if (
      this.gammaPipelineAvailable &&
      !this.resizeLinearFramebuffer(this.canvas.width, this.canvas.height)
    ) {
      this.handleGammaFallback('framebuffer incomplete');
    }

    return gl;
  }

  private isRendererStateValid(gl: WebGL2RenderingContext): boolean {
    if (!this.pointProgram || !gl.isProgram(this.pointProgram)) return false;
    if (this.pointVao && !gl.isVertexArray(this.pointVao)) return false;
    if (this.dataPositionBuffer && !gl.isBuffer(this.dataPositionBuffer)) return false;
    if (this.sizeBuffer && !gl.isBuffer(this.sizeBuffer)) return false;
    if (this.colorBuffer && !gl.isBuffer(this.colorBuffer)) return false;
    if (this.depthBuffer && !gl.isBuffer(this.depthBuffer)) return false;
    if (this.labelCountBuffer && !gl.isBuffer(this.labelCountBuffer)) return false;
    if (this.shapeBuffer && !gl.isBuffer(this.shapeBuffer)) return false;
    if (this.labelColorTexture && !gl.isTexture(this.labelColorTexture)) return false;
    return true;
  }

  private isContextLost(): boolean {
    if (this.contextLost) return true;
    const gl = this.gl;
    if (gl?.isContextLost && gl.isContextLost()) {
      this.markContextLost();
      return true;
    }
    return false;
  }

  private markContextLost() {
    if (this.contextLost) return;
    this.contextLost = true;
    this.resetRendererState();
  }

  private resetRendererState() {
    this.gl = null;
    this.pointProgram = null;
    this.pointVao = null;
    this.pointAttribLocations = null;
    this.pointUniformLocations = null;
    this.quadBuffer = null;
    this.gammaCorrectionProgram = null;
    this.gammaCorrectionUniformLocations = null;
    this.linearFramebuffer = null;
    this.dataPositionBuffer = null;
    this.sizeBuffer = null;
    this.colorBuffer = null;
    this.depthBuffer = null;
    this.labelCountBuffer = null;
    this.shapeBuffer = null;
    this.labelColorTexture = null;
    this.gammaPipelineAvailable = true;
    this.warnedGammaFallback = false;
    this.buffersInitialized = false;
    this.currentPointCount = 0;
    this.positionsDirty = true;
    this.stylesDirty = true;
    this.lastDataSignature = null;
    this.lastStyleSignature = null;
    this.renderedPointIds.clear();
  }

  private initializePointShaders(gl: WebGL2RenderingContext): boolean {
    this.pointProgram = createProgramFromSources(gl, POINT_VERTEX_SHADER, POINT_FRAGMENT_SHADER);
    if (!this.pointProgram) return false;

    this.pointAttribLocations = {
      dataPosition: gl.getAttribLocation(this.pointProgram, 'a_dataPosition'),
      size: gl.getAttribLocation(this.pointProgram, 'a_pointSize'),
      color: gl.getAttribLocation(this.pointProgram, 'a_color'),
      depth: gl.getAttribLocation(this.pointProgram, 'a_depth'),
      labelCount: gl.getAttribLocation(this.pointProgram, 'a_labelCount'),
      shape: gl.getAttribLocation(this.pointProgram, 'a_shape'),
    };

    this.pointUniformLocations = {
      resolution: gl.getUniformLocation(this.pointProgram, 'u_resolution'),
      transform: gl.getUniformLocation(this.pointProgram, 'u_transform'),
      dpr: gl.getUniformLocation(this.pointProgram, 'u_dpr'),
      gamma: gl.getUniformLocation(this.pointProgram, 'u_gamma'),
      labelColors: gl.getUniformLocation(this.pointProgram, 'u_labelColors'),
      labelTextureSize: gl.getUniformLocation(this.pointProgram, 'u_labelTextureSize'),
      maxLabels: gl.getUniformLocation(this.pointProgram, 'u_maxLabels'),
    };

    return true;
  }

  private initializeGammaCorrectionShaders(gl: WebGL2RenderingContext): boolean {
    this.gammaCorrectionProgram = createProgramFromSources(
      gl,
      GAMMA_VERTEX_SHADER,
      GAMMA_FRAGMENT_SHADER,
    );
    if (!this.gammaCorrectionProgram) return false;

    this.gammaCorrectionUniformLocations = {
      linearTexture: gl.getUniformLocation(this.gammaCorrectionProgram, 'u_linearTexture'),
      gamma: gl.getUniformLocation(this.gammaCorrectionProgram, 'u_gamma'),
    };

    return true;
  }

  // ============================================================================
  // VAO Setup
  // ============================================================================

  private createPointVAO() {
    const gl = this.gl;
    if (!gl || !this.pointAttribLocations) return;

    this.pointVao = gl.createVertexArray();
    gl.bindVertexArray(this.pointVao);

    gl.bindBuffer(gl.ARRAY_BUFFER, this.dataPositionBuffer);
    gl.enableVertexAttribArray(this.pointAttribLocations.dataPosition);
    gl.vertexAttribPointer(this.pointAttribLocations.dataPosition, 2, gl.FLOAT, false, 0, 0);

    gl.bindBuffer(gl.ARRAY_BUFFER, this.sizeBuffer);
    gl.enableVertexAttribArray(this.pointAttribLocations.size);
    gl.vertexAttribPointer(this.pointAttribLocations.size, 1, gl.FLOAT, false, 0, 0);

    gl.bindBuffer(gl.ARRAY_BUFFER, this.colorBuffer);
    gl.enableVertexAttribArray(this.pointAttribLocations.color);
    gl.vertexAttribPointer(this.pointAttribLocations.color, 4, gl.FLOAT, false, 0, 0);

    gl.bindBuffer(gl.ARRAY_BUFFER, this.depthBuffer);
    gl.enableVertexAttribArray(this.pointAttribLocations.depth);
    gl.vertexAttribPointer(this.pointAttribLocations.depth, 1, gl.FLOAT, false, 0, 0);

    gl.bindBuffer(gl.ARRAY_BUFFER, this.labelCountBuffer);
    gl.enableVertexAttribArray(this.pointAttribLocations.labelCount);
    gl.vertexAttribPointer(this.pointAttribLocations.labelCount, 1, gl.FLOAT, false, 0, 0);

    gl.bindBuffer(gl.ARRAY_BUFFER, this.shapeBuffer);
    gl.enableVertexAttribArray(this.pointAttribLocations.shape);
    gl.vertexAttribPointer(this.pointAttribLocations.shape, 1, gl.FLOAT, false, 0, 0);

    gl.bindVertexArray(null);
  }

  private setupQuad() {
    const gl = this.gl;
    if (!gl || !this.quadBuffer) return;

    const quadVertices = new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]);

    gl.bindBuffer(gl.ARRAY_BUFFER, this.quadBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, quadVertices, gl.STATIC_DRAW);
  }

  // ============================================================================
  // Rendering
  // ============================================================================

  private renderPoints(transform: d3.ZoomTransform) {
    if (
      !this.gl ||
      this.currentPointCount === 0 ||
      !this.pointProgram ||
      !this.pointUniformLocations
    ) {
      return;
    }

    const gl = this.gl;
    gl.useProgram(this.pointProgram);

    const gamma = this.getEffectiveGamma();
    gl.uniform2f(this.pointUniformLocations.resolution, this.canvas.width, this.canvas.height);
    gl.uniform3f(this.pointUniformLocations.transform, transform.x, transform.y, transform.k);
    gl.uniform1f(this.pointUniformLocations.dpr, this.dpr);
    gl.uniform1f(this.pointUniformLocations.gamma, gamma);
    gl.uniform1i(this.pointUniformLocations.maxLabels, MAX_LABELS);
    gl.uniform2f(
      this.pointUniformLocations.labelTextureSize,
      LABEL_TEXTURE_WIDTH,
      this.labelColorData.length / 4 / LABEL_TEXTURE_WIDTH,
    );

    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, this.labelColorTexture);
    gl.uniform1i(this.pointUniformLocations.labelColors, 1);

    gl.bindVertexArray(this.pointVao);
    gl.drawArrays(gl.POINTS, 0, this.currentPointCount);
    gl.bindVertexArray(null);
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
    const parts = indices
      .filter((i) => i < len)
      .map((i) => {
        const p = points[i];
        // Include depth to avoid missing z-order-only updates when we render via painter's algorithm.
        return `${p.id}:${this.style.getOpacity(p).toFixed(2)}:${this.style
          .getDepth(p)
          .toFixed(4)}:${this.style.getColors(p)[0]}`;
      });

    return `${this.styleSignature}|${parts.join('|')}`;
  }

  private populateBuffers(
    points: PlotDataPoint[],
    scales: ScalePair,
    updatePositions: boolean,
    updateStyles: boolean,
  ) {
    if (!this.gl) return;
    const gl = this.gl;

    const maxPoints = Math.min(points.length, MAX_POINTS_DIRECT_RENDER);

    if (maxPoints > this.capacity) {
      this.expandCapacity(maxPoints);
      updatePositions = true;
      updateStyles = true;
    }

    if (this.trackRenderedPointIds) {
      this.renderedPointIds.clear();
    }

    // With depth testing disabled (to ensure overlaps are drawn), we preserve z-order using
    // the painter's algorithm: draw far -> near. This requires reordering the points, so
    // whenever styles update we must also update positions to keep all parallel buffers aligned.
    // However, if only colors changed (not depths), we can skip re-sorting and position updates.
    let needsReorder = updatePositions;
    if (updateStyles && !updatePositions) {
      // Check if depths have actually changed by sampling first few points
      // If depths are the same, we can skip re-sorting (color-only update optimization)
      const sampleSize = Math.min(100, points.length);
      let depthsChanged = false;
      for (let i = 0; i < sampleSize && i < this.currentPointCount; i++) {
        const point = points[i];
        const opacity = this.style.getOpacity(point);
        if (opacity === 0) continue;
        const newDepth = this.style.getDepth(point);
        // Compare with stored depth (note: depths array is in sorted order after last render)
        if (Math.abs(newDepth - this.depths[i]) > 1e-6) {
          depthsChanged = true;
          break;
        }
      }
      if (depthsChanged) {
        needsReorder = true;
        updatePositions = true;
      }
    } else if (updateStyles) {
      needsReorder = true;
      updatePositions = true;
    }

    let idx = 0;

    if (needsReorder) {
      const staged: Array<{ point: PlotDataPoint; opacity: number; depth: number }> = [];
      for (let i = 0; i < points.length && staged.length < maxPoints; i++) {
        const point = points[i];
        const opacity = this.style.getOpacity(point);
        if (opacity === 0) continue;
        const depth = this.style.getDepth(point);
        staged.push({ point, opacity, depth });
      }

      // Draw far -> near, so near points end up on top.
      // NOTE: `getDepth` is defined such that smaller depth is "closer" (wins in LESS mode).
      staged.sort((a, b) => b.depth - a.depth);

      for (let s = 0; s < staged.length; s++) {
        const { point, opacity, depth } = staged[s];

        if (this.trackRenderedPointIds) {
          this.renderedPointIds.add(point.id);
        }

        // updatePositions is always true here (see above)
        this.dataPositions[idx * 2] = scales.x(point.x);
        this.dataPositions[idx * 2 + 1] = scales.y(point.y);

        const pointColors = this.style.getColors(point);
        const [r, g, b] = resolveColor(pointColors[0] ?? '#888888');
        const size = Math.sqrt(this.style.getPointSize(point)) / POINT_SIZE_DIVISOR;
        const shapeType = this.style.getShape(point);
        const shapeIndex = getShapeIndex(shapeType);

        this.colors[idx * 4] = r;
        this.colors[idx * 4 + 1] = g;
        this.colors[idx * 4 + 2] = b;
        this.colors[idx * 4 + 3] = Math.min(1, Math.max(0, opacity));
        const basePointSize = Math.max(MIN_POINT_SIZE, size * 2 * this.dpr);
        this.sizes[idx] = shapeIndex === 2 ? basePointSize * DIAMOND_SIZE_SCALE : basePointSize;
        this.depths[idx] = depth;
        this.labelCounts[idx] = pointColors.length;
        this.shapes[idx] = shapeIndex;

        // Fill label color texture data
        for (let j = 0; j < MAX_LABELS; j++) {
          if (j < pointColors.length) {
            const [lr, lg, lb] = resolveColor(pointColors[j]);
            const texIndex = (idx * MAX_LABELS + j) * 4;
            if (texIndex < this.labelColorData.length) {
              // RGBA8 texture: store 0..255 bytes. Sampling returns normalized floats automatically.
              this.labelColorData[texIndex] = Math.round(lr * 255);
              this.labelColorData[texIndex + 1] = Math.round(lg * 255);
              this.labelColorData[texIndex + 2] = Math.round(lb * 255);
              this.labelColorData[texIndex + 3] = 255;
            }
          }
        }

        idx++;
      }
    } else if (updateStyles) {
      // Color-only update: no reordering needed, just update color/shape buffers
      for (let i = 0; i < points.length && idx < maxPoints; i++) {
        const point = points[i];
        const opacity = this.style.getOpacity(point);
        if (opacity === 0) continue;

        if (this.trackRenderedPointIds) {
          this.renderedPointIds.add(point.id);
        }

        // Update only style buffers (colors, shapes, sizes)
        const pointColors = this.style.getColors(point);
        const [r, g, b] = resolveColor(pointColors[0] ?? '#888888');
        const size = Math.sqrt(this.style.getPointSize(point)) / POINT_SIZE_DIVISOR;
        const shapeType = this.style.getShape(point);
        const shapeIndex = getShapeIndex(shapeType);

        this.colors[idx * 4] = r;
        this.colors[idx * 4 + 1] = g;
        this.colors[idx * 4 + 2] = b;
        this.colors[idx * 4 + 3] = Math.min(1, Math.max(0, opacity));
        const basePointSize = Math.max(MIN_POINT_SIZE, size * 2 * this.dpr);
        this.sizes[idx] = shapeIndex === 2 ? basePointSize * DIAMOND_SIZE_SCALE : basePointSize;
        this.labelCounts[idx] = pointColors.length;
        this.shapes[idx] = shapeIndex;

        // Fill label color texture data
        for (let j = 0; j < MAX_LABELS; j++) {
          if (j < pointColors.length) {
            const [lr, lg, lb] = resolveColor(pointColors[j]);
            const texIndex = (idx * MAX_LABELS + j) * 4;
            if (texIndex < this.labelColorData.length) {
              this.labelColorData[texIndex] = Math.round(lr * 255);
              this.labelColorData[texIndex + 1] = Math.round(lg * 255);
              this.labelColorData[texIndex + 2] = Math.round(lb * 255);
              this.labelColorData[texIndex + 3] = 255;
            }
          }
        }

        idx++;
      }
    } else {
      // No reordering and no style updates: only update positions if needed
      for (let i = 0; i < points.length && idx < maxPoints; i++) {
        const point = points[i];
        const opacity = this.style.getOpacity(point);
        if (opacity === 0) continue;

        if (this.trackRenderedPointIds) {
          this.renderedPointIds.add(point.id);
        }

        if (updatePositions) {
          this.dataPositions[idx * 2] = scales.x(point.x);
          this.dataPositions[idx * 2 + 1] = scales.y(point.y);
        }

        idx++;
      }
    }

    this.currentPointCount = idx;

    gl.bindVertexArray(this.pointVao);

    if (updatePositions) {
      this.updateBuffer(gl, this.dataPositionBuffer, this.dataPositions, idx * 2);
    }

    if (updateStyles) {
      this.updateBuffer(gl, this.sizeBuffer, this.sizes, idx);
      this.updateBuffer(gl, this.colorBuffer, this.colors, idx * 4);
      this.updateBuffer(gl, this.depthBuffer, this.depths, idx);
      this.updateBuffer(gl, this.labelCountBuffer, this.labelCounts, idx);
      this.updateBuffer(gl, this.shapeBuffer, this.shapes, idx);

      // Update texture
      gl.bindTexture(gl.TEXTURE_2D, this.labelColorTexture);
      const texHeight = this.labelColorData.length / 4 / LABEL_TEXTURE_WIDTH;
      gl.texImage2D(
        gl.TEXTURE_2D,
        0,
        gl.RGBA8,
        LABEL_TEXTURE_WIDTH,
        texHeight,
        0,
        gl.RGBA,
        gl.UNSIGNED_BYTE,
        this.labelColorData,
      );
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
      gl.bindTexture(gl.TEXTURE_2D, null);
    }

    gl.bindVertexArray(null);
    this.buffersInitialized = true;
  }

  private updateBuffer(
    gl: WebGL2RenderingContext,
    buffer: WebGLBuffer | null,
    data: Float32Array,
    length: number,
  ) {
    if (!buffer) return;
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    if (this.buffersInitialized) {
      gl.bufferSubData(gl.ARRAY_BUFFER, 0, data.subarray(0, length));
    } else {
      gl.bufferData(gl.ARRAY_BUFFER, data, gl.DYNAMIC_DRAW);
    }
  }

  private expandCapacity(minCapacity: number) {
    const nextCapacity = Math.pow(2, Math.ceil(Math.log2(Math.max(minCapacity, MIN_CAPACITY))));
    this.capacity = nextCapacity;
    this.dataPositions = new Float32Array(nextCapacity * 2);
    this.colors = new Float32Array(nextCapacity * 4);
    this.sizes = new Float32Array(nextCapacity);
    this.depths = new Float32Array(nextCapacity);
    this.labelCounts = new Float32Array(nextCapacity);
    this.shapes = new Float32Array(nextCapacity);
    // Align texture height to next power of 2 or just simple expansion
    // Total pixels needed = nextCapacity * MAX_LABELS
    // Texture Width = LABEL_TEXTURE_WIDTH
    // Height = ceil(Total / Width)
    const requiredPixels = nextCapacity * MAX_LABELS;
    const texHeight = Math.ceil(requiredPixels / LABEL_TEXTURE_WIDTH);
    this.labelColorData = new Uint8Array(LABEL_TEXTURE_WIDTH * texHeight * 4);

    this.buffersInitialized = false;
  }
}
