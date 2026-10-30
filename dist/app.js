import {
  PaintEngine,
  ZOOMS,
  makeCanvas,
  validSize,
  encodeBMP,
} from "./engine.js";
import { icon, toolNames, classicTools, shapes } from "./icons.js";

const $ = (s) => document.querySelector(s),
  $$ = (s) => [...document.querySelectorAll(s)];
const testMode = new URLSearchParams(location.search).has("test");
const esc = (s) =>
  String(s).replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const colors = [
  "#000000",
  "#808080",
  "#800000",
  "#808000",
  "#008000",
  "#008080",
  "#000080",
  "#800080",
  "#808040",
  "#004040",
  "#0080ff",
  "#004080",
  "#8000ff",
  "#804000",
  "#ffffff",
  "#c0c0c0",
  "#ff0000",
  "#ffff00",
  "#00ff00",
  "#00ffff",
  "#0000ff",
  "#ff00ff",
  "#ffff80",
  "#00ff80",
  "#80ffff",
  "#8080ff",
  "#ff0080",
  "#ff8040",
];
const win7colors = [
  "#000000",
  "#7f7f7f",
  "#880015",
  "#ed1c24",
  "#ff7f27",
  "#fff200",
  "#22b14c",
  "#00a2e8",
  "#3f48cc",
  "#a349a4",
  "#ffffff",
  "#c3c3c3",
  "#b97a57",
  "#ffaec9",
  "#ffc90e",
  "#efe4b0",
  "#b5e61d",
  "#99d9ea",
  "#7092be",
  "#c8bfe7",
  "#f0f0f0",
  "#d0d0d0",
  "#dac1b4",
  "#ffc7dc",
  "#ffdf79",
  "#f5f0d8",
  "#def0b4",
  "#c4e8f4",
  "#bdcbe2",
  "#e3def1",
];
let theme = "98",
  filename = "Untitled",
  dirty = false,
  saveHandle = null,
  activeColor = "fg",
  menuName = null,
  ribbonTab = "Home",
  openMode = "open",
  autosaveTimer,
  toastTimer,
  installPrompt = null,
  thumbnail = null;
const view = { toolbox: true, colors: true, status: true, thumbnail: false };
const textOpts = {
  font: "Arial",
  size: 18,
  bold: false,
  italic: false,
  underline: false,
};
let textPosition = null,
  textZoom = 1;
const pageSettings = {
  paper: "A4",
  orientation: "portrait",
  margin: 15,
  center: true,
};
const hints = {
  freeSelect:
    "Drag around part of the picture to select it. Drag the selection or its handles to move or resize.",
  select:
    "Drag to select. Drag inside to move; drag a handle to resize. Delete removes the selection.",
  eraser:
    "Left drag erases with the background color. Right drag replaces only the foreground color.",
  fill: "Click a connected area to fill it with the foreground color. Right click uses the background color.",
  picker:
    "Click a pixel to pick its color. Right click sets the background color.",
  magnifier: "Click to zoom in. Right click or Alt-click to zoom out.",
  pencil: "Drag to draw one-pixel lines. Hold Shift for straight strokes.",
  brush: "Drag to paint. Choose a brush shape and size below the toolbox.",
  airbrush: "Hold and drag to spray color. Choose a spray size below.",
  text: "Click the picture to insert text. Use the floating Fonts toolbar, then click outside to finish.",
  line: "Drag to draw a line. Hold Shift to constrain its angle.",
  curve: "Drag a line, then click twice to set its two bends. Enter finishes.",
  polygon:
    "Click to add corners. Double click or press Enter to close the polygon. Escape cancels.",
};
const engine = new PaintEngine(
  $("#canvas"),
  $("#overlay"),
  $("#canvas-wrap"),
  $("#viewport"),
  {
    change() {
      dirty = true;
      updateTitle();
      updateHistory();
      scheduleAutosave();
      drawThumbnail();
    },
    transientChange() {
      dirty = true;
      updateTitle();
      scheduleAutosave();
      drawThumbnail();
    },
    history() {
      updateHistory();
    },
    size(w, h) {
      $("#dimensions").textContent = `${w} × ${h} px`;
    },
    position(p) {
      $("#position").textContent = `${p.x}, ${p.y} px`;
      if (thumbnail) drawThumbnail();
    },
    selectionSize(w, h) {
      $("#position").textContent = `${Math.round(w)} × ${Math.round(h)} px`;
    },
    tool(t) {
      updateTools(t);
    },
    colors() {
      updateColors();
    },
    selection() {
      updateHistory();
    },
    zoom(z) {
      $("#zoom-label").textContent = `${Math.round(z * 100)}%`;
      $("#zoom-slider").value = Math.max(0, ZOOMS.indexOf(z));
      updateTextStyle();
    },
    text(p) {
      startText(p);
    },
    commitText() {
      commitText();
    },
    beforeDraw() {
      closeMenu();
      if (textPosition) commitText();
    },
    hint(msg) {
      $("#status").textContent = msg;
    },
  },
);
// The public object is also useful for embedding and automated browser verification.
window.paint = {
  engine,
  get theme() {
    return theme;
  },
  setTheme,
  action,
};
function updateTitle() {
  const title = `${dirty ? "* " : ""}${filename} - Paint`;
  $("#window-title").textContent = title;
  document.title = title;
}
function toast(message) {
  $("#toast").textContent = message;
  $("#toast").style.display = "block";
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => ($("#toast").style.display = "none"), 4500);
}
function toolButton(t) {
  return `<button class="tool${engine.tool === t ? " active" : ""}" data-tool="${t}" title="${esc(toolNames[t])}" aria-label="${esc(toolNames[t])}" aria-pressed="${engine.tool === t}">${icon(t)}</button>`;
}
function renderTools() {
  $("#tools").innerHTML = classicTools.map(toolButton).join("");
  renderOptions();
}
function updateTools(t) {
  $$("[data-tool]").forEach((b) => {
    b.classList.toggle("active", b.dataset.tool === t);
    b.setAttribute("aria-pressed", b.dataset.tool === t ? "true" : "false");
  });
  renderOptions();
  $("#status").textContent =
    hints[t] ||
    `Drag to draw a ${toolNames[t].toLowerCase()}. Hold Shift for equal proportions.`;
}
function renderOptions() {
  const t = engine.tool;
  let html = "";
  if (["select", "freeSelect", "text"].includes(t))
    html = [true, false]
      .map(
        (o) =>
          `<button class="option ${engine.opaque === o ? "active" : ""}" data-opaque="${o}" title="${o ? "Opaque background" : "Transparent background"}" aria-label="${o ? "Opaque background" : "Transparent background"}"><svg viewBox="0 0 36 22" width="34" height="22"><rect x="1" y="1" width="34" height="20" fill="#${o ? "fff" : "c0c0c0"}"/><path d="m2 18 10-13 11 13" fill="#00a0b8"/><rect x="15" y="6" width="17" height="14" fill="${o ? "white" : "none"}" stroke="black" stroke-dasharray="2 1"/><text x="20" y="17" fill="black" font-size="12">A</text></svg></button>`,
      )
      .join("");
  else if (t === "brush")
    html = `<div class="option-grid">${["round", "square", "diagonal", "diagonalBack"].flatMap((shape) => [3, 6, 10].map((size) => `<button class="option ${engine.size === size && engine.brushShape === shape ? "active" : ""}" data-brush="${shape}" data-size="${size}" aria-label="${shape} brush ${size} pixels" title="${shape} ${size} px"><i class="brush-sample" style="width:${shape.startsWith("diagonal") ? 2 : size}px;height:${size}px;${shape === "round" ? "border-radius:50%;" : ""}${shape.startsWith("diagonal") ? `transform:rotate(${shape === "diagonal" ? 45 : -45}deg)` : ""}"></i></button>`)).join("")}</div>`;
  else if (t === "eraser")
    html = [2, 4, 8, 16]
      .map(
        (n) =>
          `<button class="option ${engine.size === n ? "active" : ""}" data-size="${n}" title="${n} pixel eraser"><i class="brush-sample" style="width:${n}px;height:${n}px"></i></button>`,
      )
      .join("");
  else if (t === "airbrush")
    html = [4, 8, 12]
      .map(
        (n) =>
          `<button class="option ${engine.size === n ? "active" : ""}" data-size="${n}" title="Spray size ${n}"><span style="font-size:${n + 9}px;line-height:20px;letter-spacing:-3px">⁙⁙</span></button>`,
      )
      .join("");
  else if (t === "magnifier")
    html = [1, 2, 4, 6, 8]
      .map(
        (n) =>
          `<button class="option ${engine.zoom === n ? "active" : ""}" data-zoom="${n}">${n}×</button>`,
      )
      .join("");
  else if (shapes.includes(t)) {
    if (!["line", "curve"].includes(t))
      html = ["outline", "both", "fill"]
        .map(
          (m) =>
            `<button class="option ${engine.shapeMode === m ? "active" : ""}" data-mode="${m}" title="${{ outline: "Outline only", both: "Outline and fill", fill: "Fill only" }[m]}"><svg viewBox="0 0 34 18" width="34" height="18"><rect x="4" y="3" width="26" height="12" stroke="${m === "fill" ? "none" : "currentColor"}" stroke-width="2" fill="${m === "outline" ? "none" : m === "both" ? "#808080" : "currentColor"}"/></svg></button>`,
        )
        .join("");
    html += [1, 2, 3, 5, 8]
      .map(
        (n) =>
          `<button class="option ${engine.size === n ? "active" : ""}" data-size="${n}" title="${n} pixel line"><i class="line-sample" style="height:${n}px"></i></button>`,
      )
      .join("");
  }
  $("#tool-options").innerHTML = html;
  $("#tool-options").style.visibility = html ? "visible" : "hidden";
}
function paletteHTML(list, ribbon = false) {
  const arranged = ribbon
    ? Array.from({ length: 10 }, (_, i) => [
        list[i],
        list[i + 10],
        list[i + 20],
      ]).flat()
    : Array.from({ length: 14 }, (_, i) => [list[i], list[i + 14]]).flat();
  return arranged
    .map(
      (c) =>
        `<button class="swatch" data-color="${c}" title="${c.toUpperCase()} · Right click for background" aria-label="Color ${c}"><span style="background:${c}"></span></button>`,
    )
    .join("");
}
function updateColors() {
  $(".front-color").style.background = engine.fg;
  $(".back-color").style.background = engine.bg;
  $$("[data-color-display]").forEach(
    (el) => (el.style.background = engine[el.dataset.colorDisplay]),
  );
  $$("[data-active-color]").forEach((el) =>
    el.classList.toggle("active", el.dataset.activeColor === activeColor),
  );
  updateTextStyle();
}
function setTheme(value) {
  theme = ["98", "xp", "7"].includes(value) ? value : "98";
  document.body.dataset.theme = theme;
  $("#era").value = theme;
  try {
    localStorage.setItem("paint-theme", theme);
  } catch {}
  renderMenu();
  renderRibbon();
  applyView();
  updateColors();
  $("#quick-access").innerHTML = ["save", "undo", "redo"]
    .map(
      (name) =>
        `<button data-action="${name}" title="${name[0].toUpperCase() + name.slice(1)}" aria-label="${name[0].toUpperCase() + name.slice(1)}">${icon(name)}</button>`,
    )
    .join("");
  updateHistory();
  renderTools();
  $("#install").innerHTML = icon("install");
  $(".window-controls [data-action=fullscreen]").innerHTML = icon("maximize");
  $(".window-controls [data-action=about]").innerHTML = icon("help");
  $$(".color-spectrum").forEach((el) => (el.innerHTML = icon("colors")));
}
function applyView() {
  $("#toolbox").style.display = theme === "7" || !view.toolbox ? "none" : "";
  $("#colorbox").style.display = theme === "7" || !view.colors ? "none" : "";
  $("#statusbar").style.display = view.status ? "" : "none";
}
const item = (label, act, key = "", extra = {}) => ({
  label,
  act,
  key,
  ...extra,
});
function menus() {
  return {
    File: [
      item("New", "new", "Ctrl+N"),
      item("Open…", "open", "Ctrl+O"),
      item("Save", "save", "Ctrl+S"),
      item("Save As…", "saveas", "Ctrl+Shift+S"),
      null,
      item("From scanner or camera…", "scanner"),
      null,
      item("Print Preview", "preview"),
      item("Page Setup…", "pageSetup"),
      item("Print…", "print", "Ctrl+P"),
      null,
      item("Set as Desktop Background…", "wallpaper"),
      item("Install Desktop App…", "install"),
      null,
      item("Exit", "exit"),
    ],
    Edit: [
      item("Undo", "undo", "Ctrl+Z", {
        disabled: engine.history.length < 2 && !engine.selection,
      }),
      item("Redo", "redo", "Ctrl+Y", { disabled: !engine.future.length }),
      null,
      item("Cut", "cut", "Ctrl+X"),
      item("Copy", "copy", "Ctrl+C"),
      item("Paste", "paste", "Ctrl+V"),
      item("Clear Selection", "delete", "Del", { disabled: !engine.selection }),
      item("Select All", "selectAll", "Ctrl+A"),
      null,
      item("Copy To…", "copyTo"),
      item("Paste From…", "pasteFrom"),
    ],
    View: [
      item("Tool Box", "toggleTools", "Ctrl+T", { checked: view.toolbox }),
      item("Color Box", "toggleColors", "Ctrl+L", { checked: view.colors }),
      item("Status Bar", "toggleStatus", "", { checked: view.status }),
      item("Text Toolbar", "textToolbar"),
      null,
      item("Normal Size", "zoomNormal", "Ctrl+PageUp"),
      item("Large Size", "zoomLarge", "Ctrl+PageDown"),
      item("Custom Zoom…", "zoom"),
      item("Show Grid", "grid", "Ctrl+G", { checked: engine.grid }),
      item("Show Thumbnail", "thumbnail", "", { checked: view.thumbnail }),
      null,
      item("View Bitmap…", "bitmap", "Ctrl+F"),
      item("Full Screen", "fullscreen", "F11"),
    ],
    Image: [
      item("Flip/Rotate…", "flip", "Ctrl+R"),
      item("Stretch/Skew…", "resize", "Ctrl+W"),
      item("Invert Colors", "invert", "Ctrl+I"),
      item("Attributes…", "attributes", "Ctrl+E"),
      item("Clear Image", "clear", "Ctrl+Shift+N"),
      item("Crop", "crop", "Ctrl+Shift+X", { disabled: !engine.selection }),
      null,
      item("Draw Opaque", "opaque", "", { checked: engine.opaque }),
    ],
    Colors: [item("Edit Colors…", "colors")],
    Help: [
      item("Help Topics", "help", "F1"),
      item("Keyboard Shortcuts", "shortcuts"),
      null,
      item("About Paint", "about"),
    ],
    Brushes: [
      ...Object.entries({
        round: "Brush",
        diagonal: "Calligraphy brush 1",
        diagonalBack: "Calligraphy brush 2",
        airbrush: "Airbrush",
        oil: "Oil brush",
        crayon: "Crayon",
        marker: "Marker",
        naturalPencil: "Natural pencil",
        watercolor: "Watercolor brush",
      }).map(([key, label]) =>
        item(label, "brush:" + key, "", {
          icon: key === "round" ? "brush" : key,
          checked:
            engine.tool === "airbrush"
              ? key === "airbrush"
              : engine.tool === "brush" && engine.brushShape === key,
        }),
      ),
    ],
    Selection: [
      item("Rectangular selection", "selectTool"),
      item("Free-form selection", "freeSelectTool"),
      null,
      item("Select all", "selectAll", "Ctrl+A"),
      item("Invert selection", "invertSelection", "", {
        disabled: !engine.selection,
      }),
      item("Delete", "delete", "Del", { disabled: !engine.selection }),
      null,
      item("Transparent selection", "opaque", "", { checked: !engine.opaque }),
    ],
  };
}
function renderMenu() {
  const names =
    theme === "7"
      ? ["File", "Home", "View"]
      : ["File", "Edit", "View", "Image", "Colors", "Help"];
  $("#menubar").innerHTML = names
    .map(
      (name) =>
        `<button class="menu-button" data-menu="${name}" aria-haspopup="${name === "Home" ? "false" : "menu"}" aria-expanded="false">${theme === "7" ? name : `<span class="mnemonic">${name[0]}</span>${name.slice(1)}`}</button>`,
    )
    .join("");
}
function closeMenu() {
  $("#menu-root").replaceChildren();
  $$("[data-menu]").forEach((b) => {
    b.classList.remove("open");
    b.setAttribute("aria-expanded", "false");
  });
  menuName = null;
}
function showMenu(name, anchor) {
  closeMenu();
  if (theme === "7" && ["Home", "View"].includes(name)) {
    ribbonTab = name;
    renderRibbon();
    return;
  }
  const list = menus()[name];
  if (!list) return;
  menuName = name;
  anchor.classList.add("open");
  anchor.setAttribute("aria-expanded", "true");
  const drop = document.createElement("div");
  drop.className = "dropdown" + (name === "Brushes" ? " brush-menu" : "");
  drop.setAttribute("role", "menu");
  drop.innerHTML = list
    .map((i) =>
      i
        ? `<button role="menuitem${i.checked !== undefined ? "checkbox" : ""}" ${i.checked !== undefined ? `aria-checked="${i.checked}"` : ""} class="${i.checked ? "checked" : ""}" data-action="${i.act}" ${i.disabled ? "disabled" : ""}>${i.icon ? icon(i.icon) : ""}<span>${i.label}</span>${i.key ? `<span class="shortcut">${i.key}</span>` : ""}</button>`
        : '<hr role="separator">',
    )
    .join("");
  $("#menu-root").append(drop);
  const r = anchor.getBoundingClientRect();
  drop.style.left =
    Math.min(r.left, window.innerWidth - drop.offsetWidth - 4) + "px";
  drop.style.top =
    Math.min(r.bottom, window.innerHeight - drop.offsetHeight - 4) + "px";
  drop.addEventListener("keydown", (e) => {
    const btns = [...drop.querySelectorAll("button:not(:disabled)")],
      i = btns.indexOf(document.activeElement);
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      btns[
        (i + (e.key === "ArrowDown" ? 1 : btns.length - 1)) % btns.length
      ]?.focus();
    }
    if (e.key === "Escape") {
      closeMenu();
      anchor.focus();
    }
  });
}
function ribbonButton(label, act, name = act, large = false) {
  return `<button class="ribbon-button${large ? " ribbon-large" : ""}" data-action="${act}" title="${label}">${icon(name)}<span>${label}</span></button>`;
}
function group(caption, content) {
  return `<div class="ribbon-group"><div class="ribbon-content">${content}</div><div class="ribbon-caption">${caption}</div></div>`;
}
function renderRibbon() {
  if (theme !== "7") {
    $("#ribbon").innerHTML = "";
    return;
  }
  if (ribbonTab === "View") {
    $("#ribbon").innerHTML =
      group(
        "Zoom",
        ribbonButton("Zoom in", "zoomIn", "magnifier", true) +
          ribbonButton("Zoom out", "zoomOut", "magnifier", true) +
          ribbonButton("100%", "zoomNormal", "magnifier", true),
      ) +
      group(
        "Show or hide",
        `<div class="ribbon-stack"><label><input type="checkbox" data-toggle="grid" ${engine.grid ? "checked" : ""}> Gridlines</label><label><input type="checkbox" data-toggle="toggleStatus" ${view.status ? "checked" : ""}> Status bar</label><label><input type="checkbox" data-toggle="thumbnail" ${view.thumbnail ? "checked" : ""}> Thumbnail</label></div>`,
      ) +
      group(
        "Display",
        ribbonButton("Full screen", "fullscreen", "fullscreen", true) +
          ribbonButton("View bitmap", "bitmap", "rect", true),
      ) +
      group(
        "Appearance",
        `<div class="ribbon-stack"><button class="ribbon-button" data-era="98">Windows 98</button><button class="ribbon-button" data-era="xp">Windows XP</button><button class="ribbon-button" data-action="help">Help topics</button></div>`,
      );
  } else {
    $("#ribbon").innerHTML =
      group(
        "Clipboard",
        ribbonButton("Paste", "paste", "paste", true) +
          `<div class="ribbon-stack">${ribbonButton("Cut", "cut", "cut")}${ribbonButton("Copy", "copy", "copy")}</div>`,
      ) +
      group(
        "Image",
        `<div class="ribbon-stack">${ribbonButton("Select", "selectTool", "select", true)}<button class="ribbon-button select-dropdown" data-menu="Selection" aria-haspopup="menu" aria-label="Selection options">▾</button></div>` +
          `<div class="ribbon-stack">${ribbonButton("Crop", "crop", "crop")}${ribbonButton("Resize", "resize", "resize")}${ribbonButton("Rotate", "flip", "rotate")}</div>`,
      ) +
      group(
        "Tools",
        `<div class="ribbon-tool-grid">${["pencil", "fill", "text", "eraser", "picker", "magnifier"].map(toolButton).join("")}</div>`,
      ) +
      group(
        "Brushes",
        `<div class="ribbon-stack">${ribbonButton("Brushes ▾", "brushMenu", "brush", true)}<select id="brush-type" class="ribbon-select" aria-label="Brush type"><option value="round">Brush</option><option value="diagonal">Calligraphy 1</option><option value="diagonalBack">Calligraphy 2</option><option value="airbrush">Airbrush</option><option value="oil">Oil brush</option><option value="crayon">Crayon</option><option value="marker">Marker</option><option value="naturalPencil">Natural pencil</option><option value="watercolor">Watercolor</option></select></div>`,
      ) +
      group(
        "Shapes",
        `<div class="shape-gallery">${shapes.map(toolButton).join("")}</div><div class="ribbon-stack"><label>Style <select class="ribbon-select" id="shape-style" aria-label="Shape outline and fill"><option value="outline">Outline</option><option value="both">Outline & fill</option><option value="fill">Solid fill</option></select></label><label><input type="checkbox" id="transparent" ${!engine.opaque ? "checked" : ""}> Transparent</label></div>`,
      ) +
      group(
        "Size",
        `<select class="ribbon-select" id="ribbon-size" aria-label="Brush and line size">${[1, 2, 3, 4, 5, 6, 8, 10, 16, 24, 32].map((n) => `<option value="${n}" ${engine.size === n ? "selected" : ""}>${n} px</option>`).join("")}</select>`,
      ) +
      group(
        "Colors",
        `<button class="ribbon-current ${activeColor === "fg" ? "active" : ""}" data-active-color="fg" title="Foreground color"><i data-color-display="fg"></i>Color 1</button><button class="ribbon-current ${activeColor === "bg" ? "active" : ""}" data-active-color="bg" title="Background color"><i data-color-display="bg"></i>Color 2</button><div class="ribbon-palette">${paletteHTML(win7colors, true)}</div><button class="edit-colors" data-action="colors"><span class="color-spectrum"></span><span>Edit colors</span></button>`,
      );
    $("#shape-style").value = engine.shapeMode;
  }
  $("#brush-type")?.remove();
  updateColors();
  updateTools(engine.tool);
  updateHistory();
  $$("#ribbon .color-spectrum").forEach(
    (el) => (el.innerHTML = icon("colors")),
  );
}
function updateHistory() {
  $$('[data-action="undo"]').forEach(
    (b) => (b.disabled = engine.history.length < 2 && !engine.selection),
  );
  $$('[data-action="redo"]').forEach(
    (b) => (b.disabled = !engine.future.length),
  );
  $$('[data-action="crop"]').forEach((b) => (b.disabled = !engine.selection));
}
function dialog(
  title,
  body,
  buttons = [
    ["OK", "ok"],
    ["Cancel", "cancel"],
  ],
  handler,
) {
  closeMenu();
  const d = $("#dialog");
  if (d.open) d.close();
  d.className = "dialog";
  d.innerHTML = `<form><header class="dialog-title"><span id="dialog-title">${esc(title)}</span><button type="button" data-close-dialog aria-label="Close dialog">×</button></header><div class="dialog-body">${body}</div><div class="dialog-actions">${buttons.map(([label, value], i) => `<button class="classic-button ${i === 0 ? "primary" : ""}" type="${value === "cancel" ? "button" : "submit"}" ${value === "cancel" ? "data-close-dialog" : ""} value="${value}">${label}</button>`).join("")}</div></form>`;
  d.querySelectorAll("[data-close-dialog]").forEach((b) =>
    b.addEventListener("click", () => d.close()),
  );
  d.querySelector(".dialog-title [data-close-dialog]").innerHTML =
    icon("close");
  const form = d.querySelector("form");
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const button = e.submitter?.value || "ok";
    try {
      const result = await handler?.(button, new FormData(e.currentTarget));
      if (result !== false && d.querySelector("form") === form) d.close();
    } catch (error) {
      toast(error.message);
    }
  });
  d.showModal();
  return d;
}
function message(title, body) {
  dialog(title, body, [["OK", "ok"]]);
}
function errorDialog(error) {
  message("Paint", `<p>${esc(error.message || error)}</p>`);
}
async function saveBefore(proceed) {
  commitText();
  engine.finishPending();
  engine.commitSelection();
  if (!dirty) {
    await proceed();
    return;
  }
  dialog(
    "Paint",
    `<p>Do you want to save changes to ${esc(filename)}?</p>`,
    [
      ["Save", "save"],
      ["Don’t Save", "discard"],
      ["Cancel", "cancel"],
    ],
    async (value) => {
      if (value === "save") {
        const ok = await save(false);
        if (!ok) return false;
      }
      await proceed();
    },
  );
}
function attributes() {
  const d = dialog(
    "Attributes",
    `<div class="row"><label>Width: <input name="width" type="number" min="0.01" step="any" value="${engine.width}" required></label><label>Height: <input name="height" type="number" min="0.01" step="any" value="${engine.height}" required></label></div><fieldset><legend>Units</legend><div class="row"><label><input type="radio" name="units" value="in" >Inches</label><label><input type="radio" name="units" value="cm">Cm</label><label><input type="radio" name="units" value="px" checked>Pixels</label></div></fieldset><fieldset><legend>Colors</legend><label><input type="radio" name="mode" value="mono">Black and white</label><label><input type="radio" name="mode" value="color" checked>Colors</label></fieldset><p class="muted">Resolution: 96 dots per inch. Resizing the canvas preserves the image at its original size; excess pixels are cropped.</p>`,
    [
      ["OK", "ok"],
      ["Default", "default"],
      ["Cancel", "cancel"],
    ],
    (value, form) => {
      if (value === "default") {
        engine.resizeCanvas(800, 500);
        return;
      }
      const factor = { px: 1, in: 96, cm: 96 / 2.54 }[form.get("units")];
      const w = Math.round(Number(form.get("width")) * factor),
        h = Math.round(Number(form.get("height")) * factor);
      engine.resizeCanvas(w, h);
      if (form.get("mode") === "mono") engine.monochrome();
    },
  );
  let last = "px";
  d.querySelectorAll("[name=units]").forEach((input) =>
    input.addEventListener("change", () => {
      const f = { px: 1, in: 96, cm: 96 / 2.54 },
        a = d.querySelector("[name=width]"),
        b = d.querySelector("[name=height]");
      a.value = +((Number(a.value) * f[last]) / f[input.value]).toFixed(3);
      b.value = +((Number(b.value) * f[last]) / f[input.value]).toFixed(3);
      last = input.value;
    }),
  );
}
function resizeDialog() {
  const w = engine.selection?.w || engine.width,
    h = engine.selection?.h || engine.height;
  const d = dialog(
    theme === "7" ? "Resize and Skew" : "Stretch/Skew",
    `<fieldset><legend>${theme === "7" ? "Resize" : "Stretch"}</legend><div class="row"><label><input name="units" type="radio" value="percent" checked>Percentage</label><label><input name="units" type="radio" value="pixels">Pixels</label></div><label>Horizontal: <input name="horizontal" type="number" value="100" min="1" max="8192" required> <span class="unit">%</span></label><label>Vertical: <input name="vertical" type="number" value="100" min="1" max="8192" required> <span class="unit">%</span></label><label><input type="checkbox" name="aspect" ${theme === "7" ? "checked" : ""}>Maintain aspect ratio</label></fieldset><fieldset><legend>Skew</legend><label>Horizontal: <input name="skewX" type="number" value="0" min="-80" max="80" required>degrees</label><label>Vertical: <input name="skewY" type="number" value="0" min="-80" max="80" required>degrees</label></fieldset><p class="muted">${engine.selection ? "Applies to the selection." : "Applies to the entire picture."}</p>`,
    undefined,
    (_, f) => {
      const pct = f.get("units") === "percent";
      engine.resizeImage(
        Math.max(
          1,
          Math.round(Number(f.get("horizontal")) * (pct ? w / 100 : 1)),
        ),
        Math.max(
          1,
          Math.round(Number(f.get("vertical")) * (pct ? h / 100 : 1)),
        ),
        Number(f.get("skewX")),
        Number(f.get("skewY")),
      );
    },
  );
  const a = d.querySelector("[name=horizontal]"),
    b = d.querySelector("[name=vertical]");
  d.querySelectorAll("[name=units]").forEach((el) =>
    el.addEventListener("change", () => {
      a.value = el.value === "percent" ? 100 : w;
      b.value = el.value === "percent" ? 100 : h;
      d.querySelectorAll(".unit").forEach(
        (unit) => (unit.textContent = el.value === "percent" ? "%" : "px"),
      );
    }),
  );
  for (const [src, dst, ratio] of [
    [a, b, h / w],
    [b, a, w / h],
  ])
    src.addEventListener("input", () => {
      if (d.querySelector("[name=aspect]").checked) {
        const pct = d.querySelector("[name=units]:checked").value === "percent";
        dst.value = Math.max(
          1,
          Math.round(Number(src.value) * (pct ? 1 : ratio)),
        );
      }
    });
}
function flipDialog() {
  dialog(
    "Flip and Rotate",
    `<fieldset><legend>Flip or rotate</legend><label><input type="radio" name="transform" value="horizontal" checked>Flip horizontal</label><label><input type="radio" name="transform" value="vertical">Flip vertical</label><label><input type="radio" name="transform" value="90">Rotate 90° clockwise</label><label><input type="radio" name="transform" value="180">Rotate 180°</label><label><input type="radio" name="transform" value="270">Rotate 270° clockwise</label></fieldset><p class="muted">${engine.selection ? "Applies to the selection." : "Applies to the entire picture."}</p>`,
    undefined,
    (_, f) => {
      const t = f.get("transform");
      if (t === "horizontal" || t === "vertical")
        engine.flip(t === "horizontal");
      else engine.rotate(Number(t));
    },
  );
}
function rgbToHsl(r, g, b) {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b),
    min = Math.min(r, g, b),
    l = (max + min) / 2;
  let h = 0,
    s = 0;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    h =
      (max === r
        ? (g - b) / d + (g < b ? 6 : 0)
        : max === g
          ? (b - r) / d + 2
          : (r - g) / d + 4) / 6;
  }
  return [Math.round(h * 239), Math.round(s * 240), Math.round(l * 240)];
}
function hslToHex(h, s, l) {
  h /= 239;
  s /= 240;
  l /= 240;
  const a = s * Math.min(l, 1 - l),
    f = (n) => {
      const k = (n + h * 12) % 12;
      return Math.round(255 * (l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1))))
        .toString(16)
        .padStart(2, "0");
    };
  return "#" + f(0) + f(8) + f(4);
}
function editColors(initial = engine[activeColor]) {
  const d = dialog(
    "Edit Colors",
    `<div class="color-picker-layout"><div>Basic colors:<div class="color-basic">${[...colors, ...win7colors.slice(0, 20)].map((c) => `<button type="button" data-pick="${c}" style="background:${c}" aria-label="${c}"></button>`).join("")}</div>Custom colors:<div class="color-basic" id="custom-colors"></div><button class="classic-button" type="button" id="add-custom">Add to Custom Colors</button></div><div><div class="color-map-row"><div class="color-map-wrap"><canvas id="color-map" width="210" height="150" tabindex="0" aria-label="Hue and saturation spectrum"></canvas><span id="color-crosshair"></span></div><canvas id="lum-map" width="18" height="150" tabindex="0" aria-label="Luminosity spectrum"></canvas></div><label class="native-color-label">Color picker: <input type="color" id="color-picker" value="${initial}" aria-label="Custom color"></label><div class="color-preview" id="color-preview"></div><div class="color-fields">${["Hue", "Sat", "Lum", "Red", "Green", "Blue"].map((n) => `<label>${n}:<input name="${n}" type="number" min="0" max="${n === "Hue" ? 239 : ["Sat", "Lum"].includes(n) ? 240 : 255}" required></label>`).join("")}</div><label>Hex: <input id="color-hex" pattern="#[0-9a-fA-F]{6}" required value="${initial}" maxlength="7" size="8"></label></div></div>`,
    undefined,
    () => {
      const c = d.querySelector("#color-hex").value;
      if (!/^#[0-9a-f]{6}$/i.test(c))
        throw Error("Enter a six-digit hex color, such as #008080.");
      engine.setColors(
        activeColor === "fg" ? c : engine.fg,
        activeColor === "bg" ? c : engine.bg,
      );
    },
  );
  const map = d.querySelector("#color-map"),
    lum = d.querySelector("#lum-map"),
    mapCtx = map.getContext("2d"),
    lumCtx = lum.getContext("2d"),
    mapData = mapCtx.createImageData(map.width, map.height);
  for (let y = 0; y < map.height; y++)
    for (let x = 0; x < map.width; x++) {
      const c = hslToHex(
          (x / (map.width - 1)) * 239,
          (1 - y / (map.height - 1)) * 240,
          120,
        ),
        p = (y * map.width + x) * 4;
      mapData.data.set(
        [...c.match(/\w\w/g).map((v) => parseInt(v, 16)), 255],
        p,
      );
    }
  mapCtx.putImageData(mapData, 0, 0);
  function updateMap(hsl) {
    const cross = d.querySelector("#color-crosshair");
    cross.style.left = (hsl[0] / 239) * map.width + "px";
    cross.style.top = (1 - hsl[1] / 240) * map.height + "px";
    const gradient = lumCtx.createLinearGradient(0, 0, 0, lum.height);
    gradient.addColorStop(0, "#ffffff");
    gradient.addColorStop(0.5, hslToHex(hsl[0], hsl[1], 120));
    gradient.addColorStop(1, "#000000");
    lumCtx.fillStyle = gradient;
    lumCtx.fillRect(0, 0, lum.width, lum.height);
    lumCtx.strokeStyle = hsl[2] > 120 ? "#000" : "#fff";
    lumCtx.strokeRect(
      0.5,
      (1 - hsl[2] / 240) * (lum.height - 1) - 1,
      lum.width - 1,
      2,
    );
  }
  function applyHsl(values) {
    ["Hue", "Sat", "Lum"].forEach(
      (name, i) => (d.querySelector(`[name=${name}]`).value = values[i]),
    );
    sync(hslToHex(...values), "hsl");
  }
  for (const canvas of [map, lum]) {
    let dragging = false;
    const pick = (event) => {
      const r = canvas.getBoundingClientRect(),
        values = ["Hue", "Sat", "Lum"].map((n) =>
          Number(d.querySelector(`[name=${n}]`).value),
        );
      if (canvas === map) {
        values[0] = Math.round(
          Math.max(0, Math.min(1, (event.clientX - r.left) / r.width)) * 239,
        );
        values[1] = Math.round(
          (1 - Math.max(0, Math.min(1, (event.clientY - r.top) / r.height))) *
            240,
        );
      } else
        values[2] = Math.round(
          (1 - Math.max(0, Math.min(1, (event.clientY - r.top) / r.height))) *
            240,
        );
      applyHsl(values);
    };
    canvas.addEventListener("pointerdown", (event) => {
      dragging = true;
      canvas.setPointerCapture(event.pointerId);
      pick(event);
    });
    canvas.addEventListener("pointermove", (event) => {
      if (dragging) pick(event);
    });
    canvas.addEventListener("pointerup", () => (dragging = false));
    canvas.addEventListener("pointercancel", () => (dragging = false));
    canvas.addEventListener("keydown", (event) => {
      if (!event.key.startsWith("Arrow")) return;
      event.preventDefault();
      const values = ["Hue", "Sat", "Lum"].map((n) =>
          Number(d.querySelector(`[name=${n}]`).value),
        ),
        index =
          canvas === lum
            ? 2
            : event.key === "ArrowLeft" || event.key === "ArrowRight"
              ? 0
              : 1,
        delta = event.key === "ArrowLeft" || event.key === "ArrowDown" ? -1 : 1;
      values[index] = Math.max(
        0,
        Math.min(index === 0 ? 239 : 240, values[index] + delta),
      );
      applyHsl(values);
    });
  }
  let custom = [];
  try {
    custom = JSON.parse(localStorage.getItem("paint-custom-colors") || "[]");
  } catch {}
  function renderCustom() {
    d.querySelector("#custom-colors").innerHTML = Array.from(
      { length: 16 },
      (_, i) =>
        `<button type="button" data-pick="${custom[i] || "#ffffff"}" style="background:${custom[i] || "#ffffff"}" aria-label="Custom color ${i + 1}"></button>`,
    ).join("");
  }
  function sync(c, origin) {
    const rgb = c.match(/\w\w/g).map((v) => parseInt(v, 16)),
      hsl = rgbToHsl(...rgb);
    d.querySelector("#color-preview").style.background = c;
    d.querySelector("#color-picker").value = c;
    updateMap(
      origin === "hsl"
        ? ["Hue", "Sat", "Lum"].map((name) =>
            Number(d.querySelector(`[name=${name}]`).value),
          )
        : hsl,
    );
    if (origin !== "hex") d.querySelector("#color-hex").value = c;
    if (origin !== "hsl")
      ["Hue", "Sat", "Lum"].forEach(
        (n, i) => (d.querySelector(`[name=${n}]`).value = hsl[i]),
      );
    if (origin !== "rgb")
      ["Red", "Green", "Blue"].forEach(
        (n, i) => (d.querySelector(`[name=${n}]`).value = rgb[i]),
      );
  }
  d.addEventListener("click", (e) => {
    const b = e.target.closest("[data-pick]");
    if (b) sync(b.dataset.pick);
  });
  d.querySelector("#color-picker").addEventListener("input", (e) =>
    sync(e.target.value),
  );
  d.querySelector("#color-hex").addEventListener("input", (e) => {
    if (/^#[0-9a-f]{6}$/i.test(e.target.value)) sync(e.target.value, "hex");
  });
  ["Red", "Green", "Blue"].forEach((n) =>
    d.querySelector(`[name=${n}]`).addEventListener("input", () =>
      sync(
        "#" +
          ["Red", "Green", "Blue"]
            .map((k) =>
              Math.max(
                0,
                Math.min(255, Number(d.querySelector(`[name=${k}]`).value)),
              )
                .toString(16)
                .padStart(2, "0"),
            )
            .join(""),
        "rgb",
      ),
    ),
  );
  ["Hue", "Sat", "Lum"].forEach((n) =>
    d
      .querySelector(`[name=${n}]`)
      .addEventListener("input", () =>
        sync(
          hslToHex(
            ...["Hue", "Sat", "Lum"].map((k) =>
              Number(d.querySelector(`[name=${k}]`).value),
            ),
          ),
          "hsl",
        ),
      ),
  );
  d.querySelector("#add-custom").addEventListener("click", () => {
    custom.push(d.querySelector("#color-hex").value);
    custom = custom.slice(-16);
    try {
      localStorage.setItem("paint-custom-colors", JSON.stringify(custom));
    } catch {}
    renderCustom();
  });
  renderCustom();
  sync(initial);
}
function zoomDialog() {
  dialog(
    "Custom Zoom",
    `<fieldset><legend>Magnification</legend>${[25, 50, 100, 200, 400, 600, 800, 1600].map((n) => `<label><input name="zoom" type="radio" value="${n}" ${Math.round(engine.zoom * 100) === n ? "checked" : ""}>${n}%</label>`).join("")}</fieldset>`,
    undefined,
    (_, f) => engine.setZoom(Number(f.get("zoom") || 100) / 100),
  );
}
function startText(p) {
  commitText();
  textPosition = { x: p.x, y: p.y };
  textZoom = engine.zoom;
  const el = $("#text-editor");
  el.value = "";
  el.style.display = "block";
  el.style.left = p.x * engine.zoom + "px";
  el.style.top = p.y * engine.zoom + "px";
  el.style.width =
    Math.min(p.w || 250, Math.max(32, engine.width - p.x)) * engine.zoom + "px";
  el.style.height =
    Math.min(p.h || 100, Math.max(24, engine.height - p.y)) * engine.zoom +
    "px";
  showTextToolbar();
  updateTextStyle();
  el.focus();
}
function updateTextStyle() {
  const el = $("#text-editor");
  if (!el) return;
  if (textPosition && textZoom !== engine.zoom) {
    el.style.width = (el.offsetWidth / textZoom) * engine.zoom + "px";
    el.style.height = (el.offsetHeight / textZoom) * engine.zoom + "px";
    el.style.left = textPosition.x * engine.zoom + "px";
    el.style.top = textPosition.y * engine.zoom + "px";
    textZoom = engine.zoom;
  }
  el.style.font = `${textOpts.italic ? "italic " : ""}${textOpts.bold ? "bold " : ""}${textOpts.size * engine.zoom}px ${textOpts.font}`;
  el.style.textDecoration = textOpts.underline ? "underline" : "none";
  el.style.color = engine.fg;
  el.style.background = engine.opaque ? engine.bg : "transparent";
}
function commitText() {
  if (!textPosition) return;
  const el = $("#text-editor"),
    p = textPosition;
  textPosition = null;
  engine.renderText(el.value, {
    ...p,
    width: el.offsetWidth / engine.zoom,
    height: el.offsetHeight / engine.zoom,
    ...textOpts,
    opaque: engine.opaque,
  });
  el.value = "";
  el.style.display = "none";
  $(".text-toolbar")?.remove();
}
function showTextToolbar() {
  if ($(".text-toolbar")) return;
  const bar = document.createElement("section");
  bar.className = "text-toolbar";
  bar.setAttribute("aria-label", "Fonts toolbar");
  bar.innerHTML = `<select id="font-family" aria-label="Font family">${["Arial", "Verdana", "Tahoma", "Times New Roman", "Georgia", "Courier New", "Impact", "Comic Sans MS", "monospace", "serif"].map((f) => `<option ${textOpts.font === f ? "selected" : ""}>${f}</option>`).join("")}</select><select id="font-size" aria-label="Font size">${[8, 10, 12, 14, 16, 18, 20, 24, 28, 32, 36, 48, 64, 72, 96].map((n) => `<option ${textOpts.size === n ? "selected" : ""}>${n}</option>`).join("")}</select>${[
    ["bold", "B"],
    ["italic", "I"],
    ["underline", "U"],
  ]
    .map(
      ([key, label]) =>
        `<button data-text-style="${key}" class="${textOpts[key] ? "active" : ""}" title="${key}" aria-label="${key}" style="font-${key === "bold" ? "weight:bold" : key === "italic" ? "style:italic" : "style:normal"};${key === "underline" ? "text-decoration:underline" : ""}">${label}</button>`,
    )
    .join(
      "",
    )}<button id="finish-text" title="Apply text" aria-label="Apply text">✓</button>`;
  document.body.append(bar);
  $("#font-family").addEventListener("change", (e) => {
    textOpts.font = e.target.value;
    updateTextStyle();
  });
  $("#font-size").addEventListener("change", (e) => {
    textOpts.size = Number(e.target.value);
    updateTextStyle();
  });
  bar.querySelectorAll("[data-text-style]").forEach((b) =>
    b.addEventListener("click", () => {
      const key = b.dataset.textStyle;
      textOpts[key] = !textOpts[key];
      b.classList.toggle("active", textOpts[key]);
      updateTextStyle();
    }),
  );
  $("#finish-text").addEventListener("click", commitText);
}
function imageBlob(canvas, type) {
  return type === "bmp"
    ? Promise.resolve(encodeBMP(canvas))
    : new Promise((resolve, reject) =>
        canvas.toBlob(
          (b) =>
            b ? resolve(b) : reject(Error("Unable to encode the image.")),
          type === "jpg" ? "image/jpeg" : "image/png",
          0.95,
        ),
      );
}
function download(blob, name) {
  const a = document.createElement("a"),
    url = URL.createObjectURL(blob);
  a.href = url;
  a.download = name;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}
async function save(forceAs = false, options) {
  commitText();
  engine.finishPending();
  engine.commitSelection();
  const base =
    filename === "Untitled" ? "Untitled" : filename.replace(/\.[^.]+$/, "");
  if (!forceAs && saveHandle) {
    try {
      const type = saveHandle.name.toLowerCase().endsWith(".bmp")
          ? "bmp"
          : /\.jpe?g$/i.test(saveHandle.name)
            ? "jpg"
            : "png",
        blob = await imageBlob(engine.canvas, type),
        writable = await saveHandle.createWritable();
      await writable.write(blob);
      await writable.close();
      dirty = false;
      updateTitle();
      scheduleAutosave();
      return true;
    } catch (e) {
      if (e.name === "AbortError") return false;
      saveHandle = null;
      toast("The original file is unavailable. Choose a new save location.");
    }
  }
  if (options) {
    const type = options.type,
      name = options.name.replace(/\.(png|jpe?g|bmp)$/i, "") + "." + type,
      blob = await imageBlob(engine.canvas, type);
    if (window.paintDesktop) {
      const result = await window.paintDesktop.saveImage({
        name,
        type,
        data: new Uint8Array(await blob.arrayBuffer()),
        forceAs: true,
      });
      if (!result) return false;
      filename = result.name;
    } else {
      download(blob, name);
      filename = name;
    }
    dirty = false;
    saveHandle = null;
    updateTitle();
    scheduleAutosave();
    return true;
  }
  if (window.paintDesktop && !forceAs) {
    const type = /\.bmp$/i.test(filename)
      ? "bmp"
      : /\.jpe?g$/i.test(filename)
        ? "jpg"
        : "png";
    const result = await window.paintDesktop.saveImage({
      name:
        filename === "Untitled"
          ? "Untitled.png"
          : filename.replace(/\.[^.]+$/, "") + "." + type,
      type,
      data: new Uint8Array(
        await (await imageBlob(engine.canvas, type)).arrayBuffer(),
      ),
      forceAs: false,
    });
    if (!result) return false;
    filename = result.name;
    dirty = false;
    updateTitle();
    scheduleAutosave();
    return true;
  }
  if (window.showSaveFilePicker && !window.paintDesktop) {
    try {
      const handle = await window.showSaveFilePicker({
        suggestedName: filename === "Untitled" ? "Untitled.png" : filename,
        types: [
          { description: "PNG image", accept: { "image/png": [".png"] } },
          {
            description: "JPEG image",
            accept: { "image/jpeg": [".jpg", ".jpeg"] },
          },
          { description: "24-bit Bitmap", accept: { "image/bmp": [".bmp"] } },
        ],
      });
      saveHandle = handle;
      filename = handle.name;
      return await save();
    } catch (e) {
      if (e.name === "AbortError") return false;
    }
  }
  // Browser downloads cannot replace existing files. Keep Save As explicit and cross-browser.
  return new Promise((resolve) => {
    const d = dialog(
      "Save As",
      `<label class="stack">File name:<input name="filename" value="${esc(base)}" required maxlength="180"></label><label class="stack">Save as type:<select name="type"><option value="png">PNG (*.png)</option><option value="jpg">JPEG (*.jpg)</option><option value="bmp">24-bit Bitmap (*.bmp)</option></select></label><p class="muted">${window.paintDesktop ? "Choose the file format, then choose a save location." : "The image will be downloaded to your computer."}</p>`,
      [
        ["Save", "save"],
        ["Cancel", "cancel"],
      ],
      async (_, f) => {
        const ok = await save(true, {
          name: String(f.get("filename")),
          type: f.get("type"),
        });
        if (!ok) return false;
        resolve(true);
      },
    );
    // Closing the preceding save-confirmation dialog queues a close event.
    // That event can arrive after Save As has opened on the same <dialog>.
    const onClose = () => {
      if (d.open) return;
      d.removeEventListener("close", onClose);
      resolve(false);
    };
    d.addEventListener("close", onClose);
  });
}
async function openFile(file, mode = "open") {
  if (!file) return;
  try {
    let image;
    try {
      image = await createImageBitmap(file);
    } catch {
      image = await new Promise((resolve, reject) => {
        const im = new Image(),
          url = URL.createObjectURL(file);
        im.onload = () => {
          URL.revokeObjectURL(url);
          resolve(im);
        };
        im.onerror = () => {
          URL.revokeObjectURL(url);
          reject(
            Error(
              "This file could not be opened. Try PNG, JPEG, BMP, WebP, or GIF.",
            ),
          );
        };
        im.src = url;
      });
    }
    if (!validSize(image.width, image.height))
      throw Error(
        "This image is too large. Use up to 8192 pixels per side and 16 million pixels total.",
      );
    const apply = () => {
      if (mode === "paste") engine.paste(image);
      else {
        engine.load(image);
        filename = file.name;
        saveHandle = null;
        window.paintDesktop?.newDocument();
        dirty = false;
        updateTitle();
        scheduleAutosave();
        drawThumbnail();
      }
      image.close?.();
    };
    if (mode === "open") await saveBefore(apply);
    else apply();
  } catch (e) {
    errorDialog(e);
  }
}
async function copy(cut = false) {
  const c = cut ? (engine.cut(), engine.clipboard) : engine.copy();
  try {
    if (navigator.clipboard?.write && window.ClipboardItem) {
      const blob = await imageBlob(c, "png");
      await navigator.clipboard.write([
        new ClipboardItem({ "image/png": blob }),
      ]);
      toast(cut ? "Selection cut." : "Picture copied.");
    } else toast("Copied inside Paint. Use Edit → Paste to paste.");
  } catch {
    toast("Copied inside Paint. Use Edit → Paste to paste.");
  }
}
async function paste() {
  try {
    if (navigator.clipboard?.read) {
      const items = await navigator.clipboard.read();
      for (const item of items) {
        const type = item.types.find((t) => t.startsWith("image/"));
        if (type) {
          const bitmap = await createImageBitmap(await item.getType(type));
          if (!validSize(bitmap.width, bitmap.height))
            throw Error("The clipboard image is too large.");
          engine.paste(bitmap);
          bitmap.close();
          return;
        }
      }
    }
  } catch {}
  if (engine.clipboard) engine.paste(engine.clipboard);
  else
    toast(
      "Use Ctrl+V to paste an image, or Edit → Paste From to choose a file.",
    );
}
function pageSetup() {
  dialog(
    "Page Setup",
    `<fieldset><legend>Paper</legend><label>Size: <select name="paper">${["A4", "Letter", "Legal", "A3", "A5"].map((p) => `<option ${pageSettings.paper === p ? "selected" : ""}>${p}</option>`).join("")}</select></label><label><input type="radio" name="orientation" value="portrait" ${pageSettings.orientation === "portrait" ? "checked" : ""}>Portrait</label><label><input type="radio" name="orientation" value="landscape" ${pageSettings.orientation === "landscape" ? "checked" : ""}>Landscape</label></fieldset><fieldset><legend>Margins and centering</legend><label>Margins: <input name="margin" type="number" min="0" max="80" value="${pageSettings.margin}" required>mm</label><label><input name="center" type="checkbox" ${pageSettings.center ? "checked" : ""}>Center horizontally</label></fieldset><p class="muted">The picture is scaled to fit the page. Your browser’s print dialog provides printer selection and additional settings.</p>`,
    undefined,
    (_, f) => {
      Object.assign(pageSettings, {
        paper: f.get("paper"),
        orientation: f.get("orientation"),
        margin: Number(f.get("margin")),
        center: f.has("center"),
      });
    },
  );
}
function printImage() {
  commitText();
  engine.finishPending();
  engine.commitSelection();
  $(".print-image")?.remove();
  $("#print-settings")?.remove();
  const style = document.createElement("style");
  style.id = "print-settings";
  style.textContent = `@media print{@page{size:${pageSettings.paper} ${pageSettings.orientation};margin:${pageSettings.margin}mm}.print-image{margin:${pageSettings.center ? "auto" : "0"};max-height:${pageSettings.orientation === "landscape" ? "170" : "250"}mm;object-fit:contain;object-position:top left}}`;
  document.head.append(style);
  const img = document.createElement("img");
  img.className = "print-image";
  img.alt = filename;
  img.src = engine.canvas.toDataURL();
  document.body.append(img);
  img.onload = () => window.print();
}
function printPreview(bitmap = false) {
  commitText();
  engine.finishPending();
  engine.commitSelection();
  dialog(
    bitmap ? "View Bitmap" : "Print Preview",
    `<div style="background:${bitmap ? "#808080" : "#a0a0a0"};padding:18px;max-height:65vh;overflow:auto;text-align:center"><img alt="${esc(filename)}" src="${engine.canvas.toDataURL()}" style="max-width:100%;max-height:58vh;background:white;box-shadow:1px 2px 4px #0006;${bitmap ? "image-rendering:pixelated" : "padding:15px"}"></div><p class="muted" style="margin-top:12px">${engine.width} × ${engine.height} pixels${bitmap ? "" : ` · ${pageSettings.paper} · ${pageSettings.orientation}`}</p>`,
    bitmap
      ? [["Close", "ok"]]
      : [
          ["Print…", "print"],
          ["Close", "cancel"],
        ],
    (value) => {
      if (value === "print") printImage();
    },
  );
}
function toggleThumbnail() {
  view.thumbnail = !view.thumbnail;
  if (!view.thumbnail) {
    thumbnail?.remove();
    thumbnail = null;
    return;
  }
  thumbnail = document.createElement("section");
  thumbnail.className = "text-toolbar";
  thumbnail.style.cssText =
    "top:auto;left:auto;bottom:90px;right:35px;display:block;width:204px;padding:3px";
  thumbnail.innerHTML =
    '<div class="dialog-title" style="height:21px;font-size:11px">Thumbnail<button type="button" id="close-thumbnail" aria-label="Close thumbnail">×</button></div><canvas width="192" height="120" style="position:static;width:192px;height:120px;cursor:pointer;background:white;margin:2px"></canvas>';
  document.body.append(thumbnail);
  $("#close-thumbnail").addEventListener("click", toggleThumbnail);
  thumbnail.querySelector("canvas").addEventListener("pointerdown", (e) => {
    const r = e.currentTarget.getBoundingClientRect();
    $("#viewport").scrollLeft =
      ((e.clientX - r.left) / r.width) * engine.width * engine.zoom -
      $("#viewport").clientWidth / 2;
    $("#viewport").scrollTop =
      ((e.clientY - r.top) / r.height) * engine.height * engine.zoom -
      $("#viewport").clientHeight / 2;
  });
  drawThumbnail();
}
function drawThumbnail() {
  if (!thumbnail) return;
  const c = thumbnail.querySelector("canvas"),
    ctx = c.getContext("2d");
  ctx.fillStyle = "white";
  ctx.fillRect(0, 0, c.width, c.height);
  const scale = Math.min(c.width / engine.width, c.height / engine.height);
  ctx.drawImage(
    engine.canvas,
    0,
    0,
    engine.width * scale,
    engine.height * scale,
  );
  if (engine.selection) {
    const s = engine.selection;
    ctx.drawImage(
      engine.selectionImage(),
      s.x * scale,
      s.y * scale,
      s.w * scale,
      s.h * scale,
    );
  }
}
function help(shortcuts = false) {
  const rows = [
    ["Ctrl+N / Ctrl+O", "New picture / Open image"],
    ["Ctrl+S / Ctrl+Shift+S", "Save / Save As"],
    ["Ctrl+Z / Ctrl+Y", "Undo / Redo"],
    ["Ctrl+X / Ctrl+C / Ctrl+V", "Cut / Copy / Paste"],
    ["Ctrl+A / Delete", "Select all / Delete selection"],
    ["Ctrl+R / Ctrl+W", "Flip & Rotate / Resize & Skew"],
    ["Ctrl+E / Ctrl+I", "Attributes / Invert colors"],
    ["Ctrl+Shift+X", "Crop to selection"],
    ["Ctrl+G", "Show pixel grid (at 400% or larger)"],
    ["Ctrl+P", "Print"],
    ["+ / − / Ctrl+mouse wheel", "Zoom in / out"],
    ["X / D", "Swap colors / Reset to black and white"],
    ["Enter / Escape", "Finish / Cancel curve or polygon"],
    ["Shift while drawing", "Square, circle, or constrained line"],
    ["Right mouse button", "Use the background color"],
    ["F1", "Help"],
  ];
  message(
    shortcuts ? "Keyboard Shortcuts" : "Paint Help",
    `<div class="help-scroll">${!shortcuts ? `<h3>Welcome to classic Paint</h3><p>Choose a Windows appearance in the title bar. Your picture and editing history stay with you when you change the look.</p><h3>Drawing and colors</h3><p>Choose a tool on the left, or in the Windows 7 ribbon. Left click a palette color to set the foreground; right click to set the background. Double click a color to edit it. The options below the toolbox set brush shape, size, fill, and transparency.</p><h3>Selections</h3><p>Drag a rectangle or draw a free-form boundary, then drag inside to move the selected pixels. Drag any of the eight handles to resize. Choose Image → Draw Opaque to toggle background color transparency. Flip, rotate, resize, and invert apply to the active selection. Click outside to place it.</p><h3>Curves and polygons</h3><p>For a curve, drag the initial line, then click twice to place its bends. For a polygon, click each corner and double click the final corner, or press Enter. Escape cancels the unfinished shape.</p><h3>Text</h3><p>Click with the Text tool and type. Use the floating Fonts toolbar to change family, size, bold, italic, and underline. Drag the text box’s bottom right corner to resize it. Click the checkmark or outside the box to finish. Applied text becomes part of the picture.</p><h3>Files and desktop</h3><p>Open browser-supported images including PNG, JPEG, BMP, WebP, and GIF (first frame). Save as PNG, JPEG, or 24-bit BMP. Your work is recovered locally after a refresh when storage is available. Install from the title bar for an offline desktop window. A native Electron launcher is also included in the source.</p><h3>Browser integration</h3><p>Clipboard and native file dialogs depend on browser permissions. The internal clipboard, Paste From, and downloaded exports provide alternatives. Scanner acquisition and changing the operating system wallpaper require your system’s own tools.</p><h3>Keyboard shortcuts</h3>` : ""}<table>${rows.map(([key, desc]) => `<tr><td>${esc(key)}</td><td>${esc(desc)}</td></tr>`).join("")}</table></div>`,
  );
}
async function action(name) {
  closeMenu();
  try {
    if (name.startsWith("brush:")) {
      const type = name.slice(6);
      engine.size = Math.max(6, engine.size);
      if (type === "airbrush") engine.setTool("airbrush");
      else {
        engine.brushShape = type;
        engine.setTool("brush");
      }
      renderOptions();
      return;
    }
    switch (name) {
      case "new":
        await saveBefore(() => {
          engine.newImage();
          filename = "Untitled";
          saveHandle = null;
          window.paintDesktop?.newDocument();
          dirty = false;
          updateTitle();
          scheduleAutosave();
          drawThumbnail();
        });
        break;
      case "open":
        openMode = "open";
        $("#open-file").click();
        break;
      case "pasteFrom":
        openMode = "paste";
        $("#open-file").click();
        break;
      case "save":
        await save();
        break;
      case "saveas":
        await save(true);
        break;
      case "copyTo": {
        const c = engine.copy();
        dialog(
          "Copy To",
          `<label>File name: <input name="name" value="Selection.png" required></label>`,
          [
            ["Save", "save"],
            ["Cancel", "cancel"],
          ],
          async (_, f) =>
            download(
              await imageBlob(c, "png"),
              String(f.get("name")).replace(/\.png$/i, "") + ".png",
            ),
        );
        break;
      }
      case "undo":
        commitText();
        engine.undo();
        break;
      case "redo":
        engine.redo();
        break;
      case "cut":
        await copy(true);
        break;
      case "copy":
        await copy();
        break;
      case "paste":
        await paste();
        break;
      case "delete":
        engine.deleteSelection();
        break;
      case "selectAll":
        engine.selectAll();
        break;
      case "selectTool":
        engine.setTool("select");
        break;
      case "freeSelectTool":
        engine.setTool("freeSelect");
        break;
      case "invertSelection":
        engine.invertSelection();
        break;
      case "brushMenu":
        showMenu("Brushes", $("[data-action=brushMenu]"));
        break;
      case "brushes":
        engine.size = engine.size === 1 ? 6 : engine.size;
        engine.setTool("brush");
        break;
      case "crop":
        engine.crop();
        break;
      case "attributes":
        commitText();
        attributes();
        break;
      case "resize":
        commitText();
        resizeDialog();
        break;
      case "flip":
        commitText();
        flipDialog();
        break;
      case "invert":
        engine.invert();
        break;
      case "clear":
        commitText();
        engine.clear();
        break;
      case "opaque":
        engine.opaque = !engine.opaque;
        engine.drawOverlay();
        renderOptions();
        updateTextStyle();
        break;
      case "colors":
        editColors();
        break;
      case "zoom":
        zoomDialog();
        break;
      case "zoomIn":
        engine.setZoom(ZOOMS.find((z) => z > engine.zoom) || 16);
        break;
      case "zoomOut":
        engine.setZoom(
          [...ZOOMS].reverse().find((z) => z < engine.zoom) || 0.25,
        );
        break;
      case "zoomNormal":
        engine.setZoom(1);
        break;
      case "zoomLarge":
        engine.setZoom(4);
        break;
      case "grid":
        engine.grid = !engine.grid;
        engine.syncSize();
        if (engine.grid && engine.zoom < 4)
          toast("Grid is visible at 400% zoom and above.");
        break;
      case "toggleTools":
        view.toolbox = !view.toolbox;
        applyView();
        break;
      case "toggleColors":
        view.colors = !view.colors;
        applyView();
        break;
      case "toggleStatus":
        view.status = !view.status;
        applyView();
        break;
      case "textToolbar":
        showTextToolbar();
        break;
      case "thumbnail":
        toggleThumbnail();
        break;
      case "bitmap":
        printPreview(true);
        break;
      case "preview":
        printPreview();
        break;
      case "pageSetup":
        pageSetup();
        break;
      case "print":
        printImage();
        break;
      case "fullscreen":
        if (document.fullscreenElement) await document.exitFullscreen();
        else if (document.documentElement.requestFullscreen)
          await document.documentElement.requestFullscreen();
        break;
      case "help":
        help();
        break;
      case "shortcuts":
        help(true);
        break;
      case "about":
        message(
          "About Paint",
          `<div style="display:flex;align-items:center;gap:18px;margin-bottom:17px"><img src="icon.svg" width="54" height="54" alt=""><div><div style="font-size:22px;font-weight:bold">Paint</div><div>Three eras. One blank canvas.</div></div></div><p>An independent recreation of the classic drawing experience, with Windows 98, Windows XP, and Windows 7 appearances.</p><hr><p>Draw, make a mess, and undo it.<br>Your images are processed on this device.</p><p class="muted">Version 1.0 · Built with the HTML Canvas API.<br>Not affiliated with Microsoft. Windows and Microsoft Paint are trademarks of Microsoft.</p>`,
        );
        break;
      case "scanner":
        dialog(
          "From Scanner or Camera",
          `<p>Use your scanner’s software to scan a picture, then open the saved image here.</p><p>You can also choose an existing image or use a camera on supported mobile devices.</p>`,
          [
            ["Choose Image…", "choose"],
            ["Cancel", "cancel"],
          ],
          () => {
            openMode = "open";
            $("#open-file").click();
          },
        );
        break;
      case "wallpaper":
        dialog(
          "Set as Desktop Background",
          `<p>Download your picture, then use your operating system’s background settings to choose it as your wallpaper.</p>`,
          [
            ["Download Picture", "download"],
            ["Cancel", "cancel"],
          ],
          async () => {
            commitText();
            engine.finishPending();
            engine.commitSelection();
            download(await imageBlob(engine.canvas, "png"), "Wallpaper.png");
          },
        );
        break;
      case "install":
        if (installPrompt) {
          await installPrompt.prompt();
          const result = await installPrompt.userChoice;
          if (result.outcome === "accepted") installPrompt = null;
        } else
          message(
            "Install Paint",
            `<p>In Chrome or Edge, use the install icon in the address bar, or the browser menu → “Install Paint” / “Install this page as an app”.</p><p>The installed app opens in its own desktop window and works offline after its first visit.</p><p class="muted">Installation requires HTTPS or localhost and a supported browser. For a native desktop app, the source includes an Electron launcher.</p>`,
          );
        break;
      case "exit":
        await saveBefore(() => {
          if (window.paintDesktop) window.paintDesktop.close();
          else {
            window.close();
            toast("Your picture is ready. You can close this browser tab.");
          }
        });
        break;
    }
    if (
      theme === "7" &&
      ribbonTab === "View" &&
      ["grid", "toggleStatus", "thumbnail"].includes(name)
    )
      renderRibbon();
  } catch (e) {
    errorDialog(e);
  }
}
// Event delegation keeps all three appearances connected to the same commands.
document.addEventListener("click", (e) => {
  if (e.target.closest("#dialog,.text-toolbar")) return;
  const menu = e.target.closest("[data-menu]");
  if (menu) {
    if (menuName === menu.dataset.menu) closeMenu();
    else showMenu(menu.dataset.menu, menu);
    return;
  }
  const t = e.target.closest("[data-tool]");
  if (t) {
    if (t.dataset.tool === "picker") engine.previousTool = engine.tool;
    engine.setTool(t.dataset.tool);
    if (t.dataset.tool === "brush" && engine.size === 1) {
      engine.size = 6;
      renderOptions();
    }
    return;
  }
  const a = e.target.closest("[data-action]");
  if (a) {
    action(a.dataset.action);
    return;
  }
  const c = e.target.closest("[data-color]");
  if (c) {
    if (theme === "7" && activeColor === "bg")
      engine.setColors(engine.fg, c.dataset.color);
    else engine.setColors(c.dataset.color, engine.bg);
    return;
  }
  const ac = e.target.closest("[data-active-color]");
  if (ac) {
    activeColor = ac.dataset.activeColor;
    updateColors();
    return;
  }
  const o = e.target.closest("[data-opaque]");
  if (o) {
    engine.opaque = o.dataset.opaque === "true";
    engine.drawOverlay();
    renderOptions();
    updateTextStyle();
    return;
  }
  const m = e.target.closest("[data-mode]");
  if (m) {
    engine.shapeMode = m.dataset.mode;
    renderOptions();
    return;
  }
  const s = e.target.closest("[data-size]");
  if (s) {
    engine.size = Number(s.dataset.size);
    if (s.dataset.brush) engine.brushShape = s.dataset.brush;
    renderOptions();
    return;
  }
  const z = e.target.closest("[data-zoom]");
  if (z) {
    engine.setZoom(Number(z.dataset.zoom));
    renderOptions();
    return;
  }
  const era = e.target.closest("[data-era]");
  if (era) {
    setTheme(era.dataset.era);
    return;
  }
  if (!e.target.closest("#menu-root")) closeMenu();
});
document.addEventListener("mouseover", (e) => {
  const b = e.target.closest("[data-menu]");
  if (b && menuName && menuName !== b.dataset.menu) showMenu(b.dataset.menu, b);
});
document.addEventListener("contextmenu", (e) => {
  const c = e.target.closest("[data-color]");
  if (c) {
    e.preventDefault();
    engine.setColors(engine.fg, c.dataset.color);
  }
});
document.addEventListener("dblclick", (e) => {
  const c = e.target.closest("[data-color]");
  if (c) editColors(c.dataset.color);
});
document.addEventListener("change", (e) => {
  const el = e.target;
  if (el.dataset.toggle) action(el.dataset.toggle);
  if (el.id === "ribbon-size") {
    engine.size = Number(el.value);
    renderOptions();
  }
  if (el.id === "shape-style") {
    engine.shapeMode = el.value;
    renderOptions();
  }
  if (el.id === "transparent") {
    engine.opaque = !el.checked;
    engine.drawOverlay();
    updateTextStyle();
    renderOptions();
  }
  if (el.id === "brush-type") {
    if (el.value === "airbrush") engine.setTool("airbrush");
    else {
      engine.brushShape = el.value;
      engine.setTool("brush");
    }
    engine.size = 6;
    renderOptions();
  }
});
$("#era").addEventListener("change", (e) => setTheme(e.target.value));
$("#current-colors").addEventListener("click", () =>
  engine.setColors(engine.bg, engine.fg),
);
$("#zoom-in").addEventListener("click", () => action("zoomIn"));
$("#zoom-out").addEventListener("click", () => action("zoomOut"));
$("#zoom-slider").addEventListener("input", (e) =>
  engine.setZoom(ZOOMS[e.target.value]),
);
$("#install").addEventListener("click", () => action("install"));
window.addEventListener("beforeinstallprompt", (e) => {
  e.preventDefault();
  installPrompt = e;
});
$("#open-file").addEventListener("change", (e) => {
  openFile(e.target.files[0], openMode);
  e.target.value = "";
});
$("#viewport").addEventListener(
  "wheel",
  (e) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      const r = e.currentTarget.getBoundingClientRect(),
        z =
          e.deltaY < 0
            ? ZOOMS.find((z) => z > engine.zoom) || 16
            : [...ZOOMS].reverse().find((z) => z < engine.zoom) || 0.25;
      engine.setZoom(z, { x: e.clientX - r.left, y: e.clientY - r.top });
    }
  },
  { passive: false },
);
document.addEventListener("paste", (e) => {
  if ($("#dialog").open || e.target.matches("input,textarea,[contenteditable]"))
    return;
  const file = [...(e.clipboardData?.items || [])]
    .find((x) => x.type.startsWith("image/"))
    ?.getAsFile();
  if (file) {
    e.preventDefault();
    openFile(file, "paste");
  } else if (engine.clipboard) {
    e.preventDefault();
    engine.paste(engine.clipboard);
  }
});
document.addEventListener("dragover", (e) => {
  if (e.dataTransfer.types.includes("Files")) e.preventDefault();
});
document.addEventListener("drop", (e) => {
  e.preventDefault();
  const file = [...e.dataTransfer.files].find(
    (f) =>
      f.type.startsWith("image/") ||
      /\.(bmp|png|jpe?g|webp|gif)$/i.test(f.name),
  );
  if (file) openFile(file, e.shiftKey ? "paste" : "open");
});
document.addEventListener("keydown", (e) => {
  if ($("#dialog").open) return;
  const editing = e.target.matches("input,textarea,select,[contenteditable]");
  if (e.key === "Escape") {
    if (textPosition) {
      $("#text-editor").value = "";
      commitText();
      scheduleAutosave();
    } else {
      engine.cancelGesture();
      engine.commitSelection();
    }
    closeMenu();
    return;
  }
  if (editing) {
    if (
      e.target.id === "text-editor" &&
      (e.ctrlKey || e.metaKey) &&
      ["b", "i", "u"].includes(e.key.toLowerCase())
    ) {
      e.preventDefault();
      const key = { b: "bold", i: "italic", u: "underline" }[
        e.key.toLowerCase()
      ];
      textOpts[key] = !textOpts[key];
      $(`[data-text-style="${key}"]`)?.classList.toggle(
        "active",
        textOpts[key],
      );
      updateTextStyle();
    }
    return;
  }
  const ctrl = e.ctrlKey || e.metaKey,
    key = e.key.toLowerCase();
  let cmd;
  if (ctrl) {
    const map = {
      n: e.shiftKey ? "clear" : "new",
      o: "open",
      s: e.shiftKey ? "saveas" : "save",
      z: e.shiftKey ? "redo" : "undo",
      y: "redo",
      x: e.shiftKey ? "crop" : "cut",
      c: "copy",
      a: "selectAll",
      r: "flip",
      w: "resize",
      e: "attributes",
      i: "invert",
      g: "grid",
      p: "print",
      t: "toggleTools",
      l: "toggleColors",
      f: "bitmap",
      pageup: "zoomNormal",
      pagedown: "zoomLarge",
    };
    cmd = map[key];
    if (key === "v") return;
  } else if (e.key === "F1") cmd = "help";
  else if (e.key === "F12") cmd = "saveas";
  else if (e.key === "Delete" || e.key === "Backspace") cmd = "delete";
  else if (e.key === "+" || e.key === "=") cmd = "zoomIn";
  else if (e.key === "-") cmd = "zoomOut";
  else if (key === "x") engine.setColors(engine.bg, engine.fg);
  else if (key === "d") engine.setColors("#000000", "#ffffff");
  else if (e.key === "Enter") engine.finishPending();
  if (cmd) {
    e.preventDefault();
    action(cmd);
  }
  if (engine.selection && e.key.startsWith("Arrow")) {
    e.preventDefault();
    const s = engine.selection,
      n = e.shiftKey ? 10 : 1;
    if (e.key === "ArrowLeft") s.x -= n;
    if (e.key === "ArrowRight") s.x += n;
    if (e.key === "ArrowUp") s.y -= n;
    if (e.key === "ArrowDown") s.y += n;
    engine.drawOverlay();
    dirty = true;
    updateTitle();
    scheduleAutosave();
  }
  if (e.altKey && !ctrl) {
    const names = {
        f: "File",
        e: "Edit",
        v: "View",
        i: "Image",
        c: "Colors",
        h: "Help",
      },
      name = names[key],
      b = $(`[data-menu="${name}"]`);
    if (b) {
      e.preventDefault();
      showMenu(name, b);
      $("#menu-root button:not(:disabled)")?.focus();
    }
  }
});
// Canvas handles resize the bitmap (not its display scale).
$$("[data-resize]").forEach((grip) =>
  grip.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    commitText();
    engine.commitSelection();
    const start = {
        x: e.clientX,
        y: e.clientY,
        w: engine.width,
        h: engine.height,
      },
      type = grip.dataset.resize;
    grip.setPointerCapture(e.pointerId);
    const move = (ev) => {
      const w = type.includes("e")
          ? Math.max(
              1,
              Math.min(
                8192,
                start.w + Math.round((ev.clientX - start.x) / engine.zoom),
              ),
            )
          : start.w,
        h = type.includes("s")
          ? Math.max(
              1,
              Math.min(
                8192,
                start.h + Math.round((ev.clientY - start.y) / engine.zoom),
              ),
            )
          : start.h;
      $("#dimensions").textContent = `${w} × ${h} px`;
    };
    const up = (ev) => {
      grip.removeEventListener("pointermove", move);
      grip.removeEventListener("pointerup", up);
      grip.removeEventListener("pointercancel", cancel);
      try {
        engine.resizeCanvas(
          type.includes("e")
            ? start.w + Math.round((ev.clientX - start.x) / engine.zoom)
            : start.w,
          type.includes("s")
            ? start.h + Math.round((ev.clientY - start.y) / engine.zoom)
            : start.h,
        );
      } catch (err) {
        engine.syncSize();
        errorDialog(err);
      }
    };
    const cancel = () => {
      grip.removeEventListener("pointermove", move);
      grip.removeEventListener("pointerup", up);
      engine.syncSize();
    };
    grip.addEventListener("pointermove", move);
    grip.addEventListener("pointerup", up);
    grip.addEventListener("pointercancel", cancel, { once: true });
  }),
);
function flushAutosave() {
  try {
    const data = engine.composite().toDataURL("image/png");
    if (data.length > 4000000) {
      toast(
        "This picture is too large for local recovery. Save it to keep your work.",
      );
      return;
    }
    const el = $("#text-editor"),
      text = textPosition
        ? {
            ...textPosition,
            w: el.offsetWidth / engine.zoom,
            h: el.offsetHeight / engine.zoom,
            value: el.value,
            opts: { ...textOpts },
          }
        : null;
    localStorage.setItem(
      "paint-recovery",
      JSON.stringify({
        data,
        filename,
        dirty,
        w: engine.width,
        h: engine.height,
        fg: engine.fg,
        bg: engine.bg,
        text,
      }),
    );
  } catch {
    toast("Local recovery is unavailable. Save your picture to keep it.");
  }
}
function scheduleAutosave() {
  clearTimeout(autosaveTimer);
  autosaveTimer = setTimeout(flushAutosave, 700);
}
$("#text-editor").addEventListener("input", () => {
  dirty = true;
  updateTitle();
  scheduleAutosave();
});
window.addEventListener("beforeunload", (e) => {
  if (testMode) return;
  clearTimeout(autosaveTimer);
  flushAutosave();
  if (dirty || textPosition || engine.selection) {
    e.preventDefault();
    e.returnValue = "";
  }
});
$("#palette").innerHTML = paletteHTML(colors);
renderTools();
try {
  theme = localStorage.getItem("paint-theme") || "98";
} catch {}
setTheme(theme);
updateTitle();
try {
  const saved = testMode
    ? null
    : JSON.parse(localStorage.getItem("paint-recovery") || "null");
  if (saved?.data && validSize(saved.w, saved.h)) {
    const image = new Image();
    image.onload = () => {
      if (dirty || engine.selection || textPosition) return;
      engine.load(image);
      filename = saved.filename || "Untitled";
      dirty = !!saved.dirty;
      if (
        /^#[\da-f]{6}$/i.test(saved.fg || "") &&
        /^#[\da-f]{6}$/i.test(saved.bg || "")
      )
        engine.setColors(saved.fg, saved.bg);
      if (saved.text?.value) {
        Object.assign(textOpts, saved.text.opts);
        engine.setTool("text");
        startText(saved.text);
        $("#text-editor").value = saved.text.value;
      }
      updateTitle();
      toast("Your last picture was recovered on this device.");
    };
    image.src = saved.data;
  }
} catch {}
if (!testMode && "serviceWorker" in navigator && location.protocol !== "file:")
  navigator.serviceWorker.register("./sw.js").catch(() => {});
window.paintDesktop?.onCommand((command) => {
  if (
    [
      "new",
      "open",
      "save",
      "saveas",
      "resize",
      "toggleTools",
      "toggleColors",
      "print",
      "clear",
      "exit",
    ].includes(command)
  )
    action(command);
});
