# GroundedRelay hackathon handoff

State of play: **26 August 2026 (Africa/Kigali)**

Official operational deadline: **3 September 2026 at 1:00 p.m. PDT
(20:00 UTC / 22:00 Africa/Kigali)**

Internal submit cutoff: **11:00 a.m. PDT (18:00 UTC / 20:00 Africa/Kigali)**

Current decision: **NO-GO until every P0 gate in
[`docs/SUBMISSION-CHECKLIST.md`](docs/SUBMISSION-CHECKLIST.md) is green**

This is the restart document for a new agent. Read it before changing code,
deployment, public visibility, media, or submission fields. Do not infer that a
local test, commit, or historical deployment is the final public result.

## Executive state

| Area | Verified state | Meaning |
| --- | --- | --- |
| Rights-safe candidate | Clean final-only public `main` is published and synchronized | Source publication is complete; production release evidence remains separate |
| Deterministic suite | Public `main` passes **96/96 total checks**: 95 Node tests plus eval validation, with 8 eval cases and 9 public tools | Current GroundedRelay source proof; repeat only if public `main` changes |
| Publication release gate | Public `main` passes **35/35** | Sanitized one-commit tree is green; repeat after any public source update |
| Online public-release gate | Pending the three-origin GroundedRelay deployment | Run against the exact deployed commit before submission |
| Historical local fixture proof | **42/42** on the pre-GroundedRelay fixture candidate at 20:41 UTC | Rerun the final GroundedRelay tree; direct API proof is not model selection or production evidence |
| Historical production WebMCP proof | 32/32 on the old pre-fixture deployment | Useful baseline only; must be replaced for submission |
| Current public deployment | GroundedRelay targets are not deployed or verified | Retired external-catalogue work is private history, not submission production |
| Independent public host | Source exists; target is not deployed or verified | `groundedrelay-merchant.pages.dev` is required before final proof |
| GitHub | `Timtech4u/groundedrelay-webmcp` is public; the release checkout must keep local `main == origin/main` | Signed-out repository and raw README return 200; MIT is detected; read the current SHA from Git rather than freezing a soon-stale HEAD in this file |
| Video/screenshots | Three historical local native states and a short evidence clip exist; public narrated YouTube video is absent | Rebranded production captures and the public video remain blockers |
| Devpost | Copy prepared; not submitted | Do not submit until all P0 gates pass |

## Eligibility and build timeline

The private source work began on 26 August 2026, after the 25 August challenge
opening. The public repository is a clean, final-only export—not a rewrite or
visibility change of the private repository. Its single public commit is inside
the build window and contains no private commit identifiers, personal metadata,
local settings, or retired merchant evidence. Judges can
verify the final public timestamp with:

```bash
git log --reverse --format='%h %ad %s' --date=iso-strict
```

## Product and judge story

The submission product is **GroundedRelay**; Africa is catalogue scope, not part
of the name.

One static provider lends typed WebMCP shopping capabilities across an origin
boundary. The person and agent share visible results, exact variants,
comparison evidence, revisioned basket state, and a final handoff that parks for
Approve or Veto. Approval reveals an owned demo link only; it never navigates,
takes payment, creates an order, or proves a purchase.

The public submission uses only this owned fixture:

| Fictional catalogue | Demo market | Currency |
| --- | --- | --- |
| GroundedRelay Demo — Kigali Pantry | RW | RWF |
| GroundedRelay Demo — Rift Runworks | KE | KES |
| GroundedRelay Demo — Accra Carry Studio | GH | GHS |

The six invented products use no third-party imagery. The carryall was renamed
after an initial exact-name collision check; the current fixture name is
**Cocoa Grid Carryall**. The source labels every catalogue, product, price,
availability value, and link as a GroundedRelay-owned fictional example. Exact
web, npm, PyPI, GitHub repository-name, and `.com`, `.dev`, `.app`, and `.io`
DNS screens on 2026-08-26 found no direct GroundedRelay software or product
match. This is only a preliminary collision screen, not legal or trademark
clearance; the final platform-terms review remains a release gate.

The tracked submission and runtime are fixture-only. The deleted
external-catalogue work is retired private history and must not appear in the
public tree, media, or claims.

## Three-origin architecture

| Origin | Source | Role |
| --- | --- | --- |
| `https://groundedrelay.pages.dev` | `sites/storefront/` | Submitted shopper experience |
| `https://groundedrelay-provider.pages.dev` | `sites/embed/` | Shared WebMCP provider |
| `https://groundedrelay-merchant.pages.dev` | `sites/merchant-demo/` | Independent host, portability proof, and owned handoff destination |

All three are static Cloudflare Pages sites. There is no Worker, Pages Function,
application backend, proxy, database, analytics beacon, server-side search,
model-key store, payment service, or autonomous checkout.

Both hosts pin the exact provider. The provider verifies allowed origin, exact
source window, protocol version, and a per-page channel nonce. Production CSP
allows exactly the two HTTPS host ancestors. Every environment selects the
owned fixture backend; query parameters cannot switch data source or provider.

The independent host is not a themed copy of the storefront. It discovers and
hoists the same provider capabilities from another static origin, proving the
provider is reusable.

## WebMCP contract

The provider owns nine `wire__*` capabilities:

1. `list_shops`
2. `get_shopping_state`
3. `search_products`
4. `inspect_products`
5. `focus_products`
6. `compare_products`
7. `highlight_evidence`
8. `set_basket_quantity`
9. `prepare_checkout_handoff`

Hosts discover only the exact provider origin and hoist collision-free clean
names. Cross-origin `executeTool()` input is JSON text even though the provider
action receives a parsed object, so proxies must preserve
`JSON.stringify(input)`.

The clean action surface is a formula, not a single linear invariant:

- 3 base actions always;
- add 3 when active results exist;
- add `set_basket_quantity` when results **or** basket state exists;
- add `highlight_evidence` when comparison state exists; and
- add `prepare_checkout_handoff` when basket state exists.

Valid branches therefore include 3, 5, 7, 8, and 9 actions. The scripted judge
proof deliberately follows **3 with no active results → 7 with results → 8 with
comparison → 9 with basket**. Do not claim every session follows that path.

Other invariants:

- comparison uses only observed fields and highlighting accepts known row keys;
- exact variants must come from current results/inspection scope;
- unavailable variants cannot enter the basket;
- every agent basket write uses the current revision;
- money is ISO currency plus integer minor units;
- RWF, KES, and GHS totals stay separate;
- assistant prose never quotes prices, quantities, or totals; and
- handoff approval/veto is bound to the reviewed basket revision.

## Local workflow

```bash
npm start
```

The hot-reload server binds loopback only and serves:

- `http://localhost:5173/` — fixture-only storefront rehearsal;
- `http://localhost:5174/embed` — provider; and
- `http://localhost:5175/` — rights-safe independent-host rehearsal.

The root storefront is the sole runtime mode. Query parameters are ignored and
cannot select another data source or provider.

Use the **Codex in-app browser**. Do not launch a normal Chrome profile. An
isolated WebMCP-enabled browser is a documented native API exception for the
native probe only.

After source changes:

```bash
git status --short
npm run check
npm run check:release -- --code-only
git diff --check
```

In the private development repository the code-only release gate retains its
intentional publication failures. The candidate tree passes its source
contracts; reachable private history contains a personal email in
`.claude/settings.local.json`, and older commit author/committer metadata also
contains a personal email. Deleting the file only from the current tree does
not remove either history source.

Do **not** make the development repository public as-is. The sanitized public
`https://github.com/Timtech4u/groundedrelay-webmcp` repository was created from
a fresh, history-free tracked-tree archive with the intended GitHub noreply
identity. Never add the private
repository as a remote, cherry-pick its commits, or
copy `.git`, retired external-catalogue evidence, local settings, or private artifacts. Rescan the
exported tree and every new reachable ref after each update.
Force-rewriting the existing private repository is an alternative only with
explicit user approval.

For the exact public journey prompts, recording plan, and screenshot matrix,
use [`docs/DEMO-SCRIPT.md`](docs/DEMO-SCRIPT.md). Do not substitute direct
buttons or fallback mode while narrating native agent behavior.

## Evidence boundary

[`docs/NATIVE-WEBMCP-EVIDENCE.md`](docs/NATIVE-WEBMCP-EVIDENCE.md) records:

- historical deployed **32/32** direct checks against the pre-fixture build;
- historical local rights-safe **42/42** direct checks against the prior
  fixture candidate, including actual viewport intersection and
  product-to-variant binding; and
- the explicit limitation that direct `document.modelContext`, `getTools()`,
  and `executeTool()` calls do not prove a language model selected the actions.

The final submission still needs two separate production results from the exact
deployed commit:

1. the full rights-safe direct native API probe, including rendered effects,
   branch contraction/expansion, approve, and veto; and
2. a fresh model-selected run of the two fictional prompts in the demo script.

Do not call either local or historical result final production evidence. Do not
describe the 32/32 or 42/42 direct run as native-agent prompt reliability.

## Production truth and first cutover

Earlier external-catalogue work is retired private history. Its private commit
identifiers and merchant evidence do not belong in the clean public repository,
and an old smoke test is not proof that GroundedRelay is deployed.

GroundedRelay source publication and exact-tree gates are complete. Before
deployment, confirm:

- the deployment artifact matches refreshed public `origin/main`;
- `npx --yes wrangler@4.126.0 whoami` shows the intended account;
- Cloudflare projects `groundedrelay`, `groundedrelay-provider`, and
  `groundedrelay-merchant` exist and serve their matching Pages URLs;
- provider deployment protection is off;
- `groundedrelay-merchant.pages.dev` is ready before deployment begins.

Deploy **storefront first, provider second, merchant proof third** with the
checked-in script:

```bash
npm run deploy:cloudflare
```

It refuses a dirty tree or a commit that differs from refreshed `origin/main`,
deploys a tracked-only `git archive`, binds all three Pages deployments to that
SHA, and verifies the served asset tree before moving to the next origin. This
sequence publishes the fixture-only consumer and provider before the independent
proof and owned handoff destination.

The checked-in and documented release order remains storefront → provider →
merchant. Do not introduce an alternate order without a separately tested,
explicit migration decision and coordinated script, tests, and docs.

## Public verification after deploy

From a signed-out context, verify all three exact URLs return 200 with no auth
wall. Confirm CSP/headers, pinned origins, prominent fictional disclosure,
three catalogues, six products, no remote merchant/image request, separate
currencies, provider reuse from both hosts, handoff links only to the owned
merchant origin, no automatic navigation, and service-worker refresh without a
stale old build.

Then run:

```bash
npm run check:release -- --online
```

This online gate is expected to remain red until the final three-origin release,
public GitHub repository, and public YouTube URL exist. Record each resolved
failure rather than weakening the check.

## Submission package

- Devpost answers: [`docs/SUBMISSION.md`](docs/SUBMISSION.md)
- Demo/audio/screenshot plan: [`docs/DEMO-SCRIPT.md`](docs/DEMO-SCRIPT.md)
- Blog draft: [`docs/BLOG-POST.md`](docs/BLOG-POST.md)
- Final fail-closed gate: [`docs/SUBMISSION-CHECKLIST.md`](docs/SUBMISSION-CHECKLIST.md)
- Rights-safe fixture boundary: [`docs/RIGHTS-SAFE-DEMO.md`](docs/RIGHTS-SAFE-DEMO.md)
- Cloudflare procedure/history: [`docs/CLOUDFLARE-DEPLOYMENT-HANDOFF.md`](docs/CLOUDFLARE-DEPLOYMENT-HANDOFF.md)

The target `https://github.com/Timtech4u/groundedrelay-webmcp` URL must open signed out and
visibly show MIT. The under-three-
minute video must be public YouTube with audio. No public copy, screenshot, or
video or tracked public file may contain retired merchant evidence. The blog remains draft until the final
rights-safe production, model-selected journey, preliminary name screen,
platform-terms review, and media review all pass. The name screen is not legal
or trademark clearance.

## Ordered next-agent plan

GroundedRelay public source is synchronized and passes both deterministic and
publication gates. Deployment and judge runs remain pending. GitHub Actions may
be run manually as extra evidence, but a
green Actions run is not a release requirement.

1. Complete the pending four-scope Cloudflare OAuth authorization in the Codex
   browser when the user explicitly approves it.
2. Verify Cloudflare identity, all three Pages projects and URLs, and auth-wall
   settings.
3. Perform the one-time storefront → provider → merchant cutover and signed-out
   three-origin smoke test.
4. Rerun the 42-check direct native probe locally and against production, then
   save both commit-bound results.
5. Run the exact model-selected fictional journey; keep it separate from direct
   API evidence.
6. Capture production S1–S8, record the <3-minute audio demo, upload it publicly, and test
   every URL signed out.
7. Record the preliminary GroundedRelay collision screen, complete the remaining
   platform-terms review, and finish the P0 checklist; do not represent the
   name search as legal or trademark clearance.
8. Only then paste the prepared copy into Devpost, preview it, submit, and save
    confirmation evidence.

If any P0 gate is red, the truthful answer is **not ready to submit yet**.
