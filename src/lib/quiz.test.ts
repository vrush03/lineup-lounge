import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import quiz from '../data/quiz.json'
import cricket from '../data/cricket.json'
import { questionSchema } from './puzzleSchema'
import type { Puzzle, Question } from './types'
import {
  answerText,
  dailyQuestions,
  guessText,
  isAnswer,
  nameDictionary,
  normalize,
  numberPoints,
  offByText,
  parseNumber,
  PASS,
  pointsMark,
  QUIZ_LENGTH,
  questionMark,
  questionPoints,
  quizPoints,
  randomQuestions,
  suggest,
} from './quiz'
import { quizShareText } from './share'

const questions = z.array(questionSchema).parse(quiz) as Question[]
const q: Question = { id: 'x', prompt: 'Most Test wickets?', answer: 'Muttiah Muralitharan', accept: ['Murali'], hint: 'Sri Lankan' }

describe('answer matching', () => {
  it('ignores case, accents, punctuation and extra spaces', () => {
    expect(normalize('  Muttiah   MURALITHARAN! ')).toBe('muttiah muralitharan')
    expect(normalize('Héctor')).toBe('hector')
    expect(isAnswer(q, 'muttiah muralitharan')).toBe(true)
    expect(isAnswer(q, 'murali.')).toBe(true)
    expect(isAnswer(q, 'Shane Warne')).toBe(false)
    expect(isAnswer(q, '')).toBe(false)
  })
})

describe('number answers', () => {
  const km: Question = { id: 'k', kind: 'number', prompt: 'How far?', answer: 81.75, margin: 20, unit: 'km', hint: 'h' }
  it('parses commas, suffixes and trailing units', () => {
    expect(parseNumber('7,275')).toBe(7275)
    expect(parseNumber('7.3k')).toBe(7300)
    expect(parseNumber('1.5 lakh')).toBe(150000)
    expect(parseNumber('82 km')).toBe(82)
    expect(parseNumber('.5')).toBe(0.5)
    expect(parseNumber('lots')).toBeNull()
    expect(parseNumber('2 bn')).toBe(2e9)
    expect(parseNumber('3 billion')).toBe(3e9)
    expect(parseNumber('2 crores')).toBe(2e7)
    expect(parseNumber('₹27 crore')).toBe(2.7e8)
  })
  it('scores 100 when exact, 75 at the edge of the margin, and 0 from three margins off', () => {
    if (km.kind !== 'number') throw new Error()
    expect(numberPoints(km, '81.75')).toBe(100)
    expect(numberPoints(km, '91.75')).toBe(88)
    expect(numberPoints(km, '61.75')).toBe(75)
    expect(numberPoints(km, '121.75')).toBe(38)
    expect(numberPoints(km, '141.75')).toBe(0)
    expect(numberPoints(km, '1000')).toBe(0)
    expect(numberPoints(km, 'far')).toBe(0)
    expect(numberPoints(km, PASS)).toBe(0)
  })
  it('falls back to 10% of the answer (at least 1) when the margin is 0', () => {
    const exact: Question = { id: 'e', kind: 'number', prompt: 'How many?', answer: 4, margin: 0, hint: 'h' }
    if (exact.kind !== 'number') throw new Error()
    expect(numberPoints(exact, '4')).toBe(100)
    expect(numberPoints(exact, '3')).toBe(75)
    expect(numberPoints(exact, '7')).toBe(0)
  })
  it('gives number questions one guess', () => {
    expect(questionPoints(km, [])).toBeNull()
    expect(questionPoints(km, ['40'])).toBe(34)
    expect(questionPoints(km, ['40', '82'])).toBe(34)
    expect(questionMark(km, ['82'])).toBe('correct')
  })
  it('says how far off a guess was', () => {
    if (km.kind !== 'number') throw new Error()
    expect(offByText(km, '81.75')).toBe('Spot on!')
    expect(offByText(km, '60')).toBe('Off by 21.8 km · 27% low')
    expect(offByText({ ...km, answer: 58, unit: '%' }, '63')).toBe('Off by 5 points · too high')
    expect(offByText({ ...km, answer: 1877, unit: undefined, plain: true }, '1900')).toBe('Off by 23 · too high')
  })
  it('formats answers and guesses with the unit', () => {
    expect(answerText(km)).toBe('82 km')
    expect(answerText({ ...km, answer: 16.7, margin: 3, unit: undefined })).toBe('16.7')
    expect(answerText({ ...km, answer: 58, margin: 8, unit: '%' })).toBe('58%')
    expect(guessText(km, '1.5k')).toBe('1,500 km')
    const year: Question = { id: 'y', kind: 'number', prompt: 'When?', answer: 1877, margin: 10, plain: true, hint: 'h' }
    expect(answerText(year)).toBe('1877')
    expect(guessText(year, '1900')).toBe('1900')
  })
})

describe('name questions', () => {
  it('score 100 on the first guess, 50 on the second, 0 after two misses or a pass', () => {
    expect(questionPoints(q, [])).toBeNull()
    expect(questionPoints(q, ['Murali'])).toBe(100)
    expect(questionPoints(q, ['Warne'])).toBeNull()
    expect(questionPoints(q, ['Warne', 'Murali'])).toBe(50)
    expect(questionPoints(q, ['Warne', 'Kumble'])).toBe(0)
    expect(questionPoints(q, [PASS])).toBe(0)
  })
})

describe('points', () => {
  it('bands points into marks and totals a round', () => {
    expect([100, 75, 74, 50, 25, 24, 0].map(pointsMark)).toEqual(['correct', 'correct', 'near', 'near', 'near', 'wrong', 'wrong'])
    expect(questionMark(q, ['Warne', 'Murali'])).toBe('near')
    expect(quizPoints([100, 50, 0, null, 72])).toBe(222)
  })
  it('shares the total and a square per question', () => {
    expect(quizShareText('Quiz', [100, 50, 10, 80, 0], 11)).toBe('🏏 Quiz #12 240/500\n🟩🟨🟥🟩🟥')
    expect(quizShareText('Quiz', [100, 100, 100, 100, 100])).toBe('🏏 Quiz (practice) 500/500\n🟩🟩🟩🟩🟩')
  })
})

describe('question selection', () => {
  const many = Array.from({ length: 12 }, (_, i) => ({ ...q, id: `q${i}` }))
  it('deals consecutive runs so every question comes up before a repeat', () => {
    expect(dailyQuestions(many, 0).map((x) => x.id)).toEqual(['q0', 'q1', 'q2', 'q3', 'q4'])
    expect(dailyQuestions(many, 2).map((x) => x.id)).toEqual(['q10', 'q11', 'q0', 'q1', 'q2'])
    expect(dailyQuestions(many, -1)).toHaveLength(QUIZ_LENGTH)
  })
  it('never repeats a question within a round', () => {
    expect(dailyQuestions(questions, 7).map((x) => x.id)).toEqual([...new Set(dailyQuestions(questions, 7).map((x) => x.id))])
    expect(new Set(randomQuestions(many).map((x) => x.id)).size).toBe(QUIZ_LENGTH)
  })
})

describe('suggest', () => {
  const names = ['Rohit Sharma', 'Virat Kohli', 'Ishant Sharma', 'Sharmin Akter', 'India']
  it('matches the start of any word and ranks names that start with the input first', () => {
    expect(suggest(names, 'sharm')).toEqual(['Sharmin Akter', 'Rohit Sharma', 'Ishant Sharma'])
    expect(suggest(names, 'v koh')).toEqual(['Virat Kohli'])
    expect(suggest(names, 'k')).toEqual([])
  })
})

describe('quiz dataset', () => {
  const dictionary = nameDictionary(cricket as Puzzle[], questions)
  it('has enough unique questions for a round', () => {
    expect(questions.length).toBeGreaterThanOrEqual(QUIZ_LENGTH)
    expect(new Set(questions.map((x) => x.id)).size).toBe(questions.length)
  })
  it.each(questions.map((x) => [x.id, x] as const))('%s has a reachable answer', (_, x) => {
    if (x.kind === 'number') {
      expect(numberPoints(x, String(x.answer))).toBe(100)
      expect(x.margin).toBeLessThan(Math.abs(x.answer))
    } else {
      expect(suggest(dictionary, x.answer, 50)).toContain(x.answer)
      expect(isAnswer(x, x.answer)).toBe(true)
    }
  })
  it('deals whole days that mix names and numbers', () => {
    expect(questions.length % QUIZ_LENGTH).toBe(0)
    for (let day = 0; day < questions.length / QUIZ_LENGTH; day++) {
      const set = dailyQuestions(questions, day)
      expect(set.filter((x) => x.kind === 'number').length).toBeGreaterThanOrEqual(2)
      expect(set.filter((x) => x.kind !== 'number').length).toBeGreaterThanOrEqual(1)
    }
  })
  it('keeps match-ups and pairs out of the autocomplete', () => {
    expect(dictionary.some((n) => / v | & /.test(n))).toBe(false)
  })
})
