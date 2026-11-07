import { useState } from 'preact/hooks'
import type { BoardProps } from '../../core/types'
import type { SudokuPuzzle, SudokuState } from './logic'

const DIGITS = [1, 2, 3, 4, 5, 6, 7, 8, 9]

export function SudokuBoard({
  puzzle,
  state,
  tool,
  onChange,
}: BoardProps<SudokuPuzzle, SudokuState>) {
  const [selected, setSelected] = useState<number | null>(null)
  const { givens } = puzzle

  function clearCell(i: number) {
    if ((state.values[i] ?? 0) === 0 && (state.marks[i] ?? 0) === 0) return
    const values = [...state.values]
    const marks = [...state.marks]
    values[i] = 0
    marks[i] = 0
    onChange({ values, marks })
  }

  function tapCell(i: number) {
    if (givens[i]) return
    if (tool === 'erase') clearCell(i)
    else setSelected(i)
  }

  function enterDigit(d: number) {
    if (selected === null || tool === 'erase' || givens[selected]) return
    const values = [...state.values]
    const marks = [...state.marks]
    if (tool === 'pencil') {
      if (values[selected]) return
      marks[selected] = (marks[selected] ?? 0) ^ (1 << d)
    } else {
      values[selected] = values[selected] === d ? 0 : d
      marks[selected] = 0
    }
    onChange({ values, marks })
  }

  function onKeyDown(e: KeyboardEvent) {
    if (e.key >= '1' && e.key <= '9') {
      enterDigit(Number(e.key))
      e.preventDefault()
    } else if (e.key === 'Backspace' || e.key === 'Delete' || e.key === '0') {
      if (selected !== null) clearCell(selected)
      e.preventDefault()
    } else if (e.key.startsWith('Arrow')) {
      const from = selected ?? 0
      const dr = e.key === 'ArrowDown' ? 1 : e.key === 'ArrowUp' ? -1 : 0
      const dc = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0
      let r = Math.floor(from / 9)
      let c = from % 9
      for (let step = 0; step < 9; step++) {
        r = (r + dr + 9) % 9
        c = (c + dc + 9) % 9
        const i = r * 9 + c
        if (!givens[i]) {
          setSelected(i)
          break
        }
      }
      e.preventDefault()
    }
  }

  const cells = []
  for (let i = 0; i < 81; i++) {
    const r = Math.floor(i / 9)
    const c = i % 9
    const given = givens[i] ?? 0
    const value = state.values[i] ?? 0
    const marks = state.marks[i] ?? 0
    const classes = ['cell']
    if (given) classes.push('given')
    if (selected === i) classes.push('selected')
    if (c % 3 === 2 && c !== 8) classes.push('box-r')
    if (r % 3 === 2 && r !== 8) classes.push('box-b')
    cells.push(
      <button
        key={i}
        type="button"
        class={classes.join(' ')}
        aria-label={`Row ${r + 1} column ${c + 1}${given ? `, given ${given}` : value ? `, ${value}` : ''}`}
        onClick={() => tapCell(i)}
      >
        {given ? (
          given
        ) : value ? (
          value
        ) : marks ? (
          <span class="marks" aria-hidden="true">
            {DIGITS.map((d) => (
              <span key={d}>{marks & (1 << d) ? d : ''}</span>
            ))}
          </span>
        ) : null}
      </button>,
    )
  }

  const digitsDisabled = tool === 'erase' || selected === null
  return (
    <div class="sudoku" tabIndex={0} onKeyDown={onKeyDown}>
      <div class="grid" role="grid" aria-label="Sudoku grid">
        {cells}
      </div>
      <div class="digit-row" role="group" aria-label="Digits">
        {DIGITS.map((d) => (
          <button key={d} type="button" disabled={digitsDisabled} onClick={() => enterDigit(d)}>
            {d}
          </button>
        ))}
      </div>
    </div>
  )
}
