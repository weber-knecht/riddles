import type { CheckResult, Difficulty, PuzzleLogic } from '../../core/types'
import type { Rng } from '../../core/rng'

/**
 * "Counts": fill cells so that every row and column contains exactly the
 * number of filled cells written at its edge. Placeholder puzzle for the
 * shell; removed in iteration 5.
 */
export interface CountsPuzzle {
  n: number
  rows: number[]
  cols: number[]
}
/** Flat n*n array, 1 = filled. */
export type CountsSolution = number[]
export interface CountsState {
  cells: number[]
  pencil: boolean[]
}

const N = 4

function rowOptions(n: number, k: number): number[][] {
  const out: number[][] = []
  const total = 1 << n
  for (let mask = 0; mask < total; mask++) {
    let bits = 0
    for (let i = 0; i < n; i++) if (mask & (1 << i)) bits++
    if (bits !== k) continue
    const row: number[] = []
    for (let i = 0; i < n; i++) row.push(mask & (1 << i) ? 1 : 0)
    out.push(row)
  }
  return out
}

/** Counts solutions up to `limit` by placing rows and pruning on column sums. */
export function countSolutions(puzzle: CountsPuzzle, limit = 2): number {
  const { n, rows, cols } = puzzle
  const options = rows.map((k) => rowOptions(n, k))
  const colSum = new Array<number>(n).fill(0)
  let found = 0
  const place = (r: number): void => {
    if (found >= limit) return
    if (r === n) {
      for (let c = 0; c < n; c++) if (colSum[c] !== cols[c]) return
      found++
      return
    }
    const remainingRows = n - r - 1
    for (const row of options[r] ?? []) {
      let ok = true
      for (let c = 0; c < n; c++) {
        const s = (colSum[c] ?? 0) + (row[c] ?? 0)
        const target = cols[c] ?? 0
        if (s > target || s + remainingRows < target) {
          ok = false
          break
        }
      }
      if (!ok) continue
      for (let c = 0; c < n; c++) colSum[c] = (colSum[c] ?? 0) + (row[c] ?? 0)
      place(r + 1)
      for (let c = 0; c < n; c++) colSum[c] = (colSum[c] ?? 0) - (row[c] ?? 0)
      if (found >= limit) return
    }
  }
  place(0)
  return found
}

function countsOf(n: number, cells: number[]): { rows: number[]; cols: number[] } {
  const rows = new Array<number>(n).fill(0)
  const cols = new Array<number>(n).fill(0)
  for (let r = 0; r < n; r++)
    for (let c = 0; c < n; c++)
      if (cells[r * n + c]) {
        rows[r] = (rows[r] ?? 0) + 1
        cols[c] = (cols[c] ?? 0) + 1
      }
  return { rows, cols }
}

function generate(
  rng: Rng,
  _sizeId: string,
  _difficulty: Difficulty,
): { puzzle: CountsPuzzle; solution: CountsSolution } {
  const n = N
  for (let attempt = 0; attempt < 10000; attempt++) {
    const cells = Array.from({ length: n * n }, () => (rng.next() < 0.5 ? 1 : 0))
    const filled = cells.reduce((a, b) => a + b, 0)
    if (filled < 3 || filled > n * n - 3) continue
    const puzzle: CountsPuzzle = { n, ...countsOf(n, cells) }
    if (countSolutions(puzzle, 2) === 1) return { puzzle, solution: cells }
  }
  throw new Error('Counts: no unique puzzle found')
}

function initialState(puzzle: CountsPuzzle): CountsState {
  const len = puzzle.n * puzzle.n
  return { cells: new Array<number>(len).fill(0), pencil: new Array<boolean>(len).fill(false) }
}

function check(puzzle: CountsPuzzle, solution: CountsSolution, state: CountsState): CheckResult {
  const len = puzzle.n * puzzle.n
  let complete = true
  for (let i = 0; i < len; i++) {
    const want = solution[i] ?? 0
    const have = state.cells[i] ?? 0
    if (have === 1 && want === 0) return 'mistakes'
    if (have !== want) complete = false
  }
  return complete ? 'solved' : 'ok'
}

export const countsLogic: PuzzleLogic<CountsPuzzle, CountsSolution, CountsState> = {
  id: 'counts',
  name: 'Counts',
  version: 1,
  sizes: [{ id: '4', label: '4×4' }],
  supportsPencil: true,
  generate,
  initialState,
  check,
}
