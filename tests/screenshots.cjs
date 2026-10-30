// Visual regression fixtures for the app's own Chromium renderer; no user tabs are used.
const { app } = require("electron");
const { mkdir, writeFile } = require("node:fs/promises");
const { join } = require("node:path");
app.setPath(
  "userData",
  join(require("node:os").tmpdir(), "classic-paint-visual-test"),
);
app.on("browser-window-created", (_event, window) => {
  window.webContents.once("did-finish-load", async () => {
    try {
      const dir = join(__dirname, "../artifacts");
      await mkdir(dir, { recursive: true });
      for (const [width, height] of [
        [1024, 768],
        [360, 640],
      ])
        for (const theme of ["98", "xp", "7"]) {
          window.setContentSize(width, height);
          await window.webContents.executeJavaScript(
            `window.paint.setTheme('${theme}');new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))`,
          );
          const image = await window.webContents.capturePage();
          const name = `paint-${theme}-${width}.png`;
          await writeFile(join(dir, name), image.toPNG());
          console.log(name);
        }
      app.exit(0);
    } catch (error) {
      console.error(error);
      app.exit(1);
    }
  });
});
setTimeout(() => {
  console.error("Screenshot timeout");
  app.exit(1);
}, 25000).unref();
require("../desktop/main.cjs");
