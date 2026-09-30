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

export function quizShareText(title: string, marks: Mark[], total: number, day?: number): string {
  const score = marks.filter((m) => m !== 'wrong').length
  const head = day === undefined ? `🏏 ${title} (practice) ${score}/${total}` : `🏏 ${title} #${day + 1} ${score}/${total}`
  return [head, marks.map((m) => EMOJI[m]).join('')].join('\n')
}
