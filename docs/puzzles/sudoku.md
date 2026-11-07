# Sudoku

Classic 9x9. Plugin id `sudoku`, one size, pencil marks supported. Code in `src/puzzles/sudoku/`.

## Data

- Puzzle: `{ givens: number[81] }`, row-major, 0 for empty.
- Solution: `number[81]`.
- State: `{ values: number[81], marks: number[81] }`. `values` holds the player's pen digits (given cells stay 0), `marks` holds pencil marks as a bitmask with bit d set for digit d.

## Solver (`solver.ts`)

Candidates are 16-bit masks. Precomputed tables give each cell's row, column, box, three units and twenty peers.

- `countSolutions(values, limit)`: propagates naked singles, then branches on the cell with the fewest candidates. Used once per generated puzzle as a final uniqueness assertion and in tests.
- `fillGrid(rng)`: backtracking fill of an empty grid, trying digits in an order shuffled by the seeded RNG per cell. Deterministic for a seed.
- `solveWithTechniques(values)`: solves with human techniques only. Each round tries the techniques from cheapest to most expensive and applies the first one that changes anything, then starts the next round. The result reports whether the grid was completed and the most expensive technique that was needed:

| Grade | Technique | What it does |
|-------|-----------|--------------|
| 0 | naked single | a cell has one candidate left |
| 1 | hidden single | a digit has one place left in a row, column or box |
| 2 | naked pair | two cells in a unit share the same two candidates; remove them elsewhere in the unit |
| 3 | hidden pair | two digits fit only the same two cells of a unit; those cells keep only those digits |
| 4 | pointing pair/triple | within a box a digit sits in one row or column; remove it from that line outside the box |
| 5 | box-line reduction | within a row or column a digit sits in one box; remove it from the rest of the box |

A puzzle the technique solver cannot finish has grade infinity and is never shipped, so no level requires guessing.

## Difficulty

| Level | Grade band | Clue floor | Typical clues |
|-------|-----------|------------|---------------|
| easy | 0 to 1 (singles only) | 36 | 36 |
| medium | 2 to 3 (needs a pair, nothing above) | 30 | about 27 |
| hard | 4 to 5 (needs pointing or box-line, nothing above) | 26 | about 25 |

## Generator (`logic.ts`, `generateSudoku`)

1. Fill a complete grid from the seeded RNG.
2. Visit all 81 cells in a seeded random order. For each, remove the clue and grade the result. Keep the removal if the grade is within the level's maximum, otherwise put the clue back. A puzzle that the technique solver completes necessarily has exactly one solution, so the grade check doubles as the uniqueness check.
3. Stop early once the clue count is at or below the level's floor and the grade has reached the level's minimum.
4. Accept if the final grade lies within the band and a backtracking count confirms uniqueness. Otherwise start over with a new grid from the same RNG stream, up to 200 grids, then throw.

Because every decision is driven by the seeded RNG, the same seed, size and difficulty reproduce the same puzzle on any device for generator version 1. Changing the technique set, their order, the floors or the removal order changes the output and must bump `version`.

Measured on the development machine over 50 seeds per level: easy about 1 ms and one grid; medium about 30 ms and four to five grids; hard about 80 ms, worst case about 300 ms, ten grids on average.

## Check

`mistakes` if any pen digit differs from the solution; `solved` if every non-given cell matches; otherwise `ok`. Pencil marks are ignored.

## Board (`Board.tsx`)

Tap a non-given cell to select it, then tap a digit in the row under the grid. Pen sets the digit, or clears it if the cell already shows that digit, and wipes the cell's pencil marks. Pencil toggles that mark, drawn in a fixed 3x3 arrangement. The erase tool clears a tapped cell directly and disables the digit row. Only the selected cell is highlighted. Keyboard digits, Backspace and arrows work on desktop.
