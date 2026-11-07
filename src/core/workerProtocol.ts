import type { Difficulty } from './types'

export interface GenerateRequest {
  requestId: number
  puzzleId: string
  sizeId: string
  difficulty: Difficulty
  seed: string
}

export type GenerateReply =
  | { requestId: number; ok: true; puzzle: unknown; solution: unknown; generatorVersion: number }
  | { requestId: number; ok: false; error: string }
