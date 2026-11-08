import { useEffect, useRef, useState } from 'preact/hooks'
import { ToolRow } from './ToolRow'
import { generatePuzzle } from '../core/workerClient'
import { SCHEMA, type SavedGame, type Store } from '../core/storage'
import {
  DIFFICULTY_LABEL,
  type CheckResult,
  type Difficulty,
  type PuzzlePlugin,
  type Tool,
} from '../core/types'

export type SolveMode =
  { kind: 'continue' } | { kind: 'new'; sizeId: string; difficulty: Difficulty; seed: string }

export interface SolveProps {
  plugin: PuzzlePlugin
  mode: SolveMode
  store: Store
  onExit(): void
  /** Called after completion when the user wants another puzzle of the same kind. */
  onNewSame(game: SavedGame): void
}

type Phase =
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  | { kind: 'playing'; game: SavedGame }
  | { kind: 'solved'; game: SavedGame }

export function Solve(props: SolveProps) {
  const { plugin, mode, store } = props
  const logic = plugin.logic
  const [phase, setPhase] = useState<Phase>({ kind: 'loading' })
  const [tool, setTool] = useState<Tool>('pen')
  const [checkLine, setCheckLine] = useState<string | null>(null)
  const attempt = useRef(0)

  function start() {
    const myAttempt = ++attempt.current
    setPhase({ kind: 'loading' })
    setCheckLine(null)
    setTool('pen')
    if (mode.kind === 'continue') {
      const r = store.loadGame(logic.id)
      if (r.status === 'ok') setPhase({ kind: 'playing', game: r.value })
      else setPhase({ kind: 'error', message: 'No saved game found.' })
      return
    }
    generatePuzzle({
      puzzleId: logic.id,
      sizeId: mode.sizeId,
      difficulty: mode.difficulty,
      seed: mode.seed,
    }).then(
      (gen) => {
        if (attempt.current !== myAttempt) return
        const now = new Date().toISOString()
        const game: SavedGame = {
          schema: SCHEMA,
          puzzleId: logic.id,
          sizeId: mode.sizeId,
          difficulty: mode.difficulty,
          seed: mode.seed,
          generatorVersion: gen.generatorVersion,
          puzzle: gen.puzzle,
          solution: gen.solution,
          state: logic.initialState(gen.puzzle),
          undo: null,
          startedAt: now,
          updatedAt: now,
        }
        store.saveGame(game)
        setPhase({ kind: 'playing', game })
      },
      (error: unknown) => {
        if (attempt.current !== myAttempt) return
        setPhase({ kind: 'error', message: String(error instanceof Error ? error.message : error) })
      },
    )
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(start, [logic.id, mode])

  function update(game: SavedGame, patch: Partial<SavedGame>) {
    const next: SavedGame = { ...game, ...patch, updatedAt: new Date().toISOString() }
    store.saveGame(next)
    setPhase({ kind: 'playing', game: next })
    setCheckLine(null)
  }

  const header = (game: SavedGame | null) => (
    <div class="solve-header">
      <button onClick={props.onExit} aria-label="Back to menu">
        ←
      </button>
      <div class="title">
        <strong>{logic.name}</strong>
        {game && (
          <div class="muted">
            {logic.sizes.find((s) => s.id === game.sizeId)?.label ?? game.sizeId} ·{' '}
            {DIFFICULTY_LABEL[game.difficulty]} · Seed {game.seed}
          </div>
        )}
      </div>
    </div>
  )

  if (phase.kind === 'loading') {
    return (
      <main>
        {header(null)}
        <div class="center muted">Generating…</div>
      </main>
    )
  }

  if (phase.kind === 'error') {
    return (
      <main>
        {header(null)}
        <div class="center">
          <p class="warn">Could not generate a puzzle.</p>
          <p class="muted">{phase.message}</p>
          <div class="row">
            <button class="primary" onClick={start}>
              Try again
            </button>
            <button onClick={props.onExit}>Back</button>
          </div>
        </div>
      </main>
    )
  }

  if (phase.kind === 'solved') {
    return (
      <main>
        {header(phase.game)}
        <div class="center">
          <h2>Solved</h2>
          <div class="row">
            <button class="primary" onClick={() => props.onNewSame(phase.game)}>
              New puzzle
            </button>
            <button onClick={props.onExit}>Back to menu</button>
          </div>
        </div>
      </main>
    )
  }

  const { game } = phase
  const Board = plugin.Board

  function onCheck() {
    const result: CheckResult = logic.check(game.puzzle, game.solution, game.state)
    if (result === 'solved') {
      store.clearGame(logic.id)
      setPhase({ kind: 'solved', game })
    } else {
      setCheckLine(result === 'ok' ? 'Correct so far.' : 'Contains mistakes.')
    }
  }

  return (
    <main>
      {header(game)}
      <div class="board-frame">
        <Board
          puzzle={game.puzzle}
          state={game.state}
          tool={tool}
          onChange={(next) => update(game, { state: next, undo: game.state })}
        />
      </div>
      <ToolRow
        tool={tool}
        supportsPencil={logic.supportsPencil}
        pencilLabel={logic.pencilLabel}
        canUndo={game.undo !== null}
        onTool={setTool}
        onUndo={() => game.undo !== null && update(game, { state: game.undo, undo: null })}
        onCheck={onCheck}
      />
      <p class="check-line muted" role="status">
        {checkLine ?? ''}
      </p>
    </main>
  )
}
