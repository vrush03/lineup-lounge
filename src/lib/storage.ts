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

/** A daily Ballpark round in progress: the question ids it was dealt and every guess so far ('' = passed). */
export type RoundSaved = { ids: string[]; guesses: string[][] }

const strings = (a: unknown): a is string[] => Array.isArray(a) && a.every((x) => typeof x === 'string')

function loadRound(key: string): RoundSaved | null {
  const s = read<RoundSaved>(key)
  if (!s || !strings(s.ids) || !Array.isArray(s.guesses) || !s.guesses.every(strings)) return null
  return s
}
const num = (x: unknown, fallback: number) => (typeof x === 'number' && Number.isFinite(x) ? x : fallback)
const counts = (a: unknown, n: number) => (Array.isArray(a) && a.length === n && a.every((x) => typeof x === 'number') ? a : Array(n).fill(0))

export const loadBallpark = (key: string) => loadRound(`ballpark:${key}`)
export const saveBallpark = (key: string, s: RoundSaved) => write(`ballpark:${key}`, s)

export type BallparkStats = {
  played: number
  /** Consecutive days with the daily round finished, whatever the score. */
  streak: number
  maxStreak: number
  lastPlayedDay: number | null
  lastPoints: number | null
  bestPoints: number
  totalPoints: number
  /** pointsDist[n] = daily rounds that scored n*100 to n*100+99 (a perfect 500 goes in the last bucket) */
  pointsDist: number[]
}
const BALLPARK_DIST = 5

export function loadBallparkStats(): BallparkStats {
  const s = read<Partial<BallparkStats>>('stats:ballpark') ?? {}
  return {
    played: num(s.played, 0),
    streak: num(s.streak, 0),
    maxStreak: num(s.maxStreak, 0),
    lastPlayedDay: typeof s.lastPlayedDay === 'number' ? s.lastPlayedDay : null,
    lastPoints: typeof s.lastPoints === 'number' ? s.lastPoints : null,
    bestPoints: num(s.bestPoints, 0),
    totalPoints: num(s.totalPoints, 0),
    // Rounds were once out of 300 (three buckets): keep those counts and add the new empty ones.
    pointsDist: Array.isArray(s.pointsDist) && s.pointsDist.length === 3 ? [...counts(s.pointsDist, 3), 0, 0] : counts(s.pointsDist, BALLPARK_DIST),
  }
}

/** Record a finished daily Ballpark round's points. Recording the same day twice is ignored. */
export function recordBallpark(day: number, points: number): BallparkStats {
  const s = loadBallparkStats()
  if (s.lastPlayedDay === day) return s
  const streak = s.lastPlayedDay === day - 1 ? s.streak + 1 : 1
  const pointsDist = [...s.pointsDist]
  pointsDist[Math.max(0, Math.min(BALLPARK_DIST - 1, Math.floor(points / 100)))] += 1
  const next: BallparkStats = {
    played: s.played + 1,
    streak,
    maxStreak: Math.max(s.maxStreak, streak),
    lastPlayedDay: day,
    lastPoints: points,
    bestPoints: Math.max(s.bestPoints, points),
    totalPoints: s.totalPoints + points,
    pointsDist,
  }
  write('stats:ballpark', next)
  return next
}

export const ballparkLiveStreak = (s: BallparkStats, today: number) =>
  s.lastPlayedDay !== null && s.lastPlayedDay >= today - 1 ? s.streak : 0

/** A Showdown game in progress, one per format. The caller checks it against the deck (`isGame`). */
export const loadShowdown = (format: string): unknown => read<unknown>(`showdown:${format}`)
export const saveShowdown = (format: string, game: unknown) => write(`showdown:${format}`, game)
export function clearShowdown(format: string) {
  try {
    localStorage.removeItem(`showdown:${format}`)
  } catch {
    /* storage unavailable */
  }
}

export type ShowdownStats = {
  played: number
  won: number
  /** Consecutive games won. */
  streak: number
  maxStreak: number
  /** Games won per format, e.g. { ODI: 3 }. */
  wins: Record<string, number>
}

export function loadShowdownStats(): ShowdownStats {
  const s = read<Partial<ShowdownStats>>('stats:showdown') ?? {}
  const wins = s.wins && typeof s.wins === 'object' && !Array.isArray(s.wins) ? s.wins : {}
  return {
    played: num(s.played, 0),
    won: num(s.won, 0),
    streak: num(s.streak, 0),
    maxStreak: num(s.maxStreak, 0),
    wins: Object.fromEntries(Object.entries(wins).filter(([, n]) => typeof n === 'number')),
  }
}

/** Record a finished Showdown game. A draw counts as played and ends the winning streak. */
export function recordShowdown(format: string, won: boolean): ShowdownStats {
  const s = loadShowdownStats()
  const streak = won ? s.streak + 1 : 0
  const next: ShowdownStats = {
    played: s.played + 1,
    won: s.won + (won ? 1 : 0),
    streak,
    maxStreak: Math.max(s.maxStreak, streak),
    wins: won ? { ...s.wins, [format]: (s.wins[format] ?? 0) + 1 } : s.wins,
  }
  write('stats:showdown', next)
  return next
}
