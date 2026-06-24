# Frontend Modernization v0.16.0 (feature/frontend-modernization-v016, off release/v0.16.0)

Make World of ClaudeCraft's UI clean, scalable, responsive (mobile-landscape first), and fast on
the big-3 browsers WITHOUT a JS framework: stay vanilla HTML/CSS/TS and let the modern web platform
plus one build tool (Lightning CSS) do the work. This is the definitive version of the refactor,
rebuilt on `release/v0.16.0` and EXPANDED beyond the original: it extracts the giant inline
`<style>` blocks into a real CSS pipeline with tiered tokens and `@layer`, ships the graphics-tier
HUD effects resolver, extracts the remaining cold windows out of the 14,377-line `hud.ts` behind
`IWorld`, AND for the first time extracts the per-frame HUD layer (bars, frames, nameplates,
minimap, FCT, action bar) into testable cores + write-elided painters, then drives per-element
graphics-quality tiering off the static preset. All behind the project's determinism,
server-authority, i18n, and per-frame perf gates.

This is a RESTART of the completed `feature/frontend-modernization` (FB) packet, which targeted the
older `release/v0.14.1`. The restart decision (Option B) and its evidence are in
`feasibility-v0.16.0.md`; the why-and-scope is in `v016-restart-direction.md`. FB is a read-only
SOURCE: most of its artifacts port forward file-for-file (see `state.md` "Provenance" and the
"Reuse from FB" section of `v016-recon-and-packet.md`).

This packet is the SINGLE source of truth for the frontend direction on v0.16.0.

## Start here

Each phase is its own fresh Claude Code session (Opus 4.8, xhigh effort). To begin a phase, open
its `phase-NN-*.md` and paste the Starter Prompt into a new session. Run the QA pass
(`qa-checklist.md`, instantiated for the phase) immediately after each implementation phase. Never
skip QA. The packet was DEEP-REVIEWED and RESTRUCTURED 2026-06-24 (18 -> 30 phases via sub-letter
splits) so each phase fits well under the ~40% Opus-degradation ceiling INCLUDING its QA pass plus
in-session remediation of every finding. See the OLD -> NEW map and the locked decisions in
`state.md`.

## Index

Cross-cutting docs (decision + design lineage):
- `feasibility-v0.16.0.md` - the Option B verdict (restart, not merge) with the merge dry-run.
- `v016-restart-direction.md` - the expanded scope + the process learnings (smaller phases, perf
  gates).
- `v016-recon-and-packet.md` - the deep line-number recon of v0.16.0's frontend. The LINE-NUMBER
  source, not the authoritative plan: its 16-phase table is SUPERSEDED by the 30-phase ledger in
  `state.md` wherever they differ.
- `state.md` - locked decisions, the OLD -> NEW phase map, canonical workflow, validation matrix,
  review dispatch matrix, the 30-phase ledger. THE authoritative source the phase files elaborate.
  LOADED FIRST by every phase.
- `progress.md` - status table + per-phase deliverable checklists.
- `qa-checklist.md` - whole-feature integration QA matrix + the per-phase QA starter.

Phases (implement, then QA; 30 phases after the 2026-06-24 restructure):
- P0 `phase-00-foundation-gates.md`
- P1 `phase-01-css-lightning-tokens-base.md`
- P2 `phase-02-css-hud-chrome.md` (ULTRACODE)
- P3 `phase-03-css-windows.md` (ULTRACODE)
- P4a `phase-04a-css-shell.md` (ULTRACODE; desktop shell + char-select -> shell.css)
- P4b `phase-04b-css-mobile-extra.md` (ULTRACODE; mobile-touch -> hud.mobile.css + per-entry .extra)
- P5 `phase-05-ui-effects-profile.md`
- P6 `phase-06-painterhost-seam-pilot.md`
- P7a `phase-07a-coldwindow-talents.md` (talents: interactive, mutable edit buffer)
- P7b `phase-07b-coldwindow-social-bags.md` (ULTRACODE; social + bags)
- P8a `phase-08a-coldwindow-options.md` (options: ~1180 lines / 9 sub-panels)
- P8b `phase-08b-coldwindow-market-char.md` (ULTRACODE; market + char)
- P9a `phase-09a-coldwindow-canvas-map-arena.md` (canvas pair; preserve mediumHud call site)
- P9b `phase-09b-coldwindow-dom-questlog-spellbook-leaderboard.md` (the one IWorld-consume: paged leaderboard)
- P10a `phase-10a-perframe-leakfix-host-writers.md` (ULTRACODE; xp + swing leak-fix + the elided-writer extension)
- P10b `phase-10b-perframe-unit-frame-family.md` (ULTRACODE; the unit_frame FAMILY, player first instance)
- P11a `phase-11a-perframe-cast-bars.md` (ULTRACODE; cast bars, eat/drink discriminator)
- P11b `phase-11b-perframe-target-frame.md` (ULTRACODE; target as a unit_frame instance)
- P11c `phase-11c-perframe-party-pool.md` (ULTRACODE; party innerHTML-wipe -> keyed pool)
- P12a `phase-12a-perframe-action-bar.md` (ULTRACODE; multi-bar descriptor + the allocation-budget spike)
- P12b `phase-12b-perframe-auras-minimap.md` (ULTRACODE; auras keyed pool + minimap canvas)
- P13a `phase-13a-perframe-fct-core-driver.md` (ULTRACODE; FCT core + per-frame driver)
- P13b `phase-13b-perframe-fct-painter-migration.md` (ULTRACODE; FCT pooled painter + migration + bounded-AoE gate)
- P14a `phase-14a-graphics-tiering.md` (per-element tier knobs, static preset only)
- P14b `phase-14b-nameplate-extraction.md` (nameplate_view core + painter + tier-driven interval)
- P15a `phase-15a-a11y-infra.md` (focus manager + skip links + live regions + forced-colors + minimal print)
- P15b `phase-15b-a11y-audit-tooling.md` (ULTRACODE; chrome-wide axe + keyboard E2E + per-window fixes)
- P16 `phase-16-standards-codification.md` (codify the contracts into the CLAUDE.md files)
- P17a `phase-17a-harness-floor.md` (client_shell re-author + standing perf budget + purity sweep + first all-together perf run)
- P17b `phase-17b-bundle-lazy-cross-engine-close.md` (bundle-budget + selective lazy-load + cross-engine E2E + packet close)

## Non-negotiables (full detail in state.md)

Vanilla only (one new devDep: Lightning CSS). The per-frame HUD stays framework-free with a hard
perf gate; per-frame painters route every DOM write through the existing write-elision cache (the
four writers plus the P10a `setStyleProp`/`toggleClass` extension). HUD extraction is
presentation-only (consume V16's already-extended `IWorld`; one painter consumes the paged
`leaderboard()`). New pure cores stay DOM/Three-free, deterministic, AND parity-tested against both
a Sim-shaped and a ClientWorld-mirror-shaped `IWorld` stub. Graphics-tier UI is driven from the
static preset, never the FPS governor. WCAG 2.2 AA chrome + the no-magic-values painter guard are
built IN per window/element phase (not deferred to P15); canvas painters resolve tokens via
`getComputedStyle` once per redraw. Responsive/mobile is gated by the V16 `mobile_*` E2E scripts,
not just preserved. New control labels go in the English-only `hud_chrome.ts`. Commit with explicit
paths (shared worktree). No em dashes, en dashes, or emojis anywhere.
