import type { PuzzlePlugin } from '../../core/types'
import { sudokuLogic, type SudokuPuzzle, type SudokuSolution, type SudokuState } from './logic'
import { SudokuBoard } from './Board'

export const sudokuPlugin: PuzzlePlugin<SudokuPuzzle, SudokuSolution, SudokuState> = {
  logic: sudokuLogic,
  Board: SudokuBoard,
}
