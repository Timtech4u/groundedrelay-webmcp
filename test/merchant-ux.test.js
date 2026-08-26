import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");

test("independent host starts with an honest empty search and useful guidance", async () => {
  const html = await read("../sites/merchant-demo/index.html");
  assert.match(html, /id="query" type="search"\s+placeholder="Try fictional eggs, running shoes, or bags"/);
  assert.doesNotMatch(html, /id="query"[^>]+value=/);
  assert.match(html, /id="query"[\s\S]+autocomplete="off" disabled/);
  assert.match(html, /<button type="submit" disabled>Search<\/button>/);
});

test("independent host binds comparison and basket writes to the chosen exact variant", async () => {
  const client = await read("../sites/merchant-demo/client.js");
  assert.match(client, /const chosenVariants = new Map\(\)/);
  assert.match(client, /data-variant-for="\$\{esc\(key\)\}"/);
  assert.match(client, /candidate\.sku === picker\.value && candidate\.available/);
  assert.match(client, /selected\.set\(picker\.dataset\.variantFor, variant\.sku\)/);
  assert.match(client, /data-add="\$\{esc\(chosen\?\.sku \?\? ""\)\}"/);
  assert.match(client, /host:compare", skus: \[\.\.\.selected\.values\(\)\]/);
  assert.match(client, /aria-label="Compare \$\{esc\(product\.name\)\} — \$\{esc\(variantLabel\)\}"/);
  assert.match(client, /aria-label="Choose option for \$\{esc\(product\.name\)\}"/);
});

test("changing an exact option invalidates stale comparison evidence immediately", async () => {
  const client = await read("../sites/merchant-demo/client.js");
  assert.match(client,
    /function invalidateComparison\(message\)[\s\S]+state = \{ \.\.\.state, comparison: null \};\s*renderComparison\(\);/);
  assert.match(client,
    /Exact option changed\. Compare again to refresh the evidence\./);
  assert.match(client, /toProvider\(\{ type: "host:clear-comparison" \}\)/);
  assert.match(client,
    /stateThroughComparisonGate[\s\S]+return \{ \.\.\.message, comparison: null \}/,
    "queued provider state must remain masked until a newer clear acknowledgement");
  assert.match(client,
    /if \(!message\.comparison && Number\.isFinite\(revision\)[\s\S]+revision > comparisonInvalidationRevision/);
});

test("independent comparison and approval surfaces expose their evidence semantics", async () => {
  const html = await read("../sites/merchant-demo/index.html");
  const client = await read("../sites/merchant-demo/client.js");
  assert.match(html, /id="comparison"[^>]+role="region"[\s\S]+aria-live="polite"[\s\S]+aria-labelledby="comparison-title"/);
  assert.match(client, /<table><caption>Observed evidence for the selected products and exact variants\.<\/caption>/);
  assert.match(client, /<th scope="col">Evidence<\/th>/);
  assert.match(client, /const exactVariants = comparison\.rows\.find\(\(row\) => row\.key === "exact_variant"\)\?\.values \?\? \[\]/);
  assert.match(client, /esc\(exactVariants\[index\] \?\? "Exact option"\)/);
  assert.match(client, /<th scope="row">\$\{esc\(row\.label\)\}<\/th>/);
  assert.match(html, /id="approval"[\s\S]+aria-describedby="approval-note"/);
  assert.match(html, /id="approval-note">No payment or order can happen in this sandbox\.<\/p>/);
});

test("mobile basket affordance appears from real basket state and moves focus", async () => {
  const html = await read("../sites/merchant-demo/index.html");
  const client = await read("../sites/merchant-demo/client.js");
  const css = await read("../sites/merchant-demo/style.css");
  assert.match(html, /id="basket-panel" tabindex="-1" aria-labelledby="basket-title"/);
  assert.match(html, /id="basket-status"[^>]+role="status" aria-live="polite"/);
  assert.match(html, /id="basket-jump"[^>]+hidden[\s\S]+aria-controls="basket-panel"/);
  assert.match(client, /\$\("basket-jump"\)\.hidden = !count/);
  assert.match(client, /\$\("basket-panel"\)\.scrollIntoView\(/);
  assert.match(client, /\$\("basket-panel"\)\.focus\(\{ preventScroll: true \}\)/);
  assert.match(css, /\.basket-jump:not\(\[hidden\]\)[^{]*\{[^}]+position: fixed/);
  assert.match(client,
    /aria-label="Remove \$\{esc\(line\.name\)\} — \$\{esc\(variantLabel\)\}"/);
});
