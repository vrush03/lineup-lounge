import type { Mark } from '../lib/score'

/** Class names shared by the Ballpark screens. */

export const MARK_TEXT: Record<Mark, string> = { correct: 'text-correct-ink', near: 'text-near-ink', wrong: 'text-wrong-ink' }
export const MARK_FILL: Record<Mark, string> = { correct: 'fill-correct', near: 'fill-near', wrong: 'fill-wrong' }

/** The big green "Next question" / "Play a practice round" button; add the corner radius and margin. */
export const NEXT_BUTTON =
  'flex w-full items-center justify-center gap-2 bg-pitch-deep py-3.5 font-display text-xl font-bold uppercase tracking-wider text-white shadow-lg shadow-pitch-deep/25 transition hover:bg-pitch active:scale-[0.99]'
