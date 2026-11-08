import { useState } from 'preact/hooks'
import type { BoardProps } from '../../core/types'
import type { BinairoPuzzle, BinairoState } from './logic'

export function BinairoBoard({
  puzzle,
  state,
  tool,
  onChange,
}: BoardProps<BinairoPuzzle, BinairoState>) {
  const { n, givens } = puzzle
  const [focus, setFocus] = useState<number | null>(null)

  function setCell(i: number, v: number) {
    if ((givens[i] ?? -1) !== -1) return
    if ((state.cells[i] ?? -1) === v) return
    const cells = [...state.cells]
    cells[i] = v
    onChange({ cells })
  }

  function tapCell(i: number) {
    if ((givens[i] ?? -1) !== -1) return
    setFocus(i)
    const current = state.cells[i] ?? -1
    if (tool === 'erase') setCell(i, -1)
    else setCell(i, current === -1 ? 0 : current === 0 ? 1 : -1)
  }

  function onKeyDown(e: KeyboardEvent) {
    if (e.key === '0' || e.key === '1') {
      if (focus !== null) setCell(focus, Number(e.key))
      e.preventDefault()
    } else if (e.key === 'Backspace' || e.key === 'Delete') {
      if (focus !== null) setCell(focus, -1)
      e.preventDefault()
    } else if (e.key.startsWith('Arrow')) {
      const from = focus ?? 0
      const dr = e.key === 'ArrowDown' ? 1 : e.key === 'ArrowUp' ? -1 : 0
      const dc = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0
      let r = Math.floor(from / n)
      let c = from % n
      for (let step = 0; step < n; step++) {
        r = (r + dr + n) % n
        c = (c + dc + n) % n
        const i = r * n + c
        if ((givens[i] ?? -1) === -1) {
          setFocus(i)
          break
        }
      }
      e.preventDefault()
    }
  }

  const cells = []
  for (let i = 0; i < n * n; i++) {
    const given = givens[i] ?? -1
    const value = given !== -1 ? given : (state.cells[i] ?? -1)
    const classes = ['cell']
    if (given !== -1) classes.push('given')
    if (focus === i) classes.push('focus')
    const r = Math.floor(i / n) + 1
    const c = (i % n) + 1
    cells.push(
      <button
        key={i}
        type="button"
        class={classes.join(' ')}
        aria-label={`Row ${r} column ${c}${given !== -1 ? `, given ${given}` : value !== -1 ? `, ${value}` : ''}`}
        onClick={() => tapCell(i)}
      >
        {value === -1 ? '' : value}
      </button>,
    )
  }

  return (
    <div class="binairo" tabIndex={0} onKeyDown={onKeyDown}>
      <div
        class="grid"
        role="grid"
        aria-label="Binairo grid"
        style={`grid-template-columns: repeat(${n}, 1fr)`}
      >
        {cells}
      </div>
    </div>
  )
}
