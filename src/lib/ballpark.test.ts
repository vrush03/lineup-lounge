import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import ballpark from '../data/ballpark.json'
import quiz from '../data/quiz.json'
import { estimateSchema } from './puzzleSchema'
import type { EstimateQuestion } from './types'
import {
  BALLPARK_LENGTH,
  answerText,
  estimatePoints,
  formatAmount,
  guessText,
  parseGuess,
  roundPoints,
  timesOffText,
} from './ballpark'
import { dailyQuestions, normalize, PASS } from './quiz'

const questions = z.array(estimateSchema).parse(ballpark) as EstimateQuestion[]
const q: EstimateQuestion = {
  id: 'x',
  prompt: 'How many?',
  answer: 1000,
  unit: 'balls',
  family: 'records',
  sources: [{ name: 'Test', url: 'https://example.com', license: 'CC0' }],
}

describe('scoring', () => {
  it('scores by how many times off the guess is, the same high or low', () => {
    expect(estimatePoints(q, '1000')).toBe(100)
    expect(estimatePoints(q, '1050')).toBe(100)
    expect(estimatePoints(q, '950')).toBe(100)
    expect(estimatePoints(q, '1051')).toBe(98)
    expect(estimatePoints(q, '949')).toBe(98)
    expect(estimatePoints(q, '2000')).toBe(70)
    expect(estimatePoints(q, '500')).toBe(70)
    expect(estimatePoints(q, '3000')).toBe(52)
    expect(estimatePoints(q, '5000')).toBe(30)
    expect(estimatePoints(q, '10000')).toBe(0)
    expect(estimatePoints(q, '50')).toBe(0)
  })
  it('scores a pass, a non-number or a non-positive guess as 0', () => {
    expect(estimatePoints(q, PASS)).toBe(0)
    expect(estimatePoints(q, 'lots')).toBe(0)
    expect(estimatePoints(q, '0')).toBe(0)
    expect(parseGuess(q, '-5')).toBeNull()
    expect(parseGuess(q, '9'.repeat(400))).toBeNull()
  })
  it('totals a round, with open questions as null', () => {
    expect(roundPoints([q, q, q], [['2000'], [], [PASS]])).toEqual([70, null, 0])
  })
})

describe('reading guesses', () => {
  it('reads suffixes, including billions', () => {
    expect(parseGuess(q, '2.5k')).toBe(2500)
    expect(parseGuess(q, '1.5 lakh')).toBe(150000)
    expect(parseGuess(q, '3 bn')).toBe(3e9)
    expect(parseGuess(q, '2 billion')).toBe(2e9)
    expect(parseGuess(q, '1.5 lac')).toBe(150000)
    expect(parseGuess(q, '1e6')).toBe(1e6)
    expect(parseGuess(q, '$4m')).toBe(4e6)
  })
  it('refuses a bare "m" on a question measured in cm or km, where it could mean metres', () => {
    const cm = { ...q, answer: 249, unit: 'cm' }
    expect(parseGuess(cm, '2.5 m')).toBeNull()
    expect(parseGuess(cm, '250')).toBe(250)
    expect(parseGuess(cm, '250 cm')).toBe(250)
    expect(parseGuess({ ...q, unit: 'ms' }, '450 ms')).toBe(450)
    expect(parseGuess(q, '2m')).toBe(2e6)
  })
  it("doesn't multiply out a unit that is also a scale word", () => {
    const crore = { ...q, answer: 27, unit: 'crore' }
    expect(parseGuess(crore, '27 crore')).toBe(27)
    expect(parseGuess(crore, '27')).toBe(27)
    expect(estimatePoints(crore, '27 Crore')).toBe(100)
  })
})

describe('text', () => {
  it('says how many times off a guess was', () => {
    expect(timesOffText(q, '1020')).toBe('Spot on!')
    expect(timesOffText(q, '400')).toBe('2.5× too low')
    expect(timesOffText(q, '12000')).toBe('12× too high')
    expect(timesOffText(q, PASS)).toBe('No guess')
  })
  it('formats answers and guesses with the unit', () => {
    expect(answerText(q)).toBe('1,000 balls')
    expect(guessText(q, '1.5k')).toBe('1,500 balls')
    expect(formatAmount(0.449)).toBe('0.45')
    expect(formatAmount(2.44)).toBe('2.4')
    expect(formatAmount(1990000)).toBe('1,990,000')
    expect(formatAmount(0.004)).toBe('0.004')
  })
})

describe('question selection', () => {
  const many = Array.from({ length: 9 }, (_, i) => ({ ...q, id: `q${i}` }))
  it('deals three consecutive questions a day', () => {
    expect(dailyQuestions(many, 0, BALLPARK_LENGTH).map((x) => x.id)).toEqual(['q0', 'q1', 'q2'])
    expect(dailyQuestions(many, 4, BALLPARK_LENGTH).map((x) => x.id)).toEqual(['q3', 'q4', 'q5'])
  })
})

describe('ballpark dataset', () => {
  it('has at least 60 unique questions in whole days', () => {
    expect(questions.length).toBeGreaterThanOrEqual(60)
    expect(questions.length % BALLPARK_LENGTH).toBe(0)
    expect(new Set(questions.map((x) => x.id)).size).toBe(questions.length)
    expect(new Set(questions.map((x) => normalize(x.prompt))).size).toBe(questions.length)
  })
  it('gives every day three different families and at most one IPL question', () => {
    for (let day = 0; day < questions.length / BALLPARK_LENGTH; day++) {
      const set = dailyQuestions(questions, day, BALLPARK_LENGTH)
      expect(new Set(set.map((x) => x.family)).size).toBe(BALLPARK_LENGTH)
      expect(set.filter((x) => x.format === 'IPL').length).toBeLessThanOrEqual(1)
    }
  })
  it('covers more than the IPL', () => {
    expect(questions.filter((x) => x.format === 'IPL').length).toBeLessThanOrEqual(questions.length / 4)
  })
  it('never repeats a Quiz question', () => {
    const asked = new Set((quiz as { prompt: string }[]).map((x) => normalize(x.prompt)))
    expect(questions.filter((x) => asked.has(normalize(x.prompt)))).toEqual([])
  })
  it.each(questions.map((x) => [x.id, x] as const))('%s scores 100 for its own answer', (_, x) => {
    expect(estimatePoints(x, String(x.answer))).toBe(100)
    expect(estimatePoints(x, answerText(x))).toBe(100)
  })
})
