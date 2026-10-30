export const ZOOMS = [0.25, 0.5, 1, 2, 4, 6, 8, 16];
export const LIMIT = 16777216;
export function validSize(w, h) {
  return (
    Number.isInteger(w) &&
    Number.isInteger(h) &&
    w > 0 &&
    h > 0 &&
    w <= 8192 &&
    h <= 8192 &&
    w * h <= LIMIT
  );
}
export function makeCanvas(w, h) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return c;
}
export function hexRGB(hex) {
  return hex.match(/[a-f\d]{2}/gi).map((v) => parseInt(v, 16));
}
export function floodFill(image, x, y, color, tolerance = 0) {
  const { width: w, height: h, data: d } = image;
  x = Math.floor(x);
  y = Math.floor(y);
  if (x < 0 || y < 0 || x >= w || y >= h) return false;
  const start = (y * w + x) * 4,
    old = Array.from(d.slice(start, start + 4)),
    next = [...hexRGB(color), 255];
  if (old.every((v, i) => v === next[i])) return false;
  const match = (p) =>
    Math.abs(d[p] - old[0]) <= tolerance &&
    Math.abs(d[p + 1] - old[1]) <= tolerance &&
    Math.abs(d[p + 2] - old[2]) <= tolerance &&
    d[p + 3] === old[3];
  // A visited bitmap makes the scanline fill safe even for near-identical colors.
  const visited = new Uint8Array(w * h),
    stack = [y * w + x];
  while (stack.length) {
    const cell = stack.pop(),
      cy = Math.floor(cell / w);
    let cx = cell % w;
    if (visited[cell] || !match(cell * 4)) continue;
    while (cx > 0 && !visited[cy * w + cx - 1] && match((cy * w + cx - 1) * 4))
      cx--;
    let up = false,
      down = false;
    for (; cx < w; cx++) {
      const n = cy * w + cx,
        p = n * 4;
      if (visited[n] || !match(p)) break;
      visited[n] = 1;
      d.set(next, p);
      if (cy > 0) {
        const ok = !visited[n - w] && match((n - w) * 4);
        if (ok && !up) stack.push(n - w);
        up = ok;
      }
      if (cy < h - 1) {
        const ok = !visited[n + w] && match((n + w) * 4);
        if (ok && !down) stack.push(n + w);
        down = ok;
      }
    }
  }
  return true;
}
export class PaintEngine {
  constructor(canvas, overlay, wrap, viewport, callbacks = {}) {
    Object.assign(this, { canvas, overlay, wrap, viewport });
    this.callbacks = {};
    this.ctx = canvas.getContext("2d", { willReadFrequently: true });
    this.ov = overlay.getContext("2d");
    this.tool = "pencil";
    this.fg = "#000000";
    this.bg = "#ffffff";
    this.size = 1;
    this.brushShape = "round";
    this.shapeMode = "outline";
    this.opaque = true;
    this.zoom = 1;
    this.grid = false;
    this.selection = null;
    this.clipboard = null;
    this.history = [];
    this.future = [];
    this.polygon = [];
    this.curve = null;
    this.ctx.fillStyle = this.bg;
    this.ctx.fillRect(0, 0, canvas.width, canvas.height);
    this.checkpoint(false);
    this.syncSize();
    overlay.addEventListener("pointerdown", (e) => this.down(e));
    overlay.addEventListener("pointermove", (e) => this.move(e));
    overlay.addEventListener("pointerup", (e) => this.up(e));
    overlay.addEventListener("pointercancel", () => this.cancelGesture());
    overlay.addEventListener("lostpointercapture", () => {
      if (this.drag) this.cancelGesture();
    });
    overlay.addEventListener("contextmenu", (e) => e.preventDefault());
    overlay.addEventListener("dblclick", () => {
      if (this.tool === "polygon") this.finishPolygon();
    });
    this.callbacks = callbacks;
  }
  get width() {
    return this.canvas.width;
  }
  get height() {
    return this.canvas.height;
  }
  emit(name, ...args) {
    this.callbacks[name]?.(...args);
  }
  image() {
    return this.ctx.getImageData(0, 0, this.width, this.height);
  }
  composite() {
    const c = makeCanvas(this.width, this.height),
      ctx = c.getContext("2d");
    ctx.drawImage(this.canvas, 0, 0);
    if (this.selection) {
      const s = this.selection;
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(this.selectionImage(), s.x, s.y, s.w, s.h);
    }
    return c;
  }
  checkpoint(notify = true) {
    const data = this.image(),
      last = this.history.at(-1);
    // Selecting and deselecting unchanged pixels is not an edit and must preserve Redo.
    if (
      last &&
      last.width === data.width &&
      last.height === data.height &&
      last.data.every((v, i) => v === data.data[i])
    )
      return;
    this.history.push(data);
    this.future = [];
    while (
      this.history.length > 2 &&
      this.history.reduce((n, x) => n + x.data.byteLength, 0) > 67108864
    )
      this.history.shift();
    if (this.history.length > 40) this.history.shift();
    if (notify) this.emit("change");
    this.emit("history");
  }
  restore(data) {
    this.canvas.width = data.width;
    this.canvas.height = data.height;
    this.ctx.putImageData(data, 0, 0);
    this.syncSize();
  }
  undo() {
    if (this.selection) {
      this.selection = null;
      this.restore(this.history.at(-1));
      this.drawOverlay();
      this.emit("selection");
      this.emit("change");
      return;
    }
    this.cancelGesture();
    if (this.history.length < 2) return;
    this.future.push(this.history.pop());
    this.restore(this.history.at(-1));
    this.emit("change");
    this.emit("history");
  }
  redo() {
    this.cancelGesture();
    this.commitSelection();
    if (!this.future.length) return;
    const d = this.future.pop();
    this.history.push(d);
    this.restore(d);
    this.emit("change");
    this.emit("history");
  }
  syncSize() {
    this.overlay.width = this.width;
    this.overlay.height = this.height;
    this.ctx.imageSmoothingEnabled = false;
    this.wrap.style.width = this.width * this.zoom + "px";
    this.wrap.style.height = this.height * this.zoom + "px";
    this.wrap.style.setProperty("--grid-size", this.zoom + "px");
    this.wrap.classList.toggle("grid", this.grid && this.zoom >= 4);
    this.emit("size", this.width, this.height);
    this.drawOverlay();
  }
  setZoom(z, anchor) {
    const old = this.zoom;
    this.zoom = Math.max(0.25, Math.min(16, z));
    if (anchor) {
      const x = (this.viewport.scrollLeft + anchor.x) / old,
        y = (this.viewport.scrollTop + anchor.y) / old;
      this.syncSize();
      this.viewport.scrollLeft = x * this.zoom - anchor.x;
      this.viewport.scrollTop = y * this.zoom - anchor.y;
    } else this.syncSize();
    this.emit("zoom", this.zoom);
  }
  setTool(t) {
    if (t !== this.tool) {
      this.finishPending();
      this.commitSelection();
      this.emit("commitText");
    }
    this.tool = t;
    this.overlay.style.cursor =
      {
        picker: "crosshair",
        text: "text",
        magnifier: "zoom-in",
        select: "crosshair",
        freeSelect: "crosshair",
      }[t] || "crosshair";
    this.emit("tool", t);
  }
  setColors(fg, bg) {
    this.fg = fg;
    this.bg = bg;
    this.drawOverlay();
    this.emit("colors");
  }
  point(e) {
    const r = this.overlay.getBoundingClientRect();
    return {
      x: Math.round((e.clientX - r.left) / this.zoom),
      y: Math.round((e.clientY - r.top) / this.zoom),
    };
  }
  inside(p) {
    return p.x >= 0 && p.y >= 0 && p.x < this.width && p.y < this.height;
  }
  down(e) {
    if (e.button > 2 || e.button === 1) return;
    e.preventDefault();
    this.emit("beforeDraw");
    const p = this.point(e);
    this.viewport.focus({ preventScroll: true });
    if (this.selection) {
      const handle = this.selectionHandle(p);
      if (handle) {
        this.drag = {
          kind: "resizeSelection",
          start: p,
          original: { ...this.selection },
          handle,
        };
        this.overlay.setPointerCapture(e.pointerId);
        return;
      }
      if (this.inSelection(p)) {
        this.drag = {
          kind: "moveSelection",
          start: p,
          x: this.selection.x,
          y: this.selection.y,
        };
        this.overlay.setPointerCapture(e.pointerId);
        return;
      }
      this.commitSelection();
    }
    if (this.tool === "text") {
      this.overlay.setPointerCapture(e.pointerId);
      this.drag = { kind: "text", start: p, last: p };
      return;
    }
    if (this.tool === "magnifier") {
      const idx = ZOOMS.findIndex((z) => z >= this.zoom);
      this.setZoom(
        ZOOMS[
          Math.max(
            0,
            Math.min(
              ZOOMS.length - 1,
              idx + (e.button === 2 || e.altKey ? -1 : 1),
            ),
          )
        ],
        {
          x: e.clientX - this.viewport.getBoundingClientRect().left,
          y: e.clientY - this.viewport.getBoundingClientRect().top,
        },
      );
      return;
    }
    if (this.tool === "picker") {
      if (this.inside(p)) {
        const d = this.ctx.getImageData(p.x, p.y, 1, 1).data;
        const color =
          "#" +
          Array.from(d.slice(0, 3))
            .map((v) => v.toString(16).padStart(2, "0"))
            .join("");
        this.setColors(
          e.button === 2 ? this.fg : color,
          e.button === 2 ? color : this.bg,
        );
        this.setTool(this.previousTool || "pencil");
      }
      return;
    }
    this.color = e.button === 2 ? this.bg : this.fg;
    this.secondary = e.button === 2 ? this.fg : this.bg;
    if (this.tool === "fill") {
      if (floodFill((this.currentImage = this.image()), p.x, p.y, this.color)) {
        this.ctx.putImageData(this.currentImage, 0, 0);
        this.checkpoint();
      }
      this.currentImage = null;
      return;
    }
    if (this.tool === "polygon") {
      if (!this.polygon.length) {
        this.polygonColor = this.color;
        this.polygonSecondary = this.secondary;
      }
      const last = this.polygon.at(-1);
      if (!last || Math.hypot(last.x - p.x, last.y - p.y) > 2) {
        this.polygon.push(p);
        this.drawPolygon(p);
      }
      return;
    }
    if (this.tool === "curve" && this.curve) {
      this.overlay.setPointerCapture(e.pointerId);
      this.drag = { kind: "curveBend", stage: this.curve.stage };
      this.curve[this.curve.stage === 1 ? "c1" : "c2"] = p;
      this.drawCurve(this.ov, p);
      return;
    }
    this.overlay.setPointerCapture(e.pointerId);
    this.drag = {
      kind: this.tool,
      start: p,
      last: p,
      button: e.button,
      points: [p],
    };
    if (["pencil", "brush", "eraser", "airbrush"].includes(this.tool)) {
      this.stroke(p, p, e.button);
      if (this.tool === "airbrush")
        this.sprayTimer = setInterval(() => {
          if (this.drag) this.spray(this.drag.last);
        }, 35);
    }
  }
  move(e) {
    const p = this.point(e);
    this.emit("position", p);
    if (this.tool === "polygon" && this.polygon.length) {
      this.drawPolygon(p);
      return;
    }
    if (this.tool === "curve" && this.curve) {
      if (this.drag?.kind === "curveBend")
        this.curve[this.drag.stage === 1 ? "c1" : "c2"] = p;
      this.drawCurve(this.ov, p);
      return;
    }
    if (!this.drag) {
      if (this.selection) {
        this.overlay.style.cursor = this.selectionHandle(p)
          ? "nwse-resize"
          : this.inSelection(p)
            ? "move"
            : "crosshair";
      }
      return;
    }
    const d = this.drag;
    if (d.kind === "moveSelection") {
      this.selection.x = Math.round(d.x + p.x - d.start.x);
      this.selection.y = Math.round(d.y + p.y - d.start.y);
      this.drawOverlay();
      this.emit("transientChange");
    } else if (d.kind === "resizeSelection") {
      const s = d.original;
      let x = s.x,
        y = s.y,
        w = s.w,
        h = s.h;
      if (d.handle.includes("e")) w = Math.max(1, s.w + p.x - d.start.x);
      if (d.handle.includes("s")) h = Math.max(1, s.h + p.y - d.start.y);
      if (d.handle.includes("w")) {
        w = Math.max(1, s.w - p.x + d.start.x);
        x = s.x + s.w - w;
      }
      if (d.handle.includes("n")) {
        h = Math.max(1, s.h - p.y + d.start.y);
        y = s.y + s.h - h;
      }
      if (e.shiftKey) h = Math.max(1, Math.round((w * s.h) / s.w));
      w = Math.min(8192, w);
      h = Math.min(8192, h);
      if (!validSize(w, h)) return;
      Object.assign(this.selection, { x, y, w, h });
      this.drawOverlay();
      this.emit("transientChange");
    } else if (["pencil", "brush", "eraser", "airbrush"].includes(d.kind))
      this.stroke(d.last, p, d.button, e.shiftKey ? d.start : null);
    else if (d.kind === "freeSelect") {
      d.points.push(p);
      this.clearOverlay();
      this.ov.strokeStyle = "#000";
      this.ov.lineWidth = 1 / this.zoom;
      this.ov.setLineDash([3 / this.zoom, 3 / this.zoom]);
      this.ov.beginPath();
      d.points.forEach((v, i) =>
        i ? this.ov.lineTo(v.x, v.y) : this.ov.moveTo(v.x, v.y),
      );
      this.ov.lineTo(d.start.x, d.start.y);
      this.ov.stroke();
      this.ov.setLineDash([]);
    } else if (d.kind === "select" || d.kind === "text") {
      this.clearOverlay();
      const r = this.rect(d.start, p, e.shiftKey);
      this.selectionBorder(r);
      this.emit("selectionSize", r.w, r.h);
    } else {
      this.clearOverlay();
      this.drawShape(this.ov, d.start, p, e.shiftKey, d.kind);
    }
    d.last = p;
  }
  up(e) {
    if (!this.drag) return;
    const d = this.drag,
      p = this.point(e);
    this.drag = null;
    clearInterval(this.sprayTimer);
    if (this.overlay.hasPointerCapture(e.pointerId))
      this.overlay.releasePointerCapture(e.pointerId);
    if (d.kind === "moveSelection" || d.kind === "resizeSelection") {
      this.drawOverlay();
      return;
    }
    this.clearOverlay();
    if (d.kind === "curveBend") {
      this.curve[d.stage === 1 ? "c1" : "c2"] = p;
      if (d.stage === 1) {
        this.curve.stage = 2;
        this.drawCurve(this.ov, p);
      } else {
        this.drawCurve(this.ctx, p);
        this.curve = null;
        this.clearOverlay();
        this.checkpoint();
      }
      return;
    }
    if (d.kind === "text") {
      const r = this.rect(d.start, p);
      this.emit(
        "text",
        r.w > 3 && r.h > 3 ? r : { ...d.start, w: 250, h: 100 },
      );
      return;
    }
    if (d.kind === "select" || d.kind === "freeSelect") {
      const points = d.kind === "freeSelect" ? d.points : null;
      const r = points
        ? this.bounds(points)
        : this.rect(d.start, p, e.shiftKey);
      if (r.w > 0 && r.h > 0) this.createSelection(r, points);
      return;
    }
    if (d.kind === "curve") {
      this.curve = {
        a: d.start,
        b: p,
        c1: null,
        c2: null,
        stage: 1,
        color: this.color,
        secondary: this.secondary,
        size: this.size,
      };
      this.drawCurve(this.ov, p);
      this.emit(
        "hint",
        "Click to set the first bend, then click again to set the second. Enter finishes.",
      );
      return;
    }
    if (!["pencil", "brush", "eraser", "airbrush"].includes(d.kind))
      this.drawShape(this.ctx, d.start, p, e.shiftKey, d.kind);
    this.checkpoint();
  }
  cancelGesture() {
    clearInterval(this.sprayTimer);
    if (
      this.drag &&
      ["pencil", "brush", "eraser", "airbrush"].includes(this.drag.kind)
    )
      this.restore(this.history.at(-1));
    this.drag = null;
    this.polygon = [];
    this.curve = null;
    this.drawOverlay();
  }
  finishPending() {
    if (this.polygon.length) this.finishPolygon();
    if (this.curve) {
      this.drawCurve(this.ctx, this.curve.c2 || this.curve.c1 || this.curve.b);
      this.curve = null;
      this.clearOverlay();
      this.checkpoint();
    }
  }
  rect(a, b, square = false) {
    let dx = b.x - a.x,
      dy = b.y - a.y;
    if (square) {
      const n = Math.max(Math.abs(dx), Math.abs(dy));
      dx = (dx < 0 ? -1 : 1) * n;
      dy = (dy < 0 ? -1 : 1) * n;
    }
    return {
      x: Math.min(a.x, a.x + dx),
      y: Math.min(a.y, a.y + dy),
      w: Math.abs(dx),
      h: Math.abs(dy),
    };
  }
  bounds(points) {
    let x = Infinity,
      y = Infinity,
      right = -Infinity,
      bottom = -Infinity;
    for (const p of points) {
      x = Math.min(x, p.x);
      y = Math.min(y, p.y);
      right = Math.max(right, p.x);
      bottom = Math.max(bottom, p.y);
    }
    return { x, y, w: right - x, h: bottom - y };
  }
  stroke(a, b, button, straight) {
    if (straight) {
      const dx = b.x - straight.x,
        dy = b.y - straight.y;
      if (Math.abs(dx) > Math.abs(dy)) {
        b = { x: b.x, y: straight.y };
        a = { x: a.x, y: straight.y };
      } else {
        b = { x: straight.x, y: b.y };
        a = { x: straight.x, y: a.y };
      }
    }
    if (this.tool === "airbrush") {
      this.spray(b);
      return;
    }
    let dx = b.x - a.x,
      dy = b.y - a.y,
      steps = Math.max(Math.abs(dx), Math.abs(dy), 1);
    const size =
      this.tool === "pencil"
        ? 1
        : this.tool === "eraser"
          ? Math.max(2, this.size)
          : this.size;
    if (this.tool === "eraser" && button === 2) {
      const r = {
        x: Math.max(0, Math.min(a.x, b.x) - size),
        y: Math.max(0, Math.min(a.y, b.y) - size),
      };
      r.w = Math.min(this.width - r.x, Math.abs(dx) + size * 2 + 1);
      r.h = Math.min(this.height - r.y, Math.abs(dy) + size * 2 + 1);
      if (r.w <= 0 || r.h <= 0) return;
      const im = this.ctx.getImageData(r.x, r.y, r.w, r.h),
        fg = hexRGB(this.fg),
        bg = hexRGB(this.bg);
      for (let t = 0; t <= steps; t++) {
        const x = Math.round(a.x + (dx * t) / steps) - r.x,
          y = Math.round(a.y + (dy * t) / steps) - r.y;
        for (
          let yy = Math.max(0, y - Math.floor(size / 2));
          yy < Math.min(r.h, y + Math.ceil(size / 2));
          yy++
        )
          for (
            let xx = Math.max(0, x - Math.floor(size / 2));
            xx < Math.min(r.w, x + Math.ceil(size / 2));
            xx++
          ) {
            const p = (yy * r.w + xx) * 4;
            if (fg.every((v, i) => im.data[p + i] === v))
              im.data.set([...bg, 255], p);
          }
      }
      this.ctx.putImageData(im, r.x, r.y);
      return;
    }
    this.ctx.fillStyle = this.tool === "eraser" ? this.bg : this.color;
    if (
      this.tool === "brush" &&
      ["oil", "crayon", "marker", "naturalPencil", "watercolor"].includes(
        this.brushShape,
      )
    ) {
      const shape = this.brushShape;
      this.ctx.save();
      this.ctx.globalAlpha = {
        oil: 0.8,
        crayon: 0.38,
        marker: 0.12,
        naturalPencil: 0.35,
        watercolor: 0.025,
      }[shape];
      for (let t = 0; t <= steps; t++) {
        const x = Math.round(a.x + (dx * t) / steps),
          y = Math.round(a.y + (dy * t) / steps);
        if (shape === "marker")
          this.ctx.fillRect(x - size / 2, y - size / 2, size, size);
        else if (shape === "oil") {
          for (let yy = -size / 2; yy < size / 2; yy++) {
            this.ctx.globalAlpha = 0.5 + (0.3 * ((yy + size) % 3)) / 3;
            this.ctx.fillRect(x - size / 2, y + yy, size, 1);
          }
        } else {
          const radius =
            shape === "naturalPencil" ? Math.max(1, size / 3) : size / 2;
          for (let yy = -Math.ceil(radius); yy <= radius; yy++)
            for (let xx = -Math.ceil(radius); xx <= radius; xx++)
              if (
                xx * xx + yy * yy <= radius * radius &&
                (shape === "watercolor" ||
                  Math.random() > (shape === "crayon" ? 0.42 : 0.2))
              )
                this.ctx.fillRect(x + xx, y + yy, 1, 1);
        }
      }
      this.ctx.restore();
      return;
    }
    for (let t = 0; t <= steps; t++) {
      const x = Math.round(a.x + (dx * t) / steps),
        y = Math.round(a.y + (dy * t) / steps);
      if (
        this.tool === "pencil" ||
        this.tool === "eraser" ||
        this.brushShape === "square"
      )
        this.ctx.fillRect(
          x - Math.floor(size / 2),
          y - Math.floor(size / 2),
          size,
          size,
        );
      else if (this.brushShape.startsWith("diagonal")) {
        this.ctx.save();
        this.ctx.translate(x, y);
        this.ctx.rotate(this.brushShape === "diagonal" ? -0.785 : 0.785);
        this.ctx.fillRect(-1, -size / 2, 2, size);
        this.ctx.restore();
      } else {
        this.ctx.beginPath();
        this.ctx.arc(x + 0.5, y + 0.5, Math.max(0.5, size / 2), 0, Math.PI * 2);
        this.ctx.fill();
      }
    }
  }
  spray(p) {
    const radius = Math.max(5, this.size * 2);
    this.ctx.fillStyle = this.color;
    for (let i = 0; i < Math.max(8, radius * 1.5); i++) {
      const angle = Math.random() * Math.PI * 2,
        r = Math.sqrt(Math.random()) * radius;
      this.ctx.fillRect(
        Math.round(p.x + Math.cos(angle) * r),
        Math.round(p.y + Math.sin(angle) * r),
        1,
        1,
      );
    }
  }
  setupShape(
    ctx,
    color = this.color,
    secondary = this.secondary,
    size = this.size,
  ) {
    ctx.strokeStyle = color || this.fg;
    ctx.fillStyle =
      this.shapeMode === "fill" ? color || this.fg : secondary || this.bg;
    ctx.lineWidth = size;
    ctx.lineJoin = "miter";
    ctx.lineCap = "square";
  }
  finishShape(ctx, open = false) {
    if (!open && this.shapeMode !== "outline") ctx.fill();
    if (this.shapeMode !== "fill" || open) ctx.stroke();
  }
  drawShape(ctx, a, b, shift, kind) {
    this.setupShape(ctx);
    const r = this.rect(a, b, shift),
      { x, y, w, h } = r;
    ctx.beginPath();
    if (kind === "line" || kind === "curve") {
      if (shift) {
        const angle =
            (Math.round(Math.atan2(b.y - a.y, b.x - a.x) / (Math.PI / 4)) *
              Math.PI) /
            4,
          len = Math.hypot(b.x - a.x, b.y - a.y);
        b = { x: a.x + Math.cos(angle) * len, y: a.y + Math.sin(angle) * len };
      }
      ctx.moveTo(a.x + 0.5, a.y + 0.5);
      ctx.lineTo(b.x + 0.5, b.y + 0.5);
      this.finishShape(ctx, true);
      return;
    }
    if (kind === "ellipse")
      ctx.ellipse(
        x + w / 2,
        y + h / 2,
        Math.max(0.1, w / 2),
        Math.max(0.1, h / 2),
        0,
        0,
        Math.PI * 2,
      );
    else if (kind === "roundRect")
      ctx.roundRect(x + 0.5, y + 0.5, w, h, Math.min(12, w / 4, h / 4));
    else if (kind === "rect") ctx.rect(x + 0.5, y + 0.5, w, h);
    else if (kind === "ovalBubble") {
      ctx.moveTo(x + w * 0.25, y + h * 0.72);
      ctx.bezierCurveTo(x - w * 0.2, y + h * 0.55, x, y, x + w * 0.5, y);
      ctx.bezierCurveTo(
        x + w * 1.2,
        y,
        x + w * 1.2,
        y + h * 0.85,
        x + w * 0.45,
        y + h * 0.8,
      );
      ctx.lineTo(x + w * 0.1, y + h);
      ctx.closePath();
    } else if (kind === "roundBubble") {
      const r = Math.min(12, w * 0.18, h * 0.18);
      ctx.moveTo(x + r, y);
      ctx.lineTo(x + w - r, y);
      ctx.quadraticCurveTo(x + w, y, x + w, y + r);
      ctx.lineTo(x + w, y + h * 0.75 - r);
      ctx.quadraticCurveTo(x + w, y + h * 0.75, x + w - r, y + h * 0.75);
      ctx.lineTo(x + w * 0.4, y + h * 0.75);
      ctx.lineTo(x + w * 0.15, y + h);
      ctx.lineTo(x + w * 0.2, y + h * 0.75);
      ctx.lineTo(x + r, y + h * 0.75);
      ctx.quadraticCurveTo(x, y + h * 0.75, x, y + h * 0.75 - r);
      ctx.lineTo(x, y + r);
      ctx.quadraticCurveTo(x, y, x + r, y);
      ctx.closePath();
    } else if (kind === "heart") {
      ctx.moveTo(x + w / 2, y + h);
      ctx.bezierCurveTo(
        x - w * 0.5,
        y + h * 0.35,
        x + w * 0.15,
        y - h * 0.35,
        x + w * 0.5,
        y + h * 0.2,
      );
      ctx.bezierCurveTo(
        x + w * 0.85,
        y - h * 0.35,
        x + w * 1.5,
        y + h * 0.35,
        x + w * 0.5,
        y + h,
      );
    } else if (kind === "cloud") {
      ctx.moveTo(x + w * 0.2, y + h * 0.85);
      ctx.bezierCurveTo(
        x - w * 0.1,
        y + h * 0.85,
        x,
        y + h * 0.2,
        x + w * 0.2,
        y + h * 0.3,
      );
      ctx.bezierCurveTo(
        x + w * 0.15,
        y - h * 0.1,
        x + w * 0.7,
        y - h * 0.1,
        x + w * 0.72,
        y + h * 0.3,
      );
      ctx.bezierCurveTo(
        x + w * 1.1,
        y + h * 0.1,
        x + w * 1.2,
        y + h * 0.9,
        x + w * 0.75,
        y + h * 0.85,
      );
      ctx.closePath();
    } else {
      let pts = {
        triangle: [
          [0.5, 0],
          [1, 1],
          [0, 1],
        ],
        rightTriangle: [
          [0, 0],
          [1, 1],
          [0, 1],
        ],
        diamond: [
          [0.5, 0],
          [1, 0.5],
          [0.5, 1],
          [0, 0.5],
        ],
        pentagon: [
          [0.5, 0],
          [1, 0.38],
          [0.81, 1],
          [0.19, 1],
          [0, 0.38],
        ],
        hexagon: [
          [0.25, 0],
          [0.75, 0],
          [1, 0.5],
          [0.75, 1],
          [0.25, 1],
          [0, 0.5],
        ],
        arrowRight: [
          [0, 0.3],
          [0.6, 0.3],
          [0.6, 0],
          [1, 0.5],
          [0.6, 1],
          [0.6, 0.7],
          [0, 0.7],
        ],
        lightning: [
          [0.65, 0],
          [0.1, 0.6],
          [0.48, 0.6],
          [0.35, 1],
          [0.9, 0.4],
          [0.52, 0.4],
        ],
        bubble: [
          [0, 0],
          [1, 0],
          [1, 0.75],
          [0.4, 0.75],
          [0.15, 1],
          [0.15, 0.75],
          [0, 0.75],
        ],
      }[kind];
      if (kind.startsWith("arrow")) {
        pts = [
          [0, 0.3],
          [0.6, 0.3],
          [0.6, 0],
          [1, 0.5],
          [0.6, 1],
          [0.6, 0.7],
          [0, 0.7],
        ];
        if (kind === "arrowLeft") pts = pts.map(([u, v]) => [1 - u, v]);
        if (kind === "arrowUp") pts = pts.map(([u, v]) => [v, 1 - u]);
        if (kind === "arrowDown") pts = pts.map(([u, v]) => [v, u]);
      }
      if (kind.startsWith("star")) {
        const n = kind === "star4" ? 4 : kind === "star6" ? 6 : 5;
        pts = Array.from({ length: n * 2 }, (_, i) => {
          const angle = -Math.PI / 2 + (i * Math.PI) / n,
            rad = i % 2 ? 0.22 : 0.5;
          return [0.5 + Math.cos(angle) * rad, 0.5 + Math.sin(angle) * rad];
        });
      }
      (
        pts || [
          [0, 0],
          [1, 0],
          [1, 1],
          [0, 1],
        ]
      ).forEach(([u, v], i) =>
        i ? ctx.lineTo(x + u * w, y + v * h) : ctx.moveTo(x + u * w, y + v * h),
      );
      ctx.closePath();
    }
    this.finishShape(ctx);
  }
  drawPolygon(p, ctx = this.ov, finish = false) {
    if (!this.polygon.length) return;
    if (ctx === this.ov) this.clearOverlay();
    this.setupShape(ctx, this.polygonColor, this.polygonSecondary);
    ctx.beginPath();
    this.polygon.forEach((v, i) =>
      i ? ctx.lineTo(v.x + 0.5, v.y + 0.5) : ctx.moveTo(v.x + 0.5, v.y + 0.5),
    );
    if (p) ctx.lineTo(p.x + 0.5, p.y + 0.5);
    if (finish) ctx.closePath();
    this.finishShape(ctx, !finish);
  }
  finishPolygon() {
    if (this.polygon.length > 1) {
      this.drawPolygon(null, this.ctx, true);
      this.checkpoint();
    }
    this.polygon = [];
    this.clearOverlay();
  }
  drawCurve(ctx, p) {
    const c = this.curve;
    if (!c) return;
    if (ctx === this.ov) this.clearOverlay();
    this.setupShape(ctx, c.color, c.secondary, c.size);
    const a = c.c1 || p,
      b = c.c2 || (c.stage === 2 ? p : a);
    ctx.beginPath();
    ctx.moveTo(c.a.x, c.a.y);
    ctx.bezierCurveTo(a.x, a.y, b.x, b.y, c.b.x, c.b.y);
    ctx.stroke();
  }
  clearOverlay() {
    this.ov.clearRect(0, 0, this.width, this.height);
  }
  selectionBorder(r) {
    const c = this.ov;
    c.save();
    c.strokeStyle = "#fff";
    c.lineWidth = 1 / this.zoom;
    c.strokeRect(r.x + 0.5 / this.zoom, r.y + 0.5 / this.zoom, r.w, r.h);
    c.strokeStyle = "#000";
    c.setLineDash([4 / this.zoom, 4 / this.zoom]);
    c.strokeRect(r.x + 0.5 / this.zoom, r.y + 0.5 / this.zoom, r.w, r.h);
    c.restore();
  }
  drawOverlay() {
    this.clearOverlay();
    const s = this.selection;
    if (!s) return;
    this.ov.imageSmoothingEnabled = false;
    this.ov.drawImage(this.selectionImage(), s.x, s.y, s.w, s.h);
    this.selectionBorder(s);
    const n = 4 / this.zoom;
    this.ov.fillStyle = "#fff";
    this.ov.strokeStyle = "#000";
    this.ov.lineWidth = 1 / this.zoom;
    for (const [x, y] of this.handlePoints(s)) {
      this.ov.fillRect(x - n / 2, y - n / 2, n, n);
      this.ov.strokeRect(x - n / 2, y - n / 2, n, n);
    }
    this.emit("selectionSize", s.w, s.h);
  }
  handlePoints(s) {
    return [
      [s.x, s.y],
      [s.x + s.w / 2, s.y],
      [s.x + s.w, s.y],
      [s.x + s.w, s.y + s.h / 2],
      [s.x + s.w, s.y + s.h],
      [s.x + s.w / 2, s.y + s.h],
      [s.x, s.y + s.h],
      [s.x, s.y + s.h / 2],
    ];
  }
  selectionHandle(p) {
    if (!this.selection) return null;
    const i = this.handlePoints(this.selection).findIndex(
      ([x, y]) =>
        Math.abs(x - p.x) <= 4 / this.zoom &&
        Math.abs(y - p.y) <= 4 / this.zoom,
    );
    return ["nw", "n", "ne", "e", "se", "s", "sw", "w"][i] || null;
  }
  inSelection(p) {
    const s = this.selection;
    return (
      s && p.x >= s.x && p.y >= s.y && p.x <= s.x + s.w && p.y <= s.y + s.h
    );
  }
  createSelection(r, points) {
    let x = Math.max(0, Math.floor(r.x)),
      y = Math.max(0, Math.floor(r.y)),
      w = Math.min(this.width, Math.ceil(r.x + r.w)) - x,
      h = Math.min(this.height, Math.ceil(r.y + r.h)) - y;
    if (w < 1 || h < 1) return;
    const image = makeCanvas(w, h),
      c = image.getContext("2d");
    c.drawImage(this.canvas, x, y, w, h, 0, 0, w, h);
    if (points) {
      c.globalCompositeOperation = "destination-in";
      c.beginPath();
      points.forEach((p, i) =>
        i ? c.lineTo(p.x - x, p.y - y) : c.moveTo(p.x - x, p.y - y),
      );
      c.closePath();
      c.fill();
      c.globalCompositeOperation = "source-over";
      this.ctx.save();
      this.ctx.beginPath();
      points.forEach((p, i) =>
        i ? this.ctx.lineTo(p.x, p.y) : this.ctx.moveTo(p.x, p.y),
      );
      this.ctx.closePath();
      this.ctx.clip();
      this.ctx.fillStyle = this.bg;
      this.ctx.fillRect(x, y, w, h);
      this.ctx.restore();
    } else {
      this.ctx.fillStyle = this.bg;
      this.ctx.fillRect(x, y, w, h);
    }
    this.selection = { x, y, w, h, image };
    this.drawOverlay();
    this.emit("selection");
  }
  selectionImage() {
    const s = this.selection;
    if (this.opaque) return s.image;
    const c = makeCanvas(s.image.width, s.image.height),
      ctx = c.getContext("2d");
    ctx.drawImage(s.image, 0, 0);
    const im = ctx.getImageData(0, 0, c.width, c.height),
      bg = hexRGB(this.bg);
    for (let i = 0; i < im.data.length; i += 4)
      if (bg.every((v, j) => im.data[i + j] === v)) im.data[i + 3] = 0;
    ctx.putImageData(im, 0, 0);
    return c;
  }
  commitSelection() {
    const s = this.selection;
    if (!s) return;
    this.ctx.imageSmoothingEnabled = false;
    this.ctx.drawImage(this.selectionImage(), s.x, s.y, s.w, s.h);
    this.selection = null;
    this.clearOverlay();
    this.checkpoint();
    this.emit("selection");
  }
  selectAll() {
    this.finishPending();
    this.emit("commitText");
    this.commitSelection();
    this.tool = "select";
    this.createSelection({ x: 0, y: 0, w: this.width, h: this.height });
    this.emit("tool", "select");
  }
  invertSelection() {
    const s = this.selection;
    if (!s) return;
    const c = this.composite(),
      ctx = c.getContext("2d");
    ctx.globalCompositeOperation = "destination-out";
    ctx.drawImage(s.image, s.x, s.y, s.w, s.h);
    ctx.globalCompositeOperation = "source-over";
    this.ctx.fillStyle = this.bg;
    this.ctx.fillRect(0, 0, this.width, this.height);
    this.ctx.drawImage(s.image, s.x, s.y, s.w, s.h);
    this.selection = { x: 0, y: 0, w: this.width, h: this.height, image: c };
    this.drawOverlay();
    this.emit("selection");
  }
  copy() {
    this.finishPending();
    this.emit("commitText");
    const s = this.selection,
      c = makeCanvas(s ? s.w : this.width, s ? s.h : this.height);
    c.getContext("2d").drawImage(
      s ? this.selectionImage() : this.canvas,
      0,
      0,
      c.width,
      c.height,
    );
    this.clipboard = c;
    return c;
  }
  cut() {
    this.copy();
    if (!this.selection) {
      this.ctx.fillStyle = this.bg;
      this.ctx.fillRect(0, 0, this.width, this.height);
    }
    this.selection = null;
    this.clearOverlay();
    this.checkpoint();
    this.emit("selection");
  }
  deleteSelection() {
    if (!this.selection) return;
    this.selection = null;
    this.clearOverlay();
    this.checkpoint();
    this.emit("selection");
  }
  paste(image) {
    const w = image.width,
      h = image.height;
    if (
      !validSize(w, h) ||
      !validSize(Math.max(w, this.width), Math.max(h, this.height))
    )
      throw Error("This image is too large to paste into the current canvas.");
    this.finishPending();
    this.emit("commitText");
    this.commitSelection();
    if (w > this.width || h > this.height)
      this.resizeCanvas(
        Math.max(w, this.width),
        Math.max(h, this.height),
        false,
      );
    const c = makeCanvas(w, h);
    c.getContext("2d").drawImage(image, 0, 0);
    this.selection = { x: 0, y: 0, w: c.width, h: c.height, image: c };
    this.tool = "select";
    this.drawOverlay();
    this.emit("tool", "select");
    this.emit("selection");
    this.emit("transientChange");
  }
  crop() {
    if (!this.selection) return;
    const s = this.selection,
      c = makeCanvas(s.w, s.h),
      ctx = c.getContext("2d");
    ctx.fillStyle = this.bg;
    ctx.fillRect(0, 0, c.width, c.height);
    ctx.drawImage(this.selectionImage(), 0, 0, c.width, c.height);
    this.selection = null;
    this.canvas.width = c.width;
    this.canvas.height = c.height;
    this.ctx.drawImage(c, 0, 0);
    this.syncSize();
    this.checkpoint();
    this.emit("selection");
  }
  resizeCanvas(w, h, record = true) {
    w = Math.round(w);
    h = Math.round(h);
    if (!validSize(w, h))
      throw Error(
        "Use dimensions from 1 to 8192 pixels, with a maximum of 16 million pixels.",
      );
    this.commitSelection();
    const old = makeCanvas(this.width, this.height);
    old.getContext("2d").drawImage(this.canvas, 0, 0);
    this.canvas.width = w;
    this.canvas.height = h;
    this.ctx.fillStyle = this.bg;
    this.ctx.fillRect(0, 0, w, h);
    this.ctx.drawImage(old, 0, 0);
    this.syncSize();
    if (record) this.checkpoint();
  }
  transform(fn) {
    this.finishPending();
    this.emit("commitText");
    if (this.selection) {
      const s = this.selection,
        src = makeCanvas(s.w, s.h);
      src.getContext("2d").drawImage(this.selectionImage(), 0, 0, s.w, s.h);
      const result = fn(src);
      if (!validSize(result.width, result.height))
        throw Error("The resulting selection is too large.");
      s.image = result;
      s.w = result.width;
      s.h = result.height;
      this.drawOverlay();
      this.emit("transientChange");
    } else {
      const result = fn(this.canvas);
      if (!validSize(result.width, result.height))
        throw Error("The resulting image is too large.");
      this.canvas.width = result.width;
      this.canvas.height = result.height;
      this.ctx.fillStyle = this.bg;
      this.ctx.fillRect(0, 0, this.width, this.height);
      this.ctx.drawImage(result, 0, 0);
      this.syncSize();
      this.checkpoint();
    }
  }
  rotate(deg) {
    this.transform((src) => {
      const swap = Math.abs(deg) % 180 === 90,
        c = makeCanvas(
          swap ? src.height : src.width,
          swap ? src.width : src.height,
        ),
        ctx = c.getContext("2d");
      ctx.translate(c.width / 2, c.height / 2);
      ctx.rotate((deg * Math.PI) / 180);
      ctx.drawImage(src, -src.width / 2, -src.height / 2);
      return c;
    });
  }
  flip(horizontal) {
    this.transform((src) => {
      const c = makeCanvas(src.width, src.height),
        ctx = c.getContext("2d");
      ctx.translate(horizontal ? c.width : 0, horizontal ? 0 : c.height);
      ctx.scale(horizontal ? -1 : 1, horizontal ? 1 : -1);
      ctx.drawImage(src, 0, 0);
      return c;
    });
  }
  resizeImage(w, h, skewX = 0, skewY = 0) {
    if (!validSize(w, h))
      throw Error(
        "Use dimensions from 1 to 8192 pixels, with a maximum of 16 million pixels.",
      );
    this.transform((src) => {
      const sx = Math.tan((skewX * Math.PI) / 180),
        sy = Math.tan((skewY * Math.PI) / 180),
        nw = Math.ceil(w + Math.abs(sx * h)),
        nh = Math.ceil(h + Math.abs(sy * w));
      if (!validSize(nw, nh)) throw Error("The resulting image is too large.");
      const c = makeCanvas(nw, nh),
        ctx = c.getContext("2d");
      if (!this.selection) {
        ctx.fillStyle = this.bg;
        ctx.fillRect(0, 0, nw, nh);
      }
      ctx.imageSmoothingEnabled = false;
      ctx.setTransform(
        1,
        sy,
        sx,
        1,
        sx < 0 ? -sx * h : 0,
        sy < 0 ? -sy * w : 0,
      );
      ctx.drawImage(src, 0, 0, w, h);
      return c;
    });
  }
  invert() {
    this.transform((src) => {
      const c = makeCanvas(src.width, src.height),
        ctx = c.getContext("2d");
      ctx.drawImage(src, 0, 0);
      const im = ctx.getImageData(0, 0, c.width, c.height);
      for (let i = 0; i < im.data.length; i += 4) {
        im.data[i] = 255 - im.data[i];
        im.data[i + 1] = 255 - im.data[i + 1];
        im.data[i + 2] = 255 - im.data[i + 2];
      }
      ctx.putImageData(im, 0, 0);
      return c;
    });
  }
  monochrome() {
    this.transform((src) => {
      const c = makeCanvas(src.width, src.height),
        ctx = c.getContext("2d");
      ctx.drawImage(src, 0, 0);
      const im = ctx.getImageData(0, 0, c.width, c.height);
      for (let i = 0; i < im.data.length; i += 4) {
        const n =
          im.data[i] * 0.299 +
            im.data[i + 1] * 0.587 +
            im.data[i + 2] * 0.114 >=
          128
            ? 255
            : 0;
        im.data[i] = im.data[i + 1] = im.data[i + 2] = n;
      }
      ctx.putImageData(im, 0, 0);
      return c;
    });
  }
  clear() {
    this.selection = null;
    this.cancelGesture();
    this.ctx.fillStyle = this.bg;
    this.ctx.fillRect(0, 0, this.width, this.height);
    this.checkpoint();
    this.emit("selection");
  }
  newImage(w = 800, h = 500) {
    if (!validSize(w, h)) throw Error("Invalid image dimensions.");
    this.selection = null;
    this.cancelGesture();
    this.canvas.width = w;
    this.canvas.height = h;
    this.ctx.fillStyle = "#ffffff";
    this.ctx.fillRect(0, 0, w, h);
    this.history = [];
    this.future = [];
    this.viewport.scrollTop = 0;
    this.viewport.scrollLeft = 0;
    this.syncSize();
    this.checkpoint(false);
    this.setZoom(1);
  }
  load(image) {
    if (!validSize(image.width, image.height))
      throw Error(
        "This image is too large. The limit is 8192 pixels per side and 16 million pixels.",
      );
    this.newImage(image.width, image.height);
    this.ctx.drawImage(image, 0, 0);
    this.history = [];
    this.checkpoint(false);
  }
  renderText(text, opts) {
    if (!text) return;
    const { x, y, width, height, font, size, bold, italic, underline, opaque } =
      opts;
    this.ctx.save();
    const f = `${italic ? "italic " : ""}${bold ? "bold " : ""}${size}px ${font}`;
    this.ctx.font = f;
    this.ctx.textBaseline = "top";
    this.ctx.fillStyle = this.bg;
    if (opaque) this.ctx.fillRect(x, y, width, height);
    this.ctx.fillStyle = this.fg;
    const lines = [];
    for (const paragraph of text.split("\n")) {
      let line = "";
      for (const char of paragraph) {
        if (line && this.ctx.measureText(line + char).width > width) {
          lines.push(line);
          line = "";
        }
        line += char;
      }
      lines.push(line);
    }
    this.ctx.beginPath();
    this.ctx.rect(x, y, width, height);
    this.ctx.clip();
    lines.forEach((line, i) => {
      const top = y + i * size * 1.2;
      this.ctx.fillText(line, x, top);
      if (underline)
        this.ctx.fillRect(
          x,
          top + size,
          this.ctx.measureText(line).width,
          Math.max(1, size / 14),
        );
    });
    this.ctx.restore();
    this.checkpoint();
  }
}
export function encodeBMP(canvas) {
  const w = canvas.width,
    h = canvas.height,
    stride = Math.ceil((w * 3) / 4) * 4,
    buffer = new ArrayBuffer(54 + stride * h),
    view = new DataView(buffer),
    data = canvas.getContext("2d").getImageData(0, 0, w, h).data;
  view.setUint16(0, 0x4d42, true);
  view.setUint32(2, buffer.byteLength, true);
  view.setUint32(10, 54, true);
  view.setUint32(14, 40, true);
  view.setInt32(18, w, true);
  view.setInt32(22, h, true);
  view.setUint16(26, 1, true);
  view.setUint16(28, 24, true);
  view.setUint32(34, stride * h, true);
  view.setInt32(38, 3780, true);
  view.setInt32(42, 3780, true);
  const out = new Uint8Array(buffer);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const p = (y * w + x) * 4,
        q = 54 + (h - 1 - y) * stride + x * 3;
      out[q] = data[p + 2];
      out[q + 1] = data[p + 1];
      out[q + 2] = data[p];
    }
  return new Blob([buffer], { type: "image/bmp" });
}
