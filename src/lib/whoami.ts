import { SHOWDOWN_FORMATS, type Bio, type Card, type Deck, type ShowdownFormat, type WhoAmIData } from './types'

export const MAX_GUESSES = 5

/** A round: the mystery card and the cards guessed so far, as ids in one deck. */
export type Round = { id: string; guesses: string[] }

/** The daily card: the format changes every day, and each deck is walked in its own order. */
export function dailyPick(day: number, data: WhoAmIData): { format: ShowdownFormat; id: string } {
  const n = SHOWDOWN_FORMATS.length
  const format = SHOWDOWN_FORMATS[((day % n) + n) % n]
  const order = data.order[format]
  const i = Math.floor(day / n)
  return { format, id: order[((i % order.length) + order.length) % order.length] }
}

export const isSolved = (r: Round) => r.guesses.at(-1) === r.id
export const isOver = (r: Round) => isSolved(r) || r.guesses.length >= MAX_GUESSES

/** How a guess compares with the answer. `era` is where the answer's career sits against the guess's. */
export type Chips = { team: boolean; role: boolean; bats: boolean; era: 'overlap' | 'earlier' | 'later' }

export function compareGuess(guess: Card, answer: Card, bios: Record<string, Bio>, format: ShowdownFormat): Chips {
  const g = bios[guess.id]
  const a = bios[answer.id]
  const gs = g?.span[format]
  const as = a?.span[format]
  const era = !gs || !as || (as[0] <= gs[1] && gs[0] <= as[1]) ? 'overlap' : as[1] < gs[0] ? 'earlier' : 'later'
  return { team: guess.team === answer.team, role: !!g && g.role === a?.role, bats: !!g && g.bats === a?.bats, era }
}

export type Warmth = 'cold' | 'warm' | 'close'

/** Close is three chips right, or the right team in the right years. */
export function warmth(c: Chips): Warmth {
  const era = c.era === 'overlap'
  const right = [c.team, c.role, c.bats, era].filter(Boolean).length
  return right >= 3 || (c.team && era) ? 'close' : right === 2 ? 'warm' : 'cold'
}

/** What each wrong guess can unlock, weakest first; the last one also brings the photo into focus. */
export const HINTS = 4

/**
 * The hint ladder for a card, in the player's own voice: how they play, their debut and a highlight,
 * the team-mates they kept, then nickname, birthplace and team. Written by scripts/data/whoami_hints.py.
 */
export function hintsFor(card: Card, deck: Deck, bio: Bio | undefined): string[] {
  const hints = bio?.hints[deck.format]
  if (hints?.length === HINTS) return hints
  // Only if the data and the decks disagree: the card still gets a ladder.
  const team = `I played for ${card.team}.`
  return [bio ? `I’m a ${bio.role.toLowerCase()} who bats ${bio.bats.toLowerCase()}-handed.` : team, team, team, team]
}

/** Hints on show after these wrong guesses: one each, two for a close one, until the ladder runs out. */
export function hintsShown(wrong: Warmth[]): number {
  return Math.min(HINTS, wrong.reduce((n, w) => n + (w === 'close' ? 2 : 1), 0))
}

/** Photo blur in px, from the first look to nearly clear. */
const BLUR = [26, 20, 15, 11, 8, 6]

/**
 * How far out of focus the mystery photo is. It clears a step for a warm guess and two for a close
 * one, and two more once the photo hint is unlocked; a cold guess leaves it as it was.
 */
export function photoBlur(wrong: Warmth[], photoHint: boolean): number {
  const steps = wrong.reduce((n, w) => n + (w === 'close' ? 2 : w === 'warm' ? 1 : 0), photoHint ? 2 : 0)
  return BLUR[Math.min(steps, BLUR.length - 1)]
}

const pick = <T,>(lines: T[], seed: number) => lines[((seed % lines.length) + lines.length) % lines.length]

const WRONG: Record<Warmth, string[]> = {
  cold: ['Swing and a miss.', 'Beaten all ends up outside off.', 'Nowhere near it. Play and a miss.'],
  warm: ['Some bat on that one.', 'In the right half of the ground.', 'Not middled, but you got something on it.'],
  close: ['Getting closer: that shaved the off stump.', 'So close. Straight to the fielder.', 'You’re getting warmer: an inside edge past the stumps.'],
}

/** The commentary on a wrong guess. `seed` varies the line from guess to guess. */
export const wrongLine = (w: Warmth, seed: number) => pick(WRONG[w], seed)

const SOLVED: string[][] = [
  ['That went like a tracer bullet!', 'First ball, out of the screws and into the stands!', 'One look was all it took. Shot of the day!'],
  ['Timed to perfection, straight back past the bowler.', 'Picked the length early and put it away.'],
  ['Worked into the gap, and they run hard for it.', 'Played yourself in, then cashed in.'],
  ['A streaky one, but they all count in the scorebook.', 'Edged past slip, and you’ll take it.'],
  ['Scrambled home with a dive off the last ball!', 'A last-wicket stand, and you’re over the line.'],
]
const BEATEN = ['Bowled! Through the gate.', 'Stumps. The bowlers take this one.', 'All out. Back to the nets.']

/** The line that closes a round: the quicker the solve, the sweeter the shot. */
export function closingLine(r: Round, seed: number): string {
  return pick(isSolved(r) ? SOLVED[r.guesses.length - 1] : BEATEN, seed)
}

/** Lower case, no accents or punctuation, so "de villiers" finds "AB de Villiers". */
const fold = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

/** Players in the deck matching what has been typed: names starting with it, then words starting with it, then the rest. */
export function search(deck: Deck, query: string, exclude: string[] = [], limit = 8): Card[] {
  const q = fold(query)
  if (!q) return []
  const rank = (c: Card) => {
    const name = fold(c.name)
    return name.startsWith(q) ? 0 : name.split(' ').some((w) => w.startsWith(q)) || name.includes(` ${q}`) ? 1 : name.includes(q) ? 2 : 3
  }
  return deck.cards
    .filter((c) => !exclude.includes(c.id))
    .map((c) => [rank(c), c] as const)
    .filter(([r]) => r < 3)
    .sort((a, b) => a[0] - b[0] || a[1].name.localeCompare(b[1].name))
    .slice(0, limit)
    .map(([, c]) => c)
}

/** A saved round is only good if it is about this card and every guess is a different card from the deck. */
export function isRound(r: unknown, id: string, deck: Deck): r is Round {
  if (!r || typeof r !== 'object') return false
  const { id: saved, guesses } = r as Record<string, unknown>
  if (saved !== id || !Array.isArray(guesses) || !guesses.every((g) => typeof g === 'string')) return false
  const known = new Set(deck.cards.map((c) => c.id))
  return (
    known.has(id) &&
    guesses.length <= MAX_GUESSES &&
    new Set(guesses).size === guesses.length &&
    guesses.every((g) => known.has(g)) &&
    // The answer ends the round, so it can only be the last guess.
    guesses.slice(0, -1).every((g) => g !== id)
  )
}

/** One square per guess: green the answer, amber a close or warm miss, red a cold one. */
export function shareSquares(warm: Warmth[], solved: boolean): string {
  return warm.map((w) => (w === 'cold' ? '🟥' : '🟨')).join('') + (solved ? '🟩' : '')
}
