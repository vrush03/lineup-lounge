import type { Deck, EstimateQuestion, Puzzle, WhoAmIData } from './types'

/**
 * The puzzle set lives in its own chunk so the app shell paints first.
 * It is validated at build time (scripts/data/build.py) and in tests (puzzles.test.ts).
 */
export async function loadPuzzles(): Promise<Puzzle[]> {
  const mod = await import('../data/cricket.json')
  return mod.default as Puzzle[]
}

/** Showdown decks, validated in tests (showdown.test.ts). */
export async function loadDecks(): Promise<Deck[]> {
  const mod = await import('../data/cards.json')
  return mod.default as Deck[]
}

/** Ballpark questions, validated in tests (ballpark.test.ts). */
export async function loadEstimates(): Promise<EstimateQuestion[]> {
  const mod = await import('../data/ballpark.json')
  return mod.default as EstimateQuestion[]
}

/** Who Am I? bios and daily order, validated against the decks in tests (whoami.test.ts). */
export async function loadWhoAmIData(): Promise<WhoAmIData> {
  const mod = await import('../data/whoami.json')
  // JSON types the year pairs as number[]; whoamiSchema checks they are pairs.
  return mod.default as unknown as WhoAmIData
}
