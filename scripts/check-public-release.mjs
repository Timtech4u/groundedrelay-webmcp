#!/usr/bin/env node

import { existsSync, readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("../", import.meta.url));
const codeOnly = process.argv.includes("--code-only");
const online = process.argv.includes("--online");
const failures = [];
const warnings = [];
const passes = [];

export const DEPLOYED_CATALOGUE_CONTRACT = Object.freeze({
  merchants: Object.freeze([
    Object.freeze({ id: "groundedrelay-demo-kigali", name: "GroundedRelay Demo — Kigali Pantry", countryCode: "RW", market: "RW", currency: "RWF" }),
    Object.freeze({ id: "groundedrelay-demo-rift", name: "GroundedRelay Demo — Rift Runworks", countryCode: "KE", market: "KE", currency: "KES" }),
    Object.freeze({ id: "groundedrelay-demo-accra", name: "GroundedRelay Demo — Accra Carry Studio", countryCode: "GH", market: "GH", currency: "GHS" }),
  ]),
  productIds: Object.freeze([
    "family-egg-tray", "weekend-egg-box", "nyota-road-runner",
    "bonde-trail-runner", "asa-weekender", "cocoa-grid-carryall",
  ]),
});

const fail = (code, message) => failures.push({ code, message });
const warn = (code, message) => warnings.push({ code, message });
const pass = (message) => passes.push(message);

function git(args, { allowFailure = false, input } = {}) {
  const result = spawnSync("git", args, {
    cwd: ROOT,
    encoding: "utf8",
    input,
    maxBuffer: 32 * 1024 * 1024,
  });
  if (result.status !== 0 && !allowFailure) {
    throw new Error(`git ${args.join(" ")} failed: ${result.stderr.trim()}`);
  }
  return result.stdout ?? "";
}

function read(path) {
  try {
    return readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
  } catch {
    fail("MISSING_FILE", `${path} is required for a public release.`);
    return "";
  }
}

function optionalRead(path) {
  try { return readFileSync(new URL(`../${path}`, import.meta.url), "utf8"); }
  catch { return ""; }
}

function cspDirective(csp, name) {
  const directive = csp.split(";")
    .map((value) => value.trim())
    .find((value) => value === name || value.startsWith(`${name} `));
  return directive ? directive.split(/\s+/).slice(1) : [];
}

export function deployedCatalogueDrift(source) {
  const drift = [];
  const merchantSection = source.match(
    /RIGHTS_SAFE_MERCHANTS\s*=\s*Object\.freeze\(\[([\s\S]*?)\]\);/,
  )?.[1] ?? "";
  const productSection = source.match(
    /RAW_PRODUCTS\s*=\s*Object\.freeze\(\[([\s\S]*?)\]\);/,
  )?.[1] ?? "";
  const merchantIds = [...merchantSection.matchAll(/\bid:\s*"([^"]+)"/g)].map((match) => match[1]);
  const productIds = [...productSection.matchAll(/\bmerchant:\s*"[^"]+",\s*id:\s*"([^"]+)"/g)]
    .map((match) => match[1]);
  const expectedMerchantIds = DEPLOYED_CATALOGUE_CONTRACT.merchants.map(({ id }) => id);

  if (JSON.stringify(merchantIds) !== JSON.stringify(expectedMerchantIds)) {
    drift.push(`expected exactly ${expectedMerchantIds.length} catalogue ids in release order`);
  }
  if (JSON.stringify(productIds) !== JSON.stringify(DEPLOYED_CATALOGUE_CONTRACT.productIds)) {
    drift.push(`expected exactly ${DEPLOYED_CATALOGUE_CONTRACT.productIds.length} product ids in release order`);
  }
  for (const merchant of DEPLOYED_CATALOGUE_CONTRACT.merchants) {
    const block = merchantSection.match(
      new RegExp(`id:\\s*"${merchant.id}"[\\s\\S]*?keywords:\\s*Object\\.freeze`),
    )?.[0] ?? "";
    for (const [field, value] of Object.entries(merchant)) {
      if (field !== "id" && !block.includes(`${field}: "${value}"`)) {
        drift.push(`${merchant.id} is missing ${field}=${value}`);
      }
    }
  }
  if (/RIGHTS_SAFE_MERCHANTS\s*(?:\.slice\(\s*0\s*,\s*1\s*\)|\[\s*0\s*\])/.test(source)) {
    drift.push("fixture narrows the merchant roster to one catalogue");
  }
  return drift;
}

function vercelCsp(path) {
  try {
    const config = JSON.parse(read(path));
    return config.headers?.flatMap((entry) => entry.headers ?? [])
      .find((header) => header.key?.toLowerCase() === "content-security-policy")?.value ?? "";
  } catch (error) {
    fail("INVALID_DEPLOY_CONFIG", `${path} is not valid deployment JSON: ${error.message}`);
    return "";
  }
}

const privateKeyPattern = new RegExp([
  "-----BEGIN ",
  "(?:(?:RSA|EC|OPENSSH|DSA) )?",
  "PRIVATE KEY-----",
  "|-----BEGIN PGP PRIVATE KEY (?:BLOCK)-----",
].join(""));
const personalEmailPattern = new RegExp([
  "\\b[A-Z0-9._%+-]+@(?:gmail|googlemail|yahoo|hotmail|outlook|live|icloud|me|",
  "protonmail|proton|fastmail|aol)\\.(?:com|net|org|co\\.[a-z]{2})\\b",
].join(""), "i");

export const SECRET_DETECTORS = [
  // Assemble this detector so a release scan does not flag its own source.
  ["private key", privateKeyPattern],
  ["AWS access key", /\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/],
  ["GitHub token", /\b(?:gh[pousr]_[A-Za-z0-9_]{20,}|github_pat_[A-Za-z0-9_]{20,})\b/],
  ["OpenAI-style secret", /\bsk-[A-Za-z0-9_-]{20,}\b/],
  ["Google API key", /\bAIza[0-9A-Za-z_-]{20,}\b/],
  ["Google OAuth client secret", /\bGOCSPX-[0-9A-Za-z_-]{20,}\b/],
  ["Slack token", /\bxox[baprs]-[0-9A-Za-z-]{10,}\b/],
  ["npm token", /\bnpm_[A-Za-z0-9]{30,}\b/],
  ["Shopify Admin token", /\bshp(?:at|ca|pa|ss)_[A-Za-z0-9]{20,}\b/],
  ["Stripe live secret", /\b(?:sk|rk)_live_[A-Za-z0-9]{16,}\b/],
  ["bearer credential", /\bBearer\s+[A-Za-z0-9._~+/-]{20,}={0,2}\b/i],
  ["credential assignment", /\b(?:api[_-]?key|access[_-]?token|secret[_-]?access[_-]?key|client[_-]?secret|private[_-]?key|password)\s*[:=]\s*["'][A-Za-z0-9_./+=-]{20,}["']/i],
];

export function secretKinds(text) {
  return SECRET_DETECTORS
    .filter(([, pattern]) => pattern.test(text))
    .map(([kind]) => kind);
}

export const AGENT_CONTEXT_DRIFT_DETECTORS = [
  ["retired product name", /^(?:name|description):[^\n]*\bBasket\b|\bBasket(?:'s|-owned)\b|\bBasket\s+(?:WebMCP|app(?:lication)?|architecture|demo|deployment|platform|product|project|provider|repository|runtime|storefront)\b|\b(?:Build|Deploy|Run)\s+Basket\b/m],
  ["retired product domain", /\bbasketshopper(?:-[a-z0-9-]+)?(?:\.com)?\b/i],
  ["retired external-catalogue adapter", /\bShopify\b|create(?:Shopify|Web)Backend|backends\/(?:shopify|web)\.js|research-stores/i],
  ["retired URL-selected runtime", /\?(?:embed|scope|backend)(?:=|\b)|(?:^|[^\w])(?:scope|backend)=(?:fixture|research|web|shopify)\b|searchParams\.get\(\s*["'](?:embed|scope|backend)["']\s*\)|\b(?:diagnostic provider|query|provider|backend-selection)\s+overrides?\b/im],
];

export function agentContextDriftKinds(text) {
  return AGENT_CONTEXT_DRIFT_DETECTORS
    .filter(([, pattern]) => pattern.test(text))
    .map(([kind]) => kind);
}

function checkTrackedAgentContext(candidateFiles) {
  const legacySkillPath = ".claude/skills/vercel-deploy/SKILL.md";
  if (existsSync(new URL(`../${legacySkillPath}`, import.meta.url))) {
    fail("STALE_AGENT_CONTEXT", `${legacySkillPath} is retired; use the Cloudflare Pages release skill.`);
  }

  const deploymentSkillPath = ".claude/skills/cloudflare-pages-deploy/SKILL.md";
  const deploymentSkill = read(deploymentSkillPath);
  const deploymentRequirements = [
    "name: cloudflare-pages-deploy",
    "https://github.com/Timtech4u/groundedrelay-webmcp",
    "https://groundedrelay.pages.dev",
    "https://groundedrelay-provider.pages.dev",
    "https://groundedrelay-merchant.pages.dev",
    "`groundedrelay`",
    "`groundedrelay-provider`",
    "`groundedrelay-merchant`",
    "npm run deploy:cloudflare",
    "npm run check:release -- --online",
  ];
  const missingDeploymentContext = deploymentRequirements
    .filter((value) => !deploymentSkill.includes(value));
  if (missingDeploymentContext.length) {
    fail("STALE_AGENT_CONTEXT",
      `${deploymentSkillPath} is missing ${missingDeploymentContext.length} current repository, Pages, project, or release-command contract(s).`);
  }

  const webmcpSkillPath = ".claude/skills/webmcp-api/SKILL.md";
  const webmcpSkill = read(webmcpSkillPath);
  const webmcpRequirements = [
    "name: webmcp-api",
    "https://groundedrelay.pages.dev",
    "https://groundedrelay-provider.pages.dev",
    "https://groundedrelay-merchant.pages.dev",
    "WIRE_PREFIX",
    "getTools({ fromOrigins: [PROVIDER_ORIGIN] })",
    "JSON.stringify(input ?? {})",
    "GroundedRelay-owned fictional",
    "Approve or Veto",
    "list_shops", "get_shopping_state", "search_products", "inspect_products",
    "focus_products", "compare_products", "highlight_evidence",
    "set_basket_quantity", "prepare_checkout_handoff",
  ];
  const missingWebmcpContext = webmcpRequirements.filter((value) => !webmcpSkill.includes(value));
  if (missingWebmcpContext.length) {
    fail("STALE_AGENT_CONTEXT",
      `${webmcpSkillPath} is missing ${missingWebmcpContext.length} current origin, protocol, fixture, handoff, or tool-surface contract(s).`);
  }

  const hiddenAgentFiles = candidateFiles.filter((path) =>
    path.startsWith(".claude/skills/")
    && existsSync(new URL(`../${path}`, import.meta.url)));
  for (const path of hiddenAgentFiles) {
    const text = optionalRead(path);
    for (const kind of agentContextDriftKinds(text)) {
      fail("STALE_AGENT_CONTEXT", `${path} contains a ${kind} instruction.`);
    }
  }

  if (!failures.some(({ code }) => code === "STALE_AGENT_CONTEXT")) {
    pass("Hidden agent skills use the current GroundedRelay fixture-only WebMCP and Cloudflare Pages contracts.");
  }
}

function scanCandidateFiles(candidateFiles) {
  const blocked = candidateFiles.filter((path) =>
    /(^|\/)(?:\.env(?:\..*)?|\.wrangler\/|settings\.local\.json$|credentials?(?:\.|$)|secrets?(?:\.|$)|id_(?:rsa|ed25519)$)|\.(?:pem|p12|pfx|key)$/i.test(path));
  for (const path of blocked) {
    fail("LOCAL_FILE_TRACKED", `${path} is local or credential-adjacent and must not be tracked.`);
  }

  for (const path of candidateFiles) {
    let text;
    try { text = readFileSync(new URL(`../${path}`, import.meta.url), "utf8"); }
    catch { continue; }
    for (const kind of secretKinds(text)) {
      fail("SECRET_IN_HEAD", `${kind} signature found in release candidate ${path}; value withheld.`);
    }
    if (/\/(?:Users|home)\/[A-Za-z0-9._-]+\//.test(text)) {
      fail("PRIVATE_PATH_IN_HEAD", `A user-specific absolute filesystem path appears in release candidate ${path}.`);
    }
  }
  if (!failures.some(({ code }) => [
    "LOCAL_FILE_TRACKED", "SECRET_IN_HEAD", "PRIVATE_PATH_IN_HEAD",
  ].includes(code))) {
    pass("Public-release candidate files contain no known secret signatures or local credential files.");
  }
}

function scanReachableHistory() {
  const objects = git(["rev-list", "--objects", "--all"], { allowFailure: true })
    .trim().split("\n").filter(Boolean);
  if (!objects.length) {
    warn("NO_GIT_HISTORY", "No reachable Git history was available for secret scanning.");
    return;
  }

  const pathByObject = new Map();
  for (const line of objects) {
    const split = line.indexOf(" ");
    const oid = split === -1 ? line : line.slice(0, split);
    const path = split === -1 ? "(Git object)" : line.slice(split + 1);
    if (!pathByObject.has(oid)) pathByObject.set(oid, path);
  }
  const ids = [...pathByObject.keys()];
  const metadata = git(["cat-file", "--batch-check=%(objectname) %(objecttype) %(objectsize)"], {
    input: `${ids.join("\n")}\n`,
  }).trim().split("\n");

  const findings = new Set();
  let personalIdentifierFound = false;
  for (const line of metadata) {
    const [oid, type, sizeText] = line.split(" ");
    const size = Number(sizeText);
    if (type !== "blob" || !Number.isFinite(size) || size > 2_000_000) continue;
    const body = git(["cat-file", "blob", oid], { allowFailure: true });
    if (body.includes("\0")) continue;
    for (const kind of secretKinds(body)) {
      findings.add(`${kind} signature found in reachable history at ${pathByObject.get(oid)}; value withheld.`);
    }
    if (personalEmailPattern.test(body)) personalIdentifierFound = true;
  }
  for (const message of findings) fail("SECRET_IN_HISTORY", message);
  if (!findings.size) pass("Reachable Git history contains no known secret signatures.");

  const historicalPaths = git(["log", "--all", "--pretty=format:", "--name-only"], {
    allowFailure: true,
  }).split("\n").filter(Boolean);
  if (historicalPaths.some((path) => /(^|\/)settings\.local\.json$/i.test(path))) {
    fail("LOCAL_FILE_IN_HISTORY", "A local settings file is reachable in Git history; publish from sanitized history instead.");
  }
  const commitEmails = git(["log", "--all", "--format=%ae%n%ce"], { allowFailure: true });
  if (personalEmailPattern.test(commitEmails)) personalIdentifierFound = true;
  if (personalIdentifierFound) {
    fail("PERSONAL_IDENTIFIER_IN_HISTORY",
      "A personal email address is reachable in Git history; the value is withheld. Publish from sanitized history instead.");
  }
}

function checkSecurityContracts() {
  const provider = read("sites/embed/embed.js");
  const storefront = read("sites/storefront/store.js");
  const approvalView = read("sites/storefront/approval-view.js");
  const providerMode = read("sites/storefront/provider-mode.js");
  const providerOrigin = read("sites/storefront/provider-origin.js");
  const agent = read("sites/storefront/agent.js");
  const merchantClient = read("sites/merchant-demo/client.js");
  const merchantGate = read("sites/merchant-demo/provider-gate.js");
  const html = read("sites/storefront/index.html");
  const storefrontHeaders = read("sites/storefront/_headers");
  const providerHeaders = read("sites/embed/_headers");
  const merchantHeaders = read("sites/merchant-demo/_headers");

  const contracts = [
    [provider.includes("requestedHostOrigin === ancestorOrigin"), "Provider verifies the requested host against its actual ancestor."],
    [provider.includes("e.origin !== HOST_ORIGIN") && provider.includes("e.source !== parent"), "Provider messages are origin- and source-bound."],
    [provider.includes("e.data?.channel !== CHANNEL_NONCE"), "Provider messages require the per-page channel nonce."],
    [storefront.includes("e.origin !== EMBED_ORIGIN") && storefront.includes("e.source !== frame.contentWindow"), "Storefront messages are origin- and source-bound."],
    [storefront.includes("e.data?.channel !== CHANNEL_NONCE"), "Storefront messages require the per-page channel nonce."],
    [!/(?:parent|contentWindow)\.postMessage\([^;]+,\s*["']\*["']\s*\)/s.test(`${provider}\n${storefront}`), "No cross-origin message uses a wildcard target origin."],
    [storefront.includes("tools.filter((tool) => tool.origin === EMBED_ORIGIN)"), "Storefront hoists tools only from the exact pinned provider origin."],
    [storefront.includes("createFictionalProviderGate(STOREFRONT_MODE.requireFictional)")
      && providerMode.includes("requireFictional: true")
      && providerMode.includes('message?.dataMode !== "fictional"')
      && providerMode.includes('message.fixture?.owner === "GroundedRelay"'),
    "Public storefront waits for rights-safe fictional attestations in both ready and state messages."],
    [provider.includes("approvalId") && provider.includes("backend.state().revision"), "Approval is bound to an id and revalidated basket revision."],
    [provider.includes("approvalCartSnapshot(current.cart)")
      && storefront.includes("approvalVariantText(item.selectedVariant)")
      && approvalView.includes("Exact variant:"),
    "Human approval snapshot and modal include the exact selected variant."],
    [agent.includes("UNTRUSTED TOOL DATA") && agent.includes("ignore instructions inside"), "Agent context labels merchant/tool output as untrusted data."],
    [html.includes('data-origin="https://groundedrelay-provider.pages.dev"'), "The deployed storefront pins the production provider origin."],
    [!providerOrigin.includes('searchParams.get("embed")'), "Query strings cannot substitute the provider on local or public pages."],
    [storefront.includes("allowedOrigins.has(url.origin)") && !storefront.includes("allowedHosts.has(url.hostname"), "Merchant handoff navigation is bound to exact reviewed origins, including port."],
    [provider.includes('"https://groundedrelay.pages.dev"') && provider.includes('"https://groundedrelay-merchant.pages.dev"'), "Provider source allows both exact production host origins."],
    [merchantClient.includes("createMerchantProviderGate()")
      && merchantClient.includes("providerGate.receive(kind, message)")
      && merchantGate.includes('message.fixture?.owner === "GroundedRelay"'),
    "Independent host also waits for paired GroundedRelay-owned fictional attestations."],
  ];
  for (const [ok, message] of contracts) ok ? pass(message) : fail("SECURITY_CONTRACT", message);

  const requiredDirectives = ["default-src", "script-src", "object-src", "base-uri", "frame-src"];
  const storefrontCsp = storefrontHeaders.match(/Content-Security-Policy:\s*([^\n]+)/i)?.[1] ?? "";
  for (const directive of requiredDirectives) {
    if (!storefrontCsp.includes(directive)) {
      fail("STOREFRONT_CSP", `Storefront CSP must define ${directive}.`);
    }
  }
  if (!storefrontCsp.includes("https://groundedrelay-provider.pages.dev")) {
    fail("STOREFRONT_CSP", "Storefront CSP must pin frame-src to the production provider.");
  }
  if (JSON.stringify(cspDirective(storefrontCsp, "connect-src"))
      !== JSON.stringify(["'self'"])
      || JSON.stringify(cspDirective(storefrontCsp, "img-src"))
      !== JSON.stringify(["'self'", "data:"])) {
    fail("STOREFRONT_CSP", "Public storefront network and image policy must be fixture-only (self plus data images)." );
  }

  const providerCsp = providerHeaders.match(/Content-Security-Policy:\s*([^\n]+)/i)?.[1] ?? "";
  for (const directive of ["default-src", "script-src", "object-src", "base-uri", "frame-ancestors"]) {
    if (!providerCsp.includes(directive)) fail("PROVIDER_CSP", `Provider CSP must define ${directive}.`);
  }
  if (JSON.stringify(cspDirective(providerCsp, "connect-src"))
      !== JSON.stringify(["'self'"])
      || JSON.stringify(cspDirective(providerCsp, "img-src"))
      !== JSON.stringify(["'self'", "data:"])) {
    fail("PROVIDER_CSP", "Public provider network and image policy must be fixture-only (self plus data images)." );
  }
  const expectedProviderAncestors = [
    "https://groundedrelay.pages.dev",
    "https://groundedrelay-merchant.pages.dev",
  ];
  const actualProviderAncestors = cspDirective(providerCsp, "frame-ancestors");
  if (JSON.stringify(actualProviderAncestors) !== JSON.stringify(expectedProviderAncestors)) {
    fail("PROVIDER_CSP", `Provider frame-ancestors must be exactly ${expectedProviderAncestors.join(" and ")}.`);
  }

  const merchantCsp = merchantHeaders.match(/Content-Security-Policy:\s*([^\n]+)/i)?.[1] ?? "";
  for (const directive of requiredDirectives) {
    if (!merchantCsp.includes(directive)) fail("MERCHANT_CSP", `Independent host CSP must define ${directive}.`);
  }
  if (JSON.stringify(cspDirective(merchantCsp, "frame-src"))
      !== JSON.stringify(["https://groundedrelay-provider.pages.dev"])) {
    fail("MERCHANT_CSP", "Independent host frame-src must be exactly the production provider origin.");
  }

  for (const [path, expectedCsp] of [
    ["sites/storefront/vercel.json", storefrontCsp],
    ["sites/embed/vercel.json", providerCsp],
    ["sites/merchant-demo/vercel.json", merchantCsp],
  ]) {
    if (vercelCsp(path) !== expectedCsp) {
      fail("LEGACY_HEADER_DRIFT", `${path} CSP must match the corresponding Cloudflare _headers policy exactly.`);
    }
  }

  for (const [label, headers] of [
    ["storefront", storefrontHeaders],
    ["provider", providerHeaders],
    ["independent host", merchantHeaders],
  ]) {
    if (!/X-Content-Type-Options:\s*nosniff/i.test(headers)) fail("HEADERS", `${label} must send X-Content-Type-Options: nosniff.`);
    if (!/Referrer-Policy:/i.test(headers)) fail("HEADERS", `${label} must send a Referrer-Policy.`);
    if (!/Permissions-Policy:/i.test(headers)) fail("HEADERS", `${label} must send a Permissions-Policy.`);
  }
}

function checkReleaseArtifacts(candidateFiles) {
  const required = [
    "LICENSE", "README.md", "docs/AFRICA-FIRST.md", "docs/BLOG-POST.md",
    "docs/EVALS.md", "evals/native-agent-cases.jsonl",
  ];
  for (const path of required) read(path);

  const license = read("LICENSE");
  if (/MIT License/.test(license)) pass("MIT license is present.");
  else fail("LICENSE", "A recognizable MIT license is required.");

  const readme = read("README.md");
  if (!readme.includes("https://groundedrelay.pages.dev")) fail("README", "README must name the submitted production URL.");
  const registrationSnippet = readme.match(
    /document\.modelContext\.registerTool\(\s*\{([\s\S]{0,1600}?)\}\s*,\s*\{\s*exposedTo\s*:/,
  );
  const registrationFields = ["name", "title", "description", "inputSchema", "annotations", "execute"];
  if (!registrationSnippet
      || registrationFields.some((field) => !new RegExp(`\\b${field}\\s*:`).test(registrationSnippet[1]))) {
    fail("README_WEBMCP_SNIPPET", "README must include a literal document.modelContext.registerTool({ ... }) excerpt with the canonical tool fields and exposedTo audience.");
  }

  const agents = read("AGENTS.md");
  const expectedTools = [
    "list_shops", "get_shopping_state", "search_products", "inspect_products",
    "focus_products", "compare_products", "highlight_evidence",
    "set_basket_quantity", "prepare_checkout_handoff",
  ];
  const missing = expectedTools.filter((name) => !agents.includes(`\`${name}\``));
  if (missing.length) fail("TOOL_DOC_DRIFT", `AGENTS.md is missing current tools: ${missing.join(", ")}.`);
  else pass("AGENTS.md names the current nine-action provider surface.");

  const deploymentHandoff = read("docs/CLOUDFLARE-DEPLOYMENT-HANDOFF.md");
  if (/frame-ancestors[^\n]*(?:\n[^\n]*)?(?:localhost|127\.0\.0\.1)/i.test(deploymentHandoff)) {
    fail("DEPLOYMENT_DOC_DRIFT", "Deployment handoff still claims production frame-ancestors allows loopback.");
  }

  checkTrackedAgentContext(candidateFiles);

  const deployScript = read("scripts/deploy-cloudflare.sh");
  if (/wrangler@latest/.test(deployScript)
      || !/wrangler_version=["']\d+\.\d+\.\d+["']/.test(deployScript)) {
    fail("UNPINNED_DEPLOY_TOOL", "Cloudflare deployment must use an explicit Wrangler version, not a mutable latest tag.");
  } else {
    pass("Cloudflare deployment CLI is pinned to an explicit version.");
  }
  const deployOrder = ["sites/storefront", "sites/embed", "sites/merchant-demo"]
    .map((target) => deployScript.indexOf(`pages deploy "$snapshot_dir/${target}"`));
  if (deployOrder.some((position) => position < 0)
      || !(deployOrder[0] < deployOrder[1] && deployOrder[1] < deployOrder[2])) {
    fail("UNSAFE_DEPLOY_ORDER", "Rights-safe migration must deploy storefront, then provider, then independent host.");
  } else {
    pass("Cloudflare migration deploys the fail-closed storefront before provider data.");
  }
  const deploymentContracts = [
    [deployScript.includes("github.com/Timtech4u/groundedrelay-webmcp")
      && deployScript.includes('branch="$(git symbolic-ref --quiet --short HEAD || true)"'),
    "Deployment is restricted to the public GroundedRelay main checkout."],
    [deployScript.includes("git status --porcelain=v1 --untracked-files=all"),
      "Deployment refuses a dirty working tree."],
    [deployScript.includes("git fetch --quiet origin main")
      && deployScript.includes('"$commit_sha" != "$origin_main_sha"'),
    "Deployment requires HEAD to equal the refreshed origin/main."],
    [deployScript.includes('git archive "$commit_sha" sites/storefront sites/embed sites/merchant-demo'),
      "Deployment stages tracked files from the exact commit only."],
    [deployScript.includes("npm run check")
      && deployScript.includes("npm run check:release -- --code-only"),
    "Deployment runs deterministic and public-code gates before mutation."],
    [deployScript.includes("whoami --json")
      && deployScript.includes("pages project list --json")
      && deployScript.includes("groundedrelay-merchant.pages.dev"),
    "Deployment verifies Cloudflare identity and exact Pages projects."],
    [deployScript.match(/--commit-hash "\$commit_sha"/g)?.length === 3
      && !deployScript.includes("--commit-dirty"),
    "Every Pages deployment records the exact clean public commit SHA."],
    [deployScript.match(/site_tree_check "/g)?.length === 3
      && deployScript.includes("shasum -a 256")
      && deployScript.includes('"$remote_hash" != "$expected_hash"'),
    "Every tracked public Pages asset must byte-match the public commit."],
    [deployScript.indexOf('site_tree_check "storefront"') < deployOrder[1]
      && deployScript.indexOf('site_tree_check "provider"') < deployOrder[2]
      && deployScript.indexOf('site_tree_check "merchant"') > deployOrder[2],
    "Each Pages origin must pass an exact-tree check before deployment continues."],
  ];
  for (const [ok, message] of deploymentContracts) {
    ok ? pass(message) : fail("UNSAFE_DEPLOY_SCRIPT", message);
  }

  const providerSource = read("sites/embed/embed.js");
  const fixtureSource = read("sites/embed/backends/demo.js");
  const catalogueSource = read("sites/embed/backends/catalogue.js");
  const storefrontSource = read("sites/storefront/store.js");
  const nativeProbeSource = read("scripts/native-webmcp-check.mjs");
  const providerToolNames = [...providerSource.matchAll(/\n\s+name:\s*"([a-z_]+)"/g)]
    .map((match) => match[1]);
  if (JSON.stringify(providerToolNames) !== JSON.stringify(expectedTools)) {
    fail("TOOL_SURFACE_DRIFT", "The submitted provider must define exactly the documented nine tools in the documented order.");
  } else {
    pass("Provider source defines exactly the documented nine-tool surface.");
  }
  if (!providerSource.includes("createRightsSafeBackend")
    || providerSource.includes("AFRICAN_STORES")
    || /create(?:Shopify|Web)Backend|research-stores|backend=web/.test(providerSource)) {
    fail("RIGHTS_MODE", "The submitted provider must be fixture-only and contain no external catalogue selector or roster import.");
  }
  if (/name:\s*["'](?:apply_coupon|read_reviews)["']/.test(providerSource)) {
    fail("TOOL_SURFACE_DRIFT", "The submitted provider must define exactly the truthful nine-tool surface; retired coupon and review actions are forbidden.");
  }
  const adapterPaths = [
    "sites/embed/backends/web.js",
    "sites/embed/backends/shopify.js",
    "sites/embed/backends/research-stores.example.js",
    "sites/embed/backends/research-stores.local.js",
  ];
  if (adapterPaths.some((path) => candidateFiles.includes(path))) {
    fail("THIRD_PARTY_ADAPTER", "The public submission must not ship optional third-party catalogue adapters.");
  } else {
    pass("Public source ships only the owned fixture; optional third-party catalogue adapters are absent.");
  }
  if (!/const scenarios\s*=\s*\{\s*fictional\s*:/m.test(nativeProbeSource)
      || /(?:^|\n)\s*(?:live|research)\s*:\s*\{/m.test(nativeProbeSource)
      || /research-stores\.local/i.test(nativeProbeSource)) {
    fail("RIGHTS_MODE", "The tracked native judge probe must exercise only the fictional scenario.");
  }
  if (!fixtureSource.includes("RIGHTS_SAFE_MERCHANTS")
    || !fixtureSource.includes('from "./catalogue.js"')
    || !catalogueSource.includes("buildComparison")
    || !fixtureSource.includes("rightsSafe: true")
    || !fixtureSource.includes("fictional: true")
    || !fixtureSource.includes('owner: "GroundedRelay"')) {
    fail("RIGHTS_MODE", "Public fixture must identify itself as GroundedRelay-owned, fictional, and rights-safe in shared state.");
  }
  const catalogueDrift = deployedCatalogueDrift(fixtureSource);
  if (catalogueDrift.length) {
    fail("CATALOGUE_CONTRACT_DRIFT", `Tracked fixture contract drifted: ${catalogueDrift.join("; ")}.`);
  } else {
    pass("Tracked fixture defines exactly three owned catalogues and six products across RWF, KES, and GHS.");
  }
  if (!storefrontSource.includes("FIXTURE_PROMPTS")
      || /RESEARCH_PROMPTS|SINGLE_CATALOGUE_PROMPTS/.test(storefrontSource)) {
    fail("RIGHTS_MODE", "HTTPS storefront must default its judge prompts and labels to the fictional fixture.");
  }
  if (!failures.some(({ code }) => [
    "RIGHTS_MODE", "THIRD_PARTY_ADAPTER", "UNLICENSED_PUBLIC_COPY",
  ].includes(code))) {
    pass("Tracked production data and judge-facing copy use only the GroundedRelay-owned fictional fixture.");
  }

  if (codeOnly) return;

  const submissionVideoText = [
    optionalRead("README.md"),
    optionalRead("docs/SUBMISSION.md"),
    optionalRead("docs/SUBMISSION-CHECKLIST.md"),
  ].join("\n");
  if (!/(?:youtube\.com\/watch\?v=|youtu\.be\/)[A-Za-z0-9_-]{6,}/i.test(submissionVideoText)) {
    fail("DEMO_VIDEO", "No public YouTube demo URL is recorded in README or the submission package.");
  }

  let visibility = process.env.GITHUB_REPOSITORY_VISIBILITY?.toLowerCase();
  if (!visibility && online) {
    const result = spawnSync("gh", ["repo", "view", "--json", "visibility", "--jq", ".visibility"], {
      cwd: ROOT,
      encoding: "utf8",
      timeout: 10_000,
    });
    if (result.status === 0) visibility = result.stdout.trim().toLowerCase();
  }
  if (visibility && visibility !== "public") {
    fail("REPOSITORY_PRIVATE", `GitHub reports repository visibility as ${visibility}; Devpost requires public source.`);
  } else if (!visibility) {
    warn("VISIBILITY_UNCHECKED", "Repository visibility was not supplied; verify it is public before submission.");
  }
}

async function checkLiveDeployment() {
  if (!online) return;
  const targets = [
    ["storefront", "https://groundedrelay.pages.dev/"],
    ["provider", "https://groundedrelay-provider.pages.dev/embed"],
    ["independent host", "https://groundedrelay-merchant.pages.dev/"],
  ];
  for (const [label, url] of targets) {
    const failureCountBefore = failures.length;
    try {
      const response = await fetch(url, {
        redirect: "follow",
        signal: AbortSignal.timeout(10_000),
        headers: { "user-agent": "groundedrelay-public-release-check/1" },
      });
      if (!response.ok) {
        fail("LIVE_DEPLOYMENT", `${label} returned HTTP ${response.status}.`);
        continue;
      }
      if (new URL(response.url).origin !== new URL(url).origin) {
        fail("LIVE_DEPLOYMENT", `${label} redirected away from its canonical origin.`);
      }
      const body = await response.text();
      const csp = response.headers.get("content-security-policy") ?? "";
      if (!csp.includes("default-src") || !csp.includes("object-src 'none'")) {
        fail("LIVE_CSP", `${label} is live but does not serve the hardened CSP.`);
      }
      if (label === "provider") {
        const expected = ["https://groundedrelay.pages.dev", "https://groundedrelay-merchant.pages.dev"];
        if (JSON.stringify(cspDirective(csp, "frame-ancestors")) !== JSON.stringify(expected)) {
          fail("LIVE_CSP", "Live provider does not use the exact two-host production ancestor allowlist.");
        }
      }
      if (label === "storefront" && !body.includes('data-origin="https://groundedrelay-provider.pages.dev"')) {
        fail("LIVE_DEPLOYMENT", "Live storefront does not pin the production provider.");
      }
      if (label === "independent host") {
        if (!body.includes('data-origin="https://groundedrelay-provider.pages.dev"')) {
          fail("LIVE_DEPLOYMENT", "Live independent host does not pin the production provider.");
        }
        if (JSON.stringify(cspDirective(csp, "frame-src"))
            !== JSON.stringify(["https://groundedrelay-provider.pages.dev"])) {
          fail("LIVE_CSP", "Live independent host does not use the exact provider frame origin.");
        }
      }
      if (!response.headers.get("x-content-type-options")?.toLowerCase().includes("nosniff")) {
        fail("LIVE_HEADERS", `${label} does not serve X-Content-Type-Options: nosniff.`);
      }
      if (!response.headers.get("strict-transport-security")) {
        fail("LIVE_HEADERS", `${label} does not serve Strict-Transport-Security.`);
      }
      if (!response.headers.get("referrer-policy")) {
        fail("LIVE_HEADERS", `${label} does not serve Referrer-Policy.`);
      }
      if (!response.headers.get("permissions-policy")) {
        fail("LIVE_HEADERS", `${label} does not serve Permissions-Policy.`);
      }

      const sourceUrls = {
        storefront: "https://groundedrelay.pages.dev/store.js",
        provider: "https://groundedrelay-provider.pages.dev/embed.js",
        "independent host": "https://groundedrelay-merchant.pages.dev/client.js",
      };
      const sourceResponse = await fetch(sourceUrls[label], {
        signal: AbortSignal.timeout(10_000),
        headers: { "user-agent": "groundedrelay-public-release-check/1" },
      });
      const source = sourceResponse.ok ? await sourceResponse.text() : "";
      if (!sourceResponse.ok) fail("LIVE_DEPLOYMENT", `${label} source asset returned HTTP ${sourceResponse.status}.`);
      if (label === "storefront"
          && (!source.includes("FIXTURE_PROMPTS") || /RESEARCH_PROMPTS|SINGLE_CATALOGUE_PROMPTS/.test(source))) {
        fail("LIVE_RIGHTS_MODE", "Live storefront source does not default HTTPS judge copy to the fictional fixture.");
      }
      if (label === "storefront") {
        const modeResponse = await fetch("https://groundedrelay.pages.dev/provider-mode.js", {
          signal: AbortSignal.timeout(10_000),
          headers: { "user-agent": "groundedrelay-public-release-check/1" },
        });
        const modeSource = modeResponse.ok ? await modeResponse.text() : "";
        if (!modeResponse.ok
            || !modeSource.includes("createFictionalProviderGate")
            || !modeSource.includes('message.fixture?.owner === "GroundedRelay"')) {
          fail("LIVE_RIGHTS_MODE", "Live storefront is missing its fail-closed fictional-mode gate.");
        }
      }
      if (label === "provider"
          && (!source.includes("createRightsSafeBackend")
            || !source.includes('"https://groundedrelay-merchant.pages.dev"')
            || source.includes("AFRICAN_STORES.slice(0, 1)"))) {
        fail("LIVE_RIGHTS_MODE", "Live provider source is not the rights-safe two-host build.");
      }
      if (label === "independent host"
          && (!source.includes("createMerchantProviderGate")
            || !source.includes("providerGate.receive(kind, message)")
            || !source.includes("url.origin === location.origin"))) {
        fail("LIVE_RIGHTS_MODE", "Live independent host does not enforce fictional provider data and exact handoff origin.");
      }
      if (label === "independent host") {
        const gateResponse = await fetch("https://groundedrelay-merchant.pages.dev/provider-gate.js", {
          signal: AbortSignal.timeout(10_000),
          headers: { "user-agent": "groundedrelay-public-release-check/1" },
        });
        const gateSource = gateResponse.ok ? await gateResponse.text() : "";
        if (!gateResponse.ok
            || !gateSource.includes("createMerchantProviderGate")
            || !gateSource.includes('message.fixture?.owner === "GroundedRelay"')) {
          fail("LIVE_RIGHTS_MODE", "Live independent host is missing its paired fictional-mode gate.");
        }
      }
      if (failures.length === failureCountBefore) {
        pass(`${label} deployment is reachable and serves the expected security policy.`);
      }
    } catch (error) {
      fail("LIVE_DEPLOYMENT", `${label} verification failed: ${error.name}: ${String(error.message ?? "unknown error").slice(0, 160)}.`);
    }
  }

  const failureCountBefore = failures.length;
  try {
    const fixtureUrl = new URL("/backends/demo.js", "https://groundedrelay-provider.pages.dev");
    fixtureUrl.searchParams.set("release-check", String(Date.now()));
    const fixtureResponse = await fetch(fixtureUrl, {
      redirect: "error",
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
      headers: {
        "cache-control": "no-cache",
        "user-agent": "groundedrelay-public-release-check/1",
      },
    });
    if (!fixtureResponse.ok) {
      fail("LIVE_CATALOGUE_CONTRACT", `Live provider fixture returned HTTP ${fixtureResponse.status}.`);
    } else {
      const drift = deployedCatalogueDrift(await fixtureResponse.text());
      if (drift.length) {
        fail("LIVE_CATALOGUE_CONTRACT", `Live provider is not the complete multi-catalogue build: ${drift.join("; ")}.`);
      }
    }
    if (failures.length === failureCountBefore) {
      pass("Live provider serves exactly three owned catalogues and six products across RWF, KES, and GHS.");
    }
  } catch (error) {
    fail("LIVE_CATALOGUE_CONTRACT", `Live multi-catalogue verification failed: ${error.name}: ${String(error.message ?? "unknown error").slice(0, 160)}.`);
  }
}

export async function run() {
  let candidateFiles = [];
  try {
    candidateFiles = git(["ls-files", "-c", "-o", "--exclude-standard", "-z"])
      .split("\0").filter(Boolean);
    scanCandidateFiles(candidateFiles);
    scanReachableHistory();
    checkSecurityContracts();
    checkReleaseArtifacts(candidateFiles);
    await checkLiveDeployment();
  } catch (error) {
    fail("CHECKER_ERROR", error.message);
  }

  console.log(`Public-release check${codeOnly ? " (code-only)" : ""}`);
  for (const message of passes) console.log(`PASS  ${message}`);
  for (const { code, message } of warnings) console.log(`WARN  [${code}] ${message}`);
  for (const { code, message } of failures) console.log(`FAIL  [${code}] ${message}`);
  console.log(`\n${passes.length} pass, ${warnings.length} warning, ${failures.length} failure`);
  process.exitCode = failures.length ? 1 : 0;
  return { passes, warnings, failures };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) await run();
