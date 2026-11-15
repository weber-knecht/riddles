# Riddles — puzzle book design

Handoff for applying the "printed puzzle book" look to the app. The design is a restyle: no feature, input model or screen is added or removed.

- Canvas (visual reference): https://claude.ai/artifact/BybLjuyyqrp53PDxvoHJYW
- Artboard sources: `design/project/*.dc.html`. Every element carries its final values as inline styles, so sizes, weights and spacing can be read straight from the markup. They are reference markup for a canvas viewer, not code to import.

| Artboard | File | Applies to |
| --- | --- | --- |
| Contents (menu) | `project/Main.dc.html` | `src/shell/Menu.tsx`, `PuzzleCard.tsx`, `Segmented.tsx` |
| Sudoku page | `project/Sudoku.dc.html` | `src/shell/Solve.tsx`, `ToolRow.tsx`, `src/puzzles/sudoku/Board.tsx` |
| Binairo page, checked | `project/Binairo.dc.html` | `src/puzzles/binairo/Board.tsx`, check line |
| Nonogram page, cross mode | `project/Nonogram.dc.html` | `src/puzzles/nonogram/Board.tsx`, active tool |
| Solved | `project/Solved.dc.html` | solved phase in `Solve.tsx` |
| Small states | `project/States.dc.html` | `UpdateBanner.tsx`, discard confirm, loading, error, notices |
| Dark theme | `project/Dark.dc.html` | dark tokens, pencil tool active |

## The idea

The screen is a page of a newsstand puzzle book. Three kinds of mark exist, and they never mix:

1. **Print** — everything the book came with: grid lines, given digits, clues, headings, buttons. Black ink, serif type, hard edges.
2. **Pen** — everything the player writes: digits, filled cells, crosses, the circled choices on the contents page, the puzzle number they type. Blue ballpoint, handwriting font, slightly tilted.
3. **Pencil** — Sudoku candidate marks. Graphite grey, same handwriting font, small.

Two further inks carry state: yellow **highlighter** means "selected / active" (selected cell, active tool), and red **stamp** ink is the book answering back (check result, the Solved stamp, the bookmark ribbon, destructive actions).

## Tokens

Replace the values in `src/styles.css`. Existing variable names are kept where one exists.

| Role | Existing variable | Light | Dark |
| --- | --- | --- | --- |
| Paper | `--bg` | `#f4efe3` | `#1f1c18` |
| Paper, second tone | `--surface` | `#ebe4d3` | `#2a2621` |
| Print ink | `--fg`, `--grid-bold`, `--ink-given` | `#1c1a17` | `#ece5d6` |
| Secondary print | `--muted` | `#5c564c` | `#a9a194` |
| Thin grid lines, idle borders | `--grid-line` | `#8f887a` | `#6a6358` |
| Pen ink | `--ink-pen`, `--fill` | `#1d3f8f` | `#9db9f5` |
| Pencil | `--ink-pencil` | `#615c54` | `#aaa398` |
| Highlighter | `--selection` | `#f3e58a` | `#4d4619` |
| Stamp red | `--warn` | `#b3261e` | `#f08a7c` |
| Primary button fill | `--accent` | same as print ink | same as print ink |
| Text on primary button | `--accent-fg` | same as paper | same as paper |

The blue accent of the scaffold is gone: the primary button is a solid block of print ink. Cards have no background and no rounded border; sections are separated by 1px print rules. Corner radius is 2px everywhere, 0 on grids.

Pencil on paper and on the highlighter stays above 4.5:1 in both themes, as `docs/scope.md` requires. The `theme-color` meta and manifest background should follow the new paper colours.

## Type

| Use | Family | Details |
| --- | --- | --- |
| Masthead, puzzle number, section titles | Besley 900 | "Riddles" 68px, "No. 48213" 34px, puzzle names 28px |
| Buttons, level names, option words | Besley 700 / 500 | 16–18px |
| Given digits, nonogram clues | Besley 700 | Sudoku 24px, Binairo 21px, clues 14px |
| Small caps labels, running head, footer | Libre Franklin 700 / 500 | 10–12px, uppercase, letter-spacing 0.1–0.14em |
| Pen entries, digit row, check line | Kalam 700 | Sudoku 28px, Binairo 25px, digit row 30px, check line 24px |
| Pencil marks, pencil-mode digit row, notices | Kalam 400 | marks 11px, digit row 22px |

The app must work offline, so the three families have to be self-hosted: add the `.woff2` files to the build (for example via `@fontsource/besley`, `@fontsource/kalam`, `@fontsource/libre-franklin`, Latin subset, only the weights above) and make sure the service worker precaches them. No request to Google Fonts at runtime. Use `font-display: swap` with `Georgia, serif` and `system-ui` fallbacks.

Pen entries get a small fixed tilt per cell, between −3° and +3°, derived from the cell position (the artboards use `((row * 7 + col * 5) % 7) - 3`). It must be deterministic so a digit does not wobble on re-render.

## Screens

### Contents (menu)

- Masthead: "Puzzle book" and "Vol. {version}" above a thick-and-thin double rule, "Riddles" centred, a mirrored double rule below.
- Each puzzle type is a contents entry: name, dotted leader, a short descriptor, then one row per choice ("Size", "Level"). Options are plain printed words; the chosen one is bold and circled by a hand-drawn pen ellipse (inline SVG, `preserveAspectRatio="none"`, `vector-effect: non-scaling-stroke`, 2px stroke in pen ink). Two slightly different ellipse paths are in `Main.dc.html`; alternate them so circles do not look stamped.
- A saved game is a **bookmark**: a print-ink button with a red ribbon on its left edge, "Continue at the bookmark" plus "No. {seed} · {difficulty}". When a bookmark exists, "New puzzle · …" becomes the outlined secondary button below it; otherwise it is the solid primary.
- Seed entry is a form line: printed "No." followed by an input with only a dotted bottom border; typed text is pen handwriting.
- Footer: "Vol. {version}" left, "Printed {build time}" right.
- This page may scroll. Option buttons are drawn 44px high; keep the app's 48px minimum when building.

### Puzzle page (all three types)

Top to bottom, 20px side padding, everything fits 390×844 without scrolling:

1. Running head: back link "‹ Contents" left, "Riddles" right, 1px rule below.
2. Title block: small caps puzzle type (plus size where there is more than one), "No. {seed}" large. On the right the difficulty as one, two or three filled squares out of three, with the word below. The seed is never called "seed" in the UI any more; it is the puzzle number.
3. Board: 2.5px print border, 1px thin lines in `--grid-line`, 2px print lines for Sudoku boxes and every fifth Nonogram line. Paper background, no cell fill.
4. Sudoku only: digit row with a dotted rule below. The digits are drawn in the ink of the current tool: bold blue for pen, light grey and smaller for pencil.
5. Tool row: Undo, Eraser, Pencil or Cross where the type has it, and Check. Tools are outlined 58px buttons with an icon over a small caps label. Active tool: highlighter fill and a 2px print border. Disabled: dashed border, `--grid-line` colour. Check is the solid print block, slightly wider.
6. Check line: right-aligned red handwriting, tilted −2°, with a hand-drawn tick ("Correct so far.") or cross ("Contains mistakes."). Tick and cross differ in shape, not only in colour.

Board specifics:

- **Sudoku**: selected cell gets the highlighter fill, nothing else changes. Pencil marks sit in a fixed 3×3 mini grid inside the cell.
- **Binairo**: givens are printed Besley, entries are pen Kalam; that difference is the only way to tell them apart, as on paper.
- **Nonogram**: a filled cell is a pen-ink block inset 2px with slightly uneven corners (`border-radius: 3px 2px 3px 2px`); a cross is a thin hand-drawn pen X. Clues are Besley 700. Clue gutters are 65px at 10×10; at 15×15 keep the current proportions and drop the clue size as the app already does.

### Solved

The finished page stays visible. A red "Solved" stamp (5px double border, Besley 900, uppercase, rotated −9°, paper background so it reads over the grid) lands on the lower right of the board. The tool row is replaced by "Next puzzle" (primary) and "Contents" (outlined). This replaces the current empty "Solved" screen, so `Solve.tsx` has to keep rendering the board, read-only, in the solved phase.

### Small states

See `States.dc.html`: update banner as an inverted print strip, discard confirmation, loading line, generation error, one-line notice in pencil handwriting, and the three tool button states.

## Copy changes

| Where | Now | New |
| --- | --- | --- |
| Menu button | `New · 9×9 · Easy` | `New puzzle · Easy` (size only when the type has more than one) |
| Menu button | `Continue · … · {seed}` | `Continue at the bookmark` / `No. {seed} · {difficulty}` |
| Seed label | `Seed for the next new puzzle (optional)` | `Looking for one particular puzzle? Write its number here (optional).` |
| Solve header | `… · Seed {seed}` | `No. {seed}` |
| Back button | `←` | `‹ Contents` |
| Loading | `Generating…` | `Printing your puzzle…` |
| Discard confirm | `Discard the current game?` | `Tear out the page you started?` |
| Update banner | current wording | `A new edition is out.` + `Reload` |
| Footer | `v1.0.0 · Build {time}` | `Vol. 1.0.0` / `Printed {time}` |
| Completion | `New puzzle` / `Back to menu` | `Next puzzle` / `Contents` |

"Correct so far." and "Contains mistakes." stay as they are.

## What must not change

- No automatic error marking, hints or candidates; the check line appears only after Check.
- Touch targets at least 48px; boards and controls fit the screen without scrolling.
- Light and dark follow the system setting.
- Puzzle-specific styling stays inside each plugin's board component; the shell only gets the shared page frame, tool row and tokens.

## Not decided here

- Whether the paper should get a texture. The design is flat on purpose: it stays crisp on the phone and costs nothing offline.
- App icon and splash screen are untouched.
