# Architecture

Single-page Preact app, built with Vite, installed as a PWA from Chrome for Android. No backend. This document describes the contracts that every puzzle type relies on. Decisions behind them are in `docs/scope.md` and the iteration issues.

## Layout

```
src/
  main.tsx            mounts App, or Bench when the URL has ?bench
  app.tsx             screen state (menu | solve), history handling, settings
  styles.css          colour tokens and layout
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
  version: number            // generator version, stored with saved games
  sizes: { id: string; label: string }[]
  supportsPencil: boolean    // shows the pencil tool
  pencilLabel?: string       // relabels it, e.g. 'Cross' for nonograms
  generate(rng: Rng, sizeId: string, difficulty: Difficulty): { puzzle: P; solution: S }
  initialState(puzzle: P): St
  check(puzzle: P, solution: S, state: St): 'solved' | 'mistakes' | 'ok'
}
interface BoardProps<P, St> {
  puzzle: P
  state: St
  tool: 'pen' | 'pencil' | 'erase'
  onChange(next: St): void
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
- **Sizing.** The shell renders a frame of width `min(100vw - 32px, 60vh)`. The board draws its grid as a square of that width (`width: 100%; aspect-ratio: 1`) and may place its own controls, such as Sudoku's digit row, underneath. The shell's tool row follows below the frame. Board, controls and tool row together must fit a 411×830 px viewport without scrolling; the smoke test asserts this for every size.
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

The client rejects after 15 seconds and then replaces the worker, so a runaway generation cannot block the next request. The solve screen shows "Generating…" once a request has taken 300 ms, and an error view with Try again and Back on failure. Leaving the solve screen while a request is pending calls `cancelGeneration()`, which terminates the worker; the next request starts a fresh one. Nothing is saved until generation succeeds.

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

- **Menu**: one card per plugin with size and difficulty controls, Continue (if a game is saved), New with an inline discard confirmation, a global optional seed field, and a footer with the version from `package.json` and the build timestamp.
- **Solve**: header (back, name, size, difficulty, seed), board frame, tool row, transient check line. Check reports "Correct so far." or "Contains mistakes.", or switches to the completion view ("Solved", New puzzle, Back to menu). Completion only happens through Check.
- Entering Solve pushes a history entry; the Android back gesture pops it and returns to the menu. On startup the current entry is normalised to the menu.

## Offline and updates

vite-plugin-pwa (generateSW, `registerType: 'prompt'`) precaches every build output including the worker chunk. New builds are detected on the next open, and also when the app returns to the foreground: `UpdateBanner` calls `registration.update()` on `visibilitychange`, at most once per minute and only while online. A new build is offered through the update banner; the switch happens only when the user taps Reload.

## Phone behaviour

- `touch-action: pan-x pan-y` on `html` and `body` disables pinch zoom and double-tap zoom everywhere; the viewport meta forbids scaling as well. The nonogram grid uses `touch-action: none` because it handles drags itself.
- The manifest locks the installed app to portrait. Its background and theme colour are the dark page background, so the splash screen never flashes white. Two `theme-color` metas make the status bar follow the light or dark page background.
- Text selection is off except in the seed input. Buttons are at least 48 px; grid cells are as large as the board allows.
- Colour tokens live at the top of `styles.css`. Pencil ink keeps a contrast of at least 4.5:1 against both the paper (`--surface`) and the selected cell (`--selection`) in both themes.
