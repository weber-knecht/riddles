/**
 * Nonogram solver primitives. Lines and grids use 0 unknown, 1 filled,
 * 2 known empty. Clues are run lengths; an empty line is [0].
 */

export interface NonogramClues {
  n: number
  rows: number[][]
  cols: number[][]
}

/** Run lengths of a 0/1 line; [0] for an empty line. */
export function runsOf(line: ArrayLike<number>): number[] {
  const runs: number[] = []
  let cur = 0
  for (let i = 0; i < line.length; i++) {
    if (line[i] === 1) cur++
    else if (cur) {
      runs.push(cur)
      cur = 0
    }
  }
  if (cur) runs.push(cur)
  return runs.length ? runs : [0]
}

export function cluesOf(n: number, picture: ArrayLike<number>): NonogramClues {
  const rows: number[][] = []
  const cols: number[][] = []
  for (let r = 0; r < n; r++)
    rows.push(runsOf(Array.from({ length: n }, (_, c) => picture[r * n + c] as number)))
  for (let c = 0; c < n; c++)
    cols.push(runsOf(Array.from({ length: n }, (_, r) => picture[r * n + c] as number)))
  return { n, rows, cols }
}

/**
 * Forced cells of one line: for every cell, whether some consistent placement
 * fills it and whether some leaves it empty. Returns the line with newly
 * forced cells set, or null if no placement is consistent.
 */
export function lineSolve(clue: number[], line: number[]): number[] | null {
  const n = line.length
  const runs = clue.length === 1 && clue[0] === 0 ? [] : clue
  const k = runs.length
  // L[j][p]: runs 0..j-1 fit in prefix [0,p) covering every known-filled cell there.
  const W = n + 2
  const Lf = new Uint8Array((k + 1) * W)
  const Rf = new Uint8Array((k + 1) * W)
  const L = {
    get: (j: number, p: number) => Lf[j * W + p] === 1,
    set: (j: number, p: number, v: boolean) => void (Lf[j * W + p] = v ? 1 : 0),
  }
  const R = {
    get: (j: number, p: number) => Rf[j * W + p] === 1,
    set: (j: number, p: number, v: boolean) => void (Rf[j * W + p] = v ? 1 : 0),
  }
  L.set(0, 0, true)
  for (let p = 1; p <= n; p++) L.set(0, p, L.get(0, p - 1) && line[p - 1] !== 1)
  for (let j = 1; j <= k; j++) {
    const r = runs[j - 1] as number
    for (let p = r; p <= n; p++) {
      // Run j-1 ends somewhere in [?, p): either prefix [0,p-1) already works and cell p-1 is a gap,
      // or the run ends exactly at p-1.
      let ok = L.get(j, p - 1) && line[p - 1] !== 1
      if (!ok) {
        const s = p - r
        let fits = true
        for (let i = s; i < p; i++)
          if (line[i] === 2) {
            fits = false
            break
          }
        if (fits) {
          if (s === 0) ok = j === 1
          else ok = line[s - 1] !== 1 && L.get(j - 1, s - 1)
        }
      }
      L.set(j, p, ok)
    }
  }
  // R[j][p]: runs j..k-1 fit in suffix [p,n) covering every known-filled cell there.
  R.set(k, n, true)
  for (let p = n - 1; p >= 0; p--) R.set(k, p, R.get(k, p + 1) && line[p] !== 1)
  for (let j = k - 1; j >= 0; j--) {
    const r = runs[j] as number
    for (let p = n - r; p >= 0; p--) {
      let ok = R.get(j, p + 1) && line[p] !== 1
      if (!ok) {
        const e = p + r // exclusive end
        let fits = true
        for (let i = p; i < e; i++)
          if (line[i] === 2) {
            fits = false
            break
          }
        if (fits) {
          if (e === n) ok = j === k - 1
          else ok = line[e] !== 1 && R.get(j + 1, e + 1)
        }
      }
      R.set(j, p, ok)
    }
  }
  if (!R.get(0, 0)) return null

  const canFill = new Array<boolean>(n).fill(false)
  const canEmpty = new Array<boolean>(n).fill(false)
  // Empty at i: runs 0..j-1 before i, runs j.. after i.
  for (let i = 0; i < n; i++) {
    if (line[i] === 1) continue
    for (let j = 0; j <= k; j++) {
      if (L.get(j, i) && R.get(j, i + 1)) {
        canEmpty[i] = true
        break
      }
    }
  }
  // Filled at i by run j starting at s.
  for (let j = 0; j < k; j++) {
    const r = runs[j] as number
    for (let s = 0; s + r <= n; s++) {
      let fits = true
      for (let i = s; i < s + r; i++)
        if (line[i] === 2) {
          fits = false
          break
        }
      if (!fits) continue
      const before = s === 0 ? j === 0 : line[s - 1] !== 1 && L.get(j, s - 1)
      if (!before) continue
      const e = s + r
      const after = e === n ? j === k - 1 : line[e] !== 1 && R.get(j + 1, e + 1)
      if (!after) continue
      for (let i = s; i < e; i++) canFill[i] = true
    }
  }
  const out = line.slice()
  for (let i = 0; i < n; i++) {
    if (line[i] !== 0) continue
    const f = canFill[i] as boolean
    const e = canEmpty[i] as boolean
    if (!f && !e) return null
    if (f && !e) out[i] = 1
    else if (e && !f) out[i] = 2
  }
  return out
}

const idxCache = new Map<number, { rows: number[][]; cols: number[][] }>()
function lineIndexes(n: number): { rows: number[][]; cols: number[][] } {
  let v = idxCache.get(n)
  if (!v) {
    v = {
      rows: Array.from({ length: n }, (_, r) => Array.from({ length: n }, (_, c) => r * n + c)),
      cols: Array.from({ length: n }, (_, c) => Array.from({ length: n }, (_, r) => r * n + c)),
    }
    idxCache.set(n, v)
  }
  return v
}
function rowIdx(n: number, r: number): number[] {
  return lineIndexes(n).rows[r] as number[]
}
function colIdx(n: number, c: number): number[] {
  return lineIndexes(n).cols[c] as number[]
}

/**
 * Line-solve until nothing changes, starting from the given dirty lines
 * (indexes 0..n-1 rows, n..2n-1 columns; default all). A line is re-solved
 * whenever a crossing line changed one of its cells. False on contradiction.
 */
let lineSolveCount = 0

export function lineFixpoint(puzzle: NonogramClues, grid: number[], dirty?: number[]): boolean {
  const { n, rows, cols } = puzzle
  const pending = new Array<boolean>(2 * n).fill(dirty === undefined)
  const queue: number[] = dirty ? dirty.slice() : Array.from({ length: 2 * n }, (_, i) => i)
  for (const d of queue) pending[d] = true
  while (queue.length) {
    const k = queue.shift() as number
    pending[k] = false
    const isRow = k < n
    const idx = isRow ? rowIdx(n, k) : colIdx(n, k - n)
    const line = idx.map((i) => grid[i] as number)
    if (!line.includes(0)) continue
    lineSolveCount++
    const solved = lineSolve((isRow ? rows[k] : cols[k - n]) as number[], line)
    if (!solved) return false
    for (let t = 0; t < n; t++) {
      if (solved[t] === line[t]) continue
      grid[idx[t] as number] = solved[t] as number
      const cross = isRow ? n + t : t
      if (!pending[cross]) {
        pending[cross] = true
        queue.push(cross)
      }
    }
  }
  return true
}

export function isComplete(puzzle: NonogramClues, grid: number[]): boolean {
  if (grid.includes(0)) return false
  const { n, rows, cols } = puzzle
  for (let r = 0; r < n; r++) {
    const runs = runsOf(rowIdx(n, r).map((i) => (grid[i] === 1 ? 1 : 0)))
    if (runs.join(',') !== (rows[r] as number[]).join(',')) return false
  }
  for (let c = 0; c < n; c++) {
    const runs = runsOf(colIdx(n, c).map((i) => (grid[i] === 1 ? 1 : 0)))
    if (runs.join(',') !== (cols[c] as number[]).join(',')) return false
  }
  return true
}

export const GRADE = { lineSolving: 0, contradiction: 1 } as const
export const GRADE_NAMES = ['line solving', 'contradiction search'] as const

export interface TechniqueResult {
  solved: boolean
  grade: number
  uses: number[]
  grid: number[]
  /** Number of single-line solves performed: a rough measure of effort. */
  work: number
}

/**
 * Human techniques: line solving to a fixed point, then (if allowed) a
 * one-level contradiction search on single cells with line-solving
 * propagation. Grade is the most expensive technique needed.
 */
export function solveWithTechniques(puzzle: NonogramClues, maxGrade = Infinity): TechniqueResult {
  const { n } = puzzle
  const grid = new Array<number>(n * n).fill(0)
  const uses = [0, 0]
  let grade = -1
  const startWork = lineSolveCount
  const fail = () => ({ solved: false, grade, uses, grid, work: lineSolveCount - startWork })
  for (;;) {
    const before = grid.slice()
    if (!lineFixpoint(puzzle, grid)) return fail()
    if (grid.some((v, i) => v !== before[i])) {
      uses[0] = (uses[0] as number) + 1
      if (grade < 0) grade = 0
    }
    if (!grid.includes(0)) break
    if (maxGrade < 1) return fail()
    let deduced = false
    for (let i = 0; i < n * n && !deduced; i++) {
      if (grid[i] !== 0) continue
      const bad: boolean[] = []
      for (const v of [1, 2]) {
        const copy = grid.slice()
        copy[i] = v
        bad.push(!lineFixpoint(puzzle, copy, [Math.floor(i / n), n + (i % n)]))
      }
      if (bad[0] && bad[1]) return fail()
      if (bad[0] || bad[1]) {
        grid[i] = bad[0] ? 2 : 1
        uses[1] = (uses[1] as number) + 1
        grade = 1
        deduced = true
      }
    }
    if (!deduced) return fail()
  }
  return { solved: isComplete(puzzle, grid), grade, uses, grid, work: lineSolveCount - startWork }
}

export function gradeOf(puzzle: NonogramClues, maxGrade = Infinity): number {
  const r = solveWithTechniques(puzzle, maxGrade)
  return r.solved ? r.grade : Infinity
}

/** Counts solutions up to `limit` by search with line-solving propagation. */
export function countSolutions(puzzle: NonogramClues, limit = 2): number {
  const { n } = puzzle
  const rec = (grid: number[], budget: number, dirty?: number[]): number => {
    if (!lineFixpoint(puzzle, grid, dirty)) return 0
    const cell = grid.indexOf(0)
    if (cell === -1) return isComplete(puzzle, grid) ? 1 : 0
    let found = 0
    for (const v of [1, 2]) {
      const copy = grid.slice()
      copy[cell] = v
      found += rec(copy, budget - found, [Math.floor(cell / n), n + (cell % n)])
      if (found >= budget) break
    }
    return found
  }
  return rec(new Array<number>(n * n).fill(0), limit)
}
