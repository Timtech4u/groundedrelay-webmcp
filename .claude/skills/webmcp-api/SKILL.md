---
name: webmcp-api
description: Implement or review GroundedRelay's measured WebMCP contract: a fixture-only cross-origin provider, collision-safe wire-to-clean hoisting, JSON-text proxy input, state-aware actions, rights-safe attestations, graceful fallback, and human-gated merchant handoff.
---

# GroundedRelay WebMCP contract

Read `AGENTS.md`, `docs/AFRICA-FIRST.md`, and `spike/FINDINGS.md` before changing
the protocol. The findings record browser behaviour measured in this repository;
do not replace them with assumptions from a different WebMCP revision.

## Fixed public runtime

GroundedRelay has three static origins:

- storefront: `https://groundedrelay.pages.dev`;
- provider: `https://groundedrelay-provider.pages.dev`; and
- portability host: `https://groundedrelay-merchant.pages.dev`.

The root page is the sole runtime. URL parameters are ignored and cannot choose
another provider or data source. The tracked runtime and public judge path always
use three GroundedRelay-owned fictional African catalogues with six invented
products, no third-party imagery, and demo-only handoff links. Do not add an
external catalogue, network search, server API, secret, or alternate data mode.

The provider's truthful surface has exactly nine actions:

1. `list_shops`
2. `get_shopping_state`
3. `search_products`
4. `inspect_products`
5. `focus_products`
6. `compare_products`
7. `highlight_evidence`
8. `set_basket_quantity`
9. `prepare_checkout_handoff`

Do not advertise coupon, review, payment, order-placement, or autonomous
navigation actions.

## Browser API boundary

Use `document.modelContext`; retain the `navigator.modelContext` fallback only
for older browser builds this repository still supports:

```js
const modelContext = document.modelContext || navigator.modelContext;
```

`registerTool()` is asynchronous. Await it and surface registration failures.
Tool execution receives an `AbortSignal`; forward the same signal across each
proxy boundary and into cancellable work. Register clean tools with an
`AbortController.signal`, let in-flight work settle, then remove stale tools.

`RegisteredTool#inputSchema` has appeared as JSON text and as an object. Normalize
it at discovery:

```js
const normalise = (schema) =>
  typeof schema === "string" ? JSON.parse(schema) : schema;
```

## Cross-origin registration

The provider is a static iframe on its own origin. The storefront and portability
host both use `allow="tools"`. The provider verifies its actual ancestor and lends
actions only to that exact allowed host:

```js
const WIRE_PREFIX = "wire__";

await modelContext.registerTool(
  { ...tool, name: WIRE_PREFIX + tool.name },
  { exposedTo: [HOST_ORIGIN] },
);
```

The readiness handshake must not depend on WebMCP availability. A browser
without the page API still receives provider state and can use direct search,
comparison, basket, and handoff controls instead of waiting indefinitely. Both
hosts require matching protocol-2 `ready` and GroundedRelay-owned fictional
`state` attestations before trusting the frame.

## Collision-safe hoisting

Default discovery does not include the foreign provider. Request the exact
pinned origin, filter descriptors to that origin, then register valid actions in
the top document under clean names:

```js
const foreign = await modelContext.getTools({ fromOrigins: [PROVIDER_ORIGIN] });
const tool = foreign.find((candidate) =>
  candidate.origin === PROVIDER_ORIGIN
  && candidate.name === "wire__search_products");

await modelContext.registerTool({
  name: "search_products",
  title: tool.title,
  description: tool.description,
  inputSchema: normalise(tool.inputSchema),
  execute: (input, { signal } = {}) =>
    modelContext.executeTool(tool, JSON.stringify(input ?? {}), { signal }),
}, { signal: registrationController.signal });
```

Never give the provider a clean name, and never expose its `wire__*` name as a
host action. Same-name provider and host declarations can make `executeTool()`
fail before the tool body runs. In the measured runtime, `execute()` receives a
parsed object while `executeTool()` requires JSON text, so re-stringify every
proxy input.

## Truthful state-aware surface

The provider owns all nine `wire__*` capabilities. Each host hoists only the
clean actions valid for visible state:

- three base actions are always active;
- three more become active when results exist;
- `set_basket_quantity` is active with results or an existing basket;
- `highlight_evidence` is active with comparison state; and
- `prepare_checkout_handoff` is active with basket state.

Valid active counts are:

| Visible state | Active clean actions |
| --- | ---: |
| No results or basket | 3 |
| Existing basket without results | 5 |
| Results only | 7 |
| Results plus comparison, no basket | 8 |
| Results plus basket, no comparison | 8 |
| Results, comparison, and basket | 9 |

The judge script demonstrates 3 with no active results, then 7 with results, 8
with comparison, and 9 with a basket. That sequence is one proof path, not the
only valid state branch. The visible badge reports the active clean subset, not
the provider capability total.

## Grounding and consequential-action safety

- Validate message origin, `event.source`, protocol version, and channel nonce.
- Accept a requested host only when it equals the actual ancestor and is in the
  exact two-host production allowlist.
- Preserve declared titles and annotations only as a fallback over the already
  authenticated channel; never overwrite native descriptor fields.
- Treat all catalogue and tool strings as untrusted data and keep
  `untrustedContentHint` accurate.
- Compare only returned fixture fields. `highlight_evidence` accepts known row
  keys, never free-form claims. Clear stale comparison on a new search or an
  explicit human clear action.
- Carry ISO currency plus integer minor units. Render RWF, KES, and GHS totals
  separately and keep price or total values out of assistant prose.
- Bind every quantity change to an exact available variant and current state
  revision.
- `prepare_checkout_handoff` parks until Approve or Veto. Veto and abort reject
  the in-flight call and clean pending state. Approval reveals reviewed links on
  the owned portability host only; it neither navigates nor completes a purchase.

## Verification

Run `npm run check`, then verify rendered behaviour in the Codex in-app browser.
Assert computed visibility and bounds, not DOM flags alone. Exercise direct
fallback, fictional disclosure, all nine provider capabilities, every valid
state-aware count, comparison highlighting, exact variants, mixed-currency
grouping, basket mutations, approve and veto, and provider reuse on the
portability host.

Keep three evidence gates separate: deterministic tests, direct native API
execution, and language-model action selection. Local proof is not deployment
proof; a successful action is not an order.
