const MAX_EVENTS = 500;
const runId = crypto.randomUUID();
const startedAt = performance.timeOrigin;
const events = [];

// Evidence stays deliberately metadata-only. Prompts, arguments, results,
// product strings, URLs, keys, and tokens never enter this buffer.
export function trace(event, details = {}) {
  const safe = {
    runId,
    atMs: Math.round(performance.now()),
    event: String(event).slice(0, 40),
  };
  for (const key of ["tool", "phase", "outcome"]) {
    if (details[key] != null) safe[key] = String(details[key]).slice(0, 80);
  }
  for (const key of ["duration", "resultCount", "reachableShopCount", "basketCount",
    "comparisonCount", "highlightCount"]) {
    if (Number.isFinite(Number(details[key]))) safe[key] = Number(details[key]);
  }
  events.push(safe);
  if (events.length > MAX_EVENTS) events.shift();
}

export function report() {
  return {
    schema: "groundedrelay-webmcp-run/v1",
    runId,
    startedAt: new Date(startedAt).toISOString(),
    exportedAt: new Date().toISOString(),
    privacy: "Metadata only; no prompts, arguments, results, product text, URLs, keys, or tokens.",
    events: [...events],
  };
}

export function downloadTrace() {
  const blob = new Blob([JSON.stringify(report(), null, 2)], { type: "application/json" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `groundedrelay-webmcp-run-${runId}.json`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(link.href), 0);
}

Object.defineProperty(window, "__groundedRelayTrace", {
  configurable: false,
  get: () => report(),
});

trace("page", { phase: "ready" });
