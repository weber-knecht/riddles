import type { CheckResult, Difficulty, PuzzleLogic } from '../../core/types'
import type { Rng } from '../../core/rng'
import { GRADE, countSolutions, fillGrid, gradeOf } from './solver'

export interface SudokuPuzzle {
  /** 81 digits, 0 for empty. */
  givens: number[]
}
export type SudokuSolution = number[]
export interface SudokuState {
  /** Player's pen digits, 0 for empty. Given cells stay 0 here. */
  values: number[]
  /** Pencil marks per cell as a bitmask (bit d = digit d). */
  marks: number[]
}

/** Grade bounds per difficulty: [min, max] inclusive, see docs/puzzles/sudoku.md. */
export const GRADE_RANGE: Record<Difficulty, [number, number]> = {
  easy: [-1, GRADE.hiddenSingle],
  medium: [GRADE.nakedPair, GRADE.hiddenPair],
  hard: [GRADE.pointing, GRADE.boxLine],
}
/**
 * Once the target grade is reached, stop removing clues at this many, so
 * easy and medium stay pleasant rather than long and hard stays printable.
 */
export const CLUE_FLOOR: Record<Difficulty, number> = { easy: 36, medium: 30, hard: 26 }
export const MAX_ATTEMPTS = 200

export interface GenerateStats {
  attempts: number
  clues: number
  grade: number
}

export function generateSudoku(
  rng: Rng,
  difficulty: Difficulty,
): { puzzle: SudokuPuzzle; solution: SudokuSolution; stats: GenerateStats } {
  const [minGrade, maxGrade] = GRADE_RANGE[difficulty]
  const floor = CLUE_FLOOR[difficulty]
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const solution = fillGrid(rng)
    const givens = solution.slice()
    const order = rng.shuffle(Array.from({ length: 81 }, (_, i) => i))
    let clues = 81
    let grade = -1
    for (const i of order) {
      if (clues <= floor && grade >= minGrade) break
      const saved = givens[i] as number
      givens[i] = 0
      // A puzzle the technique solver finishes has exactly one solution, so
      // the grade check doubles as the uniqueness check.
      const g = gradeOf(givens)
      if (g > maxGrade) givens[i] = saved
      else {
        clues--
        grade = g
      }
    }
    if (grade >= minGrade && grade <= maxGrade && countSolutions(givens, 2) === 1) {
      return { puzzle: { givens }, solution, stats: { attempts: attempt, clues, grade } }
    }
  }
  throw new Error(`Sudoku: no ${difficulty} puzzle found in ${MAX_ATTEMPTS} attempts`)
}

function generate(rng: Rng, _sizeId: string, difficulty: Difficulty) {
  const { puzzle, solution } = generateSudoku(rng, difficulty)
  return { puzzle, solution }
}

function initialState(_puzzle: SudokuPuzzle): SudokuState {
  return { values: new Array<number>(81).fill(0), marks: new Array<number>(81).fill(0) }
}

function check(puzzle: SudokuPuzzle, solution: SudokuSolution, state: SudokuState): CheckResult {
  let complete = true
  for (let i = 0; i < 81; i++) {
    if (puzzle.givens[i]) continue
    const v = state.values[i] ?? 0
    if (v !== 0 && v !== solution[i]) return 'mistakes'
    if (v === 0) complete = false
  }
  return complete ? 'solved' : 'ok'
}

export const sudokuLogic: PuzzleLogic<SudokuPuzzle, SudokuSolution, SudokuState> = {
  id: 'sudoku',
  name: 'Sudoku',
  version: 1,
  sizes: [{ id: '9', label: '9×9' }],
  supportsPencil: true,
  generate,
  initialState,
  check,
}
