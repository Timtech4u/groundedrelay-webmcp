import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");

test("first-run search is usable while the bounded provider handshake finishes", async () => {
  const [html, host] = await Promise.all([
    read("../sites/storefront/index.html"),
    read("../sites/storefront/store.js"),
  ]);
  assert.match(html, /<form id="chat-form"[^>]+role="search"/);
  assert.match(html, /<input id="chat-input"[^>]+type="search"/);
  assert.doesNotMatch(html, /<input id="chat-input"[^>]+disabled/);
  assert.match(host, /queuedPrompt = \{ say: query, search: query \}/);
  assert.match(host, /after 10s/);
  assert.match(host, /Demo products could not be reached/);
  assert.match(html, /id="catalog-reload"/);
});

test("offline shell includes the fail-closed provider-mode dependency", async () => {
  const serviceWorker = await read("../sites/storefront/sw.js");
  assert.match(serviceWorker, /const CACHE = "groundedrelay-v10"/);
  assert.match(serviceWorker, /"\.\/provider-mode\.js"/);
  assert.match(serviceWorker, /"\.\/approval-view\.js"/);
  assert.match(serviceWorker, /"\.\/checkout-lifecycle\.js"/);
  assert.match(serviceWorker, /"\.\/serial-queue\.js"/);
});

test("the storefront explains a state-aware nine-tool surface without inline styles", async () => {
  const [html, host] = await Promise.all([
    read("../sites/storefront/index.html"),
    read("../sites/storefront/store.js"),
  ]);
  assert.match(host, /\$\("tool-summary"\)\.textContent = count\s*\? `\$\{count\} of \$\{totalProviderTools \|\| foreignTools\.size\} actions ready`/);
  assert.match(host, /actions useful for the current search, comparison, and basket state/);
  assert.doesNotMatch(html, /\sstyle=/);
  assert.doesNotMatch(host, /\sstyle=/);
  assert.match(host, /swatchClass\(p\.sku\)/);
  assert.match(host, /selectedVariantSkus\.set\(card\.dataset\.sku, picker\.value\)/);
  assert.match(host, /data-add-sku="\$\{esc\(activeSku\)\}"/);
  assert.match(host, /classifyStorefrontExperience\(d\)/);
  assert.match(host, /Fictional judge demo/);
  assert.match(host, /say: "Find fictional running shoes",\s*search: "fictional running shoes"/);
  assert.match(host, /say: "Browse products for cross-category comparison",\s*search: "fictional"/);
  assert.doesNotMatch(host, /say: "Show fictional shoes and travel bags"/);
  assert.doesNotMatch(host, /Compare two fictional running shoes available in Rwanda/);
  assert.doesNotMatch(host, /Compare a fictional running shoe and travel bag/);
  assert.doesNotMatch(host, /search: "fictional travel bag"/);
  assert.match(host, /chatMessage\("bot", "Searching fictional catalogues…", "pending"\)/);
  assert.doesNotMatch(host, /Searching live catalogues|RESEARCH_PROMPTS|SINGLE_CATALOGUE_PROMPTS/);
  assert.match(host, /createFictionalProviderGate\(STOREFRONT_MODE\.requireFictional\)/);
  assert.match(host, /providerModeGate\.receive\(kind, d\)/);
  assert.match(host, /const activePrompts = FIXTURE_PROMPTS/);
  assert.doesNotMatch(html, />Search live catalogues</);
  assert.match(host, /configured} demo catalogue\$\{configured === 1 \? "" : "s"} ready/);
});

test("direct fallback never presents provider capability totals as active agent actions", async () => {
  const host = await read("../sites/storefront/store.js");
  assert.doesNotMatch(host, /`\$\{totalProviderTools\} agent actions provided`/);
  assert.match(host, /\$\("tool-summary"\)\.textContent = "Checking agent actions…"/);
  assert.match(host, /function setDirectShoppingSummary\([^)]*\)[\s\S]+Direct shopping ready[\s\S]+\$\("trust"\)\.innerHTML[\s\S]+Direct search/);
  assert.match(host, /if \(!modelContext\) \{[\s\S]+setDirectShoppingSummary\([^)]*\)[\s\S]+direct local-search fallback/);
  assert.match(host, /getTools\(\{ fromOrigins:[\s\S]+catch \(e\) \{[\s\S]+setDirectShoppingSummary\([^)]*\)/);
  assert.match(host, /if \(!foreign\.length\) \{[\s\S]+setDirectShoppingSummary\([^)]*\)/);
  assert.match(host, /if \(!hoistedRegistrations\.size\) \{[\s\S]+setDirectShoppingSummary\([^)]*\)/);
});

test("raw storefront is fictional-safe before the provider attestation", async () => {
  const [html, host] = await Promise.all([
    read("../sites/storefront/index.html"),
    read("../sites/storefront/store.js"),
  ]);
  assert.match(html, /<title>GroundedRelay — fictional shopping demo<\/title>/);
  assert.match(html, /Fictional judge demo — all names,[\s\S]+GroundedRelay-owned examples/);
  assert.match(html, /This public demo uses GroundedRelay-owned fictional data/);
  assert.doesNotMatch(html, /African brands|downloads public product catalogues|Catalogue inclusion|each catalogue remains the source of truth/i);
  assert.match(host, /const experience = classifyStorefrontExperience\(d\)/);
  assert.match(host, /applyExperienceCopy\(configured\)/);
  assert.doesNotMatch(host, /isFictionalDemo|live research|live-research/);
  assert.match(host, /function providerUnreachable[\s\S]+applyExperienceCopy\(\)/);
});

test("approval and assistant work are cancellable and cannot wait forever", async () => {
  const [host, agent] = await Promise.all([
    read("../sites/storefront/store.js"),
    read("../sites/storefront/agent.js"),
  ]);
  assert.match(host, /This is taking longer than expected/);
  assert.match(host, /ignored a late handoff after the shopper cancelled/);
  assert.match(agent, /new AbortController\(\)/);
  assert.match(agent, /responseConstraint: schema, signal/);
  assert.match(agent, /runTool\(tool, step\.call\.args, controller\.signal\)/);
  assert.match(agent, /ft:cancel-agent/);
  assert.match(agent, /NUMERIC_REPLY_PATTERN/);
  assert.doesNotMatch(agent, /note\(`\$\{step\.call\.name\}/);
  assert.match(host, /allowedOrigins\.has\(url\.origin\)/);
  assert.doesNotMatch(host, /allowedHosts\.has\(url\.hostname/);
});

test("shopper status, comparison, basket, and dialogs expose accessible names", async () => {
  const html = await read("../sites/storefront/index.html");
  assert.match(html, /id="status"[^>]+role="status"[^>]+aria-live="polite"/);
  assert.match(html, /id="compare-guide"[^>]+role="status"/);
  assert.match(html, /id="cart"[^>]+aria-live="polite"/);
  assert.match(html, /id="approval"[^>]+role="dialog"[^>]+aria-modal="true"[\s\S]+aria-describedby="approval-description approval-fine"/);
  assert.match(html, /id="handoff"[^>]+role="dialog"[^>]+aria-modal="true"[\s\S]+aria-describedby="handoff-description"/);
});

test("a nonempty mobile basket exposes a focused jump target without a desktop control", async () => {
  const [html, css, host] = await Promise.all([
    read("../sites/storefront/index.html"),
    read("../sites/storefront/store.css"),
    read("../sites/storefront/store.js"),
  ]);
  assert.match(html, /id="basket-panel"[^>]+class="basket-panel"[^>]+tabindex="-1"/);
  assert.match(html, /id="basket-jump"[^>]+aria-controls="basket-panel"[^>]+hidden/);
  assert.match(css, /\.basket-jump \{ display: none \}/);
  assert.match(css, /@media \(max-width: 820px\)[\s\S]+\.basket-jump:not\(\[hidden\]\)[\s\S]+position: fixed/);
  assert.match(host, /\$\("basket-jump"\)\.hidden = itemCount === 0/);
  assert.match(host, /\$\("basket-jump"\)\.textContent = `View basket · \$\{itemCount\}`/);
  assert.match(host, /\$\("basket-jump"\)\.addEventListener\("click"[\s\S]+basket\.focus\(\{ preventScroll: true \}\)[\s\S]+basket\.scrollIntoView/);
  assert.match(host, /body > header, body > main, body > footer, #basket-jump/);
});

test("exact-option changes preserve focus, labels, and grounded comparison state", async () => {
  const host = await read("../sites/storefront/store.js");
  assert.match(host, /data-variant-label="\$\{esc\(variantDisplayText\(variant\) \?\? variant\.title\)\}"/);
  assert.match(host, /pendingVariantFocus = \{ productSku: card\.dataset\.sku, variantSku: picker\.value \}/);
  assert.match(host, /function restorePendingVariantFocus\(\)[\s\S]+picker\?\.value === target\.variantSku[\s\S]+picker\.focus\(\{ preventScroll: true \}\)/);
  assert.match(host, /add\.setAttribute\("aria-label", `Add \$\{productName\} — \$\{variantLabel\} to basket`\)/);
  assert.match(host, /compare\.setAttribute\("aria-label", `Compare \$\{productName\} — \$\{variantLabel\}`\)/);
  assert.match(host, /function requestComparisonClear\(\)[\s\S]+latestState = \{ \.\.\.latestState, comparison: null \}[\s\S]+renderComparison\(null\)[\s\S]+host:clear-comparison/);
  assert.match(host, /comparisonClearPending && hasIncomingComparison[\s\S]+\{ \.\.\.d, comparison: null \}/);
  assert.match(host, /\$\("clear-comparison"\)\.addEventListener\("click"[\s\S]+requestComparisonClear\(\)/);
  assert.match(host, /\$\("catalog"\)\.addEventListener\("change"[\s\S]+requestComparisonClear\(\)/);
  assert.match(host, /const removeLabel = variant[\s\S]+Remove \$\{i\.name\} — \$\{variant\} from basket[\s\S]+aria-label="\$\{esc\(removeLabel\)\}"/);
});
