import { MAX_POINTS, parseNumber, withUnit } from './quiz'
import type { EstimateFamily, EstimateQuestion } from './types'

/** Questions in a Ballpark round; a daily is out of BALLPARK_LENGTH * MAX_POINTS. */
export const BALLPARK_LENGTH = 3
/** A guess within 5% of the answer, either way, scores full points. */
const SPOT_ON = 0.05
/** Points fall to 75 this many powers of ten off (about 1.8 times), the edge of the green band. */
export const GREEN_ORDERS = 0.25

export const FAMILY_LABEL: Record<EstimateFamily, string> = {
  scale: 'Size it up',
  career: 'Career',
  records: 'Record books',
  time: 'Time and distance',
  crowds: 'Crowds and cash',
}

/**
 * A guess as a positive number, or null (the field shakes). A unit that is also a scale word
 * ("27 crore" when the answer is in crore) is dropped first, so it isn't multiplied out. On a
 * question measured in cm or km, a trailing "m" is ambiguous (metres or million), so it is refused.
 */
export function parseGuess(q: EstimateQuestion, guess: string): number | null {
  const s = guess.trim().toLowerCase()
  const unit = q.unit?.toLowerCase()
  const bare = unit && s.endsWith(unit) ? s.slice(0, -unit.length) : s
  if (unit?.endsWith('m') && /\d\s*m$/.test(bare)) return null
  const n = parseNumber(bare)
  return n !== null && n > 0 && Number.isFinite(n) ? n : null
}

const isSpotOn = (q: EstimateQuestion, n: number) => Math.abs(n - q.answer) <= SPOT_ON * q.answer

/** 100 within 5%, then 100 * (1 - orders off): 2x off is 70, 3x is 52, 10x is 0. A pass scores 0. */
export function estimatePoints(q: EstimateQuestion, guess: string): number {
  const n = parseGuess(q, guess)
  if (n === null) return 0
  // Powers of ten apart: 0.3 is twice or half.
  const orders = Math.abs(Math.log10(n / q.answer))
  return isSpotOn(q, n) ? MAX_POINTS : Math.max(0, Math.round(MAX_POINTS * (1 - orders)))
}

/** Points per question, null while it is still open (each question takes one guess). */
export const roundPoints = (questions: EstimateQuestion[], guesses: string[][]) =>
  questions.map((q, i) => (guesses[i]?.length ? estimatePoints(q, guesses[i][0]) : null))

/** "18,426", "2.4", "0.45", "0.004": whole numbers from 10 up, one decimal from 1, else two significant figures. */
export function formatAmount(n: number): string {
  const a = Math.abs(n)
  return a >= 1
    ? n.toLocaleString('en', { maximumFractionDigits: a >= 10 ? 0 : 1 })
    : n.toLocaleString('en', { maximumSignificantDigits: 2 })
}

export const answerText = (q: EstimateQuestion) => withUnit(formatAmount(q.answer), q.unit)

export function guessText(q: EstimateQuestion, guess: string): string {
  const n = parseGuess(q, guess)
  return n === null ? guess : withUnit(formatAmount(n), q.unit)
}

/** "Spot on!" within 5%, otherwise "2.4× too low" or "12× too high". */
export function timesOffText(q: EstimateQuestion, guess: string): string {
  const n = parseGuess(q, guess)
  if (n === null) return 'No guess'
  if (isSpotOn(q, n)) return 'Spot on!'
  const times = Math.max(n / q.answer, q.answer / n)
  return `${times.toLocaleString('en', { maximumFractionDigits: times < 10 ? 1 : 0 })}× too ${n < q.answer ? 'low' : 'high'}`
}
