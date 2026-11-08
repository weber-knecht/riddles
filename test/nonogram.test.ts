import { describe, expect, it } from 'vitest'
import { createRng, puzzleSeedString } from '../src/core/rng'
import {
  GRADE,
  cluesOf,
  countSolutions,
  gradeOf,
  isComplete,
  lineSolve,
  runsOf,
  solveWithTechniques,
} from '../src/puzzles/nonogram/solver'
import { GRADE_RANGE, generateNonogram, nonogramLogic } from '../src/puzzles/nonogram/logic'
import type { Difficulty } from '../src/core/types'

const L = (s: string) => s.split('').map((ch) => (ch === '#' ? 1 : ch === 'x' ? 2 : 0))

describe('nonogram solver', () => {
  it('derives runs', () => {
    expect(runsOf([1, 1, 0, 1, 0, 0, 1, 1, 1])).toEqual([2, 1, 3])
    expect(runsOf([0, 0, 0])).toEqual([0])
  })

  it('line-solves overlaps and edges', () => {
    expect(lineSolve([3], L('.....'))).toEqual(L('..#..'))
    expect(lineSolve([1, 1], L('...'))).toEqual(L('#x#'))
    expect(lineSolve([2], L('#..'))).toEqual(L('##x'))
    expect(lineSolve([5], L('.....'))).toEqual(L('#####'))
    expect(lineSolve([0], L('...'))).toEqual(L('xxx'))
    expect(lineSolve([2, 2], L('.....'))).toEqual(L('##x##'))
    expect(lineSolve([1], L('..#..'))).toEqual(L('xx#xx'))
    expect(lineSolve([3], L('.x....'))).toEqual(L('.x.##.').map((v, i) => (i === 0 ? 2 : v)))
  })

  it('reports contradictions', () => {
    expect(lineSolve([2], L('#x.'))).toBeNull()
    expect(lineSolve([0], L('.#.'))).toBeNull()
    expect(lineSolve([4], L('..x..'))).toBeNull()
  })

  it('solves and counts a small picture', () => {
    const pic = [1, 1, 0, 0, 1, 0, 1, 0, 1, 0, 0, 1, 1, 1, 1, 1, 0, 0, 0, 1, 0, 1, 0, 1, 0]
    const puzzle = cluesOf(5, pic)
    const r = solveWithTechniques(puzzle)
    expect(r.solved).toBe(true)
    expect(isComplete(puzzle, r.grid)).toBe(true)
    expect(r.grid.map((v) => (v === 1 ? 1 : 0))).toEqual(pic)
    expect(countSolutions(puzzle, 2)).toBe(1)
    // A 2x2 checkerboard clue set has two solutions.
    const amb = { n: 2, rows: [[1], [1]], cols: [[1], [1]] }
    expect(countSolutions(amb, 3)).toBe(2)
    expect(gradeOf(amb)).toBe(Infinity)
  })

  it('check ignores crosses', () => {
    const pic = [1, 0, 0, 1]
    const puzzle = cluesOf(2, pic)
    const st = nonogramLogic.initialState(puzzle)
    expect(nonogramLogic.check(puzzle, pic, st)).toBe('ok')
    expect(nonogramLogic.check(puzzle, pic, { cells: [1, 2, 2, 1] })).toBe('solved')
    expect(nonogramLogic.check(puzzle, pic, { cells: [1, 1, 0, 0] })).toBe('mistakes')
    expect(nonogramLogic.check(puzzle, pic, { cells: [1, 2, 0, 0] })).toBe('ok')
  })
})

describe('nonogram generator', () => {
  const SEEDS = 50
  for (const n of [10, 15]) {
    for (const difficulty of ['easy', 'medium', 'hard'] as Difficulty[]) {
      it(`produces unique ${difficulty} ${n}x${n} puzzles of the right grade for ${SEEDS} seeds`, () => {
        const [min, max] = GRADE_RANGE[difficulty]
        let totalMs = 0
        let maxMs = 0
        let attempts = 0
        let fill = 0
        let avgRun = 0
        let verifyMs = 0
        for (let s = 0; s < SEEDS; s++) {
          const rng = createRng(puzzleSeedString('nonogram', String(n), difficulty, `T${s}`))
          const t0 = performance.now()
          const { puzzle, solution, stats } = generateNonogram(rng, n, difficulty)
          const ms = performance.now() - t0
          totalMs += ms
          maxMs = Math.max(maxMs, ms)
          attempts += stats.attempts
          fill += stats.fill
          avgRun += stats.avgRun
          expect(cluesOf(n, solution)).toEqual(puzzle)
          const t1 = performance.now()
          expect(countSolutions(puzzle, 2)).toBe(1)
          verifyMs += performance.now() - t1
          const grade = gradeOf(puzzle)
          expect(grade).toBeGreaterThanOrEqual(min)
          expect(grade).toBeLessThanOrEqual(max)
          expect(ms).toBeLessThan(500)
        }
        process.stdout.write(
          `  ${n}x${n} ${difficulty}: avg ${(totalMs / SEEDS).toFixed(0)} ms, max ${maxMs.toFixed(0)} ms, ` +
            `avg attempts ${(attempts / SEEDS).toFixed(1)}, fill ${((fill / SEEDS) * 100).toFixed(0)}%, ` +
            `avg run ${(avgRun / SEEDS).toFixed(2)}, uniqueness check avg ${(verifyMs / SEEDS).toFixed(0)} ms\n`,
        )
      }, 120_000)
    }
  }

  it('is deterministic for a seed', () => {
    const a = generateNonogram(createRng('det'), 10, 'medium')
    const b = generateNonogram(createRng('det'), 10, 'medium')
    expect(a.puzzle).toEqual(b.puzzle)
    expect(a.solution).toEqual(b.solution)
  })

  it('grades a hard puzzle as needing contradiction search', () => {
    const { puzzle } = generateNonogram(createRng('hard'), 10, 'hard')
    expect(solveWithTechniques(puzzle, GRADE.lineSolving).solved).toBe(false)
    expect(solveWithTechniques(puzzle).solved).toBe(true)
  })
})
