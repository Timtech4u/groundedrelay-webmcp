import { createMerchantProviderGate } from "./provider-gate.js";
import { interpretApprovalResolution } from "./approval-resolution.js";
import { approvalVariantText, variantDisplayText } from "./approval-view.js";
import {
  handoffStoreFromHash,
  uniqueApprovedMerchantLinks,
} from "./handoff.js";
import {
  createSingleFlightReconciler,
  settleWithin,
} from "./tool-runtime.js";

const $ = (id) => document.getElementById(id);
const frame = $("provider");
const channel = crypto.randomUUID();
const local = ["localhost", "127.0.0.1"].includes(location.hostname);
const providerOrigin = local
  ? `${location.protocol}//${location.hostname}:5174`
  : new URL(frame.dataset.origin).origin;
const providerUrl = new URL("/embed", providerOrigin);
providerUrl.searchParams.set("hostOrigin", location.origin);
providerUrl.searchParams.set("channel", channel);
providerUrl.searchParams.set("scope", "rights-safe");
providerUrl.searchParams.set("backend", "demo");
frame.src = providerUrl.href;

let state = { catalog: [], cart: [], totals: [], revision: 0 };
let capabilities = {};
let providerToolCount = 0;
let wirePrefix = "wire__";
let declaredAnnotations = {};
let declaredTitles = {};
let currentApproval = null;
let modalReturnFocus = null;
let pendingHandoffReturnFocus = null;
let providerAnswered = false;
let providerFailed = false;
let providerTimer = null;
let checkoutRequestTimer = null;
let handoffTimer = null;
let approvalTimer = null;
let checkoutPending = false;
let approvalChoice = null;
let suppressHandoff = false;
let checkoutRequestId = null;
const PROVIDER_TIMEOUT_MS = 10_000;
const CHECKOUT_TIMEOUT_MS = 10_000;
const APPROVAL_TIMEOUT_MS = 8_000;
const TOOL_API_TIMEOUT_MS = 6_000;
const selected = new Map();
const chosenVariants = new Map();
let comparisonInvalidationRevision = null;
let lastBasketSignature = null;
const foreignTools = new Map();
const registrations = new Map();
const pendingRegistrations = new Map();
const activeExecutions = new Set();
const modelContext = document.modelContext || navigator.modelContext;
const providerGate = createMerchantProviderGate();
let pendingReady = null;
let pendingState = null;
let providerDescription = "Waiting for the provider handshake.";
let toolFallbackMessage = "";

const esc = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
}[char]));
const money = (amount, currency) => new Intl.NumberFormat(undefined, {
  style: "currency", currency: currency || "USD",
}).format(Number(amount ?? 0) / (10 ** new Intl.NumberFormat(undefined, {
  style: "currency", currency: currency || "USD",
}).resolvedOptions().maximumFractionDigits));
const publicName = (name) => name.startsWith(wirePrefix) ? name.slice(wirePrefix.length) : name;
const normalise = (value) => typeof value === "string" ? JSON.parse(value) : value;
const args = (value) => typeof value === "string" ? value : JSON.stringify(value ?? {});
const toProvider = (message) => frame.contentWindow.postMessage(
  { ...message, channel }, providerOrigin);
const focusable = "a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex='-1'])";
const matchesCheckoutRequest = (message) => checkoutRequestId
  ? message.requestId === checkoutRequestId
  : !message.requestId;
const setSearchEnabled = (enabled) => {
  $("query").disabled = !enabled;
  $("search-form").querySelector("button[type='submit']").disabled = !enabled;
};
const productKey = (product) => String(product.productId ?? product.sku);
const productForKey = (key) => (state.catalog ?? [])
  .find((product) => productKey(product) === key);
const chosenVariantFor = (product) => {
  const variants = Array.isArray(product?.variants) ? product.variants : [];
  const rememberedSku = chosenVariants.get(productKey(product));
  return variants.find((variant) => variant.sku === rememberedSku && variant.available)
    ?? variants.find((variant) => variant.sku === product.selectedVariant?.sku && variant.available)
    ?? variants.find((variant) => variant.available)
    ?? null;
};
const syncSelectedVariants = () => {
  for (const key of selected.keys()) {
    const product = productForKey(key);
    const variant = product ? chosenVariantFor(product) : null;
    if (variant) selected.set(key, variant.sku);
    else selected.delete(key);
  }
};
const renderedControlToken = () => {
  const active = document.activeElement;
  if (!active?.isConnected) return null;
  for (const [kind, key] of [
    ["variant", "variantFor"], ["select", "select"],
    ["add", "add"], ["remove", "remove"],
  ]) {
    if (active.dataset?.[key] != null) {
      return { kind, value: active.dataset[key] };
    }
  }
  return null;
};
const renderedControlFor = ({ kind, value } = {}) => {
  const key = kind === "variant" ? "variantFor" : kind;
  const root = kind === "remove" ? $("basket") : $("products");
  return [...(root?.querySelectorAll(`[data-${kind === "variant" ? "variant-for" : kind}]`) ?? [])]
    .find((control) => control.dataset?.[key] === value) ?? null;
};
const restoreRenderedControl = (token) => {
  if (!token) return;
  const control = renderedControlFor(token);
  if (control && !control.disabled) control.focus({ preventScroll: true });
  else if (token.kind === "remove") $("basket-panel").focus({ preventScroll: true });
};
const focusIfAvailable = (target) => {
  if (target?.isConnected && !target.disabled) target.focus({ preventScroll: true });
};
const basketSignature = (cart = []) => JSON.stringify(cart
  .map((line) => [String(line.sku), Number(line.qty ?? 0)])
  .sort(([left], [right]) => left.localeCompare(right)));
const announceBasketIfChanged = (cart, count) => {
  const signature = basketSignature(cart);
  if (lastBasketSignature === null) {
    lastBasketSignature = signature;
    if (count) $("basket-status").textContent =
      `Basket restored with ${count} item${count === 1 ? "" : "s"}.`;
    return;
  }
  if (signature === lastBasketSignature) return;
  lastBasketSignature = signature;
  $("basket-status").textContent = count
    ? `Basket updated. ${count} item${count === 1 ? "" : "s"}.`
    : "Basket updated. It is empty.";
};
const stateThroughComparisonGate = (message) => {
  if (comparisonInvalidationRevision === null) return message;
  const revision = Number(message.revision);
  if (!message.comparison && Number.isFinite(revision)
    && revision > comparisonInvalidationRevision) {
    comparisonInvalidationRevision = null;
    return message;
  }
  return { ...message, comparison: null };
};

function renderToolSurface() {
  if (toolFallbackMessage) {
    $("tool-status").textContent = registrations.size
      ? `${registrations.size} of ${providerToolCount} Site Tools active · direct controls available`
      : "Direct controls active · Site Tools unavailable";
  } else {
    $("tool-status").textContent = registrations.size
      ? `${registrations.size} of ${providerToolCount} provider actions active`
      : "Direct controls active · Site Tools unavailable";
  }
  $("provider-copy").textContent = toolFallbackMessage || providerDescription;
  $("tools").innerHTML = [...registrations.keys()]
    .map((name) => `<li>${esc(name)}</li>`).join("");
}

function showDirectControlsFallback(reason) {
  if (providerFailed) return;
  toolFallbackMessage = `${reason} Direct search, comparison, basket, and handoff controls remain active.`;
  renderToolSurface();
}

function renderHandoffAcknowledgement() {
  const store = handoffStoreFromHash(location.hash);
  const acknowledgement = $("handoff-ack");
  acknowledgement.hidden = !store;
  acknowledgement.textContent = store
    ? `Demo handoff acknowledged for ${store}. Demo only — no order was created, no merchant was contacted, and no payment is possible.`
    : "";
}

renderHandoffAcknowledgement();
addEventListener("hashchange", renderHandoffAcknowledgement);

function resetApprovalControls(message = "") {
  clearTimeout(approvalTimer);
  approvalTimer = null;
  $("approve").disabled = false;
  $("approve").textContent = "Yes, reveal links";
  $("veto").disabled = false;
  $("veto").textContent = "No, cancel";
  $("approval-status").textContent = message;
}

function clearCheckoutWait(message = "") {
  clearTimeout(checkoutRequestTimer);
  clearTimeout(handoffTimer);
  checkoutRequestTimer = null;
  handoffTimer = null;
  checkoutPending = false;
  checkoutRequestId = null;
  render();
  if (message) $("result-status").textContent = message;
}

function recoverProviderUi(message) {
  const handoffReturnFocus = pendingHandoffReturnFocus;
  pendingHandoffReturnFocus = null;
  suppressHandoff = true;
  currentApproval = null;
  approvalChoice = null;
  resetApprovalControls();
  clearCheckoutWait(message || "The provider could not finish. Try again.");
  closeModal("approval");
  closeModal("handoff");
  focusIfAvailable(handoffReturnFocus);
}

function providerUnavailable(reason) {
  providerFailed = true;
  providerAnswered = false;
  if (currentApproval) toProvider({ type: "host:veto", ...currentApproval });
  state = { catalog: [], cart: [], totals: [], revision: 0 };
  capabilities = {};
  selected.clear();
  comparisonInvalidationRevision = null;
  clearTimeout(providerTimer);
  providerTimer = null;
  recoverProviderUi(reason);
  $("tool-status").textContent = "Provider unavailable";
  $("provider-copy").textContent = reason;
  setSearchEnabled(false);
  $("compare").disabled = true;
  $("review").disabled = true;
  for (const controller of registrations.values()) controller.abort();
  for (const controller of pendingRegistrations.values()) controller.abort();
  registrations.clear();
  pendingRegistrations.clear();
  foreignTools.clear();
}

providerTimer = setTimeout(() => {
  if (!providerAnswered) providerUnavailable(
    "The cross-origin provider did not answer within 10 seconds. Refresh to retry.");
}, PROVIDER_TIMEOUT_MS);
frame.addEventListener("error", () => providerUnavailable(
  "The cross-origin provider frame failed to load. Refresh to retry."));

function openModal(id, initialFocus, returnFocus = document.activeElement) {
  modalReturnFocus = returnFocus;
  for (const region of document.querySelectorAll("body > header, body > main")) region.inert = true;
  $(id).hidden = false;
  $(initialFocus)?.focus();
}

function closeModal(id, { restoreFocus = true } = {}) {
  if ($(id).hidden) return;
  const returnFocus = modalReturnFocus;
  $(id).hidden = true;
  for (const region of document.querySelectorAll("body > header, body > main")) region.inert = false;
  modalReturnFocus = null;
  if (restoreFocus) focusIfAvailable(returnFocus);
}

function trapFocus(event, modal) {
  const controls = [...modal.querySelectorAll(focusable)]
    .filter((element) => element.getClientRects().length > 0);
  if (!controls.length) return;
  const first = controls[0];
  const last = controls.at(-1);
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault(); last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault(); first.focus();
  }
}

function desiredToolNames() {
  const desired = new Set(["list_shops", "get_shopping_state", "search_products"]);
  const hasResults = Boolean(state.catalog?.length);
  const hasBasket = Boolean(state.cart?.length);
  if (hasResults) {
    desired.add("inspect_products");
    desired.add("focus_products");
    desired.add("compare_products");
  }
  if (hasResults || hasBasket) desired.add("set_basket_quantity");
  if (state.comparison?.items?.length) desired.add("highlight_evidence");
  if (hasBasket) desired.add("prepare_checkout_handoff");
  return desired;
}

async function attachTool(tool) {
  const name = publicName(tool.name);
  if (registrations.has(name) || pendingRegistrations.has(name)) return;
  const controller = new AbortController();
  pendingRegistrations.set(name, controller);
  try {
    await settleWithin(modelContext.registerTool({
      name,
      title: tool.title ?? declaredTitles[name] ?? name,
      description: tool.description,
      inputSchema: normalise(tool.inputSchema),
      annotations: tool.annotations ?? declaredAnnotations[name],
      execute: async (input, { signal } = {}) => {
        activeExecutions.add(name);
        try {
          return await modelContext.executeTool(tool, args(input), { signal });
        } finally {
          activeExecutions.delete(name);
          scheduleReconcileTools();
        }
      },
    }, { signal: controller.signal }), `Attach ${name}`, TOOL_API_TIMEOUT_MS);
    if (!controller.signal.aborted) registrations.set(name, controller);
  } catch (error) {
    controller.abort(error);
    throw error;
  } finally {
    if (pendingRegistrations.get(name) === controller) {
      pendingRegistrations.delete(name);
    }
  }
}

async function reconcileToolsOnce() {
  if (providerFailed || !modelContext || !foreignTools.size) return;
  const desired = desiredToolNames();
  for (const [name, controller] of registrations) {
    if (!desired.has(name) && !activeExecutions.has(name)) {
      controller.abort();
      registrations.delete(name);
    }
  }
  for (const name of desired) {
    if (registrations.has(name) || pendingRegistrations.has(name)) continue;
    const tool = foreignTools.get(name);
    if (!tool) continue;
    try {
      await attachTool(tool);
    } catch (error) {
      showDirectControlsFallback(error?.name === "TimeoutError"
        ? `Site Tool ${name} timed out while attaching.`
        : `Site Tool ${name} could not attach.`);
    }
  }
  const missing = [...desired].filter((name) =>
    foreignTools.has(name) && !registrations.has(name));
  if (!missing.length && registrations.size) toolFallbackMessage = "";
  renderToolSurface();
}

const reconcileTools = createSingleFlightReconciler(reconcileToolsOnce);

function scheduleReconcileTools() {
  queueMicrotask(() => reconcileTools().catch((error) =>
    showDirectControlsFallback(`Site Tool reconciliation failed: ${error.message}.`)));
}

async function discoverTools() {
  if (providerFailed) return;
  if (!modelContext) {
    showDirectControlsFallback("This browser does not expose the WebMCP page API.");
    return;
  }
  let tools;
  try {
    tools = await settleWithin(
      modelContext.getTools({ fromOrigins: [providerOrigin] }),
      "Site Tools discovery", TOOL_API_TIMEOUT_MS);
  } catch (error) {
    showDirectControlsFallback(error?.name === "TimeoutError"
      ? "Site Tools discovery timed out."
      : `Site Tools discovery failed: ${error.message}.`);
    return;
  }
  for (const tool of tools.filter((candidate) => candidate.origin === providerOrigin)) {
    foreignTools.set(publicName(tool.name), tool);
  }
  if (!foreignTools.size) {
    showDirectControlsFallback("No provider Site Tools crossed the origin boundary.");
    return;
  }
  await reconcileTools();
}

function renderComparison() {
  const comparison = state.comparison;
  if (!comparison?.items?.length) {
    $("comparison").hidden = true;
    $("comparison").innerHTML = "";
    return;
  }
  const evidence = new Set(comparison.highlighted ?? []);
  const exactVariants = comparison.rows.find((row) => row.key === "exact_variant")?.values ?? [];
  $("comparison").innerHTML = `<h3 id="comparison-title">Exact-option comparison</h3>
    <table><caption>Observed evidence for the selected products and exact variants.</caption>
    <thead><tr><th scope="col">Evidence</th>${comparison.items.map((item, index) =>
    `<th scope="col">${esc(item.name)}<small>${esc(exactVariants[index] ?? "Exact option")}</small></th>`).join("")}</tr></thead><tbody>${comparison.rows.map((row) =>
    `<tr class="${evidence.has(row.key) ? "evidence" : ""}"><th scope="row">${esc(row.label)}</th>${row.values.map((value) =>
      `<td>${esc(typeof value === "object" && value?.currency ? money(value.amount, value.currency) : value)}</td>`).join("")}</tr>`).join("")}</tbody></table>
    <button id="highlight" type="button">Highlight decision evidence</button>`;
  $("comparison").hidden = false;
  $("highlight").addEventListener("click", () => toProvider({
    type: "host:highlight",
    fields: ["merchant", "exact_variant", "availability", "currency", "current_price"],
  }));
}

function invalidateComparison(message) {
  if (!state.comparison?.items?.length && comparisonInvalidationRevision === null) return false;
  const revision = Number(state.revision);
  if (Number.isFinite(revision)) {
    comparisonInvalidationRevision = Math.max(
      comparisonInvalidationRevision ?? Number.NEGATIVE_INFINITY, revision);
  } else if (comparisonInvalidationRevision === null) {
    comparisonInvalidationRevision = -1;
  }
  state = { ...state, comparison: null };
  renderComparison();
  scheduleReconcileTools();
  if (message) $("result-status").textContent = message;
  toProvider({ type: "host:clear-comparison" });
  return true;
}

function renderProducts({ preserveFocus = true } = {}) {
  const returnFocus = preserveFocus ? renderedControlToken() : null;
  $("products").innerHTML = (state.catalog ?? []).map((product) => {
    const key = productKey(product);
    const chosen = chosenVariantFor(product);
    const variantLabel = variantDisplayText(chosen)
      ?? variantDisplayText(product.selectedVariant)
      ?? "No available option";
    const variants = Array.isArray(product.variants) ? product.variants : [];
    return `<article class="product">
    <label><input type="checkbox" data-select="${esc(key)}"
      aria-label="Compare ${esc(product.name)} — ${esc(variantLabel)}"
      ${selected.has(key) ? "checked" : ""} ${chosen ? "" : "disabled"}> Select for comparison</label>
    <h3>${esc(product.name)}</h3>
    <div class="meta">${esc(product.store)} · ${esc(product.merchantCountry)}</div>
    <label class="variant-picker">Exact option
      <select data-variant-for="${esc(key)}" aria-label="Choose option for ${esc(product.name)}"
        ${chosen ? "" : "disabled"}>${variants.map((variant) =>
          `<option value="${esc(variant.sku)}" ${variant.sku === chosen?.sku ? "selected" : ""}
            ${variant.available ? "" : "disabled"}>${esc(variantDisplayText(variant) ?? "Selected option")}${variant.available ? "" : " — unavailable"}</option>`).join("")}</select>
    </label>
    <footer><strong>${chosen ? esc(money(chosen.price, chosen.currency ?? product.currency)) : "Unavailable"}</strong>
      <button type="button" data-add="${esc(chosen?.sku ?? "")}" aria-label="Add ${esc(product.name)} — ${esc(variantLabel)}" ${chosen ? "" : "disabled"}>Add</button></footer>
  </article>`;
  }).join("");
  restoreRenderedControl(returnFocus);
}

function render() {
  const returnFocus = renderedControlToken();
  $("result-status").textContent = `${state.catalog?.length ?? 0} fictional demo product${state.catalog?.length === 1 ? "" : "s"}`;
  renderProducts({ preserveFocus: false });
  const count = (state.cart ?? []).reduce((sum, line) => sum + Number(line.qty ?? 0), 0);
  $("review").disabled = checkoutPending || !count || !capabilities.checkout;
  $("review").textContent = checkoutPending ? "Waiting for provider…" : "Review handoff";
  $("basket").innerHTML = count ? (state.cart ?? []).map((line) => {
    const variantLabel = variantDisplayText(line.selectedVariant) ?? "Selected option";
    return `<div class="line">
    <span>${esc(line.name)} ×${Number(line.qty)}<small>${esc(variantLabel)}</small></span><span>${esc(money(line.price * line.qty, line.currency))}
    <button type="button" data-remove="${esc(line.sku)}" aria-label="Remove ${esc(line.name)} — ${esc(variantLabel)}">×</button></span></div>`;
  }).join("")
    + `<div class="totals">${(state.totals ?? []).map((total) =>
      esc(money(total.total, total.currency))).join(" · ")}</div>`
    : "<p>Nothing selected yet.</p>";
  announceBasketIfChanged(state.cart ?? [], count);
  $("basket-jump").hidden = !count;
  $("basket-jump").textContent = count
    ? `View basket · ${count} item${count === 1 ? "" : "s"}`
    : "View basket";
  $("compare").disabled = selected.size < 2 || selected.size > 3;
  renderComparison();
  scheduleReconcileTools();
  restoreRenderedControl(returnFocus);
}

function processProviderMessage(message) {
  if (message.type === "embed:ready") {
    providerAnswered = true;
    clearTimeout(providerTimer);
    providerTimer = null;
    capabilities = message.capabilities ?? {};
    providerToolCount = message.tools?.length ?? 0;
    wirePrefix = message.wirePrefix ?? wirePrefix;
    declaredAnnotations = message.annotations ?? {};
    declaredTitles = message.titles ?? {};
    providerDescription = `${message.backend}. Origin ${providerOrigin}. All ${providerToolCount} capabilities belong to the provider, not this host.`;
    toolFallbackMessage = "";
    setSearchEnabled(true);
    renderToolSurface();
    if (message.dataMode !== "fictional" || !message.fictional) {
      providerUnavailable("Provider refused: expected BasketShipper-owned fictional data mode.");
      return;
    }
    discoverTools().catch((error) => showDirectControlsFallback(
      `Site Tools discovery failed: ${error.message}.`));
  }
  if (message.type === "embed:state") {
    if (!message.fictional || message.dataMode !== "fictional") return;
    state = stateThroughComparisonGate(message);
    syncSelectedVariants();
    render();
  }
  if (message.type === "embed:awaiting-approval") {
    if (!matchesCheckoutRequest(message)) return;
    clearTimeout(checkoutRequestTimer);
    checkoutRequestTimer = null;
    checkoutPending = true;
    approvalChoice = null;
    suppressHandoff = false;
    currentApproval = {
      approvalId: message.approvalId,
      revision: message.revision,
      ...(message.requestId ? { requestId: message.requestId } : {}),
    };
    $("approval-items").innerHTML = (message.cart ?? []).map((item) => {
      const variantText = approvalVariantText(item.selectedVariant)
        ?? "Exact variant: Selected option";
      return `<p><strong>${esc(item.store)}</strong> · ${esc(item.name)} ×${Number(item.qty)}<br>
        <small>${esc(variantText)}</small></p>`;
    }).join("");
    resetApprovalControls();
    openModal("approval", "veto");
  }
  if (message.type === "embed:approval-resolved") {
    if (!matchesCheckoutRequest(message)) return;
    clearTimeout(approvalTimer);
    approvalTimer = null;
    currentApproval = null;
    resetApprovalControls();
    const resolution = interpretApprovalResolution(message);
    if (resolution.waitForLinks) {
      pendingHandoffReturnFocus = modalReturnFocus?.isConnected
        ? modalReturnFocus : $("review");
      closeModal("approval", { restoreFocus: false });
      $("result-status").textContent = resolution.status;
      handoffTimer = setTimeout(() => {
        const returnFocus = pendingHandoffReturnFocus;
        pendingHandoffReturnFocus = null;
        suppressHandoff = true;
        clearCheckoutWait("The demo links did not arrive. Nothing opened; you can try again.");
        focusIfAvailable(returnFocus);
      }, CHECKOUT_TIMEOUT_MS);
    } else {
      suppressHandoff = true;
      clearCheckoutWait(resolution.status);
      pendingHandoffReturnFocus = null;
      closeModal("approval");
    }
  }
  if (message.type === "embed:ui-error") {
    if (message.action === "checkout" && !matchesCheckoutRequest(message)) return;
    recoverProviderUi("The provider could not finish that action. Nothing opened; try again.");
  }
  if (message.type === "embed:handoff") {
    if (!matchesCheckoutRequest(message)) return;
    clearTimeout(handoffTimer);
    handoffTimer = null;
    checkoutPending = false;
    checkoutRequestId = null;
    render();
    const returnFocus = pendingHandoffReturnFocus ?? $("review");
    pendingHandoffReturnFocus = null;
    if (suppressHandoff) {
      focusIfAvailable(returnFocus);
      return;
    }
    const links = uniqueApprovedMerchantLinks(message.handoff, location.origin);
    $("handoff-links").innerHTML = links.map((item) =>
      `<a href="${esc(item.url)}" target="_blank" rel="noopener">${esc(item.store)} · Open demo ↗</a>`).join("");
    if (links.length) openModal("handoff", "close-handoff", returnFocus);
    else focusIfAvailable(returnFocus);
  }
}

addEventListener("message", (event) => {
  if (event.origin !== providerOrigin || event.source !== frame.contentWindow
    || event.data?.channel !== channel || providerGate.rejected || providerFailed) return;
  const message = event.data ?? {};
  if (["embed:ready", "embed:state"].includes(message.type)) {
    const kind = message.type === "embed:ready" ? "ready" : "state";
    const outcome = providerGate.receive(kind, message);
    if (outcome.rejected) {
      pendingReady = null;
      pendingState = null;
      providerUnavailable("Provider refused: expected protocol-2 BasketShipper-owned fictional ready and state evidence.");
      return;
    }
    if (kind === "ready") pendingReady = message;
    else pendingState = message;
    if (outcome.becameReady) {
      processProviderMessage(pendingReady);
      processProviderMessage(pendingState);
      pendingReady = null;
      pendingState = null;
    } else if (outcome.wasActive && kind === "state") {
      processProviderMessage(message);
    }
    return;
  }
  if (!providerGate.active) return;
  processProviderMessage(message);
});

$("search-form").addEventListener("submit", (event) => {
  event.preventDefault();
  if (!providerGate.active || providerFailed) {
    $("result-status").textContent = "The fictional catalogue is still connecting.";
    return;
  }
  const query = $("query").value.trim();
  selected.clear();
  invalidateComparison();
  renderProducts();
  $("compare").disabled = true;
  if (!query) {
    $("result-status").textContent =
      "Search cleared. Showing the current fictional catalogue.";
    return;
  }
  $("result-status").textContent = "Searching the fictional catalogue…";
  toProvider({ type: "host:search", query });
});
$("products").addEventListener("change", (event) => {
  const input = event.target.closest("[data-select]");
  if (input) {
    const product = productForKey(input.dataset.select);
    const variant = product ? chosenVariantFor(product) : null;
    if (input.checked && variant) selected.set(input.dataset.select, variant.sku);
    else selected.delete(input.dataset.select);
    $("compare").disabled = selected.size < 2 || selected.size > 3;
    invalidateComparison("Selection changed. Compare again to refresh the evidence.");
    return;
  }
  const picker = event.target.closest("[data-variant-for]");
  if (!picker) return;
  const product = productForKey(picker.dataset.variantFor);
  const variant = product?.variants?.find((candidate) =>
    candidate.sku === picker.value && candidate.available);
  if (!variant) return;
  chosenVariants.set(picker.dataset.variantFor, variant.sku);
  if (selected.has(picker.dataset.variantFor)) {
    selected.set(picker.dataset.variantFor, variant.sku);
  }
  invalidateComparison("Exact option changed. Compare again to refresh the evidence.");
  renderProducts();
  [...$("products").querySelectorAll("[data-variant-for]")]
    .find((control) => control.dataset.variantFor === picker.dataset.variantFor)?.focus();
});
$("products").addEventListener("click", (event) => {
  const button = event.target.closest("[data-add]");
  if (button) toProvider({ type: "host:add", sku: button.dataset.add, quantity: 1 });
});
$("basket").addEventListener("click", (event) => {
  const button = event.target.closest("[data-remove]");
  if (button) toProvider({ type: "host:remove", sku: button.dataset.remove });
});
$("compare").addEventListener("click", () => toProvider({
  type: "host:compare", skus: [...selected.values()],
}));
$("basket-jump").addEventListener("click", () => {
  $("basket-panel").scrollIntoView({
    behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
    block: "start",
  });
  $("basket-panel").focus({ preventScroll: true });
});
$("review").addEventListener("click", () => {
  if (checkoutPending) return;
  pendingHandoffReturnFocus = null;
  checkoutPending = true;
  checkoutRequestId = crypto.randomUUID();
  suppressHandoff = false;
  approvalChoice = null;
  render();
  $("result-status").textContent = "Preparing the human review…";
  clearTimeout(checkoutRequestTimer);
  checkoutRequestTimer = setTimeout(() => {
    suppressHandoff = true;
    toProvider({ type: "host:veto", requestId: checkoutRequestId });
    clearCheckoutWait("The provider did not open the review. Nothing changed; try again.");
  }, CHECKOUT_TIMEOUT_MS);
  toProvider({ type: "host:checkout", requestId: checkoutRequestId });
});
$("approve").addEventListener("click", () => {
  if (!currentApproval) return;
  approvalChoice = "approved";
  $("approve").disabled = true;
  $("approve").textContent = "Waiting…";
  $("veto").disabled = true;
  $("approval-status").textContent = "Waiting for the provider. No page has opened.";
  clearTimeout(approvalTimer);
  approvalTimer = setTimeout(() => {
    if (!currentApproval || $("approval").hidden) return;
    $("veto").disabled = false;
    $("veto").textContent = "Cancel anyway";
    $("approval-status").textContent =
      "The provider is taking too long. You can safely cancel; nothing has opened.";
    $("veto").focus();
  }, APPROVAL_TIMEOUT_MS);
  toProvider({ type: "host:approve", ...currentApproval });
});
$("veto").addEventListener("click", () => {
  approvalChoice = "vetoed";
  pendingHandoffReturnFocus = null;
  suppressHandoff = true;
  clearTimeout(approvalTimer);
  clearTimeout(checkoutRequestTimer);
  clearTimeout(handoffTimer);
  toProvider({ type: "host:veto", ...(currentApproval ?? {}),
    ...(checkoutRequestId ? { requestId: checkoutRequestId } : {}) });
  currentApproval = null;
  resetApprovalControls();
  clearCheckoutWait("Handoff cancelled. The fictional basket is unchanged.");
  closeModal("approval");
});
$("close-handoff").addEventListener("click", () => closeModal("handoff"));
$("approval").addEventListener("click", (event) => {
  if (event.target === $("approval") && !$("veto").disabled) $("veto").click();
});
$("handoff").addEventListener("click", (event) => {
  if (event.target === $("handoff")) closeModal("handoff");
});
addEventListener("keydown", (event) => {
  if (!$("approval").hidden) {
    if (event.key === "Escape" && !$("veto").disabled) {
      event.preventDefault(); $("veto").click();
    } else if (event.key === "Tab") trapFocus(event, $("approval"));
    return;
  }
  if (!$("handoff").hidden) {
    if (event.key === "Escape") { event.preventDefault(); closeModal("handoff"); }
    else if (event.key === "Tab") trapFocus(event, $("handoff"));
  }
});
