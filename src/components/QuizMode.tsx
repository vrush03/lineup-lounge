import { useEffect, useMemo, useState } from 'react'
import { Quiz } from './Quiz'
import { loadQuestions } from '../lib/puzzles'
import { dailyQuestions, nameDictionary, randomQuestions } from '../lib/quiz'
import type { Puzzle, Question } from '../lib/types'

type Round = 'daily' | 'practice'

type Props = {
  puzzles: Puzzle[]
  day: number
  dateLabel: string
  onFinishDaily: (score: number) => void
}

/** Question-and-answer mode: a daily round of five, plus practice rounds. */
export function QuizMode({ puzzles, day, dateLabel, onFinishDaily }: Props) {
  const [questions, setQuestions] = useState<Question[] | null>(null)
  const [failed, setFailed] = useState(false)
  useEffect(() => {
    loadQuestions().then(setQuestions, () => setFailed(true))
  }, [])

  if (!questions)
    return (
      <p role="status" className="py-16 text-center text-muted">
        {failed ? 'Couldn’t load the quiz. Check your connection and reload.' : 'Loading the quiz…'}
      </p>
    )
  return <QuizRounds questions={questions} puzzles={puzzles} day={day} dateLabel={dateLabel} onFinishDaily={onFinishDaily} />
}

function QuizRounds({ questions, puzzles, day, dateLabel, onFinishDaily }: Props & { questions: Question[] }) {
  const [round, setRound] = useState<Round>('daily')
  const [practice, setPractice] = useState<{ questions: Question[]; n: number } | null>(null)
  const daily = useMemo(() => dailyQuestions(questions, day), [questions, day])
  const names = useMemo(() => nameDictionary(puzzles, questions), [puzzles, questions])

  function newPractice() {
    setPractice((p) => ({ questions: randomQuestions(questions), n: (p?.n ?? 0) + 1 }))
    setRound('practice')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  return (
    <>
      <div>
        {round === 'daily' ? (
          <>
            <p className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-muted">{dateLabel}</p>
            <Quiz
              key={`daily:${day}`}
              questions={daily}
              names={names}
              storageKey={`cricket:${day}`}
              day={day}
              onFinish={onFinishDaily}
              onNext={newPractice}
            />
          </>
        ) : (
          <>
            <button
              onClick={() => setRound('daily')}
              className="mb-4 text-sm font-semibold text-muted underline-offset-4 hover:text-ink hover:underline"
            >
              ← Back to daily #{day + 1}
            </button>
            {practice && <Quiz key={`practice:${practice.n}`} questions={practice.questions} names={names} onNext={newPractice} />}
          </>
        )}
      </div>
    </>
  )
}
