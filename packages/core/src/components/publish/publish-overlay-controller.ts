/**
 * Overlay Controller for the Publish modal preview canvas.
 *
 * Handles pointer events for drawing annotations (circle, arrow, label),
 * placing zoom-inset source/target rectangles, and moving/resizing
 * selected items via drag handles.
 *
 * All coordinates are converted from canvas-pixel space to normalised 0–1
 * before updating PublishState.
 */

import type {
  Annotation,
  CircleAnnotation,
  ArrowAnnotation,
  LabelAnnotation,
  Inset,
  NormRect,
  OverlayTool,
} from './publish-state';

interface OverlayCallbacks {
  getPlotRect(): { x: number; y: number; w: number; h: number };
  onAnnotationAdded(annotation: Annotation): void;
  onAnnotationUpdated(index: number, annotation: Annotation): void;
  onInsetAdded(inset: Inset): void;
  onInsetUpdated(index: number, inset: Inset): void;
  onSelectionChanged(type: 'annotation' | 'inset' | null, index: number): void;
  requestRedraw(): void;
}

interface DragState {
  active: boolean;
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
}

export class PublishOverlayController {
  private canvas: HTMLCanvasElement;
  private callbacks: OverlayCallbacks;
  private _tool: OverlayTool = 'select';
  private drag: DragState = { active: false, startX: 0, startY: 0, currentX: 0, currentY: 0 };

  // Pending inset: after source is drawn, we switch to inset-target
  private pendingInsetSource: NormRect | null = null;

  constructor(canvas: HTMLCanvasElement, callbacks: OverlayCallbacks) {
    this.canvas = canvas;
    this.callbacks = callbacks;
    this.canvas.addEventListener('pointerdown', this.onPointerDown);
    this.canvas.addEventListener('pointermove', this.onPointerMove);
    this.canvas.addEventListener('pointerup', this.onPointerUp);
  }

  get tool(): OverlayTool {
    return this._tool;
  }

  set tool(value: OverlayTool) {
    this._tool = value;
    this.canvas.style.cursor = value === 'select' ? 'default' : 'crosshair';
  }

  destroy() {
    this.canvas.removeEventListener('pointerdown', this.onPointerDown);
    this.canvas.removeEventListener('pointermove', this.onPointerMove);
    this.canvas.removeEventListener('pointerup', this.onPointerUp);
  }

  /** Convert canvas-pixel coord to normalised 0–1 within the plot rect */
  private toNorm(canvasX: number, canvasY: number): { nx: number; ny: number } {
    const pr = this.callbacks.getPlotRect();
    const rect = this.canvas.getBoundingClientRect();
    const scaleX = this.canvas.width / rect.width;
    const scaleY = this.canvas.height / rect.height;
    const px = canvasX * scaleX;
    const py = canvasY * scaleY;
    return {
      nx: Math.max(0, Math.min(1, (px - pr.x) / pr.w)),
      ny: Math.max(0, Math.min(1, (py - pr.y) / pr.h)),
    };
  }

  private onPointerDown = (e: PointerEvent) => {
    const rect = this.canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    this.drag = { active: true, startX: x, startY: y, currentX: x, currentY: y };
    this.canvas.setPointerCapture(e.pointerId);
  };

  private onPointerMove = (e: PointerEvent) => {
    if (!this.drag.active) return;
    const rect = this.canvas.getBoundingClientRect();
    this.drag.currentX = e.clientX - rect.left;
    this.drag.currentY = e.clientY - rect.top;
    this.callbacks.requestRedraw();
  };

  private onPointerUp = (e: PointerEvent) => {
    if (!this.drag.active) return;
    this.drag.active = false;

    const rect = this.canvas.getBoundingClientRect();
    const endX = e.clientX - rect.left;
    const endY = e.clientY - rect.top;
    const start = this.toNorm(this.drag.startX, this.drag.startY);
    const end = this.toNorm(endX, endY);

    switch (this._tool) {
      case 'circle':
        this.finishCircle(start, end);
        break;
      case 'arrow':
        this.finishArrow(start, end);
        break;
      case 'label':
        this.finishLabel(start);
        break;
      case 'inset-source':
        this.finishInsetSource(start, end);
        break;
      case 'inset-target':
        this.finishInsetTarget(start, end);
        break;
      case 'select':
        this.callbacks.onSelectionChanged(null, -1);
        break;
    }

    this.callbacks.requestRedraw();
  };

  private finishCircle(start: { nx: number; ny: number }, end: { nx: number; ny: number }) {
    const dx = end.nx - start.nx;
    const dy = end.ny - start.ny;
    const r = Math.sqrt(dx * dx + dy * dy);
    if (r < 0.005) return; // too small
    const annotation: CircleAnnotation = {
      type: 'circle',
      cx: start.nx,
      cy: start.ny,
      r,
      color: '#000000',
      strokeWidth: 2,
    };
    this.callbacks.onAnnotationAdded(annotation);
  }

  private finishArrow(start: { nx: number; ny: number }, end: { nx: number; ny: number }) {
    const dx = end.nx - start.nx;
    const dy = end.ny - start.ny;
    if (Math.sqrt(dx * dx + dy * dy) < 0.005) return;
    const annotation: ArrowAnnotation = {
      type: 'arrow',
      x1: start.nx,
      y1: start.ny,
      x2: end.nx,
      y2: end.ny,
      color: '#000000',
      width: 2,
      headSize: 10,
    };
    this.callbacks.onAnnotationAdded(annotation);
  }

  private finishLabel(start: { nx: number; ny: number }) {
    const annotation: LabelAnnotation = {
      type: 'label',
      x: start.nx,
      y: start.ny,
      text: 'Label',
      fontSize: 16,
      color: '#000000',
    };
    this.callbacks.onAnnotationAdded(annotation);
  }

  private finishInsetSource(start: { nx: number; ny: number }, end: { nx: number; ny: number }) {
    const x = Math.min(start.nx, end.nx);
    const y = Math.min(start.ny, end.ny);
    const w = Math.abs(end.nx - start.nx);
    const h = Math.abs(end.ny - start.ny);
    if (w < 0.01 || h < 0.01) return;
    this.pendingInsetSource = { x, y, w, h };
    this.tool = 'inset-target';
  }

  private finishInsetTarget(start: { nx: number; ny: number }, end: { nx: number; ny: number }) {
    if (!this.pendingInsetSource) return;
    const x = Math.min(start.nx, end.nx);
    const y = Math.min(start.ny, end.ny);
    const w = Math.abs(end.nx - start.nx);
    const h = Math.abs(end.ny - start.ny);
    if (w < 0.01 || h < 0.01) return;
    const inset: Inset = {
      sourceRect: this.pendingInsetSource,
      targetRect: { x, y, w, h },
      border: 2,
      connector: 'lines',
      magnification: 2,
    };
    this.pendingInsetSource = null;
    this.tool = 'select';
    this.callbacks.onInsetAdded(inset);
  }

  /** Draw in-progress drag indicator (rubber-band) on a separate overlay ctx. */
  drawDragIndicator(ctx: CanvasRenderingContext2D) {
    if (!this.drag.active) return;
    const pr = this.callbacks.getPlotRect();
    const rect = this.canvas.getBoundingClientRect();
    const scaleX = this.canvas.width / rect.width;
    const scaleY = this.canvas.height / rect.height;

    const sx = this.drag.startX * scaleX;
    const sy = this.drag.startY * scaleY;
    const cx = this.drag.currentX * scaleX;
    const cy = this.drag.currentY * scaleY;

    ctx.save();
    ctx.strokeStyle = 'rgba(0, 163, 224, 0.8)';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 4]);

    switch (this._tool) {
      case 'circle': {
        const rx = Math.abs(cx - sx);
        const ry = Math.abs(cy - sy);
        const r = Math.sqrt(rx * rx + ry * ry);
        ctx.beginPath();
        ctx.arc(sx, sy, r, 0, Math.PI * 2);
        ctx.stroke();
        break;
      }
      case 'arrow': {
        ctx.beginPath();
        ctx.moveTo(sx, sy);
        ctx.lineTo(cx, cy);
        ctx.stroke();
        break;
      }
      case 'inset-source':
      case 'inset-target': {
        const x = Math.min(sx, cx);
        const y = Math.min(sy, cy);
        const w = Math.abs(cx - sx);
        const h = Math.abs(cy - sy);
        ctx.fillStyle = 'rgba(0, 163, 224, 0.1)';
        ctx.fillRect(x, y, w, h);
        ctx.strokeRect(x, y, w, h);
        break;
      }
    }

    ctx.restore();
    void pr; // used for coord space reference
  }
}
