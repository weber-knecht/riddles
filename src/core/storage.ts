import type { Difficulty } from './types'

export const SCHEMA = 1 as const
const PREFIX = 'riddles.v1.'
const gameKey = (puzzleId: string) => `${PREFIX}game.${puzzleId}`
const SETTINGS_KEY = `${PREFIX}settings`

export interface SavedGame {
  schema: typeof SCHEMA
  puzzleId: string
  sizeId: string
  difficulty: Difficulty
  seed: string
  generatorVersion: number
  puzzle: unknown
  solution: unknown
  state: unknown
  /** The single undo snapshot, or null. */
  undo: unknown | null
  startedAt: string
  updatedAt: string
}

export interface Settings {
  schema: typeof SCHEMA
  lastChoice: Record<string, { sizeId: string; difficulty: Difficulty }>
}

export type LoadResult<T> =
  { status: 'ok'; value: T } | { status: 'none' } | { status: 'discarded' }

/** The subset of the Storage interface we use, so tests can pass a stub. */
export interface KeyValueStore {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
}

const DIFFICULTIES = new Set(['easy', 'medium', 'hard'])

function isSavedGame(v: unknown): v is SavedGame {
  if (typeof v !== 'object' || v === null) return false
  const o = v as Record<string, unknown>
  return (
    o.schema === SCHEMA &&
    typeof o.puzzleId === 'string' &&
    typeof o.sizeId === 'string' &&
    typeof o.difficulty === 'string' &&
    DIFFICULTIES.has(o.difficulty) &&
    typeof o.seed === 'string' &&
    typeof o.generatorVersion === 'number' &&
    'puzzle' in o &&
    'solution' in o &&
    'state' in o &&
    'undo' in o &&
    typeof o.startedAt === 'string' &&
    typeof o.updatedAt === 'string'
  )
}

function isSettings(v: unknown): v is Settings {
  if (typeof v !== 'object' || v === null) return false
  const o = v as Record<string, unknown>
  return o.schema === SCHEMA && typeof o.lastChoice === 'object' && o.lastChoice !== null
}

export function createStore(kv: KeyValueStore) {
  function read<T>(key: string, guard: (v: unknown) => v is T): LoadResult<T> {
    let raw: string | null
    try {
      raw = kv.getItem(key)
    } catch {
      return { status: 'none' }
    }
    if (raw === null) return { status: 'none' }
    try {
      const parsed: unknown = JSON.parse(raw)
      if (guard(parsed)) return { status: 'ok', value: parsed }
    } catch {
      // fall through
    }
    try {
      kv.removeItem(key)
    } catch {
      // ignore
    }
    return { status: 'discarded' }
  }

  function write(key: string, value: unknown): boolean {
    try {
      kv.setItem(key, JSON.stringify(value))
      return true
    } catch {
      return false
    }
  }

  return {
    loadGame: (puzzleId: string) => read(gameKey(puzzleId), isSavedGame),
    saveGame: (game: SavedGame) => write(gameKey(game.puzzleId), game),
    clearGame: (puzzleId: string) => {
      try {
        kv.removeItem(gameKey(puzzleId))
      } catch {
        // ignore
      }
    },
    loadSettings: (): Settings => {
      const r = read(SETTINGS_KEY, isSettings)
      return r.status === 'ok' ? r.value : { schema: SCHEMA, lastChoice: {} }
    },
    saveSettings: (settings: Settings) => write(SETTINGS_KEY, settings),
  }
}

export type Store = ReturnType<typeof createStore>

function memoryStore(): KeyValueStore {
  const m = new Map<string, string>()
  return {
    getItem: (k) => m.get(k) ?? null,
    setItem: (k, v) => void m.set(k, v),
    removeItem: (k) => void m.delete(k),
  }
}

/** localStorage when available, else an in-memory fallback (private mode, blocked storage). */
export function defaultStore(): Store {
  try {
    const ls = globalThis.localStorage
    const probe = `${PREFIX}probe`
    ls.setItem(probe, '1')
    ls.removeItem(probe)
    return createStore(ls)
  } catch {
    return createStore(memoryStore())
  }
}
