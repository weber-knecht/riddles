import { PuzzleCard } from './PuzzleCard'
import { normaliseSeed } from '../core/rng'
import type { Difficulty, PuzzlePlugin } from '../core/types'
import type { SavedGame, Settings } from '../core/storage'

export interface MenuProps {
  plugins: PuzzlePlugin[]
  savedGames: Record<string, SavedGame | null>
  settings: Settings
  notice: string | null
  seedInput: string
  onSeedInput(value: string): void
  onChoice(puzzleId: string, sizeId: string, difficulty: Difficulty): void
  onContinue(puzzleId: string): void
  onNew(puzzleId: string, sizeId: string, difficulty: Difficulty, seed: string | null): void
}

// "2026-11-15T16:20:31.000Z" printed as "2026-11-15 16:20 UTC".
const PRINTED = `${__BUILD_TIME__.slice(0, 10)} ${__BUILD_TIME__.slice(11, 16)} UTC`

export function Menu(props: MenuProps) {
  return (
    <main class="contents">
      <header class="masthead">
        <div class="masthead-line label">
          <span>Puzzle book</span>
          <span>Vol. {__APP_VERSION__}</span>
        </div>
        <div class="double-rule" />
        <h1>Riddles</h1>
        <div class="double-rule mirrored" />
      </header>
      {props.notice && (
        <p class="notice" role="status">
          {props.notice}
        </p>
      )}
      <div class="contents-line">
        <h2 class="label">Contents</h2>
        <span class="hand">circle your choice</span>
      </div>
      {props.plugins.map((plugin) => {
        const id = plugin.logic.id
        const first = plugin.logic.sizes[0]
        const choice = props.settings.lastChoice[id] ?? {
          sizeId: first ? first.id : '',
          difficulty: 'easy' as Difficulty,
        }
        return (
          <PuzzleCard
            key={id}
            plugin={plugin}
            saved={props.savedGames[id] ?? null}
            sizeId={choice.sizeId}
            difficulty={choice.difficulty}
            onChoice={(sizeId, difficulty) => props.onChoice(id, sizeId, difficulty)}
            onContinue={() => props.onContinue(id)}
            onNew={() =>
              props.onNew(id, choice.sizeId, choice.difficulty, normaliseSeed(props.seedInput))
            }
          />
        )
      })}
      <div class="number-field">
        <label for="seed">
          Looking for one particular puzzle? Write its number here (optional).
        </label>
        <div class="number-line">
          <span>No.</span>
          <input
            id="seed"
            type="text"
            inputMode="text"
            autocapitalize="characters"
            autocomplete="off"
            spellcheck={false}
            maxLength={12}
            value={props.seedInput}
            onInput={(e) => props.onSeedInput((e.currentTarget as HTMLInputElement).value)}
          />
        </div>
      </div>
      <footer>
        <span>Vol. {__APP_VERSION__}</span>
        <span>Printed {PRINTED}</span>
      </footer>
    </main>
  )
}
