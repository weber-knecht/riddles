import { useRef, useState } from 'preact/hooks'
import type { BoardProps } from '../../core/types'
import type { NonogramPuzzle, NonogramState } from './logic'

type Action = 'fill' | 'clear' | 'cross' | 'uncross' | null

interface Stroke {
  pointerId: number
  action: Action
  start: number
  axis: 'row' | 'col' | null
  cells: Set<number>
}

export function NonogramBoard({
  puzzle,
  state,
  tool,
  onChange,
}: BoardProps<NonogramPuzzle, NonogramState>) {
  const { n, rows, cols } = puzzle
  const gridRef = useRef<HTMLDivElement>(null)
  const strokeRef = useRef<Stroke | null>(null)
  const [preview, setPreview] = useState<Set<number> | null>(null)
  const [focus, setFocus] = useState<number | null>(null)

  function actionFor(start: number): Action {
    const v = state.cells[start] ?? 0
    if (tool === 'erase') return v === 0 ? null : 'clear'
    if (tool === 'pencil') return v === 1 ? null : v === 2 ? 'uncross' : 'cross'
    return v === 1 ? 'clear' : 'fill'
  }

  function applies(action: Action, i: number): boolean {
    const v = state.cells[i] ?? 0
    switch (action) {
      case 'fill':
        return v !== 1
      case 'clear':
        return v !== 0
      case 'cross':
        return v === 0
      case 'uncross':
        return v === 2
      default:
        return false
    }
  }

  function valueOf(action: Action): number {
    return action === 'fill' ? 1 : action === 'cross' ? 2 : 0
  }

  function commit(action: Action, cells: Iterable<number>) {
    const next = [...state.cells]
    let changed = false
    for (const i of cells) {
      if (!applies(action, i)) continue
      next[i] = valueOf(action)
      changed = true
    }
    if (changed) onChange({ cells: next })
  }

  function cellAt(clientX: number, clientY: number): number | null {
    const el = gridRef.current
    if (!el) return null
    const rect = el.getBoundingClientRect()
    const c = Math.floor(((clientX - rect.left) / rect.width) * n)
    const r = Math.floor(((clientY - rect.top) / rect.height) * n)
    if (r < 0 || c < 0 || r >= n || c >= n) return null
    return r * n + c
  }

  function onPointerDown(e: PointerEvent) {
    if (e.button !== 0 && e.pointerType === 'mouse') return
    const start = cellAt(e.clientX, e.clientY)
    if (start === null) return
    e.preventDefault()
    try {
      gridRef.current?.setPointerCapture(e.pointerId)
    } catch {
      // Synthetic events have no active pointer; geometry-based tracking still works.
    }
    const action = actionFor(start)
    strokeRef.current = {
      pointerId: e.pointerId,
      action,
      start,
      axis: null,
      cells: new Set([start]),
    }
    setFocus(start)
    setPreview(action ? new Set([start]) : null)
  }

  function onPointerMove(e: PointerEvent) {
    const stroke = strokeRef.current
    if (!stroke || stroke.pointerId !== e.pointerId || !stroke.action) return
    const cell = cellAt(e.clientX, e.clientY)
    if (cell === null || cell === stroke.start) return
    const r0 = Math.floor(stroke.start / n)
    const c0 = stroke.start % n
    const r = Math.floor(cell / n)
    const c = cell % n
    if (!stroke.axis) {
      if (r === r0 && c === c0) return
      stroke.axis = Math.abs(c - c0) >= Math.abs(r - r0) ? 'row' : 'col'
    }
    // Paint the straight run from the start to the pointer along the locked axis.
    const cells = new Set<number>()
    if (stroke.axis === 'row') {
      const [a, b] = c < c0 ? [c, c0] : [c0, c]
      for (let x = a; x <= b; x++) cells.add(r0 * n + x)
    } else {
      const [a, b] = r < r0 ? [r, r0] : [r0, r]
      for (let y = a; y <= b; y++) cells.add(y * n + c0)
    }
    stroke.cells = cells
    setPreview(new Set(cells))
  }

  function onPointerUp(e: PointerEvent) {
    const stroke = strokeRef.current
    if (!stroke || stroke.pointerId !== e.pointerId) return
    strokeRef.current = null
    setPreview(null)
    if (stroke.action) commit(stroke.action, stroke.cells)
  }

  function onKeyDown(e: KeyboardEvent) {
    if (focus === null && e.key.startsWith('Arrow')) {
      setFocus(0)
      e.preventDefault()
      return
    }
    if (focus === null) return
    const v = state.cells[focus] ?? 0
    if (e.key === ' ') {
      commit(v === 1 ? 'clear' : 'fill', [focus])
    } else if (e.key === 'x' || e.key === 'X') {
      if (v !== 1) commit(v === 2 ? 'uncross' : 'cross', [focus])
    } else if (e.key === 'Backspace' || e.key === 'Delete') {
      commit('clear', [focus])
    } else if (e.key.startsWith('Arrow')) {
      const dr = e.key === 'ArrowDown' ? 1 : e.key === 'ArrowUp' ? -1 : 0
      const dc = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0
      const r = (Math.floor(focus / n) + dr + n) % n
      const c = ((focus % n) + dc + n) % n
      setFocus(r * n + c)
    } else return
    e.preventDefault()
  }

  const previewAction = strokeRef.current?.action ?? null
  const cells = []
  for (let i = 0; i < n * n; i++) {
    const r = Math.floor(i / n)
    const c = i % n
    let v = state.cells[i] ?? 0
    if (preview?.has(i) && applies(previewAction, i)) v = valueOf(previewAction)
    const classes = ['cell']
    if (v === 1) classes.push('filled')
    if (v === 2) classes.push('cross')
    if (focus === i) classes.push('focus')
    if (c % 5 === 4 && c !== n - 1) classes.push('thick-r')
    if (r % 5 === 4 && r !== n - 1) classes.push('thick-b')
    cells.push(
      <div
        key={i}
        class={classes.join(' ')}
        role="gridcell"
        aria-label={`Row ${r + 1} column ${c + 1}${v === 1 ? ', filled' : v === 2 ? ', cross' : ''}`}
      >
        {v === 2 ? '×' : ''}
      </div>,
    )
  }

  const big = n > 10
  return (
    <div class={`nonogram${big ? ' big' : ''}`} tabIndex={0} onKeyDown={onKeyDown}>
      <div class="corner" />
      <div class="col-clues" style={`grid-template-columns: repeat(${n}, 1fr)`}>
        {cols.map((clue, c) => (
          <div key={c} class={`clue col${c % 5 === 4 && c !== n - 1 ? ' thick-r' : ''}`}>
            {clue.map((k, j) => (
              <span key={j}>{k}</span>
            ))}
          </div>
        ))}
      </div>
      <div class="row-clues" style={`grid-template-rows: repeat(${n}, 1fr)`}>
        {rows.map((clue, r) => (
          <div key={r} class={`clue row${r % 5 === 4 && r !== n - 1 ? ' thick-b' : ''}`}>
            {clue.map((k, j) => (
              <span key={j}>{k}</span>
            ))}
          </div>
        ))}
      </div>
      <div
        ref={gridRef}
        class="grid"
        role="grid"
        aria-label="Nonogram grid"
        style={`grid-template-columns: repeat(${n}, 1fr)`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        {cells}
      </div>
    </div>
  )
}
