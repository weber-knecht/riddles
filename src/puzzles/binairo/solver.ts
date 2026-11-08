/**
 * Binairo (Takuzu) solver primitives over flat n*n arrays with -1 empty,
 * 0 and 1 as digits. Rules: no three equal digits adjacent in a line, each
 * line has n/2 of each digit, no two identical rows, no two identical columns.
 */
import type { Rng } from '../../core/rng'

const rowCache = new Map<number, number[][]>()

/** Every balanced line of length n without a triple, in lexicographic order. */
export function validRows(n: number): number[][] {
  const cached = rowCache.get(n)
  if (cached) return cached
  const half = n / 2
  const out: number[][] = []
  const cur: number[] = []
  const rec = (c0: number, c1: number) => {
    if (cur.length === n) {
      out.push(cur.slice())
      return
    }
    for (const v of [0, 1]) {
      if ((v === 0 ? c0 : c1) >= half) continue
      const len = cur.length
      if (len >= 2 && cur[len - 1] === v && cur[len - 2] === v) continue
      cur.push(v)
      rec(c0 + (v === 0 ? 1 : 0), c1 + (v === 1 ? 1 : 0))
      cur.pop()
    }
  }
  rec(0, 0)
  rowCache.set(n, out)
  return out
}

const lineCache = new Map<number, number[][]>()
/** The 2n lines of an n×n grid as index arrays: rows first, then columns. */
export function linesOf(n: number): number[][] {
  const cached = lineCache.get(n)
  if (cached) return cached
  const lines: number[][] = []
  for (let r = 0; r < n; r++) lines.push(Array.from({ length: n }, (_, c) => r * n + c))
  for (let c = 0; c < n; c++) lines.push(Array.from({ length: n }, (_, r) => r * n + c))
  lineCache.set(n, lines)
  return lines
}

function lineValues(grid: number[], idx: number[]): number[] {
  return idx.map((i) => grid[i] as number)
}

/** Integer key of a complete line (bit i set when cell i is 1). */
export function lineKey(line: number[]): number {
  let key = 0
  for (let i = 0; i < line.length; i++) if (line[i] === 1) key |= 1 << i
  return key
}

/** True if a complete line is consistent (balanced, no triples). */
function lineOk(line: number[]): boolean {
  const n = line.length
  let c1 = 0
  for (let i = 0; i < n; i++) {
    const v = line[i] as number
    if (v !== 0 && v !== 1) return false
    c1 += v
    if (i >= 2 && line[i - 1] === v && line[i - 2] === v) return false
  }
  return c1 === n / 2
}

export function isValidComplete(n: number, grid: number[]): boolean {
  const lines = linesOf(n)
  const seenRows = new Set<number>()
  const seenCols = new Set<number>()
  for (let k = 0; k < lines.length; k++) {
    const line = lineValues(grid, lines[k] as number[])
    if (!lineOk(line)) return false
    const key = lineKey(line)
    const seen = k < n ? seenRows : seenCols
    if (seen.has(key)) return false
    seen.add(key)
  }
  return true
}

/** Any rule already broken by the filled cells (empties ignored). */
export function hasViolation(n: number, grid: number[]): boolean {
  const lines = linesOf(n)
  const half = n / 2
  let seenRows: Set<number> | null = null
  let seenCols: Set<number> | null = null
  for (let k = 0; k < lines.length; k++) {
    const idx = lines[k] as number[]
    let c0 = 0
    let c1 = 0
    let full = true
    let key = 0
    let prev1 = -2
    let prev2 = -2
    for (let i = 0; i < n; i++) {
      const v = grid[idx[i] as number] as number
      if (v === -1) full = false
      else {
        if (v === 0) c0++
        else {
          c1++
          key |= 1 << i
        }
        if (v === prev1 && v === prev2) return true
      }
      prev2 = prev1
      prev1 = v
    }
    if (c0 > half || c1 > half) return true
    if (full) {
      if (k < n) {
        if (!seenRows) seenRows = new Set()
        if (seenRows.has(key)) return true
        seenRows.add(key)
      } else {
        if (!seenCols) seenCols = new Set()
        if (seenCols.has(key)) return true
        seenCols.add(key)
      }
    }
  }
  return false
}

export interface Fillings {
  /** Number of valid completions seen (may stop early at 2 once nothing is forced). */
  count: number
  /** Per position: the value every completion agrees on, or -1. Given positions keep their value. */
  forced: number[]
}

/**
 * Enumerates completions of one line under the triple and count rules,
 * skipping completions whose key is in `exclude`, and reports the cells all
 * completions agree on.
 */
export function lineFillings(line: number[], exclude?: ReadonlySet<number>): Fillings {
  const n = line.length
  const half = n / 2
  const cur = line.slice()
  const forced: number[] = line.slice()
  let count = 0
  let undecided = 0
  for (const v of line) if (v === -1) undecided++
  let c0 = 0
  let c1 = 0
  for (const v of line) {
    if (v === 0) c0++
    else if (v === 1) c1++
  }
  const empties: number[] = []
  for (let i = 0; i < n; i++) if (line[i] === -1) empties.push(i)
  if (c0 > half || c1 > half) {
    for (const i of empties) forced[i] = -1
    return { count: 0, forced }
  }

  const tripleAt = (i: number): boolean => {
    const v = cur[i]
    if (i >= 2 && cur[i - 1] === v && cur[i - 2] === v) return true
    if (i >= 1 && i + 1 < n && cur[i - 1] === v && cur[i + 1] === v) return true
    if (i + 2 < n && cur[i + 1] === v && cur[i + 2] === v) return true
    return false
  }

  const rec = (k: number): boolean => {
    if (k === empties.length) {
      if (exclude && exclude.has(lineKey(cur))) return false
      if (count === 0) {
        for (const i of empties) forced[i] = cur[i] as number
      } else {
        for (const i of empties) {
          if (forced[i] !== -1 && forced[i] !== cur[i]) {
            forced[i] = -1
            undecided--
          }
        }
      }
      count++
      // Nothing left to learn once two completions disagree everywhere.
      return count >= 2 && undecided <= 0
    }
    const i = empties[k] as number
    for (const v of [0, 1]) {
      if (v === 0 ? c0 >= half : c1 >= half) continue
      cur[i] = v
      if (tripleAt(i)) {
        cur[i] = -1
        continue
      }
      if (v === 0) c0++
      else c1++
      const stop = rec(k + 1)
      if (v === 0) c0--
      else c1--
      cur[i] = -1
      if (stop) return true
    }
    return false
  }
  // `undecided` counts empties still forced; starts at number of empties after first completion.
  undecided = empties.length
  rec(0)
  if (count === 0) for (const i of empties) forced[i] = -1
  return { count, forced }
}

export const GRADE = {
  triple: 0,
  counting: 1,
  lineCompletion: 2,
  uniqueLines: 3,
  contradiction: 4,
} as const
export const GRADE_NAMES = [
  'triple avoidance',
  'counting',
  'line completion',
  'unique lines',
  'contradiction search',
] as const

export interface TechniqueResult {
  solved: boolean
  grade: number
  uses: number[]
}

type Technique = (grid: number[]) => boolean | 'contradiction'

function makeTechniques(n: number): Technique[] {
  const lines = linesOf(n)
  const half = n / 2

  const triple: Technique = (grid) => {
    let did = false
    for (const idx of lines) {
      for (let i = 0; i < n; i++) {
        const cell = idx[i] as number
        if (grid[cell] !== -1) continue
        const at = (j: number) => (j >= 0 && j < n ? (grid[idx[j] as number] as number) : -2)
        let force = -1
        if (at(i - 1) >= 0 && at(i - 1) === at(i - 2)) force = 1 - at(i - 1)
        else if (at(i + 1) >= 0 && at(i + 1) === at(i + 2)) force = 1 - at(i + 1)
        else if (at(i - 1) >= 0 && at(i - 1) === at(i + 1)) force = 1 - at(i - 1)
        if (force !== -1) {
          grid[cell] = force
          did = true
        }
      }
    }
    return did
  }

  const counting: Technique = (grid) => {
    let did = false
    for (const idx of lines) {
      let c0 = 0
      let c1 = 0
      let empties = 0
      for (const cell of idx) {
        const v = grid[cell] as number
        if (v === 0) c0++
        else if (v === 1) c1++
        else empties++
      }
      if (!empties) continue
      const fill = c0 === half ? 1 : c1 === half ? 0 : -1
      if (fill === -1) continue
      for (const cell of idx) if (grid[cell] === -1) grid[cell] = fill
      did = true
    }
    return did
  }

  const completion =
    (useExclude: boolean): Technique =>
    (grid) => {
      let did = false
      for (let k = 0; k < lines.length; k++) {
        const idx = lines[k] as number[]
        const line = lineValues(grid, idx)
        if (!line.includes(-1)) continue
        let exclude: Set<number> | undefined
        if (useExclude) {
          exclude = new Set()
          const from = k < n ? 0 : n
          const to = k < n ? n : 2 * n
          for (let m = from; m < to; m++) {
            if (m === k) continue
            const other = lineValues(grid, lines[m] as number[])
            if (!other.includes(-1)) exclude.add(lineKey(other))
          }
          if (exclude.size === 0) continue
        }
        const { count, forced } = lineFillings(line, exclude)
        if (count === 0) return 'contradiction'
        for (let i = 0; i < n; i++) {
          if (line[i] === -1 && forced[i] !== -1) {
            grid[idx[i] as number] = forced[i] as number
            did = true
          }
        }
      }
      return did
    }

  // Techniques only add values, so an inconsistency introduced along the way
  // is still visible at the end; one violation check per fixpoint suffices.
  const basicFixpoint = (grid: number[]): boolean => {
    for (;;) {
      const a = triple(grid)
      const b = counting(grid)
      if (!a && !b) return !hasViolation(n, grid)
    }
  }

  const contradiction: Technique = (grid) => {
    for (let cell = 0; cell < n * n; cell++) {
      if (grid[cell] !== -1) continue
      const bad: boolean[] = []
      for (const v of [0, 1]) {
        const copy = grid.slice()
        copy[cell] = v
        bad.push(!basicFixpoint(copy))
      }
      if (bad[0] && bad[1]) return 'contradiction'
      if (bad[0] || bad[1]) {
        grid[cell] = bad[0] ? 1 : 0
        return true
      }
    }
    return false
  }

  return [triple, counting, completion(false), completion(true), contradiction]
}

const techniqueCache = new Map<number, Technique[]>()

function techniquesFor(n: number): Technique[] {
  let techniques = techniqueCache.get(n)
  if (!techniques) {
    techniques = makeTechniques(n)
    techniqueCache.set(n, techniques)
  }
  return techniques
}

/**
 * Techniques above `maxGrade` are never attempted, so a grid that would need
 * them comes back unsolved quickly. Pass Infinity to grade without a bound.
 */
export function solveWithTechniques(
  n: number,
  givens: number[],
  maxGrade = Infinity,
): TechniqueResult {
  const techniques = techniquesFor(n)
  const grid = givens.slice()
  const uses = [0, 0, 0, 0, 0]
  let grade = -1
  const empties = () => grid.reduce((a, v) => a + (v === -1 ? 1 : 0), 0)
  while (empties() > 0) {
    if (hasViolation(n, grid)) return { solved: false, grade, uses }
    let progressed = false
    for (let g = 0; g < techniques.length && g <= maxGrade; g++) {
      const r = (techniques[g] as Technique)(grid)
      if (r === 'contradiction') return { solved: false, grade, uses }
      if (r) {
        uses[g] = (uses[g] as number) + 1
        if (g > grade) grade = g
        progressed = true
        break
      }
    }
    if (!progressed) return { solved: false, grade, uses }
  }
  return { solved: isValidComplete(n, grid), grade, uses }
}

export function gradeOf(n: number, givens: number[], maxGrade = Infinity): number {
  const r = solveWithTechniques(n, givens, maxGrade)
  return r.solved ? r.grade : Infinity
}

/**
 * Can a column with `need0` zeros and `need1` ones still to place be completed
 * without a triple, given its current tail (last value and run length)?
 */
const feasibleCache = new Map<number, boolean>()
function columnFeasible(last: number, run: number, need0: number, need1: number): boolean {
  if (need0 === 0 && need1 === 0) return true
  const key = (((last + 1) * 3 + run) * 32 + need0) * 32 + need1
  const cached = feasibleCache.get(key)
  if (cached !== undefined) return cached
  let ok = false
  for (const v of [0, 1]) {
    if ((v === 0 ? need0 : need1) === 0) continue
    if (v === last && run === 2) continue
    if (
      columnFeasible(
        v,
        v === last ? run + 1 : 1,
        need0 - (v === 0 ? 1 : 0),
        need1 - (v === 1 ? 1 : 0),
      )
    ) {
      ok = true
      break
    }
  }
  feasibleCache.set(key, ok)
  return ok
}

/**
 * Row-by-row search over valid rows. With `rng`, candidate rows are shuffled
 * and the first solution is returned; without, solutions are counted up to
 * `limit`. Columns are pruned by count, vertical triples and a completion
 * look-ahead; distinct rows are enforced during the search and distinct
 * columns at the end.
 */
function searchRows(
  n: number,
  givens: number[],
  limit: number,
  rng?: Rng,
): { count: number; grid: number[] | null } {
  const rows = validRows(n)
  const rowBits = rows.map(lineKey)
  const half = n / 2
  const full = (1 << n) - 1
  // Candidate row indexes per grid row, consistent with givens.
  const candidates: number[][] = []
  for (let r = 0; r < n; r++) {
    let must1 = 0
    let must0 = 0
    for (let c = 0; c < n; c++) {
      const g = givens[r * n + c] as number
      if (g === 1) must1 |= 1 << c
      else if (g === 0) must0 |= 1 << c
    }
    const list: number[] = []
    for (let k = 0; k < rows.length; k++) {
      const bits = rowBits[k] as number
      if ((bits & must1) === must1 && (bits & must0) === 0) list.push(k)
    }
    if (rng) rng.shuffle(list)
    candidates.push(list)
  }
  const chosen: number[] = []
  const usedRows = new Set<number>()
  const count0 = new Array<number>(n).fill(0)
  const count1 = new Array<number>(n).fill(0)
  const last = new Array<number>(n).fill(-1)
  const run = new Array<number>(n).fill(0)
  let count = 0
  let found: number[] | null = null

  const place = (r: number): boolean => {
    if (r === n) {
      const seen = new Set<number>()
      for (let c = 0; c < n; c++) {
        let key = 0
        for (let i = 0; i < n; i++)
          if ((rowBits[chosen[i] as number] as number) & (1 << c)) key |= 1 << i
        if (seen.has(key)) return false
        seen.add(key)
      }
      count++
      if (!found) found = chosen.flatMap((k) => rows[k] as number[])
      return count >= limit
    }
    // Per column: which digits may go here so that the column stays completable.
    let forbid0 = 0
    let forbid1 = 0
    for (let c = 0; c < n; c++) {
      const l = last[c] as number
      const ru = run[c] as number
      const n0 = half - (count0[c] as number)
      const n1 = half - (count1[c] as number)
      const ok0 =
        n0 > 0 && !(l === 0 && ru === 2) && columnFeasible(0, l === 0 ? ru + 1 : 1, n0 - 1, n1)
      const ok1 =
        n1 > 0 && !(l === 1 && ru === 2) && columnFeasible(1, l === 1 ? ru + 1 : 1, n0, n1 - 1)
      if (!ok0 && !ok1) return false
      if (!ok0) forbid0 |= 1 << c
      if (!ok1) forbid1 |= 1 << c
    }
    for (const k of candidates[r] as number[]) {
      const bits = rowBits[k] as number
      if (bits & forbid1 || ~bits & full & forbid0 || usedRows.has(bits)) continue
      chosen.push(k)
      usedRows.add(bits)
      const savedLast = last.slice()
      const savedRun = run.slice()
      for (let c = 0; c < n; c++) {
        const v = bits & (1 << c) ? 1 : 0
        if (v === 0) count0[c] = (count0[c] as number) + 1
        else count1[c] = (count1[c] as number) + 1
        run[c] = last[c] === v ? (run[c] as number) + 1 : 1
        last[c] = v
      }
      const stop = place(r + 1)
      chosen.pop()
      usedRows.delete(bits)
      for (let c = 0; c < n; c++) {
        const v = bits & (1 << c) ? 1 : 0
        if (v === 0) count0[c] = (count0[c] as number) - 1
        else count1[c] = (count1[c] as number) - 1
        last[c] = savedLast[c] as number
        run[c] = savedRun[c] as number
      }
      if (stop) return true
    }
    return false
  }
  place(0)
  return { count, grid: found }
}

/**
 * Counts solutions up to `limit` by cell-level search with triple and
 * counting propagation between guesses. Much faster than the row search on
 * sparse grids.
 */
export function countSolutions(n: number, givens: number[], limit = 2): number {
  const [triple, counting] = techniquesFor(n) as [Technique, Technique]
  const rec = (grid: number[], budget: number): number => {
    for (;;) {
      if (hasViolation(n, grid)) return 0
      const a = triple(grid)
      const b = counting(grid)
      if (!a && !b) break
    }
    const cell = grid.indexOf(-1)
    if (cell === -1) return isValidComplete(n, grid) ? 1 : 0
    let found = 0
    for (const v of [0, 1]) {
      const copy = grid.slice()
      copy[cell] = v
      found += rec(copy, budget - found)
      if (found >= budget) break
    }
    return found
  }
  return rec(givens.slice(), limit)
}

export function fillGrid(rng: Rng, n: number): number[] {
  const { grid } = searchRows(n, new Array<number>(n * n).fill(-1), 1, rng)
  if (!grid) throw new Error('Binairo: fillGrid failed')
  return grid
}
