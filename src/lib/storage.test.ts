import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ballparkLiveStreak, loadBallpark, loadBallparkStats, recordBallpark, saveBallpark } from './storage'

beforeEach(() => {
  const store = new Map<string, string>()
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => store.set(k, v),
    removeItem: (k: string) => store.delete(k),
  })
})

describe('ballpark stats', () => {
  it('records a day once, with streak, best, total and the points bucket', () => {
    recordBallpark(10, 187)
    expect(recordBallpark(10, 300).totalPoints).toBe(187)
    recordBallpark(11, 300)
    const s = loadBallparkStats()
    expect(s).toMatchObject({ played: 2, streak: 2, maxStreak: 2, lastPlayedDay: 11, lastPoints: 300, bestPoints: 300, totalPoints: 487 })
    expect(s.pointsDist).toEqual([0, 1, 0, 1, 0])
  })
  it('keeps the counts from when a round was out of 300', () => {
    localStorage.setItem('stats:ballpark', JSON.stringify({ played: 3, pointsDist: [1, 1, 1] }))
    expect(loadBallparkStats().pointsDist).toEqual([1, 1, 1, 0, 0])
  })
  it('restarts the streak after a missed day and drops it from the header once it lapses', () => {
    recordBallpark(1, 50)
    recordBallpark(2, 50)
    expect(recordBallpark(4, 50).streak).toBe(1)
    expect(ballparkLiveStreak(loadBallparkStats(), 5)).toBe(1)
    expect(ballparkLiveStreak(loadBallparkStats(), 6)).toBe(0)
  })
  it('discards stored stats and saves of the wrong shape', () => {
    localStorage.setItem('stats:ballpark', JSON.stringify({ played: 'lots', pointsDist: [1] }))
    expect(loadBallparkStats()).toMatchObject({ played: 0, pointsDist: [0, 0, 0, 0, 0] })
    localStorage.setItem('ballpark:cricket:3', JSON.stringify({ ids: ['a'], guesses: [[1]] }))
    expect(loadBallpark('cricket:3')).toBeNull()
    saveBallpark('cricket:3', { ids: ['a'], guesses: [['250']] })
    expect(loadBallpark('cricket:3')).toEqual({ ids: ['a'], guesses: [['250']] })
  })
})
