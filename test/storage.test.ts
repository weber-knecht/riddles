import { describe, expect, it } from 'vitest'
import { createStore, SCHEMA, type KeyValueStore, type SavedGame } from '../src/core/storage'

function stub(): KeyValueStore & { map: Map<string, string> } {
  const map = new Map<string, string>()
  return {
    map,
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => void map.set(k, v),
    removeItem: (k) => void map.delete(k),
    keys: () => [...map.keys()],
  }
}

const game: SavedGame = {
  schema: SCHEMA,
  puzzleId: 'sudoku',
  sizeId: '4',
  difficulty: 'easy',
  seed: 'ABCDEF',
  generatorVersion: 1,
  puzzle: { n: 4, rows: [1, 1, 1, 1], cols: [1, 1, 1, 1] },
  solution: [1, 0, 0, 0],
  state: { cells: [0], pencil: [false] },
  undo: null,
  startedAt: '2026-11-07T00:00:00.000Z',
  updatedAt: '2026-11-07T00:00:00.000Z',
}

describe('storage', () => {
  it('round-trips a game and clears it', () => {
    const kv = stub()
    const store = createStore(kv)
    expect(store.loadGame('sudoku')).toEqual({ status: 'none' })
    expect(store.saveGame(game)).toBe(true)
    expect(store.loadGame('sudoku')).toEqual({ status: 'ok', value: game })
    store.clearGame('sudoku')
    expect(store.loadGame('sudoku')).toEqual({ status: 'none' })
  })

  it('discards records with an unknown schema or malformed JSON', () => {
    const kv = stub()
    const store = createStore(kv)
    kv.setItem('riddles.v1.game.sudoku', JSON.stringify({ ...game, schema: 99 }))
    expect(store.loadGame('sudoku')).toEqual({ status: 'discarded' })
    expect(kv.map.has('riddles.v1.game.sudoku')).toBe(false)
    kv.setItem('riddles.v1.game.sudoku', '{not json')
    expect(store.loadGame('sudoku')).toEqual({ status: 'discarded' })
  })

  it('falls back to default settings and remembers choices', () => {
    const store = createStore(stub())
    expect(store.loadSettings()).toEqual({ schema: SCHEMA, lastChoice: {} })
    store.saveSettings({
      schema: SCHEMA,
      lastChoice: { sudoku: { sizeId: '4', difficulty: 'hard' } },
    })
    expect(store.loadSettings().lastChoice.sudoku).toEqual({ sizeId: '4', difficulty: 'hard' })
  })

  it('survives a throwing backend', () => {
    const store = createStore({
      getItem: () => {
        throw new Error('blocked')
      },
      setItem: () => {
        throw new Error('blocked')
      },
      removeItem: () => {
        throw new Error('blocked')
      },
      keys: () => {
        throw new Error('blocked')
      },
    })
    expect(store.loadGame('sudoku')).toEqual({ status: 'none' })
    expect(store.saveGame(game)).toBe(false)
    expect(store.loadSettings().lastChoice).toEqual({})
    expect(() => store.pruneUnknown(['sudoku'])).not.toThrow()
  })

  it('discards a game written by another generator version', () => {
    const kv = stub()
    const store = createStore(kv)
    store.saveGame(game)
    expect(store.loadGame('sudoku', 1)).toEqual({ status: 'ok', value: game })
    expect(store.loadGame('sudoku', 2)).toEqual({ status: 'discarded' })
    expect(kv.map.has('riddles.v1.game.sudoku')).toBe(false)
  })

  it('prunes data of puzzle types that no longer exist', () => {
    const kv = stub()
    const store = createStore(kv)
    store.saveGame(game)
    store.saveGame({ ...game, puzzleId: 'counts' })
    store.saveSettings({
      schema: SCHEMA,
      lastChoice: {
        sudoku: { sizeId: '9', difficulty: 'hard' },
        counts: { sizeId: '4', difficulty: 'easy' },
      },
    })
    kv.setItem('unrelated', 'x')
    store.pruneUnknown(['sudoku', 'binairo'])
    expect(kv.map.has('riddles.v1.game.counts')).toBe(false)
    expect(store.loadGame('sudoku')).toEqual({ status: 'ok', value: game })
    expect(store.loadSettings().lastChoice).toEqual({ sudoku: { sizeId: '9', difficulty: 'hard' } })
    expect(kv.map.get('unrelated')).toBe('x')
  })
})
