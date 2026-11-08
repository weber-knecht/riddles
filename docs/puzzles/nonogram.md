# Nonogram (Picross)

Classic nonograms in 10x10 and 15x15. Plugin id `nonogram`. The shell's pencil tool is relabelled "Cross". Code in `src/puzzles/nonogram/`.

Rules: the numbers beside a row or above a column are the lengths of the runs of filled cells in that line, in order, with at least one empty cell between runs. A 0 means the line is empty.

## Data

- Puzzle: `{ n, rows: number[][], cols: number[][] }`, the clue runs per line.
- Solution: `number[]`, the picture, 1 filled and 0 empty.
- State: `{ cells: number[] }`, 0 unknown, 1 filled, 2 cross. Crosses are notes for the player and never affect Check.

## Solver (`solver.ts`)

- `lineSolve(clue, line)`: for one line with cells unknown, filled or known-empty, computes whether some consistent placement of the runs fills each cell and whether some leaves it empty, using prefix and suffix feasibility tables (`L[j][p]`: runs 0..j-1 fit in the first p cells covering every known-filled cell; `R[j][p]`: runs j.. fit in the cells from p on). Cells that only one of the two allows are forced. Returns null when no placement exists.
- `lineFixpoint(puzzle, grid, dirty?)`: line-solves lines from a work queue until nothing changes; a change in a row queues the crossing columns and vice versa. Returns false on contradiction.
- `solveWithTechniques(puzzle, maxGrade)`: human techniques only, reporting whether the picture was completed, the hardest technique needed and the number of single-line solves as an effort measure.

| Grade | Technique | What it does |
|-------|-----------|--------------|
| 0 | line solving | the forced cells of every row and column, repeated until nothing changes |
| 1 | contradiction search | suppose one unknown cell is filled, then empty; line-solve each; a contradiction forces the other value |

- `countSolutions(puzzle, limit)`: search with line-solving propagation, used by the tests to confirm uniqueness.

A puzzle these techniques cannot finish has grade infinity and is never shipped.

## Difficulty

| Level | Grade | Picture |
|-------|-------|---------|
| easy | 0 | 60 % noise plus one 3x3 majority smoothing pass, about 73 % filled, average run about 5 |
| medium | 0 | 50 % noise, about 52 % filled, average run about 1.9 |
| hard | exactly 1 | 50 % noise, then the flip walk below, about 48 % filled |

## Generator (`logic.ts`, `generateNonogram`)

Easy and medium: draw a picture from the seeded RNG, derive the clues, accept if line solving completes it, otherwise draw again. Pictures are accepted on the first or second try on average.

Hard: puzzles that need exactly one-level contradiction search are rare among random pictures (a few percent), and rejecting ambiguous pictures costs a full contradiction scan. The generator therefore starts from a line-solvable picture and climbs:

1. Flip one random cell.
2. Grade the result. If it needs contradiction search and is solved, done. If it is still line-solvable and line solving took at least as many single-line solves as before, keep the flip. Otherwise, the puzzle became ambiguous or easier, revert the flip.
3. After 400 flips without success, start from a new random picture. Up to 200 pictures.

Every flip that is kept preserves uniqueness, because a line-solvable puzzle has exactly one solution, and the accepted puzzle is unique for the same reason applied to the contradiction technique: it only places values forced in every solution.

Measured on the development machine over 50 seeds per level and size: easy and medium a few milliseconds; hard 10x10 about 16 ms; hard 15x15 about 60 ms with a worst case near 320 ms.

Changing the technique set, the densities, the smoothing or the walk changes the output for existing seeds and must bump `version`.

## Check

`mistakes` if any filled cell lies outside the picture; `solved` if the filled cells are exactly the picture; otherwise `ok`. Crosses are ignored.

## Board (`Board.tsx`)

Column clues are stacked above each column, row clues sit left of each row, the grid is square and scaled so the whole 15x15 fits the phone's width without scrolling; clue text is smaller on 15x15. Thick lines every five cells and around the grid.

Input: in fill mode a tap toggles a cell filled, overwriting a cross; in Cross mode a tap toggles a cross on a cell that is not filled; the erase tool clears either. Pointer down decides the action from the first cell and dragging paints that action along the row or column chosen by the first movement; the stroke is previewed locally and committed on release as one undo step. The grid uses `touch-action: none` so the page never scrolls during a stroke. Keyboard on desktop: arrows move a focus cell, Space toggles fill, X toggles a cross, Backspace clears.
