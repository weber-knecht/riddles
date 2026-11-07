/** Deterministic pseudo-random numbers. sfc32 seeded from a cyrb128 string hash. */

export interface Rng {
  /** Uniform float in [0, 1). */
  next(): number
  /** Uniform integer in [0, n). */
  int(n: number): number
  pick<T>(items: readonly T[]): T
  /** In-place Fisher-Yates shuffle; returns the same array. */
  shuffle<T>(items: T[]): T[]
}

export function cyrb128(str: string): [number, number, number, number] {
  let h1 = 1779033703
  let h2 = 3144134277
  let h3 = 1013904242
  let h4 = 2773480762
  for (let i = 0; i < str.length; i++) {
    const k = str.charCodeAt(i)
    h1 = h2 ^ Math.imul(h1 ^ k, 597399067)
    h2 = h3 ^ Math.imul(h2 ^ k, 2869860233)
    h3 = h4 ^ Math.imul(h3 ^ k, 951274213)
    h4 = h1 ^ Math.imul(h4 ^ k, 2716044179)
  }
  h1 = Math.imul(h3 ^ (h1 >>> 18), 597399067)
  h2 = Math.imul(h4 ^ (h2 >>> 22), 2869860233)
  h3 = Math.imul(h1 ^ (h3 >>> 17), 951274213)
  h4 = Math.imul(h2 ^ (h4 >>> 19), 2716044179)
  h1 ^= h2 ^ h3 ^ h4
  h2 ^= h1
  h3 ^= h1
  h4 ^= h1
  return [h1 >>> 0, h2 >>> 0, h3 >>> 0, h4 >>> 0]
}

export function sfc32(a: number, b: number, c: number, d: number): () => number {
  return () => {
    a |= 0
    b |= 0
    c |= 0
    d |= 0
    const t = (((a + b) | 0) + d) | 0
    d = (d + 1) | 0
    a = b ^ (b >>> 9)
    b = (c + (c << 3)) | 0
    c = (c << 21) | (c >>> 11)
    c = (c + t) | 0
    return (t >>> 0) / 4294967296
  }
}

export function createRng(seedString: string): Rng {
  const [a, b, c, d] = cyrb128(seedString)
  const next = sfc32(a, b, c, d)
  // Discard a few outputs so similar seeds diverge quickly.
  for (let i = 0; i < 15; i++) next()
  const rng: Rng = {
    next,
    int: (n) => Math.floor(next() * n),
    pick: (items) => {
      const item = items[Math.floor(next() * items.length)]
      if (item === undefined) throw new Error('pick from empty list')
      return item
    },
    shuffle: (items) => {
      for (let i = items.length - 1; i > 0; i--) {
        const j = Math.floor(next() * (i + 1))
        const tmp = items[i] as (typeof items)[number]
        items[i] = items[j] as (typeof items)[number]
        items[j] = tmp
      }
      return items
    },
  }
  return rng
}

/** Alphabet without 0/O and 1/I so seeds can be read off a screen. */
export const SEED_ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ'
export const SEED_LENGTH = 6

export function newSeed(): string {
  const bytes = new Uint8Array(SEED_LENGTH)
  crypto.getRandomValues(bytes)
  let out = ''
  for (const b of bytes) out += SEED_ALPHABET[b % SEED_ALPHABET.length]
  return out
}

/** Uppercases and strips characters outside the alphabet. Returns null if nothing is left. */
export function normaliseSeed(input: string): string | null {
  const cleaned = input
    .toUpperCase()
    .split('')
    .filter((ch) => SEED_ALPHABET.includes(ch))
    .join('')
  return cleaned.length > 0 ? cleaned : null
}

/** The string every generator is seeded with: same inputs, same puzzle. */
export function puzzleSeedString(
  puzzleId: string,
  sizeId: string,
  difficulty: string,
  seed: string,
): string {
  return `${puzzleId}|${sizeId}|${difficulty}|${seed}`
}
