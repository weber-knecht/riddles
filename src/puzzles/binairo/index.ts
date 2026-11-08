import type { PuzzlePlugin } from '../../core/types'
import { binairoLogic, type BinairoPuzzle, type BinairoSolution, type BinairoState } from './logic'
import { BinairoBoard } from './Board'

export const binairoPlugin: PuzzlePlugin<BinairoPuzzle, BinairoSolution, BinairoState> = {
  logic: binairoLogic,
  Board: BinairoBoard,
}
