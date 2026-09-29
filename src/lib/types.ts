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
