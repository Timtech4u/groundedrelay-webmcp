#!/usr/bin/env node

// Native WebMCP compatibility probe for an already-running, isolated Chrome
// DevTools endpoint. The script does not launch a browser or use a default
// profile. See docs/NATIVE-WEBMCP-EVIDENCE.md for the exact launch procedure.

import { mkdir, readFile, stat, writeFile } from "node:fs/promises";

const args = Object.fromEntries(process.argv.slice(2).map((entry) => {
  const [key, ...value] = entry.split("=");
  return [key.replace(/^--/, ""), value.join("=")];
}));

const devtools = args.devtools ?? "http://127.0.0.1:9333";
const browserRunWebSocket = process.env.CLOUDFLARE_BROWSER_RUN_WS || null;
const storefront = args.url ?? "https://groundedrelay.pages.dev/";
const provider = args.provider ?? "https://groundedrelay-provider.pages.dev";
const timeoutMs = Number(args.timeout ?? 45_000);
const artifactDirectory = args.artifacts || null;
const scenarioName = args.scenario ?? "fictional";
const scenarios = {
  fictional: {
    configured: 3,
    query: "fictional",
    fallbackQuery: "fictional",
    searched: 3,
    expectedMatches: 6,
    targetNames: ["Nyota Road Running Shoe", "Asa Canvas Weekender"],
    targetEvidence: ["KE/KES", "GH/GHS"],
    desiredVariants: ["EU 40", "Indigo"],
    expectedApprovalLines: [
      { product: "Nyota Road Running Shoe", variant: "Exact variant: EU 40 · Colour: Indigo" },
      { product: "Asa Canvas Weekender", variant: "Exact variant: Indigo" },
    ],
    expectedTotals: ["GHS", "KES"],
    handoffCount: 2,
    excludeTerm: null,
    dataMode: "fictional_judge_demo",
    handoffPrefix: "https://groundedrelay-merchant.pages.dev/",
  },
};
const selectedScenario = scenarios[scenarioName];
if (!selectedScenario) throw new Error(`Unknown --scenario=${scenarioName}`);
const scenario = {
  ...selectedScenario,
  handoffPrefix: args["handoff-prefix"] ?? selectedScenario.handoffPrefix,
};

const expectedProviderNames = [
  "wire__compare_products",
  "wire__focus_products",
  "wire__get_shopping_state",
  "wire__highlight_evidence",
  "wire__inspect_products",
  "wire__list_shops",
  "wire__prepare_checkout_handoff",
  "wire__search_products",
  "wire__set_basket_quantity",
];
const expectedInitialNames = [
  "get_shopping_state",
  "list_shops",
  "search_products",
];

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function readJson(url, options) {
  const response = await fetch(url, options);
  if (!response.ok) throw new Error(`${response.status} ${response.statusText} from ${url}`);
  return response.json();
}

class CdpSession {
  constructor(webSocketDebuggerUrl) {
    this.url = webSocketDebuggerUrl;
    this.socket = null;
    this.nextId = 1;
    this.pending = new Map();
    this.listeners = new Map();
  }

  async connect() {
    this.socket = new WebSocket(this.url);
    await new Promise((resolve, reject) => {
      this.socket.addEventListener("open", resolve, { once: true });
      this.socket.addEventListener("error", reject, { once: true });
    });
    this.socket.addEventListener("message", ({ data }) => {
      const message = JSON.parse(String(data));
      if (!message.id) {
        for (const listener of this.listeners.get(message.method) ?? []) {
          listener(message.params);
        }
        return;
      }
      const pending = this.pending.get(message.id);
      if (!pending) return;
      this.pending.delete(message.id);
      clearTimeout(pending.timer);
      if (message.error) pending.reject(new Error(`${message.error.code}: ${message.error.message}`));
      else pending.resolve(message.result);
    });
  }

  on(method, listener) {
    const listeners = this.listeners.get(method) ?? [];
    listeners.push(listener);
    this.listeners.set(method, listeners);
  }

  send(method, params = {}, timeout = timeoutMs) {
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`${method} timed out after ${timeout} ms`));
      }, timeout);
      this.pending.set(id, { resolve, reject, timer });
      this.socket.send(JSON.stringify({ id, method, params }));
    });
  }

  close() {
    this.socket?.close();
  }
}

async function evaluate(session, expression, timeout = timeoutMs) {
  const response = await session.send("Runtime.evaluate", {
    expression,
    awaitPromise: true,
    returnByValue: true,
    userGesture: true,
  }, timeout);
  if (response.exceptionDetails) {
    const detail = response.exceptionDetails.exception?.description
      ?? response.exceptionDetails.text
      ?? "Unknown browser exception";
    throw new Error(detail);
  }
  return response.result.value;
}

const readinessExpression = `
  (async () => {
    const mc = document.modelContext || navigator.modelContext;
    if (document.readyState !== "complete" || !mc) {
      return { ready: false, state: document.readyState, hasModelContext: Boolean(mc) };
    }
    try {
      const foreign = (await mc.getTools({ fromOrigins: [${JSON.stringify(provider)}] }))
        .filter((tool) => tool.origin === ${JSON.stringify(provider)});
      const local = (await mc.getTools())
        .filter((tool) => !tool.origin || tool.origin === location.origin);
      const localNames = local.map((tool) => tool.name);
      return {
        ready: foreign.length === 9 && ${JSON.stringify(expectedInitialNames)}
          .every((name) => localNames.includes(name)),
        foreign: foreign.map((tool) => tool.name),
        local: localNames,
      };
    } catch (error) {
      return { ready: false, error: error.name + ": " + error.message };
    }
  })()
`;

const journeyExpression = `
  (async () => {
    const PROVIDER = ${JSON.stringify(provider)};
    const SCENARIO = ${JSON.stringify(scenario)};
    const SCENARIO_NAME = ${JSON.stringify(scenarioName)};
    const EXPECTED_PROVIDER = ${JSON.stringify(expectedProviderNames)};
    const EXPECTED_INITIAL = ${JSON.stringify(expectedInitialNames)};
    const mc = document.modelContext || navigator.modelContext;
    const checks = [];
    const details = {};
    const check = (name, ok, detail) => checks.push({ name, ok: Boolean(ok), detail });
    const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
    const parse = (value) => {
      if (typeof value !== "string") return value;
      try { return JSON.parse(value); } catch { return value; }
    };
    const cleanTools = async () => (await mc.getTools())
      .filter((tool) => !tool.origin || tool.origin === location.origin);
    const cleanNames = async () => (await cleanTools()).map((tool) => tool.name).sort();
    const waitForTool = async (name, present = true, ms = 5_000) => {
      const until = performance.now() + ms;
      do {
        const names = await cleanNames();
        if (names.includes(name) === present) return names;
        await wait(80);
      } while (performance.now() < until);
      return cleanNames();
    };
    const run = async (name, input = {}) => {
      const tool = (await cleanTools()).find((candidate) => candidate.name === name);
      if (!tool) throw new Error("Missing clean tool: " + name);
      return parse(await mc.executeTool(tool, JSON.stringify(input)));
    };
    const visibleBox = (element) => {
      const box = element?.getBoundingClientRect();
      const style = element ? getComputedStyle(element) : null;
      const intersectsViewport = Boolean(box && box.bottom > 0 && box.right > 0
        && box.top < innerHeight && box.left < innerWidth);
      return {
        visible: Boolean(element && style.display !== "none" && style.visibility !== "hidden"
          && Number(style.opacity) > 0 && box.width > 0 && box.height > 0
          && intersectsViewport),
        width: Math.round(box?.width ?? 0),
        height: Math.round(box?.height ?? 0),
        top: Math.round(box?.top ?? 0),
        left: Math.round(box?.left ?? 0),
        intersectsViewport,
      };
    };

    if (!mc) throw new Error("document.modelContext is unavailable");
    details.userAgent = navigator.userAgent;
    details.page = location.href;
    details.provider = PROVIDER;
    details.viewport = { width: innerWidth, height: innerHeight };

    const initial = await cleanNames();
    check("settled clean surface matches visible page state",
      (initial.length === 3 || initial.length === 7)
      && EXPECTED_INITIAL.every((name) => initial.includes(name)), initial.join(", "));

    const discovered = (await mc.getTools({ fromOrigins: [PROVIDER] }))
      .filter((tool) => tool.origin === PROVIDER);
    const providerNames = discovered.map((tool) => tool.name).sort();
    check("nine provider capabilities", JSON.stringify(providerNames) === JSON.stringify(EXPECTED_PROVIDER),
      providerNames.join(", "));
    check("provider origin", discovered.every((tool) => tool.origin === PROVIDER),
      [...new Set(discovered.map((tool) => tool.origin))].join(", "));
    check("wire names avoid collision", discovered.every((tool) => tool.name.startsWith("wire__")),
      "all provider names use wire__");
    details.providerSchemaTypes = [...new Set(discovered.map((tool) => typeof tool.inputSchema))];
    details.providerAnnotations = Object.fromEntries(discovered.map((tool) => [
      tool.name, tool.annotations ?? null,
    ]));

    const wireList = discovered.find((tool) => tool.name === "wire__list_shops");
    const direct = parse(await mc.executeTool(wireList, "{}"));
    check("direct cross-origin execution", direct?.ok
      && direct.configured === SCENARIO.configured,
      JSON.stringify({ configured: direct?.configured, reachable: direct?.reachable,
        checked: direct?.checked, pending: direct?.pending, ready: direct?.ready }));
    check("initial readiness is explicit", Number.isInteger(direct?.checked)
      && Number.isInteger(direct?.pending)
      && direct.checked + direct.pending === direct.configured
      && direct.ready === (direct.pending === 0),
      JSON.stringify({ checked: direct?.checked, pending: direct?.pending,
        ready: direct?.ready }));

    const shops = await run("list_shops");
    check("clean hoist execution", shops?.ok
      && shops.configured === SCENARIO.configured,
      JSON.stringify({ configured: shops?.configured, reachable: shops?.reachable }));
    if (SCENARIO.dataMode) {
      check("fictional catalogue disclosure", shops.data_mode === SCENARIO.dataMode
        && /fictional/i.test(String(shops.data_notice))
        && shops.shops.every((shop) => /^BasketShipper Demo/.test(shop.name)),
        JSON.stringify({ data_mode: shops.data_mode, notice: shops.data_notice,
          shops: shops.shops.map((shop) => shop.name) }));
    }

    // The fictional fixture intentionally preloads useful products, so a fresh
    // page can settle at seven tools before a probe observes an empty state.
    // Force a real zero-result search instead of relying on that startup race:
    // the observable contract must then contract to the three baseline tools.
    const emptySearch = await run("search_products", {
      query: "zz-basket-native-no-match-9f4d2c7a", ships_to: "RW",
    });
    const emptySurface = await waitForTool("compare_products", false);
    check("zero-match search returns no products", emptySearch?.ok
      && emptySearch.matched === 0 && emptySearch.products?.length === 0,
      JSON.stringify({ matched: emptySearch?.matched,
        products: emptySearch?.products?.length,
        result_set_id: emptySearch?.result_set_id }));
    check("no-result surface is exactly 3 actions", emptySurface.length === 3
      && EXPECTED_INITIAL.every((name) => emptySurface.includes(name)),
      emptySurface.join(", "));

    let search = await run("search_products", {
      query: SCENARIO.query, ships_to: "RW",
    });
    if ((search?.products?.filter((product) => product.available).length ?? 0) < 2) {
      search = await run("search_products", {
        query: SCENARIO.fallbackQuery, ships_to: "RW",
      });
    }
    const available = search?.products?.filter((product) => product.available) ?? [];
    const targetProducts = SCENARIO.targetNames
      ? SCENARIO.targetNames.map((name) => available.find((product) => product.name === name))
      : available.slice(0, 2);
    check("scenario search and named products are available", search?.ok
      && search.searched === SCENARIO.searched
      && search.matched === SCENARIO.expectedMatches
      && targetProducts.length === 2 && targetProducts.every(Boolean)
      && (!SCENARIO.excludeTerm || available.every((product) =>
        !product.name.toLowerCase().includes(SCENARIO.excludeTerm))),
      JSON.stringify({ matched: search?.matched, available: available.length,
        targets: targetProducts.map((product) => product?.name),
        observed_at: search?.observed_at, result_set_id: search?.result_set_id }));
    const targetEvidence = targetProducts.map((product) =>
      product ? product.catalogueMarket + "/" + product.currency : "missing");
    check("explicit market and currency evidence",
      JSON.stringify(targetEvidence) === JSON.stringify(SCENARIO.targetEvidence),
      targetEvidence.join(", "));

    const shopsAfterSearch = await run("list_shops");
    check("all configured catalogues ready after search",
      shopsAfterSearch?.reachable === SCENARIO.configured
      && shopsAfterSearch.checked === SCENARIO.configured && shopsAfterSearch.pending === 0
      && shopsAfterSearch.ready === true,
      JSON.stringify({ configured: shopsAfterSearch?.configured,
        reachable: shopsAfterSearch?.reachable, checked: shopsAfterSearch?.checked,
        pending: shopsAfterSearch?.pending, ready: shopsAfterSearch?.ready }));

    const resultSurface = await waitForTool("compare_products");
    check("result-state surface is exactly 7 actions", resultSurface.length === 7
      && ["inspect_products", "focus_products", "compare_products", "set_basket_quantity"]
        .every((name) => resultSurface.includes(name)),
      resultSurface.join(", "));

    if (targetProducts.some((product) => !product)) {
      throw new Error("Scenario returned fewer than two named available products");
    }
    const skus = targetProducts.map((product) => product.sku);
    const inspection = await run("inspect_products", { skus });
    check("exact variant inspection for both products", inspection?.ok
      && inspection.products?.length === 2
      && inspection.products.every((product) => product.variants?.length > 0),
      JSON.stringify(inspection?.products?.map((product) => ({
        name: product.name, sku: product.sku, variants: product.variants?.length,
      }))));
    if (SCENARIO_NAME === "fictional") {
      const variants = inspection?.products
        ?.find((product) => product.name === "Nyota Road Running Shoe")?.variants ?? [];
      check("available variant selected instead of first variant",
        variants[0]?.available === false && variants.some((variant) => variant.available)
        && targetProducts[0].sku !== variants[0]?.sku,
        JSON.stringify({ selected: targetProducts[0].sku, first: variants[0]?.sku,
          firstAvailable: variants[0]?.available }));
    }
    const basketSkus = SCENARIO.desiredVariants
      ? SCENARIO.desiredVariants.map((needle, index) => {
          const product = inspection.products.find((item) =>
            item.name === targetProducts[index].name);
          return product?.variants.find((variant) => variant.available
            && (variant.title === needle || variant.options?.includes(needle)))?.sku;
        })
      : [skus[0]];
    check("requested exact variants are available", basketSkus.every(Boolean),
      JSON.stringify(SCENARIO.desiredVariants
        ? SCENARIO.desiredVariants.map((variant, index) => ({ variant, sku: basketSkus[index] }))
        : [{ variant: "search default", sku: basketSkus[0] }]));

    const chosenSkus = basketSkus;
    const focus = await run("focus_products", { skus: chosenSkus });
    check("visible product focus", focus?.ok
      && chosenSkus.every((sku) => focus.focused?.includes(sku)),
      JSON.stringify(focus));

    const comparison = await run("compare_products", { skus: chosenSkus });
    check("structured comparison", comparison?.ok && comparison.compared?.length === 2,
      JSON.stringify({ compared: comparison?.compared?.length, fields: comparison?.fields }));
    const comparisonElement = document.getElementById("comparison");
    comparisonElement.scrollIntoView({ block: "center" });
    await wait(100);
    const comparisonBox = visibleBox(comparisonElement);
    check("comparison rendered", comparisonBox.visible, JSON.stringify(comparisonBox));

    const comparisonSurface = await waitForTool("highlight_evidence");
    check("comparison-state surface is exactly 8 actions", comparisonSurface.length === 8
      && comparisonSurface.includes("highlight_evidence"),
      comparisonSurface.join(", "));
    const highlighted = await run("highlight_evidence", {
      fields: ["merchant", "exact_variant", "availability", "currency", "current_price"],
    });
    await wait(100);
    const rows = [...document.querySelectorAll("#comparison tr.evidence")];
    check("grounded evidence highlighted", highlighted?.ok && rows.length === 5,
      JSON.stringify({ fields: highlighted?.highlighted, renderedRows: rows.length }));
    comparisonElement.scrollIntoView({ block: "center" });
    console.info("__BASKET_NATIVE_CAPTURE__:comparison-evidence");
    await wait(250);

    const beforeAdd = await run("get_shopping_state");
    const staleAdd = await run("set_basket_quantity", {
      sku: basketSkus[0], quantity: 1, expected_state_revision: beforeAdd.revision - 1,
    });
    check("stale basket mutation rejected", staleAdd?.ok === false,
      JSON.stringify(staleAdd?.error));
    let basketState = beforeAdd;
    const mutationEvidence = [];
    for (const sku of basketSkus) {
      const beforeRevision = basketState.revision;
      const added = await run("set_basket_quantity", {
        sku, quantity: 1, expected_state_revision: beforeRevision,
      });
      mutationEvidence.push({ sku, before: beforeRevision, after: added?.revision, ok: added?.ok });
      basketState = await run("get_shopping_state");
    }
    check("revision-safe exact-variant mutations", mutationEvidence.every((entry) =>
      entry.ok && Number(entry.after) > Number(entry.before)),
      JSON.stringify(mutationEvidence));
    check("shared basket contains every chosen exact variant", basketState?.basket?.length === basketSkus.length
      && basketSkus.every((sku) => basketState.basket.some((line) =>
        line.sku === sku && line.quantity === 1)), JSON.stringify(basketState?.basket));
    const totalCurrencies = (basketState?.totals_by_currency ?? [])
      .map((total) => total.currency).sort();
    check("currency totals stay separate and are never combined",
      JSON.stringify(totalCurrencies) === JSON.stringify(SCENARIO.expectedTotals)
      && basketState.totals_by_currency.every((total) => Number(total.total) > 0),
      JSON.stringify(basketState?.totals_by_currency));

    const basketSurface = await waitForTool("prepare_checkout_handoff");
    check("basket-state surface is exactly 9 actions", basketSurface.length === 9
      && basketSurface.includes("prepare_checkout_handoff"),
      basketSurface.join(", "));

    const staleHandoff = await run("prepare_checkout_handoff", {
      expected_state_revision: basketState.revision - 1,
    });
    check("stale handoff rejected before review", staleHandoff?.ok === false
      && staleHandoff.error?.code === "STALE_STATE"
      && !visibleBox(document.getElementById("approval")).visible,
      JSON.stringify(staleHandoff?.error));

    const vetoPromise = run("prepare_checkout_handoff", {
      expected_state_revision: basketState.revision,
    }).then((value) => ({ resolved: true, value }), (error) => ({
      resolved: false, name: error.name, message: error.message,
    }));
    let approvalBox;
    for (let i = 0; i < 50; i += 1) {
      approvalBox = visibleBox(document.getElementById("approval"));
      if (approvalBox.visible) break;
      await wait(40);
    }
    check("human approval visibly parks", approvalBox?.visible, JSON.stringify(approvalBox));
    const approvalLines = [...document.querySelectorAll("#approval-items > p")]
      .map((line) => line.innerText.replace(/\\s+/g, " ").trim());
    check("approval binds each product to its exact labelled variant",
      SCENARIO.expectedApprovalLines.every((expected) => approvalLines.some((line) =>
        line.includes(expected.product) && line.includes(expected.variant))),
      JSON.stringify(approvalLines));
    check("safe veto receives focus", document.activeElement?.id === "veto",
      document.activeElement?.id ?? "none");
    console.info("__BASKET_NATIVE_CAPTURE__:human-veto");
    await wait(250);
    document.getElementById("veto").click();
    const vetoed = await vetoPromise;
    check("veto rejects in-flight call", vetoed.resolved === false,
      JSON.stringify(vetoed));
    const afterVeto = await run("get_shopping_state");
    check("basket survives veto", afterVeto.basket?.length === basketSkus.length,
      JSON.stringify(afterVeto.basket));

    const approvePromise = run("prepare_checkout_handoff", {
      expected_state_revision: afterVeto.revision,
    }).then((value) => ({ resolved: true, value }), (error) => ({
      resolved: false, name: error.name, message: error.message,
    }));
    for (let i = 0; i < 50; i += 1) {
      approvalBox = visibleBox(document.getElementById("approval"));
      if (approvalBox.visible) break;
      await wait(40);
    }
    document.getElementById("approve").click();
    const approved = await approvePromise;
    check("approval resolves to link-ready handoff only", approved.resolved === true
      && /links are ready/i.test(String(approved.value))
      && !/opening/i.test(String(approved.value)),
      JSON.stringify(approved));
    let handoffBox;
    for (let i = 0; i < 50; i += 1) {
      handoffBox = visibleBox(document.getElementById("handoff"));
      if (handoffBox.visible) break;
      await wait(40);
    }
    const handoffLinks = [...document.querySelectorAll("#handoff-links a")]
      .map((link) => link.href);
    check("exact merchant handoff rendered", handoffBox?.visible
      && handoffLinks.length === SCENARIO.handoffCount
      && handoffLinks.every((url) => url.startsWith(SCENARIO.handoffPrefix)),
      JSON.stringify({ box: handoffBox, links: handoffLinks }));
    details.handoffLinks = handoffLinks;
    check("approval did not navigate", location.href === ${JSON.stringify(storefront)}, location.href);
    console.info("__BASKET_NATIVE_CAPTURE__:approved-handoff");
    await wait(250);
    (document.getElementById("handoff-close")
      ?? document.getElementById("close-handoff")).click();

    let cleanupState = await run("get_shopping_state");
    const cleanupEvidence = [];
    for (const sku of basketSkus) {
      const removed = await run("set_basket_quantity", {
        sku, quantity: 0, expected_state_revision: cleanupState.revision,
      });
      cleanupEvidence.push({ sku, ok: removed?.ok, revision: removed?.revision });
      cleanupState = await run("get_shopping_state");
    }
    check("isolated basket cleanup", cleanupEvidence.every((entry) => entry.ok),
      JSON.stringify(cleanupEvidence));
    const finalState = cleanupState;
    check("basket empty after cleanup", finalState.basket?.length === 0,
      JSON.stringify(finalState.basket));
    const finalSurface = await waitForTool("prepare_checkout_handoff", false);
    check("handoff retracts to 8-action comparison surface", finalSurface.length === 8
      && !finalSurface.includes("prepare_checkout_handoff"),
      finalSurface.join(", "));

    const transitions = (window.__basketNativeToolTransitions ?? [])
      .filter((entry, index, all) => index === 0
        || entry.names.join("|") !== all[index - 1].names.join("|"));
    const transitionCounts = [...new Set(transitions.map((entry) => entry.names.length))];
    const lifecycleCounts = [emptySurface, resultSurface, comparisonSurface, basketSurface]
      .map((surface) => surface.length);
    check("state-aware lifecycle is exactly 3 -> 7 -> 8 -> 9",
      JSON.stringify(lifecycleCounts) === JSON.stringify([3, 7, 8, 9]),
      lifecycleCounts.join(" -> "));
    details.scenario = SCENARIO_NAME;
    details.lifecycleSurfaces = {
      noResults: emptySurface,
      results: resultSurface,
      comparison: comparisonSurface,
      basket: basketSurface,
    };
    details.observedToolchangeCounts = transitionCounts;
    details.toolTransitions = transitions;

    return { checks, details, initialSurface: initial, finalSurface };
  })()
`;

let target;
let session;
const artifactWrites = [];
let screencastFrames = 0;
try {
  let browser;
  if (browserRunWebSocket) {
    session = new CdpSession(browserRunWebSocket);
    await session.connect();
    const version = await session.send("Browser.getVersion");
    browser = {
      Browser: version.product,
      "Protocol-Version": version.protocolVersion,
    };
  } else {
    browser = await readJson(`${devtools}/json/version`);
    target = await readJson(`${devtools}/json/new?${encodeURIComponent("about:blank")}`, {
      method: "PUT",
    });
    session = new CdpSession(target.webSocketDebuggerUrl);
    await session.connect();
  }
  await session.send("Runtime.enable");
  await session.send("Page.enable");
  await session.send("Page.addScriptToEvaluateOnNewDocument", {
    source: `
      window.__basketNativeToolTransitions = [];
      const recordBasketTools = async () => {
        const mc = document.modelContext || navigator.modelContext;
        if (!mc) return;
        try {
          const names = (await mc.getTools())
            .filter((tool) => !tool.origin || tool.origin === location.origin)
            .map((tool) => tool.name).sort();
          window.__basketNativeToolTransitions.push({
            at: performance.now(), names,
          });
        } catch {}
      };
      let basketToolListenerInstalled = false;
      const installBasketToolListener = () => {
        const mc = document.modelContext || navigator.modelContext;
        if (!mc || basketToolListenerInstalled) return;
        basketToolListenerInstalled = true;
        mc.addEventListener("toolchange", () => queueMicrotask(recordBasketTools));
        recordBasketTools();
      };
      installBasketToolListener();
      addEventListener("DOMContentLoaded", installBasketToolListener, { once: true });
    `,
  });

  if (artifactDirectory) {
    await mkdir(artifactDirectory, { recursive: true });
    session.on("Runtime.consoleAPICalled", (event) => {
      const marker = event.args?.map((item) => item.value).find((value) =>
        typeof value === "string" && value.startsWith("__BASKET_NATIVE_CAPTURE__:"));
      if (!marker) return;
      const name = marker.split(":").at(-1).replace(/[^a-z0-9-]/gi, "-");
      const capture = session.send("Page.captureScreenshot", {
        format: "png", fromSurface: true, captureBeyondViewport: false,
      }, 10_000).then(({ data }) =>
        writeFile(`${artifactDirectory}/${name}.png`, Buffer.from(data, "base64")));
      artifactWrites.push(capture);
    });
    session.on("Page.screencastFrame", (event) => {
      screencastFrames += 1;
      const name = String(screencastFrames).padStart(5, "0");
      artifactWrites.push(writeFile(
        `${artifactDirectory}/frame-${name}.jpg`, Buffer.from(event.data, "base64")));
      session.send("Page.screencastFrameAck", { sessionId: event.sessionId }, 5_000)
        .catch(() => {});
    });
    await session.send("Page.startScreencast", {
      format: "jpeg", quality: 76, maxWidth: 1280, maxHeight: 900, everyNthFrame: 1,
    });
  }

  await session.send("Page.navigate", { url: storefront });

  const started = Date.now();
  let readiness;
  while (Date.now() - started < timeoutMs) {
    readiness = await evaluate(session, readinessExpression, 10_000);
    if (readiness?.ready) break;
    await delay(250);
  }
  if (!readiness?.ready) {
    throw new Error(`Native surface did not become ready: ${JSON.stringify(readiness)}`);
  }

  const countPageTargets = async () => browserRunWebSocket
    ? (await session.send("Target.getTargets")).targetInfos
      .filter((item) => item.type === "page").length
    : (await readJson(`${devtools}/json/list`)).filter((item) => item.type === "page").length;
  const targetCountBefore = await countPageTargets();
  const evidence = await evaluate(session, journeyExpression, 90_000);
  if (artifactDirectory) {
    await session.send("Page.stopScreencast");
    await Promise.all(artifactWrites);
    const screenshotNames = [
      "comparison-evidence.png", "human-veto.png", "approved-handoff.png",
    ];
    const pngSignature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
    const screenshotDetails = await Promise.all(screenshotNames.map(async (name) => {
      const path = `${artifactDirectory}/${name}`;
      const [bytes, info] = await Promise.all([readFile(path), stat(path)]);
      const validPng = bytes.length >= 24 && bytes.subarray(0, 8).equals(pngSignature);
      const width = validPng ? bytes.readUInt32BE(16) : 0;
      const height = validPng ? bytes.readUInt32BE(20) : 0;
      if (!info.isFile() || info.size < 1_000 || width < 600 || height < 400) {
        throw new Error(`Invalid evidence screenshot ${name}: ${width}x${height}, ${info.size} bytes`);
      }
      return { name, width, height, bytes: info.size };
    }));
    evidence.artifacts = {
      directory: artifactDirectory,
      screenshots: screenshotNames,
      screenshotDetails,
      screencastFrames,
    };
  }
  const targetCountAfter = await countPageTargets();
  const handoffResponses = await Promise.all(
    (evidence.details?.handoffLinks ?? []).map(async (url) => {
      const response = await fetch(url, { redirect: "follow" });
      const body = await response.text();
      return {
        url,
        status: response.status,
        fictionalDisclosure: /fictional/i.test(body) && /payment/i.test(body)
          && /order/i.test(body),
      };
    }),
  );
  evidence.checks.push({
    name: "handoff target is reachable and rights-safe",
    ok: handoffResponses.length > 0 && handoffResponses.every((item) =>
      item.status === 200 && (scenarioName !== "fictional" || item.fictionalDisclosure)),
    detail: JSON.stringify(handoffResponses),
  });
  evidence.checks.push({
    name: "no automatic page opened",
    ok: targetCountAfter === targetCountBefore,
    detail: `${targetCountBefore} page target(s) before, ${targetCountAfter} after`,
  });
  evidence.browser = browser.Browser;
  evidence.protocolVersion = browser["Protocol-Version"];
  evidence.storefront = storefront;
  evidence.provider = provider;
  evidence.scenario = scenarioName;
  evidence.checkedAt = new Date().toISOString();

  if (artifactDirectory) {
    await writeFile(`${artifactDirectory}/native-webmcp-evidence.json`,
      `${JSON.stringify(evidence, null, 2)}\n`);
  }

  for (const item of evidence.checks) {
    console.log(`${item.ok ? "PASS" : "FAIL"} ${item.name}: ${item.detail}`);
  }
  const passed = evidence.checks.filter((item) => item.ok).length;
  console.log(`\n${passed}/${evidence.checks.length} native runtime checks passed`);
  console.log(`EVIDENCE_JSON ${JSON.stringify(evidence)}`);
  if (passed !== evidence.checks.length) process.exitCode = 1;
} catch (error) {
  console.error(`NATIVE_WEBMCP_CHECK_FAILED ${error.stack ?? error}`);
  process.exitCode = 1;
} finally {
  session?.close();
  if (!browserRunWebSocket && target?.id) {
    await fetch(`${devtools}/json/close/${target.id}`).catch(() => {});
  }
}
