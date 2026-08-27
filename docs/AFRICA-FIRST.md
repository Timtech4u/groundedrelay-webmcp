# Africa-first demo decision record

Verified **26 August 2026**. This is the short, authoritative context for the
hackathon build. If implementation and this document disagree, stop and resolve
the conflict rather than silently weakening the privacy, currency, or human-veto
claims.

## Winning thesis

**BasketShipper — a grounded relay between shoppers, agents, and merchants.**

**One cross-origin provider gives independent static hosts a truthful agent tool
surface. Public judging uses BasketShipper-owned fictional African catalogues; search
and ranking happen in the browser, comparison evidence appears on the page, and
the handoff cannot proceed without a person.**

The differentiator is not “an AI shopping chat.” It is the combination of:

1. a reusable WebMCP embed rather than per-merchant agent code;
2. an explicitly fictional, rights-safe public catalogue with realistic African
   markets, variants, delivery fields, and currencies;
3. visible, structured evidence for the agent's comparison;
4. a structurally serverless, local-search path; and
5. a merchant-handoff call that visibly parks for human approval and can be
   vetoed.

Public copy must say **BasketShipper-owned fictional demo**. The submitted tree
has no real-merchant roster, named merchant research, or external-catalogue
runtime. The tracked runtime is fixture-only.

The submission product is **BasketShipper**. Production uses
`groundedrelay.pages.dev`, `groundedrelay-provider.pages.dev`, and
`groundedrelay-merchant.pages.dev`; the verified public repository is
`Timtech4u/groundedrelay-webmcp`. The Pages targets are not yet deployed.

An exact web, npm, PyPI, GitHub repository-name, and
`.com`/`.dev`/`.app`/`.io` DNS screen on 27 August 2026 found no direct exact
BasketShipper software or product match. This is preliminary collision evidence,
not legal advice, a comprehensive rights search, or trademark clearance.

## Current WebMCP contract

The fixture provider has nine capabilities: `list_shops`,
`get_shopping_state`, `search_products`, `inspect_products`, `focus_products`,
`compare_products`, `highlight_evidence`, `set_basket_quantity`, and
`prepare_checkout_handoff`. It registers them with collision-safe `wire__*`
names. The storefront discovers all nine but hoists only clean actions valid
for current results, comparison, and basket state. The count can be 3, 5, 7, 8,
or 9. The scripted proof uses 3 with no active results → 7 with results → 8
with comparison → 9 with basket; it is not the only valid branch. The UI badge
reports the active clean subset, not the provider capability total.

## The one-minute production judge story

The submitted HTTPS site uses three BasketShipper-owned fictional catalogues. Use a
request the fixture can complete and let the page do the talking:

> Search `fictional` with Rwanda as the delivery destination. Inspect and compare
> the Nyota Road Running Shoe and Asa Canvas Weekender, highlighting merchant
> country, delivery, exact variant, availability, and currency. Set the basket
> to one Nyota EU 40 and one Asa Indigo, keep KES and GHS separate, then prepare
> the fictional handoff and wait.

Suggested sequence:

- **0–8 seconds:** Point to the provider origin and visible tool badge: “This
  storefront did not implement these tools; a cross-origin static embed lent
  them to the page.”
- **8–24 seconds:** The agent searches the static owned fixture locally. Both
  products appear with explicit fictional, delivery, and currency labels.
- **24–40 seconds:** Both products enter a structured comparison. The
  agent highlights the exact observed rows it used while unrelated rows remain
  readable, then focuses the compared products.
- **40–52 seconds:** The revision-safe basket changes to two exact variants and
  `prepare_checkout_handoff` opens the approval surface. Veto it. The in-flight
  tool rejects; no navigation or purchase occurs.
- **52–60 seconds:** Close on the proof: no project backend, no hidden combined
  currency total, no real merchant in the public flow, and a person retained
  the final decision.

Keep narration subordinate to visible proof. The assistant must not quote a
price or total; cards, basket, comparison, and approval UI are authoritative.

## What to lift from the `hot_town` WebMCP demo

The [X post and 5:03 demo](https://x.com/hot_town/status/2092481550096924926)
show that the strongest WebMCP interaction is decision support attached to the
live interface, not invisible tool calls. Its source is the
[Crema & Co WebMCP repository](https://github.com/vincanger/webmcp-espresso-store).

Lift these product ideas:

- **Structured comparison:** return stable fields the UI can render as rows;
  never ask a model to invent a free-form comparison table.
- **Visible evidence highlighting:** expose a narrow tool that selects only
  known comparison-row keys. Highlight those rows and dim the rest so a judge
  can inspect the basis of the recommendation.
- **Truthful conditional tools:** register only capabilities the active backend
  can actually perform. The fixture backend must not advertise coupons or
  reviews that can only fail.
- **Live page mutations:** searches, comparison state, basket changes, approval,
  and veto must be visible immediately. Tool output alone is not the demo.
- **Signed-in-session lesson:** WebMCP can reuse the page's existing authenticated
  state without a separate token handoff. Preserve that design lesson for a
  future merchant-owned integration.

Do **not** copy the upstream architecture wholesale. Crema & Co is a same-origin,
serverful Wasp/Postgres application with login and an order-placing checkout.
This project is three static origins, has no backend, deliberately uses prefixed
provider names plus clean hoisted names, reuses one provider across two hosts,
and enforces a cross-origin human veto.
“Uses the current browser session” does not mean “has no server.” See the
[official WebMCP guidance](https://developers.openai.com/codex/webmcp) for the
general pattern of reusing existing application operations with narrow schemas
and explicit side effects.

## Public BasketShipper-owned fixture

Public HTTPS exposes exactly three fictional catalogues and six invented
products. No third-party product image, description, price, customer data, or
merchant link is used. `groundedrelay-merchant.pages.dev` is a separate static host
and the only public handoff destination; its hash links cannot place an order or
take payment. The provider reports `fictional_judge_demo` in tool output and
shared state. Query overrides are ignored; the root experience is the sole mode.

## Privacy boundary: fixture-only runtime

BasketShipper loads owned static data and ranks it locally. It does not contact
an external merchant. Earlier external-catalogue experiments are retired private
history; they are deleted from the tracked runtime and are not submission
features or evidence.

## Non-negotiable implementation and acceptance gates

Small agents should preserve all of the following:

1. **Static architecture:** no proxy, project API, analytics beacon, secret, or
   server-side search. Every runtime mode uses the owned fixture and makes no
   external catalogue request.
2. **Cross-origin WebMCP:** provider tools keep a `wire__` prefix; host tools use
   clean names. Proxy calls re-stringify input for `executeTool()`.
3. **Explicit markets:** fixture items carry explicit demo markets. Do not use
   visitor geography or invent a market.
4. **Truthful tools:** capability-aware registration and displayed tool count
   must agree. Read/write and untrusted-content annotations must remain accurate.
5. **Grounded comparison:** compare only returned catalogue/metadata fields.
   Highlight accepts known row keys, not prose. A new search or human “clear”
   action clears stale comparison state.
6. **Currency integrity:** each item carries ISO currency plus integer minor
   units. Format with `Intl.NumberFormat`. Group basket and approval totals by
   currency. Never add unlike currencies, invent an exchange rate, display a
   combined total, or let the assistant repeat a price/total.
7. **Availability integrity:** select an available variant; unavailable products
   cannot be added.
8. **Human money control:** `prepare_checkout_handoff` parks until Approve or
   Veto. Veto and abort reject the in-flight call and clean pending state.
   Public approval reveals reviewed links on the owned fictional host only; an
   agent never purchases or navigates autonomously.
9. **Rendered-browser proof:** unit-test variant selection, multi-currency
   grouping, and compare/highlight state.
   The default interactive target is Codex's in-app browser; the catalogue and
   direct human controls must still work there if the WebMCP page API is absent.
   When that API is present, assert computed visibility/bounds, all nine
   provider capabilities, every clean-action branch count (3, 5, 7, 8, or 9),
   the scripted path (3 with no active results → 7 with results → 8 with
   comparison → 9 with basket), clear
   fictional disclosure, RWF/KES/GHS separation, comparison highlighting,
   provider portability, basket mutation, and both approve and veto. Curl alone
   is insufficient.
10. **Claim discipline:** before the demo, verify all three public origins and
    record exactly what rendered. Direct native API execution is not proof that
    a language model selected the right tools; a successful tool call is not an
    order.

When cutting scope, keep the owned fictional fixture, provider portability,
structured evidence, exact variants, currency separation, and veto. Those are
the proof of the thesis, not polish.
