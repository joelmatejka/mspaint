// Run the existing browser verification suite unattended in isolated Chromium.
// PAINT_SMOKE_TEST=1 electron --headless --ozone-platform=headless tests/regression.cjs
const { app } = require("electron");
const { createServer } = require("node:http");
const { readFile, mkdir, writeFile } = require("node:fs/promises");
const { mkdtempSync } = require("node:fs");
const { join, resolve, extname, sep } = require("node:path");
const root = resolve(__dirname, "..");
app.setPath(
  "userData",
  mkdtempSync(join(require("node:os").tmpdir(), "paint-regression-")),
);
const types = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".css": "text/css",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".webmanifest": "application/manifest+json",
};
const server = createServer(async (req, res) => {
  try {
    let pathname = new URL(req.url, "http://localhost").pathname;
    if (pathname.endsWith("/")) pathname += "index.html";
    const file = resolve(root, "." + decodeURIComponent(pathname));
    if (
      !["dist", "tests"].some((dir) => file.startsWith(join(root, dir) + sep))
    ) {
      res.writeHead(404).end();
      return;
    }
    const data = await readFile(file);
    res.writeHead(200, {
      "Content-Type": types[extname(file)] || "application/octet-stream",
    });
    res.end(data);
  } catch {
    if (!res.headersSent) res.writeHead(404);
    res.end();
  }
});
const timeout = setTimeout(() => {
  console.error("Regression test timeout");
  app.exit(1);
}, 45000);
app.on("browser-window-created", (_event, window) => {
  window.webContents.setBackgroundThrottling(false);
  window.webContents.once("did-finish-load", async () => {
    try {
      await new Promise((resolve, reject) => {
        server.once("error", reject);
        server.listen(0, "127.0.0.1", resolve);
      });
      await window.loadURL(`http://127.0.0.1:${server.address().port}/tests/`);
      await window.webContents.executeJavaScript(
        `document.querySelector('#run').click()`,
      );
      let result;
      for (let i = 0; i < 400; i++) {
        result = await window.webContents.executeJavaScript(
          `({summary:document.querySelector('#summary').textContent,failed:[...document.querySelectorAll('.fail')].map(el=>el.textContent)})`,
        );
        if (result.summary.startsWith("COMPLETE")) break;
        await new Promise((resolve) => setTimeout(resolve, 50));
      }
      if (!result.summary.startsWith("COMPLETE"))
        throw Error("Verification suite did not complete");
      await mkdir(join(root, "artifacts"), { recursive: true });
      await writeFile(
        join(root, "artifacts/regression.json"),
        JSON.stringify(result, null, 2) + "\n",
      );
      console.log(result.summary);
      for (const failure of result.failed) console.error(failure);
      clearTimeout(timeout);
      server.close();
      app.exit(result.failed.length ? 1 : 0);
    } catch (error) {
      clearTimeout(timeout);
      server.close();
      console.error(error);
      app.exit(1);
    }
  });
});
require("../desktop/main.cjs");
