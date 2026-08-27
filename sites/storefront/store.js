// The merchant's entire integration. It renders its own UI and hoists the
// provider's tools — it implements no tool logic of its own.
import { resolveProviderOrigin } from "./provider-origin.js";
import {
  classifyStorefrontExperience,
  createFictionalProviderGate,
  resolveStorefrontMode,
} from "./provider-mode.js";
import { createCheckoutLifecycle } from "./checkout-lifecycle.js";
import { createSerialQueue } from "./serial-queue.js";
import { approvalVariantText, variantDisplayText } from "./approval-view.js";
import { trace, downloadTrace } from "./trace.js";

const STOREFRONT_MODE = resolveStorefrontMode(location.href);
const EMBED_ORIGIN = resolveProviderOrigin(
  location.href,
  document.querySelector("#embed")?.dataset.origin,
);

const $ = (id) => document.getElementById(id);
const frame = document.getElementById("embed");
const CHANNEL_NONCE = crypto.randomUUID();
const PREFERENCE_KEY = "groundedrelay.preferences.v1";
let providerCapabilities = {};
let latestState = { catalog: [], cart: [], totals: [] };
let catalogPhase = "loading";
let lastRequestedQuery = "";
let providerTimer = null;
let checkoutBusy = false;
let checkoutTimer = null;
let approvalDecisionTimer = null;
let approvalChoice = null;
let pendingComparisonReveal = false;
let comparisonClearPending = false;
let pendingVariantFocus = null;
let totalProviderTools = 0;
let pendingBasketMutation = false;
// The submitted app has one truthful data mode: BasketShipper's owned,
// fictional fixture. The shell and the provider must attest the same mode.
let interactionBusy = false;
const providerModeGate = createFictionalProviderGate(STOREFRONT_MODE.requireFictional);
let pendingModeReady = null;
let pendingModeState = null;
const checkoutLifecycle = createCheckoutLifecycle();
let checkoutReturnFocus = null;

function applyExperienceCopy(configured = 0) {
  document.title = "BasketShipper — fictional shopping demo";
  $("catalogue-disclosure").hidden = false;
  $("catalogue-disclosure").textContent =
    "Fictional judge demo — all names, products and prices are BasketShipper-owned examples.";
  $("roster-summary").textContent = configured
    ? `${configured} BasketShipper-owned demo catalogue${configured === 1 ? "" : "s"} · market pinned`
    : "BasketShipper-owned fictional demo";
  $("intro-copy").textContent =
    "BasketShipper compares visible evidence across fictional African catalogues. You see every result, basket change and handoff; checkout never leaves your control.";
  $("journey-search").textContent = "Search fictional products";
  $("journey-compare").textContent = "Compare visible evidence";
  $("journey-review").textContent = "Review demo links";
  $("privacy-note").textContent = "Fictional ranking stays on this device";
  $("delivery-copy").textContent =
    "For my next demo search, filter by published example delivery to";
  searchPlaceholder = "Try “fictional eggs in Rwanda” or “fictional running shoes”";
  $("chat-input").placeholder = searchPlaceholder;
  $("search-submit").setAttribute("aria-label", "Search fictional products");
  $("results-eyebrow").textContent = "Fictional demo results";
  $("local-copy").textContent =
    "BasketShipper's fictional product fixture loads and ranks in your browser. BasketShipper has no search server, crawler or analytics pipeline.";
  $("brain").textContent = "fictional product search";
  $("rights-copy").textContent =
    "Fictional content is BasketShipper-owned; no partnership, endorsement or real offer is represented.";
  $("footer-copy").textContent =
    "This public demo uses BasketShipper-owned fictional data. It cannot contact a merchant, create an order or accept payment.";
  renderQuick();
}

// Fail loudly and specifically. A provider that never answers used to leave the
// page in an indefinite technical loading state. Every failure below names its
// own cause in the advanced drawer while the main UI stays human-readable.
function providerUnreachable(reason, fix) {
  applyExperienceCopy();
  providerAnswered = false;
  const cancelledRequestId = checkoutLifecycle.cancel();
  if (checkoutBusy || currentApproval || cancelledRequestId) {
    approvalChoice = "vetoed";
    toProvider({ type: "host:veto", requestId: cancelledRequestId ?? currentApproval?.requestId });
  }
  document.dispatchEvent(new CustomEvent("ft:cancel-agent"));
  revokeProviderTools();
  latestState = { catalog: [], cart: [], totals: [] };
  providerCapabilities = {};
  if (!$('approval').hidden) closeApproval();
  if (!$('handoff').hidden) closeHandoff();
  setStatus("Shopping unavailable", "down");
  clearTimeout(providerTimer);
  catalogPhase = "error";
  setSearchBusy(false);
  disableSearch();
  setCheckoutBusy(false);
  const summary = document.getElementById("tool-summary");
  if (summary) summary.textContent = "How it works";
  activity(reason, "bad");
  if (fix) activity(fix, "warn");
  renderCatalog([], new Set());
  setCatalogNotice(
    "Demo products could not be reached",
    "Refresh and try again. Your saved basket will remain on this device.",
    { kind: "error", retry: true },
  );
  $("search-help").textContent = "Shopping is unavailable right now. Try again from this page.";
  $("trust").innerHTML =
    `<p class="empty">The fictional demo could not be reached.${fix ? `<br>${esc(fix)}` : ""}</p>`;
}

let providerAnswered = false;

// Deterministic check first: an https page cannot load an http iframe at all.
// The browser blocks it silently, so detect it rather than wait for a timeout.
if (location.protocol === "https:" && EMBED_ORIGIN.startsWith("http://")) {
  queueMicrotask(() => providerUnreachable(
    `Blocked: this page is https, but the provider is ${EMBED_ORIGIN} (http).`,
    "Browsers block mixed content. Configure this storefront with an https provider origin."));
} else {
  const providerUrl = new URL("/embed", EMBED_ORIGIN);
  providerUrl.searchParams.set("hostOrigin", location.origin);
  providerUrl.searchParams.set("channel", CHANNEL_NONCE);
  frame.src = providerUrl.href;
  frame.addEventListener("error", () =>
    providerUnreachable(`The provider frame at ${EMBED_ORIGIN} failed to load.`));

  // Nothing may hang indefinitely: if the provider has not spoken in 10s, say so.
  providerTimer = setTimeout(() => {
    if (providerAnswered) return;
    providerUnreachable(
      `No response from the catalogue provider at ${EMBED_ORIGIN} after 10s.`,
      "Try refreshing the page. Technical details are available in How it works.");
  }, 10000);
}
document.getElementById("provider-origin").textContent = EMBED_ORIGIN;
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
})[c]);
const currencyDigits = (currency) => {
  try {
    return new Intl.NumberFormat("en", { style: "currency", currency })
      .resolvedOptions().maximumFractionDigits;
  } catch { return 2; }
};
const money = (minor, currency = "USD") => {
  const code = /^[A-Z]{3}$/.test(currency) ? currency : "USD";
  const amount = Number(minor ?? 0) / (10 ** currencyDigits(code));
  try {
    return new Intl.NumberFormat("en", {
      style: "currency", currency: code, currencyDisplay: "code",
    }).format(amount);
  } catch { return `${code} ${amount.toFixed(2)}`; }
};

function setCatalogNotice(title, copy, { kind = "", retry = false } = {}) {
  const notice = $("catalog-notice");
  notice.className = `catalog-notice${kind ? ` ${kind}` : ""}`;
  notice.hidden = false;
  $("catalog-notice-title").textContent = title;
  $("catalog-notice-copy").textContent = copy;
  $("catalog-reload").hidden = !retry;
}

function hideCatalogNotice() {
  $("catalog-notice").hidden = true;
}

function setActionStatus(message = "", tone = "") {
  const status = $("action-status");
  status.textContent = message;
  status.className = `action-status${tone ? ` ${tone}` : ""}`;
}

function observedLabel(value) {
  const observed = Date.parse(value);
  if (!Number.isFinite(observed)) return "";
  const seconds = Math.max(0, Math.round((Date.now() - observed) / 1000));
  if (seconds < 60) return "checked just now";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `checked ${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  return `checked ${hours}h ago`;
}

async function settleWithin(promise, label, ms = 6_000) {
  let timer;
  try {
    return await Promise.race([
      promise,
      new Promise((_resolve, reject) => {
        timer = setTimeout(() => reject(
          new DOMException(`${label} took too long`, "TimeoutError")), ms);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

function setStatus(text, cls = "") {
  const el = $("status");
  el.textContent = text;
  el.className = `status ${cls}`;
  el.hidden = !text;
}

function setDirectShoppingSummary(reason = "Agent actions are unavailable in this browser.") {
  $("tool-summary").textContent = "Direct shopping ready";
  $("trust").innerHTML = `<p class="empty">${esc(reason)} Direct search,
    comparison, basket, and handoff controls remain ready.</p>`;
}

let activityEmpty = true;
function activity(msg, cls = "") {
  if (activityEmpty) { $("activity").innerHTML = ""; activityEmpty = false; }
  const el = $("activity");
  el.insertAdjacentHTML("beforeend", `<div class="${cls}">${esc(msg)}</div>`);
  el.scrollTop = el.scrollHeight;
  trace("activity", { outcome: cls || "info" });
}

const manualComparisonSkus = new Set();
const selectedVariantSkus = new Map();
function updateCompareGuide() {
  const count = manualComparisonSkus.size;
  $("compare-guide").textContent = count === 1
    ? "One product selected — choose Compare on one more product."
    : count > 1 ? `${count} products selected — comparison updated above.` : "";
}
const swatchClass = (sku) => {
  const hash = [...String(sku)].reduce((sum, char) => ((sum * 31) + char.charCodeAt(0)) | 0, 0);
  return `swatch-${Math.abs(hash) % 8}`;
};

function restorePendingVariantFocus() {
  const target = pendingVariantFocus;
  if (!target) return;
  requestAnimationFrame(() => {
    if (pendingVariantFocus !== target) return;
    const card = [...$("catalog").querySelectorAll(".card")]
      .find((candidate) => candidate.dataset.sku === target.productSku);
    const picker = card?.querySelector("[data-variant-picker]");
    if (picker?.value === target.variantSku) picker.focus({ preventScroll: true });
    // An older comparison state and the clear acknowledgement can each repaint
    // the catalogue. Retain the target until that ordered acknowledgement so
    // the second repaint cannot strand keyboard focus on <body>.
    if (!comparisonClearPending) pendingVariantFocus = null;
  });
}

function renderCatalog(catalog, cartSkus = new Set()) {
  if (!catalog.length) {
    pendingVariantFocus = null;
    $("catalog").classList.remove("has-focus");
    $("catalog").innerHTML = "";
    if (catalogPhase === "loading") {
      setCatalogNotice(
        "Preparing the judge-demo catalogues",
        "BasketShipper-owned fictional products will appear here. You can search while this finishes.",
      );
      $("result-summary").textContent = "Loading products";
    } else if (catalogPhase === "empty") {
      setCatalogNotice(
        "No matching products",
        "Try fewer words, another product type, or clear the delivery destination.",
        { kind: "empty-state" },
      );
      $("result-summary").textContent = "0 matches";
    } else if (catalogPhase === "error") {
      setCatalogNotice(
        "Demo products could not be loaded",
        "Try again. These fictional products come from BasketShipper's owned judge-demo fixture.",
        { kind: "error", retry: true },
      );
      $("result-summary").textContent = "Products unavailable";
    }
    return;
  }
  hideCatalogNotice();
  $("result-summary").textContent = latestState.lastQuery
    ? `${catalog.length} match${catalog.length === 1 ? "" : "es"}`
    : `${catalog.length} available now`;
  const focused = new Set(latestState.focusedSkus ?? []);
  $("catalog").classList.toggle("has-focus", focused.size > 0);
  $("catalog").innerHTML = catalog.map((p) => {
    const activeVariant = p.variants?.find((variant) =>
      variant.sku === selectedVariantSkus.get(p.sku))
      ?? p.variants?.find((variant) => variant.sku === p.sku);
    const activeSku = activeVariant?.sku ?? p.sku;
    const activePrice = activeVariant?.price ?? p.price;
    const activeCurrency = activeVariant?.currency ?? p.currency;
    const activeAvailable = activeVariant ? activeVariant.available : Boolean(p.stock);
    const inCart = cartSkus.has(p.sku)
      || p.variants?.some((variant) => cartSkus.has(variant.sku));
    const isFocused = focused.has(p.sku)
      || p.variants?.some((variant) => focused.has(variant.sku));
    return `
    <article class="card${inCart ? " touched" : ""}${isFocused ? " focused" : ""}" data-sku="${esc(p.sku)}">
      ${p.image
        ? `<img class="shot" src="${esc(p.image)}" alt="" loading="lazy">`
        : `<div class="swatch ${swatchClass(p.sku)}">${esc(p.name.split(" ")[0])}</div>`}
      <span class="demo-badge">Fictional demo</span>
      <h3 class="name">${esc(p.name)}</h3>
      ${p.store ? `<a class="shop" href="${esc(p.url)}" target="_blank" rel="noopener">${esc(p.store)}${p.merchantCountry ? ` · ${esc(p.merchantCountry)}` : ""} ↗</a>` : ""}
      <div class="meta">
        <span class="price" data-card-price>${money(activePrice, activeCurrency)}</span>
        <span class="stock${activeAvailable ? "" : " out"}">${activeAvailable ? "in stock" : "sold out"}</span>
      </div>
      ${p.variants?.length > 1 ? `<label class="variant-picker">Option
        <select data-variant-picker aria-label="Choose option for ${esc(p.name)}">
          ${p.variants.map((variant) => `<option value="${esc(variant.sku)}"
            data-price="${Number(variant.price)}" data-currency="${esc(variant.currency)}"
            data-variant-label="${esc(variantDisplayText(variant) ?? variant.title)}"
            data-available="${variant.available ? "true" : "false"}"
            ${variant.sku === activeSku ? "selected" : ""}>${esc(variantDisplayText(variant) ?? variant.title)}${variant.available ? "" : " · unavailable"}</option>`).join("")}
        </select></label>` : p.selectedVariant?.title && p.selectedVariant.title !== "Default Title"
        ? `<div class="variant-note">Option: ${esc(variantDisplayText(p.selectedVariant))}</div>` : ""}
      ${providerCapabilities.compare || providerCapabilities.add ? `<div class="card-action">
        ${providerCapabilities.compare ? `<button class="compare-button" type="button" data-compare-sku="${esc(activeSku)}"
                aria-label="Compare ${esc(p.name)} — ${esc(variantDisplayText(activeVariant ?? p.selectedVariant) ?? "selected option")}" aria-pressed="${manualComparisonSkus.has(activeSku)}">${manualComparisonSkus.has(activeSku) ? "Selected" : "Compare"}</button>` : ""}
        ${providerCapabilities.add ? `<button class="add-button" type="button" data-add-sku="${esc(activeSku)}"
                aria-label="Add ${esc(p.name)} — ${esc(variantDisplayText(activeVariant ?? p.selectedVariant) ?? "selected option")} to basket"
                ${activeAvailable ? "" : "disabled"}>${cartSkus.has(activeSku) ? "Add another" : "Add to basket"}</button>` : ""}
      </div>` : ""}
    </article>`;
  }).join("");
  restorePendingVariantFocus();
}

function renderCart(s) {
  const itemCount = (s.cart ?? []).reduce(
    (sum, item) => sum + Number(item.qty ?? 0), 0);
  $("basket-count").textContent = String(itemCount);
  $("basket-count").setAttribute("aria-label",
    `${itemCount} item${itemCount === 1 ? "" : "s"} in basket`);
  $("basket-jump").hidden = itemCount === 0;
  $("basket-jump").textContent = `View basket · ${itemCount}`;
  $("basket-jump").setAttribute("aria-label",
    `View basket, ${itemCount} item${itemCount === 1 ? "" : "s"}`);
  $("basket-checkout").disabled = checkoutBusy
    || itemCount === 0 || !providerCapabilities.checkout;
  $("basket-checkout").textContent = checkoutBusy
    ? "Preparing review…"
    : "Review demo handoff";
  $("basket-note").textContent =
    "You will review fictional demonstration links. No real merchant or payment is involved.";
  if (!(s.cart ?? []).length) {
    $("cart").innerHTML = '<p class="empty">Your picks will appear here.</p>';
    return;
  }
  const byMerchant = new Map();
  for (const item of s.cart) {
    const merchant = item.store ?? "Merchant";
    if (!byMerchant.has(merchant)) byMerchant.set(merchant, []);
    byMerchant.get(merchant).push(item);
  }
  const lines = [...byMerchant.entries()].map(([merchant, items]) => `
    <section class="merchant-group" aria-label="${esc(merchant)} basket">
      <h3>${esc(merchant)}</h3>
      ${items.map((i) => {
        const currency = i.currency ?? s.currency ?? "USD";
        const variant = i.selectedVariant?.title && i.selectedVariant.title !== "Default Title"
          ? variantDisplayText(i.selectedVariant) : "";
        const removeLabel = variant
          ? `Remove ${i.name} — ${variant} from basket`
          : `Remove ${i.name} from basket`;
        return `<div class="line"><span>${esc(i.name)} ×${i.qty}<small>${esc(variant)}</small></span>
          <span class="line-end"><span>${money(i.price * i.qty, currency)}</span>
            ${providerCapabilities.remove ? `<button type="button" class="remove-line" data-remove-sku="${esc(i.sku)}"
                    aria-label="${esc(removeLabel)}">×</button>` : ""}</span></div>`;
      }).join("")}
    </section>`).join("");
  const totals = s.totals?.length
    ? s.totals
    : s.total != null ? [{
      currency: s.currency ?? "USD", subtotal: s.subtotal,
      discount: s.discount, total: s.total,
    }] : [];
  const summary = totals.map((t) =>
    `${t.discount ? `<div class="line"><span class="disc">${esc(s.coupon ?? "Discount")}</span>
      <span class="disc">−${money(t.discount, t.currency)}</span></div>` : ""}
     <div class="line sum"><span>Catalogue subtotal · ${esc(t.currency)}</span>
       <span>${money(t.total, t.currency)}</span></div>`).join("");
  const separation = byMerchant.size > 1
    ? `<p class="basket-separation">${byMerchant.size} separate merchant checkouts</p>` : "";
  $("cart").innerHTML = lines + summary + separation;
}

function evidenceValue(row, item, index) {
  const values = row.values;
  if (Array.isArray(values)) return values[index];
  if (values && typeof values === "object") return values[item.sku] ?? values[index];
  return undefined;
}

function formatEvidence(value, item, key) {
  if (value == null || value === "") return "—";
  if (key === "current_price") {
    if (typeof value === "number") return money(value, item.currency);
    if (typeof value === "object" && value.amount != null)
      return money(value.amount, value.currency ?? item.currency);
  }
  if (Array.isArray(value)) return value.length ? value.join(", ") : "—";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function renderComparison(comparison) {
  const panel = $("comparison");
  if (!comparison?.items?.length || !comparison?.rows?.length) {
    panel.hidden = true;
    $("comparison-table").innerHTML = "";
    return;
  }
  const highlighted = new Set(comparison.highlighted ?? []);
  const items = comparison.items;
  $("comparison-table").innerHTML = `<table>
    <thead><tr><th scope="col">Published evidence</th>${items.map((item) =>
      `<th scope="col">${esc(item.name)}<span class="merchant">${esc(item.store ?? "")}</span></th>`).join("")}</tr></thead>
    <tbody class="${highlighted.size ? "has-evidence" : ""}">${comparison.rows.map((row) =>
      `<tr data-field="${esc(row.key)}" class="${highlighted.has(row.key) ? "evidence" : ""}">
        <th scope="row">${esc(row.label)}</th>${items.map((item, index) =>
          `<td data-product="${esc(item.name)}">${esc(formatEvidence(evidenceValue(row, item, index), item, row.key))}</td>`).join("")}</tr>`).join("")}
    </tbody></table>`;
  panel.hidden = false;
  if (pendingComparisonReveal) {
    pendingComparisonReveal = false;
    requestAnimationFrame(() => panel.scrollIntoView({
      behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
      block: "nearest",
    }));
  }
}

function requestComparisonClear() {
  comparisonClearPending = true;
  pendingComparisonReveal = false;
  latestState = { ...latestState, comparison: null };
  renderComparison(null);
  scheduleHoistReconcile();
  toProvider({ type: "host:clear-comparison" });
}

let fallbackMode = false;
let fallbackPending = null;
let inputMode = "booting";
let queuedPrompt = null;
let agentReady = false;

const searchButton = $("chat-form").querySelector("button[type='submit']");
let searchPlaceholder = $("chat-input").placeholder;
function setSearchBusy(busy, label = "Search") {
  interactionBusy = busy;
  searchButton.disabled = busy;
  searchButton.textContent = busy ? "Searching…" : label;
  $("search-cancel").hidden = !busy;
  $("chat-input").readOnly = busy;
  $("chat-input").setAttribute("aria-busy", String(busy));
  $("chat-form").setAttribute("aria-busy", String(busy));
  for (const chip of $("quick").querySelectorAll("button")) chip.disabled = busy;
}

function setCheckoutBusy(busy, message = "") {
  checkoutBusy = busy;
  clearTimeout(checkoutTimer);
  renderCart(latestState);
  if (message) setActionStatus(message, busy ? "warn" : "");
}

function disableSearch() {
  inputMode = "unavailable";
  $("chat-input").disabled = true;
  $("chat-input").readOnly = false;
  $("chat-input").placeholder = "Catalogues are unavailable right now";
  searchButton.disabled = true;
  searchButton.textContent = "Unavailable";
}

function activateInput(mode) {
  inputMode = mode;
  $("chat-input").disabled = false;
  $("chat-input").readOnly = false;
  $("chat-input").placeholder = searchPlaceholder;
  setSearchBusy(false);
  $("search-help").textContent = mode === "agent"
    ? "Ask naturally. BasketShipper will keep product evidence and basket changes visible on this page."
    : "Search terms are matched against BasketShipper-owned fictional catalogue data on this device.";
  const queued = queuedPrompt;
  queuedPrompt = null;
  return queued;
}

// One dispatcher owns the form for its whole lifetime. Local search can be
// ready while the optional model is checked without stacking competing submit
// handlers when an already-installed model becomes available.
$("chat-form").addEventListener("submit", (event) => {
  event.preventDefault();
  const query = $("chat-input").value.trim();
  if (!query) return;
  if (inputMode === "booting") {
    queuedPrompt = { say: query, search: query };
    setSearchBusy(true);
    searchButton.textContent = "Getting ready…";
    return;
  }
  if (inputMode === "unavailable") return;
  $("chat-input").value = "";
  if (inputMode === "agent") {
    document.dispatchEvent(new CustomEvent("ft:prompt", { detail: query }));
  } else {
    runCatalogueSearch(query);
  }
});

function chatMessage(role, text, cls = "") {
  const log = $("chat-log");
  log.insertAdjacentHTML("beforeend",
    `<div class="msg ${role} ${cls}">${esc(text)}</div>`);
  log.scrollTop = log.scrollHeight;
  return log.lastElementChild;
}

function enableCatalogueSearch(reason) {
  const firstEnable = !fallbackMode;
  fallbackMode = true;
  $("brain").textContent = "private catalogue search";
  $("brain-detail").textContent = reason;
  if (firstEnable && !$("chat-log").children.length) {
    chatMessage("bot",
      "Search the fictional products, demo brands, or a country — I’ll show matches below.");
  } else if (firstEnable && $("chat-log").querySelector(".pending")) {
    chatMessage("bot", "You do not need to wait for the optional model — catalogue search is ready now.");
  }
  if (fallbackPending) return;
  const queued = activateInput("fallback");
  if (queued) {
    $("chat-input").value = "";
    runCatalogueSearch(queued.search);
  }
}

function activateAgentSearch() {
  agentReady = true;
  if (fallbackPending) return;
  fallbackMode = false;
  const queued = activateInput("agent");
  if (queued) document.dispatchEvent(
    new CustomEvent("ft:prompt", { detail: queued.say }));
}

function runCatalogueSearch(query) {
  if (!fallbackMode || fallbackPending) return;
  lastRequestedQuery = query;
  catalogPhase = "loading";
  manualComparisonSkus.clear();
  updateCompareGuide();
  chatMessage("user", query);
  fallbackPending = chatMessage("bot", "Searching fictional catalogues…", "pending");
  setSearchBusy(true);
  toProvider({ type: "host:search", query, shipsTo: $("delivery-country").value || null });
}

// --- provider channel -------------------------------------------------------
const checkoutLifecycleMessage = (message) => [
  "embed:awaiting-approval",
  "embed:approval-resolved",
  "embed:handoff",
].includes(message.type)
  || (message.type === "embed:ui-error" && message.action === "checkout");

function processProviderMessage(d) {
  if (checkoutLifecycleMessage(d) && !checkoutLifecycle.accepts(d.requestId)) {
    if (d.type === "embed:awaiting-approval") {
      toProvider({ type: "host:veto", requestId: d.requestId });
    }
    activity(`ignored ${d.type} from a cancelled or superseded checkout request`, "warn");
    return;
  }
  if (d.type === "embed:state") {
    const experience = classifyStorefrontExperience(d);
    if (!experience) {
      providerUnreachable(
        "The storefront refused a provider state that did not match its selected data mode.",
        "Refresh the page; the provider must attest BasketShipper-owned fictional data.");
      return;
    }
    const configured = Number(d.coverage?.configured ?? d.reachable?.length ?? 0);
    applyExperienceCopy(configured);
    // A state emitted by an earlier compare can arrive after the human clears
    // the panel. Keep it hidden until the ordered provider channel acknowledges
    // the clear with a comparison-free state.
    const hasIncomingComparison = Boolean(d.comparison?.items?.length);
    const visibleState = comparisonClearPending && hasIncomingComparison
      ? { ...d, comparison: null }
      : d;
    if (comparisonClearPending && !hasIncomingComparison) comparisonClearPending = false;
    latestState = visibleState;
    if (visibleState.catalog?.length) catalogPhase = "ready";
    else if (visibleState.observedAt) catalogPhase = "empty";
    trace("state", {
      reachableShopCount: visibleState.reachable?.length ?? 0,
      resultCount: visibleState.catalog?.length ?? 0,
      basketCount: visibleState.cart?.reduce((sum, item) => sum + Number(item.qty ?? 0), 0) ?? 0,
      comparisonCount: visibleState.comparison?.items?.length ?? 0,
      highlightCount: visibleState.comparison?.highlighted?.length ?? 0,
    });
    renderCatalog(visibleState.catalog ?? [], new Set((visibleState.cart ?? []).map((i) => i.sku)));
    renderCart(visibleState);
    if (pendingBasketMutation) {
      pendingBasketMutation = false;
      setActionStatus("Basket updated.");
    }
    renderComparison(visibleState.comparison);
    scheduleHoistReconcile();
    if (d.reachable?.length) {
      const checked = observedLabel(d.observedAt);
      const unavailableCount = Math.max(
        Number(d.coverage?.unavailable?.length ?? 0), configured - d.reachable.length);
      const failed = unavailableCount ? ` · ${unavailableCount} unavailable` : "";
      const live = `${configured} demo catalogue${configured === 1 ? "" : "s"} ready`;
      $("coverage").textContent = `${live}${failed}${checked ? ` · ${checked}` : ""}`;
      $("retry-search").hidden = !unavailableCount;
      $("retry-search").textContent = d.lastQuery || lastRequestedQuery
        ? `Retry unavailable shop${unavailableCount === 1 ? "" : "s"}` : "Reload catalogues";
      setStatus(live, "live");
    }
  }
  if (d.type === "embed:log") activity(d.msg, d.cls === "dim" ? "" : d.cls);
  if (d.type === "embed:ready") {
    if (d.protocol !== 2) {
      providerUnreachable("The catalogue provider uses an incompatible protocol.", "Refresh both deployed origins together.");
      return;
    }
    providerAnswered = true;
    clearTimeout(providerTimer);
    providerCapabilities = d.capabilities ?? {};
    toProvider({
      type: "host:set-preferences",
      deliveryCountry: $("delivery-country").value || null,
    });
    renderCatalog(latestState.catalog ?? [],
      new Set((latestState.cart ?? []).map((item) => item.sku)));
    renderCart(latestState);
    declaredAnnotations = d.annotations ?? {};
    declaredTitles = d.titles ?? {};
    if (d.wirePrefix) wirePrefix = d.wirePrefix;
    totalProviderTools = d.tools?.length ?? 0;
    if (totalProviderTools) {
      $("tool-summary").textContent = "Checking agent actions…";
      enableCatalogueSearch(
        "Catalogue search is ready while BasketShipper discovers optional WebMCP assistant actions.");
      hoist();
    } else {
      if (providerCapabilities.search) {
        setDirectShoppingSummary("WebMCP agent actions are unavailable in this browser.");
        enableCatalogueSearch("No model or API key is required for local catalogue search.");
      } else {
        $("tool-summary").textContent = "How it works";
        $("trust").innerHTML = '<p class="empty">The catalogue provider is not configured for shopping.</p>';
        disableSearch();
      }
    }
  }
  if (d.type === "embed:search-complete") {
    catalogPhase = d.count ? "ready" : "empty";
    manualComparisonSkus.clear();
    selectedVariantSkus.clear();
    if (fallbackPending) {
      fallbackPending.textContent = d.count
        ? `Found ${d.count} demo match${d.count === 1 ? "" : "es"} — see below.`
        : "No exact matches. Try fewer or broader words.";
      fallbackPending.classList.remove("pending");
      fallbackPending = null;
    }
    if (d.source !== "agent") setSearchBusy(false);
    if (agentReady) activateAgentSearch();
    renderCatalog(latestState.catalog ?? [],
      new Set((latestState.cart ?? []).map((item) => item.sku)));
  }
  if (d.type === "embed:catalog-ready") {
    if (!d.shops) {
      catalogPhase = "error";
      setStatus("Shops unavailable", "down");
      renderCatalog([], new Set());
      setCatalogNotice(
        "Demo products could not be loaded",
        "The catalogue provider did not answer. Try again in a moment.",
        { kind: "error", retry: true },
      );
    } else if (!latestState.catalog?.length) {
      catalogPhase = "empty";
      renderCatalog([], new Set());
    }
  }
  if (d.type === "embed:ui-error") {
    const cancelled = d.action === "search" && /cancel|abort|stopp/i.test(String(d.message));
    const friendly = {
      search: "Search did not finish. Your previous results are still here; try again.",
      add: "That item could not be added. Its availability may have changed.",
      remove: "That item could not be removed. Review the basket and try again.",
      compare: "Those products could not be compared. Choose two available products and try again.",
      checkout: "The merchant handoff could not be prepared. Your basket has not been purchased.",
      preferences: "That delivery preference could not be applied.",
    }[d.action] ?? "That action did not finish. Please try again.";
    const userMessage = cancelled
      ? "Search stopped. Your previous results are still here."
      : friendly;
    if (fallbackPending) {
      fallbackPending.textContent = userMessage;
      fallbackPending.classList.remove("pending");
      if (!cancelled) fallbackPending.classList.add("err");
      fallbackPending = null;
    }
    if (d.action === "search") {
      setSearchBusy(false);
      if (agentReady) activateAgentSearch();
      catalogPhase = latestState.catalog?.length ? "ready" : (cancelled ? "empty" : "error");
      renderCatalog(latestState.catalog ?? [],
        new Set((latestState.cart ?? []).map((item) => item.sku)));
    }
    if (d.action === "checkout") {
      checkoutLifecycle.finish(d.requestId);
      setCheckoutBusy(false, friendly);
      closeApproval();
    }
    if (["add", "remove", "compare"].includes(d.action)) {
      if (["add", "remove"].includes(d.action)) pendingBasketMutation = false;
      if (d.action === "compare") manualComparisonSkus.clear();
      updateCompareGuide();
      renderCatalog(latestState.catalog ?? [],
        new Set((latestState.cart ?? []).map((item) => item.sku)));
      renderCart(latestState);
    }
    setActionStatus(userMessage, cancelled ? "" : "bad");
    activity(`${d.action}: ${d.message}`, "bad");
  }
  if (d.type === "embed:add-complete") setActionStatus("Added to your basket.");
  if (d.type === "embed:awaiting-approval") {
    clearTimeout(checkoutTimer);
    currentApproval = {
      approvalId: d.approvalId,
      revision: d.revision,
      requestId: d.requestId ?? null,
    };
    const totals = d.totals ?? (d.total != null
      ? [{ currency: d.currency ?? "USD", total: d.total }]
      : []);
    $("approval-total").textContent = totals.length
      ? totals.map((t) => money(t.total, t.currency)).join(" and ")
      : "shown in your basket";
    $("approval-items").innerHTML = (d.cart ?? []).map((item) => {
      const variantText = approvalVariantText(item.selectedVariant);
      const variant = variantText ? `<small>${esc(variantText)}</small>` : "";
      return `<div><b>${esc(item.store ?? "Merchant")}</b> · ${esc(item.name)} ×${Number(item.qty ?? 0)}
        ${variant}${item.host ? `<small>${esc(item.host)}</small>` : ""}</div>`;
    }).join("");
    $("approval-title").textContent = "Review this fictional handoff?";
    $("approval-copy").textContent =
      "BasketShipper prepared demonstration links. Review the fictional basket; its currency totals are";
    $("approval-fine").textContent =
      "No real merchant is contacted and no payment can be made. Approval reveals owned demo links only.";
    closeDrawer();
    openApproval();
  }
  if (d.type === "embed:approval-resolved") {
    const approved = d.outcome === "approved" && d.valid === true;
    if (approved) {
      closeApproval();
      setCheckoutBusy(true, "Approved. Waiting for the merchant links…");
      checkoutTimer = setTimeout(() => {
        const cancelledRequestId = checkoutLifecycle.cancel();
        approvalChoice = "vetoed";
        toProvider({ type: "host:veto", requestId: cancelledRequestId ?? d.requestId });
        setCheckoutBusy(false,
          "Merchant links did not arrive. Your basket is unchanged; review it and try again.");
      }, 18000);
    } else {
      checkoutLifecycle.finish(d.requestId);
      setCheckoutBusy(false, d.reason === "stale"
        ? "Your basket changed before approval finished. Review it and try again."
        : "Handoff cancelled. Your basket is unchanged.");
      closeApproval();
    }
  }
  // Navigation triggered by a later postMessage is commonly popup-blocked.
  // Render explicit merchant links instead; each navigation is a fresh human
  // click and payment remains on the merchant's own page.
  if (d.type === "embed:handoff") {
    if (approvalChoice === "vetoed") {
      setCheckoutBusy(false, "Handoff cancelled. Your basket is unchanged.");
      activity("ignored a late handoff after the shopper cancelled", "warn");
      closeApproval();
      return;
    }
    checkoutLifecycle.finish(d.requestId);
    setCheckoutBusy(false);
    setActionStatus("Merchant links are ready. You remain in control of checkout.");
    closeApproval();
    activity(`handing off to ${d.handoff.length} shop${d.handoff.length === 1 ? "" : "s"}`, "ok");
    showHandoff(d.handoff.flatMap(({ store, items }) =>
      items.map((item) => ({ ...item, store }))));
  }
}

addEventListener("message", (e) => {
  if (e.origin !== EMBED_ORIGIN || e.source !== frame.contentWindow
    || e.data?.channel !== CHANNEL_NONCE || providerModeGate.rejected) return;
  const d = e.data ?? {};

  if (STOREFRONT_MODE.requireFictional
      && ["embed:ready", "embed:state"].includes(d.type)) {
    const kind = d.type === "embed:ready" ? "ready" : "state";
    const outcome = providerModeGate.receive(kind, d);
    if (outcome.rejected) {
      pendingModeReady = null;
      pendingModeState = null;
      providerAnswered = false;
      providerUnreachable(
        "The public storefront refused provider data that was not the BasketShipper-owned fictional mode.",
        "Deploy the matching rights-safe provider and refresh this page.");
      return;
    }
    if (kind === "ready") pendingModeReady = d;
    else pendingModeState = d;
    if (outcome.becameReady) {
      processProviderMessage(pendingModeReady);
      processProviderMessage(pendingModeState);
      pendingModeReady = null;
      pendingModeState = null;
    } else if (outcome.wasActive && kind === "state") {
      processProviderMessage(d);
    }
    return;
  }

  // Before both public attestations, logs, tool results, and approval messages
  // are ignored. They cannot make the page look ready or mutate visible state.
  if (STOREFRONT_MODE.requireFictional && !providerModeGate.active) return;
  processProviderMessage(d);
});

const toProvider = (msg) => frame.contentWindow.postMessage(
  { ...msg, channel: CHANNEL_NONCE }, EMBED_ORIGIN);
let approvalReturnFocus = null;
let handoffReturnFocus = null;
let currentApproval = null;

function openApproval() {
  approvalReturnFocus = checkoutReturnFocus?.isConnected
    ? checkoutReturnFocus : document.activeElement;
  approvalChoice = null;
  clearTimeout(approvalDecisionTimer);
  $("approval-status").textContent = "";
  $("approval-demo").hidden = false;
  setPageInert(true);
  $("approve").disabled = false;
  $("approve").textContent = "Yes, continue";
  $("veto").disabled = false;
  $("veto").textContent = "No, cancel";
  $("approval").hidden = false;
  $("veto").focus();          // the safe option is the first keyboard target
}

function closeApproval() {
  if ($("approval").hidden) return;
  clearTimeout(approvalDecisionTimer);
  $("approval-status").textContent = "";
  $("approval").hidden = true;
  setPageInert(false);
  if (approvalReturnFocus?.isConnected) approvalReturnFocus.focus();
  approvalReturnFocus = null;
  checkoutReturnFocus = null;
  currentApproval = null;
}

function safeNavigationUrl(value) {
  try {
    const url = new URL(value);
    const loopback = ["localhost", "127.0.0.1"].includes(url.hostname);
    if (url.protocol !== "https:" && !(loopback && url.protocol === "http:")) return null;
    const allowedOrigins = new Set();
    const addUrlOrigin = (candidate) => {
      try {
        const parsed = new URL(candidate);
        const local = ["localhost", "127.0.0.1"].includes(parsed.hostname);
        if (parsed.protocol === "https:" || (local && parsed.protocol === "http:")) {
          allowedOrigins.add(parsed.origin);
        }
      } catch { /* An invalid source cannot authorize navigation. */ }
    };
    const addHttpsHostOrigin = (host) => {
      const value = String(host ?? "").toLowerCase();
      if (/^(?:[a-z0-9-]+\.)*[a-z0-9-]+(?::\d{1,5})?$/.test(value)) {
        addUrlOrigin(`https://${value}`);
      }
    };
    for (const item of latestState.cart ?? []) {
      if (item.url) addUrlOrigin(item.url);
      // The fixture also exposes its exact demonstration hostname. Its narrow
      // fallback is the default HTTPS origin; it never authorizes another port.
      if (item.host) addHttpsHostOrigin(item.host);
    }
    return allowedOrigins.has(url.origin) ? url.href : null;
  } catch { return null; }
}

function showHandoff(entries) {
  const links = entries.map((entry) => ({
    ...entry,
    safeUrl: safeNavigationUrl(entry.url),
  })).filter((entry) => entry.safeUrl);
  if (!links.length) {
    setCheckoutBusy(false,
      "The handoff was approved, but no safe merchant link was returned. Your basket is unchanged.");
    activity("approved handoff did not contain a safe merchant link", "bad");
    return;
  }
  $("handoff-links").innerHTML = links.map((entry) =>
    `<a class="handoff-link" href="${esc(entry.safeUrl)}" target="_blank" rel="noopener">
      <span>${esc(entry.name ?? "Open merchant")}<small>${esc(entry.store ?? "Merchant")} · ${esc(new URL(entry.safeUrl).hostname)}</small></span>
      <span aria-hidden="true">Open demo ↗</span>
    </a>`).join("");
  $("handoff-demo").hidden = false;
  $("handoff-title").textContent = "Open the fictional demo links";
  $("handoff-description").textContent =
    "These BasketShipper-owned links demonstrate a handoff. They cannot accept payment or create an order.";
  handoffReturnFocus = document.activeElement;
  setPageInert(true);
  $("handoff").hidden = false;
  $("handoff-links").querySelector("a")?.focus();
}

function closeHandoff() {
  if ($("handoff").hidden) return;
  $("handoff").hidden = true;
  setPageInert(false);
  if (handoffReturnFocus?.isConnected) handoffReturnFocus.focus();
  handoffReturnFocus = null;
}

$("approve").addEventListener("click", () => {
  if (!currentApproval) return;
  approvalChoice = "approved";
  activity("human approved checkout", "ok");
  $("approve").disabled = true;
  $("approve").textContent = "Preparing…";
  $("veto").disabled = true;
  toProvider({ type: "host:approve", ...currentApproval });
  approvalDecisionTimer = setTimeout(() => {
    if ($("approval").hidden) return;
    $("veto").disabled = false;
    $("veto").textContent = "Cancel handoff";
    $("approval-status").textContent =
      "This is taking longer than expected. No merchant page has opened; you can cancel safely.";
    $("veto").focus();
  }, 8000);
});
function veto(reason = "human vetoed checkout") {
  if ($("veto").disabled) return;
  approvalChoice = "vetoed";
  activity(reason, "bad");
  const cancelledRequestId = checkoutLifecycle.cancel();
  toProvider({
    type: "host:veto",
    requestId: cancelledRequestId ?? currentApproval?.requestId,
  });
  // Re-enable and render the launch control before the modal restores focus.
  // Focusing a disabled button is ignored by browsers.
  setCheckoutBusy(false, "Handoff cancelled. Your basket is unchanged.");
  closeApproval();               // never leave the shopper trapped behind it
}
$("veto").addEventListener("click", () => veto());
// Clicking outside means no. Cancelling must be the easy path.
$("approval").addEventListener("click", (e) => {
  if (e.target === $("approval") && !$("veto").disabled) {
    veto("cancelled by clicking away");
  }
});
$("handoff-close").addEventListener("click", closeHandoff);
$("handoff").addEventListener("click", (event) => {
  if (event.target === $("handoff")) closeHandoff();
});


// --- quick actions ----------------------------------------------------------
// A judge who has never seen WebMCP should not have to invent a prompt. Each
// chip says what to ask and what it proves; clicking copies it.
const FIXTURE_PROMPTS = [
  {
    say: "Find fictional running shoes",
    search: "fictional running shoes",
  },
  { say: "Find fictional one-time egg options", search: "one-time eggs Rwanda" },
  {
    say: "Browse products for cross-category comparison",
    search: "fictional",
  },
  { say: "Browse all fictional demo products", search: "fictional" },
];
const activePrompts = FIXTURE_PROMPTS;

function renderQuick() {
  if ($("quick").children.length) return;
  $("quick").setAttribute("aria-label", "Try a fictional judge-demo journey");
  $("quick").innerHTML = activePrompts.map((p, i) => `
    <button class="chip" data-i="${i}"${interactionBusy ? " disabled" : ""}>${esc(p.say)}</button>`).join("");
}

$("quick").addEventListener("click", (e) => {
  const btn = e.target.closest(".chip");
  if (!btn) return;
  const prompt = activePrompts[+btn.dataset.i];
  if (!prompt) return;
  if (inputMode === "booting") {
    queuedPrompt = prompt;
    $("chat-input").value = prompt.say;
    setSearchBusy(true);
    searchButton.textContent = "Getting ready…";
  } else if (inputMode === "fallback") runCatalogueSearch(prompt.search);
  else document.dispatchEvent(new CustomEvent("ft:prompt", { detail: prompt.say }));
});

// --- trust panel ------------------------------------------------------------
// Every value here is read back from the live API, never hardcoded: `origin` is
// what the browser reports as the tool's owner, and the badges are the
// annotations the provider actually declared.
function renderTrust(tools) {
  if (!tools.length) {
    $("trust").innerHTML = '<p class="empty">No agent actions are visible in this browser.</p>';
    return;
  }
  const here = location.origin;
  $("trust").innerHTML = tools.map((t) => {
    const foreign = t.origin && t.origin !== here;
    const a = t.annotations ?? declaredAnnotations[publicName(t.name)] ?? {};
    const badges = [
      publicName(t.name) === "prepare_checkout_handoff"
        ? '<span class="badge danger">human review</span>' : "",
      a.untrustedContentHint ? '<span class="badge untrusted">untrusted output</span>' : "",
      a.readOnlyHint ? '<span class="badge">read only</span>' : "",
    ].join("");
    return `<div class="tool">
      <span class="nm">${esc(publicName(t.name))}</span>
      ${badges}
      <span class="from${foreign ? " foreign" : ""}">${esc(new URL(t.origin ?? here).host)}</span>
    </div>`;
  }).join("") + `<div class="note">The implementation stays inside a static,
    cross-origin provider frame. The provider must explicitly allow this origin,
    and the browser mediates every discovery and call. BasketShipper exposes only the
    actions useful for the current search, comparison, and basket state.</div>`;
}

// --- the hoist --------------------------------------------------------------
const modelContext = document.modelContext || navigator.modelContext;
// Current Chrome serializes annotations. Keep the provider declarations as a
// compatibility fallback for older WebMCP builds that omitted them.
let declaredAnnotations = {};
let declaredTitles = {};
let wirePrefix = "wire__";
const publicName = (n) => (n.startsWith(wirePrefix) ? n.slice(wirePrefix.length) : n);
const normalise = (s) => (typeof s === "string" ? JSON.parse(s) : s);
// executeTool() takes arguments as a JSON string in current Chrome, while
// execute() is handed a parsed object. Normalise at the boundary.
const asArgs = (input) => (typeof input === "string" ? input : JSON.stringify(input ?? {}));
const foreignTools = new Map();
const hoistedRegistrations = new Map();
const activeExecutions = new Set();
let reconcileTimer = null;
let agentInitialized = false;
let reconcileGeneration = 0;
const reconcileQueue = createSerialQueue((error) =>
  activity(`tool lifecycle: ${error.name}: ${error.message}`, "bad"));

function revokeProviderTools() {
  clearTimeout(reconcileTimer);
  reconcileGeneration += 1;
  for (const controller of hoistedRegistrations.values()) controller.abort();
  hoistedRegistrations.clear();
  foreignTools.clear();
  totalProviderTools = 0;
}

function desiredToolNames() {
  const desired = new Set(["list_shops", "get_shopping_state", "search_products"]);
  const hasResults = Boolean(latestState.catalog?.length);
  const hasBasket = Boolean(latestState.cart?.length);
  if (hasResults) {
    desired.add("inspect_products");
    desired.add("focus_products");
    desired.add("compare_products");
  }
  if (hasResults || hasBasket) desired.add("set_basket_quantity");
  if (latestState.comparison?.items?.length) desired.add("highlight_evidence");
  if (hasBasket) desired.add("prepare_checkout_handoff");
  return desired;
}

function scheduleHoistReconcile() {
  if (!modelContext || !foreignTools.size) return;
  clearTimeout(reconcileTimer);
  const generation = reconcileGeneration;
  reconcileTimer = setTimeout(() => {
    reconcileQueue.run(() => generation === reconcileGeneration
      ? reconcileHoist() : undefined).catch(() => {});
  }, 75);
}

async function attachTool(tool) {
  const name = publicName(tool.name);
  const controller = new AbortController();
  await settleWithin(modelContext.registerTool({
    name,
    title: tool.title ?? declaredTitles[name] ?? name,
    description: tool.description,
    inputSchema: normalise(tool.inputSchema),
    annotations: tool.annotations ?? declaredAnnotations[name],
    execute: async (input, { signal } = {}) => {
      const started = performance.now();
      activeExecutions.add(name);
      trace("tool", { tool: name, phase: "start" });
      try {
        const result = await modelContext.executeTool(tool, asArgs(input), { signal });
        trace("tool", { tool: name, phase: "finish", duration: performance.now() - started, outcome: "ok" });
        return result;
      } catch (error) {
        activity(`${name} failed: ${error.name}: ${error.message}`, "bad");
        trace("tool", { tool: name, phase: "finish", duration: performance.now() - started, outcome: error.name });
        throw error;
      } finally {
        activeExecutions.delete(name);
        scheduleHoistReconcile();
      }
    },
  }, { signal: controller.signal }), `Attach ${name}`);
  hoistedRegistrations.set(name, controller);
}

async function reconcileHoist() {
  const desired = desiredToolNames();
  for (const [name, controller] of hoistedRegistrations) {
    if (!desired.has(name) && !activeExecutions.has(name)) {
      controller.abort();
      hoistedRegistrations.delete(name);
      activity(`hid ${name}; it is not useful in the current page state`);
    }
  }
  for (const name of desired) {
    if (hoistedRegistrations.has(name)) continue;
    const tool = foreignTools.get(name);
    if (!tool) continue;
    try { await attachTool(tool); }
    catch (error) { activity(`hoist ${name} failed: ${error.name}`, "bad"); }
  }
  const count = hoistedRegistrations.size;
  $("tool-summary").textContent = count
    ? `${count} of ${totalProviderTools || foreignTools.size} actions ready`
    : "How it works";
  trace("tool-surface", { resultCount: count });
}

async function hoist() {
  if (!modelContext) {
    activity("WebMCP page API unavailable; using direct local catalogue search", "warn");
    setDirectShoppingSummary("This browser does not expose WebMCP agent actions.");
    enableCatalogueSearch("This browser is using the direct local-search fallback.");
    return;
  }
  let tools;
  try {
    tools = await settleWithin(
      modelContext.getTools({ fromOrigins: [EMBED_ORIGIN] }), "Agent discovery");
  } catch (e) {
    activity(`getTools({fromOrigins}) → ${e.name}: ${e.message}`, "bad");
    setDirectShoppingSummary("Agent actions could not be discovered.");
    enableCatalogueSearch("Agent actions could not be discovered; local search remains available.");
    return;
  }
  // Do not trust discovery filtering alone. A browser/runtime bug or another
  // registered foreign tool must never be hoisted under BasketShipper's clean names.
  const foreign = tools.filter((tool) => tool.origin === EMBED_ORIGIN);
  if (!foreign.length) {
    activity("provider registered, but nothing crossed the boundary", "bad");
    setDirectShoppingSummary("Agent actions are not visible in this browser.");
    enableCatalogueSearch("Agent actions are not visible; local search remains available.");
    return;
  }
  renderTrust(foreign);
  for (const tool of foreign) {
    foreignTools.set(publicName(tool.name), tool);
  }
  const generation = reconcileGeneration;
  await reconcileQueue.run(() => generation === reconcileGeneration
    ? reconcileHoist() : undefined);
  activity(`attached a state-aware WebMCP surface from ${foreign.length} provider actions`, "ok");
  if (!hoistedRegistrations.size) {
    setDirectShoppingSummary("Agent actions could not be attached.");
    enableCatalogueSearch("Agent actions could not be attached; local search remains available.");
    return;
  }
  if (!hoistedRegistrations.has("search_products")) {
    activity("search_products could not be attached; using direct catalogue search", "warn");
    setDirectShoppingSummary("Agent search could not be attached.");
    enableCatalogueSearch("Agent search was unavailable; local search remains active.");
    return;
  }
  if (agentInitialized) return;
  agentInitialized = true;
  enableCatalogueSearch(
    "Local catalogue search is ready while BasketShipper checks for an optional installed model.");
  try {
    const { initAgent } = await import("./agent.js");
    initAgent()
      .then((started) => {
        if (!started) enableCatalogueSearch(
          "Agent actions are ready; this browser is using private catalogue search for the input.");
        else activateAgentSearch();
      })
      .catch((e) => {
        activity(`assistant unavailable: ${e.message}`, "bad");
        enableCatalogueSearch("The optional model is unavailable; local search remains active.");
      });
  } catch (error) {
    activity(`assistant module unavailable: ${error.message}`, "bad");
    enableCatalogueSearch("The optional model is unavailable; local search remains active.");
  }
}

const FOCUSABLE = [
  "a[href]", "button:not([disabled])", "input:not([disabled])", "summary",
  "select:not([disabled])", "textarea:not([disabled])", "[tabindex]:not([tabindex='-1'])",
].join(",");
let drawerReturnFocus = null;

function setPageInert(value) {
  for (const region of document.querySelectorAll(
    "body > header, body > main, body > footer, #basket-jump")) {
    region.inert = value;
  }
}

function trapFocus(event, container) {
  if (event.key !== "Tab") return;
  const controls = [...container.querySelectorAll(FOCUSABLE)]
    .filter((element) => element.getClientRects().length > 0);
  if (!controls.length) {
    event.preventDefault();
    return;
  }
  const first = controls[0];
  const last = controls.at(-1);
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
}

function openDrawer() {
  drawerReturnFocus = document.activeElement;
  setPageInert(true);
  $("drawer-backdrop").hidden = false;
  $("advanced-open").setAttribute("aria-expanded", "true");
  document.body.classList.add("drawer-open");
  $("advanced-close").focus();
}

function closeDrawer() {
  if ($("drawer-backdrop").hidden) return;
  $("drawer-backdrop").hidden = true;
  $("advanced-open").setAttribute("aria-expanded", "false");
  document.body.classList.remove("drawer-open");
  setPageInert(false);
  if (drawerReturnFocus?.isConnected) drawerReturnFocus.focus();
  drawerReturnFocus = null;
}

renderQuick();
renderCatalog([]);
renderComparison(null);

$("clear-comparison").addEventListener("click", () => {
  manualComparisonSkus.clear();
  updateCompareGuide();
  requestComparisonClear();
});

$("catalog").addEventListener("click", (event) => {
  const compare = event.target.closest("[data-compare-sku]");
  if (compare) {
    const sku = compare.dataset.compareSku;
    if (manualComparisonSkus.has(sku)) {
      manualComparisonSkus.clear();
      updateCompareGuide();
      requestComparisonClear();
      return;
    }
    if (manualComparisonSkus.size === 3) {
      manualComparisonSkus.clear();
      updateCompareGuide();
      requestComparisonClear();
    }
    manualComparisonSkus.add(sku);
    compare.setAttribute("aria-pressed", "true");
    compare.textContent = manualComparisonSkus.size === 1 ? "Pick one more" : "Selected";
    updateCompareGuide();
    if (manualComparisonSkus.size >= 2) {
      pendingComparisonReveal = true;
      toProvider({ type: "host:compare", skus: [...manualComparisonSkus] });
    }
    return;
  }
  const button = event.target.closest("[data-add-sku]");
  if (!button || button.disabled) return;
  button.disabled = true;
  button.textContent = "Adding…";
  pendingBasketMutation = true;
  setActionStatus("Adding the selected product…");
  toProvider({ type: "host:add", sku: button.dataset.addSku, quantity: 1 });
});

$("catalog").addEventListener("error", (event) => {
  const image = event.target.closest?.("img.shot");
  if (!image) return;
  const card = image.closest(".card");
  const sku = card?.dataset.sku ?? "product";
  const fallback = document.createElement("div");
  fallback.className = `swatch ${swatchClass(sku)}`;
  fallback.textContent = card?.querySelector(".name")?.textContent?.split(" ")[0] ?? "Product";
  image.replaceWith(fallback);
}, true);

$("catalog").addEventListener("change", (event) => {
  const picker = event.target.closest("[data-variant-picker]");
  if (!picker) return;
  const option = picker.selectedOptions[0];
  const card = picker.closest(".card");
  const productName = card.querySelector(".name")?.textContent?.trim() || "product";
  const variantLabel = option.dataset.variantLabel || option.textContent.trim();
  pendingVariantFocus = { productSku: card.dataset.sku, variantSku: picker.value };
  selectedVariantSkus.set(card.dataset.sku, picker.value);
  const add = card.querySelector("[data-add-sku]");
  const compare = card.querySelector("[data-compare-sku]");
  const available = option.dataset.available === "true";
  if (add) {
    add.dataset.addSku = picker.value;
    add.disabled = !available;
    const inCart = (latestState.cart ?? []).some((item) => item.sku === picker.value);
    add.textContent = available ? (inCart ? "Add another" : "Add to basket") : "Unavailable";
    add.setAttribute("aria-label", `Add ${productName} — ${variantLabel} to basket`);
  }
  manualComparisonSkus.clear();
  updateCompareGuide();
  requestComparisonClear();
  if (compare) {
    compare.dataset.compareSku = picker.value;
    compare.setAttribute("aria-pressed", "false");
    compare.setAttribute("aria-label", `Compare ${productName} — ${variantLabel}`);
    compare.textContent = "Compare";
  }
  card.querySelector("[data-card-price]").textContent = money(
    Number(option.dataset.price), option.dataset.currency);
  const stock = card.querySelector(".stock");
  stock.textContent = available ? "in stock" : "sold out";
  stock.classList.toggle("out", !available);
});

$("basket-checkout").addEventListener("click", () => {
  if (checkoutBusy) return;
  const requestId = checkoutLifecycle.start();
  if (!requestId) return;
  checkoutReturnFocus = $("basket-checkout");
  approvalChoice = null;
  setCheckoutBusy(true, "Preparing a review of the current basket…");
  checkoutTimer = setTimeout(() => {
    const cancelledRequestId = checkoutLifecycle.cancel();
    approvalChoice = "vetoed";
    toProvider({ type: "host:veto", requestId: cancelledRequestId ?? requestId });
    setCheckoutBusy(false,
      "The review did not open. Your basket is unchanged; try again.");
  }, 10000);
  toProvider({ type: "host:checkout", requestId });
});

$("basket-jump").addEventListener("click", () => {
  const basket = $("basket-panel");
  basket.focus({ preventScroll: true });
  basket.scrollIntoView({
    behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
    block: "start",
  });
});

$("cart").addEventListener("click", (event) => {
  const button = event.target.closest("[data-remove-sku]");
  if (!button) return;
  button.disabled = true;
  pendingBasketMutation = true;
  setActionStatus("Updating your basket…");
  toProvider({ type: "host:remove", sku: button.dataset.removeSku });
});

$("advanced-open").addEventListener("click", openDrawer);
$("retry-search").addEventListener("click", () => {
  const query = latestState.lastQuery || lastRequestedQuery;
  if (!query) {
    location.reload();
    return;
  }
  setSearchBusy(true);
  catalogPhase = "loading";
  toProvider({
    type: "host:search",
    query,
    shipsTo: $("delivery-country").value || null,
  });
});
$("search-cancel").addEventListener("click", () => {
  document.dispatchEvent(new CustomEvent("ft:cancel-agent"));
  toProvider({ type: "host:cancel-search" });
  setSearchBusy(false);
  if (fallbackPending) {
    fallbackPending.textContent = "Search stopped. Your previous results are still here.";
    fallbackPending.classList.remove("pending");
    fallbackPending = null;
  }
  if (agentReady) activateAgentSearch();
});
$("catalog-reload").addEventListener("click", () => location.reload());
$("delivery-country").addEventListener("change", () => {
  try { localStorage.setItem(PREFERENCE_KEY, JSON.stringify({
    deliveryCountry: $("delivery-country").value || null,
  })); } catch { /* storage is optional */ }
  toProvider({
    type: "host:set-preferences",
    deliveryCountry: $("delivery-country").value || null,
  });
});
document.addEventListener("ft:agent-busy", (event) => {
  const busy = Boolean(event.detail);
  setSearchBusy(busy);
  if (busy) searchButton.textContent = "Working…";
});
document.addEventListener("ft:agent-activity", (event) => {
  if (event.detail) activity(String(event.detail));
});
document.addEventListener("ft:agent-fallback", (event) => {
  agentReady = false;
  enableCatalogueSearch(String(event.detail ||
    "The optional assistant is unavailable; private catalogue search remains ready."));
});

try {
  const savedPreferences = JSON.parse(localStorage.getItem(PREFERENCE_KEY) || "{}");
  if (savedPreferences.deliveryCountry
    && [...$("delivery-country").options].some((option) => option.value === savedPreferences.deliveryCountry)) {
    $("delivery-country").value = savedPreferences.deliveryCountry;
  }
} catch { /* storage is optional */ }
$("download-trace").addEventListener("click", downloadTrace);
$("advanced-close").addEventListener("click", closeDrawer);
$("drawer-backdrop").addEventListener("click", (event) => {
  if (event.target === $("drawer-backdrop")) closeDrawer();
});
addEventListener("keydown", (event) => {
  if (!$("handoff").hidden) {
    if (event.key === "Escape") closeHandoff();
    else trapFocus(event, $("handoff"));
    return;
  }
  if (!$("approval").hidden) {
    if (event.key === "Escape") {
      if (!$("veto").disabled) veto("cancelled with Escape");
    } else trapFocus(event, $("approval"));
    return;
  }
  if (!$("drawer-backdrop").hidden) {
    if (event.key === "Escape") closeDrawer();
    else trapFocus(event, $("advanced-drawer"));
  }
});

if ("serviceWorker" in navigator) {
  addEventListener("load", () =>
    navigator.serviceWorker.register("./sw.js").catch(() => {}));
}
