import assert from "node:assert/strict";
import test from "node:test";

const camel = (value) => value.replace(/-([a-z])/g, (_match, letter) => letter.toUpperCase());

class FakeElement {
  constructor(id, document) {
    this.id = id;
    this.ownerDocument = document;
    this.dataset = {};
    this.listeners = new Map();
    this.children = [];
    this._innerHTML = "";
    this.textContent = "";
    this.value = "";
    this.hidden = false;
    this.disabled = false;
    this.checked = false;
    this.inert = false;
    this.isConnected = true;
  }

  addEventListener(type, listener) {
    if (!this.listeners.has(type)) this.listeners.set(type, []);
    this.listeners.get(type).push(listener);
  }

  emit(type, target = this) {
    const event = {
      target,
      key: "",
      shiftKey: false,
      preventDefault() { this.defaultPrevented = true; },
    };
    for (const listener of this.listeners.get(type) ?? []) listener(event);
    return event;
  }

  focus() {
    if (!this.disabled && this.isConnected) this.ownerDocument.activeElement = this;
  }

  scrollIntoView() { this.scrolledIntoView = true; }
  getClientRects() { return this.hidden ? [] : [{}]; }

  closest(selector) {
    const attribute = selector.match(/^\[data-([a-z-]+)\]$/)?.[1];
    return attribute && this.dataset[camel(attribute)] != null ? this : null;
  }

  querySelector(selector) {
    if (selector === "button[type='submit']") return this.submitButton ?? null;
    return this.querySelectorAll(selector)[0] ?? null;
  }

  querySelectorAll(selector) {
    const attribute = selector.match(/^\[data-([a-z-]+)\]$/)?.[1];
    if (attribute) {
      const key = camel(attribute);
      return this.children.filter((child) => child.dataset[key] != null);
    }
    return this.children;
  }

  set innerHTML(value) {
    for (const child of this.children) child.isConnected = false;
    this.children = [];
    this._innerHTML = String(value);
    if (this.id === "comparison" && /id="highlight"/.test(this._innerHTML)) {
      this.ownerDocument.elements.set("highlight", new FakeElement("highlight", this.ownerDocument));
    }
    if (!["products", "basket"].includes(this.id)) return;

    const addControl = (attributes, value = "") => {
      const control = new FakeElement("", this.ownerDocument);
      for (const match of attributes.matchAll(/data-([a-z-]+)="([^"]*)"/g)) {
        control.dataset[camel(match[1])] = match[2];
      }
      control.disabled = /\bdisabled\b/.test(attributes);
      control.checked = /\bchecked\b/.test(attributes);
      control.ariaLabel = attributes.match(/aria-label="([^"]*)"/)?.[1] ?? "";
      control.value = value;
      this.children.push(control);
    };

    for (const match of this._innerHTML.matchAll(/<select\b([^>]*)>([\s\S]*?)<\/select>/g)) {
      const selectedValue = match[2].match(/<option\b[^>]*value="([^"]*)"[^>]*\bselected\b/)?.[1]
        ?? match[2].match(/<option\b[^>]*value="([^"]*)"/)?.[1] ?? "";
      addControl(match[1], selectedValue);
    }
    for (const match of this._innerHTML.matchAll(/<(?:input|button)\b([^>]*)>/g)) {
      addControl(match[1]);
    }
  }

  get innerHTML() { return this._innerHTML; }
}

function createHarness() {
  const document = {
    activeElement: null,
    modelContext: undefined,
    elements: new Map(),
    getElementById(id) { return this.elements.get(id) ?? null; },
    querySelectorAll(selector) {
      return selector === "body > header, body > main"
        ? [this.elements.get("header"), this.elements.get("main")] : [];
    },
  };
  const ids = [
    "header", "main", "provider", "tool-status", "provider-copy", "tools",
    "handoff-ack", "query", "search-form", "compare", "result-status",
    "comparison", "products", "basket-panel", "basket-title", "basket-status",
    "basket", "review", "basket-jump", "approval", "approval-items",
    "approval-status", "approve", "veto", "handoff", "handoff-links",
    "close-handoff",
  ];
  for (const id of ids) document.elements.set(id, new FakeElement(id, document));
  document.body = new FakeElement("body", document);
  document.activeElement = document.body;

  const searchButton = new FakeElement("search-button", document);
  searchButton.disabled = true;
  document.getElementById("search-form").submitButton = searchButton;
  document.getElementById("query").disabled = true;
  document.getElementById("compare").disabled = true;
  document.getElementById("review").disabled = true;
  document.getElementById("comparison").hidden = true;
  document.getElementById("approval").hidden = true;
  document.getElementById("handoff").hidden = true;
  document.getElementById("handoff-ack").hidden = true;
  document.getElementById("basket-jump").hidden = true;
  document.getElementById("approval").children = [
    document.getElementById("veto"), document.getElementById("approve"),
  ];
  document.getElementById("handoff").children = [document.getElementById("close-handoff")];

  const posted = [];
  const providerWindow = { postMessage(message, origin) { posted.push({ message, origin }); } };
  const provider = document.getElementById("provider");
  provider.dataset.origin = "https://groundedrelay-provider.pages.dev";
  provider.contentWindow = providerWindow;

  const listeners = new Map();
  const addEventListener = (type, listener) => {
    if (!listeners.has(type)) listeners.set(type, []);
    listeners.get(type).push(listener);
  };
  return { document, posted, provider, providerWindow, listeners, addEventListener };
}

const variant = (sku, title, options = []) => ({
  sku, title, options, available: true, price: 1000, currency: "KES",
});
const product = (id, name, variants) => ({
  productId: id,
  sku: variants[0].sku,
  name,
  store: "GroundedRelay Demo — Rift Runworks",
  merchantCountry: "Kenya",
  price: variants[0].price,
  currency: variants[0].currency,
  available: true,
  selectedVariant: variants[0],
  variants,
});
const comparison = (catalogue) => ({
  items: catalogue.map(({ sku, name }) => ({ sku, name })),
  rows: [
    { key: "exact_variant", label: "Exact variant", values: ["EU 39", "Ochre"] },
    { key: "availability", label: "Availability", values: ["Available", "Available"] },
  ],
  highlighted: [],
});

test("merchant runtime gates readiness, invalidates evidence, and preserves focus dynamically", async () => {
  const harness = createHarness();
  const originals = new Map();
  for (const [key, value] of Object.entries({
    document: harness.document,
    location: {
      protocol: "http:", hostname: "localhost", origin: "http://localhost:5175", hash: "",
    },
    addEventListener: harness.addEventListener,
    matchMedia: () => ({ matches: true }),
  })) {
    originals.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
    Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
  }

  try {
    const moduleUrl = new URL(`../sites/merchant-demo/client.js?dynamic=${Date.now()}`, import.meta.url);
    await import(moduleUrl.href);
    const query = harness.document.getElementById("query");
    const searchButton = harness.document.getElementById("search-form").submitButton;
    assert.equal(query.disabled, true);
    assert.equal(searchButton.disabled, true);

    const providerUrl = new URL(harness.provider.src);
    const channel = providerUrl.searchParams.get("channel");
    assert.ok(channel);
    assert.equal(harness.listeners.get("message")?.length, 1);
    const send = (data) => {
      const event = {
        origin: "http://localhost:5174",
        source: harness.providerWindow,
        data: { ...data, channel },
      };
      for (const listener of harness.listeners.get("message") ?? []) listener(event);
    };
    const shoes = product("shoe", "Nyota Road Running Shoe", [
      variant("shoe:39", "EU 39"), variant("shoe:40", "EU 40", ["Colour: Indigo"]),
    ]);
    const bag = product("bag", "Asa Canvas Weekender", [
      variant("bag:ochre", "Ochre", []), variant("bag:indigo", "Indigo", []),
    ]);
    const catalogue = [shoes, bag];
    const baseState = {
      type: "embed:state", dataMode: "fictional", fictional: true,
      fixture: { rightsSafe: true, fictional: true, owner: "GroundedRelay" },
      catalog: catalogue, cart: [], totals: [], revision: 1, comparison: null,
    };
    send({
      type: "embed:ready", protocol: 2, dataMode: "fictional", fictional: true,
      backend: "GroundedRelay-owned fixture", tools: [], capabilities: { checkout: true },
    });
    assert.equal(query.disabled, true, "ready alone must not unlock search");
    send(baseState);
    assert.equal(query.disabled, false, JSON.stringify({
      toolStatus: harness.document.getElementById("tool-status").textContent,
      resultStatus: harness.document.getElementById("result-status").textContent,
      providerUrl: harness.provider.src,
    }));
    assert.equal(searchButton.disabled, false);

    const products = harness.document.getElementById("products");
    for (const checkbox of products.querySelectorAll("[data-select]")) {
      checkbox.checked = true;
      products.emit("change", checkbox);
    }
    assert.equal(harness.document.getElementById("compare").disabled, false);
    send({ ...baseState, revision: 2, comparison: comparison(catalogue) });
    assert.equal(harness.document.getElementById("comparison").hidden, false);

    const firstCheckbox = products.querySelectorAll("[data-select]")[0];
    firstCheckbox.checked = false;
    products.emit("change", firstCheckbox);
    assert.equal(harness.document.getElementById("comparison").hidden, true,
      "checkbox changes must hide evidence immediately");
    assert.equal(harness.posted.at(-1).message.type, "host:clear-comparison");
    send({ ...baseState, revision: 3, comparison: null });

    send({ ...baseState, revision: 4, comparison: comparison(catalogue) });
    const picker = products.querySelectorAll("[data-variant-for]")[0];
    picker.value = "shoe:40";
    picker.focus();
    products.emit("change", picker);
    assert.equal(harness.document.activeElement.dataset.variantFor, "shoe");
    send({ ...baseState, revision: 5, comparison: comparison(catalogue) });
    assert.equal(harness.document.getElementById("comparison").hidden, true,
      "queued stale evidence must remain masked before clear acknowledgement");
    assert.equal(harness.document.activeElement.dataset.variantFor, "shoe",
      "queued provider state must restore the exact-option picker focus");
    send({ ...baseState, revision: 6, comparison: null });
    send({ ...baseState, revision: 7, comparison: comparison(catalogue) });
    assert.equal(harness.document.getElementById("comparison").hidden, false);

    const add = products.querySelectorAll("[data-add]")[0];
    add.focus();
    const cartLine = { ...shoes, sku: "shoe:40", selectedVariant: shoes.variants[1], qty: 1 };
    send({ ...baseState, revision: 8, cart: [cartLine], totals: [{ currency: "KES", total: 1000 }] });
    assert.equal(harness.document.activeElement.dataset.add, "shoe:40",
      "provider state must restore the exact Add control");
    assert.match(harness.document.getElementById("basket-status").textContent, /Basket updated\. 1 item\./);
    const remove = harness.document.getElementById("basket").querySelectorAll("[data-remove]")[0];
    assert.match(remove.ariaLabel, /Remove Nyota Road Running Shoe — EU 40 · Colour: Indigo/);
    remove.focus();
    send({ ...baseState, revision: 9, cart: [{ ...cartLine, qty: 2 }],
      totals: [{ currency: "KES", total: 2000 }] });
    assert.equal(harness.document.activeElement.dataset.remove, "shoe:40",
      "a retained line must restore its exact Remove control");
    send({ ...baseState, revision: 10, cart: [], totals: [] });
    assert.equal(harness.document.activeElement, harness.document.getElementById("basket-panel"));

    send({ ...baseState, revision: 11, comparison: comparison(catalogue) });
    query.value = "";
    const searchMessages = harness.posted.length;
    harness.document.getElementById("search-form").emit("submit");
    assert.equal(harness.document.getElementById("comparison").hidden, true);
    assert.equal(harness.document.getElementById("compare").disabled, true);
    assert.match(harness.document.getElementById("result-status").textContent, /Search cleared/);
    assert.equal(harness.posted.slice(searchMessages)
      .some(({ message }) => message.type === "host:search"), false);

    const reviewedCart = [{ ...shoes, qty: 1 }];
    send({ ...baseState, revision: 13, cart: reviewedCart,
      totals: [{ currency: "KES", total: 1000 }], comparison: null });
    const review = harness.document.getElementById("review");
    review.focus();
    review.emit("click");
    const requestId = harness.posted.findLast(({ message }) =>
      message.type === "host:checkout").message.requestId;
    send({
      type: "embed:awaiting-approval", requestId, approvalId: "approval-1",
      revision: 13, cart: reviewedCart,
    });
    harness.document.getElementById("approve").emit("click");
    send({
      type: "embed:approval-resolved", requestId,
      outcome: "approved", valid: true, reason: null,
    });
    send({
      type: "embed:handoff", requestId,
      handoff: [{
        store: "GroundedRelay Demo — Rift Runworks",
        items: [{ url: "http://localhost:5175/#handoff=groundedrelay-demo-rift-runworks" }],
      }],
    });
    assert.equal(harness.document.activeElement, harness.document.getElementById("close-handoff"));
    harness.document.getElementById("close-handoff").emit("click");
    assert.equal(harness.document.activeElement, review,
      "Done must return focus to the now-enabled Review handoff control");
  } finally {
    for (const [key, descriptor] of originals) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else delete globalThis[key];
    }
  }
});
