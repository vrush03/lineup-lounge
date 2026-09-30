import type { Mark } from './score'
import type { Puzzle, Question } from './types'

export const QUIZ_LENGTH = 5
export const MAX_GUESSES = 2
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

export function isAnswer(q: Question, guess: string): boolean {
  const g = normalize(guess)
  return !!g && [q.answer, ...(q.accept ?? [])].some((a) => normalize(a) === g)
}

/** correct = first guess, near = after the hint, wrong = missed or passed; null while still open. */
export function questionMark(q: Question, guesses: string[]): Mark | null {
  const hit = guesses.findIndex((g) => isAnswer(q, g))
  if (hit === 0) return 'correct'
  if (hit > 0) return 'near'
  return guesses.length >= MAX_GUESSES || guesses.includes(PASS) ? 'wrong' : null
}

export const quizScore = (marks: (Mark | null)[]) => marks.filter((m) => m === 'correct' || m === 'near').length

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
  for (const q of questions) add(q.answer)
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
