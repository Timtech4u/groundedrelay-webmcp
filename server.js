// Three static origins on one process, so we can exercise the cross-origin path
// locally: the host page and the embed must NOT be same-origin.
//   http://localhost:5173 -> sites/storefront  (the merchant's page)
//   http://localhost:5174 -> sites/embed       (the kit provider)
//   http://localhost:5175 -> sites/merchant-demo (independent portability proof)
// All three are potentially-trustworthy origins, which `exposedTo` / `fromOrigins`
// require.
import { createServer } from "node:http";
import { watch } from "node:fs";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
};

// Development-only live reload. The deployed sites remain plain static files;
// this script is injected by the local file server and never enters a build.
const LIVE_RELOAD_PATH = "/_dev/reload";
const LIVE_RELOAD_SCRIPT = `<script>
(() => {
  let connectedOnce = false;
  const events = new EventSource("${LIVE_RELOAD_PATH}");
  events.addEventListener("open", () => {
    if (connectedOnce) location.reload();
    connectedOnce = true;
  });
  events.addEventListener("reload", () => location.reload());
})();
</script>`;
const liveReloadClients = new Set();

function liveReload(req, res) {
  res.writeHead(200, {
    "content-type": "text/event-stream",
    "cache-control": "no-store",
    connection: "keep-alive",
  });
  res.write(": connected\n\n");
  liveReloadClients.add(res);
  req.on("close", () => liveReloadClients.delete(res));
}

// Keep sleeping tabs and intermediary sockets honest. EventSource reconnects
// automatically; the comment also gives us a cheap opportunity to discard a
// response that can no longer be written to.
setInterval(() => {
  for (const client of liveReloadClients) {
    if (client.destroyed || client.writableEnded) {
      liveReloadClients.delete(client);
      continue;
    }
    client.write(": heartbeat\n\n");
  }
}, 15000).unref();

let reloadTimer;
const siteWatcher = watch(
  new URL("./sites", import.meta.url),
  { recursive: true },
  (_event, filename) => {
    clearTimeout(reloadTimer);
    reloadTimer = setTimeout(() => {
      for (const client of liveReloadClients) {
        if (client.destroyed || client.writableEnded) {
          liveReloadClients.delete(client);
          continue;
        }
        client.write(`event: reload\ndata: ${filename ?? "change"}\n\n`);
      }
    }, 60);
  },
);
siteWatcher.on("error", (error) => {
  console.error(`live-reload watcher: ${error.message}`);
});

function serve(root, port, label) {
  createServer(async (req, res) => {
    const url = new URL(req.url, `http://localhost:${port}`);
    if (url.pathname === LIVE_RELOAD_PATH) return liveReload(req, res);
    let path = url.pathname === "/" ? "/index.html" : url.pathname;
    if (!extname(path)) path += ".html";   // match Vercel's cleanUrls locally
    const rel = normalize(path);
    const file = join(root, rel);
    try {
      let body = await readFile(file);
      if (extname(file) === ".html") {
        body = Buffer.from(`${body.toString()}\n${LIVE_RELOAD_SCRIPT}`);
      }
      res.writeHead(200, {
        "content-type": TYPES[extname(file)] ?? "application/octet-stream",
        // The `tools` permission must be delegated by the embedder's iframe
        // `allow` attribute; nothing to send here. We only need to make sure we
        // do not send a restrictive Permissions-Policy that would kill it.
        "cache-control": "no-store",
      });
      res.end(body);
    } catch {
      res.writeHead(404, { "content-type": "text/plain" });
      res.end("404");
    }
  }).listen(port, "127.0.0.1", () =>
    console.log(`${label}  http://localhost:${port}  (live reload)`));
}

serve(new URL("./sites/storefront", import.meta.url).pathname, 5173, "storefront");
serve(new URL("./sites/embed", import.meta.url).pathname, 5174, "embed     ");
serve(new URL("./sites/merchant-demo", import.meta.url).pathname, 5175, "host proof");
