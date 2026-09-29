# AGENTS.md

Lineup Lounge is a daily cricket ranking puzzle: a React 19 + TypeScript + Vite single-page app
with no backend. All state lives in the browser's `localStorage`. See `README.md` for the game
and the data sources.

## Commands

```bash
npm install
npm run dev      # http://localhost:5173
npm run lint     # oxlint
npm test         # vitest: scoring logic + validation of every puzzle in the dataset
npm run build    # tsc -b && vite build
```

Run lint, test and build before calling a change done; CI (`.github/workflows/ci.yml`) runs the
same three on every PR and on `main`. Node version is pinned in `.nvmrc`.

## Layout

- `src/App.tsx`: picks today's puzzle, practice mode, stats and streak.
- `src/components/`: UI. `Game.tsx` owns a single round (drag to order, submit, marks).
- `src/lib/`: pure logic, kept free of React so it is easy to test.
  - `score.ts`: marks each row `correct` / `near` (one place off) / `wrong`.
  - `daily.ts`: maps the local calendar date to a puzzle index.
  - `storage.ts`: every `localStorage` read and write goes through here.
  - `puzzleSchema.ts` (zod) and `types.ts`: the puzzle shape.
- `src/data/cricket.json`: the generated puzzle set, loaded as its own lazy chunk.
- `scripts/data/`: Python pipeline that builds `cricket.json` from raw downloads in `data-raw/`
  (git-ignored).

## Things to know before changing code

- **Never hand-edit `src/data/cricket.json`.** Change the generators in `scripts/data/` and rebuild
  (steps in `README.md`). `build.py` rejects ties, duplicate labels, already-solved puzzles and
  initials-only names; fix names in `scripts/data/name_overrides.json`.
- **The daily puzzle is `dayNumber % puzzles.length`.** Adding, removing or reordering puzzles
  changes which puzzle every future (and the current) day shows. Treat dataset changes as
  releases, not tweaks. `puzzles.test.ts` also enforces that puzzles sharing a prompt are at least
  30 days apart in the rotation.
- **Saved games are player data.** Daily saves are keyed `game:cricket:<day>:<puzzleId>`; stats and
  streaks live alongside them. If you change a saved shape, make `storage.ts` discard or migrate old
  values instead of crashing (see how `loadGame` rejects old boolean marks).
- Wrap any new storage access in the existing `read` / `write` helpers; storage can be unavailable
  and the game must still work.
- Team logos live in `public/logos/ipl/`; the tests fail if a referenced logo file is missing.

## Style

- TypeScript strict-ish (`noUnusedLocals`, `noUnusedParameters`, `verbatimModuleSyntax`): use
  `import type` for type-only imports.
- No semicolons, single quotes, 2-space indent. Match the surrounding code.
- Styling is Tailwind CSS v4 utility classes; there is no component library.
- Keep game logic in `src/lib/` with tests next to it (`*.test.ts`).

## Deploys and dependencies

- Vercel deploys production from `main` only; other branches do not deploy (`vercel.json`).
  Don't add preview-deploy workflows or change that file without being asked.
- Dependabot opens weekly PRs for npm and GitHub Actions (`.github/dependabot.yml`).
- Commit and push straight to `main`. Only use a branch and PR when explicitly asked. Merged
  branches are deleted automatically.
