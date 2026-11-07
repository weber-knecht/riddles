import type { BoardProps } from '../../core/types'
import type { CountsPuzzle, CountsState } from './logic'

export function CountsBoard({
  puzzle,
  state,
  tool,
  onChange,
}: BoardProps<CountsPuzzle, CountsState>) {
  const { n, rows, cols } = puzzle

  function tap(i: number) {
    const cells = [...state.cells]
    const pencil = [...state.pencil]
    if (tool === 'erase') {
      if (!cells[i] && !pencil[i]) return
      cells[i] = 0
      pencil[i] = false
    } else if (tool === 'pencil') {
      if (cells[i]) return
      pencil[i] = !pencil[i]
    } else {
      cells[i] = cells[i] ? 0 : 1
      pencil[i] = false
    }
    onChange({ cells, pencil })
  }

  const items = []
  items.push(<span key="corner" class="clue" />)
  for (let c = 0; c < n; c++)
    items.push(
      <span key={`c${c}`} class="clue">
        {cols[c]}
      </span>,
    )
  for (let r = 0; r < n; r++) {
    items.push(
      <span key={`r${r}`} class="clue">
        {rows[r]}
      </span>,
    )
    for (let c = 0; c < n; c++) {
      const i = r * n + c
      const filled = state.cells[i] === 1
      items.push(
        <button
          key={i}
          type="button"
          class={`cell${filled ? ' filled' : ''}`}
          aria-label={`Row ${r + 1} column ${c + 1}${filled ? ', filled' : ''}`}
          onClick={() => tap(i)}
        >
          {!filled && state.pencil[i] && <span class="dot" />}
        </button>,
      )
    }
  }

  return (
    <div
      class="counts"
      style={`grid-template-columns: 0.7fr repeat(${n}, 1fr); grid-template-rows: 0.7fr repeat(${n}, 1fr);`}
    >
      {items}
    </div>
  )
}
