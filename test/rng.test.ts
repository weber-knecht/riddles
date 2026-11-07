import { describe, expect, it } from 'vitest'
import { createRng, cyrb128, newSeed, normaliseSeed, SEED_ALPHABET } from '../src/core/rng'

describe('rng', () => {
  it('is deterministic for a known seed', () => {
    const a = createRng('riddles|test|easy|ABCDEF')
    const b = createRng('riddles|test|easy|ABCDEF')
    const seqA = Array.from({ length: 5 }, () => a.int(1000))
    const seqB = Array.from({ length: 5 }, () => b.int(1000))
    expect(seqA).toEqual(seqB)
  })

  it('produces a fixed sequence (guards against accidental algorithm changes)', () => {
    const rng = createRng('fixed')
    const seq = Array.from({ length: 4 }, () => rng.int(100000))
    expect(seq).toMatchInlineSnapshot(`
      [
        87207,
        58179,
        49427,
        91077,
      ]
    `)
  })

  it('differs between seeds', () => {
    const a = createRng('seed-A')
    const b = createRng('seed-B')
    expect(Array.from({ length: 4 }, () => a.next())).not.toEqual(
      Array.from({ length: 4 }, () => b.next()),
    )
  })

  it('hash is stable', () => {
    expect(cyrb128('')).toEqual(cyrb128(''))
    expect(cyrb128('a')).not.toEqual(cyrb128('b'))
  })

  it('int, pick and shuffle stay in range', () => {
    const rng = createRng('range')
    for (let i = 0; i < 1000; i++) {
      const n = rng.int(7)
      expect(n).toBeGreaterThanOrEqual(0)
      expect(n).toBeLessThan(7)
    }
    expect(['x', 'y']).toContain(rng.pick(['x', 'y']))
    const arr = [1, 2, 3, 4, 5]
    expect(rng.shuffle([...arr]).sort()).toEqual(arr)
  })

  it('newSeed uses the alphabet and length 6', () => {
    const s = newSeed()
    expect(s).toHaveLength(6)
    for (const ch of s) expect(SEED_ALPHABET).toContain(ch)
  })

  it('normaliseSeed cleans input', () => {
    expect(normaliseSeed(' ab-cd ')).toBe('ABCD')
    expect(normaliseSeed('!!')).toBeNull()
  })
})
