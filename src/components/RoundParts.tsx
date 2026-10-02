import { useEffect, useRef, useState } from 'react'
import { MarkIcon } from './MarkIcon'
import { Countdown } from './ResultPanel'
import { MAX_POINTS, pointsMark, quizPoints } from '../lib/quiz'
import type { Mark } from '../lib/score'
import { quizShareText } from '../lib/share'
import { MARK_TEXT, NEXT_BUTTON } from './roundStyles'

/** Shared by the question-a-screen modes (Quiz, Ballpark): progress, points, the round summary. */

export function Progress({ marks, pos }: { marks: (Mark | null)[]; pos: number }) {
  return (
    <ol className="mb-5 flex gap-1.5" aria-label={`${marks.filter(Boolean).length} of ${marks.length} answered`}>
      {marks.map((m, i) => (
        <li
          key={i}
          className={`h-1.5 flex-1 rounded-full transition-colors ${
            m === 'correct' ? 'bg-correct' : m === 'near' ? 'bg-near' : m === 'wrong' ? 'bg-wrong' : i === pos ? 'bg-ink/40' : 'bg-line'
          }`}
        />
      ))}
    </ol>
  )
}

export function PointsBadge({ points }: { points: number }) {
  return (
    <p className="flex items-baseline gap-1.5">
      <span className={`font-display text-6xl font-extrabold leading-none tabular-nums ${MARK_TEXT[pointsMark(points)]}`}>{points}</span>
      <span className="font-display text-xl font-bold text-muted">/ {MAX_POINTS}</span>
    </p>
  )
}

export type SummaryRow = { id: string; prompt: string; answer: string; points: number; symbol?: string }

type SummaryProps = {
  rows: SummaryRow[]
  /** [minimum points, headline], best first. */
  headlines: [number, string][]
  /** Shown at the start of the share text, e.g. "Lineup Lounge Quiz". */
  shareTitle: string
  /** Legend text for the green band, e.g. "75+". */
  greenLabel: string
  day?: number
  onNext?: () => void
  justFinished: boolean
}

export function RoundSummary({ rows, headlines, shareTitle, greenLabel, day, onNext, justFinished }: SummaryProps) {
  const [copied, setCopied] = useState(false)
  const next = useRef<HTMLButtonElement>(null)
  const points = rows.map((r) => r.points)
  const total = quizPoints(points)
  const max = rows.length * MAX_POINTS
  const good = total >= max / 2
  const daily = day !== undefined

  useEffect(() => {
    if (justFinished) next.current?.focus({ preventScroll: true })
  }, [justFinished])

  async function share() {
    const text = quizShareText(shareTitle, points, day)
    try {
      if (navigator.share && matchMedia('(pointer: coarse)').matches) await navigator.share({ text })
      else await navigator.clipboard.writeText(text)
      setCopied(true)
    } catch {
      /* share sheet dismissed */
    }
  }

  return (
    <div className="animate-rise overflow-hidden rounded-3xl border border-line bg-surface shadow-[var(--shadow)]">
      <div className={`px-5 pt-5 pb-4 ${good ? 'bg-correct/10' : 'bg-leather/8'}`}>
        <p className={`text-xs font-semibold uppercase tracking-[0.18em] ${good ? 'text-correct-ink' : 'text-muted'}`}>
          {daily ? 'Today’s score' : 'Your score'}
        </p>
        <p className="mt-1 flex items-baseline gap-2">
          <span className="font-display text-6xl font-extrabold leading-none tabular-nums">{total}</span>
          <span className="font-display text-2xl font-bold text-muted">/ {max}</span>
        </p>
        <p className="mt-1 font-display text-2xl font-extrabold uppercase">{headlines.find(([min]) => total >= min)![1]}</p>
      </div>
      <ol className="divide-y divide-line border-y border-line">
        {rows.map((r) => (
          <li key={r.id} className="flex items-start gap-3 px-5 py-3">
            <MarkIcon mark={pointsMark(r.points)} symbol={r.symbol} size={20} />
            <div className="min-w-0 flex-1">
              <p className="text-sm text-muted">{r.prompt}</p>
              <p className="font-semibold">{r.answer}</p>
            </div>
            <span className={`shrink-0 font-display text-xl font-bold tabular-nums ${MARK_TEXT[pointsMark(r.points)]}`}>{r.points}</span>
          </li>
        ))}
      </ol>
      <p className="flex flex-wrap justify-center gap-x-4 gap-y-1 px-5 pt-3 text-xs text-muted">
        <span className="flex items-center gap-1.5"><MarkIcon mark="correct" symbol="" size={12} /> {greenLabel}</span>
        <span className="flex items-center gap-1.5"><MarkIcon mark="near" symbol="" size={12} /> 25–74</span>
        <span className="flex items-center gap-1.5"><MarkIcon mark="wrong" symbol="" size={12} /> Under 25</span>
      </p>
      <div className="flex flex-col gap-2 p-4">
        {onNext && (
          <button ref={next} onClick={onNext} className={`${NEXT_BUTTON} rounded-xl`}>
            {daily ? 'Play a practice round' : 'New round'}
            <span aria-hidden>→</span>
          </button>
        )}
        <button
          onClick={share}
          className="w-full rounded-xl border border-line py-2.5 font-display text-base font-bold uppercase tracking-wider text-muted transition hover:text-ink active:scale-[0.99]"
        >
          {copied ? 'Copied to clipboard' : 'Share result'}
        </button>
      </div>
      {daily && <Countdown day={day} />}
    </div>
  )
}
