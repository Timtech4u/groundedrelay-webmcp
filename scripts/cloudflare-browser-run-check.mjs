#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("../", import.meta.url));
const WRANGLER = "wrangler@4.126.0";

function findWebSocket(value) {
  if (typeof value === "string" && /^wss:\/\//.test(value)) return value;
  if (Array.isArray(value)) {
    for (const candidate of value) {
      const found = findWebSocket(candidate);
      if (found) return found;
    }
  } else if (value && typeof value === "object") {
    for (const candidate of Object.values(value)) {
      const found = findWebSocket(candidate);
      if (found) return found;
    }
  }
  return null;
}

let sessionId = null;
try {
  const created = spawnSync("npx", [
    "--yes", WRANGLER, "browser", "create",
    "--lab", "--keepAlive", "600", "--json", "--open=false",
  ], {
    cwd: ROOT,
    encoding: "utf8",
    maxBuffer: 4 * 1024 * 1024,
  });
  if (created.status !== 0) {
    throw new Error("Cloudflare Browser Run could not create a WebMCP lab session. Verify Wrangler authentication and Browser Run access.");
  }

  let session;
  try { session = JSON.parse(created.stdout); }
  catch { throw new Error("Wrangler returned an unreadable Browser Run session response."); }
  sessionId = typeof session.sessionId === "string" ? session.sessionId : null;
  const webSocket = findWebSocket(session.targets ?? session);
  if (!sessionId || !webSocket) {
    throw new Error("Browser Run created a session without the required session id or WebSocket target.");
  }

  console.log("Cloudflare Browser Run WebMCP lab acquired; running the GroundedRelay native contract…");
  const probe = spawnSync(process.execPath, [
    fileURLToPath(new URL("./native-webmcp-check.mjs", import.meta.url)),
    ...process.argv.slice(2),
  ], {
    cwd: ROOT,
    env: { ...process.env, CLOUDFLARE_BROWSER_RUN_WS: webSocket },
    stdio: "inherit",
  });
  if (probe.error) throw probe.error;
  process.exitCode = probe.status ?? 1;
} catch (error) {
  console.error(`CLOUDFLARE_WEBMCP_LAB_FAILED ${error.message}`);
  process.exitCode = 1;
} finally {
  if (sessionId) {
    const closed = spawnSync("npx", [
      "--yes", WRANGLER, "browser", "close", sessionId, "--json",
    ], { cwd: ROOT, stdio: "ignore" });
    if (closed.status !== 0) {
      console.error("CLOUDFLARE_WEBMCP_LAB_WARNING Browser Run session cleanup was not confirmed.");
      process.exitCode = 1;
    }
  }
}
