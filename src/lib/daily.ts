const EPOCH = Date.UTC(2026, 0, 1)
const DAY_MS = 86_400_000

/** Whole days since the epoch, using the player's local calendar date. */
export function dayNumber(date: Date = new Date()): number {
  const local = Date.UTC(date.getFullYear(), date.getMonth(), date.getDate())
  return Math.floor((local - EPOCH) / DAY_MS)
}

export function puzzleIndex(count: number, date: Date = new Date()): number {
  return ((dayNumber(date) % count) + count) % count
}
