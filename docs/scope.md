# Project scope

Status: version 1.1.0, as built, 2026-11-15. Version 1.1.0 changes the look, not the features.

## Goal

A web app for one person, used on a Samsung Galaxy A26 5G (SM-A266B/DS, 6.7" 1080x2340 display, Android 15 / One UI 7). The user picks a puzzle type and difficulty, the app generates a fresh puzzle with exactly one solution, and the user solves it on screen the way they would on paper.

## In scope (version 1)

- Puzzle types: Sudoku 9x9, Binairo (Takuzu) 10x10 and 12x12, Nonogram (Picross) 10x10 and 15x15. Classic rules only, no variants.
- Three difficulty levels per type, graded by the solving techniques required, not only by clue count.
- Every puzzle has a visible seed, printed as its number ("No. K7QF2M"); entering the same number with the same size and difficulty regenerates the same puzzle.
- One in-progress game per puzzle type, auto-saved, resumed on return.
- Pencil marks (small candidate notes) where the puzzle type has them on paper: Sudoku yes, Binairo and Nonogram no.
- Eraser and single-step undo.
- Check on request: reports whether the current grid is correct. Nothing is marked automatically.
- Solved page: when Check finds the grid solved, the finished board stays on screen, read-only, under a red "Solved" stamp, with "Next puzzle" and "Contents" below it.
- Light and dark theme following the system setting.
- Fully offline after the first load.
- Phone handling: the installed app is locked to portrait, pinch zoom and double-tap zoom are off, and every board with its controls fits the screen without scrolling.
- Generation feedback: "Printing your puzzle…" appears only when a puzzle takes longer than 300 ms. Going back cancels the generation. After 15 seconds the app gives up and offers "Try again". Target: hard puzzles within two seconds on the phone.
- Saved data that cannot be used (corrupt, another storage schema, another generator version) is discarded with a one-line notice. Data of puzzle types that no longer exist is removed silently.
- A new version is announced with a one-line banner ("A new edition is out.") and applied only when the user taps Reload. The app looks for a new version on open and when it returns to the foreground.
- A benchmark page (`?bench`) measures generation times on the device. The footer of the contents page shows the version ("Vol.") and the build time ("Printed").

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
- No modal clutter. One screen for choosing a puzzle (the contents page), one for solving it (a puzzle page).
- Input model per puzzle type:
  - Sudoku: tap a cell, tap a digit on a fixed number row at the bottom. Toggle between pen and pencil. Tap the same digit again to erase it.
  - Binairo: tap a cell to cycle empty, 0, 1.
  - Nonogram: tap to fill, a mode toggle (Cross) to mark crosses. Drag to paint a run of cells along a row or column.

## Look

The app looks like a printed puzzle book. The reference is `design/README.md` with one artboard per screen in `design/project/`.

- Three kinds of mark, as on paper. Print is everything the book provides: givens, clues, grid lines, labels and buttons, set in Besley and in small capitals of Libre Franklin. Pen is what the player enters: blue handwriting (Kalam bold), each entry leaning a little, always the same way for the same cell. Pencil is the player's notes: grey handwriting (Kalam regular).
- Two inks carry state. Yellow highlighter means selected or active: the selected Sudoku cell, the active tool, the keyboard focus cell. Red stamp ink is the book answering back: the check line, the Solved stamp, the bookmark ribbon and destructive actions.
- Corners are square (2 px on controls, none on grids). Sections are separated by thin print rules, not by cards or shadows.
- The three typefaces are part of the app and cached with it. The app loads nothing from a font server.
- Print, pen and pencil have a contrast of at least 4.5:1 on the paper and on the highlighter in both themes.

## Architecture

- TypeScript, Vite, Preact. Single-page app, no routing library.
- Puzzle plugin interface, one folder per puzzle type (contract in `docs/architecture.md`):
  - generator(seeded RNG, size, difficulty) returns puzzle and solution
  - solver used by the generator to enforce a unique solution and grade difficulty
  - check compares the user's grid with the solution
  - board component renders and handles input
  - puzzle, solution and progress are plain JSON, so the shell saves them without puzzle-specific code
- Generation runs in a Web Worker so the UI never blocks.
- Shell: contents page with size and level choice, puzzle number display and entry, save and resume, theme, check and solved page.
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

- 2026-11-15 (iteration 6, issue #8): The app takes the "printed puzzle book" look from `design/`. It is a restyle: no feature, input model or screen was added or removed.
- 2026-11-15: Seeds stay six characters from the seed alphabet. Only the interface calls them numbers; five-digit numbers as drawn in the design were rejected because they would change which puzzle a seed gives.
- 2026-11-15: The solved page keeps the finished board, read-only, under the stamp. The saved game is still cleared at that moment, so leaving the page leaves nothing behind.
- 2026-11-15: The dark highlighter is `#3d3713`, darker than the design's `#4d4619`, so that pencil keeps 4.5:1 on a selected cell.
- 2026-11-15: Fonts are self-hosted (Latin subset, WOFF2) and precached, because the app must work offline and makes no network calls after loading.
- 2026-11-15: In Binairo and Nonogram the highlighter marks the focus cell only while a keyboard is in use. A tap leaves no highlight. Sudoku keeps its selected cell, which the digit row needs.
- 2026-11-15: Nonogram 10×10 has clue gutters of at least 65 px. Controls drawn at 44 px in the design are built at 48 px.
- 2026-11-15: Version 1.1.0 is the annotated tag `v1.1.0`. No GitHub release.
- 2026-11-15 (iteration 5, issue #6): Zoom gestures are off app-wide and the app is locked to portrait. Boards must fit the screen; there is no hard scroll lock.
- 2026-11-15: Pencil ink has a contrast of at least 4.5:1 on the paper and on the selected cell in both themes. Thin grid lines stay as they are.
- 2026-11-15: A saved game from another generator version is discarded with a notice instead of being migrated, because the same seed may no longer give the same puzzle.
- 2026-11-15: The update banner never reloads on its own; the user decides when to switch versions.
- 2026-11-15: The benchmark page stays in the shipped app. Name "Riddles" and the icon stay. The status bar follows the light or dark page background; the splash screen is dark.
- 2026-11-15: Version 1 is the annotated tag `v1.0.0`. No GitHub release.
- 2026-11-07: Target browser changed from DuckDuckGo to Chrome for Android after the iteration 0 test failed in DuckDuckGo (see issue #1). The Capacitor APK remains the fallback if Chrome fails too.
- 2026-11-07: Hosting is GitHub Pages from this repo. Alternatives considered: another free static host, or the Linux machine on the home network with a self-signed certificate.
- 2026-11-07: Git repository initialised, public GitHub repo weber-knecht/riddles created. Public was chosen so GitHub Pages stays available on the free plan.
