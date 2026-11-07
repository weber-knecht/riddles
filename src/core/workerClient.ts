import type { GenerateReply, GenerateRequest } from './workerProtocol'

export interface Generated {
  puzzle: unknown
  solution: unknown
  generatorVersion: number
}

const TIMEOUT_MS = 15_000

type Pending = { resolve(v: Generated): void; reject(e: Error): void; timer: number }

let worker: Worker | null = null
let nextId = 1
const pending = new Map<number, Pending>()

function getWorker(): Worker {
  if (worker) return worker
  worker = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' })
  worker.onmessage = (event: MessageEvent<GenerateReply>) => {
    const reply = event.data
    const p = pending.get(reply.requestId)
    if (!p) return
    pending.delete(reply.requestId)
    clearTimeout(p.timer)
    if (reply.ok) {
      p.resolve({
        puzzle: reply.puzzle,
        solution: reply.solution,
        generatorVersion: reply.generatorVersion,
      })
    } else {
      p.reject(new Error(reply.error))
    }
  }
  worker.onerror = (event) => {
    const error = new Error(event.message || 'Worker failed')
    for (const p of pending.values()) {
      clearTimeout(p.timer)
      p.reject(error)
    }
    pending.clear()
    worker?.terminate()
    worker = null
  }
  return worker
}

export function generatePuzzle(req: Omit<GenerateRequest, 'requestId'>): Promise<Generated> {
  const requestId = nextId++
  return new Promise<Generated>((resolve, reject) => {
    const timer = window.setTimeout(() => {
      pending.delete(requestId)
      reject(new Error('Generation timed out'))
    }, TIMEOUT_MS)
    pending.set(requestId, { resolve, reject, timer })
    getWorker().postMessage({ ...req, requestId } satisfies GenerateRequest)
  })
}
