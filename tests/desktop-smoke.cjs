// Run with: PAINT_SMOKE_TEST=1 electron --headless --ozone-platform=headless tests/desktop-smoke.cjs
const { app } = require("electron");
app.setPath(
  "userData",
  require("node:path").join(
    require("node:os").tmpdir(),
    "classic-paint-desktop-test",
  ),
);
const timeout = setTimeout(() => {
  console.error("Desktop startup timed out");
  app.exit(1);
}, 20000);
app.on("browser-window-created", (_event, window) => {
  window.webContents.once("did-finish-load", async () => {
    try {
      const result = await window.webContents.executeJavaScript(
        `({title:document.title,tools:document.querySelectorAll('#tools [data-tool]').length,canvas:[document.querySelector('#canvas').width,document.querySelector('#canvas').height],native:typeof window.paintDesktop?.saveImage,ready:!!window.paint?.engine})`,
      );
      console.log(JSON.stringify(result));
      if (!result.ready || result.tools !== 16 || result.native !== "function")
        throw Error("Desktop did not initialize");
      clearTimeout(timeout);
      console.log(
        "PASS: desktop app, tools, native bridge, and local protocol",
      );
      app.exit(0);
    } catch (err) {
      clearTimeout(timeout);
      console.error(err);
      app.exit(1);
    }
  });
});
require("../desktop/main.cjs");
