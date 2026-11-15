import type { ComponentChildren } from 'preact'
import type { Tool } from '../core/types'

export interface ToolRowProps {
  tool: Tool
  supportsPencil: boolean
  pencilLabel?: string
  pencilIcon?: 'pencil' | 'cross'
  canUndo: boolean
  onTool(tool: Tool): void
  onUndo(): void
  onCheck(): void
}

function Icon(props: { strokeWidth?: number; children: ComponentChildren }) {
  return (
    <svg
      aria-hidden="true"
      width="22"
      height="22"
      viewBox="0 0 22 22"
      fill="none"
      stroke="currentColor"
      stroke-width={props.strokeWidth ?? 1.8}
      stroke-linecap="round"
      stroke-linejoin="round"
    >
      {props.children}
    </svg>
  )
}

const ICONS = {
  undo: (
    <Icon>
      <path d="M4 9h9a5 5 0 010 10H8M4 9l4-4M4 9l4 4" />
    </Icon>
  ),
  erase: (
    <Icon>
      <path d="M8 18l-5-5 9-9 7 7-7 7zM8 18h11M7.5 8.5l7 7" />
    </Icon>
  ),
  pencil: (
    <Icon>
      <path d="M3 19l1-5L15 3l4 4L8 18l-5 1zM13 5l4 4" />
    </Icon>
  ),
  cross: (
    <Icon strokeWidth={2.2}>
      <path d="M5 5l12 12M17 5L5 17" />
    </Icon>
  ),
}

export function ToolRow(props: ToolRowProps) {
  const toggle = (t: Tool) => props.onTool(props.tool === t ? 'pen' : t)
  return (
    <div
      class={`toolrow${props.supportsPencil ? '' : ' no-pencil'}`}
      role="toolbar"
      aria-label="Tools"
    >
      <button class="tool" onClick={props.onUndo} disabled={!props.canUndo}>
        {ICONS.undo}
        Undo
      </button>
      <button class="tool" aria-pressed={props.tool === 'erase'} onClick={() => toggle('erase')}>
        {ICONS.erase}
        Eraser
      </button>
      {props.supportsPencil && (
        <button
          class="tool"
          aria-pressed={props.tool === 'pencil'}
          onClick={() => toggle('pencil')}
        >
          {ICONS[props.pencilIcon ?? 'pencil']}
          {props.pencilLabel ?? 'Pencil'}
        </button>
      )}
      <button class="primary check" onClick={props.onCheck}>
        Check
      </button>
    </div>
  )
}
