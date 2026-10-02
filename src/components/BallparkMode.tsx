import { useEffect, useMemo, useState } from 'react'
import { Ballpark } from './Ballpark'
import { BALLPARK_LENGTH } from '../lib/ballpark'
import { loadEstimates } from '../lib/puzzles'
import { dailyQuestions } from '../lib/quiz'
import type { EstimateQuestion } from '../lib/types'

type Round = 'daily' | 'practice'

type Props = {
  day: number
  dateLabel: string
  onFinishDaily: (points: number) => void
}

/** Estimation mode: a daily round of three, plus practice rounds. */
export function BallparkMode({ day, dateLabel, onFinishDaily }: Props) {
  const [questions, setQuestions] = useState<EstimateQuestion[] | null>(null)
  const [failed, setFailed] = useState(false)
  useEffect(() => {
    loadEstimates().then(setQuestions, () => setFailed(true))
  }, [])

  if (!questions)
    return (
      <p role="status" className="py-16 text-center text-muted">
        {failed ? 'Couldn’t load the questions. Check your connection and reload.' : 'Loading…'}
      </p>
    )
  return <Rounds questions={questions} day={day} dateLabel={dateLabel} onFinishDaily={onFinishDaily} />
}

function Rounds({ questions, day, dateLabel, onFinishDaily }: Props & { questions: EstimateQuestion[] }) {
  const [round, setRound] = useState<Round>('daily')
  const [practice, setPractice] = useState<{ questions: EstimateQuestion[]; n: number } | null>(null)
  const daily = useMemo(() => dailyQuestions(questions, day, BALLPARK_LENGTH), [questions, day])

  // Practice plays a random other day from the dealt list, so it keeps the daily's rules: three
  // families, no two questions that give each other away, at most one IPL question.
  function newPractice() {
    const days = Math.floor(questions.length / BALLPARK_LENGTH)
    const today = ((day % days) + days) % days
    const pick = days > 1 ? (today + 1 + Math.floor(Math.random() * (days - 1))) % days : today
    setPractice((p) => ({ questions: dailyQuestions(questions, pick, BALLPARK_LENGTH), n: (p?.n ?? 0) + 1 }))
    setRound('practice')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  // A block, so the "Back to daily" button doesn't sit on the shell's "All games" line.
  return round === 'daily' ? (
    <div>
      <p className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-muted">{dateLabel}</p>
      <Ballpark key={`daily:${day}`} questions={daily} storageKey={`cricket:${day}`} day={day} onFinish={onFinishDaily} onNext={newPractice} />
    </div>
  ) : (
    <div>
      <button
        onClick={() => setRound('daily')}
        className="mb-4 text-sm font-semibold text-muted underline-offset-4 hover:text-ink hover:underline"
      >
        ← Back to daily #{day + 1}
      </button>
      {practice && <Ballpark key={`practice:${practice.n}`} questions={practice.questions} onNext={newPractice} />}
    </div>
  )
}
