# GroundedRelay final submission checklist

Status: **NO-GO until every P0 gate is green**

Last reviewed against the [official rules](https://webmcp.devpost.com/rules):
26 August 2026

The Devpost rules list **3 September 2026 at 1:00 p.m. PDT** as the submission
deadline: **20:00 UTC / 22:00 Africa/Kigali**. The OpenAI landing page currently
shows a later time. Use the earlier Devpost deadline and an internal submit
cutoff of **11:00 a.m. PDT / 18:00 UTC / 20:00 Africa/Kigali**. Judges may rely
only on the text, images, and video, so those materials must stand on their own.

## Current go/no-go board

Do not change a status to PASS without recording evidence. Any P0 failure means
**do not submit**.

| Priority | Gate | Current state | Required evidence |
| --- | --- | --- | --- |
| P0 | Entrant registered and eligible | PASS — acceptance email reported | Saved acceptance email; entrant/team names match Devpost |
| P0 | Public source repository | **PENDING — target not created or synchronized** | Signed-out browser opens the final-only source and instructions |
| P0 | Detectable open-source license | **PENDING** | GitHub repository header/About visibly shows MIT while signed out |
| P0 | Rights-safe working live app, free during judging | **NOT DEPLOYED** | Signed-out production shows only the GroundedRelay-owned fictional fixture |
| P0 | Native WebMCP runtime on submitted URL | HISTORICAL LOCAL FIXTURE PROOF 42/42; **FINAL LOCAL AND PRODUCTION RERUNS REQUIRED** | Exact-deployed-commit capture of `modelContext`, discovery, execution, and UI |
| P0 | Model-selected public journey | **UNVERIFIED** | Latest ChatGPT desktop records the exact GPT-5.6 Sol or Terra model completing the demo sequence without manual substitution |
| P0 | Public data/name/image/video rights | TRACKED CANDIDATE PASS; **final review pending** | Owned fixture inventory plus terms/name review; no external merchant evidence in the submitted tree or media |
| P0 | Public YouTube demo with audio, under 3:00 | **MISSING** | Signed-out public YouTube URL, duration, audio and rights check |
| P0 | Four required description answers | PASS locally | Final copy from `docs/SUBMISSION.md` pasted and proofread in Devpost |
| P0 | Devpost submission completed before cutoff | NOT STARTED / unverified | Confirmation page and saved submission URL |
| P1 | Screenshots prove product and WebMCP | LOCAL TECHNICAL ARTIFACTS EXIST; **PRODUCTION S1–S8 MISSING** | Approved S1–S8 capture set from `docs/DEMO-SCRIPT.md` |
| P1 | Production matches source commit | **PENDING** | Deployment commit recorded and matched to public repository HEAD |
| P1 | Deterministic suite | **LOCAL PASS — 96/96 total checks: 95 Node tests plus eval validation; 8 evals, 9 tools** | Repeat and save `npm run check` output from the final clean public tree |
| P1 | Public-release source policy | **TEMPORARY CLEAN-ROOT PASS — 35/35; FINAL EXPORT RERUN PENDING** | Saved final-export result has 35 pass, 0 warning, 0 failure |
| P1 | GitHub Actions | **OPTIONAL / MANUAL** | If run, save the result as supplemental evidence; do not block submission on Actions when local deterministic and publication gates are green |
| P1 | Documentation/runtime action contract agrees | VERIFY FINAL | AGENTS, README, evals, runtime, activity count and submission copy use one truthful contract |

The target clean public repository is
<https://github.com/Timtech4u/groundedrelay-webmcp>. It has not yet been created,
synchronized, or verified. The development repository remains private because
its reachable history includes personal email metadata, local settings, and
named merchant research. Do not change its visibility. Every public update
must come from a clean rights-safe tree; an authenticated push by itself is not
public-access evidence.

The temporary clean-root export passes 35/35 publication checks. The current
private release gate is 33 pass and 3 fail before committing the staged
tracked-file deletion: two failures are the intentional private-history guards
and one is the not-yet-committed deletion. After that commit, two intentional
private-history failures remain; do not predict the private pass count until it
is rerun. Rerun the final clean GroundedRelay public export and record 35/35 rather than treating the
temporary export as final.

## P0 — eligibility, ownership, and rights

- [ ] Devpost project has exactly the intended entrant/team members.
- [ ] Each entrant meets age, residency, and supported-country requirements.
- [ ] No second submission violates the one-submission rule.
- [x] The submission says source work began on 26 August 2026, inside the
      25 August–3 September build window.
- [ ] Create the GroundedRelay public repository's first clean commit inside
      the build window and record its new public SHA. Do not cite private
      commit hashes.
- [ ] Retain the private development history for organizer review if requested;
      do not publish it or expose its personal metadata/private research.
- [ ] All submitted code, copy, screenshots, voice, and visual assets are owned
      or licensed for this use.
- [ ] Published GroundedRelay source uses the owned fixture with fictional merchant names,
      products, descriptions, variants, prices, and demo links; it includes no
      copied merchant imagery or customer data.
- [x] Exact web, npm, PyPI, GitHub repository-name, and
      `.com`/`.dev`/`.app`/`.io` DNS screens on 2026-08-26 found no direct
      **GroundedRelay** software or product match. This is only a preliminary
      collision screen, not a legal opinion or trademark clearance.
- [ ] Complete the final naming/terms review for **GroundedRelay**, **Kigali Pantry**,
      **Rift Runworks**, **Accra Carry Studio**, **Family Egg Tray**, **Weekend
      Egg Box**, **Nyota Road Running Shoe**, **Bonde Trail Running Shoe**,
      **Asa Canvas Weekender**, and **Cocoa Grid Carryall**.
      The source's “fictional” label is not by itself legal clearance.
      Formal trademark clearance is not claimed.
- [x] Merchant outreach is not part of the rights-safe submission and the user
      explicitly chose **do not send**. Do not send or imply permission.
- [ ] Production, Devpost, screenshots, video, and blog contain no real merchant
      name, mark, product, price, image, testimonial, or handoff URL.
- [ ] No claim says partner, integration, endorsement, “top merchant,” completed
      purchase, private search, or production proof without matching evidence.

## P0 — public repository and license

- [x] Keep the current development repository private. Do not rewrite it or
      change its visibility for submission.
- [ ] Export the final GroundedRelay tracked tree into a fresh directory without `.git`,
      `.local`, ignored research artifacts, `.claude/settings.local.json`,
      private correspondence, generated captures, or local machine paths.
- [ ] Confirm the export contains only the GroundedRelay-owned fictional fixture;
      it contains no named external merchant,
      domain, product, response, screenshot, or outreach record.
- [ ] Create `Timtech4u/groundedrelay-webmcp` as an empty remote without generated
      starter files. Only after the remote exists, update the export's
      `package.json` repository metadata to that URL.
- [ ] Initialize the export with one new challenge-period commit using the
      intended GitHub noreply author and committer email, then push it. Record
      the new public SHA only after verification.
- [ ] Rescan the synchronized public repository working tree and every reachable ref for
      secrets, personal email, local settings, private paths, credentials, and
      named external merchant evidence.
- [ ] Repository visibility is Public.
- [ ] Signed-out GitHub opens
      <https://github.com/Timtech4u/groundedrelay-webmcp> without a 404 or login.
- [ ] Repository About/homepage links to <https://groundedrelay.pages.dev>.
- [ ] GitHub detects **MIT** at the top of the repository page.
- [ ] `LICENSE`, source, static assets, deployment files, tests, and run
      instructions are all included.
- [ ] README in the published tree contains a recognizable real
      `document.modelContext.registerTool({ ... })` example and links to the
      exact implementation.
- [ ] README's clean local command works from a fresh clone. The production URL
      still requires the exact-SHA rights-safe deployment smoke.
- [ ] The synchronized public snapshot contains no secrets, tokens, private
      correspondence, personal details, or generated browser profiles in its
      repository or Git history.
- [ ] The final public `main` SHA equals the commit deployed to all three origins.
- [ ] AGENTS, README, implementation, evals, screenshots, and submission copy
      agree on action names, action count/capability language, and state-aware
      exposure. Do not publish a six-versus-nine contradiction.

## P0 — live production and native WebMCP

- [ ] `https://groundedrelay.pages.dev` opens signed out with no auth wall.
- [ ] The app can remain free and unrestricted through the end of judging on
      21 September 2026 at 5:00 p.m. Pacific Time.
- [ ] `https://groundedrelay-provider.pages.dev/embed` returns 200 and the intended
      `frame-ancestors` policy.
- [ ] `https://groundedrelay-merchant.pages.dev` opens signed out with no auth wall
      and identifies the same cross-origin provider.
- [ ] The storefront iframe is pinned to the provider origin; production ignores
      arbitrary query-string provider overrides.
- [ ] Public HTTPS and loopback root use `createRightsSafeBackend`; query
      overrides are ignored and cannot select another backend.
- [ ] The page visibly says **Fictional judge demo** and identifies all names,
      products, prices, and links as GroundedRelay-owned examples.
- [ ] Exactly three demo catalogues render: Kigali Pantry (`RWF`), Rift Runworks
      (`KES`), and Accra Carry Studio (`GHS`).
- [ ] ChatGPT's in-app browser or supported judge Chrome exposes
      `document.modelContext` on each host page and its provider frame.
- [ ] Provider actions register under `wire__*` and are discovered only from the
      allowed origin.
- [ ] The host exposes the clean, state-appropriate actions and the displayed
      count agrees with what the agent can call at each step.
- [ ] Branch coverage proves valid counts 3, 5, 7, 8, and 9. Treat
      3 with no active results → 7 with results → 8 with comparison → 9 with
      basket as the scripted demo path, not a universal lifecycle invariant.
- [ ] Search visibly uses the owned fixture and renders explicit demo market,
      delivery, variant, availability, and currency fields.
- [ ] Exact variant inspection, structured comparison, and evidence highlighting
      work in the native agent journey.
- [ ] Basket mutation uses the current revision and retries do not duplicate.
- [ ] Handoff parks with the safe veto focused; veto rejects and retains basket.
- [ ] A separately tested approval reveals only reviewed HTTPS fictional links
      on `groundedrelay-merchant.pages.dev` and never auto-navigates or claims
      payment/order completion.
- [ ] The no-WebMCP fallback remains usable but is never presented as native
      WebMCP proof.
- [ ] Browser console, network, visible UI, and service-worker refresh show no
      blocking error or stale release.
- [ ] Record direct runtime evidence separately from language-model evidence:
      the prior local fixture 42/42 and earlier deployed pre-fixture 32/32
      `modelContext/getTools/executeTool` runs did not test a model choosing the
      right actions; neither is evidence for the final production deployment.
- [ ] Run the exact prompts in [`DEMO-SCRIPT.md`](DEMO-SCRIPT.md) with the final
      supported model and record whether it completes the full sequence. Per
      the [official Site Tools documentation](https://learn.chatgpt.com/docs/webmcp),
      use the latest ChatGPT desktop app and record the exact **GPT-5.6 Sol** or
      **GPT-5.6 Terra** model. GPT-5.6 Luna currently has WebMCP disabled and
      cannot satisfy this gate.

## P0 — video

- [ ] Follow [`DEMO-SCRIPT.md`](DEMO-SCRIPT.md) with the exact production URL.
- [ ] Native WebMCP rehearsal passes immediately before recording.
- [ ] Video shows the prompt, native actions, visible page mutations, comparison
      evidence, basket change, pending approval, human veto, and retained basket.
- [ ] Spoken audio explains what was built and how WebMCP is used.
- [ ] No narration quotes a product price or stale total.
- [ ] No unapproved third-party trademark, image, screenshot, copyrighted music,
      private account, notification, token, or personal data appears.
- [ ] Final encoded duration is below 3:00; target is 2:45.
- [ ] YouTube visibility is **Public** and the page works signed out.
- [ ] YouTube processing has completed at readable HD quality.
- [ ] Captions are corrected and match the spoken claims.
- [ ] The final YouTube URL is pasted into Devpost and opened from the preview.

## P1 — screenshot/capture package

- [ ] S1 hero/live URL.
- [ ] S2 cross-origin provider and native action surface.
- [ ] S3 Nyota EU 40 and Asa Indigo with Rwanda delivery and KES/GHS.
- [ ] S4 structured comparison and highlighted evidence.
- [ ] S5 exact item and quantity in shared basket.
- [ ] S6 approval sheet and safe veto.
- [ ] S7 retained basket after veto.
- [ ] S8 independent `groundedrelay-merchant.pages.dev` host reusing the same provider.
- [ ] Every capture records timestamp, commit, URLs, browser/runtime, model,
      prompt, and rights status.
- [ ] Images are PNG, legible at Devpost width, and contain no private UI.
- [ ] Captions describe visible facts rather than architecture claims the image
      cannot prove.

## P0 — Devpost form

- [ ] Project name is **GroundedRelay** and product name never includes “Africa.”
- [ ] Tagline and all four required answers come from
      [`SUBMISSION.md`](SUBMISSION.md).
- [ ] Live URL is exactly <https://groundedrelay.pages.dev> with no query parameter.
- [ ] Repository URL is exactly
      <https://github.com/Timtech4u/groundedrelay-webmcp>, public, and license-visible.
- [ ] Public YouTube URL is present.
- [ ] Built-with tags accurately include WebMCP, JavaScript, and Cloudflare
      Pages.
- [ ] No credential is required; credential fields are left empty.
- [ ] Screenshots are ordered to tell problem → collaboration → evidence → veto.
- [ ] All links work from the Devpost preview while signed out.
- [ ] Grammar, captions, project category, team details, and contact email are
      checked.
- [ ] A final reviewer compares the form against the actual production behavior.

## Final freeze and submit

1. Stop feature work.
2. Run `npm run check`, `npm run check:release -- --code-only`, and
   `git diff --check` on the final development tree.
3. Export the clean final-only tree into the existing public repository, run its
   privacy/rights and every-ref scans, and verify a clean public worktree with
   `HEAD == origin/main`.
4. Deploy storefront → provider → merchant host from that exact public
   commit. Keep
   this documented order unless a separately tested migration deliberately
   updates the script, tests, and docs.
5. Repeat signed-out HTTP, rendered fallback, and native WebMCP smoke tests.
6. Record the final commit, deployment timestamp, browser/runtime, model, video
   URL, screenshot directory, and rights-safe review below.
7. Preview every Devpost field and link.
8. Submit before the internal cutoff; save the confirmation page and submission
   URL.
9. Do not materially edit the project during judging unless the rules or
   organizers explicitly allow it.

```text
Final decision: NO-GO / GO
Decision time (UTC):
Final git SHA:
Storefront deployment verified at:
Provider deployment verified at:
Merchant-demo deployment verified at:
Direct native WebMCP evidence:
Model-selected journey evidence:
Rights-safe source/name/terms review:
YouTube URL and duration:
Screenshot directory:
Public repository signed-out check:
Devpost preview reviewer:
Devpost submission confirmation:
```

## Decision rule

The submission is **GO** only when every P0 row is PASS with evidence. A strong
prototype with a private repository, failed rights review, absent public video,
or unverified final WebMCP journey is still a no-go under the official rules.
