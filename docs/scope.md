# Project scope

Status: version 1.0.0, as built, 2026-11-15.

## Goal

A web app for one person, used on a Samsung Galaxy A26 5G (SM-A266B/DS, 6.7" 1080x2340 display, Android 15 / One UI 7). The user picks a puzzle type and difficulty, the app generates a fresh puzzle with exactly one solution, and the user solves it on screen the way they would on paper.

## In scope (version 1)

- Puzzle types: Sudoku 9x9, Binairo (Takuzu) 10x10 and 12x12, Nonogram (Picross) 10x10 and 15x15. Classic rules only, no variants.
- Three difficulty levels per type, graded by the solving techniques required, not only by clue count.
- Every puzzle has a visible seed; entering the same seed and difficulty regenerates the same puzzle.
- One in-progress game per puzzle type, auto-saved, resumed on return.
- Pencil marks (small candidate notes) where the puzzle type has them on paper: Sudoku yes, Binairo and Nonogram no.
- Eraser and single-step undo.
- Check on request: reports whether the current grid is correct. Nothing is marked automatically.
- Completion screen when the grid is solved correctly.
- Light and dark theme following the system setting.
- Fully offline after the first load.
- Phone handling: the installed app is locked to portrait, pinch zoom and double-tap zoom are off, and every board with its controls fits the screen without scrolling.
- Generation feedback: "Generating…" appears only when a puzzle takes longer than 300 ms. Going back cancels the generation. After 15 seconds the app gives up and offers "Try again". Target: hard puzzles within two seconds on the phone.
- Saved data that cannot be used (corrupt, another storage schema, another generator version) is discarded with a one-line notice. Data of puzzle types that no longer exist is removed silently.
- A new version is announced with a one-line banner and applied only when the user taps Reload. The app looks for a new version on open and when it returns to the foreground.
- A benchmark page (`?bench`) measures generation times on the device. The menu footer shows the version and build time.

## Out of scope (version 1)

- Hints, timers, statistics, streaks, achievements.
- Keeping the screen on while solving (backlog).
- Automatic error highlighting, auto-candidates, auto-elimination, "last remaining cell" helpers.
- Accounts, sync, sharing, any network calls after the app is loaded.
- Play Store, APK packaging (kept as a fallback, see the backlog issue).
- Other puzzle types. Candidates for later, roughly by generator effort: Futoshiki, Minesweeper, KenKen, Killer Sudoku, Skyscrapers, Kakuro, Hitori, Slitherlink, Nurikabe, Hashiwokakero, word puzzles.

## Environment constraints

- Browser: Chrome for Android, installed as a PWA from the browser menu. Only broadly supported web standards: service workers, localStorage, Web Workers, CSS grid, pointer events.
- DuckDuckGo is not supported. Its data clearing (Fire button and automatic clearing) deletes service worker registrations and caches regardless of Fireproof, so offline use cannot be guaranteed there. Verified against DuckDuckGo's Android source in issue #1 on 2026-11-07.
- Installed from Chrome, the app runs full screen in standalone mode and its data persists until the user clears it in Chrome settings.
- Mobile browsers do not open local HTML files, so the app is loaded once from a web address and then runs from cache.
- Development machine: Linux, Node 22 via fnm (`.nvmrc`), no Java, no Android SDK.

## User experience principles

- Pen and paper first. The screen is the sheet of paper; the finger is the pen. Anything paper cannot do is left out unless it removes friction that paper does not have.
- Touch targets at least 48 px. Grids fill the width in portrait; nothing requires landscape.
- No modal clutter. One screen for choosing a puzzle, one for solving it.
- Input model per puzzle type:
  - Sudoku: tap a cell, tap a digit on a fixed number row at the bottom. Toggle between pen and pencil. Tap the same digit again to erase it.
  - Binairo: tap a cell to cycle empty, 0, 1.
  - Nonogram: tap to fill, a mode toggle (Cross) to mark crosses. Drag to paint a run of cells along a row or column.

## Architecture

- TypeScript, Vite, Preact. Single-page app, no routing library.
- Puzzle plugin interface, one folder per puzzle type (contract in `docs/architecture.md`):
  - generator(seeded RNG, size, difficulty) returns puzzle and solution
  - solver used by the generator to enforce a unique solution and grade difficulty
  - check compares the user's grid with the solution
  - board component renders and handles input
  - puzzle, solution and progress are plain JSON, so the shell saves them without puzzle-specific code
- Generation runs in a Web Worker so the UI never blocks.
- Shell: puzzle menu, difficulty picker, seed display and entry, save and resume, theme, check and completion flow.
- Storage: localStorage with a versioned schema, one entry per puzzle type plus one for settings. Each saved game records the generator version that made it.
- Deterministic pseudo-random number generator seeded from the visible seed, so puzzles are reproducible across devices and versions as long as the generator does not change.

## Delivery

- Built as static files, deployed to GitHub Pages from this repository. Pages provides the HTTPS the service worker needs.
- The app is served under a sub-path (`https://weber-knecht.github.io/riddles/`), so the Vite base path and the service worker scope must be set accordingly.
- Every push to `main` is tested, built and deployed by a GitHub Actions workflow. Releases are annotated git tags; the version comes from `package.json`.
- Acceptance of version 1: all three puzzle types playable end to end in the installed Chrome app on the phone, in airplane mode, and still working after a phone restart.

## Work tracking

Iterations and the backlog are GitHub issues in weber-knecht/riddles. See `docs/agents/issue-tracker.md`.

## Open decisions

None.

## Resolved decisions

- 2026-11-15 (iteration 5, issue #6): Zoom gestures are off app-wide and the app is locked to portrait. Boards must fit the screen; there is no hard scroll lock.
- 2026-11-15: Pencil ink has a contrast of at least 4.5:1 on the paper and on the selected cell in both themes. Thin grid lines stay as they are.
- 2026-11-15: A saved game from another generator version is discarded with a notice instead of being migrated, because the same seed may no longer give the same puzzle.
- 2026-11-15: The update banner never reloads on its own; the user decides when to switch versions.
- 2026-11-15: The benchmark page stays in the shipped app. Name "Riddles" and the icon stay. The status bar follows the light or dark page background; the splash screen is dark.
- 2026-11-15: Version 1 is the annotated tag `v1.0.0`. No GitHub release.
- 2026-11-07: Target browser changed from DuckDuckGo to Chrome for Android after the iteration 0 test failed in DuckDuckGo (see issue #1). The Capacitor APK remains the fallback if Chrome fails too.
- 2026-11-07: Hosting is GitHub Pages from this repo. Alternatives considered: another free static host, or the Linux machine on the home network with a self-signed certificate.
- 2026-11-07: Git repository initialised, public GitHub repo weber-knecht/riddles created. Public was chosen so GitHub Pages stays available on the free plan.
