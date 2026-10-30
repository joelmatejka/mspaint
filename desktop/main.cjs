const {
  app,
  BrowserWindow,
  Menu,
  protocol,
  net,
  ipcMain,
  dialog,
} = require("electron");
const { join, resolve, sep, basename } = require("node:path");
const { pathToFileURL } = require("node:url");
const { writeFile } = require("node:fs/promises");
const ROOT = resolve(__dirname, "../dist");
protocol.registerSchemesAsPrivileged([
  {
    scheme: "paint",
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      stream: true,
    },
  },
]);
let window,
  savedPath = null,
  closing = false;
function authorized(event) {
  return (
    event.sender === window?.webContents &&
    event.senderFrame?.url?.startsWith("paint://app/")
  );
}
async function createWindow() {
  closing = false;
  window = new BrowserWindow({
    width: 1120,
    height: 820,
    minWidth: process.env.PAINT_SMOKE_TEST === "1" ? 320 : 420,
    minHeight: 400,
    show: process.env.PAINT_SMOKE_TEST !== "1",
    title: "Paint",
    backgroundColor: "#c0c0c0",
    icon: join(ROOT, "icon-192.png"),
    webPreferences: {
      preload: join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  Menu.setApplicationMenu(null);
  window.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  window.webContents.on("will-navigate", (event, url) => {
    if (!url.startsWith("paint://app/")) event.preventDefault();
  });
  window.on("close", (event) => {
    if (!closing) {
      event.preventDefault();
      window.webContents.send("paint:command", "exit");
    }
  });
  window.webContents.on("will-prevent-unload", (event) => {
    if (closing) event.preventDefault();
  });
  window.webContents.on("before-input-event", (event, input) => {
    if (
      input.type === "keyDown" &&
      (input.control || input.meta) &&
      !input.alt &&
      ["n", "o", "s", "w", "t", "l", "p"].includes(input.key.toLowerCase())
    ) {
      event.preventDefault();
      const k = input.key.toLowerCase();
      const cmd = {
        n: input.shift ? "clear" : "new",
        o: "open",
        s: input.shift ? "saveas" : "save",
        w: "resize",
        t: "toggleTools",
        l: "toggleColors",
        p: "print",
      }[k];
      window.webContents.send("paint:command", cmd);
    }
  });
  window.on("closed", () => {
    window = null;
    savedPath = null;
  });
  await window.loadURL("paint://app/index.html");
}
app.whenReady().then(async () => {
  protocol.handle("paint", (request) => {
    try {
      const url = new URL(request.url);
      if (url.host !== "app") return new Response("Forbidden", { status: 403 });
      const pathname = decodeURIComponent(
          url.pathname === "/" ? "/index.html" : url.pathname,
        ),
        target = resolve(ROOT, "." + pathname);
      if (!target.startsWith(ROOT + sep))
        return new Response("Forbidden", { status: 403 });
      return net.fetch(pathToFileURL(target).toString());
    } catch {
      return new Response("Not found", { status: 404 });
    }
  });
  ipcMain.handle("paint:save", async (event, payload) => {
    if (
      !authorized(event) ||
      !payload ||
      !["png", "jpg", "bmp"].includes(payload.type) ||
      !(payload.data instanceof Uint8Array) ||
      payload.data.byteLength > 100663296
    )
      throw Error("Invalid image export.");
    if (payload.forceAs || !savedPath) {
      const result = await dialog.showSaveDialog(window, {
        title: "Save As",
        defaultPath: basename(String(payload.name || "Untitled.png")),
        filters: [
          {
            name:
              payload.type === "png"
                ? "PNG image"
                : payload.type === "jpg"
                  ? "JPEG image"
                  : "24-bit Bitmap",
            extensions: [payload.type],
          },
        ],
      });
      if (result.canceled || !result.filePath) return null;
      savedPath = result.filePath;
    }
    await writeFile(savedPath, payload.data);
    return { name: basename(savedPath) };
  });
  ipcMain.on("paint:new-document", (event) => {
    if (authorized(event)) savedPath = null;
  });
  ipcMain.on("paint:close", (event) => {
    if (authorized(event)) {
      closing = true;
      window.close();
    }
  });
  await createWindow();
  app.on("activate", () => {
    if (!BrowserWindow.getAllWindows().length) createWindow();
  });
});
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
