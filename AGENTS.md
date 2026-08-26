# Working in this repository

GroundedRelay is a cross-origin WebMCP kit: one static origin lends agent actions to
another. Africa is the current catalogue scope, not part of the product name.
Read `README.md` first, `docs/AFRICA-FIRST.md` for the authoritative hackathon
decision record, and `spike/FINDINGS.md` for browser behaviour that was measured
rather than assumed.

## Current product context

- Public HTTPS always uses three GroundedRelay-owned fictional African catalogues with
  six invented products, no third-party imagery, and demo-only handoff links.
- This is not a “top merchant” ranking, partnership, integration, or
  endorsement.
- The fixture backend has nine truthful actions: `list_shops`,
  `get_shopping_state`, `search_products`, `inspect_products`,
  `focus_products`, `compare_products`, `highlight_evidence`,
  `set_basket_quantity`, and `prepare_checkout_handoff`.
- The provider owns all nine `wire__*` actions. The storefront hoists a clean,
  state-aware subset: three base actions; three more with active results;
  `set_basket_quantity` with results or basket state; `highlight_evidence` with
  comparison state; and `prepare_checkout_handoff` with basket state. Thus no
  results plus a basket is 5; results-only is 7; results plus comparison or
  results plus basket is 8; and results plus both is 9. The scripted proof uses
  3 with no active results → 7 with results → 8 with comparison → 9 with
  basket, but that path is not the only valid branch. The displayed count is
  the active clean subset, not the provider capability total.
- Comparison is structured and its supporting fields are visibly highlighted.
- Public judge data and the tracked runtime use only the static owned fixture;
  search and ranking are local. Do not add an external data source.

## Layout

```text
server.js              three static origins (5173 host, 5174 provider, 5175 proof)
sites/storefront/      shopper page; handshake, discovery/hoisting, fallback, veto
  store.js             rendering, direct controls, basket, human checkout gate
  agent.js             in-page assistant and interchangeable model backends
sites/embed/           provider; owns every action implementation
  backends/demo.js     GroundedRelay-owned fictional public fixture
sites/merchant-demo/   independent static host proving provider portability
docs/AFRICA-FIRST.md   product thesis, rights boundary, acceptance gates
docs/codex.md          trying the cross-origin tools from Codex/ChatGPT
spike/FINDINGS.md      measured browser behaviour
```

## Invariants — do not break these without saying so

1. **No project server, ever.** All three sites are static. Do not add a proxy,
   analytics beacon, server-side search, external catalogue source, or secret.
2. **Checkout stops for a human.** `prepare_checkout_handoff` parks until
   Approve or Veto. Veto and abort reject the in-flight call and clean pending
   state. Public approval reveals reviewed links on the owned fictional merchant
   host only; an agent never completes a purchase or navigates autonomously.
3. **Hoisted names must not collide.** The provider registers under `wire__*`;
   the host hoists clean names. Sharing a name can make `executeTool()` fail
   before the tool body runs.
4. **Proxy input is JSON text.** `executeTool()` takes a JSON string while
   `execute()` receives a parsed object. Re-stringify when proxying.
5. **Assistant prose never quotes prices or totals.** Cards, comparison, basket,
   and approval UI are authoritative; a small model can echo stale values.
6. **Every catalogue has an explicit market.** The fixture carries explicit
   demo markets as part of its owned static data.
7. **Currencies never collapse.** Carry ISO currency and integer minor units,
   format with `Intl.NumberFormat`, and group basket/approval totals by currency.
   Never add unlike currencies or invent an exchange rate.
8. **Availability is explicit.** Select the first available variant, not simply
   the first variant. Unavailable variants cannot be added.
9. **The action surface is truthful.** Capability-aware registration, displayed
   count, names, and read/write annotations must agree. Do not introduce coupon
   or review actions that can only fail.
10. **The page gracefully enhances.** The provider readiness handshake must not
    depend on `document.modelContext`. When the WebMCP page API is absent, keep
    direct local search, comparison, add/remove, and merchant-handoff controls
    working through the provider and explain that state in ordinary language.
11. **Comparisons stay grounded.** Compare only returned catalogue/metadata
    fields. Highlight accepts known row keys rather than free-form claims. Clear
    stale comparison state on a new search or explicit human clear action.
12. **Claim discipline.** Call public data GroundedRelay-owned and fictional.
    Approval is not proof of an order; local code is not production
    until explicitly deployed and smoke-tested.

## Development and verification

```bash
npm start
```

The startup script checks all three ports, then serves the host at
`http://localhost:5173`, the provider at `http://localhost:5174`, and the
independent portability host at `http://localhost:5175`. It injects
development-only SSE live reload into all static origins. `npm run dev` is the
lower-level unchecked command. The default interactive target is:

`http://localhost:5173/`

Use `http://localhost:5173/` to rehearse the public fictional experience, or
`http://localhost:5175/` to test the independent portability host. The root is
the sole runtime mode, and query parameters are ignored. The storefront pins
its provider; no URL can substitute another data source or provider.

Do not launch Chrome or Chrome-for-Testing unless the user explicitly requests
it, or a final isolated native API check is necessary and clearly documented.

Run `npm run check`, then test the rendered experience in the Codex browser. Assert
computed styles and bounding boxes, not only DOM properties. On a fixture
rehearsal URL, verify provider readiness, the no-WebMCP direct fallback,
fictional disclosure, RWF/KES/GHS,
all nine provider actions, the state-aware branch counts (3, 5, 7, 8, or 9)
and the scripted path (3 with no active results → 7 with results → 8 with
comparison → 9 with basket), comparison highlighting, mixed-currency grouping, basket
mutation, both approve/veto paths, and provider reuse at port 5175.
At phone widths, the search form and prompt suggestions must remain in normal
document flow: no fixed composer may cover help, suggestions, or product controls.

## Deploying

The release architecture uses three static Cloudflare Pages origins:

- storefront (`groundedrelay`): `https://groundedrelay.pages.dev`
- provider (`groundedrelay-provider`): `https://groundedrelay-provider.pages.dev`
- portability/merchant proof (`groundedrelay-merchant`):
  `https://groundedrelay-merchant.pages.dev`

Keep the three static Pages projects and origins; a same-origin deployment would
remove the cross-origin and portability proof. Query parameters are ignored and
cannot select another backend. Deploy all origins with
`npm run deploy:cloudflare`; its current storefront → provider → merchant order
is the fail-closed cutover from the historical provider.
Do not introduce another order without an explicit, separately tested migration
decision and coordinated script, tests, and docs. After exact byte checks, the
script runs `npm run check:release -- --code-only --online`; production must
prove exactly three owned catalogues, six products, RWF/KES/GHS, and both hosts
pinning the same provider. A one-catalogue slice fails the release. Smoke-test
the rendered exact URLs before claiming a local change is production. Submission media must show only the owned fictional
fixture. Direct native API execution and language-model tool selection are
separate evidence gates.

The current development repository must remain private: reachable history has
local settings, personal email metadata, and retired external-catalogue work.
The public repository is `Timtech4u/groundedrelay-webmcp`; public access, MIT,
and the synchronized sanitized tree are verified. Update it only from a clean
final-tree export with no inherited `.git`, `.local`, settings file, private
artifact, named external merchant evidence, or private commit identifier. Use
the intended GitHub noreply identity, rescan the tree and every new ref, and
verify MIT plus public access while signed out. The development repository must
remain private.
