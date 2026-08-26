# GroundedRelay Cloudflare deployment handoff

Last reviewed: 26 August 2026 (Africa/Kigali)

## Current release state

The rights-safe three-origin release is **implemented locally but not yet
deployed or production-verified**. Do not treat the historical deployment below
as proof of the current candidate.

Current source evidence is narrower and explicit:

- `npm run check` passes **96/96 total checks**: 95 Node tests plus eval
  validation, with **8 eval cases** and **9 tools**;
- the prior fixture candidate passed **42/42 direct native WebMCP checks** in
  the isolated compatibility runtime; the final GroundedRelay tree needs a
  fresh local run;
- the sanitized public repository is
  <https://github.com/Timtech4u/groundedrelay-webmcp>; its first public
  challenge-period commit is `cce50221b3098079b5810dda0de50438f376c650`,
  the signed-out repository and raw README return 200, and MIT is detected.
  Read the release SHA from the synchronized public `main` at deployment time;
  do not assume the first commit remains HEAD.

Public `main` passes **35/35 publication checks**. Repeat the gate after any
source update and before deploying a different public commit.

Source synchronization is complete. Deploy only the verified public SHA to the
three HTTPS origins.

The next public release must expose:

| Cloudflare Pages project | Published directory | Required production URL | Purpose |
| --- | --- | --- | --- |
| `groundedrelay` | `sites/storefront/` | `https://groundedrelay.pages.dev` | Main submitted shopper experience |
| `groundedrelay-provider` | `sites/embed/` | `https://groundedrelay-provider.pages.dev` | Shared cross-origin WebMCP provider |
| `groundedrelay-merchant` | `sites/merchant-demo/` | `https://groundedrelay-merchant.pages.dev` | Independent static host and owned handoff target |

All three projects are static. GroundedRelay adds no Worker, Pages Function,
application server, search proxy, database, analytics beacon, model-key store,
or payment service.

The final product source is published and verified. The submission is not ready
to call live until all three projects are deployed from its exact commit and
every production gate in
[`SUBMISSION-CHECKLIST.md`](SUBMISSION-CHECKLIST.md) passes.

## Rights-safe production policy

- Every HTTPS caller receives `createRightsSafeBackend()` with three
  GroundedRelay-owned fictional catalogues, six invented products, no third-party
  images, and explicit fictional-data disclosure.
- Public query strings cannot select another backend; the tracked runtime is
  fixture-only.
- The provider accepts the exact HTTPS hosts `https://groundedrelay.pages.dev`
  and `https://groundedrelay-merchant.pages.dev`, plus the explicit loopback development
  hosts. Its production `frame-ancestors` policy names only those two HTTPS
  hosts.
- Both public hosts pin `https://groundedrelay-provider.pages.dev` and ignore public
  query-string provider substitutions.
- The provider registers collision-safe `wire__*` actions. Hosts discover them
  cross-origin and expose only actions valid for current results, comparison,
  and basket state. Counts can be 3, 5, 7, 8, or 9; the scripted proof follows
  **3 with no active results → 7 with results → 8 with comparison → 9 with
  basket** but that is not the only valid branch.
- Handoff is not checkout. Veto rejects the pending call and retains the basket;
  approval reveals an owned `https://groundedrelay-merchant.pages.dev/` demo link but
  never opens it, accepts payment, creates an order, or proves a purchase.
- RWF, KES, and GHS remain separate. Money uses ISO currency plus integer minor
  units; GroundedRelay never invents an exchange rate or combined total.

The full public-data boundary is documented in
[`RIGHTS-SAFE-DEMO.md`](RIGHTS-SAFE-DEMO.md). The user's decision is **do not
send merchant outreach**; written merchant permission is not a blocker for this
owned-fixture path. Exact web, npm, PyPI, GitHub repository-name, and
`.com`/`.dev`/`.app`/`.io` DNS screens on 2026-08-26 found no direct
GroundedRelay software or product match, but this is only a preliminary
collision screen. A final terms and naming review is still required, and this
document does not claim legal or trademark clearance.

## Repository changes in the candidate

- `sites/embed/` defaults every HTTPS caller to the rights-safe fixture and
  allows both exact public host origins.
- `sites/storefront/` is the submitted interface and pins the provider.
- `sites/merchant-demo/` is an independent static client that reuses the same
  provider action contract and receives the owned demonstration handoff links.
- The host/provider handshake binds the allowed origin, exact source window,
  protocol version, and a per-page channel nonce.
- The provider exposes nine capabilities while each host exposes the valid
  state-aware clean subset described above.
- `scripts/deploy-cloudflare.sh` encodes the one-time fail-closed migration:
  main storefront, then provider, then independent merchant host.
- `_headers` and legacy Vercel policy files preserve the same origin and CSP
  boundaries.
- Tests, evals, release gates, Devpost copy, demo script, blog, and public docs
  distinguish direct WebMCP runtime proof from language-model tool selection.

## Deployment procedure

Before deploying, use read-only checks to confirm the intended Cloudflare
account, the three Pages project names, the three assigned production URLs, and
that deployment protection is disabled for the public provider. Keep account
identifiers and credentials out of logs and this repository.

```bash
npx --yes wrangler@4.126.0 whoami
npm run check
npm run check:release -- --code-only
git diff --check
```

### One-time rights-safe cutover

The retired provider deployment predates the owned fixture. For the **first
GroundedRelay release**, use this fail-closed order from the verified public
commit.
The checked-in deployment script encodes the order and checkpoints:

```bash
npm run deploy:cloudflare
```

This puts the new fail-closed consumer in front of the old provider before any
new public provider response is introduced, then switches the provider to the
owned fixture, then publishes the independent proof/owned handoff target. The
script refuses a dirty tree, a non-public origin, or a commit different from
refreshed `origin/main`; reruns both local release gates; verifies the Pages
projects and domains; publishes a tracked-only archive with the exact commit
SHA; and stops unless every served asset byte-matches that archive. It then runs
the signed-out online release gate, which fetches the deployed provider fixture
and requires exactly the three owned catalogues, six products, and RWF/KES/GHS,
while confirming both public hosts pin the same provider. If either an exact
asset check or that multi-catalogue contract fails, do not record a rights-safe
deployment.

Create the `groundedrelay-merchant` project before starting, even though its
content deploy is the third step. An approved demonstration handoff is bound to
that exact origin.

### Later backward-compatible releases

The checked-in and documented release order remains storefront → provider →
merchant. Do not introduce an alternate order without a separately tested,
explicit migration decision and coordinated script, tests, and docs.

After deployment, record the deployed git SHA and independently verify:

```text
https://groundedrelay.pages.dev/
https://groundedrelay-provider.pages.dev/embed
https://groundedrelay-merchant.pages.dev/
```

All three must return public content without authentication. Check CSP and
`frame-ancestors`, pinned provider URLs, visible fictional disclosure, the
three catalogues/currencies, the main-host and independent-host journeys,
approve/veto behavior, service-worker refresh, console errors, and that
approved links stay on the exact owned merchant-demo origin.

## Native WebMCP evidence boundary

The prior rights-safe fixture candidate passed **42/42 direct native API
checks** in an isolated Chrome 151 profile, including state branches, rendered
effects, exact variant-to-product binding, separate KES/GHS totals, five
grounded highlighted rows, stale-state rejection, approve, veto, artifact
validation, and cleanup. It is historical local contract evidence, not final
GroundedRelay proof, production evidence, or a language model choosing actions.

A previous production compatibility run passed **32/32 direct checks** against
the deployed pre-fixture build. It used the real deployed
`document.modelContext`, `getTools()`, and `executeTool()` APIs through CDP and
asserted rendered effects. It proved direct native runtime registration,
discovery, execution, state transitions, and human approval/veto mechanics for
that older deployment.

It did **not** prove that a language model selected the correct actions from a
prompt, and it is not final production evidence for the rights-safe candidate.
Preserve that distinction in every submission claim.

Before submission, capture two separate final results:

1. a rights-safe production rerun of the direct native API contract on the
   exact deployed commit; and
2. a fresh model-selected run of the exact fictional prompts in
   [`DEMO-SCRIPT.md`](DEMO-SCRIPT.md).

Do not substitute manual direct controls or a fallback-mode run for either
result. Do not call the earlier 32/32 result native-agent prompt reliability.

## Historical deployment record — superseded

An earlier private two-origin build used external catalogue research and
predates the owned fictional fixture, independent merchant-demo host, and
current rights-safe policy. Its old commit identifiers and named research
evidence do not belong in the clean public repository. Historical smoke results
remain private engineering context only and must not be shown or described as
the final public submission, permission evidence, partnership, or final
rights-safe WebMCP verification.

## Final handoff record

Complete this only after the fresh release is independently verified:

```text
Final git SHA:
origin/main synchronized:
Provider deployment verified at:
Merchant-demo deployment verified at:
Storefront deployment verified at:
Signed-out HTTP/CSP smoke:
Rendered rights-safe smoke:
Direct native WebMCP result:
Model-selected journey result:
Public repository and MIT detection:
Rights-safe naming/terms review:
Video and screenshots:
Devpost submission confirmation:
```

Until each required field has evidence, describe the candidate as local,
deployed-but-unverified, or blocked as appropriate—never simply “ready” or
“live.”
