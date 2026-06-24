# Frontend Modernization v0.16.0: QA

Two parts: (1) the per-phase QA starter every implementation phase runs immediately after it, and
(2) the whole-feature integration checklist verified once at packet completion (the P17b QA, the
packet's final QA). This is a
client-presentation packet: sim/server/net/headless are untouched, so the parity/persistence rows
are "confirm no drift," not "exercise new behavior." The NEW surface vs FB is the per-frame layer
and per-element tiering, which add real PERF rows.

## Part 1: per-phase QA starter (run after every implementation phase)

1. Spawn a coverage Workflow (or parallel agents): a correctness agent, a test-coverage agent, and
   a dead-code agent over the phase diff. Prompt each for COVERAGE not filtering.
2. Run the validation-matrix rows for the phase's change type (state.md). For per-frame phases this
   MUST include the perf gate (below).
3. Spawn the Review Dispatch Matrix rows the diff touches (qa-checklist by default).
4. Fix every BLOCKING and SHOULD-FIX (fold into the phase, separate commits). Adversarially verify
   any consequential finding before acting.
5. Update progress.md + state.md; record surprising rules in memory. Name the next phase.

PER-FRAME PERF GATE (P10a-P14b QA): re-run the perf_tour harness desktop+mobile and assert
frameP95 <= the P0 baseline AND hudHotDomSkipRate >= the P0 baseline; assert the painter routes all
writes through the host's elided writers that EXIST (no raw `style`/`textContent`/`setAttribute`
beyond a documented allowed write; canvas painters are gated on cadence + cached background +
frameP95, not the routing test); P12a/P12b also assert the allocation budget; P13b asserts bounded
node count under a scripted AoE burst.

## Part 2: whole-feature integration checklist (P17b QA, the packet's final QA)

### Vanilla / dependency discipline
- [ ] No JS framework added (no Svelte/React/Tailwind/Lit/signals). Only new dependency is
      `lightningcss` (devDependency), pinned exactly.
- [ ] `vite.config.ts` still defeats the parent Tailwind postcss config (no regression).
- [ ] Dependency count did not balloon.

### CSS pipeline + build
- [ ] All inline `<style>` CSS for the GAME HUD extracted into `src/styles/*.css` imported per entry;
      index.html / play.html no longer carry duplicated CSS; their inline blocks are empty (or
      import-only). admin.html / guide.html keep their current CSS shape (extraction is HUD-only,
      state.md decision 18); they are verified to still BUILD, not extracted.
- [ ] `@layer` ordering + tiered tokens in place; the `css_corpus` completeness guard reports 100%
      section coverage across both entries (no rule silently dropped).
- [ ] Lightning CSS is the transformer + minifier; `.browserslistrc` is the single big-3 targets
      source; every `backdrop-filter` survives minification `-webkit-`-first with a solid fallback
      (the blocking survival check is green across ALL 4 entries, incl admin's inline block and
      guide's styles.css backdrop-filters, since the project-wide transformer reprocesses them).
- [ ] The i18n modulepreload `<link>` still resolves after the transformer flip.
- [ ] `biome ci --changed` passes on every new `.css` and `.ts` module (the V16 ratchet).

### Graphics-tier UI (effects resolver)
- [ ] `ui_effects_profile` resolves presetLabel x effectsQuality x reduce-motion deterministically
      (unit-tested all tiers); the 'advanced' preset HONORS its effectsQuality slider (decided).
- [ ] `data-fx-level` + `--fx-*` written only on change events, never per frame; debounced on slider
      release; reduce-motion coexists with data-fx-level without conflict.
- [ ] The resolver provably reads `graphicsPresetLabel` and NEVER `RenderBudgetGovernor.state()`
      (import-absence assertion); the `ui` gfx band stays `governable: false`.

### Cold-window extraction (presentation-only)
- [ ] The 10 inline cold windows live as pure view core + thin painter behind PainterHost; vendor
      adopts V16's `vendor_view`/`vendor_window` (incl sell-junk); the delve painter dedupes the two
      call sites.
- [ ] No `IWorld` member / `SimEvent` / wire field / endpoint / DB change introduced; the only
      consumption change is the paged `leaderboard()` in the leaderboard painter.
- [ ] Each new pure core has a Node Vitest and is registered in the UI-purity guard.

### Per-frame extraction (NEW)
- [ ] Every per-frame element (hp/resource + cast bars, swing timer, player/target frames, party
      frames, action bar, auras, minimap, FCT) is a pure allocation-light core + write-elided
      painter; `Hud.update()` dispatches to painters.
- [ ] No painter writes the DOM raw; all go through the host's elided writers (unit-tested). The
      swing-timer and combo-pip elision leaks are fixed (now counted in the cache).
- [ ] Keyed-pool rewrites (auras, party frames) drop no event listeners or tooltips; the action-bar
      aria-label is elided WITHOUT dropping the `t()` call or adding a concat/`??` fallback.
- [ ] The FCT pool never exceeds its cap; a scripted AoE/boss burst shows bounded node count.

### Per-element graphics tiering (NEW)
- [ ] Each cost knob (FCT cap/lifetime, minimap cadence, nameplate rate, aura throttle, non-self
      frame cadence) is a pure function of the static `fxLevel` and never reads the governor
      (import-absence + behavioral test).
- [ ] The low tier shows measurably reduced HUD cost vs ultra (perf_tour); the ultra path is
      byte-equivalent in HUD cost to pre-tiering (no regression on the unthrottled tier).
- [ ] Nameplates are formalized (`nameplate_view` core + painter); the mobile-vs-desktop interval is
      tier-driven.

### Component contract (reusable families) (NEW)
- [ ] Every extracted component is a pure core + thin write-elided painter + INSTANCE-PARAMETERIZED
      (no hardcoded element ids / single-instance assumptions).
- [ ] Unit frames are ONE `unit_frame` core+painter family reused across player/target/party (ready
      for focus/raid/boss), not bespoke per-frame cores.
- [ ] The action bar is instance-parameterized so a second/third bar is `new ActionBarPainter(desc)`;
      the refactor ships one bar through the seam (extra bars are a follow-on feature).
- [ ] No magic values in painters: painters drive CSS vars/tokens, never literal hex/px in TS;
      thresholds/cadences are named constants. The no-magic-values guard is green.

### Accessibility (WCAG 2.2 AA chrome) (NEW)
- [ ] Every extracted window + control passes automated axe-core (or equivalent) on the built chrome;
      the 3D world/canvas is the documented out-of-scope boundary.
- [ ] Keyboard: every control reachable + operable; focus is trapped in an open window and RETURNS
      to the opener on close; Esc closes; logical tab order; skip links present.
- [ ] Visible `:focus-visible` on every interactive element, never animated/blurred away.
- [ ] Live regions announce chat + combat text (politeness chosen per type).
- [ ] Target-size: every control >=24px or adequate spacing (SC 2.5.8); mobile touch controls keep
      the existing >=40x40px floor (do not weaken it).
- [ ] `forced-colors: active` (Windows high-contrast): borders/focus survive; meaning is never
      carried by a background-image alone (snapshot test passes).
- [ ] A minimal `@media print` reset hides the game (no broken print layout).
- [ ] A standing axe regression gate runs in CI.
- [ ] Per-window roles/aria/labels/target-size were built IN during P7a-P14b (the MANDATORY
      WINDOW/CONTROL validation row), not deferred wholesale to P15; P15a/P15b add only the GLOBAL
      pieces (focus manager, skip links, live regions, forced-colors, print) and the chrome-wide audit.
- [ ] The `user-scalable=no` / `maximum-scale=1.0` viewport lock is removed (index.html:5,
      play.html:5); the 16px input-font floor is the anti-zoom guard (SC 1.4.4 / 1.4.10).

### Responsive / mobile (NEW)
- [ ] The V16 mobile E2E scripts pass as a blocking gate (`mobile_input_zoom_check`,
      `mobile_button_size`, `mobile_joystick_size`, `mobile_chat_safe_area`,
      `mobile_minimap_safe_area`, `mobile_community_hud_safe_area`); css_corpus text-completeness is
      NOT a substitute (it cannot catch a dvh->100vh swap, a dropped safe-area-inset, or a lost
      `@media` breakpoint).
- [ ] Mobile-landscape layout, the breakpoint system, dynamic-viewport units, notch/safe-area, and
      orientation handling render unchanged after the CSS move (P4a/P4b), proven on a real-CDP
      mobile profile, not a CSS-text assertion.
- [ ] The iOS real-device pass (manual, cannot run in CI) is recorded as done or explicitly deferred
      with an owner.

### Cross-world parity (Sim vs ClientWorld) (NEW)
- [ ] Every `*_view` core test feeds BOTH a Sim-shaped and a ClientWorld-mirror-shaped `IWorld` stub
      (decision 15); no core assumes a Sim-only field shape or cadence (target cast remaining, combo
      pips, party out-of-range, async leaderboard/market) that the perf harness, which exercises only
      the offline Sim, would not catch.

### Visual regression (NEW)
- [ ] A screenshot baseline captured in P0 (the `scripts/*_shot.mjs` suite); the CSS phases (P2-P4b),
      the canvas windows (P9a), and the lazy-load loading states (P17b) assert a screenshot-diff, so a
      silent cascade/render change is caught beyond the CSS-text guard.

### Bundle / browser matrix (NEW)
- [ ] A JS bundle-budget CI gate exists; the measured-heavy rarely-opened cold windows
      (options/market/leaderboard candidates) are dynamic-imported (initial bundle shrinks by their
      measured cost; each still opens with a loading state); frequently-opened windows stay eager.
- [ ] Cross-engine E2E incl mobile Safari/WebKit runs in CI (FB's open webkit-in-CI item closed).

### Performance / budgets (the standing gate)
- [ ] `npm run perf:tour` desktop + mobile within the P0 baseline (frameP95,
      inputIntentToFrameP95, hudHotDomSkipRate) on every tier.
- [ ] The standing `hud_perf_budget` test enforces write-elision/allocation budget in CI.
- [ ] Tier-switch restyle never fires on a slider drag; HUD frame budget unaffected.

### i18n
- [ ] No new player-visible string lacks a `t()` key; any new control label is in the English-only
      `hud_chrome.ts`; `tests/localization_fixes.test.ts` green; on `release/**` the release-tier
      gate shows pending=0.

### Determinism / purity
- [ ] No `Math.random`/`Date.now`/`performance.now` in `src/sim/` or any guarded pure core (the FCT
      PAINTER may use `Math.random` for jitter; the FCT CORE may not);
      `tests/architecture.test.ts` green.

### Copy review
- [ ] No em dashes, en dashes, or emojis in any player-facing copy, code, comment, or doc.

### Build gate (CI mirror)
- [ ] `npm run i18n:gen && npm test && npx tsc --noEmit && npm run build:env && npm run build:server
      && npm run build` all green for the 4 entries; i18n artifact freshness check clean;
      `biome ci --changed` clean.
