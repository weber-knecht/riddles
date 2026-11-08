import type { PuzzleLogic } from './types'
import { countsLogic } from '../puzzles/counts/logic'
import { sudokuLogic } from '../puzzles/sudoku/logic'
import { binairoLogic } from '../puzzles/binairo/logic'

/** Logic-only registry. The worker imports this file; it must never pull in Preact. */
export const logicById: Record<string, PuzzleLogic> = {
  [countsLogic.id]: countsLogic as PuzzleLogic,
  [sudokuLogic.id]: sudokuLogic as PuzzleLogic,
  [binairoLogic.id]: binairoLogic as PuzzleLogic,
}
