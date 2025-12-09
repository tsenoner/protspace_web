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

const POINT_VERTEX_SHADER = `#version 300 es
precision highp float;

in vec2 a_dataPosition;
in float a_pointSize;
in vec4 a_color;
in float a_labelCount;

uniform vec2 u_resolution;
uniform vec3 u_transform;
uniform float u_dpr;
uniform float u_gamma;

out vec4 v_color;
out float v_labelCount;
flat out int v_pointIndex;

void main() {
  vec2 cssTransformed = a_dataPosition * u_transform.z + u_transform.xy;
  vec2 physicalPos = cssTransformed * u_dpr;
  vec2 clipSpace = (physicalPos / u_resolution) * 2.0 - 1.0;
  
  // Use alpha for depth sorting
  float z = 1.0 - a_color.a;
  
  gl_Position = vec4(clipSpace.x, -clipSpace.y, z, 1.0);
  gl_PointSize = max(1.0, a_pointSize);
  
  // Convert sRGB input to linear RGB for proper blending
  vec3 linearColor = pow(max(a_color.rgb, vec3(0.0)), vec3(u_gamma));
  v_color = vec4(linearColor, a_color.a);
  v_labelCount = a_labelCount;
  v_pointIndex = gl_VertexID;
}`;

const POINT_FRAGMENT_SHADER = `#version 300 es
precision highp float;

in vec4 v_color;
in float v_labelCount;
flat in int v_pointIndex;

uniform sampler2D u_labelColors;
uniform vec2 u_labelTextureSize;
uniform int u_maxLabels;
uniform float u_gamma;

out vec4 fragColor;

const float PI = 3.14159265359;

void main() {
  vec2 coord = gl_PointCoord * 2.0 - 1.0;
  float distSq = dot(coord, coord);
  
  if (distSq > 1.0) discard;
  
  vec3 finalColor = v_color.rgb;

  // Pie Chart Logic
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
  
  float dist = sqrt(distSq);
  
  // Stroke width
  float strokeWidth = 0.15;
  float strokeStart = 1.0 - strokeWidth;

  if (dist > strokeStart) {
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
    labelCount: number;
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
  private labelCountBuffer: WebGLBuffer | null = null;
  private labelColorTexture: WebGLTexture | null = null;

  // CPU arrays
  private dataPositions = new Float32Array(0);
  private sizes = new Float32Array(0);
  private colors = new Float32Array(0);
  private labelCounts = new Float32Array(0);
  private labelColorData = new Float32Array(0);

  // State
  private capacity = 0;

  private currentPointCount = 0;
  private positionsDirty = true;
  private stylesDirty = true;
  private buffersInitialized = false;

  // Caching
  private lastDataSignature: string | null = null;
  private lastStyleSignature: string | null = null;

  // Track rendered point IDs for hover detection
  private renderedPointIds = new Set<string>();

  // Config
  private dpr = window.devicePixelRatio || 1;
  private styleSignature: string | null = null;
  private gammaPipelineAvailable = true;
  private warnedGammaFallback = false;

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

  /**
   * @deprecated Selected feature is now handled via style signature.
   * Kept for backward compatibility.
   */
  setSelectedFeature(_feature: string) {
    // No-op: selected feature is now part of style signature
  }

  invalidateStyleCache() {
    this.stylesDirty = true;
  }

  isPointRendered(pointId: string): boolean {
    return this.renderedPointIds.has(pointId);
  }

  invalidatePositionCache() {
    this.positionsDirty = true;
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
    const gl = this.ensureGL();
    const scales = this.getScales();
    if (!gl || !scales) return;

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
    gl.viewport(0, 0, framebuffer.width, framebuffer.height);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    // Use premultiplied alpha blending for linear color space
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    this.renderPoints(transform);

    // Pass 2: Gamma correction to canvas
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    this.renderGammaCorrection();
  }

  private renderGammaCorrection() {
    if (!this.gl || !this.gammaCorrectionProgram || !this.linearFramebuffer || !this.gammaCorrectionUniformLocations) {
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

    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

    this.renderPoints(transform);
  }

  dispose() {
    if (!this.gl) return;
    const gl = this.gl;

    if (this.pointVao) gl.deleteVertexArray(this.pointVao);
    if (this.dataPositionBuffer) gl.deleteBuffer(this.dataPositionBuffer);
    if (this.sizeBuffer) gl.deleteBuffer(this.sizeBuffer);
    if (this.colorBuffer) gl.deleteBuffer(this.colorBuffer);
    if (this.labelCountBuffer) gl.deleteBuffer(this.labelCountBuffer);
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
  // WebGL Setup
  // ============================================================================

  private ensureGL(): WebGL2RenderingContext | null {
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
    this.labelCountBuffer = gl.createBuffer();
    this.quadBuffer = gl.createBuffer();
    this.labelColorTexture = gl.createTexture();

    this.createPointVAO();

    this.setupQuad();

    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

    // Enable depth testing to prevent opacity accumulation
    gl.enable(gl.DEPTH_TEST);
    gl.depthFunc(gl.LESS);

    if (this.gammaPipelineAvailable && !this.resizeLinearFramebuffer(this.canvas.width, this.canvas.height)) {
      this.handleGammaFallback('framebuffer incomplete');
    }

    return gl;
  }

  private initializePointShaders(gl: WebGL2RenderingContext): boolean {
    this.pointProgram = createProgramFromSources(gl, POINT_VERTEX_SHADER, POINT_FRAGMENT_SHADER);
    if (!this.pointProgram) return false;

    this.pointAttribLocations = {
      dataPosition: gl.getAttribLocation(this.pointProgram, 'a_dataPosition'),
      size: gl.getAttribLocation(this.pointProgram, 'a_pointSize'),
      color: gl.getAttribLocation(this.pointProgram, 'a_color'),
      labelCount: gl.getAttribLocation(this.pointProgram, 'a_labelCount'),
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
    this.gammaCorrectionProgram = createProgramFromSources(gl, GAMMA_VERTEX_SHADER, GAMMA_FRAGMENT_SHADER);
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

    gl.bindBuffer(gl.ARRAY_BUFFER, this.labelCountBuffer);
    gl.enableVertexAttribArray(this.pointAttribLocations.labelCount);
    gl.vertexAttribPointer(this.pointAttribLocations.labelCount, 1, gl.FLOAT, false, 0, 0);

    gl.bindVertexArray(null);
  }

  private setupQuad() {
    const gl = this.gl;
    if (!gl || !this.quadBuffer) return;

    const quadVertices = new Float32Array([
      -1, -1, 1, -1, -1, 1,
      -1, 1, 1, -1, 1, 1,
    ]);

    gl.bindBuffer(gl.ARRAY_BUFFER, this.quadBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, quadVertices, gl.STATIC_DRAW);
  }

  // ============================================================================
  // Rendering
  // ============================================================================

  private renderPoints(transform: d3.ZoomTransform) {
    if (!this.gl || this.currentPointCount === 0 || !this.pointProgram || !this.pointUniformLocations) {
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
    gl.uniform2f(this.pointUniformLocations.labelTextureSize, LABEL_TEXTURE_WIDTH, this.labelColorData.length / 4 / LABEL_TEXTURE_WIDTH);
    
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
      .filter(i => i < len)
      .map(i => {
        const p = points[i];
        return `${p.id}:${this.style.getOpacity(p).toFixed(2)}:${this.style.getColors(p)[0]}`;
      });
    
    return `${this.styleSignature}|${parts.join('|')}`;
  }

  private populateBuffers(points: PlotDataPoint[], scales: ScalePair, updatePositions: boolean, updateStyles: boolean) {
    if (!this.gl) return;
    const gl = this.gl;

    const maxPoints = Math.min(points.length, MAX_POINTS_DIRECT_RENDER);

    if (maxPoints > this.capacity) {
      this.expandCapacity(maxPoints);
      updatePositions = true;
      updateStyles = true;
    }

    this.renderedPointIds.clear();

    let idx = 0;
    for (let i = 0; i < points.length && idx < maxPoints; i++) {
      const point = points[i];
      const opacity = this.style.getOpacity(point);
      if (opacity === 0) continue;

      this.renderedPointIds.add(point.id);

      if (updatePositions) {
        this.dataPositions[idx * 2] = scales.x(point.x);
        this.dataPositions[idx * 2 + 1] = scales.y(point.y);
      }

      if (updateStyles) {
        const pointColors = this.style.getColors(point);
        const [r, g, b] = resolveColor(pointColors[0] ?? '#888888');
        const size = Math.sqrt(this.style.getPointSize(point)) / POINT_SIZE_DIVISOR;

        this.colors[idx * 4] = r;
        this.colors[idx * 4 + 1] = g;
        this.colors[idx * 4 + 2] = b;
        this.colors[idx * 4 + 3] = Math.min(1, Math.max(0, opacity));
        this.sizes[idx] = Math.max(MIN_POINT_SIZE, size * 2 * this.dpr);
        this.labelCounts[idx] = pointColors.length;

        // Fill label color texture data
        for (let j = 0; j < MAX_LABELS; j++) {
          if (j < pointColors.length) {
             const [lr, lg, lb] = resolveColor(pointColors[j]);
             const texIndex = (idx * MAX_LABELS + j) * 4;
             if (texIndex < this.labelColorData.length) {
                this.labelColorData[texIndex] = lr;
                this.labelColorData[texIndex + 1] = lg;
                this.labelColorData[texIndex + 2] = lb;
                this.labelColorData[texIndex + 3] = 1.0;
             }
          }
        }
      }

      idx++;
    }

    this.currentPointCount = idx;

    gl.bindVertexArray(this.pointVao);

    if (updatePositions) {
      this.updateBuffer(gl, this.dataPositionBuffer, this.dataPositions, idx * 2);
    }

    if (updateStyles) {
      this.updateBuffer(gl, this.sizeBuffer, this.sizes, idx);
      this.updateBuffer(gl, this.colorBuffer, this.colors, idx * 4);
      this.updateBuffer(gl, this.labelCountBuffer, this.labelCounts, idx);
      
      // Update texture
      gl.bindTexture(gl.TEXTURE_2D, this.labelColorTexture);
      const texHeight = this.labelColorData.length / 4 / LABEL_TEXTURE_WIDTH;
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, LABEL_TEXTURE_WIDTH, texHeight, 0, gl.RGBA, gl.FLOAT, this.labelColorData);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
      gl.bindTexture(gl.TEXTURE_2D, null);
    }

    gl.bindVertexArray(null);
    this.buffersInitialized = true;
  }

  private updateBuffer(gl: WebGL2RenderingContext, buffer: WebGLBuffer | null, data: Float32Array, length: number) {
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
    this.labelCounts = new Float32Array(nextCapacity);
    // Align texture height to next power of 2 or just simple expansion
    // Total pixels needed = nextCapacity * MAX_LABELS
    // Texture Width = LABEL_TEXTURE_WIDTH
    // Height = ceil(Total / Width)
    const requiredPixels = nextCapacity * MAX_LABELS;
    const texHeight = Math.ceil(requiredPixels / LABEL_TEXTURE_WIDTH);
    this.labelColorData = new Float32Array(LABEL_TEXTURE_WIDTH * texHeight * 4);
    
    this.buffersInitialized = false;
  }
}
