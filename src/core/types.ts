import type { ComponentType } from 'preact'
import type { Rng } from './rng'

export type Difficulty = 'easy' | 'medium' | 'hard'
export const DIFFICULTIES: readonly Difficulty[] = ['easy', 'medium', 'hard']
export const DIFFICULTY_LABEL: Record<Difficulty, string> = {
  easy: 'Easy',
  medium: 'Medium',
  hard: 'Hard',
}

export type Tool = 'pen' | 'pencil' | 'erase'
export type CheckResult = 'solved' | 'mistakes' | 'ok'

export interface SizeOption {
  id: string
  label: string
}

/**
 * Puzzle-specific logic. Must not touch the DOM or import Preact: it runs
 * inside the generation worker and in Node for tests.
 *
 * Puzzle, solution and state must be plain JSON values (objects, arrays,
 * strings, numbers, booleans, null). The shell persists them with JSON.
 */
export interface PuzzleLogic<P = unknown, S = unknown, St = unknown> {
  id: string
  name: string
  /** Generator version, stored with saved games for diagnostics. */
  version: number
  sizes: SizeOption[]
  supportsPencil: boolean
  /** Label for the pencil tool when it means something else, e.g. 'Cross'. */
  pencilLabel?: string
  generate(rng: Rng, sizeId: string, difficulty: Difficulty): { puzzle: P; solution: S }
  initialState(puzzle: P): St
  check(puzzle: P, solution: S, state: St): CheckResult
}

export interface BoardProps<P = unknown, St = unknown> {
  puzzle: P
  state: St
  tool: Tool
  onChange(next: St): void
}

export interface PuzzlePlugin<P = unknown, S = unknown, St = unknown> {
  logic: PuzzleLogic<P, S, St>
  Board: ComponentType<BoardProps<P, St>>
}
