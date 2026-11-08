import type { CheckResult, Difficulty, PuzzleLogic } from '../../core/types'
import type { Rng } from '../../core/rng'
import { GRADE, cluesOf, solveWithTechniques, type NonogramClues } from './solver'

export type NonogramPuzzle = NonogramClues
/** n*n picture, 1 filled, 0 empty. */
export type NonogramSolution = number[]
export interface NonogramState {
  /** 0 unknown, 1 filled, 2 cross (a note only). */
  cells: number[]
}

export const GRADE_RANGE: Record<Difficulty, [number, number]> = {
  easy: [-1, GRADE.lineSolving],
  medium: [-1, GRADE.lineSolving],
  hard: [GRADE.contradiction, GRADE.contradiction],
}
export const DENSITY: Record<Difficulty, number> = { easy: 0.6, medium: 0.5, hard: 0.5 }
export const SMOOTHING: Record<Difficulty, number> = { easy: 1, medium: 0, hard: 0 }
export const MAX_ATTEMPTS = 200

export interface GenerateStats {
  attempts: number
  fill: number
  avgRun: number
  grade: number
}

export function randomPicture(rng: Rng, n: number, density: number, smoothing: number): number[] {
  let pic = Array.from({ length: n * n }, () => (rng.next() < density ? 1 : 0))
  for (let pass = 0; pass < smoothing; pass++) {
    const next = pic.slice()
    for (let r = 0; r < n; r++) {
      for (let c = 0; c < n; c++) {
        let ones = 0
        let total = 0
        for (let dr = -1; dr <= 1; dr++) {
          for (let dc = -1; dc <= 1; dc++) {
            const rr = r + dr
            const cc = c + dc
            if (rr < 0 || cc < 0 || rr >= n || cc >= n) continue
            total++
            ones += pic[rr * n + cc] as number
          }
        }
        if (ones * 2 > total) next[r * n + c] = 1
        else if (ones * 2 < total) next[r * n + c] = 0
      }
    }
    pic = next
  }
  return pic
}

function avgRunLength(puzzle: NonogramClues): number {
  let sum = 0
  let count = 0
  for (const line of [...puzzle.rows, ...puzzle.cols]) {
    for (const run of line) {
      if (run === 0) continue
      sum += run
      count++
    }
  }
  return count ? sum / count : 0
}

/** Hard: how many single-cell flips to try from a line-solvable picture before starting over. */
export const WALK_STEPS = 400

export function generateNonogram(
  rng: Rng,
  n: number,
  difficulty: Difficulty,
): { puzzle: NonogramPuzzle; solution: NonogramSolution; stats: GenerateStats } {
  const [minGrade, maxGrade] = GRADE_RANGE[difficulty]
  const finish = (picture: number[], puzzle: NonogramClues, grade: number, attempts: number) => ({
    puzzle,
    solution: picture,
    stats: {
      attempts,
      fill: picture.reduce((a, b) => a + b, 0) / (n * n),
      avgRun: avgRunLength(puzzle),
      grade,
    },
  })
  let evaluations = 0
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const picture = randomPicture(rng, n, DENSITY[difficulty], SMOOTHING[difficulty])
    const puzzle = cluesOf(n, picture)
    evaluations++
    const first = solveWithTechniques(puzzle, maxGrade)
    const grade = first.solved ? first.grade : Infinity
    if (grade >= minGrade && grade <= maxGrade) return finish(picture, puzzle, grade, evaluations)
    if (difficulty !== 'hard' || grade !== GRADE.lineSolving) continue
    // Hard: climb from this unique, line-solvable picture by flipping single
    // cells. A flip is kept when line solving gets at least as laborious
    // (the puzzle stays unique), reverted when the puzzle becomes ambiguous
    // or easier, and the walk ends when contradiction search is needed.
    let work = first.work
    for (let step = 0; step < WALK_STEPS; step++) {
      const i = rng.int(n * n)
      picture[i] = 1 - (picture[i] as number)
      const candidate = cluesOf(n, picture)
      evaluations++
      const r = solveWithTechniques(candidate, maxGrade)
      if (r.solved && r.grade === GRADE.contradiction)
        return finish(picture, candidate, r.grade, evaluations)
      if (r.solved && r.work >= work) work = r.work
      else picture[i] = 1 - (picture[i] as number)
    }
  }
  throw new Error(`Nonogram: no ${difficulty} ${n}x${n} puzzle found in ${MAX_ATTEMPTS} attempts`)
}

function generate(rng: Rng, sizeId: string, difficulty: Difficulty) {
  const n = Number(sizeId)
  if (!Number.isInteger(n) || n < 5) throw new Error(`Nonogram: bad size ${sizeId}`)
  const { puzzle, solution } = generateNonogram(rng, n, difficulty)
  return { puzzle, solution }
}

function initialState(puzzle: NonogramPuzzle): NonogramState {
  return { cells: new Array<number>(puzzle.n * puzzle.n).fill(0) }
}

function check(
  puzzle: NonogramPuzzle,
  solution: NonogramSolution,
  state: NonogramState,
): CheckResult {
  let complete = true
  for (let i = 0; i < puzzle.n * puzzle.n; i++) {
    const filled = state.cells[i] === 1
    const want = solution[i] === 1
    if (filled && !want) return 'mistakes'
    if (want && !filled) complete = false
  }
  return complete ? 'solved' : 'ok'
}

export const nonogramLogic: PuzzleLogic<NonogramPuzzle, NonogramSolution, NonogramState> = {
  id: 'nonogram',
  name: 'Nonogram',
  version: 1,
  sizes: [
    { id: '10', label: '10×10' },
    { id: '15', label: '15×15' },
  ],
  supportsPencil: true,
  pencilLabel: 'Cross',
  generate,
  initialState,
  check,
}
