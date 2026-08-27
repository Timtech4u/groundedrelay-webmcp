#!/usr/bin/env bash
set -euo pipefail

project_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
storefront_url="http://localhost:5173/"
provider_url="http://localhost:5174/embed"
merchant_demo_url="http://localhost:5175/"

command -v node >/dev/null 2>&1 || {
  echo "BasketShipper needs Node.js, but 'node' is not available." >&2
  exit 1
}
command -v curl >/dev/null 2>&1 || {
  echo "BasketShipper's startup check needs curl, but 'curl' is not available." >&2
  exit 1
}

endpoint_matches() {
  local body
  body="$(curl --fail --silent --show-error --max-time 2 "$1" 2>/dev/null)" ||
    return 1
  grep --fixed-strings --quiet "$2" <<<"$body"
}

port_in_use() {
  node --input-type=module - "$1" <<'NODE'
import { createConnection } from "node:net";

const socket = createConnection({ host: "127.0.0.1", port: Number(process.argv[2]) });
const finish = (status) => {
  socket.destroy();
  process.exit(status);
};
socket.setTimeout(500, () => finish(1));
socket.once("connect", () => finish(0));
socket.once("error", (error) => finish(error.code === "ECONNREFUSED" ? 1 : 2));
NODE
}

storefront_ready=false
provider_ready=false
merchant_demo_ready=false
if endpoint_matches "$storefront_url" "<title>BasketShipper — fictional shopping demo</title>"; then
  storefront_ready=true
fi
if endpoint_matches "$provider_url" "<b>embed provider</b>"; then
  provider_ready=true
fi
if endpoint_matches "$merchant_demo_url" "Independent host proof"; then
  merchant_demo_ready=true
fi

if [[ "$storefront_ready" == true && "$provider_ready" == true && "$merchant_demo_ready" == true ]]; then
  echo "BasketShipper is already running."
  echo "Open $storefront_url in Codex's in-app browser."
  echo "Portability proof: $merchant_demo_url"
  exit 0
fi

if [[ "$storefront_ready" == true || "$provider_ready" == true || "$merchant_demo_ready" == true ]]; then
  echo "BasketShipper found only part of its three-origin local environment." >&2
  echo "Stop the process using ports 5173, 5174, or 5175, then run 'npm start' again." >&2
  exit 1
fi

occupied_ports=()
for port in 5173 5174 5175; do
  if port_in_use "$port"; then
    occupied_ports+=("$port")
  fi
done
if (( ${#occupied_ports[@]} > 0 )); then
  echo "BasketShipper cannot start because another process is using port(s): ${occupied_ports[*]}." >&2
  echo "Stop that process, then run 'npm start' again." >&2
  exit 1
fi

cd "$project_dir"
echo "Starting BasketShipper with hot reload on all three local origins."
echo "Open $storefront_url in Codex's in-app browser."
echo "Portability proof: $merchant_demo_url"
exec node server.js
