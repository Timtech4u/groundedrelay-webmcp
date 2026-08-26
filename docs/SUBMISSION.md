# GroundedRelay — Devpost submission copy

Status: **copy-ready, not submitted**

Last reviewed against the [official rules](https://webmcp.devpost.com/rules):
26 August 2026

Do not paste this into Devpost until every required gate in
[`SUBMISSION-CHECKLIST.md`](SUBMISSION-CHECKLIST.md) is green. In particular,
the live native WebMCP journey must be captured, the final rights-safe build
must be deployed, the clean public GroundedRelay repository must be published
and verified, and the public narrated YouTube video must exist.
The submitted experience uses only GroundedRelay-owned fictional merchants, products,
prices, and handoff links.

## Submission identity

**Project name:** GroundedRelay

**Tagline:** Shop with an agent, inspect its evidence, and keep the final say.

**One-sentence description:** GroundedRelay is a static, cross-origin WebMCP shopping
experience where a person and an agent share catalogue results, comparisons,
exact variants, basket state, and a human-gated merchant handoff.

**Audience:** Shoppers who want help working through current product choices
without surrendering control, and independent merchants that want an
agent-ready interface without replacing their storefront or checkout.

**Live app:** <https://groundedrelay.pages.dev>

**Target public repository (publication pending):**
<https://github.com/Timtech4u/groundedrelay-webmcp>

The clean final-only GroundedRelay tree still needs to be published, opened
signed out, and verified for visible MIT detection. The existing development
repository remains private and is not the submission repository.

A preliminary screen on 2026-08-26 checked exact web results, npm, PyPI,
GitHub repository names, and `.com`, `.dev`, `.app`, and `.io` DNS for
**GroundedRelay** and found no direct software or product match. This is not
legal advice or trademark clearance.

## Build timeline and challenge eligibility

GroundedRelay's source work began on 26 August 2026; the challenge build window
opened on 25 August. Its clean, final-only public repository must still be
created inside that window with no inherited private history, personal
metadata, local settings, or named merchant research. Judges must be able to
verify that public timestamp directly. The private development history is
retained for organizer review if requested, but it is not published because it
contains personal metadata and retired external-catalogue work.

`npm run check` now passes 96/96 total checks
(95 Node tests plus eval validation), with 8 eval cases and 9 tools. A temporary
clean-root export passes 35/35 publication checks; final repository publication
remains pending. GitHub Actions may be run manually as supplemental evidence,
but the required source proof is the deterministic and publication gates.

## Required question 1 — Why is this use case a strong fit for WebMCP?

Online shopping is a sequence of stateful decisions, not a single chat answer.
An agent needs to search the active catalogue, inspect exact variants, compare
only published facts, update the same basket the shopper can edit, and stop when
the decision becomes consequential. Screen automation has to guess at controls;
a detached chatbot cannot reliably see a human's latest change.

WebMCP gives GroundedRelay narrow, typed actions attached to the live page. The agent
acts on the same results, comparison, and basket the person sees. Read-only and
mutating operations are distinguishable, catalogue content is marked untrusted,
and the final handoff parks for explicit approval or veto. This is a strong fit
because WebMCP improves both capability and trust: the agent can do useful work
without taking the commercial decision away from the shopper.

## Required question 2 — How does it create a better user experience?

GroundedRelay turns agent work into visible interface state. Search results render as
product cards; comparisons use constrained catalogue fields; supporting rows
can be highlighted; exact variant availability is inspectable; and basket
changes appear immediately. The person can correct the basket directly, after
which the agent must read the new revision before changing it again.

The experience also fails honestly. Exact variants can be inspected before a
mutation, currencies use integer minor units and ISO codes, and KES, GHS, and
RWF totals are never combined. The public demo labels every catalogue, product,
price, and link as a GroundedRelay-owned fictional example. If the browser lacks the
WebMCP page API, the same search, comparison, basket, and handoff controls remain
usable. At handoff, GroundedRelay shows the reviewed items and destination host,
focuses the safe cancel choice first, and never navigates or pays automatically.

## Required question 3 — What can people and agents do together that was difficult or impossible before?

A shopper can express a goal while the agent performs the repetitive catalogue
work, then inspect and reshape the result without starting over. The agent can
find relevant products, resolve the exact available variant, place a shortlist
on screen, build a grounded comparison, highlight the evidence it relied on,
and set an exact basket quantity. The person can change that basket manually at
any time, and revision checks prevent an older agent action from overwriting the
newer human choice.

When asked to continue, the agent can prepare—but not complete—a handoff. In the
public fixture, the tool call remains pending while the shopper reviews the
exact fictional basket. A veto rejects the in-flight action and preserves the
basket; approval only reveals an explicit GroundedRelay-owned fictional link on
`groundedrelay-merchant.pages.dev`. The
collaboration is therefore recoverable and inspectable instead of being a choice
between doing everything manually and giving an autonomous agent unchecked
control.

## Required question 4 — How did you implement WebMCP?

GroundedRelay uses three static Cloudflare Pages origins: one provider reused by the
primary storefront and an independent merchant-demo host. Each host embeds the
separately deployed provider with `allow="tools"`. The provider registers
bounded WebMCP actions under collision-safe `wire__*` names; a host discovers
them with `getTools({ fromOrigins })` and hoists the useful, state-aware subset
under clean names for the page agent. The provider owns nine capabilities. The
host exposes three base actions, adds three when results exist, quantity-setting
with results or basket state, highlighting with comparison state, and handoff
with basket state. It can therefore show 3, 5, 7, 8, or 9 actions.
The scripted proof follows **3 with no active results → 7 with results → 8 with
comparison → 9 with basket**; it is a demo path, not the only valid branch.
Cross-origin proxy calls re-serialize arguments because the measured WebMCP
runtime accepts JSON text at `executeTool()` even though a registered action
receives a parsed object.

Every provider message verifies the allowed origin, source window, protocol
version, and a per-page channel nonce. Public HTTPS defaults to a GroundedRelay-owned
fictional fixture with three African demo catalogues and six products; public
query parameters cannot select another backend. The fixture is searched locally
and uses demo-only links on `groundedrelay-merchant.pages.dev`. The project has no
application server, proxy, analytics service, model key, or shared search index.
GroundedRelay carries exact variants, integer minor units and ISO currencies, uses
revision-safe basket mutations, and binds the approval sheet to an immutable
handoff ID and basket revision.

Representative registration pattern from
[`sites/embed/embed.js`](https://github.com/Timtech4u/groundedrelay-webmcp/blob/main/sites/embed/embed.js):

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

## Optional longer project description

Shopping agents are good at conversation. The harder problem is shared,
trustworthy state.

GroundedRelay lets a static provider on one origin lend shopping actions to a
storefront on another. A person and an agent work in the same visible search,
comparison, and basket. The agent does not return an invisible recommendation:
it can focus exact products, render a comparison from observed catalogue
fields, and highlight the rows supporting its choice.

The commerce details are deliberately strict. The public fixture has explicit
demo markets, delivery coverage, variants, availability, and three currencies.
Money uses integer minor units plus ISO currency, and unlike currencies are
never collapsed into an invented total. Search ranking happens in the browser.
Because the public catalogue and demonstration links are static GroundedRelay-owned
data, the submitted journey contacts no real merchant.

The final action is a handoff, not autonomous checkout. It pauses on a review
sheet bound to the current basket revision. The person can approve or veto; a
veto rejects the in-flight tool call and keeps the basket. Approval only reveals
the fictional demo destination on `groundedrelay-merchant.pages.dev`. GroundedRelay never
enters payment details, opens a link automatically, or claims an order was placed.

The result is a reusable WebMCP pattern for a more open agentic web: structured
capabilities can travel across an explicit origin boundary while evidence and
authority stay with the person using the page.

## Technologies

- WebMCP page API: `registerTool`, `getTools`, `executeTool`, and `toolchange`
- HTML, CSS, and modern browser JavaScript
- GroundedRelay-owned fictional catalogue fixture for the public judge experience
- Cloudflare Pages on three static HTTPS origins
- Node's built-in test runner
- Service worker with network-first shell updates

## Judge testing instructions

1. Open <https://groundedrelay.pages.dev> in ChatGPT's in-app browser or a supported
   Chrome build with WebMCP enabled.
2. Confirm that **How it works** identifies
   `https://groundedrelay-provider.pages.dev` as the cross-origin provider and shows
   the currently available actions.
3. Ask the agent to search `fictional` with Rwanda as the delivery destination.
   From that result set, inspect the Nyota Road Running Shoe and Asa Canvas
   Weekender, compare their merchant country, delivery coverage, exact variant,
   availability, and currency, then highlight those rows.
4. Ask it to set the basket to one Nyota shoe in EU 40 and one Asa weekender in
   Indigo, show the separate KES and GHS totals, then prepare the fictional
   handoff and wait.
5. Choose **No, cancel**. Confirm that no demo link opens and the basket remains.

The exact recording prompts and fallback-free capture sequence are in
[`docs/DEMO-SCRIPT.md`](https://github.com/Timtech4u/groundedrelay-webmcp/blob/main/docs/DEMO-SCRIPT.md).

## Evidence for the four equally weighted criteria

| Criterion | Proof to make visible |
| --- | --- |
| WebMCP Leverage | Cross-origin provider, typed actions, state-aware lifecycle, visible mutations, pending human handoff |
| Execution | Live HTTPS app, exact variants, market/currency correctness, graceful fallback, approve/veto behavior |
| Potential Impact | A concrete shopper journey that reduces catalogue work without centralizing checkout or removing human control |
| Creativity & Ambition | Reusable capability lending across origins, grounded on-page evidence, and revision-safe human-agent collaboration |

## Claim guardrails

- Call the public catalogues **GroundedRelay-owned fictional demos**, never real shops,
  partners, offers, availability, or endorsements.
- Approval reveals fictional demonstration links; it does not prove an order or
  payment.
- Keep private compatibility research out of public copy and submission media.
- Say **local catalogue ranking**, not “offline” or “nothing leaves the device.”
- Describe the provider's full capabilities separately from the smaller,
  state-aware subset visible at any given moment.
- Do not quote product prices in narration or prose; the live UI is authoritative.
