import type { Card, Deck, StatDef } from './types'

export type Side = 'you' | 'cpu'
export type Outcome = Side | 'tie'

/** Piles are card ids, top card first. `turn` is who names the stat for the next round. */
export type Game = { you: string[]; cpu: string[]; pot: string[]; turn: Side; round: number }

/** Cards each side starts with. */
export const HAND = 15
/** How often the computer plays its card's strongest stat instead of a random one. */
const CPU_SHARP = 0.75

export function shuffle<T>(items: T[], rng: () => number = Math.random): T[] {
  const a = [...items]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

/** Draw two hands' worth of cards from the deck at random and split them evenly. You name the first stat. */
export function deal(deck: Deck, rng: () => number = Math.random): Game {
  const ids = shuffle(deck.cards, rng)
    .slice(0, 2 * HAND)
    .map((c) => c.id)
  return { you: ids.slice(0, HAND), cpu: ids.slice(HAND), pot: [], turn: 'you', round: 1 }
}

export function compare(you: Card, cpu: Card, stat: string): Outcome {
  const a = you.stats[stat]
  const b = cpu.stats[stat]
  return a > b ? 'you' : b > a ? 'cpu' : 'tie'
}

/**
 * Play the two top cards. The winner takes both, and anything in the pot, to the bottom of their
 * pile; a tie sends both cards to the pot for the next winner. The pick then passes to the other side.
 */
export function playRound(g: Game, outcome: Outcome): Game {
  const [mine, ...you] = g.you
  const [theirs, ...cpu] = g.cpu
  const next = { turn: g.turn === 'you' ? 'cpu' : 'you', round: g.round + 1 } as const
  if (outcome === 'tie') return { you, cpu, pot: [...g.pot, mine, theirs], ...next }
  if (outcome === 'you') return { you: [...you, mine, theirs, ...g.pot], cpu, pot: [], ...next }
  return { you, cpu: [...cpu, theirs, mine, ...g.pot], pot: [], ...next }
}

/** Whoever still has cards once the other side has none; a draw if a tie emptied both piles. */
export function winner(g: Game): Side | 'draw' | null {
  if (g.you.length && g.cpu.length) return null
  return g.you.length ? 'you' : g.cpu.length ? 'cpu' : 'draw'
}

/** Share of the deck that a card beats on one stat: 1 = nobody is better, 0 = everybody is. */
export function strength(card: Card, stat: string, deck: Deck): number {
  const others = deck.cards.filter((c) => c.id !== card.id)
  return others.filter((c) => c.stats[stat] < card.stats[stat]).length / Math.max(1, others.length)
}

/** The computer's choice: usually the stat its card is strongest on, sometimes any stat. */
export function cpuPick(card: Card, deck: Deck, rng: () => number = Math.random): string {
  const keys = deck.stats.map((s) => s.key)
  if (rng() >= CPU_SHARP) return keys[Math.floor(rng() * keys.length)]
  return keys.reduce((best, k) => (strength(card, k, deck) > strength(card, best, deck) ? k : best))
}

/** "53.78", "18,426", "200*". */
export function statText(card: Card, stat: StatDef): string {
  const v = card.stats[stat.key]
  const text = stat.decimals ? v.toFixed(stat.decimals) : v.toLocaleString('en-US')
  return stat.key === 'highest' && card.hsNotOut ? `${text}*` : text
}

/** A saved game is only good if it still holds a full deal of different cards that exist in the deck. */
export function isGame(g: unknown, deck: Deck): g is Game {
  if (!g || typeof g !== 'object') return false
  const { you, cpu, pot, turn, round } = g as Record<string, unknown>
  const piles = [you, cpu, pot]
  if (!piles.every((p): p is string[] => Array.isArray(p) && p.every((x) => typeof x === 'string'))) return false
  const ids = piles.flat()
  const known = new Set(deck.cards.map((c) => c.id))
  return (
    ids.length === 2 * HAND &&
    new Set(ids).size === ids.length &&
    ids.every((id) => known.has(id)) &&
    (turn === 'you' || turn === 'cpu') &&
    typeof round === 'number'
  )
}
