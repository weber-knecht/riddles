import { Component, type ComponentChildren } from 'preact'
import { useEffect, useLayoutEffect, useRef, useState } from 'preact/hooks'
import { ToolRow } from './ToolRow'
import { cancelGeneration, generatePuzzle } from '../core/workerClient'
import { SCHEMA, type SavedGame, type Store } from '../core/storage'
import {
  DIFFICULTIES,
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

/** What the line below the tool row says: a check result or a failed save. */
type CheckLine = 'ok' | 'mistakes' | 'save-failed' | null

function CheckLineView(props: { line: CheckLine }) {
  const { line } = props
  return (
    <p class="check-line" role="status">
      {line === 'ok' && (
        <>
          <svg aria-hidden="true" width="26" height="24" viewBox="0 0 26 24">
            <path d="M3 13c3 2 5 5 6 8C12 13 17 6 24 2" />
          </svg>
          Correct so far.
        </>
      )}
      {line === 'mistakes' && (
        <>
          <svg aria-hidden="true" width="22" height="22" viewBox="0 0 22 22">
            <path d="M4 4l14 14M18 4L4 18" />
          </svg>
          Contains mistakes.
        </>
      )}
      {line === 'save-failed' && 'Progress could not be saved.'}
    </p>
  )
}

/** The puzzle number as the page heading. A long typed number is set smaller to stay on one line. */
function PuzzleNumber(props: { seed: string }) {
  const ref = useRef<HTMLHeadingElement>(null)
  useLayoutEffect(() => {
    let current = true
    const fit = () => {
      const h = ref.current
      if (!h || !current) return
      h.style.fontSize = ''
      const full = parseFloat(getComputedStyle(h).fontSize)
      if (h.scrollWidth > h.clientWidth) {
        h.style.fontSize = `${Math.floor((full * h.clientWidth) / h.scrollWidth)}px`
      }
    }
    fit()
    // The print face may arrive after the first layout and is wider than the fallback.
    void document.fonts.ready.then(fit)
    return () => {
      current = false
    }
  }, [props.seed])
  return <h1 ref={ref}>No. {props.seed}</h1>
}

/** Last line of defence: a saved game the board cannot render never leaves a blank page. */
class BoardBoundary extends Component<
  { onDiscard(): void; children: ComponentChildren },
  { failed: boolean }
> {
  state = { failed: false }
  static getDerivedStateFromError() {
    return { failed: true }
  }
  render() {
    if (!this.state.failed) return this.props.children
    return (
      <div class="trouble">
        <p class="trouble-title">This saved game could not be opened.</p>
        <button class="danger" onClick={this.props.onDiscard}>
          Discard this game
        </button>
      </div>
    )
  }
}

/** Renders its children only after a delay, so fast generations do not flash a message. */
function Delayed(props: { ms: number; children: ComponentChildren }) {
  const [show, setShow] = useState(false)
  useEffect(() => {
    const timer = setTimeout(() => setShow(true), props.ms)
    return () => clearTimeout(timer)
  }, [props.ms])
  return show ? <>{props.children}</> : null
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
  const [checkLine, setCheckLine] = useState<CheckLine>(null)
  const attempt = useRef(0)

  function start() {
    const myAttempt = ++attempt.current
    setPhase({ kind: 'loading' })
    setCheckLine(null)
    setTool('pen')
    if (mode.kind === 'continue') {
      const r = store.loadGame(logic.id, logic.version)
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
        if (!store.saveGame(game)) setCheckLine('save-failed')
        setPhase({ kind: 'playing', game })
      },
      (error: unknown) => {
        if (attempt.current !== myAttempt) return
        setPhase({ kind: 'error', message: String(error instanceof Error ? error.message : error) })
      },
    )
  }

  useEffect(() => {
    start()
    // Leaving the screen while a puzzle is still being generated cancels it.
    return () => {
      attempt.current++
      cancelGeneration()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [logic.id, mode])

  function update(game: SavedGame, patch: Partial<SavedGame>) {
    const next: SavedGame = { ...game, ...patch, updatedAt: new Date().toISOString() }
    const saved = store.saveGame(next)
    setPhase({ kind: 'playing', game: next })
    setCheckLine(saved ? null : 'save-failed')
  }

  // The page header is known before the puzzle exists: a new game brings its own details.
  const page = (game: SavedGame | null) => {
    const info = game ?? (mode.kind === 'new' ? mode : null)
    const level = info ? DIFFICULTIES.indexOf(info.difficulty) : -1
    return (
      <>
        <header class="running-head label">
          <button class="back" onClick={props.onExit} aria-label="Back to contents">
            <svg aria-hidden="true" width="14" height="14" viewBox="0 0 14 14">
              <path d="M9 2L4 7l5 5" />
            </svg>
            Contents
          </button>
          <span>Riddles</span>
        </header>
        <div class="page-title">
          <div class="what">
            <span class="label">
              {logic.name}
              {info &&
                logic.sizes.length > 1 &&
                ` · ${logic.sizes.find((s) => s.id === info.sizeId)?.label ?? info.sizeId}`}
            </span>
            {info && <PuzzleNumber seed={info.seed} />}
          </div>
          {info && (
            <div class="level">
              <div class="squares" aria-hidden="true">
                {DIFFICULTIES.map((d, i) => (
                  <span key={d} class={i <= level ? 'on' : ''} />
                ))}
              </div>
              <span>{DIFFICULTY_LABEL[info.difficulty]}</span>
            </div>
          )}
        </div>
      </>
    )
  }

  if (phase.kind === 'loading') {
    return (
      <main class="page">
        {page(null)}
        <Delayed ms={300}>
          <p class="loading" role="status">
            Printing your puzzle…
          </p>
        </Delayed>
      </main>
    )
  }

  if (phase.kind === 'error') {
    return (
      <main class="page">
        {page(null)}
        <div class="trouble">
          <p class="trouble-title">Could not generate a puzzle.</p>
          <p class="trouble-detail">{phase.message}</p>
          <div class="pair">
            <button class="primary" onClick={start}>
              Try again
            </button>
            <button onClick={props.onExit}>Back</button>
          </div>
        </div>
      </main>
    )
  }

  // The solved page is the playing page with the board left as it was finished.
  const { game } = phase
  const solved = phase.kind === 'solved'
  const Board = plugin.Board

  function onCheck() {
    const result: CheckResult = logic.check(game.puzzle, game.solution, game.state)
    if (result === 'solved') {
      store.clearGame(logic.id)
      setPhase({ kind: 'solved', game })
    } else {
      setCheckLine(result)
    }
  }

  return (
    <main class="page">
      {page(game)}
      <div class={`board-frame${solved ? ' solved' : ''}`}>
        <BoardBoundary
          onDiscard={() => {
            store.clearGame(logic.id)
            props.onExit()
          }}
        >
          <Board
            puzzle={game.puzzle}
            state={game.state}
            tool={tool}
            onChange={(next) => update(game, { state: next, undo: game.state })}
            readOnly={solved}
          />
        </BoardBoundary>
        {solved && <h2 class="stamp">Solved</h2>}
      </div>
      {solved ? (
        <div class="pair solved-actions">
          <button class="primary" onClick={() => props.onNewSame(game)}>
            Next puzzle
          </button>
          <button onClick={props.onExit}>Contents</button>
        </div>
      ) : (
        <>
          <ToolRow
            tool={tool}
            supportsPencil={logic.supportsPencil}
            pencilLabel={logic.pencilLabel}
            pencilIcon={logic.pencilIcon}
            canUndo={game.undo !== null}
            onTool={setTool}
            onUndo={() => game.undo !== null && update(game, { state: game.undo, undo: null })}
            onCheck={onCheck}
          />
          <CheckLineView line={checkLine} />
        </>
      )}
    </main>
  )
}
