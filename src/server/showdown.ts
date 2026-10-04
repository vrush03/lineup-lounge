import cards from '../data/cards.json'
import type { ShowdownView } from '../lib/api'
import { compare, cpuPick, deal, ROUNDS, yourTurns, type Outcome } from '../lib/showdown'
import type { Deck } from '../lib/types'
import { isObject, isStrings } from './http'
import { seededRng } from './rng'

const decks = cards as Deck[]

/**
 * Where a Showdown game stands after `played` rounds. Nothing is stored: the hands are dealt from
 * `seed` (and a secret the browser never sees), so the same request always gives the same game.
 * `picks` are the stats the player named on their turns, in order. The computer's card for a round
 * only goes back once that round has been played.
 */
export function showdownView(body: unknown, secret: string, all: Deck[] = decks): ShowdownView | null {
  if (!isObject(body)) return null
  const { format, seed, picks, played } = body
  const deck = all.find((d) => d.format === format)
  if (!deck || typeof seed !== 'string' || !seed || seed.length > 64 || !isStrings(picks)) return null
  if (!Number.isInteger(played) || (played as number) < 0 || (played as number) > ROUNDS) return null
  const n = played as number
  const keys = new Set(deck.stats.map((s) => s.key))
  if (picks.length < yourTurns(n) || !picks.every((p) => keys.has(p))) return null

  const key = `${secret}:${deck.format}:${seed}`
  const byId = new Map(deck.cards.map((c) => [c.id, c]))
  const hands = deal(deck, seededRng(key))
  const log: Outcome[] = []
  let last: ShowdownView['last'] = null
  for (let r = 0; r < n; r++) {
    const you = byId.get(hands.you[r])!
    const cpu = byId.get(hands.cpu[r])!
    const stat = r % 2 === 0 ? picks[r / 2] : cpuPick(cpu, deck, seededRng(`${key}:${r}`))
    const outcome = compare(you, cpu, stat)
    log.push(outcome)
    last = { you, cpu, stat, outcome }
  }
  return { log, last, next: n < ROUNDS ? byId.get(hands.you[n])! : null }
}
