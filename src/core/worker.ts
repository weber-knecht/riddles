import { createRng, puzzleSeedString } from './rng'
import { logicById } from './logicRegistry'
import type { GenerateReply, GenerateRequest } from './workerProtocol'

// Typed as Worker so postMessage takes one argument; lib "webworker" would clash with "dom".
const ctx = self as unknown as Worker

ctx.onmessage = (event: MessageEvent<GenerateRequest>) => {
  const req = event.data
  let reply: GenerateReply
  try {
    const logic = logicById[req.puzzleId]
    if (!logic) throw new Error(`Unknown puzzle: ${req.puzzleId}`)
    const rng = createRng(puzzleSeedString(req.puzzleId, req.sizeId, req.difficulty, req.seed))
    const { puzzle, solution } = logic.generate(rng, req.sizeId, req.difficulty)
    reply = {
      requestId: req.requestId,
      ok: true,
      puzzle,
      solution,
      generatorVersion: logic.version,
    }
  } catch (error) {
    reply = { requestId: req.requestId, ok: false, error: String(error) }
  }
  ctx.postMessage(reply)
}
