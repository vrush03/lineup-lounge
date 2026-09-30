import { useEffect, useMemo, useRef, useState } from 'react'
import { AnswerInput } from './AnswerInput'
import { FormatBadge } from './FormatBadge'
import { MarkIcon } from './MarkIcon'
import { Countdown } from './ResultPanel'
import {
  MAX_POINTS,
  PASS,
  answerText,
  guessLimit,
  guessText,
  isAnswer,
  normalize,
  offByText,
  parseNumber,
  pointsMark,
  questionPoints,
  quizPoints,
  scale,
} from '../lib/quiz'
import type { Mark } from '../lib/score'
import { quizShareText } from '../lib/share'
import { loadQuiz, saveQuiz } from '../lib/storage'
import type { NumberQuestion, Question } from '../lib/types'

/** [minimum points, headline] for the summary, best first. */
const HEADLINES: [number, string][] = [
  [500, 'Perfect over!'],
  [400, 'Century maker'],
  [300, 'Solid knock'],
  [200, 'Getting going'],
  [100, 'Off the mark'],
  [0, 'Duck!'],
]
const MARK_TEXT: Record<Mark, string> = { correct: 'text-correct-ink', near: 'text-near-ink', wrong: 'text-wrong-ink' }

type Props = {
  questions: Question[]
  names: string[]
  /** Persist progress under this key (daily); omit for practice rounds. */
  storageKey?: string
  day?: number
  onFinish?: (score: number) => void
  onNext?: () => void
}

function restore(questions: Question[], storageKey?: string): string[][] {
  const saved = storageKey ? loadQuiz(storageKey) : null
  // A save from a different question set (the dataset changed) starts fresh.
  if (saved && saved.ids.join() === questions.map((q) => q.id).join() && saved.guesses.length === questions.length)
    return saved.guesses
  return questions.map(() => [])
}

export function Quiz({ questions, names, storageKey, day, onFinish, onNext }: Props) {
  const [guesses, setGuesses] = useState(() => restore(questions, storageKey))
  const points = useMemo(() => questions.map((q, i) => questionPoints(q, guesses[i])), [questions, guesses])
  const marks = points.map((p) => (p === null ? null : pointsMark(p)))
  const firstOpen = points.indexOf(null)
  // The question on screen; it stays put after it's answered until the player moves on.
  const [pos, setPos] = useState(() => (firstOpen === -1 ? questions.length : firstOpen))
  const [shake, setShake] = useState(0)
  const [justFinished, setJustFinished] = useState(false)
  const over = pos >= questions.length

  useEffect(() => {
    if (storageKey) saveQuiz(storageKey, { ids: questions.map((q) => q.id), guesses })
  }, [storageKey, questions, guesses])

  // A save can finish without a new guess (a number question half-played under the old two-guess
  // rules now counts as answered), so record it on load too; recording the same day again is a no-op.
  const [restoredDone] = useState(() => (firstOpen === -1 ? quizPoints(points) : null))
  const recorded = useRef(false)
  useEffect(() => {
    if (restoredDone === null || recorded.current) return
    recorded.current = true
    onFinish?.(restoredDone)
  }, [restoredDone, onFinish])

  function guess(text: string) {
    const q = questions[pos]
    const mine = guesses[pos]
    const same = (a: string, b: string) =>
      q.kind === 'number' ? parseNumber(a) === parseNumber(b) : normalize(a) === normalize(b)
    // Not a number, or a repeat of a wrong guess: shake without using up a try.
    if ((q.kind === 'number' && text !== PASS && parseNumber(text) === null) || mine.some((g) => same(g, text))) {
      setShake((s) => s + 1)
      return
    }
    const next = guesses.map((g, i) => (i === pos ? [...g, text] : g))
    setGuesses(next)
    if (q.kind !== 'number' && text !== PASS && !isAnswer(q, text)) setShake((s) => s + 1)
    const all = questions.map((x, i) => questionPoints(x, next[i]))
    if (all.every((p) => p !== null)) onFinish?.(quizPoints(all))
  }

  function advance() {
    const next = marks.findIndex((m, i) => i > pos && m === null)
    if (next === -1) setJustFinished(true)
    setPos(next === -1 ? questions.length : next)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  return (
    <section className="animate-rise" aria-label="Quiz">
      <Progress marks={marks} pos={pos} />
      {over ? (
        <Summary
          questions={questions}
          points={points as number[]}
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
          guesses={guesses[pos]}
          points={points[pos]}
          total={quizPoints(points)}
          names={names}
          shake={shake}
          onGuess={guess}
          onNext={advance}
          last={marks.every((m, i) => i === pos || m !== null)}
        />
      )}
    </section>
  )
}

function Progress({ marks, pos }: { marks: (Mark | null)[]; pos: number }) {
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

type CardProps = {
  n: number
  count: number
  question: Question
  guesses: string[]
  /** This question's points once it's over. */
  points: number | null
  /** Running total for the round so far. */
  total: number
  names: string[]
  shake: number
  last: boolean
  onGuess: (g: string) => void
  onNext: () => void
}

function QuestionCard({ n, count, question: q, guesses, points, total, names, shake, last, onGuess, onNext }: CardProps) {
  const misses = guesses.filter((g) => g !== PASS && !isAnswer(q, g))
  const over = points !== null
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
        {q.format && <FormatBadge format={q.format} />}
        <span className="ml-auto text-xs font-semibold uppercase tracking-[0.18em] text-muted">
          Score <span className="font-display text-lg font-bold tabular-nums text-ink">{total}</span>
        </span>
      </div>
      <h2 className="font-display text-[28px] font-bold uppercase leading-[1.05] tracking-tight text-balance sm:text-[32px]">
        {q.prompt}
      </h2>

      {q.kind !== 'number' && misses.length > 0 && (
        <ul className="mt-4 flex flex-wrap gap-2" aria-label="Wrong guesses">
          {misses.map((g) => (
            <li key={g} className="rounded-full bg-leather/10 px-3 py-1 text-sm font-medium text-wrong-ink line-through decoration-1">
              {g}
            </li>
          ))}
        </ul>
      )}
      {!over && misses.length > 0 && (
        <p role="status" className="mt-3 animate-rise rounded-2xl border border-near/40 bg-near/10 px-4 py-3 text-[15px]">
          <span className="font-semibold">Hint:</span> {q.hint}
        </p>
      )}

      {!over ? (
        <div className="mt-5">
          {q.kind === 'number' ? (
            <AnswerInput
              unit={q.unit}
              note="One guess. The closer you are, the more points."
              onSubmit={onGuess}
              shake={shake}
              tries={guessLimit(q) - guesses.length}
            />
          ) : (
            <AnswerInput
              names={names}
              note="Pick a suggestion or type the name."
              onSubmit={onGuess}
              shake={shake}
              tries={guessLimit(q) - guesses.length}
            />
          )}
          <button
            onClick={() => onGuess(PASS)}
            className="mt-3 w-full py-2 text-sm font-semibold text-muted underline-offset-4 hover:text-ink hover:underline"
          >
            I don’t know · show the answer
          </button>
        </div>
      ) : (
        <div className="mt-5 animate-rise">
          {q.kind === 'number' ? (
            <NumberReveal question={q} guess={guesses[0]} points={points} />
          ) : (
            <NameReveal question={q} points={points} />
          )}
          <button
            ref={next}
            onClick={onNext}
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-pitch-deep py-3.5 font-display text-xl font-bold uppercase tracking-wider text-white shadow-lg shadow-pitch-deep/25 transition hover:bg-pitch active:scale-[0.99]"
          >
            {last ? 'See your score' : 'Next question'}
            <span aria-hidden>→</span>
          </button>
        </div>
      )}
    </div>
  )
}

function PointsBadge({ points }: { points: number }) {
  return (
    <p className="flex items-baseline gap-1.5">
      <span className={`font-display text-6xl font-extrabold leading-none tabular-nums ${MARK_TEXT[pointsMark(points)]}`}>{points}</span>
      <span className="font-display text-xl font-bold text-muted">/ {MAX_POINTS}</span>
    </p>
  )
}

function NumberReveal({ question: q, guess, points }: { question: NumberQuestion; guess: string; points: number }) {
  const n = parseNumber(guess)
  return (
    <div role="status" className="rounded-2xl border border-line bg-surface px-4 py-4 shadow-[var(--shadow)]">
      <PointsBadge points={points} />
      <dl className="mt-3 space-y-0.5 text-[15px]">
        <div className="flex gap-1.5">
          <dt className="text-muted">Your answer:</dt>
          <dd className="font-semibold">{guess === PASS ? 'Passed' : guessText(q, guess)}</dd>
        </div>
        <div className="flex gap-1.5">
          <dt className="text-muted">Actual:</dt>
          <dd className="font-semibold">{answerText(q)}</dd>
        </div>
      </dl>
      {n !== null && <p className="mt-0.5 text-sm text-muted">{offByText(q, guess)}</p>}
      {n !== null && <ScaleBar question={q} guess={n} points={points} />}
      {q.fact && <p className="mt-3 text-sm text-muted">{q.fact}</p>}
    </div>
  )
}

const MARK_FILL: Record<Mark, string> = { correct: 'fill-correct', near: 'fill-near', wrong: 'fill-wrong' }

/** Number line: the answer, the band that scores 75+, and where the guess landed. */
function ScaleBar({ question: q, guess, points }: { question: NumberQuestion; guess: number; points: number }) {
  const w = scale(q)
  const lo = Math.min(guess, q.answer - w)
  const hi = Math.max(guess, q.answer + w)
  const pad = (hi - lo) * 0.08
  const [W, L, R] = [320, 14, 306]
  const x = (v: number) => L + ((v - (lo - pad)) / (hi - lo + 2 * pad)) * (R - L)
  const anchor = (v: number) => (x(v) < 50 ? 'start' : x(v) > W - 50 ? 'end' : 'middle')
  const show = (v: number) => v.toLocaleString('en', { maximumFractionDigits: 1, useGrouping: !q.plain })
  return (
    <svg viewBox={`0 0 ${W} 72`} className="mt-3 w-full" role="img" aria-label={`Your guess ${show(guess)} against the answer ${show(q.answer)}`}>
      <line x1={L} x2={R} y1={36} y2={36} className="stroke-line" strokeWidth={4} strokeLinecap="round" />
      <rect x={x(q.answer - w)} y={30} width={x(q.answer + w) - x(q.answer - w)} height={12} rx={6} className="fill-correct/25" />
      <circle cx={x(q.answer)} cy={36} r={7} className="fill-correct stroke-surface" strokeWidth={2} />
      <text x={x(q.answer)} y={18} textAnchor={anchor(q.answer)} className="fill-correct-ink text-[11px] font-semibold">
        Actual {show(q.answer)}
      </text>
      <circle cx={x(guess)} cy={36} r={6} className={`${MARK_FILL[pointsMark(points)]} stroke-surface`} strokeWidth={2} />
      <text x={x(guess)} y={62} textAnchor={anchor(guess)} className="fill-muted text-[11px] font-semibold">
        You {show(guess)}
      </text>
    </svg>
  )
}

function NameReveal({ question: q, points }: { question: Question; points: number }) {
  const mark = pointsMark(points)
  return (
    <div
      role="status"
      className={`flex items-start gap-3 rounded-2xl border px-4 py-3.5 ${
        mark === 'wrong' ? 'border-leather/30 bg-leather/8' : mark === 'near' ? 'border-near/40 bg-near/10' : 'border-correct/30 bg-correct/10'
      }`}
    >
      <MarkIcon mark={mark} symbol={mark === 'near' ? '✓' : undefined} size={26} />
      <div className="min-w-0 flex-1">
        <p className={`text-sm font-semibold ${MARK_TEXT[mark]}`}>
          {mark === 'correct' ? 'Correct!' : mark === 'near' ? 'Got it with the hint' : 'The answer was'}
        </p>
        <p className="font-display text-2xl font-bold uppercase leading-tight">{answerText(q)}</p>
        {q.fact && <p className="mt-0.5 text-sm text-muted">{q.fact}</p>}
      </div>
      <span className={`shrink-0 font-display text-2xl font-extrabold tabular-nums ${MARK_TEXT[mark]}`}>
        {points ? `+${points}` : '0'}
      </span>
    </div>
  )
}

type SummaryProps = {
  questions: Question[]
  points: number[]
  day?: number
  onNext?: () => void
  justFinished: boolean
}

function Summary({ questions, points, day, onNext, justFinished }: SummaryProps) {
  const [copied, setCopied] = useState(false)
  const next = useRef<HTMLButtonElement>(null)
  const total = quizPoints(points)
  const max = questions.length * MAX_POINTS
  const good = total >= max / 2
  const daily = day !== undefined

  useEffect(() => {
    if (justFinished) next.current?.focus({ preventScroll: true })
  }, [justFinished])

  async function share() {
    const text = quizShareText('Lineup Lounge Quiz', points, day)
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
        <p className="mt-1 font-display text-2xl font-extrabold uppercase">{HEADLINES.find(([min]) => total >= min)![1]}</p>
      </div>
      <ol className="divide-y divide-line border-y border-line">
        {questions.map((q, i) => (
          <li key={q.id} className="flex items-start gap-3 px-5 py-3">
            <MarkIcon
              mark={pointsMark(points[i])}
              symbol={q.kind === 'number' ? '#' : pointsMark(points[i]) === 'near' ? '✓' : undefined}
              size={20}
            />
            <div className="min-w-0 flex-1">
              <p className="text-sm text-muted">{q.prompt}</p>
              <p className="font-semibold">{answerText(q)}</p>
            </div>
            <span className={`shrink-0 font-display text-xl font-bold tabular-nums ${MARK_TEXT[pointsMark(points[i])]}`}>{points[i]}</span>
          </li>
        ))}
      </ol>
      <p className="flex flex-wrap justify-center gap-x-4 gap-y-1 px-5 pt-3 text-xs text-muted">
        <span className="flex items-center gap-1.5"><MarkIcon mark="correct" symbol="" size={12} /> 75+</span>
        <span className="flex items-center gap-1.5"><MarkIcon mark="near" symbol="" size={12} /> 25–74</span>
        <span className="flex items-center gap-1.5"><MarkIcon mark="wrong" symbol="" size={12} /> Under 25</span>
      </p>
      <div className="flex flex-col gap-2 p-4">
        {onNext && (
          <button
            ref={next}
            onClick={onNext}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-pitch-deep py-3.5 font-display text-xl font-bold uppercase tracking-wider text-white shadow-lg shadow-pitch-deep/25 transition hover:bg-pitch active:scale-[0.99]"
          >
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
