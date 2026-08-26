# Rights-safe public demo and provider portability proof

Status: **implemented locally; not deployed**
Owner: GroundedRelay
Last reviewed: 26 August 2026

## Decision

The public hackathon build and the entire tracked runtime use a
GroundedRelay-owned fictional catalogue. Root is the sole mode; query overrides
are ignored and cannot select another backend.

This is the safe release path after choosing not to conduct external merchant
outreach. It does not imply affiliation with any real catalogue or that a basic
name-collision search is trademark clearance.

Every public surface must call the data a **GroundedRelay-owned fictional judge
sandbox**. Do not describe its merchants, products, prices, availability,
delivery coverage, or links as live offers.

Exact web, npm, PyPI, GitHub repository-name, and
`.com`/`.dev`/`.app`/`.io` DNS screens on 2026-08-26 found no direct
GroundedRelay software or product match. That is a preliminary collision screen
only, not legal advice or trademark clearance. Formal trademark clearance is
not claimed; prominent fictional ownership labelling and the final terms/name
review remain mandatory.

## Owned fixture

GroundedRelay wrote every name, field, price, variant, and delivery code in
[`sites/embed/backends/demo.js`](../sites/embed/backends/demo.js). The fixture
uses no product images, logos, reviews, copied descriptions, customer data, or
remote catalogue requests.

| Fictional catalogue | Demo country | Demo market | Currency | Products |
| --- | --- | --- | --- | --- |
| GroundedRelay Demo — Kigali Pantry | Rwanda | RW | RWF | Family Egg Tray; Weekend Egg Box |
| GroundedRelay Demo — Rift Runworks | Kenya | KE | KES | Nyota Road Running Shoe; Bonde Trail Running Shoe |
| GroundedRelay Demo — Accra Carry Studio | Ghana | GH | GHS | Asa Canvas Weekender; Cocoa Grid Carryall |

The products deliberately exercise the hard parts of the GroundedRelay contract:

- the first Nyota variant is unavailable, so the visible default must skip it;
- inspection exposes exact shoe sizes and product options;
- the running shoes publish Rwanda delivery coverage;
- a basket can contain RWF, KES, and GHS lines without combining currencies;
- comparison and highlighting use only known catalogue row keys; and
- handoff reveals an owned demonstration link only after human approval.

The fixture is realistic test data, not a claim about any real independent
merchant. Its impact case is the reusable workflow; the catalogue itself is
demonstration evidence.

## Fixture-only backend selection

The provider accepts two local host origins:

- `http://localhost:5173` for the main GroundedRelay host; and
- `http://localhost:5175` for the independent portability host.

Every allowed caller selects `createRightsSafeBackend()`. Query parameters do
not select modes or data sources.

Provider state and readiness messages expose:

```text
dataMode: fictional
fictional: true
```

Agent-facing JSON also includes:

```text
data_mode: fictional_judge_demo
data_notice: GroundedRelay-owned fictional catalogue; not a real merchant, offer, or order flow.
```

This prevents a small agent from turning an internal fixture into a claim about
a real merchant.

## Grounded action scope

All nine provider capabilities remain available. The clean host surface is a
state formula, not an artificial linear counter: 3 base actions, plus 3 when
active results exist, plus `set_basket_quantity` when results or a basket
exists, plus `highlight_evidence` when a comparison exists, plus
`prepare_checkout_handoff` when a basket exists. Therefore:

- no results and no basket: 3;
- no results with a persisted basket: 5;
- results only: 7;
- results plus comparison, without basket: 8;
- results plus basket, before comparison: 8; and
- results plus comparison plus basket: 9.

The familiar 3 -> 7 -> 8 -> 9 sequence is the canonical scripted journey, not
an invariant. The fixture may also preload visible results, so a freshly settled
page can already expose 7.

The fixture adds capability-object checks beyond schema validation:

- `inspect_products` accepts only products in the active result set;
- `compare_products` accepts only products in the active result set;
- `set_basket_quantity` accepts only the default SKU or an exact variant that
  belongs to a product in the active result set; agents use read-only inspection
  to learn those IDs, and a new search changes the authorization scope without
  hidden inspection state;
- unavailable variants cannot enter the basket;
- every write requires the current state revision; and
- highlight accepts only rows in the rendered comparison.

The handoff has no checkout implementation. Approval returns links to the
GroundedRelay-owned merchant-demo host; veto rejects the pending call and retains the
basket. Neither path opens a page automatically.

## Independent host proof

[`sites/merchant-demo/`](../sites/merchant-demo/) is a second, intentionally
different static client. It does not import the main storefront or implement a
shopping action. Its integration consists of:

1. an iframe with `allow="tools"`;
2. an origin-, source-window-, and channel-bound provider handshake;
3. cross-origin discovery with `getTools({ fromOrigins })`;
4. collision-safe clean proxies that re-stringify input for `executeTool()`;
5. the same state-aware clean-action lifecycle; and
6. direct search, compare, basket, approval, and veto controls when the WebMCP
   page API is unavailable.

This is the reusable-kit proof: one provider can lend the same action contract
to two unrelated interfaces without moving provider logic into either host.

The second host also enforces the provider's declared titles and safety
annotations, exact handoff-origin matching, safe-option focus, focus trapping,
Escape-to-veto, and focus restoration.

## Run locally

```bash
npm start
```

The development process serves three static origins with live reload:

- GroundedRelay storefront: `http://localhost:5173/`
- WebMCP provider: `http://localhost:5174/embed`
- independent rights-safe host: `http://localhost:5175/`

Open the third URL in the Codex in-app browser. A direct smoke journey is:

1. search `running shoes`;
2. select Nyota and Bonde and compare them;
3. highlight the grounded decision evidence;
4. add exact available variants and review the handoff;
5. veto and verify the basket remains; then
6. repeat, approve, and verify the link is still a human click rather than an
   automatic navigation.

When the WebMCP page API is present, inspect the active clean surface and verify
the formula above, including results-plus-basket before comparison (8) and a
persisted basket with zero results (5). The canonical demo can still travel
3 -> 7 -> 8 -> 9. When the API is absent, verify that every direct control above
remains usable.

The isolated Chrome 151 native-API probe passed **42 of 42** local checks on
26 August 2026 against the prior measured fixture candidate. It covered the
surface lifecycle, two named products from different
fictional merchants, exact `EU 40` and `Indigo` variants, product-to-variant
binding in approval, separate KES/GHS totals, five grounded highlighted rows,
stale revisions, veto, approval, two owned handoff links, screenshot artifact
validation, cleanup, positive viewport-intersecting rendered bounds, and no
automatic page opening. See
[`NATIVE-WEBMCP-EVIDENCE.md`](NATIVE-WEBMCP-EVIDENCE.md). Rerun the final
GroundedRelay tree; this remains historical local contract evidence, not final
HTTPS evidence or language-model selection evidence.

## Deployment plan—do not skip the order

No deployment was performed as part of this implementation. Production needs
three Cloudflare Pages projects and exact Pages URLs:

| Project | Directory | Production URL |
| --- | --- | --- |
| `groundedrelay` | `sites/storefront/` | `https://groundedrelay.pages.dev` |
| `groundedrelay-provider` | `sites/embed/` | `https://groundedrelay-provider.pages.dev` |
| `groundedrelay-merchant` | `sites/merchant-demo/` | `https://groundedrelay-merchant.pages.dev` |

Before deploying:

1. create the `groundedrelay-merchant` Pages project;
2. confirm all three projects belong to the intended Cloudflare account;
3. verify provider `DEPLOYED_HOSTS` contains only the two exact host origins;
4. verify provider `frame-ancestors` contains exactly those two HTTPS origins;
5. verify the merchant-demo CSP frames only `groundedrelay-provider.pages.dev`; and
6. keep deployment protection off for the provider.

Then run `npm run deploy:cloudflare`. The script publishes storefront, then
provider, then independent merchant host as the tested fail-closed cutover.
Smoke-test all three exact HTTPS URLs before calling the change live. In
particular, an approved handoff must resolve under
`https://groundedrelay-merchant.pages.dev/`; do not deploy the new provider/storefront
contract while that domain is absent.

## Acceptance gates

Deterministic checks:

```bash
npm test
npm run eval:validate
```

Current local result: `npm run check` passes **96/96 total checks**: 95 Node
tests plus eval validation, with **8 eval cases** and **9 validated tools**.
This does not replace the public exact-SHA release smoke.

Required rendered proof:

- prominent fictional disclosure on both hosts;
- all nine provider actions and truthful state-aware clean count;
- two fictional running shoes returned for `running shoes` with `ships_to=RW`;
- exact available variant inspection;
- comparison and known-row highlighting;
- at least two currencies rendered as separate totals;
- stale revision rejection;
- veto retains basket and opens nothing;
- approval reveals only the exact owned demo origin; and
- the independent host works both with native WebMCP and direct controls.

Machine-readable native journeys are in
[`evals/native-agent-cases.jsonl`](../evals/native-agent-cases.jsonl). The public
video, screenshots, blog, Devpost copy, and judge instructions must use those
fictional journeys only.
