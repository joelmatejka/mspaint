import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { resolve, extname, sep } from "node:path";
import { fileURLToPath } from "node:url";
const tests = process.argv.includes("--tests");
const base = fileURLToPath(
  new URL(tests ? "../" : "../dist/", import.meta.url),
);
const root = resolve(base),
  port = Number(process.env.PAINT_PORT || (tests ? 8766 : 8765));
const types = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".webmanifest": "application/manifest+json",
  ".json": "application/json",
};
const server = createServer(async (req, res) => {
  try {
    const pathname = decodeURIComponent(
      new URL(req.url, "http://localhost").pathname,
    );
    const file = resolve(root, "." + pathname);
    if (file !== root && !file.startsWith(root + sep)) {
      res.writeHead(403).end();
      return;
    }
    let target = file;
    const info = await stat(target);
    if (info.isDirectory()) target = resolve(target, "index.html");
    const data = await readFile(target);
    res.writeHead(200, {
      "Content-Type": types[extname(target)] || "application/octet-stream",
      "Cache-Control": "no-cache",
      "X-Content-Type-Options": "nosniff",
    });
    res.end(req.method === "HEAD" ? undefined : data);
  } catch {
    res.writeHead(404, { "Content-Type": "text/plain" }).end("Not found");
  }
});
server.listen(port, "127.0.0.1", () =>
  console.log(
    `Paint ${tests ? "verification" : "preview"}: http://127.0.0.1:${port}/${tests ? "tests/" : ""}`,
  ),
);
server.on("error", (err) => {
  console.error(err.message);
  process.exitCode = 1;
});
