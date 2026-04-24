/**
 * Overlay Controller for the Publish modal preview canvas.
 *
 * Handles pointer events for drawing overlays (circle, arrow, label),
 * placing zoom-inset source/target rectangles, and moving/resizing
 * selected items via drag handles.
 *
 * All coordinates are converted from canvas-pixel space to normalised 0–1
 * before updating PublishState.
 */

import type {
  Overlay,
  CircleOverlay,
  ArrowOverlay,
  LabelOverlay,
  Inset,
  NormRect,
  OverlayTool,
} from './publish-state';

interface OverlayCallbacks {
  getPlotRect(): { x: number; y: number; w: number; h: number };
  getOverlays(): Overlay[];
  getInsets(): Inset[];
  getLegendRect(): { x: number; y: number; w: number; h: number } | null;
  onOverlayAdded(overlay: Overlay): void;
  onOverlayUpdated(index: number, overlay: Overlay): void;
  onInsetAdded(inset: Inset): void;
  onInsetUpdated(index: number, inset: Inset): void;
  onSelectionChanged(type: 'overlay' | 'inset' | null, index: number): void;
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
  private selected: { kind: 'overlay' | 'inset'; index: number } | null = null;
  private dragOffset: { dx: number; dy: number } = { dx: 0, dy: 0 };
  private handleMode:
    | 'move'
    | 'resize-rx'
    | 'resize-ry'
    | 'rotate'
    | 'arrow-start'
    | 'arrow-end'
    | 'label-rotate'
    | 'inset-source-move'
    | 'inset-src-tl'
    | 'inset-src-tr'
    | 'inset-src-bl'
    | 'inset-src-br'
    | 'inset-tgt-tl'
    | 'inset-tgt-tr'
    | 'inset-tgt-bl'
    | 'inset-tgt-br'
    | null = null;
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

  private hitTestOverlay(nx: number, ny: number, a: Overlay): boolean {
    const threshold = 0.03;
    switch (a.type) {
      case 'circle': {
        // The ellipse is drawn rotated in pixel space, so we must hit-test
        // in pixel space too: convert to pixels, undo rotation around center,
        // then check distance from the unrotated ellipse boundary.
        const pr = this.callbacks.getPlotRect();
        const pxX = nx * pr.w; // click in plot-pixel coords
        const pxY = ny * pr.h;
        const cxPx = a.cx * pr.w; // centre in plot-pixel coords
        const cyPx = a.cy * pr.h;
        const rxPx = a.rx * pr.w;
        const ryPx = a.ry * pr.h;
        const rot = a.rotation || 0;
        const cos = Math.cos(-rot);
        const sin = Math.sin(-rot);
        // Rotate click into local (unrotated) frame
        const relX = pxX - cxPx;
        const relY = pxY - cyPx;
        const localX = relX * cos - relY * sin;
        const localY = relX * sin + relY * cos;
        // Normalise to unit circle and check distance from boundary
        const ux = localX / rxPx;
        const uy = localY / ryPx;
        const dist = Math.abs(Math.sqrt(ux * ux + uy * uy) - 1);
        const hitTol = threshold / Math.min(a.rx, a.ry);
        return dist < hitTol;
      }
      case 'arrow':
        return this.pointToSegmentDist(nx, ny, a.x1, a.y1, a.x2, a.y2) < threshold;
      case 'label':
        return nx >= a.x - 0.08 && nx <= a.x + 0.08 && ny >= a.y - 0.03 && ny <= a.y + 0.03;
    }
  }

  private hitTestInset(nx: number, ny: number, inset: Inset): 'target' | 'source' | null {
    const tr = inset.targetRect;
    if (nx >= tr.x && nx <= tr.x + tr.w && ny >= tr.y && ny <= tr.y + tr.h) return 'target';
    const sr = inset.sourceRect;
    if (nx >= sr.x && nx <= sr.x + sr.w && ny >= sr.y && ny <= sr.y + sr.h) return 'source';
    return null;
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
   * Compute the 4 resize handles + 1 rotate handle for a circle overlay,
   * in canvas-pixel coordinates. Returns null if not a circle.
   */
  private getCircleHandles(a: CircleOverlay): {
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
    const rect = this.canvas.getBoundingClientRect();
    const ds = this.canvas.width / rect.width;
    const rotateOffset = 30 * ds; // screen-px beyond the top handle

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
    a: CircleOverlay,
  ): 'resize-rx' | 'resize-ry' | 'rotate' | null {
    const handles = this.getCircleHandles(a);
    const rect = this.canvas.getBoundingClientRect();
    const ds = this.canvas.width / rect.width;
    const hitRadius = 8 * ds; // screen-px scaled to canvas-px

    const distSq = (hx: number, hy: number) => (pxX - hx) ** 2 + (pxY - hy) ** 2;

    if (distSq(handles.rotate.x, handles.rotate.y) < hitRadius ** 2) return 'rotate';
    if (distSq(handles.right.x, handles.right.y) < hitRadius ** 2) return 'resize-rx';
    if (distSq(handles.left.x, handles.left.y) < hitRadius ** 2) return 'resize-rx';
    if (distSq(handles.top.x, handles.top.y) < hitRadius ** 2) return 'resize-ry';
    if (distSq(handles.bottom.x, handles.bottom.y) < hitRadius ** 2) return 'resize-ry';

    return null;
  }

  /** Corner positions for a NormRect in canvas-pixel coordinates. */
  private getInsetRectCorners(r: NormRect): {
    tl: { x: number; y: number };
    tr: { x: number; y: number };
    bl: { x: number; y: number };
    br: { x: number; y: number };
  } {
    const pr = this.callbacks.getPlotRect();
    return {
      tl: { x: pr.x + r.x * pr.w, y: pr.y + r.y * pr.h },
      tr: { x: pr.x + (r.x + r.w) * pr.w, y: pr.y + r.y * pr.h },
      bl: { x: pr.x + r.x * pr.w, y: pr.y + (r.y + r.h) * pr.h },
      br: { x: pr.x + (r.x + r.w) * pr.w, y: pr.y + (r.y + r.h) * pr.h },
    };
  }

  /** Hit-test the 8 corner handles of an inset (4 on source, 4 on target). */
  private hitTestInsetHandles(pxX: number, pxY: number, inset: Inset): typeof this.handleMode {
    const rect = this.canvas.getBoundingClientRect();
    const ds = this.canvas.width / rect.width;
    const hitRadius = 8 * ds;
    const distSq = (hx: number, hy: number) => (pxX - hx) ** 2 + (pxY - hy) ** 2;
    const r2 = hitRadius ** 2;

    // Target corners (drawn on top, check first)
    const tgt = this.getInsetRectCorners(inset.targetRect);
    if (distSq(tgt.tl.x, tgt.tl.y) < r2) return 'inset-tgt-tl';
    if (distSq(tgt.tr.x, tgt.tr.y) < r2) return 'inset-tgt-tr';
    if (distSq(tgt.bl.x, tgt.bl.y) < r2) return 'inset-tgt-bl';
    if (distSq(tgt.br.x, tgt.br.y) < r2) return 'inset-tgt-br';

    // Source corners
    const src = this.getInsetRectCorners(inset.sourceRect);
    if (distSq(src.tl.x, src.tl.y) < r2) return 'inset-src-tl';
    if (distSq(src.tr.x, src.tr.y) < r2) return 'inset-src-tr';
    if (distSq(src.bl.x, src.bl.y) < r2) return 'inset-src-bl';
    if (distSq(src.br.x, src.br.y) < r2) return 'inset-src-br';

    return null;
  }

  /** Resize an inset source or target rect by dragging a corner handle. */
  private applyInsetHandleDrag() {
    if (!this.selected || this.selected.kind !== 'inset' || !this.handleMode) return;
    const insets = this.callbacks.getInsets();
    const inset = insets[this.selected.index];
    if (!inset) return;

    const norm = this.toNorm(this.drag.currentX, this.drag.currentY);
    const isSource = this.handleMode.startsWith('inset-src-');
    const rect = isSource ? inset.sourceRect : inset.targetRect;
    const corner = this.handleMode.slice(-2); // 'tl', 'tr', 'bl', 'br'

    let newRect: NormRect;
    switch (corner) {
      case 'tl':
        newRect = {
          x: norm.nx,
          y: norm.ny,
          w: rect.x + rect.w - norm.nx,
          h: rect.y + rect.h - norm.ny,
        };
        break;
      case 'tr':
        newRect = { x: rect.x, y: norm.ny, w: norm.nx - rect.x, h: rect.y + rect.h - norm.ny };
        break;
      case 'bl':
        newRect = { x: norm.nx, y: rect.y, w: rect.x + rect.w - norm.nx, h: norm.ny - rect.y };
        break;
      case 'br':
        newRect = { x: rect.x, y: rect.y, w: norm.nx - rect.x, h: norm.ny - rect.y };
        break;
      default:
        return;
    }

    // Enforce minimum size
    if (newRect.w < 0.01 || newRect.h < 0.01) return;

    const updated = isSource
      ? { ...inset, sourceRect: newRect }
      : { ...inset, targetRect: newRect };
    this.callbacks.onInsetUpdated(this.selected.index, updated);
  }

  private moveSelected(nx: number, ny: number) {
    if (!this.selected) return;

    if (this.selected.kind === 'overlay') {
      const anns = this.callbacks.getOverlays();
      const a = anns[this.selected.index];
      if (!a) return;

      let moved: Overlay;
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
      this.callbacks.onOverlayUpdated(this.selected.index, moved);
    } else {
      const insets = this.callbacks.getInsets();
      const inset = insets[this.selected.index];
      if (!inset) return;
      if (this.handleMode === 'inset-source-move') {
        const moved: Inset = {
          ...inset,
          sourceRect: { ...inset.sourceRect, x: nx, y: ny },
        };
        this.callbacks.onInsetUpdated(this.selected.index, moved);
      } else {
        const moved: Inset = {
          ...inset,
          targetRect: { ...inset.targetRect, x: nx, y: ny },
        };
        this.callbacks.onInsetUpdated(this.selected.index, moved);
      }
    }
  }

  private applyHandleDrag() {
    if (!this.selected || this.selected.kind !== 'overlay') return;
    const anns = this.callbacks.getOverlays();
    const a = anns[this.selected.index];
    if (!a) return;

    // Arrow endpoint handles
    if (
      a.type === 'arrow' &&
      (this.handleMode === 'arrow-start' || this.handleMode === 'arrow-end')
    ) {
      const norm = this.toNorm(this.drag.currentX, this.drag.currentY);
      if (this.handleMode === 'arrow-start') {
        this.callbacks.onOverlayUpdated(this.selected.index, { ...a, x1: norm.nx, y1: norm.ny });
      } else {
        this.callbacks.onOverlayUpdated(this.selected.index, { ...a, x2: norm.nx, y2: norm.ny });
      }
      return;
    }

    // Label rotate handle — rotation around the text anchor, same as circle
    if (a.type === 'label' && this.handleMode === 'label-rotate') {
      const pr = this.callbacks.getPlotRect();
      const rect = this.canvas.getBoundingClientRect();
      const scaleX = this.canvas.width / rect.width;
      const scaleY = this.canvas.height / rect.height;
      const curPxX = this.drag.currentX * scaleX;
      const curPxY = this.drag.currentY * scaleY;
      const lx = pr.x + a.x * pr.w;
      const ly = pr.y + a.y * pr.h;
      // Same formula as circle: atan2(dx, -dy) — "up" = 0, clockwise = positive
      const angle = Math.atan2(curPxX - lx, -(curPxY - ly));
      this.callbacks.onOverlayUpdated(this.selected.index, { ...a, rotation: angle });
      return;
    }

    if (a.type !== 'circle') return;

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
      this.callbacks.onOverlayUpdated(this.selected.index, { ...a, rotation: angle });
    } else if (this.handleMode === 'resize-rx') {
      // Distance from center along the rotation axis
      const rot = a.rotation || 0;
      const dx = curPxX - cxPx;
      const dy = curPxY - cyPx;
      const projectedRx = Math.abs(dx * Math.cos(rot) + dy * Math.sin(rot));
      const newRx = Math.max(0.01, projectedRx / pr.w);
      this.callbacks.onOverlayUpdated(this.selected.index, { ...a, rx: newRx });
    } else if (this.handleMode === 'resize-ry') {
      const rot = a.rotation || 0;
      const dx = curPxX - cxPx;
      const dy = curPxY - cyPx;
      const projectedRy = Math.abs(-dx * Math.sin(rot) + dy * Math.cos(rot));
      const newRy = Math.max(0.01, projectedRy / pr.h);
      this.callbacks.onOverlayUpdated(this.selected.index, { ...a, ry: newRy });
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

      // If an overlay is already selected, check its handles first
      if (this.selected?.kind === 'overlay') {
        const a = this.callbacks.getOverlays()[this.selected.index];
        if (a?.type === 'circle') {
          const mode = this.hitTestCircleHandles(pxX, pxY, a);
          if (mode) {
            this.handleMode = mode;
            return;
          }
        }
        if (a?.type === 'arrow') {
          const pr = this.callbacks.getPlotRect();
          const ds = this.canvas.width / canvasRect.width;
          const hitR = 8 * ds;
          const sx = pr.x + a.x1 * pr.w;
          const sy = pr.y + a.y1 * pr.h;
          const ex = pr.x + a.x2 * pr.w;
          const ey = pr.y + a.y2 * pr.h;
          if ((pxX - sx) ** 2 + (pxY - sy) ** 2 < hitR ** 2) {
            this.handleMode = 'arrow-start';
            return;
          }
          if ((pxX - ex) ** 2 + (pxY - ey) ** 2 < hitR ** 2) {
            this.handleMode = 'arrow-end';
            return;
          }
        }
        if (a?.type === 'label') {
          const pr = this.callbacks.getPlotRect();
          const ds = this.canvas.width / canvasRect.width;
          const hitR = 10 * ds;
          const lx = pr.x + a.x * pr.w;
          const ly = pr.y + a.y * pr.h;
          const rot = a.rotation || 0;
          const cos = Math.cos(rot);
          const sin = Math.sin(rot);
          // Handle local pos: (0, -th/2 - pad - offset) since text is centered
          const scaledFs = a.fontSize * ds;
          const th = scaledFs;
          const pad = 4 * ds;
          const handleOffset = 25 * ds;
          const hlx = 0;
          const hly = -th / 2 - pad - handleOffset;
          const hx = lx + hlx * cos - hly * sin;
          const hy = ly + hlx * sin + hly * cos;
          if ((pxX - hx) ** 2 + (pxY - hy) ** 2 < hitR ** 2) {
            this.handleMode = 'label-rotate';
            return;
          }
        }
      }

      // If an inset is already selected, check its handles first
      if (this.selected?.kind === 'inset') {
        const inset = this.callbacks.getInsets()[this.selected.index];
        if (inset) {
          const mode = this.hitTestInsetHandles(pxX, pxY, inset);
          if (mode) {
            this.handleMode = mode;
            return;
          }
          // Check source rect interior for source-move
          const sr = inset.sourceRect;
          if (
            norm.nx >= sr.x &&
            norm.nx <= sr.x + sr.w &&
            norm.ny >= sr.y &&
            norm.ny <= sr.y + sr.h
          ) {
            this.handleMode = 'inset-source-move';
            this.dragOffset = { dx: norm.nx - sr.x, dy: norm.ny - sr.y };
            return;
          }
          // Check target rect interior for target-move (keeps selection)
          const tr = inset.targetRect;
          if (
            norm.nx >= tr.x &&
            norm.nx <= tr.x + tr.w &&
            norm.ny >= tr.y &&
            norm.ny <= tr.y + tr.h
          ) {
            this.handleMode = null;
            this.dragOffset = { dx: norm.nx - tr.x, dy: norm.ny - tr.y };
            return;
          }
        }
      }

      this.handleMode = null;

      // Check insets first (drawn on top) — both source and target rects
      const insets = this.callbacks.getInsets();
      for (let i = insets.length - 1; i >= 0; i--) {
        const hit = this.hitTestInset(norm.nx, norm.ny, insets[i]);
        if (hit) {
          this.selected = { kind: 'inset', index: i };
          if (hit === 'source') {
            this.handleMode = 'inset-source-move';
            this.dragOffset = {
              dx: norm.nx - insets[i].sourceRect.x,
              dy: norm.ny - insets[i].sourceRect.y,
            };
          } else {
            this.dragOffset = {
              dx: norm.nx - insets[i].targetRect.x,
              dy: norm.ny - insets[i].targetRect.y,
            };
          }
          this.callbacks.onSelectionChanged('inset', i);
          return;
        }
      }
      // Check overlays
      const anns = this.callbacks.getOverlays();
      for (let i = anns.length - 1; i >= 0; i--) {
        if (this.hitTestOverlay(norm.nx, norm.ny, anns[i])) {
          this.selected = { kind: 'overlay', index: i };
          const a = anns[i];
          if (a.type === 'circle') {
            this.dragOffset = { dx: norm.nx - a.cx, dy: norm.ny - a.cy };
          } else if (a.type === 'arrow') {
            this.dragOffset = { dx: norm.nx - a.x1, dy: norm.ny - a.y1 };
          } else {
            this.dragOffset = { dx: norm.nx - a.x, dy: norm.ny - a.y };
          }
          this.callbacks.onSelectionChanged('overlay', i);
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
      if (this.handleMode && this.selected.kind === 'overlay') {
        this.applyHandleDrag();
      } else if (
        this.selected.kind === 'inset' &&
        this.handleMode &&
        this.handleMode !== 'inset-source-move'
      ) {
        this.applyInsetHandleDrag();
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
    const overlay: CircleOverlay = {
      type: 'circle',
      cx: start.nx,
      cy: start.ny,
      rx,
      ry,
      rotation: 0,
      color: '#000000',
      strokeWidth: 2,
    };
    this.callbacks.onOverlayAdded(overlay);
  }

  private finishArrow(start: { nx: number; ny: number }, end: { nx: number; ny: number }) {
    const dx = end.nx - start.nx;
    const dy = end.ny - start.ny;
    if (Math.sqrt(dx * dx + dy * dy) < 0.005) return;
    const overlay: ArrowOverlay = {
      type: 'arrow',
      x1: start.nx,
      y1: start.ny,
      x2: end.nx,
      y2: end.ny,
      color: '#000000',
      width: 2,
    };
    this.callbacks.onOverlayAdded(overlay);
  }

  private finishLabel(start: { nx: number; ny: number }) {
    const overlay: LabelOverlay = {
      type: 'label',
      x: start.nx,
      y: start.ny,
      text: 'Label',
      fontSize: 16,
      rotation: 0,
      color: '#000000',
    };
    this.callbacks.onOverlayAdded(overlay);
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

    const ds = this.canvas.width / (rect.width || this.canvas.width);
    ctx.save();
    ctx.strokeStyle = 'rgba(0, 163, 224, 0.8)';
    ctx.lineWidth = 1.5 * ds;
    ctx.setLineDash([4 * ds, 4 * ds]);

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

  /** Draw resize/rotate handles when an overlay or inset is selected. */
  drawSelectionHandles(ctx: CanvasRenderingContext2D, overlayScale = 1) {
    if (!this.selected) return;

    const rect = this.canvas.getBoundingClientRect();
    const ds = this.canvas.width / rect.width;
    const handleSize = 5 * ds;

    // ── Inset handles ─────────────────────────────────────
    if (this.selected.kind === 'inset') {
      const inset = this.callbacks.getInsets()[this.selected.index];
      if (!inset) return;

      ctx.save();
      ctx.fillStyle = '#ffffff';
      ctx.strokeStyle = 'rgba(0, 163, 224, 0.9)';
      ctx.lineWidth = 1.5 * ds;

      // Dashed outlines around both rects
      ctx.setLineDash([6 * ds, 4 * ds]);
      const pr = this.callbacks.getPlotRect();
      const sr = inset.sourceRect;
      const tr = inset.targetRect;
      ctx.strokeRect(pr.x + sr.x * pr.w, pr.y + sr.y * pr.h, sr.w * pr.w, sr.h * pr.h);
      ctx.strokeRect(pr.x + tr.x * pr.w, pr.y + tr.y * pr.h, tr.w * pr.w, tr.h * pr.h);
      ctx.setLineDash([]);

      // Corner handles on both rects
      for (const r of [inset.sourceRect, inset.targetRect]) {
        const corners = this.getInsetRectCorners(r);
        for (const c of [corners.tl, corners.tr, corners.bl, corners.br]) {
          ctx.fillRect(c.x - handleSize, c.y - handleSize, handleSize * 2, handleSize * 2);
          ctx.strokeRect(c.x - handleSize, c.y - handleSize, handleSize * 2, handleSize * 2);
        }
      }

      ctx.restore();
      return;
    }

    // ── Overlay handles ───────────────────────────────────
    const a = this.callbacks.getOverlays()[this.selected.index];
    if (!a) return;

    ctx.save();
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = 'rgba(0, 163, 224, 0.9)';
    ctx.lineWidth = 1.5 * ds;

    if (a.type === 'circle') {
      const handles = this.getCircleHandles(a);

      // Line from top handle to rotate handle
      ctx.strokeStyle = 'rgba(0, 163, 224, 0.6)';
      ctx.lineWidth = 1 * ds;
      ctx.beginPath();
      ctx.moveTo(handles.top.x, handles.top.y);
      ctx.lineTo(handles.rotate.x, handles.rotate.y);
      ctx.stroke();

      // Resize handles — filled squares
      ctx.fillStyle = '#ffffff';
      ctx.strokeStyle = 'rgba(0, 163, 224, 0.9)';
      ctx.lineWidth = 1.5 * ds;
      for (const h of [handles.right, handles.left, handles.top, handles.bottom]) {
        ctx.fillRect(h.x - handleSize, h.y - handleSize, handleSize * 2, handleSize * 2);
        ctx.strokeRect(h.x - handleSize, h.y - handleSize, handleSize * 2, handleSize * 2);
      }

      // Rotate handle — filled circle
      ctx.beginPath();
      ctx.arc(handles.rotate.x, handles.rotate.y, handleSize, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    } else if (a.type === 'arrow') {
      const pr = this.callbacks.getPlotRect();
      const sx = pr.x + a.x1 * pr.w;
      const sy = pr.y + a.y1 * pr.h;
      const ex = pr.x + a.x2 * pr.w;
      const ey = pr.y + a.y2 * pr.h;

      // Start handle — circle
      ctx.beginPath();
      ctx.arc(sx, sy, handleSize, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // End handle — circle
      ctx.beginPath();
      ctx.arc(ex, ey, handleSize, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    } else if (a.type === 'label') {
      const pr = this.callbacks.getPlotRect();
      const lx = pr.x + a.x * pr.w;
      const ly = pr.y + a.y * pr.h;
      const rot = a.rotation || 0;

      // Measure text at the SCALED font size to match compositor rendering
      const scaledFontSize = a.fontSize * overlayScale;
      ctx.font = `600 ${scaledFontSize}px Arial, sans-serif`;
      const tw = ctx.measureText(a.text).width;
      const th = scaledFontSize;
      const pad = 4 * ds;
      const handleOffset = 25 * ds;

      // Draw everything in local space: translate to anchor, rotate
      ctx.save();
      ctx.translate(lx, ly);
      ctx.rotate(rot);

      // Selection rectangle around text (text is centered at local 0,0)
      ctx.strokeStyle = 'rgba(0, 163, 224, 0.9)';
      ctx.lineWidth = 2 * ds;
      ctx.setLineDash([6 * ds, 4 * ds]);
      ctx.strokeRect(-tw / 2 - pad, -th / 2 - pad, tw + pad * 2, th + pad * 2);
      ctx.setLineDash([]);

      // Line from top-center of box to rotate handle
      const topCenterLocalX = 0;
      const topCenterLocalY = -th / 2 - pad;
      const handleLocalX = 0;
      const handleLocalY = -th / 2 - pad - handleOffset;

      ctx.strokeStyle = 'rgba(0, 163, 224, 0.6)';
      ctx.lineWidth = 1 * ds;
      ctx.beginPath();
      ctx.moveTo(topCenterLocalX, topCenterLocalY);
      ctx.lineTo(handleLocalX, handleLocalY);
      ctx.stroke();

      // Rotate handle — filled circle
      ctx.fillStyle = '#ffffff';
      ctx.strokeStyle = 'rgba(0, 163, 224, 0.9)';
      ctx.lineWidth = 1.5 * ds;
      ctx.beginPath();
      ctx.arc(handleLocalX, handleLocalY, handleSize, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      ctx.restore();
    }

    ctx.restore();
  }
}
