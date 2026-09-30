import { MAX_POINTS, pointsMark, quizPoints } from './quiz'
import type { Mark } from './score'

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

/** e.g. "🏏 Lineup Lounge Quiz #12 372/500" and a square per question coloured by its points. */
export function quizShareText(title: string, points: number[], day?: number): string {
  const total = `${quizPoints(points)}/${points.length * MAX_POINTS}`
  const head = day === undefined ? `🏏 ${title} (practice) ${total}` : `🏏 ${title} #${day + 1} ${total}`
  return [head, points.map((p) => EMOJI[pointsMark(p)]).join('')].join('\n')
}
