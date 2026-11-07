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

export function Menu(props: MenuProps) {
  return (
    <main>
      <h1>Riddles</h1>
      {props.notice && (
        <p class="notice muted" role="status">
          {props.notice}
        </p>
      )}
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
      <label class="seed-field">
        <span class="muted">Seed for the next new puzzle (optional)</span>
        <input
          type="text"
          inputMode="text"
          autocapitalize="characters"
          autocomplete="off"
          spellcheck={false}
          maxLength={12}
          value={props.seedInput}
          onInput={(e) => props.onSeedInput((e.currentTarget as HTMLInputElement).value)}
        />
      </label>
      <footer class="muted">Build {__BUILD_TIME__}</footer>
    </main>
  )
}
