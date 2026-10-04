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

export type Source = { name: string; url: string; license: string }

/** Ballpark question families; a day has at most two of one. */
export const ESTIMATE_FAMILIES = ['scale', 'career', 'records', 'time', 'crowds'] as const
export type EstimateFamily = (typeof ESTIMATE_FAMILIES)[number]

/** A Ballpark question: one guess at a quantity, scored by how many times off it is. */
export type EstimateQuestion = {
  id: string
  prompt: string
  /** Always positive: the score compares guess and answer as a ratio. */
  answer: number
  /** Shown after numbers, e.g. "runs" or "km". */
  unit?: string
  family: EstimateFamily
  format?: Format
  /** How the answer is worked out, for questions built from a sum. */
  working?: string
  /** Shown once the question is over. */
  fact?: string
  /** Empty only for a sum made from figures in the prompt, which then shows its working. */
  sources: Source[]
}

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

/* Who Am I? */
export const ROLES = ['Batter', 'Bowler', 'All-rounder', 'Wicketkeeper'] as const
export type Role = (typeof ROLES)[number]

/** What Who Am I? knows about a player beyond their cards. */
export type Bio = {
  role: Role
  bats: 'Right' | 'Left'
  /** Years of the first and last match, for each format the player has a card in. */
  span: Partial<Record<ShowdownFormat, [number, number]>>
  /** Four hints for each of those cards, weakest first. */
  hints: Partial<Record<ShowdownFormat, Hint[]>>
}

/** One tile of a hint: "ODI debut" / "1999" / "v Pakistan". */
export type HintFact = {
  label: string
  value: string
  /** A smaller line under the value. */
  sub?: string
  /** Card id of a player the fact names, for their photo. */
  player?: string
  /** A team the fact names, for its badge. */
  team?: string
}

/** A Who Am I? hint: a title in the player's voice ("My story") and a few facts. */
export type Hint = { title: string; facts: HintFact[] }

/** Who Am I? data: a bio per card id, and the order each deck's cards come up as the daily. */
export type WhoAmIData = {
  players: Record<string, Bio>
  order: Record<ShowdownFormat, string[]>
}
