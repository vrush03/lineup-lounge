import { useEffect, useMemo, useRef, useState } from 'react'
import { AnswerInput } from './AnswerInput'
import { FormatBadge } from './FormatBadge'
import { PointsBadge, Progress, RoundSummary } from './RoundParts'
import { MARK_FILL, NEXT_BUTTON } from './roundStyles'
import {
  FAMILY_LABEL,
  GREEN_ORDERS,
  answerText,
  estimatePoints,
  guessText,
  parseGuess,
  roundPoints,
  timesOffText,
} from '../lib/ballpark'
import { PASS, pointsMark, quizPoints } from '../lib/quiz'
import { loadBallpark, saveBallpark } from '../lib/storage'
import type { EstimateQuestion } from '../lib/types'

/** [minimum points, headline] for the summary, best first. */
const HEADLINES: [number, string][] = [
  [300, 'Bang on!'],
  [240, 'Sharp eye'],
  [180, 'In the ballpark'],
  [120, 'Getting warmer'],
  [60, 'Way off the mark'],
  [0, 'Lost in the crowd'],
]

type Props = {
  questions: EstimateQuestion[]
  /** Persist progress under this key (daily); omit for practice rounds. */
  storageKey?: string
  day?: number
  onFinish?: (points: number) => void
  onNext?: () => void
}

function restore(questions: EstimateQuestion[], storageKey?: string): string[][] {
  const saved = storageKey ? loadBallpark(storageKey) : null
  // A save from a different question set (the dataset changed) starts fresh.
  if (saved && saved.ids.join() === questions.map((q) => q.id).join() && saved.guesses.length === questions.length)
    return saved.guesses
  return questions.map(() => [])
}

export function Ballpark({ questions, storageKey, day, onFinish, onNext }: Props) {
  const [guesses, setGuesses] = useState(() => restore(questions, storageKey))
  const points = useMemo(() => roundPoints(questions, guesses), [questions, guesses])
  const marks = points.map((p) => (p === null ? null : pointsMark(p)))
  const firstOpen = points.indexOf(null)
  // The question on screen; it stays put after it's answered until the player moves on.
  const [pos, setPos] = useState(() => (firstOpen === -1 ? questions.length : firstOpen))
  const [shake, setShake] = useState(0)
  const [justFinished, setJustFinished] = useState(false)
  const over = pos >= questions.length

  useEffect(() => {
    if (storageKey) saveBallpark(storageKey, { ids: questions.map((q) => q.id), guesses })
  }, [storageKey, questions, guesses])

  function guess(text: string) {
    const q = questions[pos]
    // Not a usable number: shake without using up the guess.
    if (text !== PASS && parseGuess(q, text) === null) {
      setShake((s) => s + 1)
      return
    }
    const next = guesses.map((g, i) => (i === pos ? [text] : g))
    setGuesses(next)
    const all = roundPoints(questions, next)
    if (all.every((p) => p !== null)) onFinish?.(quizPoints(all))
  }

  function advance() {
    const next = marks.findIndex((m, i) => i > pos && m === null)
    if (next === -1) setJustFinished(true)
    setPos(next === -1 ? questions.length : next)
    setShake(0)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  return (
    <section className="animate-rise" aria-label="Ballpark">
      <Progress marks={marks} pos={pos} />
      {over ? (
        <RoundSummary
          rows={questions.map((q, i) => ({ id: q.id, prompt: q.prompt, answer: answerText(q), points: points[i]!, symbol: '#' }))}
          headlines={HEADLINES}
          shareTitle="Lineup Lounge Ballpark"
          greenLabel="75+ (within 1.8×)"
          day={day}
          onNext={onNext}
          justFinished={justFinished}
        />
      ) : (
        <QuestionCard
          key={pos}
          n={pos}
          count={questions.length}
          question={questions[pos]}
          guess={guesses[pos][0]}
          total={quizPoints(points)}
          shake={shake}
          onGuess={guess}
          onNext={advance}
          last={marks.every((m, i) => i === pos || m !== null)}
        />
      )}
    </section>
  )
}

type CardProps = {
  n: number
  count: number
  question: EstimateQuestion
  /** The one guess, once made ('' = passed). */
  guess: string | undefined
  /** Running total for the round so far. */
  total: number
  shake: number
  last: boolean
  onGuess: (g: string) => void
  onNext: () => void
}

function QuestionCard({ n, count, question: q, guess, total, shake, last, onGuess, onNext }: CardProps) {
  const over = guess !== undefined
  const next = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    if (over) next.current?.focus({ preventScroll: true })
  }, [over])

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <span className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">
          Question {n + 1} of {count}
        </span>
        <span className="rounded-full border border-line px-2 py-0.5 text-[11px] font-semibold text-muted">{FAMILY_LABEL[q.family]}</span>
        {q.format && <FormatBadge format={q.format} />}
        <span className="ml-auto text-xs font-semibold uppercase tracking-[0.18em] text-muted">
          Score <span className="font-display text-lg font-bold tabular-nums text-ink">{total}</span>
        </span>
      </div>
      <h2 className="font-display text-[28px] font-bold uppercase leading-[1.05] tracking-tight text-balance sm:text-[32px]">
        {q.prompt}
      </h2>

      {!over ? (
        <div className="mt-5">
          <AnswerInput
            unit={q.unit}
            words
            note="One guess. Within 2× scores 70; 10× off scores nothing. Try 25k, 1.5 lakh or 2 million."
            onSubmit={onGuess}
            shake={shake}
            tries={1}
          />
          <button
            onClick={() => onGuess(PASS)}
            className="mt-3 w-full py-2 text-sm font-semibold text-muted underline-offset-4 hover:text-ink hover:underline"
          >
            No idea · show the answer
          </button>
        </div>
      ) : (
        <div className="mt-5 animate-rise">
          <Reveal question={q} guess={guess} />
          <button
            ref={next}
            onClick={onNext}
            className={`${NEXT_BUTTON} mt-4 rounded-2xl`}
          >
            {last ? 'See your score' : 'Next question'}
            <span aria-hidden>→</span>
          </button>
        </div>
      )}
    </div>
  )
}

function Reveal({ question: q, guess }: { question: EstimateQuestion; guess: string }) {
  const points = estimatePoints(q, guess)
  const n = parseGuess(q, guess)
  return (
    <div role="status" className="rounded-2xl border border-line bg-surface px-4 py-4 shadow-[var(--shadow)]">
      <PointsBadge points={points} />
      <dl className="mt-3 space-y-0.5 text-[15px]">
        <div className="flex gap-1.5">
          <dt className="text-muted">Your guess:</dt>
          <dd className="font-semibold">{guess === PASS ? 'Passed' : guessText(q, guess)}</dd>
        </div>
        <div className="flex gap-1.5">
          <dt className="text-muted">Actual:</dt>
          <dd className="font-semibold">{answerText(q)}</dd>
        </div>
      </dl>
      {guess !== PASS && <p className="mt-0.5 text-sm text-muted">{timesOffText(q, guess)}</p>}
      {n !== null && <LogScale answer={q.answer} guess={n} points={points} />}
      {q.working && <p className="mt-3 text-sm text-muted">{q.working}</p>}
      {q.fact && <p className="mt-2 text-sm text-muted">{q.fact}</p>}
      {q.sources.length > 0 && (
        <p className="mt-3 text-xs text-muted">
          Source:{' '}
          {q.sources.map((s, i) => (
            <span key={s.url}>
              {i > 0 && ' · '}
              <a className="underline decoration-line underline-offset-2 hover:text-ink" href={s.url} target="_blank" rel="noreferrer">
                {s.name}
              </a>
            </span>
          ))}
        </p>
      )}
    </div>
  )
}

/** Log number line (each tick ten times the last): the answer, the band that scores 75+, and the guess. */
function LogScale({ answer, guess, points }: { answer: number; guess: number; points: number }) {
  const a = Math.log10(answer)
  const g = Math.log10(guess)
  let lo = Math.min(a - GREEN_ORDERS, g) - 0.35
  let hi = Math.max(a + GREEN_ORDERS, g) + 0.35
  if (hi - lo < 1.5) {
    const mid = (hi + lo) / 2
    lo = mid - 0.75
    hi = mid + 0.75
  }
  const [W, L, R] = [320, 14, 306]
  const x = (v: number) => L + ((v - lo) / (hi - lo)) * (R - L)
  const anchor = (v: number) => (x(v) < 50 ? 'start' : x(v) > W - 50 ? 'end' : 'middle')
  const span = Math.floor(hi) - Math.ceil(lo)
  // At most about six labelled ticks, however far off the guess is.
  const step = Math.max(1, Math.ceil(span / 6))
  const ticks = Array.from({ length: Math.floor(span / step) + 1 }, (_, i) => Math.ceil(lo) + i * step)
  const compact = (v: number) => v.toLocaleString('en', { notation: 'compact', maximumFractionDigits: 2 })
  const show = (v: number) => v.toLocaleString('en', { maximumFractionDigits: v < 10 ? 2 : 0 })
  return (
    <svg viewBox={`0 0 ${W} 84`} className="mt-3 w-full" role="img" aria-label={`Your guess ${show(guess)} against the answer ${show(answer)}, on a scale where each step is ten times the last`}>
      <line x1={L} x2={R} y1={40} y2={40} className="stroke-line" strokeWidth={4} strokeLinecap="round" />
      {ticks.map((k) => (
        <g key={k}>
          <line x1={x(k)} x2={x(k)} y1={45} y2={50} className="stroke-muted/60" strokeWidth={1} />
          <text x={x(k)} y={60} textAnchor="middle" className="fill-muted text-[9px]">
            {compact(10 ** k)}
          </text>
        </g>
      ))}
      <rect x={x(a - GREEN_ORDERS)} y={34} width={x(a + GREEN_ORDERS) - x(a - GREEN_ORDERS)} height={12} rx={6} className="fill-correct/25" />
      <circle cx={x(a)} cy={40} r={7} className="fill-correct stroke-surface" strokeWidth={2} />
      <text x={x(a)} y={22} textAnchor={anchor(a)} className="fill-correct-ink text-[11px] font-semibold">
        Actual {show(answer)}
      </text>
      <circle cx={x(g)} cy={40} r={6} className={`${MARK_FILL[pointsMark(points)]} stroke-surface`} strokeWidth={2} />
      <text x={x(g)} y={78} textAnchor={anchor(g)} className="fill-muted text-[11px] font-semibold">
        You {show(guess)}
      </text>
    </svg>
  )
}
