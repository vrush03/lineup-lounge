import type { Mark } from './score'

/** labels = current order; guess = order at the last submit (so marks map back to items). */
export type Saved = { labels: string[]; attempts: Mark[][]; guess?: string[] }

function read<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : null
  } catch {
    return null
  }
}

function write(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    /* storage unavailable; game still works */
  }
}

const MARKS = new Set<unknown>(['correct', 'near', 'wrong'])

export function loadGame(key: string): Saved | null {
  const s = read<Saved>(`game:${key}`)
  // Discard saves from older versions (boolean marks) rather than crash.
  if (!s || !Array.isArray(s.labels) || !Array.isArray(s.attempts)) return null
  if (!s.attempts.every((a) => Array.isArray(a) && a.every((m) => MARKS.has(m)))) return null
  return s
}
export const saveGame = (key: string, s: Saved) => write(`game:${key}`, s)

export type Stats = {
  played: number
  won: number
  streak: number
  maxStreak: number
  lastWonDay: number | null
  lastPlayedDay: number | null
  /** dist[n] = wins that took n+1 attempts */
  dist: number[]
}
const emptyStats: Stats = { played: 0, won: 0, streak: 0, maxStreak: 0, lastWonDay: null, lastPlayedDay: null, dist: [0, 0, 0, 0, 0] }

export function loadStats(): Stats {
  const s = read<Partial<Stats>>('stats') ?? {}
  return { ...emptyStats, ...s, dist: s.dist?.length === 5 ? s.dist : [...emptyStats.dist] }
}

/** Record a finished daily puzzle. Recording the same day twice is ignored. */
export function recordResult(day: number, solved: boolean, attempts: number): Stats {
  const s = loadStats()
  if (s.lastPlayedDay === day) return s
  const streak = solved ? (s.lastWonDay === day - 1 ? s.streak + 1 : 1) : 0
  const dist = [...s.dist]
  if (solved) dist[attempts - 1] += 1
  const next: Stats = {
    played: s.played + 1,
    won: s.won + (solved ? 1 : 0),
    streak,
    maxStreak: Math.max(s.maxStreak, streak),
    lastWonDay: solved ? day : s.lastWonDay,
    lastPlayedDay: day,
    dist,
  }
  write('stats', next)
  return next
}

/** Streak shown in the header: a streak is broken if yesterday wasn't won. */
export function liveStreak(s: Stats, today: number): number {
  return s.lastWonDay !== null && s.lastWonDay >= today - 1 ? s.streak : 0
}

export const loadPref = <T,>(key: string, fallback: T): T => read<T>(`pref:${key}`) ?? fallback
export const savePref = (key: string, v: unknown) => write(`pref:${key}`, v)

/** A daily quiz in progress: the question ids it was dealt and every guess so far ('' = passed). */
export type QuizSaved = { ids: string[]; guesses: string[][] }

const strings = (a: unknown): a is string[] => Array.isArray(a) && a.every((x) => typeof x === 'string')

export function loadQuiz(key: string): QuizSaved | null {
  const s = read<QuizSaved>(`quiz:${key}`)
  if (!s || !strings(s.ids) || !Array.isArray(s.guesses) || !s.guesses.every(strings)) return null
  return s
}
export const saveQuiz = (key: string, s: QuizSaved) => write(`quiz:${key}`, s)

export type QuizStats = {
  played: number
  /** Consecutive days with the daily quiz finished, whatever the score. */
  streak: number
  maxStreak: number
  lastPlayedDay: number | null
  lastScore: number | null
  /** dist[n] = daily quizzes that scored n */
  dist: number[]
}
const QUIZ_DIST = 6
const emptyQuizStats: QuizStats = { played: 0, streak: 0, maxStreak: 0, lastPlayedDay: null, lastScore: null, dist: Array(QUIZ_DIST).fill(0) }

export function loadQuizStats(): QuizStats {
  const s = read<Partial<QuizStats>>('stats:quiz') ?? {}
  return { ...emptyQuizStats, ...s, dist: s.dist?.length === QUIZ_DIST ? s.dist : [...emptyQuizStats.dist] }
}

/** Record a finished daily quiz. Recording the same day twice is ignored. */
export function recordQuiz(day: number, score: number): QuizStats {
  const s = loadQuizStats()
  if (s.lastPlayedDay === day) return s
  const streak = s.lastPlayedDay === day - 1 ? s.streak + 1 : 1
  const dist = [...s.dist]
  dist[Math.max(0, Math.min(QUIZ_DIST - 1, score))] += 1
  const next: QuizStats = {
    played: s.played + 1,
    streak,
    maxStreak: Math.max(s.maxStreak, streak),
    lastPlayedDay: day,
    lastScore: score,
    dist,
  }
  write('stats:quiz', next)
  return next
}

export function quizLiveStreak(s: QuizStats, today: number): number {
  return s.lastPlayedDay !== null && s.lastPlayedDay >= today - 1 ? s.streak : 0
}
