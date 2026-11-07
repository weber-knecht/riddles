import { useState } from 'preact/hooks'
import { Segmented } from './Segmented'
import { DIFFICULTIES, DIFFICULTY_LABEL, type Difficulty, type PuzzlePlugin } from '../core/types'
import type { SavedGame } from '../core/storage'

export interface PuzzleCardProps {
  plugin: PuzzlePlugin
  saved: SavedGame | null
  sizeId: string
  difficulty: Difficulty
  onChoice(sizeId: string, difficulty: Difficulty): void
  onContinue(): void
  onNew(): void
}

export function PuzzleCard(props: PuzzleCardProps) {
  const { plugin, saved, sizeId, difficulty } = props
  const [confirming, setConfirming] = useState(false)
  const sizeLabel = (id: string) => plugin.logic.sizes.find((s) => s.id === id)?.label ?? id

  return (
    <section class="card" aria-label={plugin.logic.name}>
      <h2>{plugin.logic.name}</h2>
      {plugin.logic.sizes.length > 1 && (
        <Segmented
          label="Size"
          options={plugin.logic.sizes}
          value={sizeId}
          onChange={(id) => props.onChoice(id, difficulty)}
        />
      )}
      <Segmented
        label="Difficulty"
        options={DIFFICULTIES.map((d) => ({ id: d, label: DIFFICULTY_LABEL[d] }))}
        value={difficulty}
        onChange={(d) => props.onChoice(sizeId, d)}
      />
      {saved && (
        <button class="primary" onClick={props.onContinue}>
          Continue · {sizeLabel(saved.sizeId)} · {DIFFICULTY_LABEL[saved.difficulty]} · {saved.seed}
        </button>
      )}
      {confirming ? (
        <div class="row">
          <span class="muted" style="flex: 1 1 100%">
            Discard the current game?
          </span>
          <button
            class="danger"
            onClick={() => {
              setConfirming(false)
              props.onNew()
            }}
          >
            Discard
          </button>
          <button onClick={() => setConfirming(false)}>Keep</button>
        </div>
      ) : (
        <button
          class={saved ? '' : 'primary'}
          onClick={() => (saved ? setConfirming(true) : props.onNew())}
        >
          New · {sizeLabel(sizeId)} · {DIFFICULTY_LABEL[difficulty]}
        </button>
      )}
    </section>
  )
}
