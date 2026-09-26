// Everything in Eferon is computed from the cycle seed, so a day replays identically.
// The sea is the one exception: it draws from real entropy (see seaRandom).

export type Rng = () => number;

/** mulberry32: small, fast, good enough for gameplay. Returns floats in [0, 1). */
export function seededRng(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * The seed of the day. It deliberately ignores the cycle number: the world is the same
 * day every time, and only what the player changed (stele words, patches) varies it.
 */
export function daySeed(salt: string): number {
  let h = 2166136261;
  for (let i = 0; i < salt.length; i++) {
    h ^= salt.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Non-deterministic randomness, reserved for the sea. */
export function seaRandom(): number {
  const buf = new Uint32Array(1);
  globalThis.crypto.getRandomValues(buf);
  return (buf[0] ?? 0) / 4294967296;
}
