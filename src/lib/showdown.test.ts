/// <reference types="node" />
import { existsSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import cards from '../data/cards.json'
import { deckSchema } from './puzzleSchema'
import { compare, cpuPick, deal, HAND, isGame, playRound, shuffle, statText, strength, winner, type Game } from './showdown'
import { hasTeamStyle } from './teams'
import { SHOWDOWN_FORMATS, type Card, type Deck } from './types'

const decks = z.array(deckSchema).parse(cards) as Deck[]

/** Deterministic random numbers, so a failing game can be replayed. */
function seeded(seed: number) {
  return () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296
    return seed / 4294967296
  }
}

const card = (id: string, runs: number, wickets: number): Card => ({ id, name: id, team: 'India', photo: `/players/${id}.jpg`, stats: { runs, wickets } })
const tiny: Deck = {
  format: 'ODI',
  asOf: '2026-01-01',
  source: { name: 's', url: 'https://example.com', license: 'l' },
  stats: [
    { key: 'runs', label: 'Runs', short: 'Runs' },
    { key: 'wickets', label: 'Wickets', short: 'Wkts' },
  ],
  cards: [card('a', 100, 0), card('b', 50, 9), card('c', 100, 5), card('d', 10, 1)],
}
const game = (g: Partial<Game>): Game => ({ you: [], cpu: [], pot: [], turn: 'you', round: 1, ...g })

describe('a round', () => {
  it('goes to the higher number, or nobody on a tie', () => {
    const [a, b, c] = tiny.cards
    expect(compare(a, b, 'runs')).toBe('you')
    expect(compare(a, b, 'wickets')).toBe('cpu')
    expect(compare(a, c, 'runs')).toBe('tie')
  })
  it('sends both cards to the bottom of the winner’s pile and passes the pick', () => {
    const g = playRound(game({ you: ['a', 'x'], cpu: ['b', 'y'] }), 'you')
    expect(g).toEqual({ you: ['x', 'a', 'b'], cpu: ['y'], pot: [], turn: 'cpu', round: 2 })
    expect(playRound(g, 'cpu')).toEqual({ you: ['a', 'b'], cpu: ['y', 'x'], pot: [], turn: 'you', round: 3 })
  })
  it('holds tied cards in the pot for the next winner', () => {
    const tied = playRound(game({ you: ['a', 'x'], cpu: ['c', 'y'] }), 'tie')
    expect(tied).toMatchObject({ you: ['x'], cpu: ['y'], pot: ['a', 'c'], turn: 'cpu' })
    expect(playRound(tied, 'cpu')).toMatchObject({ you: [], cpu: ['y', 'x', 'a', 'c'], pot: [] })
  })
  it('ends when a pile is empty', () => {
    expect(winner(game({ you: ['a'], cpu: ['b'] }))).toBeNull()
    expect(winner(game({ you: ['a', 'b'] }))).toBe('you')
    expect(winner(game({ cpu: ['a'], pot: ['b', 'c'] }))).toBe('cpu')
    expect(winner(game({ pot: ['a', 'b'] }))).toBe('draw')
  })
})

describe('the computer', () => {
  it('rates a stat by how much of the deck it beats', () => {
    expect(strength(tiny.cards[1], 'wickets', tiny)).toBe(1)
    expect(strength(tiny.cards[1], 'runs', tiny)).toBeCloseTo(1 / 3)
  })
  it('plays its strongest stat unless it rolls a random one', () => {
    expect(cpuPick(tiny.cards[1], tiny, () => 0)).toBe('wickets')
    expect(cpuPick(tiny.cards[0], tiny, () => 0)).toBe('runs')
    expect(cpuPick(tiny.cards[0], tiny, () => 0.99)).toBe('wickets')
  })
})

describe('formatting and saves', () => {
  it('prints decimals, thousands and not outs', () => {
    const c: Card = { ...card('a', 18426, 0), stats: { runs: 18426, average: 44.8, highest: 200 }, hsNotOut: true }
    expect(statText(c, { key: 'runs', label: '', short: '' })).toBe('18,426')
    expect(statText(c, { key: 'average', label: '', short: '', decimals: 2 })).toBe('44.80')
    expect(statText(c, { key: 'highest', label: '', short: '' })).toBe('200*')
  })
  it('rejects saved games that no longer match the deck', () => {
    const deck = decks[0]
    const g = deal(deck, seeded(1))
    expect(isGame(g, deck)).toBe(true)
    expect(isGame(JSON.parse(JSON.stringify(playRound(g, 'tie'))), deck)).toBe(true)
    expect(isGame(null, deck)).toBe(false)
    expect(isGame({ ...g, you: g.you.slice(1) }, deck)).toBe(false)
    expect(isGame({ ...g, you: ['nobody', ...g.you.slice(1)] }, deck)).toBe(false)
    expect(isGame({ ...g, cpu: g.you }, deck)).toBe(false)
    expect(isGame({ ...g, turn: 'me' }, deck)).toBe(false)
  })
})

describe('card decks', () => {
  it('has one deck per format', () => {
    expect(decks.map((d) => d.format).sort()).toEqual([...SHOWDOWN_FORMATS].sort())
  })
  it.each(decks.map((d) => [d.format, d] as const))('%s deck is complete', (_, deck) => {
    expect(deck.cards.length).toBeGreaterThanOrEqual(2 * HAND)
    expect(new Set(deck.cards.map((c) => c.id)).size).toBe(deck.cards.length)
    expect(new Set(deck.cards.map((c) => c.name)).size).toBe(deck.cards.length)
    const keys = deck.stats.map((s) => s.key).sort()
    for (const c of deck.cards) expect(Object.keys(c.stats).sort(), c.name).toEqual(keys)
    // No card is a copy of another, so some stat always separates two cards.
    expect(new Set(deck.cards.map((c) => JSON.stringify(c.stats))).size).toBe(deck.cards.length)
    expect(deck.cards.filter((c) => !hasTeamStyle(c.team)).map((c) => `${c.name}: ${c.team}`)).toEqual([])
    expect(deck.cards.filter((c) => c.photo && !existsSync(`public${c.photo}`)).map((c) => c.photo)).toEqual([])
    // Most cards carry a photo; the rest fall back to initials.
    expect(deck.cards.filter((c) => c.photo).length).toBeGreaterThan(deck.cards.length * 0.8)
    expect(deck.source.url).toMatch(/^https:\/\//)
  })
})

describe('whole games', () => {
  /** Both sides play like the computer; returns the rounds it took. */
  function play(deck: Deck, seed: number) {
    const rng = seeded(seed)
    const byId = new Map(deck.cards.map((c) => [c.id, c]))
    let g = deal(deck, rng)
    expect(g.you).toHaveLength(HAND)
    expect(new Set([...g.you, ...g.cpu]).size).toBe(2 * HAND)
    while (!winner(g) && g.round < 20000) {
      const you = byId.get(g.you[0])!
      const cpu = byId.get(g.cpu[0])!
      g = playRound(g, compare(you, cpu, cpuPick(g.turn === 'you' ? you : cpu, deck, rng)))
      expect(g.you.length + g.cpu.length + g.pot.length).toBe(2 * HAND)
    }
    expect(winner(g)).not.toBeNull()
    return g.round - 1
  }

  it.each(decks.map((d) => [d.format, d] as const))('%s games always finish', (_, deck) => {
    for (let seed = 1; seed <= 100; seed++) expect(play(deck, seed)).toBeGreaterThanOrEqual(HAND)
  })

  it('shuffles without losing cards', () => {
    expect(shuffle([1, 2, 3, 4, 5], seeded(7)).sort()).toEqual([1, 2, 3, 4, 5])
  })
})
