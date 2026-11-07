import { describe, expect, it } from 'vitest'
import { createRng, puzzleSeedString } from '../src/core/rng'
import { countSolutions, countsLogic } from '../src/puzzles/counts/logic'

function gen(seed: string) {
  return countsLogic.generate(createRng(puzzleSeedString('counts', '4', 'easy', seed)), '4', 'easy')
}

describe('counts', () => {
  it('is deterministic for a seed', () => {
    expect(gen('ABCDEF')).toEqual(gen('ABCDEF'))
  })

  it('generates unique-solution puzzles for 100 seeds', () => {
    for (let i = 0; i < 100; i++) {
      const { puzzle, solution } = gen(`S${i}`)
      expect(countSolutions(puzzle, 3)).toBe(1)
      expect(countsLogic.check(puzzle, solution, { cells: solution, pencil: [] })).toBe('solved')
    }
  })

  it('check reports ok on an empty grid and mistakes on a wrong cell', () => {
    const { puzzle, solution } = gen('CHECK1')
    const empty = countsLogic.initialState(puzzle)
    expect(countsLogic.check(puzzle, solution, empty)).toBe('ok')
    const wrongIndex = solution.findIndex((v) => v === 0)
    const cells = [...empty.cells]
    cells[wrongIndex] = 1
    expect(countsLogic.check(puzzle, solution, { ...empty, cells })).toBe('mistakes')
    const partial = solution.map((v, i) => (i % 2 === 0 ? v : 0))
    expect(countsLogic.check(puzzle, solution, { ...empty, cells: partial })).toBe('ok')
  })

  it('countSolutions sees the classic 2x2 switch as ambiguous', () => {
    expect(countSolutions({ n: 2, rows: [1, 1], cols: [1, 1] }, 5)).toBe(2)
    expect(countSolutions({ n: 2, rows: [2, 0], cols: [1, 1] }, 5)).toBe(1)
  })
})
