import { makeCanvas, encodeBMP, validSize, ZOOMS } from "../dist/engine.js";
import { classicTools, shapes, icon, iconNames } from "../dist/icons.js";
const frame = document.querySelector("#app"),
  list = document.querySelector("#results"),
  summary = document.querySelector("#summary");
let win,
  doc,
  e,
  passed = 0,
  failed = 0;
function assert(ok, message = "Assertion failed") {
  if (!ok) throw Error(message);
}
function equal(a, b, message = "Values differ") {
  assert(
    JSON.stringify(a) === JSON.stringify(b),
    `${message}: ${JSON.stringify(a)} / ${JSON.stringify(b)}`,
  );
}
function pixel(x, y, c = e.canvas) {
  return [...c.getContext("2d").getImageData(x, y, 1, 1).data];
}
function nonWhite(c = e.canvas) {
  const d = c.getContext("2d").getImageData(0, 0, c.width, c.height).data;
  let n = 0;
  for (let i = 0; i < d.length; i += 4)
    if (d[i] !== 255 || d[i + 1] !== 255 || d[i + 2] !== 255) n++;
  return n;
}
function reset(w = 64, h = 64) {
  doc.querySelector("#dialog").close();
  e.newImage(w, h);
  e.fg = "#000000";
  e.bg = "#ffffff";
  e.tool = "pencil";
  e.size = 1;
  e.brushShape = "round";
  e.shapeMode = "outline";
  e.opaque = true;
  e.color = e.fg;
  e.secondary = e.bg;
  e.clipboard = null;
}
function event(x, y, options = {}) {
  const r = e.overlay.getBoundingClientRect();
  return {
    clientX: r.left + x * e.zoom,
    clientY: r.top + y * e.zoom,
    button: 0,
    pointerId: 1,
    preventDefault() {},
    ...options,
  };
}
function down(x, y, options) {
  e.down(event(x, y, options));
}
function move(x, y, options) {
  e.move(event(x, y, options));
}
function up(x, y, options) {
  e.up(event(x, y, options));
}
function draw(tool, points, options = {}) {
  e.setTool(tool);
  down(...points[0], options);
  for (const p of points.slice(1)) move(...p, options);
  up(...points.at(-1), options);
}
function click(x, y, options) {
  down(x, y, options);
  up(x, y, options);
}
function input(name, value) {
  const el = doc.querySelector(`#dialog [name="${name}"]`);
  assert(el, `Missing ${name} field`);
  el.value = String(value);
  el.dispatchEvent(new Event("input", { bubbles: true }));
  return el;
}
async function submit(value = "ok") {
  const form = doc.querySelector("#dialog form"),
    button = form.querySelector(`[value="${value}"]`);
  assert(button, "Missing submit button");
  form.requestSubmit(button);
  await new Promise((r) => setTimeout(r, 30));
}
async function test(name, fn) {
  const li = document.createElement("li");
  try {
    await fn();
    passed++;
    li.className = "pass";
    li.textContent = "PASS · " + name;
  } catch (err) {
    failed++;
    li.className = "fail";
    li.textContent = "FAIL · " + name + " — " + err.message;
    console.error(name, err);
  }
  list.append(li);
  summary.textContent = `${passed} passed, ${failed} failed`;
}
document.querySelector("#run").addEventListener("click", async () => {
  document.querySelector("#run").disabled = true;
  list.replaceChildren();
  passed = failed = 0;
  win = frame.contentWindow;
  doc = frame.contentDocument;
  e = win.paint?.engine;
  if (!e) {
    summary.textContent = "App did not initialize";
    return;
  }
  // Only pointer capture is stubbed: canvas rasterization and all production handlers are real.
  e.overlay.setPointerCapture = () => {};
  e.overlay.hasPointerCapture = () => false;
  await test("Blank picture initializes white with the requested dimensions", () => {
    reset();
    equal(pixel(0, 0), [255, 255, 255, 255]);
    equal([e.width, e.height], [64, 64]);
  });
  await test("Pencil draws continuous, one-pixel strokes", () => {
    reset();
    draw("pencil", [
      [5, 5],
      [45, 5],
    ]);
    equal(pixel(20, 5), [0, 0, 0, 255]);
    equal(pixel(20, 6), [255, 255, 255, 255]);
    assert(nonWhite() === 41);
  });
  await test("Shift-constrained pencil stays on one axis", () => {
    reset();
    draw(
      "pencil",
      [
        [5, 5],
        [15, 7],
        [30, 8],
      ],
      { shiftKey: true },
    );
    equal(pixel(25, 5), [0, 0, 0, 255]);
    equal(pixel(25, 7), [255, 255, 255, 255]);
  });
  await test("Right-button drawing uses the background color", () => {
    reset();
    e.bg = "#ff0000";
    draw(
      "pencil",
      [
        [5, 5],
        [25, 5],
      ],
      { button: 2 },
    );
    equal(pixel(10, 5), [255, 0, 0, 255]);
  });
  for (const shape of [
    "round",
    "square",
    "diagonal",
    "diagonalBack",
    "oil",
    "crayon",
    "marker",
    "naturalPencil",
    "watercolor",
  ])
    await test(`${shape} brush paints a stroke`, () => {
      reset();
      e.brushShape = shape;
      e.size = 6;
      draw("brush", [
        [8, 8],
        [30, 30],
      ]);
      assert(nonWhite() > 60);
    });
  await test("Eraser replaces pixels with the background color", () => {
    reset();
    e.ctx.fillStyle = "#000";
    e.ctx.fillRect(0, 0, 64, 64);
    e.checkpoint();
    e.size = 8;
    draw("eraser", [
      [8, 8],
      [30, 8],
    ]);
    equal(pixel(20, 8), [255, 255, 255, 255]);
    equal(pixel(20, 20), [0, 0, 0, 255]);
  });
  await test("Color eraser changes only foreground-colored pixels", () => {
    reset();
    e.ctx.fillStyle = "#000";
    e.ctx.fillRect(0, 0, 32, 32);
    e.ctx.fillStyle = "#ff0000";
    e.ctx.fillRect(32, 0, 32, 32);
    e.checkpoint();
    e.size = 8;
    draw(
      "eraser",
      [
        [8, 8],
        [50, 8],
      ],
      { button: 2 },
    );
    equal(pixel(20, 8), [255, 255, 255, 255]);
    equal(pixel(40, 8), [255, 0, 0, 255]);
  });
  await test("Airbrush deposits scattered pixels and stops on release", () => {
    reset();
    e.size = 8;
    draw("airbrush", [
      [25, 25],
      [28, 28],
    ]);
    const n = nonWhite();
    assert(n > 4);
    assert(e.drag === null);
  });
  await test("Flood fill respects closed boundaries and background", () => {
    reset();
    e.ctx.strokeStyle = "#000";
    e.ctx.strokeRect(10.5, 10.5, 30, 30);
    e.checkpoint();
    e.fg = "#ff0000";
    e.setTool("fill");
    click(20, 20);
    equal(pixel(20, 20), [255, 0, 0, 255]);
    equal(pixel(5, 5), [255, 255, 255, 255]);
    equal(pixel(10, 20), [0, 0, 0, 255]);
  });
  await test("Filling an unchanged area creates no extra undo step", () => {
    reset();
    e.fg = "#ffffff";
    e.setTool("fill");
    click(20, 20);
    equal(e.history.length, 1);
  });
  await test("Color picker samples the image and restores the previous tool", () => {
    reset();
    e.ctx.fillStyle = "#123456";
    e.ctx.fillRect(10, 10, 5, 5);
    e.previousTool = "brush";
    e.setTool("picker");
    click(12, 12);
    equal(e.fg, "#123456");
    equal(e.tool, "brush");
  });
  await test("Magnifier zooms in and out without changing pixels", () => {
    reset();
    e.setTool("magnifier");
    click(20, 20);
    equal(e.zoom, 2);
    click(20, 20, { button: 2 });
    equal(e.zoom, 1);
    equal(nonWhite(), 0);
  });
  for (const kind of shapes.filter((k) => !["curve", "polygon"].includes(k)))
    await test(`${kind} shape renders within a normal picture`, () => {
      reset();
      draw(kind, [
        [10, 10],
        [50, 50],
      ]);
      assert(nonWhite() > 10);
    });
  await test("Outline, outline-and-fill, and solid-fill modes use the correct colors", () => {
    for (const mode of ["outline", "both", "fill"]) {
      reset();
      e.fg = "#ff0000";
      e.bg = "#0000ff";
      e.shapeMode = mode;
      draw("rect", [
        [10, 10],
        [40, 40],
      ]);
      equal(
        pixel(20, 20),
        mode === "outline"
          ? [255, 255, 255, 255]
          : mode === "both"
            ? [0, 0, 255, 255]
            : [255, 0, 0, 255],
      );
    }
  });
  await test("Shift constrains a rectangle to a square", () => {
    reset();
    draw(
      "rect",
      [
        [10, 10],
        [40, 30],
      ],
      { shiftKey: true },
    );
    equal(pixel(40, 39), [0, 0, 0, 255]);
  });
  await test("Polygon closes and commits a filled shape", () => {
    reset();
    e.shapeMode = "fill";
    e.setTool("polygon");
    click(10, 10);
    click(50, 10);
    click(30, 50);
    e.finishPolygon();
    equal(pixel(30, 20), [0, 0, 0, 255]);
    equal(e.polygon.length, 0);
    equal(e.history.length, 2);
  });
  await test("Curve accepts two bends then commits one undoable edit", () => {
    reset();
    draw("curve", [
      [5, 32],
      [58, 32],
    ]);
    assert(e.curve?.stage === 1);
    click(20, 5);
    assert(e.curve?.stage === 2);
    click(45, 58);
    equal(e.curve, null);
    assert(nonWhite() > 30);
    equal(e.history.length, 2);
  });
  await test("Curve bend handles also accept click-and-drag gestures", () => {
    reset();
    draw("curve", [
      [5, 32],
      [58, 32],
    ]);
    down(20, 20);
    move(20, 5);
    up(20, 5);
    equal(e.curve.c1, { x: 20, y: 5 });
    down(40, 40);
    move(45, 58);
    up(45, 58);
    equal(e.curve, null);
    assert(nonWhite() > 30);
  });
  await test("Escape/cancel discards an unfinished curve", () => {
    reset();
    draw("curve", [
      [5, 32],
      [58, 32],
    ]);
    e.cancelGesture();
    equal(nonWhite(), 0);
    equal(e.curve, null);
  });
  await test("Rectangular selection can move and commit without duplicating its source", () => {
    reset();
    e.ctx.fillStyle = "#f00";
    e.ctx.fillRect(10, 10, 10, 10);
    e.checkpoint();
    draw("select", [
      [8, 8],
      [23, 23],
    ]);
    assert(e.selection);
    down(15, 15);
    move(35, 35);
    up(35, 35);
    e.commitSelection();
    equal(pixel(12, 12), [255, 255, 255, 255]);
    equal(pixel(32, 32), [255, 0, 0, 255]);
  });
  await test("Selection resize changes its dimensions with pixel-preserving scaling", () => {
    reset();
    e.ctx.fillStyle = "#f00";
    e.ctx.fillRect(10, 10, 10, 10);
    e.checkpoint();
    draw("select", [
      [10, 10],
      [20, 20],
    ]);
    down(20, 20);
    move(30, 30);
    up(30, 30);
    equal([e.selection.w, e.selection.h], [20, 20]);
    e.commitSelection();
    equal(pixel(28, 28), [255, 0, 0, 255]);
  });
  await test("Free-form selection preserves unselected corner pixels", () => {
    reset();
    e.ctx.fillStyle = "#f00";
    e.ctx.fillRect(0, 0, 64, 64);
    e.checkpoint();
    draw("freeSelect", [
      [10, 10],
      [40, 10],
      [10, 40],
      [10, 10],
    ]);
    assert(e.selection);
    equal(pixel(35, 35), [255, 0, 0, 255]);
    equal(pixel(15, 15), [255, 255, 255, 255]);
  });
  await test("Transparent selection keys out only the background color", () => {
    reset();
    e.ctx.fillStyle = "#f00";
    e.ctx.fillRect(10, 10, 10, 10);
    e.checkpoint();
    e.createSelection({ x: 5, y: 5, w: 20, h: 20 });
    e.opaque = false;
    const c = e.selectionImage();
    equal(pixel(0, 0, c)[3], 0);
    equal(pixel(8, 8, c), [255, 0, 0, 255]);
  });
  await test("Recovery composite includes floating selection pixels", () => {
    reset();
    e.ctx.fillStyle = "#f00";
    e.ctx.fillRect(10, 10, 10, 10);
    e.checkpoint();
    e.createSelection({ x: 10, y: 10, w: 10, h: 10 });
    e.selection.x = 30;
    equal(pixel(35, 15, e.composite()), [255, 0, 0, 255]);
    equal(pixel(15, 15, e.composite()), [255, 255, 255, 255]);
  });
  await test("Invert selection selects the complementary pixels without changing the picture", () => {
    reset();
    e.ctx.fillStyle = "#f00";
    e.ctx.fillRect(10, 10, 10, 10);
    e.checkpoint();
    e.createSelection({ x: 10, y: 10, w: 10, h: 10 });
    e.invertSelection();
    equal(pixel(15, 15, e.selection.image)[3], 0);
    equal(pixel(15, 15), [255, 0, 0, 255]);
    e.commitSelection();
    equal(pixel(15, 15), [255, 0, 0, 255]);
    equal(pixel(30, 30), [255, 255, 255, 255]);
  });
  await test("Deselecting unchanged pixels preserves Redo and does not add history", () => {
    reset();
    draw("pencil", [
      [5, 5],
      [20, 5],
    ]);
    e.undo();
    e.createSelection({ x: 0, y: 0, w: 30, h: 30 });
    e.commitSelection();
    equal(e.future.length, 1);
    equal(e.history.length, 1);
    e.redo();
    equal(pixel(10, 5), [0, 0, 0, 255]);
  });
  await test("Cut, paste, and Delete operate on the selected pixels", () => {
    reset();
    e.ctx.fillStyle = "#f00";
    e.ctx.fillRect(10, 10, 10, 10);
    e.checkpoint();
    e.createSelection({ x: 10, y: 10, w: 10, h: 10 });
    e.cut();
    equal(pixel(15, 15), [255, 255, 255, 255]);
    e.paste(e.clipboard);
    e.selection.x = 30;
    e.commitSelection();
    equal(pixel(35, 5), [255, 0, 0, 255]);
    e.createSelection({ x: 30, y: 0, w: 10, h: 10 });
    e.deleteSelection();
    equal(pixel(35, 5), [255, 255, 255, 255]);
  });
  await test("Crop creates a picture with precisely the selection dimensions", () => {
    reset();
    e.ctx.fillStyle = "#f00";
    e.ctx.fillRect(10, 10, 10, 20);
    e.checkpoint();
    e.createSelection({ x: 10, y: 10, w: 10, h: 20 });
    e.crop();
    equal([e.width, e.height], [10, 20]);
    equal(pixel(5, 5), [255, 0, 0, 255]);
  });
  await test("Undo and Redo restore pixels and dimensions across canvas resizing", () => {
    reset();
    draw("pencil", [
      [5, 5],
      [20, 5],
    ]);
    e.resizeCanvas(80, 70);
    e.undo();
    equal([e.width, e.height], [64, 64]);
    equal(pixel(10, 5), [0, 0, 0, 255]);
    e.redo();
    equal([e.width, e.height], [80, 70]);
  });
  await test("90°, 180°, and 270° rotations preserve colored corners", () => {
    for (const deg of [90, 180, 270]) {
      reset(40, 20);
      e.ctx.fillStyle = "#f00";
      e.ctx.fillRect(0, 0, 10, 10);
      e.checkpoint();
      e.rotate(deg);
      equal([e.width, e.height], deg === 180 ? [40, 20] : [20, 40]);
      const p = deg === 90 ? [15, 5] : deg === 180 ? [35, 15] : [5, 35];
      equal(pixel(...p), [255, 0, 0, 255]);
    }
  });
  await test("Horizontal and vertical flips place pixels in the opposite corner", () => {
    for (const horizontal of [true, false]) {
      reset();
      e.ctx.fillStyle = "#f00";
      e.ctx.fillRect(0, 0, 10, 10);
      e.checkpoint();
      e.flip(horizontal);
      equal(pixel(horizontal ? 60 : 5, horizontal ? 5 : 60), [255, 0, 0, 255]);
    }
  });
  await test("Image resizing scales content and skew expands the destination", () => {
    reset();
    e.ctx.fillStyle = "#f00";
    e.ctx.fillRect(0, 0, 32, 32);
    e.checkpoint();
    e.resizeImage(128, 64);
    equal(pixel(60, 20), [255, 0, 0, 255]);
    e.resizeImage(128, 64, 20, 0);
    assert(e.width > 128);
    equal(e.height, 64);
  });
  await test("Transforms apply only to an active selection", () => {
    reset();
    e.ctx.fillStyle = "#f00";
    e.ctx.fillRect(10, 10, 10, 20);
    e.checkpoint();
    e.createSelection({ x: 10, y: 10, w: 10, h: 20 });
    e.rotate(90);
    equal([e.width, e.height], [64, 64]);
    equal([e.selection.w, e.selection.h], [20, 10]);
  });
  await test("Invert and monochrome conversion produce the expected pixels", () => {
    reset();
    e.ctx.fillStyle = "#f00";
    e.ctx.fillRect(0, 0, 10, 10);
    e.checkpoint();
    e.invert();
    equal(pixel(5, 5), [0, 255, 255, 255]);
    e.monochrome();
    equal(pixel(5, 5), [255, 255, 255, 255]);
    equal(pixel(30, 30), [0, 0, 0, 255]);
  });
  await test("Text tool accepts a dragged box and commits styled text", () => {
    reset();
    draw("text", [
      [5, 5],
      [55, 35],
    ]);
    const textarea = doc.querySelector("#text-editor");
    assert(textarea.style.display === "block");
    equal(Math.round(textarea.offsetWidth / e.zoom), 50);
    textarea.value = "Paint";
    win.paint.action("selectTool");
    assert(nonWhite() > 10);
    equal(textarea.style.display, "none");
  });
  await test("Zoom keeps a draft text box anchored to its image coordinates", () => {
    reset();
    draw("text", [
      [5, 5],
      [55, 35],
    ]);
    const textarea = doc.querySelector("#text-editor");
    textarea.value = "Paint";
    e.setZoom(2);
    equal(textarea.style.left, "10px");
    equal(textarea.style.top, "10px");
    equal(textarea.offsetWidth, 100);
    win.paint.action("selectTool");
    assert(nonWhite() > 10);
  });
  await test("All zoom levels update the display without changing bitmap dimensions", () => {
    reset();
    for (const z of ZOOMS) {
      e.setZoom(z);
      equal([e.width, e.height], [64, 64]);
      equal(e.wrap.style.width, 64 * z + "px");
    }
    e.setZoom(0.25);
    equal(doc.querySelector("#zoom-slider").value, "0");
  });
  await test("Pixel grid is shown only when enabled and sufficiently zoomed in", () => {
    reset();
    e.grid = true;
    e.setZoom(1);
    assert(!e.wrap.classList.contains("grid"));
    e.setZoom(4);
    assert(e.wrap.classList.contains("grid"));
  });
  await test("BMP export contains a valid 24-bit header, padded rows, and BGR pixels", async () => {
    reset(3, 2);
    e.ctx.fillStyle = "#f00";
    e.ctx.fillRect(0, 1, 1, 1);
    const blob = encodeBMP(e.canvas),
      v = new DataView(await blob.arrayBuffer());
    equal(v.getUint16(0, true), 0x4d42);
    equal(v.getUint16(28, true), 24);
    equal(v.getUint32(2, true), 78);
    equal([v.getUint8(54), v.getUint8(55), v.getUint8(56)], [0, 0, 255]);
  });
  for (const type of ["image/png", "image/jpeg"])
    await test(`${type} export decodes back into a picture`, async () => {
      reset();
      draw("pencil", [
        [5, 5],
        [30, 30],
      ]);
      const blob = await new Promise((r) => e.canvas.toBlob(r, type));
      const im = await createImageBitmap(blob);
      equal([im.width, im.height], [64, 64]);
      assert(blob.size > 50);
      im.close();
    });
  await test("Opening an image resets history and preserves image content", () => {
    reset();
    const c = makeCanvas(20, 10),
      ctx = c.getContext("2d");
    ctx.fillStyle = "#f00";
    ctx.fillRect(0, 0, 20, 10);
    e.load(c);
    equal([e.width, e.height], [20, 10]);
    equal(pixel(5, 5), [255, 0, 0, 255]);
    equal(e.history.length, 1);
  });
  await test("Oversize and invalid image dimensions are rejected before allocation", () => {
    for (const dims of [
      [0, 1],
      [-1, 10],
      [1.5, 3],
      [8193, 1],
      [8192, 8192],
    ])
      assert(!validSize(...dims));
    let threw = false;
    try {
      e.resizeCanvas(8193, 2);
    } catch {
      threw = true;
    }
    assert(threw);
  });
  for (const theme of ["98", "xp", "7"])
    await test(`${theme}: switching appearances preserves image and history`, () => {
      reset();
      draw("pencil", [
        [5, 5],
        [25, 5],
      ]);
      const n = e.history.length;
      win.paint.setTheme(theme);
      equal(pixel(10, 5), [0, 0, 0, 255]);
      equal(e.history.length, n);
      equal(doc.body.dataset.theme, theme);
      const ribbon = doc.querySelector("#ribbon");
      equal(win.getComputedStyle(ribbon).display === "none", theme !== "7");
      if (theme === "7")
        assert(doc.querySelectorAll("#ribbon [data-tool]").length > 20);
      else equal(doc.querySelectorAll("#tools [data-tool]").length, 16);
    });
  await test("All classic tools and ribbon commands have nonempty icon artwork", () => {
    for (const t of [...classicTools, ...shapes, ...iconNames])
      for (const theme of ["98", "xp", "7"]) {
        const svg = icon(t, theme);
        assert(
          svg.includes("<path") ||
            svg.includes("<rect") ||
            svg.includes("<circle") ||
            svg.includes("<ellipse"),
          `${theme}/${t}`,
        );
      }
    for (const t of classicTools)
      assert(icon(t, "98").includes("crispEdges"), t);
  });
  await test("Attributes dialog changes canvas dimensions using pixels", async () => {
    reset();
    await win.paint.action("attributes");
    input("width", 90);
    input("height", 70);
    await submit();
    equal([e.width, e.height], [90, 70]);
    assert(!doc.querySelector("#dialog").open);
  });
  await test("Attributes converts centimeters and inches consistently", async () => {
    reset(96, 96);
    await win.paint.action("attributes");
    const units = doc.querySelector("[name=units][value=in]");
    units.checked = true;
    units.dispatchEvent(new Event("change"));
    equal(doc.querySelector("[name=width]").value, "1");
    input("width", 2);
    input("height", 1);
    await submit();
    equal([e.width, e.height], [192, 96]);
  });
  await test("Resize dialog supports independent axes and preserves aspect ratio when requested", async () => {
    reset(80, 40);
    await win.paint.action("resize");
    input("horizontal", 50);
    equal(doc.querySelector("[name=vertical]").value, "50");
    doc.querySelector("[name=aspect]").checked = false;
    input("vertical", 100);
    await submit();
    equal([e.width, e.height], [40, 40]);
  });
  await test("Flip/Rotate dialog applies its selected operation", async () => {
    reset(80, 40);
    await win.paint.action("flip");
    doc.querySelector('[name=transform][value="90"]').checked = true;
    await submit();
    equal([e.width, e.height], [40, 80]);
  });
  await test("Edit Colors synchronizes RGB, hex, and foreground color", async () => {
    reset();
    await win.paint.action("colors");
    input("Red", 18);
    input("Green", 52);
    input("Blue", 86);
    equal(doc.querySelector("#color-hex").value, "#123456");
    await submit();
    equal(e.fg, "#123456");
  });
  await test("Edit Colors synchronizes HSL and custom palette slots", async () => {
    reset();
    await win.paint.action("colors");
    input("Hue", 0);
    input("Sat", 240);
    input("Lum", 120);
    equal(doc.querySelector("#color-hex").value, "#ff0000");
    doc.querySelector("#add-custom").click();
    assert(
      [...doc.querySelectorAll("#custom-colors button")].some(
        (b) => b.dataset.pick === "#ff0000",
      ),
    );
    await submit();
    equal(e.fg, "#ff0000");
  });
  await test("Windows 7 selection menu exposes free-form select and transparency", async () => {
    reset();
    win.paint.setTheme("7");
    doc.querySelector("[data-menu=Selection]").click();
    const menu = doc.querySelector(".dropdown");
    assert(menu);
    menu.querySelector("[data-action=freeSelectTool]").click();
    equal(e.tool, "freeSelect");
    doc.querySelector("[data-menu=Selection]").click();
    doc.querySelector(".dropdown [data-action=opaque]").click();
    equal(e.opaque, false);
  });
  await test("Windows 7 brush menu exposes nine working brush variants", async () => {
    reset();
    win.paint.setTheme("7");
    doc.querySelector("[data-action=brushMenu]").click();
    const menu = doc.querySelector(".dropdown");
    assert(menu);
    equal(menu.querySelectorAll("button").length, 9);
    menu.querySelector('[data-action="brush:watercolor"]').click();
    equal(e.tool, "brush");
    equal(e.brushShape, "watercolor");
  });
  await test("Color spectrum and luminosity controls support keyboard adjustment", async () => {
    reset();
    await win.paint.action("colors");
    const hue = Number(doc.querySelector("[name=Hue]").value);
    doc.querySelector("#color-map").dispatchEvent(
      new win.KeyboardEvent("keydown", {
        key: "ArrowRight",
        bubbles: true,
        cancelable: true,
      }),
    );
    equal(
      Number(doc.querySelector("[name=Hue]").value),
      Math.min(239, hue + 1),
    );
    doc.querySelector("#lum-map").dispatchEvent(
      new win.KeyboardEvent("keydown", {
        key: "ArrowUp",
        bubbles: true,
        cancelable: true,
      }),
    );
    assert(Number(doc.querySelector("[name=Lum]").value) > 0);
    doc.querySelector("#dialog").close();
  });
  await test("Windows 7 View ribbon switches tabs and its controls update the app", async () => {
    reset();
    win.paint.setTheme("7");
    doc.querySelector("#menubar [data-menu=View]").click();
    const zoom = doc.querySelector("#ribbon [data-action=zoomIn]");
    assert(zoom);
    zoom.click();
    equal(e.zoom, 2);
    assert(doc.querySelector("#ribbon [data-toggle=grid]"));
    doc.querySelector("#menubar [data-menu=Home]").click();
    assert(doc.querySelector("#ribbon [data-menu=Selection]"));
  });
  await test("Custom Zoom dialog applies its chosen magnification", async () => {
    reset();
    await win.paint.action("zoom");
    doc.querySelector('[name=zoom][value="25"]').checked = true;
    await submit();
    equal(e.zoom, 0.25);
  });
  for (const act of [
    "pageSetup",
    "preview",
    "bitmap",
    "help",
    "shortcuts",
    "about",
    "scanner",
    "wallpaper",
    "install",
  ])
    await test(`${act}: dialog opens with usable content and a close button`, async () => {
      reset();
      await win.paint.action(act);
      const dialog = doc.querySelector("#dialog");
      assert(dialog.open);
      assert(dialog.textContent.trim().length > 20);
      assert(dialog.querySelector("[data-close-dialog]"));
      dialog.querySelector("[data-close-dialog]").click();
      assert(!dialog.open);
    });
  await test("View toggles toolbox, palette, status bar, and thumbnail", async () => {
    reset();
    win.paint.setTheme("98");
    for (const [cmd, id] of [
      ["toggleTools", "toolbox"],
      ["toggleColors", "colorbox"],
      ["toggleStatus", "statusbar"],
    ]) {
      await win.paint.action(cmd);
      equal(win.getComputedStyle(doc.getElementById(id)).display, "none");
      await win.paint.action(cmd);
      assert(win.getComputedStyle(doc.getElementById(id)).display !== "none");
    }
    await win.paint.action("thumbnail");
    assert(doc.querySelector("#close-thumbnail"));
    await win.paint.action("thumbnail");
    assert(!doc.querySelector("#close-thumbnail"));
  });
  await test("New picture prompts before discarding work and Cancel keeps the picture", async () => {
    reset();
    draw("pencil", [
      [5, 5],
      [20, 5],
    ]);
    await win.paint.action("new");
    assert(doc.querySelector("#dialog").open);
    assert(doc.querySelector("#dialog").textContent.includes("save changes"));
    doc.querySelector("#dialog [data-close-dialog]").click();
    equal(pixel(10, 5), [0, 0, 0, 255]);
    equal(e.width, 64);
  });
  await test("Discard changes starts a blank picture", async () => {
    reset();
    draw("pencil", [
      [5, 5],
      [20, 5],
    ]);
    await win.paint.action("new");
    await submit("discard");
    equal([e.width, e.height], [800, 500]);
    equal(nonWhite(), 0);
  });
  await test("Save As exports all three formats with the chosen filename and correct blob type", async () => {
    const originalPicker = win.showSaveFilePicker,
      originalClick = win.HTMLAnchorElement.prototype.click,
      links = [];
    win.showSaveFilePicker = undefined;
    win.HTMLAnchorElement.prototype.click = function () {
      links.push({ name: this.download, url: this.href });
    };
    try {
      for (const [type, mime] of [
        ["png", "image/png"],
        ["jpg", "image/jpeg"],
        ["bmp", "image/bmp"],
      ]) {
        reset();
        draw("pencil", [
          [5, 5],
          [20, 5],
        ]);
        const pending = win.paint.action("saveas");
        assert(doc.querySelector("#dialog").open);
        input("filename", "Test image");
        input("type", type);
        await submit("save");
        await pending;
        const link = links.at(-1);
        equal(link.name, "Test image." + type);
        const blob = await (await fetch(link.url)).blob();
        equal(blob.type, mime);
        assert(blob.size > 50);
      }
    } finally {
      win.showSaveFilePicker = originalPicker;
      win.HTMLAnchorElement.prototype.click = originalClick;
    }
  });
  await test("Save followed by New completes the nested fallback Save As flow", async () => {
    const originalPicker = win.showSaveFilePicker,
      originalClick = win.HTMLAnchorElement.prototype.click;
    win.showSaveFilePicker = undefined;
    win.HTMLAnchorElement.prototype.click = function () {};
    try {
      reset();
      draw("pencil", [
        [5, 5],
        [20, 5],
      ]);
      await win.paint.action("new");
      await submit("save");
      equal(doc.querySelector("#dialog-title").textContent, "Save As");
      input("filename", "Before new");
      await submit("save");
      await new Promise((r) => setTimeout(r, 50));
      equal([e.width, e.height], [800, 500]);
      equal(nonWhite(), 0);
    } finally {
      win.showSaveFilePicker = originalPicker;
      win.HTMLAnchorElement.prototype.click = originalClick;
    }
  });
  await test("Canceling the nested Save As dialog keeps the original picture", async () => {
    const originalPicker = win.showSaveFilePicker;
    win.showSaveFilePicker = undefined;
    try {
      reset();
      draw("pencil", [
        [5, 5],
        [20, 5],
      ]);
      await win.paint.action("new");
      await submit("save");
      assert(doc.querySelector("#dialog").open);
      doc.querySelector("#dialog [data-close-dialog]").click();
      await new Promise((r) => setTimeout(r, 30));
      equal([e.width, e.height], [64, 64]);
      equal(pixel(10, 5), [0, 0, 0, 255]);
    } finally {
      win.showSaveFilePicker = originalPicker;
    }
  });
  await test("Keyboard Undo/Redo and text bold shortcut dispatch correctly", async () => {
    reset();
    draw("pencil", [
      [5, 5],
      [20, 5],
    ]);
    doc.querySelector("#viewport").dispatchEvent(
      new win.KeyboardEvent("keydown", {
        key: "z",
        ctrlKey: true,
        bubbles: true,
        cancelable: true,
      }),
    );
    equal(pixel(10, 5), [255, 255, 255, 255]);
    doc.querySelector("#viewport").dispatchEvent(
      new win.KeyboardEvent("keydown", {
        key: "y",
        ctrlKey: true,
        bubbles: true,
        cancelable: true,
      }),
    );
    equal(pixel(10, 5), [0, 0, 0, 255]);
    draw("text", [
      [5, 15],
      [60, 55],
    ]);
    const textarea = doc.querySelector("#text-editor");
    textarea.dispatchEvent(
      new win.KeyboardEvent("keydown", {
        key: "b",
        ctrlKey: true,
        bubbles: true,
        cancelable: true,
      }),
    );
    assert(textarea.style.font.includes("bold"));
    textarea.value = "Text";
    win.paint.action("selectTool");
  });
  await test("Drawing, moving selection, and draft text schedule recovery without losing selected pixels", async () => {
    reset();
    draw("pencil", [
      [5, 5],
      [20, 5],
    ]);
    e.createSelection({ x: 4, y: 4, w: 20, h: 10 });
    e.selection.x = 30;
    e.emit("transientChange");
    await new Promise((r) => setTimeout(r, 850));
    const record = JSON.parse(win.localStorage.getItem("paint-recovery"));
    assert(record?.data);
    const im = await createImageBitmap(await (await fetch(record.data)).blob()),
      c = makeCanvas(im.width, im.height);
    c.getContext("2d").drawImage(im, 0, 0);
    equal(pixel(35, 5, c), [0, 0, 0, 255]);
  });
  await test("All static offline assets exist and load successfully", async () => {
    for (const path of [
      "index.html",
      "app.js",
      "engine.js",
      "icons.js",
      "style.css",
      "icon.svg",
      "icon-192.png",
      "icon-512.png",
      "manifest.webmanifest",
      "sw.js",
    ])
      assert((await fetch("../dist/" + path)).ok, path);
  });
  for (const theme of ["98", "xp", "7"])
    for (const [width, height] of [
      [360, 600],
      [640, 480],
      [1024, 768],
      [1440, 900],
    ])
      await test(`${theme}: ${width} × ${height} layout keeps workspace, controls, and dialogs reachable`, async () => {
        reset();
        frame.style.width = width + "px";
        frame.style.height = height + "px";
        win.paint.setTheme(theme);
        await new Promise((r) =>
          requestAnimationFrame(() => requestAnimationFrame(r)),
        );
        const app = doc.querySelector("#app"),
          viewport = doc.querySelector("#viewport"),
          title = doc.querySelector(".titlebar"),
          era = doc.querySelector("#era");
        assert(
          app.scrollWidth <= width + 1,
          `App overflow: ${app.scrollWidth} > ${width}`,
        );
        assert(viewport.clientWidth > width - 100, "Workspace too narrow");
        assert(viewport.clientHeight > height - 230, "Workspace too short");
        const er = era.getBoundingClientRect(),
          tr = title.getBoundingClientRect();
        assert(
          er.left >= tr.left && er.right <= tr.right,
          "Appearance selector clipped",
        );
        if (theme === "7") {
          const ribbon = doc.querySelector("#ribbon");
          assert(
            ribbon.scrollWidth <= ribbon.clientWidth + 1 ||
              win.getComputedStyle(ribbon).overflowX === "auto",
            "Ribbon cannot scroll",
          );
        } else {
          const palette = doc.querySelector("#colorbox");
          assert(
            palette.scrollWidth <= palette.clientWidth + 1,
            `Palette overflow: ${palette.scrollWidth} > ${palette.clientWidth}`,
          );
          equal(doc.querySelectorAll("#tools .classic-icon").length, 16);
        }
        for (const act of [
          "attributes",
          "resize",
          "flip",
          "colors",
          "pageSetup",
          "help",
          "about",
        ]) {
          await win.paint.action(act);
          const d = doc.querySelector("#dialog"),
            r = d.getBoundingClientRect();
          assert(
            r.left >= 0 && r.right <= width + 1,
            `${act} extends horizontally beyond viewport`,
          );
          assert(
            r.top >= 0 && r.bottom <= height + 1,
            `${act} extends vertically beyond viewport`,
          );
          assert(
            d.querySelector(".dialog-actions").getBoundingClientRect().bottom <=
              height,
            `${act} buttons clipped`,
          );
          d.close();
        }
      });
  doc.querySelector("#dialog").close();
  summary.textContent = `COMPLETE · ${passed} passed, ${failed} failed`;
  summary.dataset.passed = passed;
  summary.dataset.failed = failed;
  document.querySelector("#run").disabled = false;
});
