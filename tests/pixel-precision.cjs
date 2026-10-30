// Real Chromium mouse input checks for pixel picking at high zoom.
// PAINT_SMOKE_TEST=1 electron --headless --ozone-platform=headless tests/pixel-precision.cjs
const { app } = require("electron");
const { mkdtempSync, mkdirSync, writeFileSync } = require("node:fs");
const { join } = require("node:path");
app.setPath(
  "userData",
  mkdtempSync(join(require("node:os").tmpdir(), "paint-pixels-")),
);
let passed = 0,
  failed = 0;
const results = [];
const timeout = setTimeout(() => {
  console.error("Pixel precision test timed out");
  app.exit(1);
}, 60000);
app.on("browser-window-created", (_event, window) => {
  window.webContents.setBackgroundThrottling(false);
  window.webContents.once("did-finish-load", async () => {
    try {
      window.setContentSize(1024, 768);
      async function check(name, options) {
        const {
          theme = "98",
          zoom = 16,
          target = [12, 11],
          fraction = [0.9, 0.9],
          scroll = false,
          scale = 1,
          tool = "pencil",
        } = options;
        const rect = await window.webContents.executeJavaScript(`(() => {
          const e = window.paint.engine;
          window.paint.setTheme(${JSON.stringify(theme)});
          e.newImage(80,80);e.setZoom(${zoom});e.setTool(${JSON.stringify(tool)});
          e.wrap.style.transform = 'scale(${scale})';
          e.viewport.scrollLeft = ${scroll === "edge" ? 1000000 : scroll ? 319 : 0};e.viewport.scrollTop = ${scroll === "edge" ? 1000000 : scroll ? 233 : 0};
          if (${JSON.stringify(tool)} !== 'pencil') {
            e.ctx.fillStyle='#ff0000';e.ctx.fillRect(${target[0]},${target[1]},1,1);e.checkpoint();
            e.fg='#000000';e.size=1;
          }
          const r = e.overlay.getBoundingClientRect();
          return {left:r.left,top:r.top,width:r.width,height:r.height};
        })()`);
        const x = Math.floor(
          rect.left + ((target[0] + fraction[0]) * rect.width) / 80,
        );
        const y = Math.floor(
          rect.top + ((target[1] + fraction[1]) * rect.height) / 80,
        );
        window.webContents.sendInputEvent({ type: "mouseMove", x, y });
        window.webContents.sendInputEvent({
          type: "mouseDown",
          x,
          y,
          button: "left",
          clickCount: 1,
        });
        window.webContents.sendInputEvent({
          type: "mouseUp",
          x,
          y,
          button: "left",
          clickCount: 1,
        });
        // Let native input and pointer-capture events finish before inspecting
        // pixels or resetting the bitmap for the next independent gesture.
        await new Promise((resolve) => setTimeout(resolve, 40));
        const result = await window.webContents.executeJavaScript(`(() => {
          const e=window.paint.engine,im=e.image(),pixels=[];
          for(let y=0;y<im.height;y++)for(let x=0;x<im.width;x++){const i=(y*im.width+x)*4;if(im.data[i]!==255||im.data[i+1]!==255||im.data[i+2]!==255)pixels.push([x,y,...im.data.slice(i,i+3)]);}
          return {pixels,fg:e.fg};
        })()`);
        const expected =
          tool === "eraser"
            ? []
            : tool === "picker"
              ? [[...target, 255, 0, 0]]
              : [[...target, 0, 0, 0]];
        const ok =
          JSON.stringify(result.pixels) === JSON.stringify(expected) &&
          (tool !== "picker" || result.fg === "#ff0000");
        results.push({ name, ok, ...(!ok ? { expected, result } : {}) });
        if (ok) passed++;
        else {
          failed++;
          console.error(
            "FAIL " +
              name +
              " " +
              JSON.stringify({
                expected,
                result: {
                  pixels: result.pixels.slice(0, 5),
                  count: result.pixels.length,
                  fg: result.fg,
                },
              }),
          );
        }
      }
      for (const theme of ["98", "xp", "7"]) {
        for (const offset of [
          [0.1, 0.1],
          [0.49, 0.49],
          [0.5, 0.5],
          [0.9, 0.1],
          [0.1, 0.9],
          [0.9, 0.9],
          [0.99, 0.99],
        ])
          await check(
            `${theme}: 1600% click at ${offset.join(",")} of a pixel`,
            { theme, fraction: offset },
          );
        await check(`${theme}: last pixel at 1600% remains in bounds`, {
          theme,
          target: [79, 79],
          fraction: [0.99, 0.99],
          scroll: "edge",
        });
        for (const tool of ["pencil", "fill", "picker", "eraser"])
          await check(`${theme}: scrolled 1600% ${tool}`, {
            theme,
            scroll: true,
            target: [30, 25],
            tool,
          });
        await check(
          `${theme}: displayed canvas scaled independently of drawing zoom`,
          { theme, scale: 1.25 },
        );
      }
      for (const zoom of [1, 2, 4, 6, 8, 16])
        await check(`${zoom * 100}% pencil clicks the containing pixel`, {
          zoom,
          fraction: [0.9, 0.9],
        });
      const dir = join(__dirname, "../artifacts");
      mkdirSync(dir, { recursive: true });
      writeFileSync(
        join(dir, "pixel-precision.json"),
        JSON.stringify({ passed, failed, results }, null, 2) + "\n",
      );
      console.log(`Pixel precision: ${passed} passed, ${failed} failed`);
      clearTimeout(timeout);
      app.exit(failed ? 1 : 0);
    } catch (error) {
      clearTimeout(timeout);
      console.error(error);
      app.exit(1);
    }
  });
});
require("../desktop/main.cjs");
