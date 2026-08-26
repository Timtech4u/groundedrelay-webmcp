# Native WebMCP evidence

## Historical rights-safe local fixture candidate

Last measured: **26 August 2026, 20:41:04 UTC**
Independent host: `http://localhost:5175/`
Provider: `http://localhost:5174`
Browser: **Chrome 151.0.7922.174**, DevTools protocol 1.3

> **Evidence status:** **42 of 42 passed on the prior local fixture tree.** The
> GroundedRelay rename and runtime reduction happened after this capture, so it
> is historical native proof, not current-tree or production proof. The final
> local tree and HTTPS deployment need the same
> `--scenario=fictional` run against `groundedrelay.pages.dev` and
> `groundedrelay-merchant.pages.dev`.

The measured build proved the full GroundedRelay-owned fictional story through native
`document.modelContext`: nine provider actions were discovered cross-origin,
proxied under clean names, executed, and reflected in the independent host UI.
The journey searched `fictional` with `ships_to=RW`, selected Nyota Road Running
Shoe and Asa Canvas Weekender by exact name, inspected both, chose the available
`EU 40 · Colour: Indigo` and `Indigo` variant SKUs, then used those same exact
IDs for focus, comparison, highlighting and basket mutation. The comparison
highlighted merchant, exact variant, availability, currency and current price.
The basket exposed distinct `KES` and `GHS` totals and never produced a combined
cross-currency total.

The fixture preloads useful products, so a fresh page can settle at seven clean
tools before an observer sees an empty state. The probe avoids making a timing
claim: it executes a real zero-match search and observes exactly **3** baseline
tools, then observes exactly **7** with results, **8** with a comparison, and
**9** with a basket. This is an observable state contract, not an artificial
startup delay.

Both human outcomes passed. Veto held safe focus, rejected the in-flight call,
and retained both basket lines. Approval returned link-ready prose, rendered
two exact GroundedRelay-owned demo links, and did not navigate or open a page. The
probe associated each product with its own labelled exact variant, then removed
both device-local lines and observed checkout retraction.

This direct probe did not ask a model to select tools. The final separate
model-selected run must follow the
[official Site Tools documentation](https://learn.chatgpt.com/docs/webmcp): use
the latest ChatGPT desktop app, record the exact **GPT-5.6 Sol** or
**GPT-5.6 Terra** model, and do not use GPT-5.6 Luna because WebMCP is currently
disabled there. That model-selected evidence is still pending.

The comparison measured 804 by 585 CSS pixels at viewport coordinates 60,114;
both approval surfaces measured 1280 by 813 pixels. Computed display,
visibility, opacity, positive bounds and viewport intersection all passed. The
screenshots were visually inspected after the run. Earlier ambiguous option
labels and a below-fold visibility false positive were fixed and converted into
regression assertions before this final measurement. Artifact generation also
validated that all three captures were real PNG files at 1280 by 813 pixels
before recording them as evidence.

This remains a **direct native API/CDP run**, not a language-model run. It proves
registration, discovery, exact execution semantics, rendered effects, and
human gates. It does **not** prove that a built-in Site Tools agent chooses the
right sequence from natural language; that requires a separate prompt run in
the exact judge agent.

Final local artifact hashes:

```text
6a276cd1993840927df05cfff2b0b235e7b35d5a09b6a267ff2c67f0276db552  approved-handoff.png
9ad1d7e7be2be143e90df6e7b3964e315cc7f0018de3bca5ac3a2661b826e8b4  comparison-evidence.png
7f501c963784ce3efa4fa4d01f6234691106ef1682b7bd9d170febd0725b2f71  human-veto.png
bfb303a3cfd7823f4cc7346f75d77c945cda7983889222ae776060578e1b212f  native-webmcp-evidence.json
c3e070f244e1c0b43f0db591953faa67b09345a96dadcfc9717e18be9772fecf  native-webmcp-flow.mp4
```

The artifact directory is machine-local and intentionally omitted from public
repository copy; the filenames and hashes above are the durable handoff.

## Historical production baseline — pre-rights-safe

Last measured: **26 August 2026, 19:21:15 UTC**
Storefront: <https://groundedrelay.pages.dev/>
Provider: <https://groundedrelay-provider.pages.dev>
Browser: **Chrome 151.0.7922.174**, DevTools protocol 1.3

> **Evidence status:** historical pre-rights-safe production baseline. The
> measured deployment used a historical external-catalogue candidate. The final
> submission is moving to GroundedRelay-owned fictional data; replace this result with
> a fresh `--scenario=fictional` run after that build is deployed.

### Verdict

The deployed cross-origin WebMCP contract passed **32 of 32** checks in an
isolated WebMCP-enabled Chrome profile. This closes the registration,
discovery, execution, state-aware hoisting, rendered-effect, and human-gate
questions for the measured production build.

It does **not** prove built-in model selection. The run invoked registered
actions through the native `document.modelContext` API. A separate prompt run
in the exact judge agent still needs to prove that the model selects and orders
the actions reliably.

### What was proved

| Area | Measured result |
| --- | --- |
| Page API | `document.modelContext` available |
| Provider discovery | Nine `wire__*` actions from the exact provider origin |
| Clean host surface | 3 with no active results after a forced zero-result search, then the canonical scripted 3 → 7 → 8 → 9 path |
| Cross-origin call | Direct provider call and clean hoisted call both executed |
| Production search | Two available one-time catalogue options, market `RW`, currency `RWF` |
| Grounded decision support | Exact variant inspection, focus, two-product comparison, four known evidence rows highlighted |
| State safety | Stale basket mutation and stale handoff rejected; current revision accepted |
| Human control | Approval sheet had positive rendered bounds; veto held focus and rejected the pending call; basket survived |
| Approved outcome | One reviewed HTTPS merchant link rendered; storefront URL and page-target count did not change |
| Cleanup | Basket returned to empty and checkout action retracted |

The measured comparison was 672 by 513 CSS pixels. Both approval sheets were
1280 by 813 pixels. These are computed, positive bounding boxes, not inferences
from a `hidden` property.

## Reproduce safely

### Recommended production rerun: Cloudflare Browser Run WebMCP lab

Cloudflare's [Browser Run WebMCP lab](https://developers.cloudflare.com/browser-run/features/webmcp/)
is a useful independent production verifier after all three HTTPS origins are
deployed. It runs the same deterministic GroundedRelay probe in Cloudflare's
experimental Chrome pool, supports native tool discovery/execution and
human-in-the-loop surfaces, and avoids treating a local compatibility browser
as the only native evidence.

Do **not** enable Cloudflare's separate automatic WebMCP bridge on the submitted
origins. GroundedRelay already registers its own state-aware tools; an injected
tool pack would create a second implementation surface, risk duplicate or
irrelevant tools, and make the submission harder to evaluate. Browser Run is
the verifier here, not the source of GroundedRelay's tools.

After explicit Cloudflare authorization and the exact-commit deployment:

```bash
CLOUDFLARE_NATIVE_EVIDENCE="$(mktemp -d /private/tmp/groundedrelay-cf-native.XXXXXX)"
npm run check:native:cloudflare -- \
  --url=https://groundedrelay.pages.dev/ \
  --provider=https://groundedrelay-provider.pages.dev \
  --scenario=fictional \
  --artifacts="$CLOUDFLARE_NATIVE_EVIDENCE" \
  --timeout=60000
```

The wrapper uses pinned Wrangler, creates a short-lived `--lab` session with a
ten-minute maximum keep-alive, passes its WebSocket target to the probe only in
process memory, and closes the Browser Run session afterward. It never prints
or writes the WebSocket endpoint. The command still requires the existing
Wrangler login; OAuth approval remains a separate action-time authorization.
Browser Run lab is experimental and counts against Cloudflare's normal limits,
so this is release evidence rather than a production runtime dependency.

Record the resulting check count, exact public commit, timestamp, browser
product/version and artifact hashes as a separate evidence row. It remains a
direct native API run—not proof that a language model chose the actions.

### Local compatibility rerun

This is an explicit compatibility exception to the normal Codex-browser-only
workflow. Never use the default Chrome profile. Start a second process with a
new temporary profile and the WebMCP test feature:

```bash
BASKET_NATIVE_PROFILE="$(mktemp -d /private/tmp/basket-native-profile.XXXXXX)"
'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' \
  --user-data-dir="$BASKET_NATIVE_PROFILE" \
  --remote-debugging-port=9333 \
  --enable-features=WebMCPTesting \
  --no-first-run --no-default-browser-check --disable-sync --disable-extensions \
  --window-size=1280,900 --new-window about:blank
```

From another terminal:

```bash
BASKET_NATIVE_EVIDENCE="$(mktemp -d /private/tmp/basket-native-evidence.XXXXXX)"
node scripts/native-webmcp-check.mjs \
  --devtools=http://127.0.0.1:9333 \
  --url=https://groundedrelay.pages.dev/ \
  --provider=https://groundedrelay-provider.pages.dev \
  --artifacts="$BASKET_NATIVE_EVIDENCE" \
  --timeout=60000
```

For the local independent-host proof before deployment, replace the probe call
with:

```bash
node scripts/native-webmcp-check.mjs \
  --devtools=http://127.0.0.1:9333 \
  --url=http://localhost:5175/ \
  --provider=http://localhost:5174 \
  --scenario=fictional \
  --handoff-prefix=http://localhost:5175/ \
  --artifacts="$BASKET_NATIVE_EVIDENCE" \
  --timeout=60000
```

The probe never clicks a merchant link. It tests veto, approves only far enough
to reveal the reviewed link, confirms no page target opened, removes its
device-local basket lines, and closes its CDP page target. Stop the isolated
Chrome process when finished.

## Historical private artifacts

The captured files are deliberately local and are not published or committed.
In the commands above their directory is `$BASKET_NATIVE_EVIDENCE`:

- `comparison-evidence.png`
- `human-veto.png`
- `approved-handoff.png`
- `native-webmcp-flow.mp4` — 7.125 seconds
- `native-webmcp-evidence.json` — full machine-readable result

SHA-256:

```text
22f30ddc9757fbccc3fe049d783b86ca8387d4daeaecdf120a0e7c0db9c0df45  approved-handoff.png
4051333c339e62d3b2199ec7b75b694e183badf0a0ebba521fb3300d640f712e  comparison-evidence.png
78d8de9abd4d4d5a5a3e966ea30c4f74ee8917713f20ec8144080d2cebe180a1  human-veto.png
7794ceb944bda0dc2f127f6ced998cd34d8a507e688220d2890299a7f24659c8  native-webmcp-evidence.json
035989021084c898d556cf438b694eb1c2a69d14b7739f4a6020ba69a7846f36  native-webmcp-flow.mp4
```

## Runtime caveats observed

- `inputSchema` crossed the boundary as a string, so the clean proxy still
  must JSON-stringify arguments passed to `executeTool()`.
- Provider annotations were present on both Chrome 151 runs. The host-side
  declaration channel remains an older-runtime compatibility fallback because
  the original spike returned null; null is not the current measured behavior.
- A provider-thrown veto reached the caller as a generic `UnknownError`. The
  visible approval state and rejected promise proved the veto, but Chrome did
  not preserve the application error text across the boundary.
- The baseline production run exposed two truthful-copy defects: an immediate
  shop list could look unchecked rather than loading, and the success response
  said shops were opening when only links were rendered. Local fixes add
  explicit `checked`/`pending`/`ready` fields and say merchant links are ready.
  Those two fixes require a post-deployment rerun before this document can say
  the corrected responses are live.
