import type { PuzzlePlugin } from '../../core/types'
import { countsLogic, type CountsPuzzle, type CountsSolution, type CountsState } from './logic'
import { CountsBoard } from './Board'

export const countsPlugin: PuzzlePlugin<CountsPuzzle, CountsSolution, CountsState> = {
  logic: countsLogic,
  Board: CountsBoard,
}
