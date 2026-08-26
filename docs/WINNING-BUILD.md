# GroundedRelay winning build

Status: implementation specification and acceptance contract for the OpenAI
WebMCP Challenge. This document is authoritative when product copy, tool names,
or demo scripts disagree.

## Product thesis

GroundedRelay is a cross-origin WebMCP capability layer for independent merchants. A
static provider lends grounded commerce actions to allowed hosts. The agent and
shopper collaborate in the same visible search, comparison, and basket state;
every handoff stops for the person.

The differentiator is not tool count. It is a complete, inspectable loop:

```text
intent -> catalogue search -> exact variant inspection -> visible evidence
       -> shared basket -> human/agent correction -> reviewed demo links
```

GroundedRelay never completes payment, combines currencies, invents delivery claims,
or pretends its fictional public handoff is a merchant checkout.

## WebMCP surface

| Tool | Customer outcome | Side effect |
| --- | --- | --- |
| `list_shops` | Understand searchable catalogues and coverage | none |
| `get_shopping_state` | Synchronize with human-edited page state | none |
| `search_products` | Render grounded catalogue matches | visible result set |
| `inspect_products` | Resolve exact variants and availability | none |
| `focus_products` | Put an agent shortlist on screen | visible focus |
| `compare_products` | Render observed differences | visible comparison |
| `highlight_evidence` | Emphasize exact returned fields | visible emphasis |
| `set_basket_quantity` | Add, update, or remove an exact variant | basket mutation |
| `prepare_checkout_handoff` | Park for review, then reveal safe links | human-gated |

The provider owns all nine definitions and registers them as `wire__*`. The host
discovers all nine, but exposes only the collision-free clean actions useful in
the current visible state:

| Page state | Clean actions active | State-enabled actions |
| --- | ---: | --- |
| No active results or basket | 3 | base: `list_shops`, `get_shopping_state`, `search_products` |
| No active results, basket present | 5 | `set_basket_quantity`, `prepare_checkout_handoff` |
| Results | 7 | `inspect_products`, `focus_products`, `compare_products`, `set_basket_quantity` |
| Results plus comparison, no basket | 8 | `highlight_evidence` |
| Results plus basket, no comparison | 8 | `prepare_checkout_handoff` |
| Results, comparison, and basket | 9 | `highlight_evidence`, `prepare_checkout_handoff` |

The scripted judge path is **3 with no active results → 7 with results → 8 with
comparison → 9 with basket**; it is not an invariant. The formula is three base
actions, plus three for active results, plus quantity-setting when results or a
basket exists, plus one for comparison, plus one for basket handoff. The maximum
of nine requires results, a comparison, and a basket at the same time. A
restored basket without results has a smaller valid subset. Registration
controllers trigger `toolchange`; an in-flight action is never unregistered
until it settles. UI copy and tests must distinguish the nine provider
capabilities from the current clean-action count.

Every schema is closed with `additionalProperties: false`, inputs are bounded,
and basket mutations require the latest state revision. Catalogue-controlled
content is annotated as untrusted. Agent-facing search results are compact even
when the page shows the complete result set.

## Trust boundaries

1. The provider accepts only explicit local and production host origins.
2. Every message checks origin, source window, and a per-page channel nonce.
3. Production provider headers restrict `frame-ancestors`.
4. Approval is bound to an immutable id and basket revision.
5. A changed basket invalidates approval and must be reviewed again.
6. Public links must use HTTPS and match `groundedrelay-merchant.pages.dev`, the host
   already present in the fictional basket.
7. Product strings, merchant metadata, reviews, and URLs are data, never model
   instructions.
8. The run report records metadata only: no prompts, arguments, results, product
   text, URLs, keys, or tokens.

## Customer experience acceptance

- Clean `http://localhost:5173/` and `http://localhost:5175/` URLs load without
  query parameters; port 5175 is the rights-safe portability proof. Root is the
  sole fixture mode, and query overrides are ignored.
- The page never displays a permanent provider-waiting state.
- Search remains usable without WebMCP through the direct local fallback.
- Public fixture state is clearly labelled fictional.
- Results preserve exact selected variant metadata.
- Focus and comparison changes are visible and keyboard accessible.
- Basket lines are grouped by merchant and totals remain grouped by currency.
- Public fixture basket lines restore after validation against the bundled
  fixture.
- Quantity zero removes an item; retries cannot silently double a quantity.
- The safe veto control receives initial focus.
- Approval reveals links only; it never navigates or pays automatically.
- Mobile comparison is readable without a 560px horizontal table.
- Reduced-motion, skip navigation, status semantics, and 44px destructive touch
  targets are present.

## Submission gates

- Public repository and an approved open-source license.
- Public data, names, products, prices, and links come from the
  GroundedRelay-owned fictional fixture. Exact web, npm, PyPI, GitHub
  repository-name, and `.com`/`.dev`/`.app`/`.io` DNS screens on 2026-08-26
  found no direct GroundedRelay software or product match. This is a preliminary
  collision screen, not legal or trademark clearance; complete the final
  terms/name review without claiming formal clearance.
- All three HTTPS origins deploy without an authentication wall.
- Exact submitted URLs pass deterministic checks and direct native WebMCP API
  checks; model-selected tool journeys are recorded separately.
- A public video under three minutes with audio.
- WebMCP safety/state assertions pass 100%.
- Supported-model full-journey success is at least 90% across fresh runs.
- No autonomous external navigation, mixed-currency total, stale approval,
  price echo, or injection-triggered mutation.

The deployment candidate always uses `createRightsSafeBackend` on public HTTPS:
three fictional catalogues, six invented products, no third-party imagery, and
handoff links only to `groundedrelay-merchant.pages.dev`. The entire tracked
runtime is fixture-only, and query overrides are ignored.

## Production-executable judge journey

Use this prompt on the submitted URL:

> Search `fictional` with Rwanda as the delivery destination. Inspect and compare
> the Nyota Road Running Shoe and Asa Canvas Weekender, highlighting merchant
> country, delivery, exact variant, availability, and currency. Set the basket
> to one Nyota EU 40 and one Asa Indigo, keep KES and GHS separate, then prepare
> the fictional handoff and wait.

This journey can exercise all nine capabilities. It must visibly show the
fictional disclosure, exact variants, highlighted comparison rows, separate
KES/GHS basket totals, and approval surface. The assistant may describe the
decision but must leave prices and totals to the page. Veto is the preferred
recorded ending because it proves the in-flight handoff remains under human
control. Direct native calls passed before the fixture change; rerun them after
deployment, and do not treat them as proof that a language model chose this
sequence.

## Scope explicitly excluded

- Central backend, accounts, analytics, crawler, or shared search index
- Unified checkout, payment, order creation, or shipping calculation
- Currency conversion or a combined multi-currency total
- Unsupported coupons, reviews, delivery promises, or product claims
- Network catalogue or remote-query runtime
- Persisted addresses, inferred private preferences, or API keys
- Experimental WebMCP proposals as required production dependencies
