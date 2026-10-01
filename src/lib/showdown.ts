import type { Card, Deck, StatDef } from './types'

export type Side = 'you' | 'cpu'
export type Outcome = Side | 'tie'

/** Hands are card ids, next card first. `log` is who took each round played so far. */
export type Game = { you: string[]; cpu: string[]; log: Outcome[] }

/** Rounds in a game, and so cards in each hand: every card is played once. */
export const ROUNDS = 15
/** Points for winning a round; a tied round splits them. */
export const POINTS = 10
/** How often the computer plays its card's strongest stat instead of a random one. */
const CPU_SHARP = 0.35

export function shuffle<T>(items: T[], rng: () => number = Math.random): T[] {
  const a = [...items]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

/** Draw two hands from the deck at random. */
export function deal(deck: Deck, rng: () => number = Math.random): Game {
  const ids = shuffle(deck.cards, rng)
    .slice(0, 2 * ROUNDS)
    .map((c) => c.id)
  return { you: ids.slice(0, ROUNDS), cpu: ids.slice(ROUNDS), log: [] }
}

/** The round about to be played, from 1. */
export const roundOf = (g: Game) => g.log.length + 1

/** Who names the stat: you on the odd rounds, the computer on the even ones. */
export const turnOf = (g: Game): Side => (g.log.length % 2 === 0 ? 'you' : 'cpu')

export function compare(you: Card, cpu: Card, stat: string): Outcome {
  const a = you.stats[stat]
  const b = cpu.stats[stat]
  return a > b ? 'you' : b > a ? 'cpu' : 'tie'
}

/** Play the two top cards: both are used up and the outcome goes on the log. */
export function playRound(g: Game, outcome: Outcome): Game {
  return { you: g.you.slice(1), cpu: g.cpu.slice(1), log: [...g.log, outcome] }
}

export function score(g: Game): Record<Side, number> {
  const points = (side: Side) => g.log.reduce((n, o) => n + (o === side ? POINTS : o === 'tie' ? POINTS / 2 : 0), 0)
  return { you: points('you'), cpu: points('cpu') }
}

/** Once every round is played, whoever has more points; null while the game is still going. */
export function winner(g: Game): Side | 'draw' | null {
  if (g.log.length < ROUNDS) return null
  const { you, cpu } = score(g)
  return you > cpu ? 'you' : cpu > you ? 'cpu' : 'draw'
}

/** Share of the deck that a card beats on one stat: 1 = nobody is better, 0 = everybody is. */
export function strength(card: Card, stat: string, deck: Deck): number {
  const others = deck.cards.filter((c) => c.id !== card.id)
  return others.filter((c) => c.stats[stat] < card.stats[stat]).length / Math.max(1, others.length)
}

/** The computer's choice: sometimes the stat its card is strongest on, more often any stat. */
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

/** A saved game is only good if its hands are different cards from the deck and match the rounds played. */
export function isGame(g: unknown, deck: Deck): g is Game {
  if (!g || typeof g !== 'object') return false
  const { you, cpu, log } = g as Record<string, unknown>
  const strings = (p: unknown): p is string[] => Array.isArray(p) && p.every((x) => typeof x === 'string')
  if (!strings(you) || !strings(cpu) || !strings(log)) return false
  const ids = [...you, ...cpu]
  const known = new Set(deck.cards.map((c) => c.id))
  return (
    log.length <= ROUNDS &&
    log.every((o) => o === 'you' || o === 'cpu' || o === 'tie') &&
    you.length === ROUNDS - log.length &&
    cpu.length === you.length &&
    new Set(ids).size === ids.length &&
    ids.every((id) => known.has(id))
  )
}
