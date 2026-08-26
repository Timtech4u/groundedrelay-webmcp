---
name: cloudflare-pages-deploy
description: Deploy or verify GroundedRelay's three static Cloudflare Pages origins from the clean public repository while preserving the fixture-only data boundary, pinned cross-origin provider, exact release commit, and human-gated handoff.
---

# Deploy GroundedRelay to Cloudflare Pages

Read `AGENTS.md`, `README.md`, `docs/AFRICA-FIRST.md`, and
`docs/CLOUDFLARE-DEPLOYMENT-HANDOFF.md` before changing release wiring. The
private development repository is not publishable. Deployment is permitted only
from a clean `main` checkout of the public repository:

`https://github.com/Timtech4u/groundedrelay-webmcp`

## Architecture to preserve

| Pages project | Published directory | Canonical URL |
| --- | --- | --- |
| `groundedrelay` | `sites/storefront/` | `https://groundedrelay.pages.dev` |
| `groundedrelay-provider` | `sites/embed/` | `https://groundedrelay-provider.pages.dev` |
| `groundedrelay-merchant` | `sites/merchant-demo/` | `https://groundedrelay-merchant.pages.dev` |

All three projects publish static files. Do not add a Worker, Pages Function,
proxy, database, analytics call, model-key store, payment service, server-side
search, or external catalogue. The separate provider origin and two allowed host
origins are the cross-origin capability-lending and portability proof.

Every public and local run uses the GroundedRelay-owned fictional fixture. The
root page is the sole runtime, and URL parameters cannot select another provider
or data source. Both hosts pin the provider in `data-origin`.

## Release preconditions

Deployment mutates public state. Confirm the user requested a release. If
Wrangler requires interactive Cloudflare authorization, show the exact consent
action and obtain action-time approval before authorizing it. Never publish an
account identifier, access token, or local settings file.

Before any deployment:

1. Verify the checkout is the clean public repository above, on `main`, with
   `HEAD` equal to the refreshed `origin/main`.
2. Verify the intended commit contains only the final public tree and uses the
   intended GitHub noreply identity.
3. Run:

   ```bash
   npm run check
   npm run check:release -- --code-only
   git diff --check
   ```

4. Confirm Wrangler is authenticated to the intended account without copying
   identity details into source or reports.

The deployment script enforces the repository, branch, clean-tree, origin SHA,
test, release-gate, and exact-asset checks. Use the repository command rather
than hand-written deployment calls:

```bash
npm run deploy:cloudflare
```

The script creates any missing Pages projects and validates each canonical
Pages domain. It publishes the exact archived commit in this fail-closed order:

1. `groundedrelay` storefront;
2. `groundedrelay-provider` provider; and
3. `groundedrelay-merchant` portability host.

Keep this order. It places the fixture-only consumer in front of the historical
provider before changing provider data. Do not introduce another order without
an explicit, separately tested migration decision and coordinated changes to the
script, tests, and documentation.

## Trust wiring

- `sites/storefront/index.html` and `sites/merchant-demo/index.html` pin
  `https://groundedrelay-provider.pages.dev`.
- `sites/embed/embed.js` accepts an ancestor only when it is the exact storefront
  or portability origin, or an explicitly supported loopback development host.
- Every provider message is bound to exact origin, source window, protocol
  version, and per-page channel nonce.
- Both hosts require paired protocol-2 `ready` and GroundedRelay-owned fictional
  `state` attestations; a mismatch fails closed.
- Provider `frame-ancestors` is exactly `https://groundedrelay.pages.dev` and
  `https://groundedrelay-merchant.pages.dev` in production.
- Each host's `frame-src` pins the canonical provider.

Never weaken these controls to accept an arbitrary provider.

## Production verification

The deployment command must byte-check every tracked public asset before it
continues to the next origin. After it completes, run:

```bash
npm run check:release -- --online
```

Then verify the rendered storefront and portability host in the Codex in-app
browser. Direct search, comparison, basket changes, and the human handoff must
work without the WebMCP page API. In a WebMCP-enabled judge runtime, separately
verify all nine provider `wire__*` capabilities, clean action counts of 3, 5, 7,
8, or 9 as state changes, the scripted 3 to 7 to 8 to 9 path, exact variants,
RWF/KES/GHS separation, highlighted comparison evidence, approval, and veto.

Approval may reveal only reviewed links on
`https://groundedrelay-merchant.pages.dev`; it must never navigate or complete a
purchase automatically. A successful CLI deployment is not production proof.
Record the exact public commit, all three HTTP and header checks, rendered smoke
evidence, a direct native-runtime probe, and a separate model-selected prompt
run before calling the release ready.
