import { useMemo, useState } from 'react'
import { Game } from './Game'
import { loadPref, savePref } from '../lib/storage'
import { FORMATS, type Format, type Puzzle } from '../lib/types'

type Round = 'daily' | 'practice'

type Props = {
  puzzles: Puzzle[]
  daily: Puzzle
  day: number
  dateLabel: string
  onFinishDaily: (solved: boolean, attempts: number) => void
}

/** The ranking game: one daily puzzle plus unlimited practice filtered by format. */
export function LineupMode({ puzzles, daily, day, dateLabel, onFinishDaily }: Props) {
  const [round, setRound] = useState<Round>('daily')
  const [filter, setFilter] = useState<Format | 'All'>(() => loadPref('filter', 'All'))
  const [practice, setPractice] = useState<{ puzzle: Puzzle; round: number; done: boolean } | null>(null)
  const [seen] = useState(() => new Set<string>([daily.id]))

  const pool = useMemo(
    () => puzzles.filter((p) => p.id !== daily.id && (filter === 'All' || p.format === filter)),
    [puzzles, filter, daily.id],
  )
  const counts = useMemo(() => {
    const c = new Map<string, number>()
    for (const p of puzzles) if (p.format) c.set(p.format, (c.get(p.format) ?? 0) + 1)
    return c
  }, [puzzles])

  function nextPractice(f = filter) {
    const candidates = puzzles.filter((p) => p.id !== daily.id && (f === 'All' || p.format === f))
    let fresh = candidates.filter((p) => !seen.has(p.id))
    if (!fresh.length) {
      candidates.forEach((p) => seen.delete(p.id))
      fresh = candidates
    }
    const puzzle = pickRandom(fresh)
    seen.add(puzzle.id)
    setPractice((prev) => ({ puzzle, round: (prev?.round ?? 0) + 1, done: false }))
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function goPractice() {
    setRound('practice')
    if (!practice) nextPractice()
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function pickFilter(f: Format | 'All') {
    setFilter(f)
    savePref('filter', f)
    nextPractice(f)
  }

  return (
    <>
      <div>
        {round === 'daily' ? (
          <>
            <p className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-muted">{dateLabel}</p>
            <Game
              key={`daily:${day}:${daily.id}`}
              puzzle={daily}
              storageKey={`cricket:${day}:${daily.id}`}
              day={day}
              onFinish={onFinishDaily}
              onNext={goPractice}
            />
          </>
        ) : (
          <>
            <button
              onClick={() => setRound('daily')}
              className="mb-4 text-sm font-semibold text-muted underline-offset-4 hover:text-ink hover:underline"
            >
              ← Back to daily #{day + 1}
            </button>
            <div className="-mx-4 mb-5 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none]">
              {(['All', ...FORMATS] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => pickFilter(f)}
                  aria-pressed={filter === f}
                  className={`shrink-0 rounded-full border px-3.5 py-1.5 text-sm font-semibold transition ${
                    filter === f ? 'border-ink bg-ink text-bg' : 'border-line bg-surface text-muted hover:text-ink'
                  }`}
                >
                  {f}
                  {f !== 'All' && <span className="ml-1.5 text-xs opacity-60">{counts.get(f) ?? 0}</span>}
                </button>
              ))}
            </div>
            {practice && (
              <Game
                key={`practice:${practice.round}`}
                puzzle={practice.puzzle}
                onFinish={() => setPractice((p) => p && { ...p, done: true })}
                onNext={() => nextPractice()}
              />
            )}
            {!practice?.done && (
              <button
                onClick={() => nextPractice()}
                className="mt-4 w-full py-2 text-sm font-semibold text-muted underline-offset-4 hover:text-ink hover:underline"
              >
                Skip this one · {pool.length} puzzles in {filter === 'All' ? 'all formats' : filter}
              </button>
            )}
          </>
        )}
      </div>
    </>
  )
}

function pickRandom<T>(items: T[]): T {
  return items[Math.floor(Math.random() * items.length)]
}
