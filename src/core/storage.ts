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
  keys(): string[]
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
    /**
     * Loads the saved game of a puzzle. A record written by another generator
     * version is removed and reported as discarded, like an unreadable one.
     */
    loadGame: (puzzleId: string, expectedVersion?: number): LoadResult<SavedGame> => {
      const key = gameKey(puzzleId)
      const r = read(key, isSavedGame)
      if (
        r.status === 'ok' &&
        expectedVersion !== undefined &&
        r.value.generatorVersion !== expectedVersion
      ) {
        try {
          kv.removeItem(key)
        } catch {
          // ignore
        }
        return { status: 'discarded' }
      }
      return r
    },
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
    /** Silently removes saved games and menu choices of puzzle types that no longer exist. */
    pruneUnknown: (knownIds: string[]) => {
      const known = new Set(knownIds)
      const gamePrefix = gameKey('')
      try {
        for (const key of kv.keys()) {
          if (key.startsWith(gamePrefix) && !known.has(key.slice(gamePrefix.length)))
            kv.removeItem(key)
        }
      } catch {
        // ignore
      }
      const r = read(SETTINGS_KEY, isSettings)
      if (r.status !== 'ok') return
      const kept = Object.entries(r.value.lastChoice).filter(([id]) => known.has(id))
      if (kept.length !== Object.keys(r.value.lastChoice).length)
        write(SETTINGS_KEY, { ...r.value, lastChoice: Object.fromEntries(kept) })
    },
  }
}

export type Store = ReturnType<typeof createStore>

function memoryStore(): KeyValueStore {
  const m = new Map<string, string>()
  return {
    getItem: (k) => m.get(k) ?? null,
    setItem: (k, v) => void m.set(k, v),
    removeItem: (k) => void m.delete(k),
    keys: () => [...m.keys()],
  }
}

function browserStore(ls: Storage): KeyValueStore {
  return {
    getItem: (k) => ls.getItem(k),
    setItem: (k, v) => ls.setItem(k, v),
    removeItem: (k) => ls.removeItem(k),
    keys: () => {
      const keys: string[] = []
      for (let i = 0; i < ls.length; i++) {
        const k = ls.key(i)
        if (k !== null) keys.push(k)
      }
      return keys
    },
  }
}

/** localStorage when available, else an in-memory fallback (private mode, blocked storage). */
export function defaultStore(): Store {
  try {
    const ls = globalThis.localStorage
    const probe = `${PREFIX}probe`
    ls.setItem(probe, '1')
    ls.removeItem(probe)
    return createStore(browserStore(ls))
  } catch {
    return createStore(memoryStore())
  }
}
