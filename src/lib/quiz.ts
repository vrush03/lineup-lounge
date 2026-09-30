import type { Mark } from './score'
import type { NumberQuestion, Puzzle, Question } from './types'

export const QUIZ_LENGTH = 5
export const MAX_GUESSES = 2
/** Points for a question; a daily quiz is out of QUIZ_LENGTH * MAX_POINTS. */
export const MAX_POINTS = 100
/** A guess of '' means the player gave up on the question. */
export const PASS = ''

/** Lowercase, no accents or punctuation, single spaces: "Muralitharan," -> "muralitharan". */
export function normalize(s: string): string {
  return s
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

const SCALE: Record<string, number> = { k: 1e3, thousand: 1e3, lakh: 1e5, lakhs: 1e5, m: 1e6, mn: 1e6, million: 1e6, cr: 1e7, crore: 1e7 }

/** "7,275", "7.3k", "1.5 lakh", "82 km" -> a number; null if there isn't one. */
export function parseNumber(s: string): number | null {
  const m = s.replace(/,/g, '').trim().toLowerCase().match(/^(-?\d*\.?\d+)\s*([a-z]*)/)
  if (!m) return null
  return Number(m[1]) * (SCALE[m[2]] ?? 1)
}

export function isAnswer(q: Question, guess: string): boolean {
  if (q.kind === 'number') {
    const n = parseNumber(guess)
    return n !== null && Math.abs(n - q.answer) <= q.margin
  }
  const g = normalize(guess)
  return !!g && [q.answer, ...(q.accept ?? [])].some((a) => normalize(a) === g)
}

/** How far off counts as "one margin" when scoring; exact-answer questions fall back to 10% of the answer. */
export const scale = (q: NumberQuestion) => q.margin || Math.max(1, Math.abs(q.answer) * 0.1)

/**
 * Points for a number guess: 100 when exact, 75 at the edge of the margin, then down to 0 at three
 * margins off. A pass or an unreadable guess scores 0.
 */
export function numberPoints(q: NumberQuestion, guess: string): number {
  const n = parseNumber(guess)
  if (n === null) return 0
  const r = Math.abs(n - q.answer) / scale(q)
  return Math.round(r <= 1 ? 100 - 25 * r : r < 3 ? (75 * (3 - r)) / 2 : 0)
}

/** Number questions get one guess; name questions a second after the hint. */
export const guessLimit = (q: Question) => (q.kind === 'number' ? 1 : MAX_GUESSES)

/** Points for a finished question (null while it is still open). Names: 100 first try, 50 with the hint. */
export function questionPoints(q: Question, guesses: string[]): number | null {
  if (q.kind === 'number') return guesses.length ? numberPoints(q, guesses[0]) : null
  const hit = guesses.findIndex((g) => isAnswer(q, g))
  if (hit === 0) return MAX_POINTS
  if (hit > 0) return MAX_POINTS / 2
  return guesses.length >= MAX_GUESSES || guesses.includes(PASS) ? 0 : null
}

/** Colour band for a question's points: 75+ is inside the margin (or a first-try name). */
export const pointsMark = (points: number): Mark => (points >= 75 ? 'correct' : points >= 25 ? 'near' : 'wrong')

const withUnit = (n: string, unit?: string) => (!unit ? n : unit === '%' ? `${n}%` : `${n} ${unit}`)

/** Round to what the margin makes meaningful: 81.75 ± 20 -> "82", 16.7 ± 3 -> "16.7". */
export function formatNumber(n: number, margin: number, plain = false): string {
  const digits = margin > 0 && margin < 5 && !Number.isInteger(n) ? 1 : 0
  return n.toLocaleString('en', { maximumFractionDigits: digits, useGrouping: !plain })
}

export function answerText(q: Question): string {
  return q.kind === 'number' ? withUnit(formatNumber(q.answer, q.margin, q.plain), q.unit) : q.answer
}

/** How far a guess was from the answer, e.g. "Off by 82 balls · 14% low" or "Off by 5.2 points · too high". */
export function offByText(q: NumberQuestion, guess: string): string {
  const n = parseNumber(guess)
  if (n === null) return 'No guess'
  const diff = n - q.answer
  if (!diff) return 'Spot on!'
  const gap = Math.abs(diff).toLocaleString('en', { maximumFractionDigits: 1, useGrouping: !q.plain })
  const way = diff < 0 ? 'low' : 'high'
  const pct = !q.plain && q.unit !== '%' && q.answer ? `${Math.round((100 * Math.abs(diff)) / Math.abs(q.answer))}% ${way}` : `too ${way}`
  return `Off by ${q.unit === '%' ? `${gap} points` : withUnit(gap, q.unit)} · ${pct}`
}

/** A guess as the player should see it again, e.g. "7k" -> "7,000 runs". */
export function guessText(q: Question, guess: string): string {
  if (q.kind !== 'number') return guess
  const n = parseNumber(guess)
  return n === null ? guess : withUnit(n.toLocaleString('en', { maximumFractionDigits: 2, useGrouping: !q.plain }), q.unit)
}

/** The colour band of a finished question; null while still open. */
export function questionMark(q: Question, guesses: string[]): Mark | null {
  const p = questionPoints(q, guesses)
  return p === null ? null : pointsMark(p)
}

/** A round's total; open questions count as 0. */
export const quizPoints = (points: (number | null)[]) => points.reduce<number>((a, p) => a + (p ?? 0), 0)

/** The day's questions: consecutive runs through the list, so every question comes up before any repeats. */
export function dailyQuestions(questions: Question[], day: number): Question[] {
  const n = questions.length
  const count = Math.min(QUIZ_LENGTH, n)
  const start = (((day * count) % n) + n) % n
  return Array.from({ length: count }, (_, k) => questions[(start + k) % n])
}

export function randomQuestions(questions: Question[], random = Math.random): Question[] {
  const pool = [...questions]
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1))
    const t = pool[i]
    pool[i] = pool[j]
    pool[j] = t
  }
  return pool.slice(0, QUIZ_LENGTH)
}

/**
 * Names to autocomplete: every player and team in the ranking puzzles plus the quiz answers,
 * so suggestions don't give the answer away. Match-ups ("A v B") and pairs ("A & B") are left out.
 */
export function nameDictionary(puzzles: Puzzle[], questions: Question[]): string[] {
  const names = new Map<string, string>()
  const add = (s: string | undefined) => {
    if (s && !/ v | & |\(/.test(s) && !names.has(normalize(s))) names.set(normalize(s), s)
  }
  for (const p of puzzles)
    for (const i of p.items) {
      add(i.label)
      add(i.team)
    }
  for (const q of questions) if (q.kind !== 'number') add(q.answer)
  return [...names.values()].sort((a, b) => a.localeCompare(b))
}

/** Names where every typed word starts a word of the name; names starting with the input come first. */
export function suggest(names: string[], input: string, limit = 6): string[] {
  const q = normalize(input)
  if (q.length < 2) return []
  const words = q.split(' ')
  const hits = names.filter((name) => {
    const parts = normalize(name).split(' ')
    return words.every((w) => parts.some((p) => p.startsWith(w)))
  })
  const starts = (n: string) => (normalize(n).startsWith(q) ? 0 : 1)
  return hits.sort((a, b) => starts(a) - starts(b)).slice(0, limit)
}
