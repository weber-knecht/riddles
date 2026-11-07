import { describe, expect, it } from 'vitest'
import { createRng, puzzleSeedString } from '../src/core/rng'
import {
  countSolutions,
  fillGrid,
  gradeOf,
  isValidComplete,
  solveWithTechniques,
  GRADE,
} from '../src/puzzles/sudoku/solver'
import { GRADE_RANGE, generateSudoku, sudokuLogic } from '../src/puzzles/sudoku/logic'
import type { Difficulty } from '../src/core/types'

const parse = (s: string) =>
  s
    .replace(/[^0-9.]/g, '')
    .split('')
    .map((ch) => (ch === '.' ? 0 : Number(ch)))

// Wikipedia's example puzzle and its solution.
const WIKI = parse(
  '530070000600195000098000060800060003400803001700020006060000280000419005000080079',
)
const WIKI_SOLUTION = parse(
  '534678912672195348198342567859761423426853791713924856961537284287419635345286179',
)

describe('sudoku solver', () => {
  it('counts exactly one solution for a known puzzle', () => {
    expect(countSolutions(WIKI, 2)).toBe(1)
  })

  it('detects multiple solutions', () => {
    expect(countSolutions(new Array(81).fill(0), 2)).toBe(2)
    const sparse = WIKI.map((v, i) => (i < 9 ? v : 0))
    expect(countSolutions(sparse, 2)).toBe(2)
  })

  it('detects a contradiction', () => {
    const bad = WIKI.slice()
    bad[1] = 5 // duplicate 5 in row 0
    expect(countSolutions(bad, 2)).toBe(0)
  })

  it('fills a valid complete grid deterministically', () => {
    const a = fillGrid(createRng('fill'))
    const b = fillGrid(createRng('fill'))
    expect(a).toEqual(b)
    expect(isValidComplete(a)).toBe(true)
    expect(fillGrid(createRng('other'))).not.toEqual(a)
  })

  it('solves the known puzzle with techniques and reaches the solution', () => {
    const r = solveWithTechniques(WIKI)
    expect(r.solved).toBe(true)
    expect(r.grade).toBeLessThanOrEqual(GRADE.hiddenSingle)
    expect(countSolutions(WIKI, 2)).toBe(1)
  })

  it('check reports the three states', () => {
    const puzzle = { givens: WIKI }
    const empty = sudokuLogic.initialState(puzzle)
    expect(sudokuLogic.check(puzzle, WIKI_SOLUTION, empty)).toBe('ok')
    const full = { ...empty, values: WIKI_SOLUTION.map((v, i) => (WIKI[i] ? 0 : v)) }
    expect(sudokuLogic.check(puzzle, WIKI_SOLUTION, full)).toBe('solved')
    const wrong = { ...empty, values: empty.values.slice() }
    const firstEmpty = WIKI.indexOf(0)
    wrong.values[firstEmpty] = WIKI_SOLUTION[firstEmpty] === 1 ? 2 : 1
    expect(sudokuLogic.check(puzzle, WIKI_SOLUTION, wrong)).toBe('mistakes')
  })
})

describe('sudoku generator', () => {
  const SEEDS = 50
  for (const difficulty of ['easy', 'medium', 'hard'] as Difficulty[]) {
    it(`produces unique ${difficulty} puzzles of the right grade for ${SEEDS} seeds`, () => {
      const [min, max] = GRADE_RANGE[difficulty]
      let totalMs = 0
      let maxMs = 0
      let attempts = 0
      let clues = 0
      for (let s = 0; s < SEEDS; s++) {
        const rng = createRng(puzzleSeedString('sudoku', '9', difficulty, `T${s}`))
        const t0 = performance.now()
        const { puzzle, solution, stats } = generateSudoku(rng, difficulty)
        const ms = performance.now() - t0
        totalMs += ms
        maxMs = Math.max(maxMs, ms)
        attempts += stats.attempts
        clues += stats.clues
        expect(countSolutions(puzzle.givens, 2)).toBe(1)
        expect(isValidComplete(solution)).toBe(true)
        for (let i = 0; i < 81; i++)
          if (puzzle.givens[i]) expect(puzzle.givens[i]).toBe(solution[i])
        const grade = gradeOf(puzzle.givens)
        expect(grade).toBeGreaterThanOrEqual(min)
        expect(grade).toBeLessThanOrEqual(max)
        expect(ms).toBeLessThan(500)
      }
      process.stdout.write(
        `  ${difficulty}: avg ${(totalMs / SEEDS).toFixed(0)} ms, max ${maxMs.toFixed(0)} ms, ` +
          `avg attempts ${(attempts / SEEDS).toFixed(1)}, avg clues ${(clues / SEEDS).toFixed(1)}\n`,
      )
    }, 120_000)
  }

  it('is deterministic for a seed', () => {
    const a = generateSudoku(createRng('det'), 'medium')
    const b = generateSudoku(createRng('det'), 'medium')
    expect(a.puzzle).toEqual(b.puzzle)
    expect(a.solution).toEqual(b.solution)
  })
})
