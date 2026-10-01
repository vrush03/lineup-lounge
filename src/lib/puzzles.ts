import type { Deck, Puzzle, Question } from './types'

/**
 * The puzzle set lives in its own chunk so the app shell paints first.
 * It is validated at build time (scripts/data/build.py) and in tests (puzzles.test.ts).
 */
export async function loadPuzzles(): Promise<Puzzle[]> {
  const mod = await import('../data/cricket.json')
  return mod.default as Puzzle[]
}

/** Quiz questions, validated in tests (quiz.test.ts). */
export async function loadQuestions(): Promise<Question[]> {
  const mod = await import('../data/quiz.json')
  return mod.default as Question[]
}

/** Showdown decks, validated in tests (showdown.test.ts). */
export async function loadDecks(): Promise<Deck[]> {
  const mod = await import('../data/cards.json')
  return mod.default as Deck[]
}
