# GroundedRelay — cross-origin WebMCP embed kit

**One static embed lends useful agent actions to another origin, while the page
keeps the evidence visible and checkout under human control.**

Built for the [OpenAI WebMCP Challenge](https://openai.com/webmcp-challenge/)
(submissions close 3 September 2026, 1pm PT).

The source work began on 26 August 2026, one day after the challenge window
opened. The clean, final-only GroundedRelay repository is public and verified
with only challenge-period commits, no inherited private history, and passing
deterministic and publication gates. The private development history is
retained for organizer review if requested.

**Public repository:**
<https://github.com/Timtech4u/groundedrelay-webmcp>

## What this is

GroundedRelay is the submission product name. Africa is the catalogue scope.
The tracked runtime always uses three GroundedRelay-owned fictional African
catalogues with six invented products, no third-party images, and demonstration
links only. It contains no external catalogue code, named merchant roster, or
merchant evidence. Earlier external-catalogue exploration is retired private
history, not submission or runtime content.

The architecture is a reusable WebMCP embed. A provider iframe on one static
origin owns the actions; both the GroundedRelay storefront and a second independent
static shop host can discover and hoist them. Neither host implements the
provider logic. The provider exposes nine bounded actions:

- `list_shops`
- `get_shopping_state`
- `search_products`
- `inspect_products`
- `focus_products`
- `compare_products`
- `highlight_evidence`
- `set_basket_quantity`
- `prepare_checkout_handoff`

The provider registers prefixed `wire__*` tools, shares them only with an
explicitly allowed host origin, and the host re-registers clean names for the page agent.
The browser mediates cross-origin execution; inputs are re-stringified when the
host calls `executeTool()`. Origin, source window, protocol version and a
per-page channel nonce are checked on every provider message.

The core registration is ordinary WebMCP, with the cross-origin audience made
explicit. A literal single-tool expansion of the provider pattern in
[`sites/embed/embed.js`](sites/embed/embed.js):

```js
await document.modelContext.registerTool({
  name: "wire__list_shops",
  title: "View searchable shops",
  description:
    "List this provider's searchable fictional catalogues, markets, currencies, readiness, and delivery coverage.",
  inputSchema: {
    type: "object",
    properties: {},
    additionalProperties: false,
  },
  annotations: {
    readOnlyHint: true,
    untrustedContentHint: true,
  },
  execute: async () =>
    JSON.stringify(
      withDataDisclosure(compactShopList(await backend.listShops())),
    ),
  },
  { exposedTo: [HOST_ORIGIN] },
);
```

The storefront discovers those foreign tools with
`getTools({ fromOrigins: [EMBED_ORIGIN] })`, registers collision-free clean
proxies, and passes `JSON.stringify(input)` to `executeTool()`. The fixture
provider contains nine actions; its active clean surface is
deliberately state-aware:

| Visible state | Active clean actions |
| --- | ---: |
| No active results or basket | 3 |
| No active results, basket present | 5 |
| Results only | 7 |
| Results plus comparison, no basket | 8 |
| Results plus basket, no comparison | 8 |
| Results, comparison, and basket | 9 |

This makes an agent's available actions match what the person can currently
see and safely do. The page badge reports this active subset, not the provider's
nine-action capability total. The scripted judge journey demonstrates
**3 with no active results → 7 with results → 8 with comparison → 9 with
basket**; that sequence is a demo path, not the only valid state branch.

See [docs/AFRICA-FIRST.md](docs/AFRICA-FIRST.md) for the public-fixture decision,
privacy boundary, and one-minute judge story. See
[spike/FINDINGS.md](spike/FINDINGS.md) for browser behaviour measured rather
than assumed. [docs/WINNING-BUILD.md](docs/WINNING-BUILD.md) is the current
implementation contract, [docs/EVALS.md](docs/EVALS.md) defines the evidence
gate, [docs/SUBMISSION.md](docs/SUBMISSION.md) contains Devpost-ready copy,
[docs/DEMO-SCRIPT.md](docs/DEMO-SCRIPT.md) is the under-three-minute capture
plan, [docs/SUBMISSION-CHECKLIST.md](docs/SUBMISSION-CHECKLIST.md) is the
fail-closed release gate, [docs/RIGHTS-SAFE-DEMO.md](docs/RIGHTS-SAFE-DEMO.md)
defines the owned public fixture, and [docs/BLOG-POST.md](docs/BLOG-POST.md) is
the publication draft.

## What a shopper sees

- Three visibly fictional, GroundedRelay-owned demo catalogues across Rwanda, Kenya,
  and Ghana, using RWF, KES, and GHS without third-party product imagery.
- Structured comparison rows and agent-selected evidence highlighted on the
  page. Recommendations are inspectable instead of disappearing into chat.
- Exact variants and options can be inspected before a basket mutation; the
  visible default is the first available variant in the fixture.
- A revisioned, locally persisted basket that an agent can reread after human
  edits. Lines are validated immediately against the bundled owned fixture.
- Totals in the basket and approval view are grouped by ISO currency. Unlike currencies are
  never added into a fictional combined total.
- A fictional-handoff call bound to the reviewed basket revision. It parks until
  the person approves or vetoes it; approval reveals only GroundedRelay-owned demo
  links and cannot complete a purchase.

The UI is also a graceful enhancement. A browser-independent provider
handshake makes the page usable as soon as the frame is alive. When the WebMCP
page API is present, GroundedRelay discovers nine provider actions and hoists only the
subset useful for the current search, comparison, and basket state. When it is
absent, the same static provider still supports direct local search, compare,
add/remove, and handoff controls through the page UI; the user is never held
behind a technical provider-loading state.

## Privacy boundary

There is no project backend. All three origins are static, and development uses
only a local static-file server. Every environment loads the
GroundedRelay-owned fixture and ranks it in the browser; it contacts no external
shop. Query parameters cannot change the data source or runtime mode.
GroundedRelay uses deterministic local search, an available on-device browser
model, or the browser's native Site Tools agent. It does not collect or store
model API keys.

## Run locally

```bash
npm start
```

The startup script checks that all three origins are either healthy or free,
then starts `server.js`. It does not open an external browser. Open the clean
entry URLs in the **Codex in-app browser**:

- local storefront: `http://localhost:5173/`
- provider behind the page: `http://localhost:5174`
- rights-safe independent host: `http://localhost:5175/`

The root storefront is the sole runtime mode. Query parameters are ignored and
cannot select another data source or provider.

`server.js` keeps the sites genuinely cross-origin and injects a
development-only SSE live-reload client into all three. `npm run dev` remains the
lower-level command. The Codex browser is the default and required target for
interactive verification. Do not launch standalone Chrome or
Chrome-for-Testing unless the user explicitly asks, or a final isolated native
API test is clearly documented.

Run the deterministic checks with:

```bash
npm run check
```

Before publication, also run `npm run check:release -- --code-only` from the
clean final-only repository. The private development history is expected to
fail its two history-publication checks and must never be waived or made public.

Browser acceptance must verify what renders: explicit fictional disclosure on
the rights-safe host, RWF/KES/GHS separation, nine provider capabilities, the
scripted clean-action path (3 with no active results → 7 with results → 8 with
comparison → 9 with basket), the 5- and 8-action basket branches, comparison
highlighting, basket mutation, both approval and veto, and provider reuse on a
second host.
`curl` alone cannot prove these.

## Deployment target

The rights-safe three-origin release has **not yet been smoke-tested on the
public URLs**. Its intended shopper entry is
[https://groundedrelay.pages.dev](https://groundedrelay.pages.dev), which pins
the provider at
[https://groundedrelay-provider.pages.dev](https://groundedrelay-provider.pages.dev).
The intended independent proof host is
[https://groundedrelay-merchant.pages.dev](https://groundedrelay-merchant.pages.dev). Do not
describe this target architecture as deployed until all three exact URLs pass a
signed-out, commit-bound smoke test. In the release contract, public HTTPS uses
only the GroundedRelay-owned fictional fixture.

All three projects are static Cloudflare Pages deployments:

- `groundedrelay` publishes `sites/storefront/`.
- `groundedrelay-provider` publishes `sites/embed/`.
- `groundedrelay-merchant` publishes `sites/merchant-demo/`.

After `npx wrangler whoami` confirms the intended account, deploy all three
origins with `npm run deploy:cloudflare`. The script deliberately uses
storefront → provider → merchant for the fail-closed rights-safe cutover and
remains the documented order. It byte-matches every deployed asset to the clean
public commit, then runs the signed-out online gate; that gate requires the live
provider to contain exactly three catalogues, six products, and RWF/KES/GHS,
with both hosts pinned to that provider. A one-catalogue production slice fails
closed. Do not reorder it without an explicit,
separately tested migration decision. The Pages assignments are
`groundedrelay.pages.dev` for the storefront,
`groundedrelay-provider.pages.dev` for the provider, and
`groundedrelay-merchant.pages.dev` for the portability host. Smoke-test all
three origins after every release before describing a change as production-ready.

For an independent native-runtime check after deployment, Cloudflare Browser
Run's experimental WebMCP pool can execute the same deterministic journey:

```bash
npm run check:native:cloudflare -- \
  --url=https://groundedrelay.pages.dev/ \
  --provider=https://groundedrelay-provider.pages.dev \
  --scenario=fictional \
  --timeout=60000
```

The command creates and closes a short-lived `--lab` session and never persists
its WebSocket endpoint. It requires an explicitly authorized Wrangler login.
This is an additional direct native API check, not model-selection proof or a
production dependency. Keep Cloudflare's automatic edge-injected WebMCP bridge
disabled: GroundedRelay's own state-aware tools are the submitted implementation.

## Layout

```text
server.js              three static origins plus development-only SSE live reload
sites/storefront/      shopper UI, discovery/hoisting, fallback, human veto
  store.js             provider handshake, rendering, direct controls, checkout
  agent.js             in-page assistant and interchangeable model backends
sites/embed/           provider frame and all action implementations
  backends/demo.js     GroundedRelay-owned fictional public fixture
sites/merchant-demo/   independent static host using the same provider
docs/AFRICA-FIRST.md   authoritative product and rights decision record
spike/FINDINGS.md      measured WebMCP browser behaviour
```

The strongest hackathon claim is the combination: one reusable provider working
across independent hosts, local catalogue search, visible comparison evidence,
exact variant and currency handling, and a human veto at the consequential
boundary.
