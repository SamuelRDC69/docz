# Frontend Modernization v0.16.0: recon map + proposed phase packet

Produced 2026-06-24 by a deep recon Workflow (6 parallel subsystem readers over a read-only
`release/v0.16.0` checkout + a synthesis) feeding the `v016-restart-direction.md` decision. This
is the authoritative data the re-authored phase files are built from. It does not replace the
existing FB packet; it supersedes it for the v0.16.0 restart.

> AMENDED 2026-06-24 (post-recon, per user direction; then DEEP-REVIEWED + RESTRUCTURED the same
> day). The 16-phase table below is the original recon. `state.md` (the locked decisions + the
> 30-phase ledger, after the deep-review restructure split 18 -> 30 phases via sub-letter suffixes)
> is now the SOURCE OF TRUTH where they differ; this file is the LINE-NUMBER recon only. The
> deep review also corrected the stale line-refs in the original per-phase detail below (the slider
> `--range-fill`, the cast core in `src/render/`, the party selector in `src/ui/party_frames.ts`, the
> 8th FCT site `showSelfNote`, the 10-dash css_corpus markers, the orphan CSS band, the
> non-existent `EFFECTS_QUALITY_LOW_CUTOFF`); read the per-phase line-refs here against state.md's
> corrected "Key file paths". Open-decision 4 (the allocation-budget proxy) is pulled forward into
> P12a. The amendments: (1) P10/P11 build ONE parameterized `unit_frame` FAMILY core+painter
> reused across player/target/party (ready for focus/raid/boss) instead of bespoke per-frame cores;
> (2) P12's action bar is INSTANCE-PARAMETERIZED for multiple bars (the refactor builds one bar
> through the seam; adding bars is a follow-on feature); (3) NEW P15 Accessibility (WCAG 2.2 AA
> chrome + forced-colors + skip links + minimal print); (4) NEW P16 Standards codification into the
> CLAUDE.md files; (5) the old P15 close is renumbered P17 and gains the JS bundle-budget gate +
> selective cold-window lazy-load + cross-engine (mobile Safari/WebKit) E2E in CI. Cross-cutting
> contracts (a11y per window, no-magic-values-in-painters, dark-only + forced-colors, bundle
> discipline, the browser matrix) are global gates in `state.md`, inherited by every phase.

## Load-bearing structural findings (what drives the plan)

- **Per-frame entry point: `Hud.update()` at `src/ui/hud.ts:3627`** (called from `main.ts:2079`
  offline / `2171` online, each wrapped in `perf.time('hud', ...)`). It already has a software
  frame-rate divider (NOT the FPS governor): every-frame work, plus `fastHud` (>=100ms),
  `mediumHud` (>=250ms), `slowHud` (>=500ms) tiers. The class `Hud` is a single monolith at
  `hud.ts:693`.
- **Write-elision cache already exists** (`hud.ts:1322-1372`): `setText`/`setDisplay`/
  `setTransform`/`setWidth` consult `hotWriteCache`, and `perfStats()` exposes
  `hotDomWrites`/`hotDomSkippedWrites`/`hotDomSkipRate`. CRITICAL leaks to fix: the swing-timer
  block (`3800-3827`) and combo pips bypass the helpers with raw `querySelector`+style writes;
  `renderAuras`/`updatePartyFrames` use ad-hoc `__sig` caches instead. Routing these through the
  helpers is a perf WIN, which is why the per-frame extraction starts there (easy leak-fix ROI).
- **~14 per-element pure cores ALREADY exist on V16** and `hud.ts` imports them: `xpBarView`,
  `castBarState`, `absorbBarView`, `selectPartyFrameMembers` (party), `restView`, `low_health`,
  `low_resource`, `clock`, `compass`, `coords`, `quest_tracker`, `delve_map`, `raid_lockout_view`,
  `vendor_view`. So the per-frame work is mostly building the missing PAINTER halves, not the
  cores. Nameplate pure cores already live in `src/render`.
- **The perf harness exists**: `scripts/perf_tour.mjs` + the `hud` perf bucket + the live
  skip-rate counters. The per-frame phases gate against a recorded `perf_tour` baseline
  (frameP95, inputIntentToFrameP95, hudHotDomSkipRate).
- **The cold-window seam is partly demonstrated**: `renderVendor` (`hud.ts:8126`) ALREADY
  delegates to `vendor_window.ts`/`vendor_view.ts` (the Humble-Object template, including the
  sell-junk feature FB lacks). The other 10 classic windows are still inline.
- **What V16 already extracted** (17 modules): vendor_view/vendor_window, lockpick_panel/
  lockpick_window, delve_map, party_frames (selection only; frame HTML still inline), raid_lockout/
  raid_lockout_view, bag_filter, market_filters, plus helpers. PainterHost itself is ABSENT (FB's
  invention) and is re-introduced in P6.
- **Gates absent on V16 that FB invented** and must be re-added: `src/styles/` + Lightning flip,
  `ui_effects_profile.ts`, the `forbiddenUiCoreImport`/`UI_PURE_CORES` purity guard, the
  `cssCorpus`/`normalizeCss` completeness guard. `IWorld` is already extended (delve/lockpick/raid
  + paged `leaderboard()` is BASELINE here, the one painter consumes it in P9).

## Proposed packet: 16 phases, 4 layers

Layer ordering lands each architectural layer on a base the previous phase validated. Layers:
(1) gates + CSS + effects resolver + cold-window seam = P0-P9, (2) per-frame extraction =
P10-P13, (3) per-element graphics tiering = P14, (4) harness close = P15.

| ID | Title | Risk | Kind | Deps |
|---|---|---|---|---|
| P0 | Foundation gates: CSS-corpus + UI-purity guard + perf baseline | low | port+extend | - |
| P1 | CSS A: Lightning flip + tokens + base | low | port | P0 |
| P2 | CSS B1: in-world HUD chrome (nameplates, frames, bars, FCT, vignette) | medium | port | P1 |
| P3 | CSS B2: modal + feature windows | medium | port | P2 |
| P4 | CSS C: pre-game shell + mobile + per-entry .extra | medium | port | P3 |
| P5 | ui_effects_profile resolver + token applier | low | port+extend | P1,P2,P3 |
| P6 | PainterHost seam + pilot (vendor/lockpick/raid/delve) | low | port+extend | P0 |
| P7 | Cold-window batch 1: talents, social, bags | medium | port | P6 |
| P8 | Cold-window batch 2: options, market, char | medium | port | P6 |
| P9 | Cold-window batch 3: map, arena, questlog, leaderboard, spellbook | medium | port | P6 |
| P10 | Per-frame batch 1 (EASY): xp bar, swing timer, player frame | high* | port+extend | P0,P6 |
| P11 | Per-frame batch 2 (MEDIUM): cast bars, target frame, party frames | high* | port+extend | P10 |
| P12 | Per-frame batch 3 (HARD): action bar, auras pool, minimap markers | high* | port+extend | P11 |
| P13 | Per-frame batch 4 (HIGHEST RISK): FCT pool + per-frame driver | high* | new | P12 |
| P14 | Per-element graphics tiering + nameplate formalization | medium | port+extend | P5,P12,P13 |
| P15 | Harness re-author + perf assertion + packet close | low | port+extend | P9..P14 |

`*` P10-P13 are marked high context-risk by the synthesis itself: each is provisionally a batch
of ~3 elements and should be SPLIT into per-element sub-phases during execution if the working
set approaches the ~40% Opus-degradation ceiling. They are the phases to watch.

## Per-phase detail (the source for the phase files)

### P0 Foundation gates
GOAL: re-establish the verifiable gates the packet leans on, on a green v0.16.0, before moving
any code. SCOPE IN: (1) `tests/css_corpus.test.ts` (section-by-section completeness guard over
index/play inline `<style>`, keyed on `/* ---- name ---- */` comments); (2) the UI-purity guard
in `tests/architecture.test.ts` (parameterize the existing `walk()`/`stripComments()`/`IMPORT_RE`
into a `UI_PURE_CORES` allowlist rejecting three/`*_painter`/`painter_host`/DOM globals; seed with
the already-existing cores); (3) a `perf_tour` baseline (frameP95, inputIntentToFrameP95,
hudHotDomSkipRate) desktop+mobile recorded as the non-regression floor. OUT: any hud.ts/CSS edit.
ACCEPTANCE: `npm test` green incl both guards; purity guard FAILS on an injected `import
'./x_painter'`; baseline recorded.

### P1 CSS A: Lightning flip + tokens + base
Flip `vite.config.ts` to Lightning CSS, add `.browserslistrc` big-3 floor, declare the single
`@layer` order, extract `tokens.css` (index `:root` 186-269, KEEP JS-written custom props as
`:root` defaults: `--range-fill`/`--app-vw`/`--app-vh` + theme.ts `--color-*`) and `base.css`
(reset/scrollbar/@supports/forms 270-625). ACCEPTANCE: build resolves under `@layer`; biome clean
on new CSS; css_corpus accounts for tokens+base; theme.ts runtime overrides still apply;
backdrop-filter emitted -webkit-first (Lightning minify gotcha).

### P2 CSS B1: in-world HUD chrome
Extract index 626-1268 (minus windows) + FCT 2162 + Interface/Comfort/adaptive-effects/perf
overlay 2174-2302 + vignette/death 2416-2455 into `hud.css`. ACCEPTANCE: build green; biome clean;
css_corpus zero rule loss; in-world HUD visually unchanged.

### P3 CSS B2: modal + feature windows
Extract the windows block (centering 1301-1432; char/spellbook/questlog/leaderboard/talents
1432-1597; modals/dropdown 1598-1696; vendor/bags/social/map/arena/auction/options/emote +
delve board 1051-1084 + lockpick 1085-1168) into `layout.css` (centering/shells) + `components.css`
(feature windows). ACCEPTANCE: build green; biome clean; css_corpus covers every window section;
open-each-window smoke intact.

### P4 CSS C: shell + mobile + per-entry .extra
Extract index 2456-8274 (start screen, loading, login, backdrop, chat, party frames, context menu,
trade, controls drawer, mobile touch 5758-7027, char-select) into `shell.css` + `hud.mobile.css`,
then diff play.html and split the index-only (~976) / play-only (~60) deltas into
`index.extra.css`/`play.extra.css` (preserve-both-exactly). ACCEPTANCE: both inline `<style>`
blocks emptied; build green all 4 entries; css_corpus 100%; shell/mobile smoke unchanged.

### P5 ui_effects_profile resolver + applier
Port FB's `ui_effects_profile.ts` as the single governor-independent static-tier resolver
(presetLabel x effectsQuality x reduceMotion -> {fxLevel, tokens}), applied via a theme.ts-style
dumb applier setting `data-fx-level` + `--fx-*`; reconcile the existing `body.reduce-motion` toggle
so they do not fight; add `--fx-*` consumption to the extracted CSS (glass/glow/FCT-crit/vignette).
ACCEPTANCE: `tests/ui_effects_profile.test.ts` covers all tiers x reduce-motion x effectsQuality
incl the advanced-collapse decision; resolver provably reads `graphicsPresetLabel` and NOT the
governor (import-absence assert); reduce-motion + data-fx-level coexist.

### P6 PainterHost seam + cold-window pilot
Define `src/ui/painter_host.ts` (shared dep-bag: icon/money/tooltip helpers + the elided writers
Hud exposes). Migrate vendor_window (adopt V16's vendor AS-IS incl sell-junk), lockpick_window,
raid_lockout_view onto it; extract `delve_map_painter.ts` and dedupe the two inline delve call
sites (minimap 5034-5106 + world-map 5584-5645). ACCEPTANCE: tsc + tests green incl existing
window tests; new `delve_map_painter.test.ts`; sell-junk exercised; PainterHost consumed by >=2
windows.

### P7-P9 Cold-window extraction (10 inline windows -> *_view core + painter)
P7 (talents, social, bags), P8 (options, market, char), P9 (map, arena, questlog, leaderboard,
spellbook). Each window: a `*_view.ts` pure core (registered in the purity allowlist) + thin
painter via PainterHost; fan out one subagent per window. P9 includes the one IWorld painter fix:
`renderLeaderboard` consumes `leaderboard(): Promise<LeaderboardPage>`. ACCEPTANCE per batch: tsc +
tests green; new view-core tests; purity guard passes; specific behaviors preserved (talentStage
gating, social listeners not duplicated, bag filtering, options dispatch, char paperdoll, async
leaderboard paging, canvas windows); client_shell updated for moved DOM ids.

### P10 Per-frame batch 1 (EASY, leak-fix ROI): xp bar, swing timer, player frame
Lift the 3 lowest-risk hot elements into core+painter routed through the elision cache; FIX the
swing/xp leaks (cache `#swingbar` instead of per-frame `$()`, route writes through helpers). Reuse
`xpBarView`/`absorbBarView`; add `swing_timer.ts`/`player_frame.ts` cores. ACCEPTANCE: tsc + tests
green; core tests; purity guard; PERF GATE: perf_tour frameP95 <= baseline AND hudHotDomSkipRate >=
baseline (swing/xp now counted, so skip-rate should IMPROVE); a test asserts no raw style/textContent.

### P11 Per-frame batch 2 (MEDIUM): cast bars, target frame, party frames
Unify player+target cast bars on `castBarState` (add eat/drink to the core); `target_frame_view`
core + painter preserving the `lastPortraitTarget` portrait change-gate + combo-pip lazy-build;
complete the party-frames painter (selector already pure) with a keyed node pool replacing the
innerHTML-wipe + per-rebuild listener churn, hoisting the selector alloc AFTER the sig check.
ACCEPTANCE: tsc + tests green incl cast/party core tests; party painter does NOT duplicate
click/contextmenu (test); portrait redraws only on target change; PERF GATE: frameP95 <= baseline,
skip-rate >= baseline, no selector alloc before the sig short-circuit.

### P12 Per-frame batch 3 (HARD): action bar, auras pool, minimap markers
Action bar (3829-3931): core returns a REUSED preallocated per-slot state array; painter elides the
aria-label via a per-button cache keyed on the rendered `t()` string (KEEP the t() call, no concat/
fallback) + lastIcon + cdOverlay. Auras (4186-4245): replace `__sig`+innerHTML-wipe with a typed
keyed per-aura node pool, move the debuff allowlist into the core. Minimap (5022-5258): extract
`minimapMarkers(world,viewport)->Marker[]` pure core (friend/guild/party Set building off the hot
path, double-scan collapsed) + thin canvas painter keeping the 10Hz gate + cached bg. ACCEPTANCE:
tsc + tests green; pure-core tests; aria-label elision test (no per-frame setAttribute when
unchanged, t() still called); auras pool drops no tooltip/listener; PERF GATE: frameP95 <= baseline
+ a NEW allocation-budget assertion (action-bar + aura garbage measurably reduced) + skip-rate >=
baseline.

### P13 Per-frame batch 4 (HIGHEST RISK): FCT pool + per-frame driver
Replace the per-event `createElement`+`setTimeout` FCT (`fct()` 7258-7276 + 8 SimEvent spawn sites
6100-6422) with: a pure spawn-descriptor core (jitter INJECTED, Math.random stays on the painter,
allowed in UI) + a painter owning a fixed-size pooled-div ring that projects/positions each frame
via `renderer.worldToScreen`, recycles on TTL, caps max-concurrent. Introduce the per-frame FCT
driver (none exists today). ACCEPTANCE: tsc + tests green; `fct_core` test (pure, injected jitter);
purity guard on the core (not the painter); pool never exceeds the cap; PERF GATE: a scripted
AoE/boss burst shows bounded node count + frameP95 <= baseline (unbounded churn eliminated).

### P14 Per-element graphics tiering + nameplate formalization
Once every hot element is core+painter, drive each cost knob from the STATIC
`ui_effects_profile.fxLevel` (never the governor): FCT max-concurrent/lifetime/drop-non-crit,
minimap cadence per tier (10Hz..4Hz), aura visible-count/tick granularity, party/target non-self
cadence on low. ALSO formalize nameplates (`renderer.ts` updateNameplates 4413 -> `nameplate_view`
core + painter; convert the mobile-vs-desktop interval to a tier-driven interval). ACCEPTANCE: tsc
+ tests green; each knob is a pure function of fxLevel and NEVER reads `governor.state().levels`
(import-absence + behavioral test); the `ui` gfx bucket stays `governable:false`; PERF GATE: low
tier shows reduced HUD cost vs ultra with frameP95 <= baseline on every tier; ultra byte-equivalent
in HUD cost to pre-tiering.

### P15 Harness re-author + packet close
Update `client_shell.test.ts` where it greps `hud.ts` for DOM ids now living in painters; add a
standing `hud_perf_budget.test.ts` (write-elision/allocation budget); final UI-purity allowlist
sweep; update the ledger/CLAUDE.md. ACCEPTANCE: full `npm test` + `npm run build` (4 entries) +
`biome ci --changed` + perf_tour desktop+mobile within P0 thresholds; client_shell green.

## Reuse from FB

Port verbatim where it still fits: the `@layer` order + `src/styles` module shape (tokens/base/
layout/components/hud/hud.mobile + per-entry .extra) and the index.extra/play.extra
preserve-both-exactly split; the Lightning flip vite.config + `.browserslistrc`; the
cssCorpus/normalizeCss guard (P0); the UI-purity guard (P0); the `ui_effects_profile` resolver
contract + dumb applier (P5). Reuse AS-IS (already on V16, do NOT re-derive): the 14+ per-element
cores, the V16-extracted windows (vendor incl sell-junk, lockpick, raid_lockout_view), the
nameplate cores in src/render, the extended IWorld (paged leaderboard is BASELINE), the
hotWriteCache + elided writers + perfStats + perf_tour, the unit_portrait core+painter template.
NEEDS REWORK vs FB: the per-frame PAINTER halves (FB left the per-frame layer inline; P10-P13 are
net-new), the PainterHost dep-bag (re-introduced P6), per-element tiering + the FCT pool/driver
(new P13-P14), the standing per-frame perf-assertion test (new P15).

## Open decisions (recommendations to confirm)

1. **ui_effects_profile 'advanced' preset** (`graphicsPresetLabel` returns 5 labels, GfxTier has
   4): collapse advanced -> high, or honor the advanced `effectsQuality < 0.5` slider for a
   distinct HUD-fx level? Recommend HONORING effectsQuality so the advanced/expert path can shed
   HUD fx independently. (P5 must decide.)
2. **PainterHost shape**: one unified dep-bag the bespoke windows migrate ONTO (more churn, one
   seam), or a thin host that WRAPS their existing bespoke deps (VendorWindowDeps etc.)? Recommend
   the thin host that the bespoke bags compose into, minimizing risk to already-tested windows.
3. **FCT per-frame driver**: fold into `hud.update()` (shares the `hud` perf bucket) or give the
   FCT painter its own rAF (cleaner lifecycle, second loop to budget)? Recommend folding into
   `hud.update()` so the existing perf gate covers it.
4. **Allocation-budget assertion (P12)**: is there a Node-measurable proxy for per-frame garbage,
   or does the budget degrade to perf_tour frameP95/longtasks only? Needs a spike in P12.

## Top risks

1. **Per-frame write-elision regression**: `hotWriteCache` keys on the EXACT string written; any
   painter producing a non-byte-identical key, or writing `el.style`/`textContent` directly instead
   of through the host's elided writers, silently collapses the skip-rate and regresses frameP95.
   Mitigation: route ALL painter writes through PainterHost + a unit test rejecting raw writes +
   the skip-rate perf gate on every per-frame phase.
2. **FCT extraction (P13)**: the single highest-risk item; it INTRODUCES new infra (pool + rAF
   driver) where today it is event-driven createElement+setTimeout. Pool lifecycle/TTL/recycle
   errors drop or duplicate combat text; the AoE worst-case is the exact perf-gate scenario.
3. **innerHTML-wipe -> keyed-pool rewrites** (auras P12, party P11) can silently drop event
   listeners (party re-attaches click/contextmenu every rebuild) or tooltips (auras re-creates
   attachTooltip closures). The keyed pool must preserve/avoid-duplicate; tested explicitly.
4. **Action-bar aria-label (P12)**: written `setAttribute('aria-label', t(...))` every frame per
   slot, the per-frame allocator AND the i18n+a11y write CLAUDE.md flags. The painter must elide it
   (cache keyed on the rendered aria string) WITHOUT dropping the `t()` call or adding a concat/??
   fallback.
5. **Two-controller hazard (P5/P14)**: per-element tiering must read the STATIC
   `graphicsPresetLabel`, NEVER the governor (off on ultra, scales the wrong way on low; the `ui`
   gfx bucket is `governable:false`). Asserted by import-absence + behavioral tests.
6. **CSS cascade/rule-drop (P2-P4, ~8.1k deduped lines)**: reordering/dropping one rule changes the
   cascade silently. Mitigated by the cssCorpus section-by-section guard every CSS phase + the
   backdrop -webkit-first gotcha + keeping JS-written custom props in `:root`.
7. **Scope creep into sim/server/net**: presentation-only premise holds; the only IWorld
   interaction is consuming the already-landed paged leaderboard + delve/lockpick/raid in painters.
