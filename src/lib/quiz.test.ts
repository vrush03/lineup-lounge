import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import quiz from '../data/quiz.json'
import cricket from '../data/cricket.json'
import { questionSchema } from './puzzleSchema'
import type { Puzzle, Question } from './types'
import {
  answerText,
  dailyQuestions,
  direction,
  guessText,
  isAnswer,
  marginText,
  nameDictionary,
  normalize,
  parseNumber,
  PASS,
  QUIZ_LENGTH,
  questionMark,
  quizScore,
  randomQuestions,
  suggest,
} from './quiz'

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
  })
  it('counts anything within the margin, and says which way to go', () => {
    expect(isAnswer(km, '100')).toBe(true)
    expect(isAnswer(km, '61.75')).toBe(true)
    expect(isAnswer(km, '102')).toBe(false)
    expect(isAnswer(km, 'far')).toBe(false)
    expect(direction(km, '40')).toBe('higher')
    expect(direction(km, '150')).toBe('lower')
    expect(questionMark(km, ['40', '90'])).toBe('near')
  })
  it('formats answers, guesses and margins with the unit', () => {
    expect(answerText(km)).toBe('82 km')
    expect(answerText({ ...km, answer: 16.7, margin: 3, unit: undefined })).toBe('16.7')
    expect(answerText({ ...km, answer: 58, margin: 8, unit: '%' })).toBe('58%')
    expect(guessText(km, '1.5k')).toBe('1,500 km')
    const year: Question = { id: 'y', kind: 'number', prompt: 'When?', answer: 1877, margin: 10, plain: true, hint: 'h' }
    expect(answerText(year)).toBe('1877')
    expect(guessText(year, '1900')).toBe('1900')
    if (km.kind === 'number') expect(marginText(km)).toBe('±20 km')
  })
})

describe('questionMark', () => {
  it('is correct on the first guess, near on the second, wrong after two misses or a pass', () => {
    expect(questionMark(q, [])).toBeNull()
    expect(questionMark(q, ['Murali'])).toBe('correct')
    expect(questionMark(q, ['Warne'])).toBeNull()
    expect(questionMark(q, ['Warne', 'Murali'])).toBe('near')
    expect(questionMark(q, ['Warne', 'Kumble'])).toBe('wrong')
    expect(questionMark(q, [PASS])).toBe('wrong')
    expect(quizScore(['correct', 'near', 'wrong', null])).toBe(2)
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
      expect(isAnswer(x, String(x.answer))).toBe(true)
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
