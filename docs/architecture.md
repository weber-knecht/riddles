# Architecture

Single-page Preact app, built with Vite, installed as a PWA from Chrome for Android. No backend. This document describes the contracts that every puzzle type relies on. Decisions behind them are in `docs/scope.md` and the iteration issues.

## Layout

```
src/
  main.tsx            mounts App
  app.tsx             screen state (menu | solve), history handling, settings
  styles.css          colour tokens and layout
  core/
    types.ts          PuzzleLogic, BoardProps, PuzzlePlugin, Difficulty, Tool, CheckResult
    rng.ts            seeded RNG (sfc32 + cyrb128), seed helpers
    registry.ts       all plugins (logic + board), imported by the UI
    logicRegistry.ts  logic only, imported by the worker (never pulls in Preact)
    storage.ts        versioned localStorage store for games and settings
    worker.ts         generation worker
    workerClient.ts   promise-based client with request ids and timeout
    workerProtocol.ts message types
  shell/              Menu, PuzzleCard, Solve, ToolRow, Segmented, UpdateBanner
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
  supportsPencil: boolean    // shows the Pencil tool
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
- **Sizing.** The shell renders a square frame of `min(100vw - 32px, 60vh)`; the board fills it with `width: 100%; height: 100%` and never sets its own outer size.
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

The client rejects after 15 seconds. The solve screen shows "Generating…" while waiting and an error view with Try again and Back on failure. Nothing is saved until generation succeeds.

## Storage

localStorage, falling back to memory when storage is unavailable.

| Key | Content |
|-----|---------|
| `riddles.v1.game.<puzzleId>` | `SavedGame`: schema 1, ids, seed, generator version, puzzle, solution, state, undo snapshot or null, timestamps |
| `riddles.v1.settings` | `Settings`: schema 1, last chosen size and difficulty per puzzle id |

A record that fails to parse or has another schema is removed and the menu shows a one-line notice. Every input autosaves the whole game record. Solving a puzzle clears its record.

## Screens

- **Menu**: one card per plugin with size and difficulty controls, Continue (if a game is saved), New with an inline discard confirmation, a global optional seed field, and the build timestamp.
- **Solve**: header (back, name, size, difficulty, seed), board frame, tool row, transient check line. Check reports "Correct so far." or "Contains mistakes.", or switches to the completion view ("Solved", New puzzle, Back to menu). Completion only happens through Check.
- Entering Solve pushes a history entry; the Android back gesture pops it and returns to the menu. On startup the current entry is normalised to the menu.

## Offline and updates

vite-plugin-pwa (generateSW) precaches every build output including the worker chunk. New builds are detected on the next open and offered through the update banner; the switch happens only when the user taps Reload.
