# Binairo (Takuzu)

Classic Binairo in 10x10 and 12x12. Plugin id `binairo`, no pencil marks. Code in `src/puzzles/binairo/`.

Rules: fill every cell with 0 or 1 so that no three equal digits are adjacent in a row or column, every row and column contains equally many 0s and 1s, no two rows are identical, and no two columns are identical.

## Data

- Puzzle: `{ n, givens: number[] }`, row-major, -1 for empty, 0 or 1 for a given.
- Solution: `number[]` of 0 and 1.
- State: `{ cells: number[] }`, -1 for empty; given cells stay -1 in the state.

## Solver (`solver.ts`)

- `validRows(n)`: every balanced line of length n without a triple (84 for n = 10, 208 for n = 12).
- `fillGrid(rng, n)`: row-by-row search over the valid rows in a seeded shuffled order. Columns are pruned by digit counts, vertical triples and a completion look-ahead (`columnFeasible`: can a column with its current tail still be finished without a triple?). Rows are kept distinct during the search, columns are checked for distinctness at the end.
- `countSolutions(n, givens, limit)`: cell-level search with triple and counting propagation between guesses. Used in tests; the generator does not need it (see below).
- `lineFillings(line, exclude?)`: enumerates every completion of one line under the triple and count rules, optionally skipping completions equal to a line in `exclude`, and reports the cells all completions agree on. Stops early once two completions disagree everywhere.
- `solveWithTechniques(n, givens, maxGrade?)`: human techniques only, cheapest first, restart after each successful application. Reports whether the grid was completed and the most expensive technique needed. Techniques above `maxGrade` are never tried, which keeps the generator's rejected removals cheap.

| Grade | Technique | What it does |
|-------|-----------|--------------|
| 0 | triple avoidance | `11_`, `_11` and `1_1` force a 0 (and the 0 versions force a 1) |
| 1 | counting | a line that has its n/2 of one digit gets the other digit everywhere else |
| 2 | line completion | cells that every valid completion of the line agrees on are forced |
| 3 | unique lines | as 2, but completions equal to an already complete parallel line are discarded |
| 4 | contradiction search | try one value in one cell, propagate with triples and counting only; a violation forces the other value |

A puzzle these techniques cannot finish has grade infinity and is never shipped.

## Difficulty

| Level | Grade band | Clue floor | Typical clues (10x10 / 12x12) |
|-------|-----------|------------|-------------------------------|
| easy | 0 to 1 | 40 % of cells | 40 / 58 |
| medium | exactly 2 | 32 % | 32 / 46 |
| hard | 3 to 4 | 25 % | 25 / 36 |

## Generator (`logic.ts`, `generateBinairo`)

1. Fill a complete grid from the seeded RNG.
2. Visit all cells in a seeded random order. Remove the clue and grade the result with the level's maximum as the bound. Keep the removal if the grade stays within the maximum, otherwise restore the clue.
3. Stop once the clue count is at or below the level's floor and the grade has reached the level's minimum.
4. Accept if the final grade lies within the band, otherwise start over with a new grid from the same RNG stream, up to 200 grids.

Uniqueness follows from technique-solvability: every technique only places values that are forced in all solutions, so a grid the techniques complete has exactly one solution. The test suite confirms this with `countSolutions` on 300 generated puzzles.

Measured on the development machine over 50 seeds per level and size: easy and medium under 20 ms; hard 10x10 about 40 ms, hard 12x12 about 115 ms with a worst case near 320 ms. Every seed succeeded on its first grid.

Changing the technique set, their order, the floors or the removal order changes the output for existing seeds and must bump `version`.

## Check

`mistakes` if any entered digit differs from the solution; `solved` if every non-given cell matches; otherwise `ok`.

## Board (`Board.tsx`)

Tapping a non-given cell cycles empty, 0, 1, empty. The erase tool clears a tapped cell. The last tapped cell is tinted so keyboard input on desktop has a target: arrows move it, 0 and 1 set it, Backspace clears it. Givens are bold in the given ink, entries in the pen ink. No rule violations are marked.
