import type { CheckResult, Difficulty, PuzzleLogic } from '../../core/types'
import type { Rng } from '../../core/rng'
import { GRADE, fillGrid, gradeOf } from './solver'

export interface BinairoPuzzle {
  n: number
  /** n*n cells, -1 empty, 0 or 1 given. */
  givens: number[]
}
export type BinairoSolution = number[]
export interface BinairoState {
  /** n*n cells, -1 empty, 0 or 1 entered. Given cells stay -1 here. */
  cells: number[]
}

export const GRADE_RANGE: Record<Difficulty, [number, number]> = {
  easy: [-1, GRADE.counting],
  medium: [GRADE.lineCompletion, GRADE.lineCompletion],
  hard: [GRADE.uniqueLines, GRADE.contradiction],
}
/** Share of cells kept as clues once the target grade is reached. */
export const CLUE_FRACTION: Record<Difficulty, number> = { easy: 0.4, medium: 0.32, hard: 0.25 }
export const MAX_ATTEMPTS = 200

export interface GenerateStats {
  attempts: number
  clues: number
  grade: number
}

export function generateBinairo(
  rng: Rng,
  n: number,
  difficulty: Difficulty,
): { puzzle: BinairoPuzzle; solution: BinairoSolution; stats: GenerateStats } {
  const [minGrade, maxGrade] = GRADE_RANGE[difficulty]
  const floor = Math.round(n * n * CLUE_FRACTION[difficulty])
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const solution = fillGrid(rng, n)
    const givens = solution.slice()
    const order = rng.shuffle(Array.from({ length: n * n }, (_, i) => i))
    let clues = n * n
    let grade = -1
    for (const i of order) {
      if (clues <= floor && grade >= minGrade) break
      const saved = givens[i] as number
      givens[i] = -1
      const g = gradeOf(n, givens, maxGrade)
      if (g > maxGrade) givens[i] = saved
      else {
        clues--
        grade = g
      }
    }
    // A technique-solved grid has exactly one solution: every technique only
    // places forced values, so any solution agrees with each step.
    if (grade >= minGrade && grade <= maxGrade) {
      return { puzzle: { n, givens }, solution, stats: { attempts: attempt, clues, grade } }
    }
  }
  throw new Error(`Binairo: no ${difficulty} ${n}x${n} puzzle found in ${MAX_ATTEMPTS} attempts`)
}

function generate(rng: Rng, sizeId: string, difficulty: Difficulty) {
  const n = Number(sizeId)
  if (!Number.isInteger(n) || n < 4 || n % 2) throw new Error(`Binairo: bad size ${sizeId}`)
  const { puzzle, solution } = generateBinairo(rng, n, difficulty)
  return { puzzle, solution }
}

function initialState(puzzle: BinairoPuzzle): BinairoState {
  return { cells: new Array<number>(puzzle.n * puzzle.n).fill(-1) }
}

function check(puzzle: BinairoPuzzle, solution: BinairoSolution, state: BinairoState): CheckResult {
  let complete = true
  for (let i = 0; i < puzzle.n * puzzle.n; i++) {
    if ((puzzle.givens[i] ?? -1) !== -1) continue
    const v = state.cells[i] ?? -1
    if (v !== -1 && v !== solution[i]) return 'mistakes'
    if (v === -1) complete = false
  }
  return complete ? 'solved' : 'ok'
}

export const binairoLogic: PuzzleLogic<BinairoPuzzle, BinairoSolution, BinairoState> = {
  id: 'binairo',
  name: 'Binairo',
  version: 1,
  sizes: [
    { id: '10', label: '10×10' },
    { id: '12', label: '12×12' },
  ],
  supportsPencil: false,
  generate,
  initialState,
  check,
}
