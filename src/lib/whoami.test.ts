import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import cards from '../data/cards.json'
import whoami from '../data/whoami.json'
import { deckSchema, whoamiSchema } from './puzzleSchema'
import { whoamiShareText } from './share'
import { SHOWDOWN_FORMATS, type Bio, type Card, type Deck, type Hint, type WhoAmIData } from './types'
import {
  closingLine,
  compareGuess,
  dailyPick,
  HINTS,
  hintsFor,
  hintsShown,
  isOver,
  isRound,
  isSolved,
  MAX_GUESSES,
  photoBlur,
  search,
  warmth,
  wrongLine,
} from './whoami'

const decks = z.array(deckSchema).parse(cards) as Deck[]
const data = whoamiSchema.parse(whoami) as WhoAmIData

const card = (id: string, team: string, runs: number, wickets: number): Card => ({ id, name: id, team, stats: { runs, wickets } })
const tiny: Deck = {
  format: 'ODI',
  asOf: '2026-01-01',
  source: { name: 's', url: 'https://example.com', license: 'l' },
  stats: [
    { key: 'runs', label: 'Runs', short: 'Runs' },
    { key: 'wickets', label: 'Wickets', short: 'Wkts' },
  ],
  cards: [card('a', 'India', 9000, 3), card('b', 'India', 500, 300), card('c', 'Australia', 9000, 150), card('d', 'England', 100, 20)],
}
const ladder: Hint[] = ['How I play', 'My story', 'Who I played with', 'Where I’m from'].map((title) => ({ title, facts: [{ label: 'l', value: 'v' }] }))
const bio = (role: Bio['role'], bats: Bio['bats'], from: number, to: number): Bio => ({ role, bats, span: { ODI: [from, to] }, hints: { ODI: ladder } })
const bios: Record<string, Bio> = {
  a: bio('Batter', 'Right', 1990, 2005),
  b: bio('Bowler', 'Right', 2000, 2012),
  c: bio('Batter', 'Left', 2010, 2020),
  d: bio('All-rounder', 'Left', 1975, 1985),
}
const [a, b, c, d] = tiny.cards

describe('a guess', () => {
  it('is compared on team, role, batting hand and era', () => {
    expect(compareGuess(b, a, bios, 'ODI')).toEqual({ team: true, role: false, bats: true, era: 'overlap' })
    expect(compareGuess(c, a, bios, 'ODI')).toEqual({ team: false, role: true, bats: false, era: 'earlier' })
    expect(compareGuess(d, a, bios, 'ODI')).toEqual({ team: false, role: false, bats: false, era: 'later' })
  })
  it('is close on three chips or the right team and years, warm on two, else cold', () => {
    expect(warmth({ team: true, role: false, bats: false, era: 'overlap' })).toBe('close')
    expect(warmth({ team: false, role: true, bats: true, era: 'overlap' })).toBe('close')
    expect(warmth({ team: true, role: true, bats: false, era: 'later' })).toBe('warm')
    expect(warmth({ team: false, role: false, bats: false, era: 'overlap' })).toBe('cold')
    expect(warmth({ team: false, role: false, bats: false, era: 'earlier' })).toBe('cold')
  })
})

describe('hints', () => {
  it('unlock one per wrong guess, two for a close one, and stop at the photo', () => {
    expect(hintsShown([])).toBe(0)
    expect(hintsShown(['cold', 'warm'])).toBe(2)
    expect(hintsShown(['close', 'cold'])).toBe(3)
    expect(hintsShown(['close', 'close', 'close'])).toBe(HINTS)
    expect(HINTS).toBe(MAX_GUESSES - 1)
  })
  it('clear the photo as guesses get closer, and never for a cold one', () => {
    expect(photoBlur([], false)).toBe(26)
    expect(photoBlur(['cold', 'cold'], false)).toBe(26)
    expect(photoBlur(['warm'], false)).toBe(20)
    expect(photoBlur(['cold', 'close'], false)).toBe(15)
    expect(photoBlur(['warm', 'close'], false)).toBeLessThan(photoBlur(['close'], false))
    expect(photoBlur(['cold', 'cold', 'cold', 'cold'], true)).toBe(15)
    expect(photoBlur(['close', 'close', 'close', 'close'], true)).toBe(6)
  })
  it('come from the card’s own ladder, with a plain one if the data has none', () => {
    expect(hintsFor(b, tiny, bios.b)).toBe(ladder)
    const plain = hintsFor(b, { ...tiny, format: 'IPL' }, bios.b)
    expect(plain.map((h) => h.title)).toEqual(['How I play', 'Who I played for', 'Who I played for', 'Who I played for'])
    expect(plain[0].facts).toEqual([{ label: 'Role', value: 'Bowler' }, { label: 'Bats', value: 'Right-handed' }])
    expect(plain[1].facts).toEqual([{ label: 'IPL side', value: 'India', team: 'India' }])
    expect(hintsFor(b, tiny, undefined)).toHaveLength(HINTS)
  })
})

describe('a round', () => {
  it('ends on the answer or after five guesses', () => {
    expect(isOver({ id: 'a', guesses: ['b', 'c'] })).toBe(false)
    expect(isSolved({ id: 'a', guesses: ['b', 'a'] })).toBe(true)
    expect(isOver({ id: 'a', guesses: ['b', 'a'] })).toBe(true)
    const lost = { id: 'a', guesses: ['b', 'c', 'd', 'e', 'f'] }
    expect(isOver(lost)).toBe(true)
    expect(isSolved(lost)).toBe(false)
  })
  it('closes with the tracer bullet for a first-guess solve, and a line for every other ending', () => {
    expect(closingLine({ id: 'a', guesses: ['a'] }, 0)).toBe('That went like a tracer bullet!')
    for (let n = 1; n <= MAX_GUESSES; n++)
      for (let seed = 0; seed < 6; seed++) {
        const wrong = Array.from({ length: n - 1 }, (_, i) => `w${i}`)
        expect(closingLine({ id: 'a', guesses: [...wrong, 'a'] }, seed)).toMatch(/\S/)
        expect(wrongLine((['cold', 'warm', 'close'] as const)[seed % 3], seed)).toMatch(/\S/)
      }
    expect(closingLine({ id: 'a', guesses: ['b', 'c', 'd', 'e', 'f'] }, 0)).toBe('Bowled! Through the gate.')
  })
  it('finds players by any part of the name, without the ones already guessed', () => {
    const odi = decks.find((x) => x.format === 'ODI')!
    expect(search(odi, 'tend')[0].name).toBe('Sachin Tendulkar')
    expect(search(odi, '  SACHIN ').map((x) => x.id)).toContain('sachin-tendulkar')
    expect(search(odi, 'tend', ['sachin-tendulkar'])).toEqual([])
    expect(search(odi, '')).toEqual([])
    expect(search(odi, 'zzzz')).toEqual([])
    expect(search(odi, 'a').length).toBeLessThanOrEqual(8)
  })
  it('rejects saves that no longer match the card or the deck', () => {
    expect(isRound({ id: 'a', guesses: ['b', 'c'] }, 'a', tiny)).toBe(true)
    expect(isRound(JSON.parse(JSON.stringify({ id: 'a', guesses: ['b', 'a'] })), 'a', tiny)).toBe(true)
    expect(isRound(null, 'a', tiny)).toBe(false)
    expect(isRound({ id: 'b', guesses: [] }, 'a', tiny)).toBe(false)
    expect(isRound({ id: 'a', guesses: ['nobody'] }, 'a', tiny)).toBe(false)
    expect(isRound({ id: 'a', guesses: ['b', 'b'] }, 'a', tiny)).toBe(false)
    expect(isRound({ id: 'a', guesses: ['a', 'b'] }, 'a', tiny)).toBe(false)
    expect(isRound({ id: 'a', guesses: [1] }, 'a', tiny)).toBe(false)
    expect(isRound({ id: 'a' }, 'a', tiny)).toBe(false)
    expect(isRound({ id: 'gone', guesses: [] }, 'gone', tiny)).toBe(false)
  })
  it('shares a square per guess without naming anyone', () => {
    expect(whoamiShareText('Test', ['cold', 'close'], true, 11)).toBe('🏏 Lineup Lounge Who Am I? #12 (Test) 3/5\n🟥🟨🟩')
    expect(whoamiShareText('IPL', ['cold', 'cold', 'warm', 'cold', 'cold'], false)).toBe('🏏 Lineup Lounge Who Am I? (IPL practice) X/5\n🟥🟥🟨🟥🟥')
  })
})

describe('who am i data', () => {
  it.each(decks.map((x) => [x.format, x] as const))('%s: every card has a bio with its years, and the daily order is the deck', (format, deck) => {
    for (const x of deck.cards) {
      const span = data.players[x.id]?.span[format]
      expect(span, x.name).toBeDefined()
      expect(span![0], x.name).toBeLessThanOrEqual(span![1])
      const hints = data.players[x.id].hints[format]
      expect(hints, x.name).toHaveLength(HINTS)
      expect(hintsFor(x, deck, data.players[x.id])).toBe(hints)
      // The first three never name the player; the last may all but say it.
      const words = x.name.toLowerCase().split(/[^a-z]+/).filter((w) => w.length >= 3)
      for (const h of hints!.slice(0, 3))
        for (const f of h.facts) {
          const said = `${f.label} ${f.value} ${f.sub ?? ''}`.toLowerCase().split(/[^a-z]+/)
          expect(words.filter((w) => said.includes(w)), `${x.name}: ${f.value}`).toEqual([])
        }
      expect(hints![3].facts.at(-1), x.name).toMatchObject({ value: x.team, team: x.team })
      // A fact that shows a face names somebody with a card, and never the answer.
      for (const f of hints!.flatMap((h) => h.facts)) if (f.player) expect(f.player !== x.id && f.player in data.players, `${x.name}: ${f.player}`).toBe(true)
    }
    expect([...data.order[format]].sort()).toEqual(deck.cards.map((x) => x.id).sort())
  })
  it('has no bios for players without a card', () => {
    const ids = new Set(decks.flatMap((x) => x.cards.map((y) => y.id)))
    expect(Object.keys(data.players).filter((id) => !ids.has(id))).toEqual([])
  })
  it('rotates the format daily and never repeats a player within two weeks', () => {
    const last = new Map<string, number>()
    for (let day = 0; day < 1500; day++) {
      const { format, id } = dailyPick(day, data)
      expect(format).toBe(SHOWDOWN_FORMATS[day % 4])
      expect(day - (last.get(id) ?? -99), `${id} on day ${day}`).toBeGreaterThanOrEqual(14)
      last.set(id, day)
    }
  })
})
