import { describe, expect, it } from 'vitest'
import { createRng, puzzleSeedString } from '../src/core/rng'
import {
  GRADE,
  countSolutions,
  fillGrid,
  gradeOf,
  hasViolation,
  isValidComplete,
  lineFillings,
  lineKey,
  solveWithTechniques,
  validRows,
} from '../src/puzzles/binairo/solver'
import { GRADE_RANGE, binairoLogic, generateBinairo } from '../src/puzzles/binairo/logic'
import type { Difficulty } from '../src/core/types'

const g = (s: string) => s.split('').map((ch) => (ch === '.' ? -1 : Number(ch)))
const GRID4 = g('0110' + '1001' + '0101' + '1010')

describe('binairo solver', () => {
  it('enumerates valid rows', () => {
    expect(validRows(4).map((r) => r.join(''))).toEqual([
      '0011',
      '0101',
      '0110',
      '1001',
      '1010',
      '1100',
    ])
    expect(validRows(6).every((r) => r.length === 6)).toBe(true)
  })

  it('validates a complete grid and spots violations', () => {
    expect(isValidComplete(4, GRID4)).toBe(true)
    const dupRows = g('0110' + '0110' + '1001' + '1001')
    expect(isValidComplete(4, dupRows)).toBe(false)
    expect(hasViolation(4, g('00..' + '....' + '....' + '....'))).toBe(false)
    expect(hasViolation(4, g('000.' + '....' + '....' + '....'))).toBe(true)
    expect(hasViolation(4, g('0110' + '0110' + '....' + '....'))).toBe(true)
  })

  it('finds forced cells in a line', () => {
    const { count, forced } = lineFillings(g('00..11'))
    expect(count).toBe(1)
    expect(forced).toEqual([0, 0, 1, 0, 1, 1])
    const open = lineFillings(g('......'))
    expect(open.count).toBeGreaterThanOrEqual(2)
    expect(open.forced.every((v) => v === -1)).toBe(true)
    expect(lineFillings(g('0.0.00')).count).toBe(0)
    // Exclusion: with 0110 taken, 01.. in a 4-line must become 0101.
    expect(lineFillings(g('01..'), new Set([lineKey(g('0110'))])).forced).toEqual([0, 1, 0, 1])
  })

  it('counts solutions', () => {
    expect(countSolutions(4, GRID4, 2)).toBe(1)
    expect(countSolutions(4, new Array(16).fill(-1), 5)).toBeGreaterThanOrEqual(2)
    expect(countSolutions(4, g('0110' + '....' + '....' + '....'), 3)).toBeGreaterThanOrEqual(1)
  })

  it('fills valid grids deterministically', () => {
    for (const n of [6, 10, 12]) {
      const a = fillGrid(createRng(`fill${n}`), n)
      expect(isValidComplete(n, a)).toBe(true)
      expect(fillGrid(createRng(`fill${n}`), n)).toEqual(a)
    }
  })

  it('solves with techniques', () => {
    const full = solveWithTechniques(4, GRID4)
    expect(full.solved).toBe(true)
    expect(full.grade).toBe(-1)
    const easy = g('0.1.' + '1..1' + '..0.' + '1.1.')
    const r = solveWithTechniques(4, easy)
    expect(r.solved).toBe(true)
    expect(r.grade).toBeLessThanOrEqual(GRADE.counting)
  })

  it('check reports the three states', () => {
    const puzzle = { n: 4, givens: g('0.1.' + '1..1' + '..0.' + '1.1.') }
    const empty = binairoLogic.initialState(puzzle)
    expect(binairoLogic.check(puzzle, GRID4, empty)).toBe('ok')
    const full = { cells: GRID4.map((v, i) => (puzzle.givens[i] === -1 ? v : -1)) }
    expect(binairoLogic.check(puzzle, GRID4, full)).toBe('solved')
    const wrong = { cells: empty.cells.slice() }
    wrong.cells[1] = 1 - (GRID4[1] as number)
    expect(binairoLogic.check(puzzle, GRID4, wrong)).toBe('mistakes')
  })
})

describe('binairo generator', () => {
  const SEEDS = 50
  for (const n of [10, 12]) {
    for (const difficulty of ['easy', 'medium', 'hard'] as Difficulty[]) {
      it(`produces unique ${difficulty} ${n}x${n} puzzles of the right grade for ${SEEDS} seeds`, () => {
        const [min, max] = GRADE_RANGE[difficulty]
        let totalMs = 0
        let maxMs = 0
        let attempts = 0
        let clues = 0
        let verifyMs = 0
        for (let s = 0; s < SEEDS; s++) {
          const rng = createRng(puzzleSeedString('binairo', String(n), difficulty, `T${s}`))
          const t0 = performance.now()
          const { puzzle, solution, stats } = generateBinairo(rng, n, difficulty)
          const ms = performance.now() - t0
          totalMs += ms
          maxMs = Math.max(maxMs, ms)
          attempts += stats.attempts
          clues += stats.clues
          expect(isValidComplete(n, solution)).toBe(true)
          const t1 = performance.now()
          expect(countSolutions(n, puzzle.givens, 2)).toBe(1)
          verifyMs += performance.now() - t1
          for (let i = 0; i < n * n; i++)
            if (puzzle.givens[i] !== -1) expect(puzzle.givens[i]).toBe(solution[i])
          const grade = gradeOf(n, puzzle.givens)
          expect(grade).toBeGreaterThanOrEqual(min)
          expect(grade).toBeLessThanOrEqual(max)
          expect(ms).toBeLessThan(500)
        }
        process.stdout.write(
          `  ${n}x${n} ${difficulty}: avg ${(totalMs / SEEDS).toFixed(0)} ms, max ${maxMs.toFixed(0)} ms, ` +
            `avg attempts ${(attempts / SEEDS).toFixed(1)}, avg clues ${(clues / SEEDS).toFixed(1)} of ${n * n}, ` +
            `uniqueness check avg ${(verifyMs / SEEDS).toFixed(0)} ms\n`,
        )
      }, 120_000)
    }
  }

  it('is deterministic for a seed', () => {
    const a = generateBinairo(createRng('det'), 10, 'medium')
    const b = generateBinairo(createRng('det'), 10, 'medium')
    expect(a.puzzle).toEqual(b.puzzle)
  })
})
