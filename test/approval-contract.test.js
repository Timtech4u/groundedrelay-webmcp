import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  approvalCartSnapshot,
  approvalRevisionResult,
} from "../sites/embed/approval.js";
import { interpretApprovalResolution } from
  "../sites/merchant-demo/approval-resolution.js";
import { approvalVariantText } from "../sites/storefront/approval-view.js";
import { approvalVariantText as merchantApprovalVariantText } from
  "../sites/merchant-demo/approval-view.js";
import { variantDisplayText as providerVariantDisplayText } from
  "../sites/embed/variant-text.js";
import { variantDisplayText as storefrontVariantDisplayText } from
  "../sites/storefront/approval-view.js";
import { variantDisplayText as merchantVariantDisplayText } from
  "../sites/merchant-demo/approval-view.js";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");

test("approval snapshot carries an immutable exact variant", () => {
  const options = ["Forest", "EU 40"];
  const [snapshot] = approvalCartSnapshot([{
    sku: "shoe:40",
    name: "Nyota Road Running Shoe",
    store: "BasketShipper Demo — Rift Runworks",
    host: "groundedrelay-merchant.pages.dev",
    qty: 1,
    currency: "KES",
    selectedVariant: { title: "Forest / EU 40", options },
    ignoredPrivateField: "must not cross",
  }]);
  assert.deepEqual(snapshot, {
    sku: "shoe:40",
    name: "Nyota Road Running Shoe",
    store: "BasketShipper Demo — Rift Runworks",
    host: "groundedrelay-merchant.pages.dev",
    qty: 1,
    currency: "KES",
    selectedVariant: { title: "Forest / EU 40", options: ["Forest", "EU 40"] },
  });
  options[0] = "changed after snapshot";
  assert.equal(snapshot.selectedVariant.options[0], "Forest");
});

test("both human approval modals visibly render the escaped exact variant", async () => {
  const storefront = await read("../sites/storefront/store.js");
  const independentHost = await read("../sites/merchant-demo/client.js");
  const html = await read("../sites/storefront/index.html");
  assert.match(storefront, /esc\(variantText\)/);
  assert.match(independentHost, /approvalVariantText\(item\.selectedVariant\)/);
  assert.match(independentHost, /esc\(variantText\)/);
  assert.match(html, /Approval reveals reviewed\s+links only/);
  assert.match(html, /no\s+purchase or payment occurs in BasketShipper/);
  assert.doesNotMatch(html, /approval opens the relevant merchant pages/);
});

test("primary approval rendered text does not repeat an exact title option", () => {
  const cases = [
    [{ title: "EU 40", options: ["EU 40"] }, "Exact variant: EU 40"],
    [{ title: "Forest / EU 40", options: ["Forest", "EU 40"] },
      "Exact variant: Forest / EU 40"],
    [{ title: "EU 40", options: ["Colour: Indigo", "Colour: Indigo"] },
      "Exact variant: EU 40 · Colour: Indigo"],
    [{ title: "Indigo", options: ["Colour: Indigo"] }, "Exact variant: Indigo"],
    [null, null],
  ];
  for (const [input, expected] of cases) {
    assert.equal(approvalVariantText(input), expected);
    assert.equal(merchantApprovalVariantText(input), expected);
    const display = expected?.replace(/^Exact variant: /, "") ?? null;
    assert.equal(storefrontVariantDisplayText(input), display);
    assert.equal(merchantVariantDisplayText(input), display);
    assert.equal(providerVariantDisplayText(input), display);
  }
});

test("cards, baskets and comparisons keep the full exact variant visible", async () => {
  const storefront = await read("../sites/storefront/store.js");
  const independentHost = await read("../sites/merchant-demo/client.js");
  const catalogue = await read("../sites/embed/backends/catalogue.js");
  assert.match(storefront, /variantDisplayText\(variant\)/);
  assert.match(storefront, /variantDisplayText\(i\.selectedVariant\)/);
  assert.match(storefront, /aria-label="Choose option for/);
  assert.match(independentHost, /variantDisplayText\(product\.selectedVariant\)/);
  assert.match(independentHost, /variantDisplayText\(line\.selectedVariant\)/);
  assert.match(catalogue, /variantDisplayText\(item\.selectedVariant\)/);
});

test("native evidence fails closed on missing or unusable screenshots", async () => {
  const probe = await read("../scripts/native-webmcp-check.mjs");
  assert.match(probe, /await Promise\.all\(artifactWrites\)/);
  assert.match(probe, /bytes\.subarray\(0, 8\)\.equals\(pngSignature\)/);
  assert.match(probe, /width < 600 \|\| height < 400/);
  assert.match(probe, /throw new Error\(`Invalid evidence screenshot/);
  assert.match(probe, /screenshotDetails/);
});

test("the owned fixture projects exact variant details into basket state", async () => {
  const fixture = await read("../sites/embed/backends/demo.js");
  assert.match(fixture, /selectedVariant:\s*\{/);
  assert.match(fixture, /variants,/);
});

test("a basket mutation during open approval rejects immediately without a link wait", async () => {
  const reviewedRevision = 7;
  let currentRevision = reviewedRevision;
  currentRevision += 1; // Human/page mutation while the approval modal is open.

  const providerResolution = approvalRevisionResult(
    reviewedRevision, currentRevision);
  assert.deepEqual(providerResolution,
    { outcome: "rejected", valid: false, reason: "stale" });
  const merchantResolution = interpretApprovalResolution(providerResolution);
  assert.equal(merchantResolution.waitForLinks, false,
    "stale approval must recover now, not start the ten-second link watchdog");
  assert.match(merchantResolution.status, /basket changed during review/i);

  const provider = await read("../sites/embed/embed.js");
  const independentHost = await read("../sites/merchant-demo/client.js");
  assert.doesNotMatch(provider,
    /post\(\{\s*type: "embed:approval-resolved"\s*\}\)/,
    "the provider must never emit an ambiguous bare resolution");
  assert.match(provider,
    /approvalRevisionResult\([\s\S]+if \(!revisionResult\.valid\)[\s\S]+postApprovalResolved\(revisionResult/,
    "approved+valid may be emitted only after the post-approval revision check");
  assert.match(provider,
    /postApprovalResolved\(\s*\{ outcome: "rejected", valid: false, reason \}, lifecycle\?\.requestId\)/);
  assert.match(independentHost,
    /const resolution = interpretApprovalResolution\(message\);[\s\S]+if \(resolution\.waitForLinks\) \{[\s\S]+handoffTimer = setTimeout/);
  assert.match(independentHost,
    /else \{\s*suppressHandoff = true;\s*clearCheckoutWait\(resolution\.status\)/);
});

test("direct checkout request ids cross every provider response boundary", async () => {
  const provider = await read("../sites/embed/embed.js");
  const independentHost = await read("../sites/merchant-demo/client.js");
  for (const type of [
    "embed:awaiting-approval", "embed:approval-resolved", "embed:handoff",
  ]) {
    const start = provider.indexOf(`type: "${type}"`);
    assert.notEqual(start, -1, `${type} must exist`);
    assert.match(provider.slice(start, start + 420),
      /requestMetadata\((?:lifecycle\.)?requestId\)/,
      `${type} must retain the optional direct request id`);
  }
  assert.match(independentHost, /host:checkout", requestId: checkoutRequestId/);
  assert.match(independentHost, /matchesCheckoutRequest\(message\)/);
});

test("independent-host veto re-enables the return target before restoring focus", async () => {
  const independentHost = await read("../sites/merchant-demo/client.js");
  const start = independentHost.indexOf('$("veto").addEventListener');
  const end = independentHost.indexOf('$("close-handoff")', start);
  const vetoBlock = independentHost.slice(start, end);
  assert.ok(vetoBlock.indexOf("clearCheckoutWait(") < vetoBlock.indexOf('closeModal("approval")'),
    "render must re-enable Review handoff before closeModal restores focus to it");

  const recoveryStart = independentHost.indexOf("function recoverProviderUi");
  const recoveryEnd = independentHost.indexOf("function providerUnavailable", recoveryStart);
  const recoveryBlock = independentHost.slice(recoveryStart, recoveryEnd);
  assert.ok(recoveryBlock.indexOf("clearCheckoutWait(")
    < recoveryBlock.indexOf('closeModal("approval")'));
});
