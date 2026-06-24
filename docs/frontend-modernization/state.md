# Frontend Modernization v0.16.0: State (cross-phase cheat sheet)

The single reference every phase loads first. Holds locked decisions, the canonical workflow
blocks, the validation matrix, and the running ledger of what each phase adds. Update this at the
end of every phase (Step 6).

Branch: `feature/frontend-modernization-v016` (worktree `/Users/fernando/Documents/wocc-v0.16.0`),
branched off `origin/release/v0.16.0` (`e31eb05d`).
Current phase: PACKET AUTHORED + AMENDED + fidelity-reviewed + DEEP-REVIEWED-AND-RESTRUCTURED
(2026-06-24). A 23-reviewer + synthesis Workflow ground-truthed every phase against live source and
found the architecture sound and the ordering correct, but flagged: two BLOCKING spec errors (P5, P6),
a set of stale line-refs (P0/P1/P3/P4/P11/P13), the WCAG-2.2-AA + no-magic-values rows missing from the
cold-window and per-frame phases, and several cross-cutting gaps (ClientWorld-vs-Sim painter parity, a
responsive rendered-layout gate, the write-elision writer coverage gap, admin/guide CSS scope,
`user-scalable=no`). To retire the 40% context risk up front (user directive: "rather take longer and
get it perfect than degrade by context usage"), the 18-phase packet was RESTRUCTURED into 30 phases via
sub-letter splits (see the OLD->NEW map below). No code has moved. Awaiting the go to start P0. Docs are
untracked / on-branch pending the user's word.

## Provenance (read these once for the why)

This packet is a RESTART of the completed `feature/frontend-modernization` (FB) refactor onto the
much larger `release/v0.16.0`. The decision and its evidence:
- `feasibility-v0.16.0.md`: why we restart (Option B) instead of merging FB forward.
- `v016-restart-direction.md`: the expanded scope (per-frame extraction + per-element perf) and the
  process learnings (smaller phases for the 40% rule; perf-gated acceptance for hot-path work).
- `v016-recon-and-packet.md`: the deep line-number RECON of v0.16.0's frontend. It is the
  line-number source, NOT the authoritative plan: its 16-phase table is SUPERSEDED by the 30-phase
  ledger in THIS file wherever they differ. The phase files elaborate THIS state.md.

FB itself is a read-only SOURCE: ~70% of its artifacts port forward file-for-file (build config,
`src/styles/*.css` shape, the cold-window cores/painters V16 lacks, the pure cores, the guards).
"Restart" = re-run the extraction on the bigger base, reusing FB's files where they fit; it is NOT a
retype-from-scratch. CAUTION (from the deep review): several phase docs were written against FB source
and not fully re-grounded on V16, which is the root of the stale-ref cluster below; trust LIVE source
over an FB carryover whenever they disagree.

---

## OLD -> NEW phase map (the 18 -> 30 restructure, 2026-06-24)

Sub-letter suffixes only; kept-whole phases keep their id 1:1. Splits exist because each half plus its
mandatory QA pass plus in-session remediation of findings exceeds the ~40% Opus-degradation ceiling.

| Old id | New id(s) | Why split |
|---|---|---|
| P0 | P0 | kept whole |
| P1 | P1 | kept whole |
| P2 | P2 | kept whole |
| P3 | P3 | kept whole |
| P4 | P4a (shell) + P4b (mobile + per-entry .extra) | largest single CSS move + two-entry diff; mobile gotchas are a distinct risk set |
| P5 | P5 | kept whole (correctness rewrite, not a budget split) |
| P6 | P6 | kept whole (correctness rewrite, not a budget split) |
| P7 | P7a (talents) + P7b (social + bags) | talents is an interactive mutable-buffer window; +WCAG/+no-magic/+QA pushes the trio over 40% |
| P8 | P8a (options) + P8b (market + char) | options is ~1180 lines / 9 sub-panels; char carries a Three.js preview + a skin-event Math.random |
| P9 | P9a (canvas: map + arena) + P9b (DOM: questlog + spellbook + leaderboard) | canvas painters collide with no-magic-values; the async leaderboard is its own state machine |
| P10 | P10a (xp + swing leak-fix + the PainterHost elided-writer extension) + P10b (unit_frame FAMILY) | the load-bearing family + first perf gate + a11y + the writer extension is the full novelty load |
| P11 | P11a (cast bars) + P11b (target frame) + P11c (party keyed pool) | 2 BLOCKING core-design decisions serialize the slices; the party pool is a high-churn rewrite |
| P12 | P12a (action bar + the allocation-budget spike) + P12b (auras + minimap) | 3 named top-risks + the unresolved alloc spike + a heavy canvas no-magic-values surface |
| P13 | P13a (FCT core + driver wiring) + P13b (FCT pooled painter + migration + perf gate) | net-new infra; split at the unwired-painter boundary |
| P14 | P14a (per-element tier knobs) + P14b (nameplate_view extraction) | the nameplate extraction is a real Three/DOM-entangled extraction, not a thin add-on |
| P15 | P15a (shared a11y infra) + P15b (chrome-wide audit + axe/keyboard tooling) | 5 infra slices + 5 audit-and-FIX slices across ~17 windows + the tooling slice |
| P16 | P16 | kept whole |
| P17 | P17a (harness floor, test-only) + P17b (bundle + lazy-load + cross-engine + close) | the only behavior-affecting source change + 3 new CI gates + the first all-together perf run |

Execution order (the linear "Next:" chain): P0, P1, P2, P3, P4a, P4b, P5, P6, P7a, P7b, P8a, P8b, P9a,
P9b, P10a, P10b, P11a, P11b, P11c, P12a, P12b, P13a, P13b, P14a, P14b, P15a, P15b, P16, P17a, P17b, then
the packet's final QA.

---

## Locked decisions (record once, never re-litigate)

1. Vanilla HTML/CSS/TS. No Svelte/React/Tailwind/Lit/signals. One build-time dependency added:
   Lightning CSS (devDependency). The per-frame HUD stays framework-free.
2. This packet supersedes the FB packet for v0.16.0. It is the only frontend plan going forward.
3. The per-frame HUD stays framework-free with a hard perf gate; imperative DOM writes go through
   the existing write-elision cache (`hotWriteCache` + `setText`/`setDisplay`/`setTransform`/
   `setWidth`, `hud.ts:1322-1372`) reading `IWorld`. No reactivity, no Shadow DOM, no signals.
4. HUD cold-window extraction is PRESENTATION-ONLY: consume V16's already-extended `IWorld`; the
   only signature consumed that changed is `leaderboard(): Promise<LeaderboardPage>` (one painter,
   P9b). Do not extend `IWorld` or touch `src/sim`/`server`/`src/net`/`headless`. If a phase finds
   it needs to, STOP and surface it (scope change).
5. Per-frame extraction uses the same Humble Object pattern (pure core from `IWorld` + thin painter)
   but HOT path: the pure core is allocation-light (no per-frame garbage); the painter preserves
   write-elision (DOM write only on change, routed through the host's elided writers); every
   per-frame phase carries a frame-budget perf gate, not just tsc + tests.
   - 5a WRITE-ELISION WRITER COVERAGE (added by the deep review). The four existing elided writers
     (`setText`/`setDisplay`/`setTransform`/`setWidth`) cache one string per element and CANNOT
     express `setProperty('--var', v)`, `classList.toggle`, or `style.color` writes that the hot
     paths need (xp `--xp-fill`, `.rested`, target `style.color`, elite/channel/party class toggles).
     P6 exposes the four existing writers as the write-elision facet; P10a EXTENDS the facet with
     elided `setStyleProp(el, prop, val)` + `toggleClass(el, cls, on)` keyed per `(element, prop)`.
     Until that lands, the "all writes elided" rule and the "no raw style/textContent on the hot path"
     routing test are mutually unsatisfiable, so the routing test asserts only the writers that exist
     and documents any allowed raw write.
6. Graphics-tier UI is driven from the STATIC preset (`graphicsPresetLabel`), NEVER the FPS
   governor (two-controller hazard; the `ui` gfx bucket stays `governable:false`). `data-fx-level`
   + `--fx-*` are INTERNAL (no `t()`). The resolver module lives in `src/game/` (a render-importable
   leaf), NOT `src/ui/`, because `src/render/gfx.ts` imports the shared `EFFECTS_QUALITY_LOW_CUTOFF`
   from it and render must not import `ui` (see decision 8 and the P5 fix).
7. Encapsulation is a CSS problem: `@layer` + `#id`-prefix isolation (the `@scope` future-layer is
   deferred on the browser floor, as in FB). `src/styles/shell.css` is NEW in V16 (FB had no single
   `shell.css`; its shell rules were distributed); it gets a layer assignment in P1, not a port of a
   non-existent FB file.
8. The design decisions settled as defaults (revisit only at the named phase):
   - 'advanced' graphics preset -> HUD fx: HONOR its `effectsQuality` slider for a distinct HUD-fx
     level (not collapse to 'high'), so the expert path sheds HUD cost independently. (P5)
   - ui_effects_profile API is the FULL 5-axis FB contract (`tier` / `motion` / `heavyShadows` /
     `ambientAnim` / `allowFctCrit`) + `uiEffectsTokens` (with the 0.001-not-0 motion-scale floor) +
     `uiEffectsProfilesEqual` + `uiEffectsAllowFctCrit`, NOT the `{fxLevel, tokens}` shorthand. The
     resolver DEFINES `EFFECTS_QUALITY_LOW_CUTOFF = 0.5` and `gfx.ts:308` is refactored to import it
     (the constant does NOT exist in V16 today; `gfx.ts:308` is a bare `0.5`). (P5)
   - The resolver also reads `reducedMotion = OS matchMedia('(prefers-reduced-motion)') OR
     settings('reduceMotion')` with a change listener, debounces the `effectsQuality` apply ~180ms,
     and gates the apply on `uiEffectsProfilesEqual` so a no-op never re-stamps `data-fx-level`. (P5)
   - PainterHost: a THIN shared host the already-tested bespoke windows COMPOSE into, factored into
     TWO facets: a presentation dep-bag (icon/money/tooltip) for cold windows, and a write-elision
     facet (the four `private` Hud writers bound as closures, per the vendor template, no visibility
     change) for hot painters. The delve pilot proves the core-to-painter split + dep-bag, NOT the
     DOM write path (it is Canvas-2D); a tiny unit test exercises the elided writers against a fake
     cache. (P6)
   - FCT per-frame driver: fold into `hud.update()` so the existing `hud` perf bucket covers it,
     not a second rAF. (P13a)
   - Every tier knob reads the static preset, never `governor.state().levels`. (P5/P14a)
9. COMPONENT CONTRACT (every extracted component). Pure view-core (DOM/Three-free, Node-tested,
   allocation-light if hot) + thin write-elided painter + INSTANCE-PARAMETERIZED for reuse and
   multiplicity (no hardcoded element ids, no single-instance assumptions). Build reusable FAMILIES,
   not bespoke per-instance modules, on the rule of three: ONE `unit_frame` core+painter reused
   across player/target/party (ready for focus/raid/boss); the action bar instance-parameterized so
   a second/third bar is `new ActionBarPainter(barDescriptor)`. Actually ADDING the extra bars or
   raid frames is a follow-on FEATURE that inherits this seam, NOT part of this refactor. The
   `unit_frame` descriptor (P10b) MUST be validated against the FULL target/party field set, not a
   token stub, so P11a/b/c reuse it with no core change.
10. ACCESSIBILITY (WCAG 2.2 AA on the HUD CHROME). Windows, buttons, forms, menus, chat, tooltips:
    semantic roles + aria, focus management (trap + return on window open/close), visible
    `:focus-visible` never animated/blurred/transitioned away, skip links, live regions for chat +
    combat text, target-size minimums (SC 2.5.8, >=24px absolute floor; prefer the existing 40x40px
    touch floor on mobile controls, do NOT weaken it). The 3D world/canvas is OUT of scope (not
    screen-readable); state the boundary honestly. A11y is built IN per window/element phase (the
    WINDOW/CONTROL validation row is MANDATORY, not deferred to P15) and consolidated + audited in
    the dedicated Accessibility phases (P15a infra, P15b audit). Also drop the `user-scalable=no` /
    `maximum-scale=1.0` viewport lock (live at `index.html:5` and `play.html:5`); it fails SC 1.4.4 /
    1.4.10, and the 16px input-font floor is the anti-zoom guard. Keep that the only contrast
    adaptation: see decision 11.
11. THEMING. ONE dark MMORPG aesthetic (theme.ts runtime `--color-*` accent theming stays). NO
    light / `prefers-color-scheme` theme. DO support `forced-colors: active` (Windows high-contrast):
    borders/focus survive, meaning is never carried by a background-image alone.
12. NO MAGIC VALUES IN PAINTERS. DOM painters drive CSS custom properties / tokens, never a literal
    hex/px/color in TS; thresholds + cadences (the 100/250/500ms frame-divider, breakpoints, the
    combat-announce cadence) are named constants. A guard enforces it. CANVAS painters
    (map/arena/minimap/delve/nameplate) cannot read CSS vars directly: they resolve the `--color-*`
    tokens via `getComputedStyle` ONCE per redraw (cached), never per-marker/per-frame, and every
    other literal is a named constant.
13. BUNDLE DISCIPLINE. A JS bundle-budget CI gate (sibling to `asset:budget`). Measure the
    cold-window cost first (the eager module graph of the play entry via build chunk metadata), then
    SELECTIVELY lazy-load (dynamic import) only the genuinely heavy + rarely-opened cold windows
    (options/market/leaderboard are candidates) while keeping frequently-opened ones (bags/char)
    eager. Each lazy window's loading state carries an a11y contract (aria-busy/role=status +
    focus-return across the async swap). Evidence-driven, never blanket splitting. (P17b)
14. BROWSER MATRIX. Big-3 desktop PLUS mobile Safari/WebKit as a first-class target (the game is
    mobile-playable); a `forced-colors` pass; a MINIMAL `@media print` reset. Cross-engine E2E incl
    WebKit is wired into CI in the close phase (P17b), closing FB's open webkit-in-CI item.
15. CLIENTWORLD-vs-SIM PAINTER PARITY (added by the deep review). Every painter consumes `IWorld`,
    which BOTH the offline `Sim` and the online `ClientWorld` mirror satisfy, but the perf harness
    exercises only the offline `Sim`. A core that assumes a Sim-only field shape or cadence (target
    cast remaining, combo pips, party out-of-range, async leaderboard/market) passes every offline
    gate and silently misrenders online. Every `*_view` core test MUST feed BOTH a Sim-shaped and a
    ClientWorld-mirror-shaped `IWorld` stub.
16. RESPONSIVE IS GATED, NOT JUST PRESERVED (added by the deep review). The CSS extraction preserves
    rules verbatim, but `css_corpus` is CSS-TEXT completeness only and cannot catch a `dvh`->`100vh`
    swap, a dropped `safe-area-inset`, or a lost `@media` breakpoint. P0 records a mobile-layout
    baseline and P4a/P4b wire the EXISTING V16 mobile E2E scripts (`mobile_input_zoom_check`,
    `mobile_button_size`, `mobile_joystick_size`, `mobile_chat_safe_area`, `mobile_minimap_safe_area`,
    `mobile_community_hud_safe_area`) as a blocking RESPONSIVE row.
17. PERSISTENT-MONOLITH OUTCOME (owned, not a defect). `hud.ts` stays the per-frame wiring hub and
    cold-window dispatcher after the packet; the win is that every behavior now lives in a tested
    core + thin painter that `hud.ts` composes, not that `hud.ts` shrinks to nothing. Reviewers
    should not expect the file to disappear; the line count drops as inline blocks become painter
    calls, but the seam, not the size, is the deliverable.
18. ADMIN / GUIDE CSS SCOPE (decided by the deep review). The Lightning flip (P1) becomes the
    project-wide transformer and WILL reprocess `admin.html` (a 254-line inline `<style>`) and
    `guide.html` (a 1621-line `styles.css` with backdrop-filters). This packet's EXTRACTION scope is
    the game HUD (`index.html` + `play.html`) only; `admin.html`/`guide.html` keep their current CSS
    shape. The obligation P1/P4 carry is a SURVIVAL gate (their CSS still builds and their
    `backdrop-filter`s survive minification `-webkit`-first), not an extraction. `admin`/`guide` a11y
    beyond what they ship today is out of this packet's scope; state the boundary, do not silently
    claim "both inline blocks empty" for all entries.

## Non-negotiable constraints (carry every phase)

- Determinism: pure cores stay DOM/Three-free; no `Math.random`/`Date.now`/`performance.now` in any
  registered pure core. (The FCT painter MAY use `Math.random` for jitter; the FCT CORE may not. The
  char skin-event `Math.random` at `hud.ts:9596` stays on the painter, like FCT, or is out of P8b's
  core scope.)
- Server authority untouched; do not move any outcome to the client.
- i18n: every NEW player-visible string is a `t()` key; new control labels go in
  `src/ui/i18n.catalog/hud_chrome.ts` (English-only). Never edit `i18n.locales/<lang>.ts`. The
  action-bar aria-label elision (P12a) must keep the `t()` call (no concat / `??` fallback). New
  async-failure copy (leaderboard/market) and the cast eat/drink label resolve via `t()` in the
  PAINTER (the i18n-free `src/render/cast_bar.ts` core emits a discriminator, never a `t()` call).
- No generated-file hand-edits; regenerate via the build.
- Shared worktree: commit with EXPLICIT paths, never `git add -A`.
- No em dashes, en dashes, or emojis anywhere. NOTE the byte-for-byte CSS-move phases (P2/P3/P4):
  the no-dash rule applies to NEW text only; relocating an existing comment that already contains a
  dash is allowed, and where a moved comment's dash is gratuitous it may be normalized (comments
  only, never a selector/value).

---

## Canonical workflow (every implementation phase follows this)

Every phase runs on Opus 4.8, xhigh effort. Batch-heavy phases (CSS B1/B2/C; cold-window batches;
the per-frame batches) use `ultracode` + a Workflow (parallel fan-out + adversarial verify).

- STEP 0 Pre-flight: `git status` clean (ask the user if not; concurrent session may share the
  checkout). Memory scan (MEMORY.md + the entries the phase lists). Confirm you are in the
  `feature/frontend-modernization-v016` worktree.
- STEP 1 Load context (do NOT read `hud.ts` (14,377 lines) or the HTML entries whole): spawn an
  Explore agent to read+summarize this `state.md`, the phase's `progress.md` row, the phase file,
  `v016-recon-and-packet.md` (the line numbers), and the specific source ranges the phase lists.
  The orchestrator keeps the summary, not raw dumps. THE 40% RULE: the packet is already pre-split so
  each phase fits well under ~40% context INCLUDING its mandatory QA pass plus in-session remediation
  of every BLOCKING/SHOULD-FIX/NICE-TO-HAVE finding (that remediation load is why the splits exist).
  If a phase's working set STILL approaches the ceiling, split again rather than degrade.
- STEP 2 Choose orchestration + execute: pick the lightest tool. Default to parallel Agent/Workflow
  fan-out, one slice per window/element. Use `isolation: "worktree"` only if agents edit
  overlapping files. Request fan-out EXPLICITLY.
- STEP 3 Validation + review dispatch: run the validation-matrix rows for the change type. Spawn
  review agents only for the surface the diff touches (Review Dispatch Matrix). Prompt each for
  COVERAGE not filtering; do not commit until each reports no BLOCKING. Resume a truncated reviewer
  with: "Stop reading more files. Output the full report now based on what you've already seen. No
  more tool calls. Format: BLOCKING / SHOULD-FIX / NICE-TO-HAVE / VERDICT."
- STEP 4 Commit cadence: 2-5 Conventional Commits with a scope, EXPLICIT paths.
- STEP 5 Acceptance: the phase file's checklist, all items verifiable and green (incl the perf gate
  for per-frame phases). A failed perf gate BLOCKS marking the phase complete (decision 5 / risk 1).
- STEP 6 Docs + memory: update `progress.md` and this `state.md` (new files, tokens, decisions).
  Record surprising rules in memory. Per-frame phases TAG the green-perf-gate commit so a later
  cumulative regression (surfaced first at P17a) bisects to a phase, not to "relax the budget."
- STEP 7 Final response: status, files, validation results, reviewer verdict, deferrals, and the
  one-line handoff naming the next phase file (per the execution order above).

Each implementation phase is followed by a QA pass using `qa-checklist.md` (the shared QA starter:
correctness + test-coverage + dead-code agents, then the dispatch matrix, then fix BLOCKING/
SHOULD-FIX, then update docs). Never skip QA; end each phase by naming the next.

---

## Validation matrix (run the rows that match the change type)

- Baseline (every phase): `npx tsc --noEmit`.
- Pure core added/changed: `npx vitest run tests/<core>.test.ts` + `npx vitest run
  tests/architecture.test.ts` (the UI-purity guard) + a same-input-same-output assertion + the
  ClientWorld-vs-Sim parity assertion (decision 15: drive the core with BOTH a Sim-shaped and a
  ClientWorld-mirror-shaped `IWorld` stub).
- New `.ts` module added (every phase that adds a core/painter): `biome check` on the new/changed
  `.ts` (the V16 ratchet; do not let ~30 new modules accrue lint debt for the close session).
- CSS / HTML entry changed: `npx vitest run tests/css_corpus.test.ts` (the completeness guard, keyed
  on the LIVE 10-dash `/* ---------- name ---------- */` markers, over inline `<style>` UNION
  `src/styles/*.css` so coverage is conserved as P1-P4 migrate) + `npx vitest run
  tests/client_shell.test.ts` + `npm run build` (all 4 entries) + the backdrop-filter survival check
  (built CSS, `-webkit`-first; meaningful from P2 on, a no-op in P1) + `biome check` on the new `.css`
  + a screenshot-diff against the P0 visual baseline for any phase that risks a cascade change.
- RESPONSIVE / mobile changed (P4a/P4b, P15b): run the V16 mobile E2E scripts as a blocking row
  (decision 16: `mobile_input_zoom_check`, `mobile_button_size`, `mobile_joystick_size`,
  `mobile_chat_safe_area`, `mobile_minimap_safe_area`, `mobile_community_hud_safe_area`); a
  real-CDP mobile-inset check, not a CSS-text assertion.
- PER-FRAME phase (P10a-P14b): `npm run` the perf_tour harness and assert frameP95 <= the P0 baseline
  AND hudHotDomSkipRate >= the P0 baseline; for P12a/P12b, the allocation-budget assertion (the proxy
  the P12a spike settles, fallback = perf_tour frameP95 + longtasks); for P13b, the bounded-node-count
  AoE-burst assertion. A unit test that the painter routes ALL writes through the host's elided
  writers that EXIST (decision 5a; no raw `style`/`textContent`/`setAttribute` beyond a documented
  allowed write). CANVAS painters (P9a, P12b minimap, P14b nameplate) are gated on cadence + cached
  background + frameP95, NOT the elided-writer routing test (decision 12).
- WINDOW or CONTROL changed (MANDATORY on every cold-window + per-frame + chrome phase, decision 10):
  the WCAG 2.2 AA chrome checks (automated axe-core or equivalent over the built window; keyboard
  reachability + focus-return; a `forced-colors: active` snapshot; visible `:focus-visible`;
  target-size >=24px, and >=40x40 on mobile touch controls). Plus the no-magic-values painter guard
  (decision 12; DOM painters reference tokens/vars; canvas painters resolve tokens once per redraw).
  The full cross-window a11y audit (skip links, global focus management, live regions) runs in
  P15a/P15b; the PER-WINDOW roles/aria/labels/target-size are NOT deferred there.
- BUNDLE changed (P17b): the JS bundle-budget gate; for any window switched to a dynamic import, the
  initial bundle (the eager module graph of the play entry) shrinks by its measured cost and the
  window still opens (with an a11y-correct loading state) on first use.
- Player text changed: `npx vitest run tests/localization_fixes.test.ts`. New label in
  `hud_chrome.ts` (English-only) does not trip the release tier.
- Pre-merge / CI mirror: `npm run i18n:gen && npm test && npx tsc --noEmit && npm run build:env &&
  npm run build:server && npm run build`, then the i18n freshness check; on `release/**` the
  release-tier gate (`I18N_RELEASE_TIER=1`) pending=0; and `biome ci --changed` (the forward
  ratchet that lints the new files).

## Review Dispatch Matrix (spawn ONLY the rows the diff touches)

- `privacy-security-review`: only if the diff touches `server/`, `src/admin/`, `src/net/`, a
  deploy/secret file, or introduces SQL/auth/secret/new `Math.random`|`Date.now`|`performance.now`
  in `src/sim/` or a pure core. Should rarely fire (presentation-only).
- `migration-safety`: only if `server/*_db.ts` DDL or `characters.state` JSONB changed. Never here.
- `cross-platform-sync`: only if `src/world_api.ts` (IWorld), `src/sim/`, `src/net/online.ts`,
  `server/game.ts` wire/dispatch, or the i18n matchers changed. Consuming the already-landed IWorld
  in a painter does NOT change it; this should not fire. (The ClientWorld-vs-Sim parity obligation,
  decision 15, is covered by the per-core parity test, not by spawning this reviewer.)
- `qa-checklist`: every phase that completes a deliverable set (the default reviewer).

If no row matches (docs/test-only), spawn no review agent.

---

## Phase ledger (30 phases; fill in as phases complete)

Full per-phase scope/acceptance is in the `phase-NN-*.md` files; line numbers in
`v016-recon-and-packet.md` (the recon, superseded where it differs from this ledger).

| Phase | Title | Risk | Kind | Status |
|---|---|---|---|---|
| P0 | Foundation gates: CSS-corpus + UI-purity guard + perf/visual/mobile baseline | low | port+extend | pending |
| P1 | CSS A: Lightning flip + tokens + base + the CSS-import seam | low | port | pending |
| P2 | CSS B1: in-world HUD chrome (full section map incl Fiesta HUD + tooltip) | medium | port | pending |
| P3 | CSS B2: modal + feature windows (arena/market/options/theme/emote ranges fixed) | medium | port | pending |
| P4a | CSS C-1: pre-game shell + char-select -> shell.css | medium | port | pending |
| P4b | CSS C-2: mobile-touch -> hud.mobile.css + per-entry .extra; empty both inline blocks | medium | port | pending |
| P5 | ui_effects_profile resolver (src/game, 5-axis, defines the cutoff) + applier | medium | port+extend | pending |
| P6 | PainterHost (two facets) seam + cold-window pilot | medium | port+extend | pending |
| P7a | Cold-window: talents (interactive, mutable edit buffer) | medium | port | pending |
| P7b | Cold-window: social + bags | medium | port | pending |
| P8a | Cold-window: options (~1180 lines / 9 sub-panels, full dispatch matrix) | medium | port | pending |
| P8b | Cold-window: market + char (skin-event Math.random stays on painter; 3D preview scoped) | medium | port | pending |
| P9a | Cold-window canvas pair: map + arena (preserve mediumHud call site + cadence) | medium | port | pending |
| P9b | Cold-window DOM trio: questlog + spellbook + leaderboard (the one IWorld-consume) | medium | port | pending |
| P10a | Per-frame: xp + swing leak-fix + the PainterHost elided-writer extension | high | port+extend | pending |
| P10b | Per-frame: unit_frame FAMILY core+painter (player first instance) | high | port+extend | pending |
| P11a | Per-frame: cast bars (eat/drink discriminator, i18n-free core) | high | port+extend | pending |
| P11b | Per-frame: target frame (unit_frame instance) | high | port+extend | pending |
| P11c | Per-frame: party frames (innerHTML-wipe -> keyed pool) | high | port+extend | pending |
| P12a | Per-frame: action bar (multi-bar descriptor) + the allocation-budget spike | high | port+extend | pending |
| P12b | Per-frame: auras keyed pool + minimap markers (canvas) | high | port+extend | pending |
| P13a | Per-frame: FCT core + per-frame driver (folded into hud.update) | high | new | pending |
| P13b | Per-frame: FCT pooled painter + spawn-site migration + bounded-AoE gate | high | new | pending |
| P14a | Per-element graphics tiering (tier knobs read the static preset) | medium | port+extend | pending |
| P14b | Nameplate extraction: nameplate_view core + painter + tier-driven interval | medium | port+extend | pending |
| P15a | Accessibility infra: focus manager + skip links + live regions + forced-colors + print | medium | new | pending |
| P15b | Accessibility audit: chrome-wide axe + keyboard E2E + per-window fixes | medium | new | pending |
| P16 | Standards codification into CLAUDE.md (component/token/a11y/perf/browser/bundle) | low | new | pending |
| P17a | Harness floor (test-only): client_shell re-author + standing perf budget + purity sweep + first all-together perf run | low | port+extend | pending |
| P17b | Bundle-budget gate + selective lazy-load + cross-engine E2E + axe CI + packet close | low | port+extend | pending |

### New `IWorld` members / `SimEvent`s / wire fields / endpoints / DB tables
None. This packet adds none. It CONSUMES V16's already-landed IWorld (delve/lockpick/raid + the
paged `leaderboard()`); the only change vs FB is one painter consuming the paged leaderboard (P9b).

### New i18n keys
None expected beyond English-only `hud_chrome.ts` control labels: a unit-frame group aria-name (P10b),
the cast eat/drink label resolved in the painter (P11a), skip-link + live-region-prefix labels (P15a),
async-failure copy for leaderboard/market (P9b/P8b), and a lazy-window loading label (P17b).

### Key file paths (V16 line numbers from the recon; the deep-review corrections are inline)
- Per-frame entry: `Hud.update()` at `src/ui/hud.ts:3627` (frame-divider: every-frame +
  fast >=100ms + medium >=250ms + slow >=500ms). Write-elision: `hud.ts:1322-1372` (the four writers
  are `private` on `Hud`; P6 binds them as closures) + `perfStats()`.
- Hot elements: player frame 3656-3667, buff bar 3670 (renderAuras 4186-4245), target frame
  3672-3749 (lastPortraitTarget gate 3692-3708, combo pips), player cast bar 3752-3798, swing timer
  3800-3827 (the `#swingbar` per-frame `$()` + raw style LEAK), action bar 3829-3931 (per-frame
  aria-label via t()), xp bar 3933-3952; minimap 5022-5258 (3-branch canvas: delve schematic / NPC
  glyphs / proximity-scaled party discs+arrows; Sets already built once per 10Hz call, NOT a
  double-scan to collapse); party frames CALL SITE 11508-11562 (the pure selector lives in
  `src/ui/party_frames.ts`, NOT inline at 11520); FCT `fct()` 7258-7276 + 7 SimEvent spawn sites in
  6100-6422 PLUS `showSelfNote` (7255, caller at `main.ts:1727`) = the 8th site; `getUiScale`
  (`hud.ts:288`/7270) is load-bearing for FCT positioning under zoom; nameplates `renderer.ts`
  updateNameplates 4413 (mobile interval at renderer.ts:4113, 1/15 vs 1/24).
- Cold windows (inline unless noted): renderVendor 8126 (ALREADY delegates to vendor_window),
  renderMarket 8343, renderBags 8839, renderChar 9116 (skin-event Math.random 9596; Three.js preview),
  renderLeaderboard 10673 (async), renderSpellbook 10766, renderTalents 10909 (mutable `talentStage`
  edit buffer, NOT IWorld-derived), renderQuestLog 11398, renderSocial 12025 (repaints on the 500ms
  slowHud divider with listener churn), renderOptions 12783 (~1180 lines, 9 sub-panels behind a
  9-member OptionsHooks), updateMapWindow 5561 + renderArenaWindow 5300 (BOTH called from
  `hud.update()`'s mediumHud band, NOT purely cold).
- Existing pure cores to REUSE: `xp_bar`, `cast_bar` (in `src/render/cast_bar.ts`, i18n-free),
  `absorb_bar`, `party_frames` (selector, `src/ui/party_frames.ts`), `rest_indicator`, `low_health`,
  `low_resource`, `clock`, `compass`, `coords`, `quest_tracker`, `delve_map`, `raid_lockout_view`,
  `vendor_view`. Nameplate `src/render` has only narrow helpers (`nameplate_combo`/`_projection`/
  `_threat`); a real `nameplate_view` core is NEW (P14b).
- Build: `vite.config.ts` (Lightning flip in P1; reconcile the now-dead `css.postcss` Tailwind-defeat
  at 134-139; derive Lightning targets via `browserslistToTargets`), `package.json`, `.browserslistrc`
  (new P1), `biome.json`, `tsconfig.json`. V16 has NO existing CSS-import seam (unlike FB): P1 defines
  it (a barrel imported once from the game entries' TS) and which entries load it. CSS (new):
  `src/styles/{tokens,base,layout,components,hud,hud.mobile,shell,index.extra,play.extra}.css`.
  Entries: `index.html`, `play.html` (extracted), `admin.html`, `guide.html` (survival-only, decision 18).
  `--range-fill` is NOT a `:root` token: it is the inline `var(--range-fill, 0%)` fallback on the
  slider track at `index.html:356`, written per-element at `hud.ts:12899`; it rides into `base.css`
  inside the slider rule, do NOT promote it to `:root`.
- Tier: `src/render/gfx.ts` (`graphicsPresetLabel` at 245, 5 labels; `GFX_BUCKET_BANDS`; the `ui`
  band `governable:false`; `gfx.ts:308` bare `0.5` -> import `EFFECTS_QUALITY_LOW_CUTOFF`),
  `src/game/settings.ts`, `src/game/ui_effects_profile.ts` (new P5, render-importable),
  `src/ui/theme.ts` (applier shape).
- Focus a11y (P15a): the ad-hoc helpers `hud.ts:2570-2604` (canRestoreFocusTo / currentFocusableElement
  / restoreFocus / focusFirstInteractive, canonical focusable selector at 2598). The full restoreFocus /
  focusFirstInteractive / dropdown-focus-return caller set is ~15 sites (grep the FULL set; the 6 listed
  in the draft were incomplete), plus the `src/guide/chrome.ts:85` skip-link precedent to reuse.
- Guards: `tests/client_shell.test.ts`, `tests/architecture.test.ts`, `tests/css_corpus.test.ts`
  (new, 10-dash markers), `tests/hud_perf_budget.test.ts` (new, STANDING in P17a),
  `scripts/perf_tour.mjs`, `scripts/*_shot.mjs` (visual baseline), the V16 `mobile_*` E2E scripts,
  `vitest.browser.config.ts` (opt-in axe/keyboard, P15b; cross-engine CI on in P17b).

## Top risks
1. Per-frame write-elision regression (non-byte-identical cache keys / raw writes silently collapse
   the skip-rate). Mitigation: the PainterHost elided-writer facet + the writer EXTENSION (decision 5a)
   + a unit test rejecting raw writes + the skip-rate perf gate every per-frame phase. A failed gate
   blocks completion and bisects to the offending phase (the first all-together run is P17a).
2. FCT extraction (P13a/P13b): net-new pool + per-frame driver; pool lifecycle errors drop/duplicate
   text; AoE worst-case is the perf-gate scenario; `getUiScale` positioning + the 6 hex->class-token
   migration + the `showSelfNote`/`main.ts:1727` precondition are easy to miss. Isolated last.
3. innerHTML-wipe -> keyed-pool rewrites (auras P12b, party P11c) silently dropping listeners/tooltips;
   the tooltip closure must read a live MUTABLE slot record, not capture-by-value (stale after recycle).
4. Action-bar aria-label (P12a): per-frame i18n+a11y+allocation triple-hazard; elide WITHOUT dropping
   `t()` or adding a fallback.
5. Two-controller hazard (P5/P14a): tier knobs read the static preset, never the governor.
6. CSS cascade/rule-drop (P2-P4b): mitigated by the css_corpus section-by-section guard every CSS
   phase + the backdrop -webkit-first gotcha + JS-written custom props kept in `:root` + a
   screenshot-diff against the P0 visual baseline. Watch the orphan band (arena 1846, market 1900,
   options 1973, theme 2040, emote 2108, Fiesta HUD 2303) that the draft P2/P3/P4 ranges skipped.
7. Canvas painters vs no-magic-values (P9a, P12b, P14b): a 2D context cannot read CSS vars; resolve
   tokens via `getComputedStyle` once per redraw (decision 12), do not weaken the guard.
8. ClientWorld-vs-Sim drift (decision 15): an offline-only-shape assumption ships broken online; the
   per-core parity test is the mitigation.
9. Spec-vs-live drift in the phase docs (the FB-carryover root cause): the deep review corrected the
   known set; if a phase finds a NEW stale ref, trust live source and surface it.
10. Scope creep into sim/server/net: the only IWorld interaction is consuming V16's landed members.
