import { describe, expect, it } from 'vitest'
import { freeSlot, moveAround } from './reorder'

const list = ['a', 'b', 'c', 'd', 'e']

describe('moveAround', () => {
  it('is a plain move when nothing is pinned', () => {
    expect(moveAround(list, new Set(), 0, 3)).toEqual(['b', 'c', 'd', 'a', 'e'])
    expect(moveAround(list, new Set(), 4, 1)).toEqual(['a', 'e', 'b', 'c', 'd'])
  })

  it('keeps pinned slots in place while the rest shuffle past them', () => {
    expect(moveAround(list, new Set([1, 3]), 0, 4)).toEqual(['c', 'b', 'e', 'd', 'a'])
    expect(moveAround(list, new Set([2]), 3, 0)).toEqual(['d', 'a', 'c', 'b', 'e'])
  })

  it('ignores moves from or to a pinned slot', () => {
    expect(moveAround(list, new Set([1]), 1, 3)).toBe(list)
    expect(moveAround(list, new Set([1]), 3, 1)).toBe(list)
    expect(moveAround(list, new Set(), 2, 2)).toBe(list)
  })
})

describe('freeSlot', () => {
  it('skips pinned slots', () => {
    expect(freeSlot(5, new Set([1, 2]), 0, 1)).toBe(3)
    expect(freeSlot(5, new Set([1, 2]), 3, -1)).toBe(0)
    expect(freeSlot(5, new Set(), 2, 1)).toBe(3)
  })

  it('returns -1 when there is nowhere to go', () => {
    expect(freeSlot(5, new Set(), 0, -1)).toBe(-1)
    expect(freeSlot(5, new Set([3, 4]), 2, 1)).toBe(-1)
  })
})
