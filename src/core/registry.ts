import type { PuzzlePlugin } from './types'
import { countsPlugin } from '../puzzles/counts'
import { sudokuPlugin } from '../puzzles/sudoku'
import { binairoPlugin } from '../puzzles/binairo'
import { nonogramPlugin } from '../puzzles/nonogram'

/**
 * All puzzle plugins in menu order. Plugins are typed with their own
 * puzzle/state types; the shell only ever passes a plugin's own data back
 * to it, so the erasure to the unknown-typed PuzzlePlugin is safe.
 */
export const plugins: PuzzlePlugin[] = [
  sudokuPlugin as unknown as PuzzlePlugin,
  binairoPlugin as unknown as PuzzlePlugin,
  nonogramPlugin as unknown as PuzzlePlugin,
  countsPlugin as unknown as PuzzlePlugin,
]

export const pluginById: Record<string, PuzzlePlugin> = Object.fromEntries(
  plugins.map((p) => [p.logic.id, p]),
)
