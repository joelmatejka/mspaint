// Independently drawn icons. The classic set uses a native 16 × 16 pixel grid;
// the Windows 7 set uses colored, antialiased ribbon artwork.
const paths = {
  freeSelect:
    '<path stroke-dasharray="2 2" d="M5 4 13 3 18 8 15 13 18 18 9 20 3 14 5 10Z"/>',
  select: '<path stroke-dasharray="2 2" d="M3 4h17v15H3z"/>',
  eraser:
    '<path fill="#f6a2a2" d="m3 14 9-10 9 7-9 10z"/><path fill="#fff" d="m3 14 4-4 9 7-4 4z"/>',
  fill: '<path fill="#91a9ca" d="m3 10 7-7 10 9-7 7z"/><path fill="#fff" d="m3 10 7-7 10 9-7 1z"/><path d="m8 4 1-2 3 1 1 4"/><path fill="#0085dd" stroke="#0055b3" d="M20 14s-5 5-2 7c5 2 4-3 2-7"/>',
  picker:
    '<path fill="#a6d8e6" d="m4 16 9-10 4 4-9 10-5 1z"/><path fill="#555" d="m12 5 3-3 6 6-3 3z"/><path d="m4 16 4 4"/>',
  magnifier:
    '<circle cx="9" cy="9" r="6" fill="#c3e8f6"/><path stroke-width="4" d="m14 14 6 6"/><path stroke="#fff" d="m6 9 2-3"/>',
  pencil:
    '<path fill="#ffe566" d="m4 15 11-12 5 4L9 19z"/><path fill="#e0af71" d="m4 15-2 7 7-3z"/><path fill="#e5868e" d="m15 3 2-2 5 4-2 2z"/><path d="m3 19 1 2M7 16 17 5"/>',
  brush:
    '<path fill="#ce9b59" d="m12 12 7-11 3 2-7 12z"/><path fill="#afb9c3" d="m10 13 3-4 5 4-3 4z"/><path fill="#222" d="M11 13c-5 0-4 6-9 7 9 3 15-1 13-5z"/>',
  airbrush:
    '<path fill="#f8dc78" d="M4 10h9v11H4z"/><path fill="#7a9daa" d="M5 7h7v3H5z"/><path d="M8 3h4v4H8zM13 4h3"/><path stroke-dasharray="1 3" d="m17 3 5-2m-5 4 6 1m-6 1 5 4"/>',
  text: '<path stroke-width="2" d="m4 20 7-17h2l7 17M7 13h10M2 20h6m9 0h5"/>',
  line: '<path d="m3 20 18-17"/>',
  curve: '<path d="M3 20C25 20-2 3 21 3"/>',
  rect: '<path d="M3 5h18v14H3z"/>',
  polygon: '<path d="m3 19 5-15 6 7 7-5-3 13z"/>',
  ellipse: '<ellipse cx="12" cy="12" rx="10" ry="7"/>',
  roundRect: '<rect x="3" y="5" width="18" height="14" rx="4"/>',
  triangle: '<path d="m12 3 10 17H2z"/>',
  rightTriangle: '<path d="M3 3v18h18z"/>',
  diamond: '<path d="m12 2 10 10-10 10L2 12z"/>',
  pentagon: '<path d="m12 2 10 8-4 12H6L2 10z"/>',
  hexagon: '<path d="m7 3 10 0 6 9-6 9H7l-6-9z"/>',
  arrowRight: '<path d="M2 8h11V3l9 9-9 9v-5H2z"/>',
  arrowLeft: '<path d="M22 8H11V3l-9 9 9 9v-5h11z"/>',
  arrowUp: '<path d="M8 22V11H3l9-9 9 9h-5v11z"/>',
  arrowDown: '<path d="M8 2v11H3l9 9 9-9h-5V2z"/>',
  star: '<path d="m12 2 3 7 8 1-6 5 2 8-7-4-7 4 2-8-6-5 8-1z"/>',
  star4: '<path d="m12 1 3 8 8 3-8 3-3 8-3-8-8-3 8-3z"/>',
  star6: '<path d="m12 1 4 6 7 0-4 6 4 6h-7l-4 5-4-5H1l4-6-4-6h7z"/>',
  heart: '<path d="M12 21C-7 9 5-4 12 5c7-9 19 4 0 16Z"/>',
  lightning: '<path d="m15 1-11 13h7l-2 9L21 9h-7z"/>',
  bubble: '<path d="M3 3h18v13H10l-5 6v-6H3z"/>',
  cloud: '<path d="M5 18c-7-2-4-10 1-10-1-6 9-8 11-2 7-1 9 9 3 11z"/>',
  copy: '<path fill="#fff" d="M3 2h12v15H3zM9 8h12v15H9z"/><path stroke="#555" d="M12 12h6m-6 3h6m-6 3h6"/>',
  paste:
    '<path fill="#c99647" d="M4 4h14v18H4z"/><path fill="#fff" d="M8 8h13v15H8z"/><path fill="#ddd" d="M8 2h7v5H8z"/><path d="M11 12h7m-7 3h7m-7 3h7"/>',
  cut: '<circle cx="5" cy="18" r="3"/><circle cx="17" cy="18" r="3"/><path d="m7 16 11-14M15 16 5 2"/>',
  crop: '<path stroke-width="2" d="M6 1v17h17M1 6h17v17"/>',
  resize:
    '<path fill="#fff" d="M2 6h14v16H2z"/><path stroke="#4885bf" stroke-width="2" d="M9 3h12v12m0-12L9 15"/>',
  rotate:
    '<path stroke="#4b84c0" stroke-width="2" d="M4 9a9 9 0 1 1 0 9M1 4v7h7"/>',
  save: '<path fill="#7c9aba" d="M3 2h16l3 3v17H3z"/><path fill="#fff" d="M6 2h11v7H6zM6 13h13v9H6z"/><path d="M14 3v4M8 16h9m-9 3h9"/>',
  undo: '<path stroke="#4387c7" stroke-width="2" d="M7 7c17-7 20 15 3 14M7 2 2 8l8 4"/>',
  redo: '<path stroke="#4387c7" stroke-width="2" d="M17 7C0 0-3 22 14 21M17 2l5 6-8 4"/>',
  ovalBubble: '<path d="M9 18 4 22l2-7C-4 4 15-3 22 6c5 8-5 15-13 12Z"/>',
  roundBubble:
    '<path d="M7 3h11q4 0 4 4v7q0 4-4 4h-8l-6 4 1-5q-3 0-3-4V7q0-4 5-4Z"/>',
  new: '<path fill="#fff" stroke="#6985a1" d="M5 2h10l5 5v15H5z"/><path fill="#d7e6f3" stroke="#6985a1" d="M15 2v5h5"/>',
  open: '<path fill="#e8af35" stroke="#987027" d="M2 6h7l2-3h7v17H2z"/><path fill="#ffe396" stroke="#a87821" d="m2 20 3-11h17l-4 11z"/>',
  print:
    '<path fill="#fff" stroke="#708293" d="M6 1h12v8H6z"/><path fill="#b9cbdc" stroke="#526779" d="M2 7h20v12H2z"/><path fill="#fff" stroke="#708293" d="M6 14h12v9H6z"/><path stroke="#8b9db0" d="M9 17h6m-6 3h6"/><path stroke="#24a644" stroke-width="2" d="M17 10h2"/>',
  help: '<circle fill="#428fe0" stroke="#1d5ba7" cx="12" cy="12" r="10"/><path stroke="#fff" stroke-width="2" d="M8 8c0-5 9-4 8 1-1 3-4 2-4 6m0 2v2"/>',
  install:
    '<path fill="#fff" stroke="#708293" d="M3 3h18v18H3z"/><path fill="#4193dc" stroke="#23609b" d="M9 5h6v7h4l-7 7-7-7h4z"/>',
  fullscreen:
    '<path stroke-width="2" d="M3 9V3h6m6 0h6v6m0 6v6h-6m-6 0H3v-6"/>',
  minimize: '<path stroke-width="2" d="M5 17h14"/>',
  maximize: '<path d="M4 4h16v16H4z"/><path stroke-width="3" d="M4 5h16"/>',
  close: '<path stroke-width="2" d="m5 5 14 14M19 5 5 19"/>',
  colors:
    '<path fill="#ed1c24" stroke="#ba3838" d="M2 2h6v6H2z"/><path fill="#fff200" stroke="#cdb900" d="M9 2h6v6H9z"/><path fill="#22b14c" stroke="#197e36" d="M16 2h6v6h-6z"/><path fill="#00a2e8" stroke="#0072a4" d="M2 9h6v6H2z"/><path fill="#3f48cc" stroke="#30379a" d="M9 9h6v6H9z"/><path fill="#a349a4" stroke="#7d387d" d="M16 9h6v6h-6z"/><path fill="#ffc90e" stroke="#bf970b" d="M2 16h6v6H2z"/><path fill="#99d9ea" stroke="#72a3b0" d="M9 16h6v6H9z"/><path fill="#ffaec9" stroke="#c9859b" d="M16 16h6v6h-6z"/>',
  diagonal:
    '<path fill="#173f77" d="m7 13 9-12 4 3-9 12z"/><path fill="#d3d8df" d="m7 12 5 3-3 4-5-4z"/><path fill="#292321" d="m4 15 5 4-7 3z"/>',
  diagonalBack:
    '<path fill="#173f77" d="m8 13 8-12 4 3-8 12z"/><path fill="#d3d8df" d="m8 12 4 4-3 3-5-4z"/><path fill="#292321" d="m4 15 5 4-8 1z"/>',
  oil: '<path fill="#b97732" d="m9 13 8-12 4 2-8 13z"/><path fill="#bcc7d2" d="m7 11 7 4-3 5-7-4z"/><path fill="#d5b682" d="m4 16 7 4-4 3-6-3z"/><path stroke="#896d42" d="m4 18 4 3m-3-5 4 4"/>',
  crayon:
    '<path fill="#c74628" d="m4 14 10-12 7 6-10 12z"/><path fill="#f9a789" d="m7 10 4-5 7 6-4 5z"/><path fill="#d96749" d="m4 14-2 8 9-2z"/>',
  marker:
    '<path fill="#dabf3d" d="m5 14 10-13 7 5-11 14z"/><path fill="#ffed8c" d="m7 13 9-11 4 3-9 12z"/><path fill="#333" d="m5 14 6 5-4 3-5-4z"/>',
  naturalPencil:
    '<path fill="#d8ad79" d="m5 15 11-14 5 4L10 19z"/><path fill="#efe0bd" d="m5 15-3 7 8-3z"/><path fill="#333" d="m3 19-1 3 3-1z"/><path stroke="#8a6643" d="M8 16 18 3"/>',
  watercolor:
    '<path fill="#c95e32" d="m11 12 7-11 3 2-7 12z"/><path fill="#bcc7d2" d="m9 11 5 3-3 4-5-3z"/><path fill="#a3c1de" d="M6 15c-1 4-2 5-5 6 8 3 11-1 10-4z"/>',
};
const px = (x, y, w, h, c = "#000") =>
  `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${c}"/>`;
const pixelPath = (d, fill = "none", stroke = "#000") =>
  `<path d="${d}" fill="${fill}" stroke="${stroke}" stroke-width="1"/>`;
const classic = {
  freeSelect: pixelPath(
    "M5.5 1.5h2m2 0h2m1 1v2m0 2 2 1m-1 2 1 2m-1 2h-2m-2 0h-2m-2 0h-2m-1-2v-2m0-2 2-1m0-2-1-2",
  ),
  select: pixelPath(
    "M1.5 2.5h2m2 0h2m2 0h2m2 0h1v2m0 2v2m0 2v2h-1m-2 0h-2m-2 0h-2m-2 0h-1v-2m0-2v-2m0-2v-1",
  ),
  eraser:
    pixelPath("m1.5 9.5 6-6h6l2 2-6 7h-6z", "#ffff80") +
    pixelPath("m1.5 9.5 3-3 3 3-2 3h-2z", "#fff") +
    pixelPath("m5.5 12.5 7-7h3l-6 7z", "#c0c0c0") +
    px(4, 13, 8, 1, "#808080"),
  fill:
    pixelPath("m1.5 6.5 5-5 7 7-5 5z", "#00ffff") +
    pixelPath("m1.5 6.5 5-5 7 7-7-1z", "#fff") +
    pixelPath("M5.5 2.5v-2h4v6") +
    pixelPath("m12.5 9.5 2 3v2h-3v-2z", "#000080"),
  picker:
    pixelPath("m1.5 12.5 8-8 3 3-8 8h-3z", "#fff") +
    pixelPath("m8.5 3.5 3-3 4 4-3 3z", "#000") +
    px(2, 12, 2, 2, "#ffff00") +
    pixelPath("m4.5 11.5 5-5", "none", "#808080"),
  magnifier:
    pixelPath("M3.5 1.5h6l3 3v6l-3 3h-6l-3-3v-6z", "#fff") +
    pixelPath("M4.5 2.5h4l3 3v4l-3 3h-4l-3-3v-4z", "#c0ffff") +
    px(3, 4, 1, 4, "#fff") +
    pixelPath("m10.5 11.5 1-1 4 3v2h-2z", "#000"),
  pencil:
    pixelPath("m4.5 11.5 6-11 3 2-6 11-4 2z", "#ffff00") +
    pixelPath("m4.5 11.5 3 2-4 2z", "#fff") +
    pixelPath("m5.5 10.5 6-9", "none", "#808000") +
    px(3, 14, 2, 1),
  brush:
    pixelPath("M7.5 1.5h2v7h-2z", "#ffff00") +
    pixelPath("M6.5 8.5h4v2h-4z", "#c0c0c0") +
    pixelPath("M5.5 10.5h6v4h-6z", "#000") +
    px(6, 10, 1, 3, "#808080") +
    px(8, 10, 1, 3, "#808080") +
    px(10, 10, 1, 3, "#808080") +
    px(7, 0, 2, 1),
  airbrush:
    pixelPath("m5.5 6.5 3-3 7 6-3 4z", "#0000ff") +
    pixelPath("m6.5 5.5 1-2 4 1-2 3z", "#c0c0c0") +
    pixelPath("m9.5 7.5 3 2", "none", "#00ffff") +
    [
      px(5, 1, 1, 1),
      px(2, 1, 1, 1),
      px(4, 3, 1, 1),
      px(0, 3, 1, 1),
      px(2, 5, 1, 1),
      px(0, 7, 1, 1),
    ].join(""),
  text:
    pixelPath("M1.5 13.5h5m3 0h5M3.5 13.5l5-12 5 12M5.5 9.5h6M7.5 2.5l5 11") +
    px(7, 1, 3, 1),
  line: pixelPath("m1.5 1.5 13 13"),
  curve: pixelPath("M6.5 1.5c-9 6 12 7 2 13"),
  rect: pixelPath("M1.5 3.5h13v9h-13z"),
  polygon: pixelPath("m1.5 12.5 4-10 4 7 5-5v8z"),
  ellipse: pixelPath("M5.5 3.5h5l3 2 1 2-1 3-3 2h-5l-3-2-1-3 1-2z"),
  roundRect: pixelPath("M4.5 3.5h7l3 3v3l-3 3h-7l-3-3v-3z"),
  copy:
    pixelPath("M1.5.5h9v11h-9z", "#fff") +
    pixelPath("M5.5 4.5h9v11h-9z", "#fff") +
    [6, 8, 10, 12].map((y) => px(7, y, 5, 1, "#000080")).join(""),
  paste:
    pixelPath("M2.5 2.5h10v12h-10z", "#808000") +
    pixelPath("M5.5 5.5h9v10h-9z", "#fff") +
    pixelPath("M5.5.5h5v4h-5z", "#c0c0c0") +
    [7, 9, 11].map((y) => px(7, y, 5, 1, "#000080")).join(""),
  cut: pixelPath(
    "m2.5 1.5 10 11m1-11-10 11M1.5 11.5h3l1 1v2h-4zM10.5 11.5h3l1 1v2h-4z",
  ),
  save:
    pixelPath("M1.5.5h11l2 2v13h-13z", "#000080") +
    pixelPath("M4.5.5h6v5h-6z", "#c0c0c0") +
    pixelPath("M4.5 8.5h7v7h-7z", "#fff") +
    px(8, 1, 2, 4, "#000") +
    px(6, 10, 4, 1, "#000080") +
    px(6, 12, 4, 1, "#000080"),
  crop: pixelPath("M4.5.5v11h11M.5 4.5h11v11"),
  resize:
    pixelPath("M.5 6.5h9v9h-9z", "#fff") +
    pixelPath("M6.5.5h9v9M15.5.5l-10 10", "none", "#000080"),
  rotate: pixelPath("M3.5 6.5a6 6 0 1 1 0 5M.5 2.5v5h6", "none", "#000080"),
  undo: pixelPath("M3.5 5.5c13-5 16 12 3 8M3.5.5l-3 5 5 3", "none", "#000080"),
  redo: pixelPath(
    "M12.5 5.5c-13-5-16 12-3 8M12.5.5l3 5-5 3",
    "none",
    "#000080",
  ),
  minimize: px(3, 11, 8, 2),
  maximize: pixelPath("M1.5 1.5h12v12h-12z") + px(2, 2, 11, 2),
  close:
    pixelPath("m2.5 2.5 10 10m-10 0 10-10") +
    pixelPath("m3.5 2.5 10 10m-10 0 10-10"),
  fullscreen: pixelPath("M.5 5.5v-5h5m4 0h5v5m0 4v5h-5m-4 0h-5v-5"),
  help:
    pixelPath("M5.5 4.5c0-6 10-5 8 1-1 2-4 1-4 5", "none", "#000080") +
    px(8, 12, 2, 2, "#000080"),
  install: pixelPath(
    "M.5 10.5v4h14v-4M7.5.5v11m-4-4 4 4 4-4",
    "none",
    "#000080",
  ),
  colors: [
    ["#ff0000", "#ffff00", "#00ff00"],
    ["#00ffff", "#0000ff", "#ff00ff"],
    ["#800000", "#008000", "#000080"],
  ]
    .flatMap((row, y) => row.map((c, x) => px(1 + x * 5, 1 + y * 5, 4, 4, c)))
    .join(""),
};
export const toolNames = {
  freeSelect: "Free-form select",
  select: "Select",
  eraser: "Eraser / Color eraser",
  fill: "Fill with color",
  picker: "Pick color",
  magnifier: "Magnifier",
  pencil: "Pencil",
  brush: "Brush",
  airbrush: "Airbrush",
  text: "Text",
  line: "Line",
  curve: "Curve",
  rect: "Rectangle",
  polygon: "Polygon",
  ellipse: "Ellipse",
  roundRect: "Rounded rectangle",
  triangle: "Triangle",
  rightTriangle: "Right triangle",
  diamond: "Diamond",
  pentagon: "Pentagon",
  hexagon: "Hexagon",
  arrowRight: "Right arrow",
  arrowLeft: "Left arrow",
  arrowUp: "Up arrow",
  arrowDown: "Down arrow",
  star: "Five-point star",
  star4: "Four-point star",
  star6: "Six-point star",
  heart: "Heart",
  lightning: "Lightning",
  bubble: "Rectangular callout",
  roundBubble: "Rounded rectangular callout",
  ovalBubble: "Oval callout",
  cloud: "Cloud callout",
};
export const classicTools = Object.keys(toolNames).slice(0, 16);
export const shapes = Object.keys(toolNames).slice(10);
export const iconNames = Object.keys(paths);
export function icon(name, theme = document.body.dataset.theme) {
  if (theme !== "7" && classic[name])
    return `<svg class="classic-icon" viewBox="0 0 16 16" shape-rendering="crispEdges" aria-hidden="true">${classic[name]}</svg>`;
  const shape = Object.keys(toolNames).slice(10).includes(name);
  return `<svg class="ribbon-icon" viewBox="0 0 24 24" fill="none" stroke="${shape ? "#31516f" : "#343b44"}" stroke-width="${shape ? 1.2 : 1.1}" stroke-linecap="square" stroke-linejoin="miter" aria-hidden="true">${paths[name] || paths.rect}</svg>`;
}
