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

/** One entry on the contents page: the puzzle type, its choices and its buttons. */
export function PuzzleCard(props: PuzzleCardProps) {
  const { plugin, saved, sizeId, difficulty } = props
  const { name, tagline, sizes } = plugin.logic
  const [confirming, setConfirming] = useState(false)
  // The size is only worth printing when the type has more than one.
  const withSize = (id: string) =>
    sizes.length > 1 ? `${sizes.find((s) => s.id === id)?.label ?? id} · ` : ''

  return (
    <section class="entry" aria-label={name}>
      <div class="entry-title">
        <h3>{name}</h3>
        <span class="leader" />
        <span class="tagline">{tagline}</span>
      </div>
      {sizes.length > 1 && (
        <Segmented
          label="Size"
          caption="Size"
          options={sizes}
          value={sizeId}
          onChange={(id) => props.onChoice(id, difficulty)}
        />
      )}
      <Segmented
        label="Difficulty"
        caption="Level"
        options={DIFFICULTIES.map((d) => ({ id: d, label: DIFFICULTY_LABEL[d] }))}
        value={difficulty}
        onChange={(d) => props.onChoice(sizeId, d)}
      />
      {saved && (
        <button class="primary bookmark" onClick={props.onContinue}>
          <svg aria-hidden="true" width="26" height="52" viewBox="0 0 26 52">
            <path d="M6 0h14v40l-7-7-7 7z" />
          </svg>
          <span class="bookmark-text">
            <span>Continue at the bookmark</span>
            <span class="detail">
              No. {saved.seed} · {withSize(saved.sizeId)}
              {DIFFICULTY_LABEL[saved.difficulty]}
            </span>
          </span>
        </button>
      )}
      {confirming ? (
        <>
          <p class="confirm">Tear out the page you started?</p>
          <div class="pair even">
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
        </>
      ) : (
        <button
          class={saved ? '' : 'primary new'}
          onClick={() => (saved ? setConfirming(true) : props.onNew())}
        >
          New puzzle · {withSize(sizeId)}
          {DIFFICULTY_LABEL[difficulty]}
        </button>
      )}
    </section>
  )
}
