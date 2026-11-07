/**
 * Sudoku solver primitives: uniqueness counting, full-grid filling and a
 * technique-based grader. Pure functions over flat 81-cell arrays with
 * digits 1..9 and 0 for empty. Candidates are bitmasks with bit d set for
 * digit d (bit 0 unused).
 */
import type { Rng } from '../../core/rng'

export const ALL = 0x3fe // bits 1..9

export const ROW_OF: number[] = []
export const COL_OF: number[] = []
export const BOX_OF: number[] = []
/** 27 units: rows 0-8, columns 9-17, boxes 18-26. */
export const UNITS: number[][] = []
/** The three unit indexes each cell belongs to. */
export const CELL_UNITS: number[][] = []
/** The 20 peers of each cell. */
export const PEERS: number[][] = []

for (let i = 0; i < 81; i++) {
  const r = Math.floor(i / 9)
  const c = i % 9
  ROW_OF.push(r)
  COL_OF.push(c)
  BOX_OF.push(Math.floor(r / 3) * 3 + Math.floor(c / 3))
}
for (let u = 0; u < 27; u++) UNITS.push([])
for (let i = 0; i < 81; i++) {
  const r = ROW_OF[i] as number
  const c = COL_OF[i] as number
  const b = BOX_OF[i] as number
  UNITS[r]?.push(i)
  UNITS[9 + c]?.push(i)
  UNITS[18 + b]?.push(i)
  CELL_UNITS.push([r, 9 + c, 18 + b])
}
for (let i = 0; i < 81; i++) {
  const set = new Set<number>()
  for (const u of CELL_UNITS[i] as number[])
    for (const j of UNITS[u] as number[]) if (j !== i) set.add(j)
  PEERS.push([...set])
}

export function popcount(x: number): number {
  let n = 0
  while (x) {
    x &= x - 1
    n++
  }
  return n
}

function lowestDigit(mask: number): number {
  for (let d = 1; d <= 9; d++) if (mask & (1 << d)) return d
  return 0
}

/** Candidate mask for an empty cell given current values. */
function candidatesAt(vals: ArrayLike<number>, i: number): number {
  let used = 0
  for (const p of PEERS[i] as number[]) {
    const v = vals[p] as number
    if (v) used |= 1 << v
  }
  return ALL & ~used
}

/**
 * Counts solutions up to `limit`. Returns 0 for a contradiction.
 * Propagates naked singles, then branches on the cell with fewest candidates.
 */
export function countSolutions(values: ArrayLike<number>, limit = 2): number {
  const vals = Uint8Array.from(values as ArrayLike<number>)
  return search(vals, limit)
}

function search(vals: Uint8Array, limit: number): number {
  // Propagate singles until stable.
  for (;;) {
    let progress = false
    let bestCell = -1
    let bestMask = 0
    let bestCount = 10
    for (let i = 0; i < 81; i++) {
      if (vals[i]) continue
      const mask = candidatesAt(vals, i)
      const n = popcount(mask)
      if (n === 0) return 0
      if (n === 1) {
        vals[i] = lowestDigit(mask)
        progress = true
      } else if (n < bestCount) {
        bestCount = n
        bestCell = i
        bestMask = mask
      }
    }
    if (progress) continue
    if (bestCell === -1) return 1
    let count = 0
    for (let d = 1; d <= 9; d++) {
      if (!(bestMask & (1 << d))) continue
      const copy = vals.slice()
      copy[bestCell] = d
      count += search(copy, limit - count)
      if (count >= limit) return count
    }
    return count
  }
}

/** A complete valid grid, chosen by the rng. */
export function fillGrid(rng: Rng): number[] {
  const vals = new Uint8Array(81)
  const digits = [1, 2, 3, 4, 5, 6, 7, 8, 9]
  const fill = (i: number): boolean => {
    if (i === 81) return true
    const mask = candidatesAt(vals, i)
    if (!mask) return false
    rng.shuffle(digits)
    for (const d of digits) {
      if (!(mask & (1 << d))) continue
      vals[i] = d
      if (fill(i + 1)) return true
    }
    vals[i] = 0
    return false
  }
  if (!fill(0)) throw new Error('fillGrid failed')
  return Array.from(vals)
}

export const GRADE = {
  nakedSingle: 0,
  hiddenSingle: 1,
  nakedPair: 2,
  hiddenPair: 3,
  pointing: 4,
  boxLine: 5,
} as const
export type Grade = (typeof GRADE)[keyof typeof GRADE]
export const GRADE_NAMES = [
  'naked single',
  'hidden single',
  'naked pair',
  'hidden pair',
  'pointing pair',
  'box-line reduction',
] as const

export interface TechniqueResult {
  solved: boolean
  /** Highest grade used, or -1 if nothing was needed (already solved). */
  grade: number
  /** How many times each technique was applied (one entry per grade). */
  uses: number[]
}

/**
 * Solves with human techniques only. Techniques are tried from cheapest to
 * most expensive; the first one that makes progress is applied and the loop
 * restarts. The result grade is the most expensive technique that was needed.
 */
export function solveWithTechniques(values: ArrayLike<number>): TechniqueResult {
  const vals = Uint8Array.from(values as ArrayLike<number>)
  const cand = new Uint16Array(81)
  let empty = 0
  for (let i = 0; i < 81; i++) {
    if (vals[i]) cand[i] = 1 << (vals[i] as number)
    else {
      cand[i] = candidatesAt(vals, i)
      empty++
    }
  }
  const uses = [0, 0, 0, 0, 0, 0]
  let grade = -1

  const place = (i: number, d: number): void => {
    vals[i] = d
    cand[i] = 1 << d
    empty--
    for (const p of PEERS[i] as number[]) if (!vals[p]) cand[p] = (cand[p] as number) & ~(1 << d)
  }

  const techniques: Array<() => boolean> = [
    // naked single
    () => {
      let did = false
      for (let i = 0; i < 81; i++) {
        if (vals[i]) continue
        const m = cand[i] as number
        if (popcount(m) === 1) {
          place(i, lowestDigit(m))
          did = true
        }
      }
      return did
    },
    // hidden single
    () => {
      let did = false
      for (const unit of UNITS) {
        for (let d = 1; d <= 9; d++) {
          const bit = 1 << d
          let where = -1
          let n = 0
          let placed = false
          for (const i of unit) {
            if (vals[i] === d) {
              placed = true
              break
            }
            if (!vals[i] && (cand[i] as number) & bit) {
              n++
              where = i
            }
          }
          if (!placed && n === 1) {
            place(where, d)
            did = true
          }
        }
      }
      return did
    },
    // naked pair
    () => {
      let did = false
      for (const unit of UNITS) {
        for (let a = 0; a < 9; a++) {
          const i = unit[a] as number
          if (vals[i] || popcount(cand[i] as number) !== 2) continue
          for (let b = a + 1; b < 9; b++) {
            const j = unit[b] as number
            if (vals[j] || cand[j] !== cand[i]) continue
            const m = cand[i] as number
            for (const k of unit) {
              if (k === i || k === j || vals[k]) continue
              if ((cand[k] as number) & m) {
                cand[k] = (cand[k] as number) & ~m
                did = true
              }
            }
          }
        }
      }
      return did
    },
    // hidden pair
    () => {
      let did = false
      for (const unit of UNITS) {
        const positions: number[] = new Array<number>(10).fill(0)
        for (let d = 1; d <= 9; d++) {
          let mask = 0
          for (let a = 0; a < 9; a++) {
            const i = unit[a] as number
            if (!vals[i] && (cand[i] as number) & (1 << d)) mask |= 1 << a
          }
          positions[d] = mask
        }
        for (let d = 1; d <= 9; d++) {
          const pd = positions[d] as number
          if (popcount(pd) !== 2) continue
          for (let e = d + 1; e <= 9; e++) {
            if (positions[e] !== pd) continue
            const keep = (1 << d) | (1 << e)
            for (let a = 0; a < 9; a++) {
              if (!(pd & (1 << a))) continue
              const i = unit[a] as number
              if ((cand[i] as number) & ~keep) {
                cand[i] = (cand[i] as number) & keep
                did = true
              }
            }
          }
        }
      }
      return did
    },
    // pointing pair / triple: digit confined to one row or column within a box
    () => {
      let did = false
      for (let b = 0; b < 9; b++) {
        const box = UNITS[18 + b] as number[]
        for (let d = 1; d <= 9; d++) {
          const bit = 1 << d
          let rows = 0
          let cols = 0
          let n = 0
          for (const i of box) {
            if (!vals[i] && (cand[i] as number) & bit) {
              rows |= 1 << (ROW_OF[i] as number)
              cols |= 1 << (COL_OF[i] as number)
              n++
            }
          }
          if (n < 2) continue
          if (popcount(rows) === 1) {
            const r = lowestBit(rows)
            for (const i of UNITS[r] as number[]) {
              if (BOX_OF[i] === b || vals[i] || !((cand[i] as number) & bit)) continue
              cand[i] = (cand[i] as number) & ~bit
              did = true
            }
          }
          if (popcount(cols) === 1) {
            const c = lowestBit(cols)
            for (const i of UNITS[9 + c] as number[]) {
              if (BOX_OF[i] === b || vals[i] || !((cand[i] as number) & bit)) continue
              cand[i] = (cand[i] as number) & ~bit
              did = true
            }
          }
        }
      }
      return did
    },
    // box-line reduction: digit confined to one box within a row or column
    () => {
      let did = false
      for (let u = 0; u < 18; u++) {
        const line = UNITS[u] as number[]
        for (let d = 1; d <= 9; d++) {
          const bit = 1 << d
          let boxes = 0
          let n = 0
          for (const i of line) {
            if (!vals[i] && (cand[i] as number) & bit) {
              boxes |= 1 << (BOX_OF[i] as number)
              n++
            }
          }
          if (n < 2 || popcount(boxes) !== 1) continue
          const b = lowestBit(boxes)
          for (const i of UNITS[18 + b] as number[]) {
            if (vals[i] || !((cand[i] as number) & bit)) continue
            const inLine = u < 9 ? ROW_OF[i] === u : COL_OF[i] === u - 9
            if (inLine) continue
            cand[i] = (cand[i] as number) & ~bit
            did = true
          }
        }
      }
      return did
    },
  ]

  while (empty > 0) {
    // contradiction check
    for (let i = 0; i < 81; i++)
      if (!vals[i] && cand[i] === 0) return { solved: false, grade, uses }
    let progressed = false
    for (let g = 0; g < techniques.length; g++) {
      if ((techniques[g] as () => boolean)()) {
        uses[g] = (uses[g] as number) + 1
        if (g > grade) grade = g
        progressed = true
        break
      }
    }
    if (!progressed) return { solved: false, grade, uses }
  }
  return { solved: true, grade, uses }
}

function lowestBit(mask: number): number {
  let i = 0
  while (!(mask & (1 << i))) i++
  return i
}

/** Grade of a puzzle, or Infinity if human techniques cannot finish it. */
export function gradeOf(values: ArrayLike<number>): number {
  const r = solveWithTechniques(values)
  return r.solved ? r.grade : Infinity
}

export function isValidComplete(values: ArrayLike<number>): boolean {
  for (const unit of UNITS) {
    let seen = 0
    for (const i of unit) {
      const v = values[i] as number
      if (v < 1 || v > 9 || seen & (1 << v)) return false
      seen |= 1 << v
    }
  }
  return true
}
