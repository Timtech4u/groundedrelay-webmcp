# GroundedRelay demo script and capture plan

Status: **rehearsal-ready, recording blocked by release gates**

Target runtime: **2 minutes 45 seconds**

Hard limit: **less than 3 minutes, including titles and credits**

The submitted product name is **GroundedRelay**.

The official rules require a public YouTube video with audio and allow judges
to evaluate the submission without opening the app. The video must therefore
show the customer outcome, the WebMCP proof, and the human-agent boundary on
screen. The submitted experience uses only GroundedRelay-owned fictional merchant
names, products, prices, and demo links. Retired private external-catalogue work must not
appear anywhere in the capture. Do not use copyrighted music.

## Before recording

- Use the exact submitted URL: <https://groundedrelay.pages.dev>.
- Use a WebMCP-enabled judge-compatible browser, preferably ChatGPT's in-app
  browser, and record the browser identity/version.
- Follow the [official Site Tools documentation](https://learn.chatgpt.com/docs/webmcp):
  update ChatGPT desktop to the latest version and run the final model-selected
  journey with **GPT-5.6 Sol or GPT-5.6 Terra**. Record the exact model. Do not
  use GPT-5.6 Luna for this proof because WebMCP is currently disabled there.
- Start from a fresh page with an empty basket and no stale comparison.
- Confirm the page visibly says **Fictional judge demo** and exposes exactly
  three GroundedRelay-owned demo catalogues. If any external catalogue appears, stop.
- Verify all three HTTPS origins, including provider discovery from both host
  pages, and the complete prompts below in a rehearsal immediately before
  capture.
- Close notifications and any tabs containing personal or private information.
- Record at 1080p or higher, with the browser at a readable 100% zoom.
- Use clear spoken narration. Do not add music, stock footage, sponsor logos,
  or third-party marks.
- Do not splice a fallback-mode run into a claim about native WebMCP. If an
  action fails, reset and record a fresh complete run.

## Exact native-agent prompts

**Prompt 1**

> Search `fictional` with Rwanda as the delivery destination. From that result
> set, inspect the Nyota Road Running Shoe and Asa Canvas Weekender. Compare
> merchant country, delivery countries, exact variant, availability, and
> currency, then highlight those rows. Do not add anything or quote prices.

**Prompt 2**

> Set the basket to exactly one Nyota Road Running Shoe in EU 40 and one Asa
> Canvas Weekender in Indigo. Keep the KES and GHS totals separate, then prepare
> the fictional handoff and wait for my decision. Do not open a link, attempt
> payment, or quote a total.

Both prompts must succeed in a fresh production rehearsal. If the agent cannot
reliably select the sequence, fix the product or tool descriptions; do not
replace the native journey with manual clicks while narrating it as agent work.

The deterministic fixture journey and rights-safe local direct API probe
exercised the search, inspection, comparison, highlight, two exact-variant
mutations, grouped totals, and fictional handoff. They returned Nyota EU 40 and
Asa Indigo with published Rwanda delivery and separate `KES` and `GHS` totals.
The prior local fixture direct probe passed 42/42; the older deployed pre-fixture
probe passed 32/32. Both invoked `document.modelContext`, `getTools`, and
`executeTool` directly. The prior local run covers the rights-safe fixture,
including exact variant binding, five grounded highlighted rows, viewport
visibility, both human decisions, and artifact validation. Neither result
proves that a language model will choose the full sequence, and the local run
does not cover the rights-safe production deployment. Rerun on the exact final
local tree and deployed SHA before recording.

The local probe also produced technical screenshots and a silent flow artifact.
They are engineering evidence only, not the required production S1–S8 set or a
public narrated YouTube demo.

## Timed storyboard

| Time | Screen | Narration |
| --- | --- | --- |
| 0:00–0:10 | GroundedRelay hero and public URL | “Shopping agents can answer, but can you inspect what they did and stop them before anything consequential happens? This is GroundedRelay.” |
| 0:10–0:27 | Open **How it works**; show provider origin and available actions | “A static provider on a different HTTPS origin lends typed WebMCP actions to this storefront. The browser mediates the boundary; there is no GroundedRelay backend or hidden search service.” |
| 0:27–0:40 | Show **Fictional judge demo**, three demo catalogues, and no product imagery | “Every public merchant, product, price, and link here is a GroundedRelay-owned fictional example.” |
| 0:40–1:10 | Send Prompt 1; keep tool activity and rendered results visible | “The agent works on the same page state I see and resolves exact available variants instead of guessing from product titles.” |
| 1:10–1:33 | Comparison renders; highlighted rows remain in frame | “The comparison is constrained to observed fixture fields. The agent can highlight known rows, but it cannot invent a free-form claim.” |
| 1:33–1:58 | Send Prompt 2; two basket groups and separate KES/GHS totals render | “Now it sets exact quantities in our shared, revisioned basket. The currencies stay separate, and a stale action cannot overwrite a newer human edit.” |
| 1:58–2:20 | Fictional approval sheet opens; pause on items, demo host, totals, and focused cancel | “The handoff is pending human review. The safe cancel choice receives focus first. These demo links cannot take payment or create an order.” |
| 2:20–2:30 | Click **No, cancel**; show basket retained and no new page | “I veto it. The in-flight action is rejected, no link opens, and my basket remains.” |
| 2:30–2:40 | Open `groundedrelay-merchant.pages.dev`; show its provider identity and fictional status | “The same provider powers a completely separate static shop. That is the reusable WebMCP kit, not a one-page trick.” |
| 2:40–2:45 | End on the human-control statement | “The agent helps. The person decides.” |

Do not narrate a price or total. Let the current live UI show it.

## YouTube copy

**Title:** GroundedRelay — cross-origin WebMCP shopping with a human veto

**Description:**

> GroundedRelay lets a person and an agent share catalogue search, grounded
> comparison evidence, exact basket state, and a human-gated merchant handoff.
> This OpenAI WebMCP Challenge demo runs across three static Cloudflare origins,
> with one provider reused by two independent hosts. The agent can prepare the
> next step, but it cannot navigate or purchase on its own. All public merchants,
> products, prices, and handoff links are
> GroundedRelay-owned fictional examples.
>
> Try it: https://groundedrelay.pages.dev
>
> Source: https://github.com/Timtech4u/groundedrelay-webmcp

Before uploading, recheck that the source URL opens signed out with a visible
MIT license.

**Thumbnail text:** Agent helps. You decide.

Use a frame from S4 or S6. Do not add sponsor logos, real merchant marks, or an
endorsement claim.

## Required screenshot and capture set

Capture lossless PNGs from the exact submitted production URL after the native
run passes. A screenshot is evidence only if its URL, state, and date are known.

| ID | Required frame | What it proves |
| --- | --- | --- |
| S1 | Hero with `groundedrelay.pages.dev`, fictional-demo status, and concise thesis | Coherent public product, submitted URL, and rights-safe mode |
| S2 | **How it works** with `groundedrelay-provider.pages.dev` and native action cards | Cross-origin WebMCP discovery and truthful current surface |
| S3 | Nyota EU 40 and Asa Indigo results, Rwanda delivery, KES/GHS | Exact variants and explicit demo metadata |
| S4 | Structured cross-currency comparison with highlighted rows | Grounded, inspectable agent evidence |
| S5 | Two basket groups with separate KES and GHS totals | Shared visible mutation without invented conversion |
| S6 | Fictional approval sheet with demo destination and **No, cancel** focused | Human control at the consequential boundary |
| S7 | Post-veto state with basket retained and no new page | Rejected in-flight handoff and recoverability |
| S8 | `groundedrelay-merchant.pages.dev` showing the same provider identity and fictional mode | One provider reused by a genuinely independent static host |
| S9 | Optional fallback-mode frame, clearly labelled | Graceful enhancement only; never substitute for native proof |

For every file, record: screenshot ID, UTC timestamp, production commit, app
URL, provider URL, merchant-demo URL, browser/runtime, model, prompt, and
confirmation that the page was in GroundedRelay-owned fictional mode. Never capture
email, Slack, Devpost account details, tokens, browser profiles, or private
correspondence.

## Audio and edit checklist

- Spoken audio is intelligible at normal volume and contains no private names.
- Cursor movement is deliberate; no frantic scrolling or terminal detours.
- The app remains full-screen enough for comparison rows and approval text to
  be legible on a laptop.
- The recording shows the native agent prompt and resulting page mutation in
  the same continuous sequence.
- Any cuts are simple dead-time removals and do not misrepresent causality.
- Captions are corrected manually for “WebMCP,” “GroundedRelay,” “Nyota,” “Asa,”
  “KES,” and “GHS.”
- Final duration is checked after YouTube processing and remains below 3:00.
- YouTube visibility is **Public**, not Unlisted, Private, or premiere-only.
- The public YouTube page is tested while signed out, with audio enabled.

## Capture record

Fill this only with verified evidence:

```text
Video file:
YouTube URL:
Final duration:
Audio checked by:
Recorded at (UTC):
Storefront URL:
Provider URL:
Merchant-demo URL:
Production commit:
Browser/runtime:
Model:
Direct native runtime result:
Model-selected prompt result:
Rights-safe fixture/version:
Screenshot directory:
```
