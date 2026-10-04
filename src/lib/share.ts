import { MAX_POINTS, pointsMark, sumPoints } from './ballpark'
import type { Mark } from './score'
import { MAX_GUESSES, shareSquares, type Warmth } from './whoami'

const EMOJI: Record<Mark, string> = { correct: '🟩', near: '🟨', wrong: '🟥' }

export function shareText(
  title: string,
  day: number,
  attempts: Mark[][],
  solved: boolean,
  maxAttempts: number,
  prompt?: string,
): string {
  const score = solved ? `${attempts.length}/${maxAttempts}` : `X/${maxAttempts}`
  const grid = attempts.map((marks) => marks.map((m) => EMOJI[m]).join('')).join('\n')
  return [`🏏 ${title} #${day + 1} ${score}`, prompt, grid].filter(Boolean).join('\n')
}

/** e.g. "🏏 Lineup Lounge Ballpark #12 372/500" and a square per question coloured by its points. */
export function roundShareText(title: string, points: number[], day?: number): string {
  const total = `${sumPoints(points)}/${points.length * MAX_POINTS}`
  const head = day === undefined ? `🏏 ${title} (practice) ${total}` : `🏏 ${title} #${day + 1} ${total}`
  return [head, points.map((p) => EMOJI[pointsMark(p)]).join('')].join('\n')
}

/** e.g. "🏏 Lineup Lounge Who Am I? #12 (Test) 3/5" and a square per guess. `wrong` is the warmth of each miss. */
export function whoamiShareText(format: string, wrong: Warmth[], solved: boolean, day?: number): string {
  const score = `${solved ? wrong.length + 1 : 'X'}/${MAX_GUESSES}`
  const head = day === undefined ? `🏏 Lineup Lounge Who Am I? (${format} practice) ${score}` : `🏏 Lineup Lounge Who Am I? #${day + 1} (${format}) ${score}`
  return [head, shareSquares(wrong, solved)].join('\n')
}
