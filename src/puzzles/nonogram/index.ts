import type { PuzzlePlugin } from '../../core/types'
import {
  nonogramLogic,
  type NonogramPuzzle,
  type NonogramSolution,
  type NonogramState,
} from './logic'
import { NonogramBoard } from './Board'

export const nonogramPlugin: PuzzlePlugin<NonogramPuzzle, NonogramSolution, NonogramState> = {
  logic: nonogramLogic,
  Board: NonogramBoard,
}
