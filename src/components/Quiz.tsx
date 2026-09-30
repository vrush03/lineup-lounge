import { useEffect, useMemo, useRef, useState } from 'react'
import { AnswerInput } from './AnswerInput'
import { FormatBadge } from './FormatBadge'
import { MarkIcon } from './MarkIcon'
import { Countdown } from './ResultPanel'
import { MAX_GUESSES, PASS, answerText, direction, guessText, marginText, isAnswer, normalize, parseNumber, questionMark, quizScore } from '../lib/quiz'
import type { Mark } from '../lib/score'
import { quizShareText } from '../lib/share'
import { loadQuiz, saveQuiz } from '../lib/storage'
import type { Question } from '../lib/types'

const HEADLINES = ['Duck!', 'Off the mark', 'Getting started', 'Solid knock', 'Half-century hero', 'Perfect over!']

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
  const marks = useMemo(() => questions.map((q, i) => questionMark(q, guesses[i])), [questions, guesses])
  const firstOpen = marks.indexOf(null)
  // The question on screen; it stays put after it's answered until the player moves on.
  const [pos, setPos] = useState(() => (firstOpen === -1 ? questions.length : firstOpen))
  const [shake, setShake] = useState(0)
  const [justFinished, setJustFinished] = useState(false)
  const over = pos >= questions.length

  useEffect(() => {
    if (storageKey) saveQuiz(storageKey, { ids: questions.map((q) => q.id), guesses })
  }, [storageKey, questions, guesses])

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
    if (text !== PASS && !isAnswer(q, text)) setShake((s) => s + 1)
    const all = questions.map((x, i) => questionMark(x, next[i]))
    if (all.every((m) => m !== null)) onFinish?.(quizScore(all))
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
          marks={marks as Mark[]}
          day={day}
          onNext={onNext}
          justFinished={justFinished}
        />
      ) : (
        <QuestionCard
          key={pos}
          n={pos}
          total={questions.length}
          question={questions[pos]}
          guesses={guesses[pos]}
          mark={marks[pos]}
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
  total: number
  question: Question
  guesses: string[]
  mark: Mark | null
  names: string[]
  shake: number
  last: boolean
  onGuess: (g: string) => void
  onNext: () => void
}

function QuestionCard({ n, total, question: q, guesses, mark, names, shake, last, onGuess, onNext }: CardProps) {
  const misses = guesses.filter((g) => g !== PASS && !isAnswer(q, g))
  const way = misses.length ? direction(q, misses[misses.length - 1]) : null
  const next = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    if (mark) next.current?.focus({ preventScroll: true })
  }, [mark])

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <span className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">
          Question {n + 1} of {total}
        </span>
        {q.format && <FormatBadge format={q.format} />}
      </div>
      <h2 className="font-display text-[28px] font-bold uppercase leading-[1.05] tracking-tight text-balance sm:text-[32px]">
        {q.prompt}
      </h2>

      {misses.length > 0 && (
        <ul className="mt-4 flex flex-wrap gap-2" aria-label="Wrong guesses">
          {misses.map((g) => (
            <li key={g} className="flex items-center gap-1.5 rounded-full bg-leather/10 px-3 py-1 text-sm font-medium text-wrong-ink">
              <span className="line-through decoration-1">{guessText(q, g)}</span>
              {direction(q, g) && <span aria-label={direction(q, g)!}>{direction(q, g) === 'higher' ? '↑' : '↓'}</span>}
            </li>
          ))}
        </ul>
      )}
      {!mark && misses.length > 0 && (
        <p role="status" className="mt-3 animate-rise rounded-2xl border border-near/40 bg-near/10 px-4 py-3 text-[15px]">
          {way && <span className="mr-1.5 font-display text-lg font-bold uppercase">{way === 'higher' ? 'Higher ↑' : 'Lower ↓'}</span>}
          <span className="font-semibold">Hint:</span> {q.hint}
        </p>
      )}

      {!mark ? (
        <div className="mt-5">
          {q.kind === 'number' ? (
            <AnswerInput
              unit={q.unit}
              note={q.margin ? `Ballpark: anything within ${marginText(q)} counts.` : 'Needs the exact number.'}
              onSubmit={onGuess}
              shake={shake}
              tries={MAX_GUESSES - guesses.length}
            />
          ) : (
            <AnswerInput
              names={names}
              note="Pick a suggestion or type the name."
              onSubmit={onGuess}
              shake={shake}
              tries={MAX_GUESSES - guesses.length}
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
          <div
            role="status"
            className={`flex items-start gap-3 rounded-2xl border px-4 py-3.5 ${
              mark === 'wrong' ? 'border-leather/30 bg-leather/8' : 'border-correct/30 bg-correct/10'
            }`}
          >
            <MarkIcon mark={mark} symbol={mark === 'near' ? '✓' : undefined} size={26} />
            <div>
              <p className={`text-sm font-semibold ${mark === 'wrong' ? 'text-wrong-ink' : 'text-correct-ink'}`}>
                {mark === 'correct' ? 'Correct!' : mark === 'near' ? 'Got it with the hint' : 'The answer was'}
              </p>
              <p className="font-display text-2xl font-bold uppercase leading-tight">{answerText(q)}</p>
              {q.fact && <p className="mt-0.5 text-sm text-muted">{q.fact}</p>}
            </div>
          </div>
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

type SummaryProps = {
  questions: Question[]
  marks: Mark[]
  day?: number
  onNext?: () => void
  justFinished: boolean
}

function Summary({ questions, marks, day, onNext, justFinished }: SummaryProps) {
  const [copied, setCopied] = useState(false)
  const next = useRef<HTMLButtonElement>(null)
  const score = quizScore(marks)
  const daily = day !== undefined

  useEffect(() => {
    if (justFinished) next.current?.focus({ preventScroll: true })
  }, [justFinished])

  async function share() {
    const text = quizShareText('Lineup Lounge Quiz', marks, questions.length, day)
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
      <div className={`px-5 pt-5 pb-4 ${score >= 3 ? 'bg-correct/10' : 'bg-leather/8'}`}>
        <p className={`text-xs font-semibold uppercase tracking-[0.18em] ${score >= 3 ? 'text-correct-ink' : 'text-muted'}`}>
          {score} of {questions.length} right
        </p>
        <p className="mt-1 font-display text-3xl font-extrabold uppercase">{HEADLINES[Math.min(score, HEADLINES.length - 1)]}</p>
      </div>
      <ol className="divide-y divide-line border-y border-line">
        {questions.map((q, i) => (
          <li key={q.id} className="flex items-start gap-3 px-5 py-3">
            <MarkIcon mark={marks[i]} symbol={marks[i] === 'near' ? '✓' : undefined} size={20} />
            <div className="min-w-0">
              <p className="text-sm text-muted">{q.prompt}</p>
              <p className="font-semibold">{answerText(q)}</p>
            </div>
          </li>
        ))}
      </ol>
      <p className="flex flex-wrap justify-center gap-x-4 gap-y-1 px-5 pt-3 text-xs text-muted">
        <span className="flex items-center gap-1.5"><MarkIcon mark="correct" size={14} /> First try</span>
        <span className="flex items-center gap-1.5"><MarkIcon mark="near" symbol="✓" size={14} /> With the hint</span>
        <span className="flex items-center gap-1.5"><MarkIcon mark="wrong" size={14} /> Missed</span>
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
