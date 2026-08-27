# Using BasketShipper with Codex and ChatGPT

BasketShipper is designed for an agent-capable in-app browser. The page remains useful
without WebMCP, but the hackathon proof is an external agent discovering nine
actions that a separate provider origin lends to the storefront.

## Local try-out

```bash
npm start
```

Open `http://localhost:5173/` in the **Codex in-app browser** for the local
fixture-only storefront, or `http://localhost:5175/` for the BasketShipper-owned
fictional portability demo. Root is the sole mode and query overrides are
ignored. The command does not launch Chrome. It starts the storefront on
`5173`, provider on `5174`, independent host on `5175`, and hot reload for all
three.

Useful **rights-safe rehearsal** prompts:

- “List the fictional catalogues and their demo markets.”
- “Search `fictional` for products delivered to Rwanda.”
- “Compare the Nyota Road Running Shoe and Asa Canvas Weekender, then highlight
  delivery, exact variant, availability, and currency.”
- “Read my basket, set the exact fictional variants, then prepare the demo
  handoff and wait.”

The last prompt must stop at BasketShipper's visible Approve/Veto dialog. Approval only
prepares explicit merchant-page handoffs; it is not proof of payment or order
completion.

## What the agent should discover

The provider advertises these nine capabilities when WebMCP is available:

1. `list_shops`
2. `get_shopping_state`
3. `search_products`
4. `inspect_products`
5. `focus_products`
6. `compare_products`
7. `highlight_evidence`
8. `set_basket_quantity`
9. `prepare_checkout_handoff`

The provider owns matching `wire__*` implementations on another origin. The
prefix avoids registration collisions; host proxy calls re-stringify tool
inputs because `executeTool()` accepts JSON text.

The storefront does not expose all clean names unconditionally. Three base
actions are always available; results add inspection, focus, comparison, and
quantity-setting; comparison adds highlighting; and basket state adds
quantity-setting when needed plus handoff. Valid counts are therefore 3, 5, 7,
8, or 9. The page badge reports the currently active clean subset. The scripted
proof uses 3 with no active results → 7 with results → 8 with comparison → 9
with basket, but this is not the only valid state branch.

## Clean deployment URLs

After the rights-safe release is verified, share
`https://groundedrelay.pages.dev` as the primary entry. It pins
`https://groundedrelay-provider.pages.dev` behind the page. The independent
`https://groundedrelay-merchant.pages.dev` host then proves the same provider
can power a second static shop. Query overrides are ignored.

The canonical public production prompt is:

> Search `fictional` with Rwanda as the delivery destination. Inspect and compare
> the Nyota Road Running Shoe and Asa Canvas Weekender, highlighting merchant
> country, delivery, exact variant, availability, and currency. Set the basket
> to one Nyota EU 40 and one Asa Indigo, keep KES and GHS separate, then prepare
> the fictional handoff and wait.

Public HTTPS always uses the BasketShipper-owned fictional fixture. The final
call must stop at the visible Approve/Veto surface.

## Acceptance checks

- The page becomes usable without a permanent technical waiting state.
- Public pages visibly say fictional and render the three owned demo catalogues
  with RWF, KES, and GHS kept separate.
- Discovery returns nine `wire__*` provider capabilities, while the displayed
  clean-action count follows the current state (3, 5, 7, 8, or 9). The recorded
  demo path is 3 with no active results → 7 with results → 8 with comparison →
  9 with basket.
- Comparison evidence is visibly highlighted and other rows remain readable.
- A manual basket edit is visible to `get_shopping_state`, and a stale revision
  cannot overwrite it.
- Basket totals remain separated by currency.
- Approve and Veto produce distinct, visible results; neither lets the agent
  enter payment details or finish an order.
- `groundedrelay-merchant.pages.dev` discovers the same provider from a second host.
- Record direct `modelContext/getTools/executeTool` evidence separately from a
  language model choosing and sequencing tools.

Run `npm run check`, but also verify the rendered result in the Codex browser. DOM
state and `curl` cannot prove visible dialogs, market-localized catalogue
behaviour, or WebMCP discovery.
