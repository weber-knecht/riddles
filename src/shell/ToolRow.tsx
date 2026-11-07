import type { Tool } from '../core/types'

export interface ToolRowProps {
  tool: Tool
  supportsPencil: boolean
  canUndo: boolean
  onTool(tool: Tool): void
  onUndo(): void
  onCheck(): void
}

export function ToolRow(props: ToolRowProps) {
  const toggle = (t: Tool) => props.onTool(props.tool === t ? 'pen' : t)
  return (
    <div class="toolrow" role="toolbar" aria-label="Tools">
      <button onClick={props.onUndo} disabled={!props.canUndo}>
        Undo
      </button>
      <button aria-pressed={props.tool === 'erase'} onClick={() => toggle('erase')}>
        Eraser
      </button>
      {props.supportsPencil ? (
        <button aria-pressed={props.tool === 'pencil'} onClick={() => toggle('pencil')}>
          Pencil
        </button>
      ) : (
        <span />
      )}
      <button class="primary" onClick={props.onCheck}>
        Check
      </button>
    </div>
  )
}
