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

export const SHOWDOWN_FORMATS = ['ODI', 'T20I', 'Test', 'IPL'] as const
export type ShowdownFormat = (typeof SHOWDOWN_FORMATS)[number]

/** One line on a card. Every stat is "higher wins". */
export type StatDef = {
  key: string
  label: string
  /** Label for narrow cards, e.g. "Wkts". */
  short: string
  /** Decimal places to print, for averages and strike rates. */
  decimals?: number
}

export type Card = {
  id: string
  name: string
  /** Country, or the IPL franchise the player turned out for most. */
  team: string
  /** Portrait in /public; cards without one show initials on the team colour. */
  photo?: string
  stats: Record<string, number>
  hsNotOut?: boolean
}

/** A Showdown deck: every card carries the deck's stats for that one format. */
export type Deck = {
  format: ShowdownFormat
  asOf: string
  source: { name: string; url: string; license: string }
  stats: StatDef[]
  cards: Card[]
}
