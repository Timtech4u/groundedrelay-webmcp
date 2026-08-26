# Spike findings — Chrome 151.0.7922.174, `enable-webmcp-testing`

> Historical measurement note: the original spike below exercised five tools.
> The current GroundedRelay contract exposes nine clean tools and nine `wire__` tools;
> use `spike/console-check.js` and `docs/EVALS.md` for the current acceptance set.

**Verdict: GO.** Cross-origin tool sharing and the hoist both work. Every claim
below was executed against a live runtime, not read off the spec.

Method: a second Chrome on an isolated profile with the flag seeded into
`Local State`, driven over CDP on port 9333. Runs alongside the user's browser
without disturbing it.

| # | Check | Result |
| --- | --- | --- |
| 1 | `document.modelContext` present | PASS — `document`, not `navigator` |
| 2 | cross-origin frame registers under `allow="tools"` | PASS — 5 tools |
| 3 | default `getTools()` excludes cross-origin tools | PASS — returns only same-origin |
| 4 | `getTools({ fromOrigins })` returns provider tools | **PASS** — the go/no-go |
| 4b | `inputSchema` wire type | **string** (the Chrome 154 object change is still reverted) |
| 5 | `executeTool()` across the boundary | PASS — arguments must be a JSON **string** |
| 6 | hoisted tool executes and reaches its body | PASS — after the name fix below |
| 7 | abort propagates into the provider frame | PASS — `AbortError` at ~121ms on a 300ms tool, both direct and hoisted |
| 8 | checkout parks for human approval | PASS — cart preserved while parked |
| 9 | veto cancels in-flight | PASS — rejects, cart intact |
| 10 | approve completes | PASS — order confirmed, cart cleared |

## Four things the spec does not tell you

1. **`executeTool()` takes arguments as a JSON string, not an object.** Passing
   an object throws `UnknownError: Failed to parse input arguments`. This
   matches `inputSchema` still being a string. Note the asymmetry: `execute()`
   receives a parsed **object**, so a proxy must re-stringify.

2. **Hoisting under the provider's own tool name breaks execution.** With both a
   cross-origin `search_inventory` and a same-origin hoisted `search_inventory`
   in the tree, `executeTool()` fails with the generic *"Tool was executed but
   the invocation failed"* and the `execute()` body is **never reached** — no
   error surfaces anywhere. A proxy under a unique name works immediately.
   Fix: the provider registers under a `wire__` prefix and the host hoists under
   the clean public name. This cost the most time to find and is the single most
   useful thing we learned.

3. **`RegisteredTool#annotations` is `null` across origins.** `destructiveHint`,
   `untrustedContentHint` and `readOnlyHint` are all dropped on the hop, so a
   host cannot tell a destructive tool from a safe one by inspection alone. We
   send declarations over `postMessage` alongside. Worth filing upstream —
   losing safety metadata at a trust boundary is exactly backwards.

4. **Errors flatten across the boundary.** A provider throwing
   `AbortError("The human vetoed this checkout")` surfaces to the caller as
   `UnknownError: Tool was executed but the invocation failed`. Cancellation via
   `signal` *does* preserve `AbortError` — but application-thrown errors lose
   both name and message, so an agent cannot distinguish "out of stock" from
   "server exploded".

## Also found

A service worker caching the shell will happily serve stale tool-wiring code and
silently mask a fix. Network-first with cache fallback, not cache-first.

## Production remeasurement — 26 August 2026

An earlier nine-action build was remeasured against the then-live private
deployment with Chrome `151.0.7922.174`, an isolated temporary
profile, `WebMCPTesting`, and CDP. The reusable probe is
`scripts/native-webmcp-check.mjs`; the evidence record is
`docs/NATIVE-WEBMCP-EVIDENCE.md`.

This was retired private pre-fixture external-catalogue work. Keep it only as a
timestamped runtime baseline, not as final submission evidence; the
GroundedRelay-owned fictional deployment requires its own fresh run.

- All 32 native-contract and rendered-flow checks passed.
- The provider exposed nine `wire__*` actions from its separate private origin;
  the clean surface changed exactly
  `3 -> 7 -> 8 -> 9` as results, comparison, and basket state appeared.
- The production one-time egg query returned two available `RW`/`RWF`
  products. Inspect, focus, compare, highlight, revision-safe basket mutation,
  stale-state rejection, veto, and approved link handoff all executed.
- Neither approval nor veto opened a page automatically.
- JSON text remains required by `executeTool()` and application-thrown veto
  still flattens to `UnknownError` across the origin boundary.

One earlier finding changed: provider annotations were serializable across the
origin boundary in this production run. All nine exposed `readOnlyHint` and
`untrustedContentHint` values. The explicit declarations sent over
`postMessage` remain a compatibility fallback for runtimes matching the
original spike, but “annotations are always null” is not a current invariant.

This run called the native WebMCP API directly. It proves registration,
discovery, cross-origin execution, state-aware hoisting, and rendered effects;
it does not prove that a particular built-in agent model will choose the right
actions from a natural-language prompt.

## Rights-safe local candidate — 26 August 2026

The prior rights-safe fixture candidate, before the GroundedRelay rename, was
measured against the independent static host on `http://localhost:5175` and provider on
`http://localhost:5174` in the same isolated Chrome 151 environment. All **41
of 41** native-contract and rendered-flow checks passed.

The lifecycle proof is deterministic rather than startup-race-dependent. The
fixture can preload results and settle at seven tools. The probe performs a
zero-match search, observes exactly 3 clean baseline tools, then observes 7
after the meaningful search, 8 after comparison, and 9 after basket mutation.

The final journey used two fictional merchants and currencies: it inspected
Nyota Road Running Shoe and Asa Canvas Weekender, selected exact available
`EU 40` and `Indigo` variants, kept GHS and KES totals separate, rejected stale
revisions, preserved both lines after veto, rendered two approved owned links,
opened no new page, and cleaned the basket. A first screenshot exposed duplicate
currency and variant labels on the independent host; the UI was corrected and
the 41-check journey rerun before retaining the final artifacts.

This local candidate run is still direct `document.modelContext` execution via
CDP. It is neither final HTTPS evidence nor built-in model-selection evidence.

## Still open

Whether the **built-in agent** sees hoisted tools. This Chrome profile has no
built-in agent, so it cannot be answered here — it needs ChatGPT's in-app
browser. If iframe tools turn out to be visible to built-in agents directly, the
hoist becomes a compatibility shim rather than the core mechanism; either way
the name-collision finding stands.
