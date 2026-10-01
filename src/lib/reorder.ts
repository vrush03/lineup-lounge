/**
 * Move the item at `from` to `to`, leaving the pinned slots untouched: only the free items
 * shuffle along, stepping over anything pinned. A move from or to a pinned slot does nothing.
 */
export function moveAround<T>(list: T[], pinned: ReadonlySet<number>, from: number, to: number): T[] {
  const free = list.flatMap((_, i) => (pinned.has(i) ? [] : [i]))
  const a = free.indexOf(from)
  const b = free.indexOf(to)
  if (a < 0 || b < 0 || a === b) return list
  const items = free.map((i) => list[i])
  items.splice(b, 0, ...items.splice(a, 1))
  const out = [...list]
  free.forEach((slot, k) => (out[slot] = items[k]))
  return out
}

/** The nearest free slot above (-1) or below (1) `from`, or -1 when there is none. */
export function freeSlot(length: number, pinned: ReadonlySet<number>, from: number, dir: -1 | 1): number {
  for (let i = from + dir; i >= 0 && i < length; i += dir) if (!pinned.has(i)) return i
  return -1
}
