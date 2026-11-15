# Architecture

Single-page Preact app, built with Vite, installed as a PWA from Chrome for Android. No backend. This document describes the contracts that every puzzle type relies on. Decisions behind them are in `docs/scope.md` and the iteration issues. The look is specified in `design/README.md`.

## Layout

```
src/
  main.tsx            mounts App, or Bench when the URL has ?bench
  app.tsx             screen state (menu | solve), history handling, settings
  styles.css          colour and font tokens, shell layout, one block per board
  fonts.css           @font-face rules for the self-hosted fonts
  core/
    types.ts          PuzzleLogic, BoardProps, PuzzlePlugin, Difficulty, Tool, CheckResult
    rng.ts            seeded RNG (sfc32 + cyrb128), seed helpers
    registry.ts       all plugins (logic + board), imported by the UI
    logicRegistry.ts  logic only, imported by the worker (never pulls in Preact)
    storage.ts        versioned localStorage store for games and settings
    worker.ts         generation worker
    workerClient.ts   promise-based client with request ids, timeout and cancel
    workerProtocol.ts message types
  shell/              Menu, PuzzleCard, Solve, ToolRow, Segmented, UpdateBanner, Bench
  puzzles/<id>/
    logic.ts          generator, solver, check. No DOM, no Preact.
    Board.tsx         touch UI for this puzzle
    index.ts          exports the PuzzlePlugin
test/                 Vitest, Node environment, logic only
tools/                icon generator, end-to-end smoke test
```

## Puzzle plugin contract

A puzzle type is a folder under `src/puzzles/` exporting a `PuzzlePlugin`:

```ts
interface PuzzleLogic<P, S, St> {
  id: string                 // stable, used in storage keys
  name: string
  tagline: string            // a few printed words after the name on the contents page
  version: number            // generator version, stored with saved games
  sizes: { id: string; label: string }[]
  supportsPencil: boolean    // shows the pencil tool
  pencilLabel?: string       // relabels it, e.g. 'Cross' for nonograms
  pencilIcon?: 'pencil' | 'cross'   // icon of that tool, default 'pencil'
  generate(rng: Rng, sizeId: string, difficulty: Difficulty): { puzzle: P; solution: S }
  initialState(puzzle: P): St
  check(puzzle: P, solution: S, state: St): 'solved' | 'mistakes' | 'ok'
}
interface BoardProps<P, St> {
  puzzle: P
  state: St
  tool: 'pen' | 'pencil' | 'erase'
  onChange(next: St): void
  readOnly?: boolean         // the solved page: show the state, take no input
}
```

Rules:

- **Plain JSON.** Puzzle, solution and state must be JSON values. The shell persists them with `JSON.stringify` and never inspects them.
- **Immutable state.** A board never mutates `state`; it builds a new value and calls `onChange`. The shell keeps the previous value as the single undo snapshot.
- **Logic is pure and DOM-free.** `logic.ts` runs in the worker and in Node tests. It must not import Preact or touch `window`.
- **Uniqueness is the generator's job.** `generate` must return a puzzle with exactly one solution. The solver used to guarantee this is internal to the plugin.
- **Check is a pure comparison.** `'mistakes'` means some entered value contradicts the solution, `'ok'` means everything entered so far is consistent but incomplete, `'solved'` means the state equals the solution. Pencil marks are ignored.
- **The board interprets taps per tool.** `pen` enters, `pencil` notes, `erase` clears. Boards never render automatic error marks or candidates.
- **Bump `version` when the generator changes.** If the same seed can give another puzzle, raise `version`. Saved games from another version are discarded on load.
- **Read-only.** With `readOnly` the board ignores taps, drags and keys, marks no selected or focus cell and leaves out its own controls (Sudoku hides the digit row). The shell draws the stamp and the buttons of the solved page.
- **Three kinds of mark.** Givens and clues are print (`--font-print`, `--ink-given`). Entries are pen (`--font-hand` bold, `--ink-pen`) inside a `span.pen` with a `--tilt` between −3° and 3° computed from row and column, so an entry leans the same way every time it is drawn. Notes are pencil (`--font-hand` regular, `--ink-pencil`). A selected or focus cell is filled with `--selection`. A board's styles live in its own block of `styles.css` and use only these tokens.
- **Sizing.** The shell renders a frame of width `min(100vw - 40px, 60vh)`. Text inside a board is sized in container units of the board, so it scales with the frame. The board draws its grid as a square of that width (`width: 100%; aspect-ratio: 1`) and may place its own controls, such as Sudoku's digit row, underneath. The shell's tool row follows below the frame. Board, controls and tool row together must fit a 411×830 px viewport without scrolling, also below the update banner; the smoke test asserts this for every size and for the solved page.
- **Difficulty** is `easy | medium | hard` everywhere; labels belong to the shell.

Register the plugin in `core/registry.ts` (UI) and its logic in `core/logicRegistry.ts` (worker).

## Seeds and determinism

A seed is six characters from `23456789ABCDEFGHJKLMNPQRSTUVWXYZ`. The generator RNG is `createRng(puzzleSeedString(puzzleId, sizeId, difficulty, seed))`, so the same four inputs reproduce the same puzzle for a given generator version. User-entered seeds are upper-cased and stripped of characters outside the alphabet.

## Generation worker

One module worker is created on first use and kept alive. Request and reply:

```ts
{ requestId, puzzleId, sizeId, difficulty, seed }
{ requestId, ok: true, puzzle, solution, generatorVersion } | { requestId, ok: false, error }
```

The client rejects after 15 seconds and then replaces the worker, so a runaway generation cannot block the next request. The puzzle page shows "Printing your puzzle…" once a request has taken 300 ms, and an error view with Try again and Back on failure. Leaving the solve screen while a request is pending calls `cancelGeneration()`, which terminates the worker; the next request starts a fresh one. Nothing is saved until generation succeeds.

## Benchmark page

`?bench` renders `shell/Bench.tsx` instead of the app. It iterates the plugin registry and, after one warm-up run, generates ten hard puzzles per plugin and size through the same worker client, with fixed seeds. The table lists the average and the slowest time with its seed. It contains no puzzle-specific code. Target for version 1: slowest generation under two seconds on the phone.

## Storage

localStorage, falling back to memory when storage is unavailable.

| Key | Content |
|-----|---------|
| `riddles.v1.game.<puzzleId>` | `SavedGame`: schema 1, ids, seed, generator version, puzzle, solution, state, undo snapshot or null, timestamps |
| `riddles.v1.settings` | `Settings`: schema 1, last chosen size and difficulty per puzzle id |

Every input autosaves the whole game record. Solving a puzzle clears its record.

Unusable data never breaks the app:

- A record that fails to parse, has another schema, or was written by another generator version (`generatorVersion` differs from the plugin's `version`) is removed, and the menu shows a one-line notice.
- On start, `pruneUnknown` silently removes game records and last choices of puzzle ids that are not in the registry.
- A record that passes these checks but makes the board throw while rendering is caught by an error boundary around the board. It shows "This saved game could not be opened." and a "Discard this game" button.
- When a save fails (storage full or blocked), the check line shows "Progress could not be saved." and the game continues in memory.

## Screens

- **Contents page** (`Menu`): masthead, then one entry per plugin: name, dotted leader and tagline, a "Size" row (only with more than one size) and a "Level" row whose chosen option is circled in pen, "Continue at the bookmark" with the puzzle number if a game is saved, and "New puzzle · …" with an inline discard confirmation. Below the entries: an optional field for a puzzle number, and a footer with the version from `package.json` ("Vol.") and the build time ("Printed").
- **Puzzle page** (`Solve`): running head ("Contents" leads back), title block (type, size if the type has more than one, "No. {seed}", level as three squares and a word), board frame, tool row, check line. A typed number of up to twelve characters is shrunk to stay on one line. Check writes "Correct so far." or "Contains mistakes." into the check line, or turns the page into the solved page.
- **Solved page**: the same page with the board read-only, a "Solved" stamp over the lower right of the board frame, and "Next puzzle" (same type, size and level, new number) and "Contents" in place of the tool row. It is only reached through Check, and the saved game is cleared at that moment.
- Entering Solve pushes a history entry; the Android back gesture pops it and returns to the menu. On startup the current entry is normalised to the menu.

## Offline and updates

vite-plugin-pwa (generateSW, `registerType: 'prompt'`) precaches every build output including the worker chunk and the fonts. New builds are detected on the next open, and also when the app returns to the foreground: `UpdateBanner` calls `registration.update()` on `visibilitychange`, at most once per minute and only while online. A new build is offered through the update banner ("A new edition is out."), an inverted strip above the page on both screens; the switch happens only when the user taps Reload.

Fonts: Besley (500, 700, 900), Kalam (400, 700) and Libre Franklin (500, 700) come from the `@fontsource` packages. `src/fonts.css` declares only the seven Latin WOFF2 files with `font-display: swap`, Vite copies them into `dist/assets/`, and `workbox.globPatterns` includes `woff2`. The built app contains no reference to a font server.

## Phone behaviour

- `touch-action: pan-x pan-y` on `html` and `body` disables pinch zoom and double-tap zoom everywhere; the viewport meta forbids scaling as well. The nonogram grid uses `touch-action: none` because it handles drags itself.
- The manifest locks the installed app to portrait. Its background and theme colour are the dark page background, so the splash screen never flashes white. Two `theme-color` metas make the status bar follow the light or dark page background.
- Text selection is off except in the seed input. Buttons are at least 48 px; grid cells are as large as the board allows.
- Colour and font tokens live at the top of `styles.css`. Print, pen and pencil ink keep a contrast of at least 4.5:1 against both the paper (`--bg`) and the highlighter (`--selection`) in both themes.
