import type { PuzzleLogic } from './types'
import { countsLogic } from '../puzzles/counts/logic'

/** Logic-only registry. The worker imports this file; it must never pull in Preact. */
export const logicById: Record<string, PuzzleLogic> = {
  [countsLogic.id]: countsLogic as PuzzleLogic,
}
