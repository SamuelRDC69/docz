# Translation workflow (contributor and maintainer)

How player-visible strings get translated under the two-tier model the i18n
Scaling packet built (Phases 1 to 7). Two audiences, two flows:

- **Contributor** (any PR author): adds English, never blocks on translations.
- **Maintainer** (release owner): fills the 14-locale slice at release time from a
  cheap per-locale delta, then proves the release gate green.

The load-bearing rule both flows uphold: an English-only PR passes CI, and no
silent English ever ships to a translated player. See `state.md` for the locked
decisions and `progress.md` for phase status.

---

## Contributor flow (English-only PRs are legal)

The full rule lives in `src/ui/CLAUDE.md` (the i18n section); the short version:

1. **Add the key to `en` only.** New player-visible string -> add it to the nested
   `en` source (`src/ui/i18n.en.ts`) and call it through `t()`. Do NOT hand-edit
   the 13 overlays (`src/ui/i18n.locales/<lang>.ts`); the build fills any omitted
   key from English and the registry marks it `pending`.
2. **If the string originates in `src/sim/` or `server/`,** those stay
   language-agnostic - emit a stable English string and register a matcher RULE in the
   table matching the emit's ORIGIN (`src/ui/sim_i18n.ts` for a `src/sim/` emit,
   `src/ui/server_i18n.ts` for a `server/` emit; the two are parallel mirrors) in the
   SAME change, so the client re-localizes it at the boundary. The S3 guard accepts
   recognition by either matcher and fails if a new emit is recognized by neither.
3. **Run `npm run i18n:scan`** and commit the updated `src/ui/i18n.status.json`
   (it records your new key as `pending` for every locale that has no translation
   yet). `npm run i18n:build` regenerates the resolved table; if the resolved
   output changed, regenerate and commit `src/ui/i18n.resolved.sha256` too.
4. **Open the PR.** It is green: the PR-tier gate (`pr-gate` in `.github/workflows/ci.yml`)
   runs `npm test` WITHOUT `I18N_RELEASE_TIER`, so it does not require translations.
   `tsc` still guarantees English completeness (every overlay is `Partial<Record<
   TranslationKey,string>>`, so a structurally-wrong key fails to compile).

You are done. The untranslated keys are now `pending`; the maintainer fills them at
release time.

---

## Maintainer flow (release fill)

Run before cutting a release, once `pending` is non-empty (a real fill is due):

1. **`npm run i18n:scan`** - refresh `src/ui/i18n.status.json` so it reflects the
   current English and overlays. The worklist refuses to run on a stale registry.
2. **`npm run i18n:worklist`** - generates `docs/i18n-scaling/worklist/<lang>.json`
   per language with pending work, plus a `manifest.json`. This directory is
   gitignored: it is a regenerable artifact, not committed. The tool is DATA-ONLY
   (no network, no model call); re-running on an unchanged repo is a no-op.
   - Optional: `npm run i18n:worklist -- --lang de_DE,fr_FR` to scope a subset. A scoped
     run REPLACES the worklist directory with only the named batches and a scoped
     manifest (batches for unlisted languages are removed); do a full run before relying
     on the directory for the whole release.
3. **Fill `autoFillable` entries.** Each is `{ scope, key, english, placeholders,
   siblings }`. A bot or translator fills mechanical UI chrome only. Write the
   translation into the matching overlay (`scope: main` -> `src/ui/i18n.locales/<lang>.ts`)
   or DICT (`scope: sim|server|admin` -> the matching matcher/DICT file), preserving
   EVERY placeholder token verbatim. `siblings` give nearby English for context;
   the shipped `glossary` (see below) gives the canonical localized form of every
   locked term so terminology does not drift.
4. **Route `humanRequired` entries to a human translator.** These are prose -
   quest narratives, class/ability/item/mob/npc/zone/dungeon names, class lore,
   SEO marketing, and anything not positively recognised as chrome. They are
   blocked-by-default and are NEVER auto-filled. (CJK talent names live in
   `src/ui/talent_i18n.ts`, a separate function-valued channel that is not a
   registry key, so they never enter a worklist batch at all.)
   - Note: the worklist treats the matcher DICT scopes (sim/server/admin) as
     mechanical chrome. They carry system/operator strings, not narrative. If a
     DICT ever needs an English backstop that must NOT be auto-translated, seed it
     `blocked` in `scripts/i18n_blocked_seed.mjs` (it then never appears as
     `pending`, so it cannot reach a worklist batch) rather than relying on the
     classifier, whose prose guard only covers `main`-scope content namespaces.
5. **`npm run i18n:scan`** again - confirm `pending` shrank (filled keys flip to
   `translated`). Regenerate the resolved artifact and move the baseline together:
   `npm run i18n:build` then `npm run i18n:hash -- --write` so
   `src/ui/i18n.resolved.generated.ts` and `src/ui/i18n.resolved.sha256` are
   committed in lockstep (otherwise `tests/i18n_resolved_equivalence.test.ts` fails).
6. **Prove the release gate.** Run the release tier locally:
   `I18N_RELEASE_TIER=1 npm test`. It requires an EMPTY `pending` set and runs the
   full 14-locale localization suite. When that is green and `pending` is 0, the
   `release-gate` CI job on a `release/**` push will pass.

### Defense-in-depth before the first real fill ships (carried from Phase 6 QA)
Production release semantics currently rest solely on `import.meta.env.PROD` being
statically true under `vite build`. Before the first real `pending` key ships, set
`I18N_RELEASE=1` in the production build environment (Docker / CI / deploy) as a
backstop, so a future non-Vite/SSR client bundling path cannot evaluate
release=false and English-fill a pending key. Not blocking while `pending` is 0.

---

## The locked-terms glossary

`scripts/i18n_glossary.json` is the hand-maintained glossary source (edited like
`scripts/i18n_blocked_seed.mjs`, not generated). It lists:

- `verbatim`: brand / proper nouns never translated (the project name
  "World of ClaudeCraft"), kept byte-identical in every locale.
- `categories`: en key patterns for the locked terms - the 9 class names, ability
  names (`entities.abilities.*.name`), zone names (`entities.zones.*.name`), and
  dungeon names (`entities.dungeons.*.name`). A `*` matches one dotted segment.

`npm run i18n:worklist` expands those patterns, resolves each term's established
localized form per language from the committed overlays, and ships the result in
EVERY batch. To add a locked term, add its key (or a pattern) here; tool logic does
not change.

The glossary is ADVISORY: it is shipped as reference so the bot or translator reuses the
canonical wording, but the tool does not ENFORCE that a `verbatim` brand term survives in
a filled value. The brand "World of ClaudeCraft" also appears inside some `footer.*` chrome
strings (which are auto-fillable), so the fill owner spot-checks that the brand is preserved
byte-identically until an automated guard exists.

---

## OPEN: release-fill ownership and the translation API key (RFC 9.6)

This item is recorded OPEN, not resolved here. It is not a code blocker; resolve it
before the first real release fill.

- **Owner: TBD.** Who runs `npm run i18n:worklist` and the fill pass each release,
  and who holds the translation API key (if a model-driven fill is used for the
  `autoFillable` chrome)?
- **Bus factor.** The worklist is plain JSON and the flow above is self-contained
  by design, so a second maintainer can run it - but the API key and the "who owns
  the prose translator hand-off" must have a named owner and a backup.
- **Scope reminder.** The bot fills `autoFillable` (mechanical chrome) only; prose
  (`humanRequired`) always goes to a human. The key, if any, only ever sees chrome.

When resolved, record the owner here and in `state.md`, and close the RFC 9.6 item.
