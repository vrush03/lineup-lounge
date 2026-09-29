import type { Mark } from './score'

const EMOJI: Record<Mark, string> = { correct: '🟩', near: '🟨', wrong: '⬜' }

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
