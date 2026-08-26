import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

import { agentContextDriftKinds } from "../scripts/check-public-release.mjs";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");

test("deployment publishes a clean tracked snapshot and smoke-stops in safe order", async () => {
  const source = await read("../scripts/deploy-cloudflare.sh");
  assert.match(source, /git status --porcelain=v1 --untracked-files=all/);
  assert.match(source, /github\.com\/Timtech4u\/groundedrelay-webmcp/);
  assert.match(source, /git symbolic-ref --quiet --short HEAD/);
  assert.match(source, /git fetch --quiet origin main/);
  assert.match(source, /"\$commit_sha" != "\$origin_main_sha"/);
  assert.match(source, /git archive "\$commit_sha" sites\/storefront sites\/embed sites\/merchant-demo/);
  assert.equal(source.match(/--commit-hash "\$commit_sha"/g)?.length, 3);
  assert.doesNotMatch(source, /--commit-dirty/);
  assert.match(source, /npm run check/);
  assert.match(source, /npm run check:release -- --code-only/);
  assert.match(source, /whoami --json/);
  assert.match(source, /pages project list --json/);
  assert.match(source, /for project_name in groundedrelay groundedrelay-provider groundedrelay-merchant/);
  assert.match(source, /candidate\?\.\["Project Name"\] === name/);
  assert.match(source, /project\["Project Domains"\]/);
  assert.equal(source.match(/site_tree_check "/g)?.length, 3);
  assert.match(source, /shasum -a 256/);
  assert.match(source, /"\$remote_hash" != "\$expected_hash"/);

  const storefront = source.indexOf('pages deploy "$snapshot_dir/sites/storefront"');
  const storefrontSmoke = source.indexOf('site_tree_check "storefront"');
  const provider = source.indexOf('pages deploy "$snapshot_dir/sites/embed"');
  const providerSmoke = source.indexOf('site_tree_check "provider"');
  const merchant = source.indexOf('pages deploy "$snapshot_dir/sites/merchant-demo"');
  const merchantSmoke = source.indexOf('site_tree_check "merchant"');
  assert.ok(storefront < storefrontSmoke && storefrontSmoke < provider);
  assert.ok(provider < providerSmoke && providerSmoke < merchant);
  assert.ok(merchant < merchantSmoke);
});

test("public provider is fixture-only and ships no third-party catalogue adapter", async () => {
  const [provider, checker] = await Promise.all([
    read("../sites/embed/embed.js"),
    read("../scripts/check-public-release.mjs"),
  ]);
  assert.match(provider, /createRightsSafeBackend\(\{ merchantOrigin: merchantDemoBase \}\)/);
  assert.doesNotMatch(provider, /Shopify|createWebBackend|research-stores|backend=web/);
  assert.doesNotMatch(provider, /name:\s*"(?:apply_coupon|read_reviews)"/);
  assert.match(checker, /THIRD_PARTY_ADAPTER/);
  assert.match(checker, /TOOL_SURFACE_DRIFT/);
  assert.match(checker, /apply_coupon\|read_reviews/);
  assert.match(checker, /document\\\.modelContext\\\.registerTool/);
  for (const field of ["name", "title", "description", "inputSchema", "annotations", "execute"]) {
    assert.match(checker, new RegExp(`"${field}"`));
  }
  assert.match(checker, /exposedTo/);
  for (const path of [
    "../sites/embed/backends/web.js",
    "../sites/embed/backends/shopify.js",
    "../sites/embed/backends/research-stores.example.js",
    "../sites/embed/backends/research-stores.local.js",
  ]) {
    await assert.rejects(access(new URL(path, import.meta.url)));
  }
});

test("public history checks fail closed without printing personal identifiers", async () => {
  const checker = await read("../scripts/check-public-release.mjs");
  assert.match(checker, /fail\("LOCAL_FILE_IN_HISTORY"/);
  assert.match(checker, /fail\("PERSONAL_IDENTIFIER_IN_HISTORY"/);
  assert.match(checker, /the value is withheld/i);
  assert.doesNotMatch(checker, /warn\("LOCAL_FILE_IN_HISTORY"/);
});

test("hidden agent context uses only the current Pages and fixture contracts", async () => {
  const [deploymentSkill, webmcpSkill, checker] = await Promise.all([
    read("../.claude/skills/cloudflare-pages-deploy/SKILL.md"),
    read("../.claude/skills/webmcp-api/SKILL.md"),
    read("../scripts/check-public-release.mjs"),
  ]);
  await assert.rejects(access(new URL("../.claude/skills/vercel-deploy/SKILL.md", import.meta.url)));

  for (const expected of [
    "https://github.com/Timtech4u/groundedrelay-webmcp",
    "https://groundedrelay.pages.dev",
    "https://groundedrelay-provider.pages.dev",
    "https://groundedrelay-merchant.pages.dev",
    "npm run deploy:cloudflare",
  ]) assert.match(deploymentSkill, new RegExp(expected.replaceAll(".", "\\.")));

  for (const action of [
    "list_shops", "get_shopping_state", "search_products", "inspect_products",
    "focus_products", "compare_products", "highlight_evidence",
    "set_basket_quantity", "prepare_checkout_handoff",
  ]) assert.match(webmcpSkill, new RegExp(`\\b${action}\\b`));
  assert.match(webmcpSkill, /WIRE_PREFIX/);
  assert.match(webmcpSkill, /JSON\.stringify\(input \?\? \{\}\)/);
  assert.match(webmcpSkill, /Approve or Veto/);
  assert.deepEqual(agentContextDriftKinds(`${deploymentSkill}\n${webmcpSkill}`), []);

  assert.match(checker, /path\.startsWith\("\.claude\/skills\/"\)/);
  assert.match(checker, /STALE_AGENT_CONTEXT/);
});

test("agent context drift detector blocks retired identities and selectors but allows basket semantics", () => {
  assert.deepEqual(agentContextDriftKinds(
    "Basket contents and basket revisions remain visible to the shopper.",
  ), []);

  const stale = [
    "Deploy Basket to the retired storefront.",
    "Use https://basketshopper.com for production.",
    "Load the Shopify adapter with createShopifyBackend.",
    "Rehearse with ?scope=fixture and a diagnostic provider override.",
  ].map((text) => agentContextDriftKinds(text));
  assert.ok(stale[0].includes("retired product name"));
  assert.ok(stale[1].includes("retired product domain"));
  assert.ok(stale[2].includes("retired external-catalogue adapter"));
  assert.ok(stale[3].includes("retired URL-selected runtime"));
});
