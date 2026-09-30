import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import quiz from '../data/quiz.json'
import cricket from '../data/cricket.json'
import { questionSchema } from './puzzleSchema'
import type { Puzzle, Question } from './types'
import { dailyQuestions, isAnswer, nameDictionary, normalize, PASS, QUIZ_LENGTH, questionMark, quizScore, randomQuestions, suggest } from './quiz'

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
  it.each(questions.map((x) => [x.id, x] as const))('%s has an answer the autocomplete can find', (_, x) => {
    expect(suggest(dictionary, x.answer, 50)).toContain(x.answer)
    expect(isAnswer(x, x.answer)).toBe(true)
  })
  it('keeps match-ups and pairs out of the autocomplete', () => {
    expect(dictionary.some((n) => / v | & /.test(n))).toBe(false)
  })
})
