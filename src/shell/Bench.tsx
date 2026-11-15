import { useEffect, useRef, useState } from 'preact/hooks'
import { generatePuzzle } from '../core/workerClient'
import type { PuzzlePlugin } from '../core/types'

const RUNS = 10
/** Fixed seeds from the seed alphabet, so a slow one can be replayed from the menu. */
const SEEDS = Array.from({ length: RUNS }, (_, i) => `BENCH${'23456789AB'[i]}`)

interface Row {
  key: string
  name: string
  size: string
  /** Milliseconds per finished run; null marks a failed run. */
  times: (number | null)[]
  slowestSeed: string | null
}

const fmt = (ms: number) => `${Math.round(ms)} ms`

/**
 * Diagnostics page at `?bench`: generates hard puzzles of every type and
 * size in the worker and reports how long the device needs.
 */
export function Bench({ plugins }: { plugins: PuzzlePlugin[] }) {
  const [rows, setRows] = useState<Row[]>([])
  const [done, setDone] = useState(false)
  const run = useRef(0)

  async function start() {
    const myRun = ++run.current
    const next: Row[] = plugins.flatMap((p) =>
      p.logic.sizes.map((s) => ({
        key: `${p.logic.id}:${s.id}`,
        name: p.logic.name,
        size: s.label,
        times: [],
        slowestSeed: null,
      })),
    )
    setRows(next)
    setDone(false)
    // Warm-up, not measured: starts the worker and loads its code.
    const first = plugins[0]
    const firstSize = first?.logic.sizes[0]
    if (first && firstSize) {
      await generatePuzzle({
        puzzleId: first.logic.id,
        sizeId: firstSize.id,
        difficulty: 'easy',
        seed: 'WARMUP',
      }).catch(() => undefined)
    }
    for (const p of plugins) {
      for (const s of p.logic.sizes) {
        const row = next.find((r) => r.key === `${p.logic.id}:${s.id}`)
        if (!row) continue
        for (const seed of SEEDS) {
          const t0 = performance.now()
          let ms: number | null
          try {
            await generatePuzzle({ puzzleId: p.logic.id, sizeId: s.id, difficulty: 'hard', seed })
            ms = performance.now() - t0
          } catch {
            ms = null
          }
          if (run.current !== myRun) return
          const slowest = Math.max(-1, ...row.times.map((t) => t ?? Infinity))
          if ((ms ?? Infinity) > slowest) row.slowestSeed = seed
          row.times = [...row.times, ms]
          setRows([...next])
        }
      }
    }
    setDone(true)
  }

  useEffect(() => {
    void start()
    return () => {
      run.current++
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const all = rows.flatMap((r) => r.times)
  const failed = all.filter((t) => t === null).length
  const finished = all.filter((t): t is number => t !== null)
  const total = rows.length * RUNS

  return (
    <main class="bench">
      <h1>Benchmark</h1>
      <p class="muted">
        Generates {RUNS} hard puzzles per type and size on this device. The budget is 2000 ms for
        the slowest one.
      </p>
      <table>
        <thead>
          <tr>
            <th>Puzzle</th>
            <th>Average</th>
            <th>Slowest</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const ok = r.times.filter((t): t is number => t !== null)
            const anyFailed = ok.length !== r.times.length
            return (
              <tr key={r.key}>
                <td>
                  {r.name} {r.size}
                </td>
                <td>{ok.length ? fmt(ok.reduce((a, b) => a + b, 0) / ok.length) : '…'}</td>
                <td>
                  {anyFailed
                    ? `failed (${r.slowestSeed})`
                    : ok.length
                      ? `${fmt(Math.max(...ok))} (${r.slowestSeed})`
                      : '…'}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
      <p role="status">
        {done
          ? failed > 0
            ? `Done. ${failed} of ${total} did not finish within the time limit.`
            : `Done. Slowest overall: ${fmt(Math.max(...finished))}.`
          : `Running ${all.length} of ${total}…`}
      </p>
      <div class="row">
        <button class="primary" disabled={!done} onClick={() => void start()}>
          Run again
        </button>
        <button onClick={() => location.assign(import.meta.env.BASE_URL)}>Back to the app</button>
      </div>
    </main>
  )
}
