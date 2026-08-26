import { createRightsSafeBackend } from "./backends/demo.js";
import {
  approvalCartSnapshot,
  approvalRevisionResult,
} from "./approval.js";
import {
  checkoutAbort,
  createCheckoutLifecycle,
  safeRequestId,
} from "./checkout-lifecycle.js";
import {
  compactInspection,
  compactSearch,
  compactShopList,
  compactShoppingState,
} from "./tool-output.js";

// The kit provider runs on its OWN origin in an iframe. It owns the catalogue,
// basket, and tool implementations; each merchant surface still supplies a
// small host adapter for the handshake, tool hoisting, and approval UI.
const params = new URL(location.href).searchParams;
const ancestorOrigin = location.ancestorOrigins?.[0] ??
  (document.referrer ? new URL(document.referrer).origin : null);
const requestedHostOrigin = params.get("hostOrigin");
const CHANNEL_NONCE = params.get("channel") ?? "";
const DEPLOYED_HOSTS = new Set([
  "https://groundedrelay.pages.dev",
  "https://groundedrelay-merchant.pages.dev",
]);
const isLocalHost = (origin) => {
  try {
    const url = new URL(origin);
    return url.protocol === "http:"
      && ["localhost", "127.0.0.1"].includes(url.hostname)
      && ["5173", "5175"].includes(url.port);
  } catch { return false; }
};
const HOST_ORIGIN = requestedHostOrigin
  && requestedHostOrigin === ancestorOrigin
  && (DEPLOYED_HOSTS.has(requestedHostOrigin) || isLocalHost(requestedHostOrigin))
  ? requestedHostOrigin
  : null;

const logEl = document.getElementById("log");
document.getElementById("origin").textContent = location.origin;

const post = (msg) => {
  if (HOST_ORIGIN) parent.postMessage({ ...msg, channel: CHANNEL_NONCE }, HOST_ORIGIN);
};
function log(msg, cls = "dim") {
  const line = document.createElement("div");
  line.className = cls;
  line.textContent = msg;
  logEl.append(line);
  post({ type: "embed:log", msg, cls });
}

const modelContext = document.modelContext || navigator.modelContext;

// Tools cross the boundary under a prefixed name and are hoisted under the
// clean one. Sharing a name with the hoisted copy makes executeTool fail.
const WIRE_PREFIX = "wire__";

// The submitted provider has one data mode: a GroundedRelay-owned fictional fixture.
// Keeping third-party catalogue adapters out of the public tree makes the
// deployed behaviour, source rights, and judge story identical.
const localIntegration = isLocalHost(HOST_ORIGIN);
const merchantDemoBase = localIntegration
  ? `${new URL(HOST_ORIGIN).protocol}//${new URL(HOST_ORIGIN).hostname}:5175/`
  : "https://groundedrelay-merchant.pages.dev/";

let backend;
try {
  backend = createRightsSafeBackend({ merchantOrigin: merchantDemoBase });
} catch (error) {
  // Misconfiguration is still a completed handshake. Report it immediately
  // instead of making the host infer failure from a permanent silent frame.
  backend = {
    label: "fictional demo unavailable",
    capabilities: {},
    state: () => ({ catalog: [], cart: [], totals: [], reachable: [] }),
    catalog: async () => { throw error; },
  };
  queueMicrotask(() => log(`configuration: ${error.message}`, "bad"));
}

const dataDisclosure = () => backend.state().fixture?.rightsSafe
  ? {
      data_mode: "fictional_judge_demo",
      data_notice: "GroundedRelay-owned fictional catalogue; not a real merchant, offer, or order flow.",
    }
  : {};
const withDataDisclosure = (payload) => ({ ...dataDisclosure(), ...payload });
const state = () => {
  const current = backend.state();
  return {
    type: "embed:state",
    dataMode: current.fixture?.rightsSafe ? "fictional" : "unavailable",
    fictional: Boolean(current.fixture?.fictional),
    ...current,
  };
};
const sync = () => post(state());
let activeUiSearchController = null;

async function withinUiDeadline(operation, callerSignal, ms = 10_000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(
    new DOMException("The shop took too long to respond", "TimeoutError")), ms);
  const abort = () => controller.abort(
    callerSignal?.reason ?? new DOMException("Aborted", "AbortError"));
  if (callerSignal?.aborted) abort();
  else callerSignal?.addEventListener("abort", abort, { once: true });
  try {
    return await operation(controller.signal);
  } finally {
    clearTimeout(timeout);
    callerSignal?.removeEventListener("abort", abort);
  }
}

// Checkout is the one consequential action, so an agent can only request it.
// The promise below is resolved or rejected by a separate, origin-checked
// message from the human controls in the host page.
let pendingCheckout = null;
let checkoutInFlight = false;
const requestMetadata = (requestId) => requestId ? { requestId } : {};
const postApprovalResolved = (resolution, requestId) => post({
  type: "embed:approval-resolved",
  ...resolution,
  ...requestMetadata(requestId),
});
addEventListener("message", async (e) => {
  if (!HOST_ORIGIN || e.origin !== HOST_ORIGIN || e.source !== parent
    || e.data?.channel !== CHANNEL_NONCE) return;
  if (e.data?.type === "host:clear-comparison") {
    backend.clearComparison?.();
    sync();
    return;
  }
  if (e.data?.type === "host:set-preferences") {
    try {
      backend.setPreferences?.({ deliveryCountry: e.data.deliveryCountry });
      sync();
      log(`delivery preference: ${e.data.deliveryCountry || "any published destination"}`, "ok");
    } catch (error) {
      post({ type: "embed:ui-error", action: "preferences", message: error.message });
    }
    return;
  }
  if (e.data?.type === "host:compare") {
    try {
      await withinUiDeadline((signal) => backend.compare(e.data.skus, signal));
      sync();
      log("shopper opened a product comparison", "ok");
    } catch (error) {
      log(`compare failed: ${error.message}`, "bad");
      post({ type: "embed:ui-error", action: "compare", message: error.message });
    }
    return;
  }
  if (e.data?.type === "host:highlight") {
    try {
      await backend.highlight(e.data.fields);
      sync();
      log("shopper highlighted comparison evidence", "ok");
    } catch (error) {
      log(`highlight failed: ${error.message}`, "bad");
      post({ type: "embed:ui-error", action: "highlight", message: error.message });
    }
    return;
  }
  if (e.data?.type === "host:search") {
    const uiSearchController = new AbortController();
    activeUiSearchController?.abort(
      new DOMException("Replaced by a new search", "AbortError"));
    activeUiSearchController = uiSearchController;
    try {
      const query = String(e.data.query ?? "").trim();
      if (!query) return;
      const input = backend.capabilities?.listShops
        ? { query, shipsTo: e.data.shipsTo ?? undefined } : query;
      const out = await withinUiDeadline(
        (signal) => backend.search(input, signal), uiSearchController.signal);
      const hits = Array.isArray(out) ? out : out.results;
      sync();
      log(`page search → ${hits.length} result(s)`, "ok");
      post({ type: "embed:search-complete", count: hits.length });
    } catch (error) {
      if (error?.name === "AbortError") {
        log("page search cancelled");
      } else {
        log(`page search failed: ${error.message}`, "bad");
        post({ type: "embed:ui-error", action: "search", message: error.message });
      }
    } finally {
      if (activeUiSearchController === uiSearchController) {
        activeUiSearchController = null;
      }
    }
    return;
  }
  if (e.data?.type === "host:cancel-search") {
    activeUiSearchController?.abort(new DOMException("The shopper cancelled search", "AbortError"));
    return;
  }
  if (e.data?.type === "host:add") {
    try {
      await withinUiDeadline((signal) => backend.add(
        String(e.data.sku ?? ""), Number(e.data.quantity ?? 1), signal));
      sync();
      log("shopper added an item", "ok");
      post({ type: "embed:add-complete" });
    } catch (error) {
      log(`add failed: ${error.message}`, "bad");
      post({ type: "embed:ui-error", action: "add", message: error.message });
    }
    return;
  }
  if (e.data?.type === "host:remove") {
    try {
      if (!backend.remove) throw new Error("This basket cannot remove items here");
      await withinUiDeadline((signal) => backend.remove(String(e.data.sku ?? ""), signal));
      sync();
      log("shopper removed an item", "ok");
    } catch (error) {
      log(`remove failed: ${error.message}`, "bad");
      post({ type: "embed:ui-error", action: "remove", message: error.message });
    }
    return;
  }
  if (e.data?.type === "host:checkout") {
    const requestId = safeRequestId(e.data.requestId);
    try {
      await requestCheckout(undefined, requestId);
    } catch (error) {
      if (error.name !== "AbortError") {
        post({
          type: "embed:ui-error", action: "checkout", message: error.message,
          ...requestMetadata(requestId),
        });
      }
    }
    return;
  }
  if (!["host:approve", "host:veto"].includes(e.data?.type)) return;
  if (!pendingCheckout) return;
  if (e.data?.type === "host:approve") {
    pendingCheckout.approve(e.data);
    return;
  }
  pendingCheckout.veto(e.data);
});

async function requestCheckout(signal, requestId) {
  if (checkoutInFlight) throw new Error("Another checkout is already in flight");
  checkoutInFlight = true;
  let approvalOpened = false;
  let resolutionOutcome = null;
  let lifecycle = null;
  try {
    const current = backend.state();
    if (!current.cart?.length) throw new Error("Basket is empty");
    const totals = current.totals ?? (current.total != null
      ? [{ currency: current.currency ?? "USD", total: current.total }]
      : []);
    const revision = Number(current.revision ?? 0);
    const approvalId = crypto.randomUUID();
    const cart = approvalCartSnapshot(current.cart);
    lifecycle = createCheckoutLifecycle({
      approvalId, revision, requestId, callerSignal: signal,
    });
    pendingCheckout = lifecycle;
    log("handoff — awaiting human review", "warn");
    post({
      type: "embed:awaiting-approval", totals, cart, revision, approvalId,
      ...requestMetadata(lifecycle.requestId),
    });
    approvalOpened = true;
    await lifecycle.approval;

    const revisionResult = approvalRevisionResult(
      revision, backend.state().revision ?? 0);
    if (!revisionResult.valid) {
      throw checkoutAbort(
        "The basket changed during approval. Review it again.", revisionResult.reason);
    }
    postApprovalResolved(revisionResult, lifecycle.requestId);
    resolutionOutcome = "approved";
    const out = await withinUiDeadline(
      (checkoutSignal) => backend.checkout(revision, checkoutSignal),
      lifecycle.signal, 15_000);
    sync();
    log("merchant handoff approved", "ok");
    if (out.handoff) post({
      type: "embed:handoff", handoff: out.handoff,
      ...requestMetadata(lifecycle.requestId),
    });
    return out.message;
  } catch (error) {
    if (approvalOpened && resolutionOutcome !== "rejected") {
      const reason = error?.approvalReason
        ?? (error?.name === "AbortError" ? "cancelled" : "error");
      postApprovalResolved(
        { outcome: "rejected", valid: false, reason }, lifecycle?.requestId);
      resolutionOutcome = "rejected";
    }
    log(`checkout ${error?.name === "AbortError" ? "cancelled" : "failed"}: ${error.message}`, "bad");
    throw error;
  } finally {
    lifecycle?.finish();
    if (pendingCheckout === lifecycle) pendingCheckout = null;
    checkoutInFlight = false;
  }
}

const objectSchema = (properties, required = []) => ({
  type: "object", properties, required, additionalProperties: false,
});
const skuArray = (minItems = 1) => ({
  type: "array", items: { type: "string", minLength: 1, maxLength: 180 },
  minItems, maxItems: 3, uniqueItems: true,
});
const expectedResult = async (operation) => {
  try {
    return JSON.stringify({ ok: true, ...withDataDisclosure(await operation()) });
  } catch (error) {
    if (error?.name === "AbortError") throw error;
    return JSON.stringify({
      ok: false,
      error: { code: "INVALID_STATE", message: String(error?.message ?? error).slice(0, 240), retryable: false },
    });
  }
};
const TOOL_DEFINITIONS = [
  {
    capability: "listShops",
    name: "list_shops",
    title: "View searchable shops",
    description: "List this provider's searchable catalogues with country, market, currency, readiness, reachability, and configured delivery coverage. GroundedRelay-owned fictional demo catalogues are labelled as such.",
    annotations: { readOnlyHint: true, untrustedContentHint: true },
    inputSchema: objectSchema({}),
    execute: async () => JSON.stringify(withDataDisclosure(
      compactShopList(await backend.listShops()))),
  },
  {
    capability: "shoppingState",
    name: "get_shopping_state",
    title: "Read the shared shopping state",
    description: "Read the current result set, visible comparison, focused products, human-edited basket, currency totals, and revision before making a change.",
    annotations: { readOnlyHint: true, untrustedContentHint: true },
    inputSchema: objectSchema({}),
    execute: async () => JSON.stringify({
      ok: true,
      ...withDataDisclosure(compactShoppingState(backend.state())),
    }),
  },
  {
    capability: "search",
    name: "search_products",
    title: "Search catalogues",
    description: "Search this provider's catalogues. Ranking happens in this browser and updates the visible page. Returns compact observed candidates, coverage, timestamp, and a result-set id. Prices use integer minor units plus ISO currency.",
    annotations: { untrustedContentHint: true },
    inputSchema: objectSchema({
      query: { type: "string", minLength: 2, maxLength: 120, description: "Product need, not instructions" },
      merchant_country: { type: "string", minLength: 2, maxLength: 40 },
      ships_to: { type: "string", pattern: "^[A-Za-z]{2}$", description: "Published delivery country code" },
    }, ["query"]),
    execute: async ({ query, merchant_country, ships_to }, { signal } = {}) => expectedResult(async () => {
      const searchInput = backend.capabilities?.listShops
        ? { query, merchantCountry: merchant_country, shipsTo: ships_to }
        : query;
      const out = await withinUiDeadline(
        (searchSignal) => backend.search(searchInput, searchSignal), signal);
      const hits = Array.isArray(out) ? out : out.results;
      sync();
      post({ type: "embed:search-complete", count: hits.length, source: "agent" });
      log(`search → ${hits.length} visible result(s)`);
      return compactSearch({
        ...out,
        resultSetId: out.resultSetId ?? backend.state().resultSetId ?? 0,
        observedAt: out.observedAt ?? backend.state().observedAt ?? null,
      }, hits, ships_to);
    }),
  },
  {
    capability: "inspect",
    name: "inspect_products",
    title: "Inspect product variants",
    description: "Inspect one to three products from the active results for exact variants, options, availability, provenance, and observed delivery evidence before adding.",
    annotations: { readOnlyHint: true, untrustedContentHint: true },
    inputSchema: objectSchema({
      skus: skuArray(1),
      option_query: { type: "string", minLength: 1, maxLength: 40, description: "Optional size or option value when a product has more than eight variants" },
    }, ["skus"]),
    execute: async ({ skus, option_query }) => expectedResult(async () => ({
      products: compactInspection(await backend.inspect(skus), option_query),
    })),
  },
  {
    capability: "focus",
    name: "focus_products",
    title: "Focus visible products",
    description: "Shortlist one to three exact products from the active result set on the visible page. This does not create rankings or claims.",
    annotations: { untrustedContentHint: true },
    inputSchema: objectSchema({ skus: skuArray(1) }, ["skus"]),
    execute: async ({ skus }) => expectedResult(async () => {
      const out = await backend.focus(skus); sync(); return out;
    }),
  },
  {
    capability: "compare",
    name: "compare_products",
    title: "Compare visible products",
    description: "Compare two or three exact products using only observed catalogue fields and render the comparison on the page.",
    annotations: { untrustedContentHint: true },
    inputSchema: objectSchema({ skus: skuArray(2) }, ["skus"]),
    execute: async ({ skus }) => expectedResult(async () => {
      const out = await backend.compare(skus); sync();
      log(`compare_products(${skus.length})`, "ok");
      return { compared: out.items.map(({ sku, name, store }) => ({ sku, name, merchant: store })), fields: out.rows.map((row) => row.key) };
    }),
  },
  {
    capability: "highlight",
    name: "highlight_evidence",
    title: "Highlight comparison evidence",
    description: "Highlight exact observed row keys in the visible comparison. It cannot add facts or free-form claims.",
    annotations: { untrustedContentHint: true },
    inputSchema: objectSchema({
      fields: {
        type: "array",
        items: { type: "string", enum: ["merchant", "merchant_country", "catalogue_market", "delivery_countries", "vendor", "product_type", "exact_variant", "availability", "currency", "current_price"] },
        minItems: 1, maxItems: 10, uniqueItems: true,
      },
    }, ["fields"]),
    execute: async ({ fields }) => expectedResult(async () => {
      await backend.highlight(fields); sync();
      log(`highlight_evidence(${fields.join(", ")})`, "ok");
      return { rendered: true, highlighted: fields };
    }),
  },
  {
    capability: "setQuantity",
    name: "set_basket_quantity",
    title: "Set basket quantity",
    description: "Set an exact variant quantity in the shared basket. Quantity zero removes it. Read shopping state first and pass its revision so human edits cannot be overwritten.",
    annotations: { untrustedContentHint: true },
    inputSchema: objectSchema({
      sku: { type: "string", minLength: 1, maxLength: 180, description: "Exact variant sku returned by search or inspect" },
      quantity: { type: "integer", minimum: 0, maximum: 25 },
      expected_state_revision: { type: "integer", minimum: 0 },
    }, ["sku", "quantity", "expected_state_revision"]),
    execute: async ({ sku, quantity, expected_state_revision }) => expectedResult(async () => {
      const out = await backend.setQuantity(sku, quantity, expected_state_revision); sync();
      log(`set_basket_quantity(${sku.slice(0, 28)} → ${quantity})`, "ok");
      return out;
    }),
  },
  {
    capability: "checkout",
    name: "prepare_checkout_handoff",
    title: "Review merchant handoff",
    description: "Prepare separate merchant links for the current basket revision. The call parks for explicit human review, never enters payment, never opens a merchant automatically, and never completes a purchase.",
    annotations: { untrustedContentHint: true },
    inputSchema: objectSchema({
      expected_state_revision: { type: "integer", minimum: 0 },
    }, ["expected_state_revision"]),
    execute: async ({ expected_state_revision }, { signal } = {}) => {
      if (Number(expected_state_revision) !== Number(backend.state().revision ?? 0)) {
        return JSON.stringify({ ok: false, error: { code: "STALE_STATE", message: "Basket changed. Read shopping state and ask again.", retryable: true } });
      }
      return requestCheckout(signal);
    },
  },
];

// Every definition is a truthful public action; capability filtering only
// protects against an accidentally incomplete fixture implementation.
const TOOLS = TOOL_DEFINITIONS.filter((tool) =>
  backend.capabilities?.[tool.capability] ?? typeof backend[tool.capability] === "function");

async function main() {
  if (!HOST_ORIGIN || !CHANNEL_NONCE) {
    log("provider refused: embedding origin is not allowed", "bad");
    return;
  }
  log(`provider connected · backend: ${backend.label}`);
  const registered = [];

  if (modelContext) {
    log("WebMCP available in provider frame", "ok");
    for (const tool of TOOLS) {
      try {
        await modelContext.registerTool(
          { ...tool, name: WIRE_PREFIX + tool.name },
          { exposedTo: [HOST_ORIGIN] });
        registered.push(tool);
        log(`registered ${tool.name}`, "ok");
      } catch (e) {
        log(`registerTool(${tool.name}) failed: ${e.name}: ${e.message}`, "bad");
      }
    }
  } else {
    log("WebMCP API unavailable · catalogue controls remain active", "warn");
  }

  sync();
  post({
    type: "embed:ready",
    protocol: 2,
    backend: backend.label,
    dataMode: backend.state().fixture?.rightsSafe ? "fictional" : "unavailable",
    fictional: Boolean(backend.state().fixture?.fictional),
    tools: registered.map((tool) => tool.name),
    capabilities: {
      ...backend.capabilities,
      remove: typeof backend.remove === "function",
    },
    toolSupport: Boolean(modelContext),
    wirePrefix: WIRE_PREFIX,
    // Current Chrome serializes annotations; this side channel preserves them
    // for compatibility with older WebMCP builds that omitted the field.
    annotations: Object.fromEntries(
      registered.filter((t) => t.annotations).map((t) => [t.name, t.annotations])),
    titles: Object.fromEntries(registered.map((tool) => [tool.name, tool.title ?? tool.name])),
  });

  // Catalogue loading happens after the handshake, never blocking it.
  withinUiDeadline((signal) => backend.catalog(signal))
    .then(() => {
      sync();
      const current = backend.state();
      post({
        type: "embed:catalog-ready",
        shops: current.reachable?.length ?? (current.catalog?.length ? 1 : 0),
      });
      log("catalogue loaded", "ok");
    })
    .catch((e) => {
      post({ type: "embed:catalog-ready", shops: 0, error: e.message });
      log(`catalogue: ${e.message}`, "bad");
    });
}

main();
