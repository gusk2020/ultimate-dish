import { fnv1a } from "./util";

/** Deterministic PRNG (mulberry32). Every random roll in the game goes through one of these. */
export function createRng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function seedFrom(...parts: (string | number)[]): number {
  return fnv1a(parts.join("|"));
}

/** A new cooking seed for one attempt. Uses Math.random only here, at the edge. */
export function newCookingSeed(): number {
  return Math.floor(Math.random() * 0xffffffff) >>> 0;
}
