export type Item = {
  label: string
  value: number
  /** Formatted value for the reveal, e.g. "400*", "10/53", "15,921". */
  display?: string
  note: string
  /** Team the item played for (franchise for IPL, country otherwise). */
  team?: string
  country?: string
}

export const FORMATS = ['IPL', 'Test', 'ODI', 'T20I', 'World Cup', 'T20 World Cup'] as const
export type Format = (typeof FORMATS)[number]

export type Puzzle = {
  id: string
  prompt: string
  format?: Format
  /** "desc" = largest/latest first, "asc" = smallest/earliest first */
  direction: 'asc' | 'desc'
  unit?: string
  difficulty?: 'easy' | 'medium' | 'hard'
  tags?: string[]
  items: Item[]
  source?: { name: string; url: string; license: string }
  asOf?: string | null
}

type QuestionBase = {
  id: string
  prompt: string
  /** Shown after the first wrong guess. */
  hint: string
  /** Shown once the question is over, e.g. "15,921 runs in 200 Tests". */
  fact?: string
  format?: Format
  source?: { name: string; url: string; license: string }
}

/** Answered by typing a player or team name. */
export type NameQuestion = QuestionBase & {
  kind?: 'name'
  answer: string
  /** Other spellings that also count, e.g. a surname or nickname. */
  accept?: string[]
}

/** A ballpark estimate, scored by closeness: exact is 100 points, `margin` off is 75, three margins off is 0. */
export type NumberQuestion = QuestionBase & {
  kind: 'number'
  answer: number
  margin: number
  /** Shown after numbers, e.g. "km" or "%". */
  unit?: string
  /** Print without thousands separators, e.g. a year. */
  plain?: boolean
}

export type Question = NameQuestion | NumberQuestion
