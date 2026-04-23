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
  getAnnotations(): Annotation[];
  getInsets(): Inset[];
  getLegendRect(): { x: number; y: number; w: number; h: number } | null;
  onAnnotationAdded(annotation: Annotation): void;
  onAnnotationUpdated(index: number, annotation: Annotation): void;
  onInsetAdded(inset: Inset): void;
  onInsetUpdated(index: number, inset: Inset): void;
  onSelectionChanged(type: 'annotation' | 'inset' | null, index: number): void;
  onLegendMoved(nx: number, ny: number): void;
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
  private selected: { kind: 'annotation' | 'inset'; index: number } | null = null;
  private dragOffset: { dx: number; dy: number } = { dx: 0, dy: 0 };
  private handleMode: 'move' | 'resize-rx' | 'resize-ry' | 'rotate' | null = null;
  private legendDragging = false;

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

  private hitTestAnnotation(nx: number, ny: number, a: Annotation): boolean {
    const threshold = 0.03;
    switch (a.type) {
      case 'circle': {
        // Normalize to unit circle space for proper ellipse hit-test
        const dx = (nx - a.cx) / a.rx;
        const dy = (ny - a.cy) / a.ry;
        const dist = Math.abs(Math.sqrt(dx * dx + dy * dy) - 1);
        return dist < threshold / Math.min(a.rx, a.ry);
      }
      case 'arrow':
        return this.pointToSegmentDist(nx, ny, a.x1, a.y1, a.x2, a.y2) < threshold;
      case 'label':
        return nx >= a.x - 0.01 && nx <= a.x + 0.15 && ny >= a.y - 0.03 && ny <= a.y + 0.03;
    }
  }

  private hitTestInset(nx: number, ny: number, inset: Inset): boolean {
    const tr = inset.targetRect;
    return nx >= tr.x && nx <= tr.x + tr.w && ny >= tr.y && ny <= tr.y + tr.h;
  }

  private pointToSegmentDist(
    px: number,
    py: number,
    x1: number,
    y1: number,
    x2: number,
    y2: number,
  ): number {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const lenSq = dx * dx + dy * dy;
    if (lenSq === 0) return Math.sqrt((px - x1) ** 2 + (py - y1) ** 2);
    let t = ((px - x1) * dx + (py - y1) * dy) / lenSq;
    t = Math.max(0, Math.min(1, t));
    const projX = x1 + t * dx;
    const projY = y1 + t * dy;
    return Math.sqrt((px - projX) ** 2 + (py - projY) ** 2);
  }

  /**
   * Compute the 4 resize handles + 1 rotate handle for a circle annotation,
   * in canvas-pixel coordinates. Returns null if not a circle.
   */
  private getCircleHandles(a: CircleAnnotation): {
    right: { x: number; y: number };
    left: { x: number; y: number };
    top: { x: number; y: number };
    bottom: { x: number; y: number };
    rotate: { x: number; y: number };
  } {
    const pr = this.callbacks.getPlotRect();
    const cxPx = pr.x + a.cx * pr.w;
    const cyPx = pr.y + a.cy * pr.h;
    const rxPx = a.rx * pr.w;
    const ryPx = a.ry * pr.h;
    const rot = a.rotation || 0;
    const cos = Math.cos(rot);
    const sin = Math.sin(rot);
    const rotateOffset = 30; // px beyond the top handle

    return {
      right: { x: cxPx + rxPx * cos, y: cyPx + rxPx * sin },
      left: { x: cxPx - rxPx * cos, y: cyPx - rxPx * sin },
      top: { x: cxPx + ryPx * sin, y: cyPx - ryPx * cos },
      bottom: { x: cxPx - ryPx * sin, y: cyPx + ryPx * cos },
      rotate: {
        x: cxPx + (ryPx + rotateOffset) * sin,
        y: cyPx - (ryPx + rotateOffset) * cos,
      },
    };
  }

  /**
   * Check if a canvas-pixel position hits a handle. Returns the handle type or null.
   */
  private hitTestCircleHandles(
    pxX: number,
    pxY: number,
    a: CircleAnnotation,
  ): 'resize-rx' | 'resize-ry' | 'rotate' | null {
    const handles = this.getCircleHandles(a);
    const hitRadius = 8; // px

    const distSq = (hx: number, hy: number) => (pxX - hx) ** 2 + (pxY - hy) ** 2;

    if (distSq(handles.rotate.x, handles.rotate.y) < hitRadius ** 2) return 'rotate';
    if (distSq(handles.right.x, handles.right.y) < hitRadius ** 2) return 'resize-rx';
    if (distSq(handles.left.x, handles.left.y) < hitRadius ** 2) return 'resize-rx';
    if (distSq(handles.top.x, handles.top.y) < hitRadius ** 2) return 'resize-ry';
    if (distSq(handles.bottom.x, handles.bottom.y) < hitRadius ** 2) return 'resize-ry';

    return null;
  }

  private moveSelected(nx: number, ny: number) {
    if (!this.selected) return;

    if (this.selected.kind === 'annotation') {
      const anns = this.callbacks.getAnnotations();
      const a = anns[this.selected.index];
      if (!a) return;

      let moved: Annotation;
      switch (a.type) {
        case 'circle':
          moved = { ...a, cx: nx, cy: ny };
          break;
        case 'arrow': {
          const adx = a.x2 - a.x1;
          const ady = a.y2 - a.y1;
          moved = { ...a, x1: nx, y1: ny, x2: nx + adx, y2: ny + ady };
          break;
        }
        case 'label':
          moved = { ...a, x: nx, y: ny };
          break;
      }
      this.callbacks.onAnnotationUpdated(this.selected.index, moved);
    } else {
      const insets = this.callbacks.getInsets();
      const inset = insets[this.selected.index];
      if (!inset) return;
      const moved: Inset = {
        ...inset,
        targetRect: { ...inset.targetRect, x: nx, y: ny },
      };
      this.callbacks.onInsetUpdated(this.selected.index, moved);
    }
  }

  private applyHandleDrag() {
    if (!this.selected || this.selected.kind !== 'annotation') return;
    const anns = this.callbacks.getAnnotations();
    const a = anns[this.selected.index];
    if (!a || a.type !== 'circle') return;

    const pr = this.callbacks.getPlotRect();
    const rect = this.canvas.getBoundingClientRect();
    const scaleX = this.canvas.width / rect.width;
    const scaleY = this.canvas.height / rect.height;
    const curPxX = this.drag.currentX * scaleX;
    const curPxY = this.drag.currentY * scaleY;

    const cxPx = pr.x + a.cx * pr.w;
    const cyPx = pr.y + a.cy * pr.h;

    if (this.handleMode === 'rotate') {
      const angle = Math.atan2(curPxX - cxPx, -(curPxY - cyPx));
      this.callbacks.onAnnotationUpdated(this.selected.index, { ...a, rotation: angle });
    } else if (this.handleMode === 'resize-rx') {
      // Distance from center along the rotation axis
      const rot = a.rotation || 0;
      const dx = curPxX - cxPx;
      const dy = curPxY - cyPx;
      const projectedRx = Math.abs(dx * Math.cos(rot) + dy * Math.sin(rot));
      const newRx = Math.max(0.01, projectedRx / pr.w);
      this.callbacks.onAnnotationUpdated(this.selected.index, { ...a, rx: newRx });
    } else if (this.handleMode === 'resize-ry') {
      const rot = a.rotation || 0;
      const dx = curPxX - cxPx;
      const dy = curPxY - cyPx;
      const projectedRy = Math.abs(-dx * Math.sin(rot) + dy * Math.cos(rot));
      const newRy = Math.max(0.01, projectedRy / pr.h);
      this.callbacks.onAnnotationUpdated(this.selected.index, { ...a, ry: newRy });
    }
  }

  private onPointerDown = (e: PointerEvent) => {
    const rect = this.canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    this.drag = { active: true, startX: x, startY: y, currentX: x, currentY: y };
    this.canvas.setPointerCapture(e.pointerId);

    if (this._tool === 'select') {
      const norm = this.toNorm(x, y);
      const canvasRect = this.canvas.getBoundingClientRect();
      const pxX = x * (this.canvas.width / canvasRect.width);
      const pxY = y * (this.canvas.height / canvasRect.height);

      // If a circle is already selected, check handles first
      if (this.selected?.kind === 'annotation') {
        const a = this.callbacks.getAnnotations()[this.selected.index];
        if (a?.type === 'circle') {
          const mode = this.hitTestCircleHandles(pxX, pxY, a);
          if (mode) {
            this.handleMode = mode;
            return;
          }
        }
      }

      this.handleMode = null;

      // Check insets first (drawn on top)
      const insets = this.callbacks.getInsets();
      for (let i = insets.length - 1; i >= 0; i--) {
        if (this.hitTestInset(norm.nx, norm.ny, insets[i])) {
          this.selected = { kind: 'inset', index: i };
          this.dragOffset = {
            dx: norm.nx - insets[i].targetRect.x,
            dy: norm.ny - insets[i].targetRect.y,
          };
          this.callbacks.onSelectionChanged('inset', i);
          return;
        }
      }
      // Check annotations
      const anns = this.callbacks.getAnnotations();
      for (let i = anns.length - 1; i >= 0; i--) {
        if (this.hitTestAnnotation(norm.nx, norm.ny, anns[i])) {
          this.selected = { kind: 'annotation', index: i };
          const a = anns[i];
          if (a.type === 'circle') {
            this.dragOffset = { dx: norm.nx - a.cx, dy: norm.ny - a.cy };
          } else if (a.type === 'arrow') {
            this.dragOffset = { dx: norm.nx - a.x1, dy: norm.ny - a.y1 };
          } else {
            this.dragOffset = { dx: norm.nx - a.x, dy: norm.ny - a.y };
          }
          this.callbacks.onSelectionChanged('annotation', i);
          return;
        }
      }
      // Check if clicking on legend (for free position mode)
      const legendRect = this.callbacks.getLegendRect();
      if (legendRect) {
        const rect = this.canvas.getBoundingClientRect();
        const scaleX = this.canvas.width / rect.width;
        const scaleY = this.canvas.height / rect.height;
        const px = x * scaleX;
        const py = y * scaleY;
        if (
          px >= legendRect.x &&
          px <= legendRect.x + legendRect.w &&
          py >= legendRect.y &&
          py <= legendRect.y + legendRect.h
        ) {
          this.legendDragging = true;
          this.dragOffset = {
            dx: px - legendRect.x,
            dy: py - legendRect.y,
          };
          return;
        }
      }
      this.selected = null;
      this.callbacks.onSelectionChanged(null, -1);
    }
  };

  private onPointerMove = (e: PointerEvent) => {
    if (!this.drag.active) return;
    const rect = this.canvas.getBoundingClientRect();
    this.drag.currentX = e.clientX - rect.left;
    this.drag.currentY = e.clientY - rect.top;

    if (this._tool === 'select' && this.legendDragging) {
      const scaleX = this.canvas.width / rect.width;
      const scaleY = this.canvas.height / rect.height;
      const px = this.drag.currentX * scaleX;
      const py = this.drag.currentY * scaleY;
      const nx = (px - this.dragOffset.dx) / this.canvas.width;
      const ny = (py - this.dragOffset.dy) / this.canvas.height;
      this.callbacks.onLegendMoved(Math.max(0, Math.min(1, nx)), Math.max(0, Math.min(1, ny)));
      this.callbacks.requestRedraw();
      return;
    }

    if (this._tool === 'select' && this.selected) {
      if (this.handleMode && this.selected.kind === 'annotation') {
        this.applyHandleDrag();
      } else {
        const norm = this.toNorm(this.drag.currentX, this.drag.currentY);
        const nx = norm.nx - this.dragOffset.dx;
        const ny = norm.ny - this.dragOffset.dy;
        this.moveSelected(nx, ny);
      }
    }

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

    if (this.handleMode) {
      this.handleMode = null;
      this.callbacks.requestRedraw();
      return;
    }

    if (this.legendDragging) {
      this.legendDragging = false;
      this.drag.active = false;
      this.callbacks.requestRedraw();
      return;
    }

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
        // Selection persists — cleared by clicking empty space in onPointerDown
        break;
    }

    this.callbacks.requestRedraw();
  };

  private finishCircle(start: { nx: number; ny: number }, end: { nx: number; ny: number }) {
    // Compute pixel radius so the circle looks circular regardless of aspect ratio
    const pr = this.callbacks.getPlotRect();
    const dxPx = (end.nx - start.nx) * pr.w;
    const dyPx = (end.ny - start.ny) * pr.h;
    const radiusPx = Math.sqrt(dxPx * dxPx + dyPx * dyPx);
    if (radiusPx < 3) return; // too small
    const rx = radiusPx / pr.w;
    const ry = radiusPx / pr.h;
    const annotation: CircleAnnotation = {
      type: 'circle',
      cx: start.nx,
      cy: start.ny,
      rx,
      ry,
      rotation: 0,
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

  /** Draw resize/rotate handles when a circle annotation is selected. */
  drawSelectionHandles(ctx: CanvasRenderingContext2D) {
    if (!this.selected || this.selected.kind !== 'annotation') return;
    const a = this.callbacks.getAnnotations()[this.selected.index];
    if (!a || a.type !== 'circle') return;

    const handles = this.getCircleHandles(a);
    const handleSize = 5;

    ctx.save();

    // Line from top handle to rotate handle
    ctx.strokeStyle = 'rgba(0, 163, 224, 0.6)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(handles.top.x, handles.top.y);
    ctx.lineTo(handles.rotate.x, handles.rotate.y);
    ctx.stroke();

    // Resize handles — filled squares
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = 'rgba(0, 163, 224, 0.9)';
    ctx.lineWidth = 1.5;
    for (const h of [handles.right, handles.left, handles.top, handles.bottom]) {
      ctx.fillRect(h.x - handleSize, h.y - handleSize, handleSize * 2, handleSize * 2);
      ctx.strokeRect(h.x - handleSize, h.y - handleSize, handleSize * 2, handleSize * 2);
    }

    // Rotate handle — filled circle
    ctx.beginPath();
    ctx.arc(handles.rotate.x, handles.rotate.y, handleSize, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.restore();
  }
}
