import { useEffect, useMemo, useState } from 'react'
import { Game } from './components/Game'
import { StatsDialog } from './components/StatsDialog'
import { dayNumber, puzzleIndex } from './lib/daily'
import { loadPuzzles } from './lib/puzzles'
import { liveStreak, loadPref, loadStats, recordResult, savePref } from './lib/storage'
import { FORMATS, type Format, type Puzzle } from './lib/types'

type Mode = 'daily' | 'practice'
type Theme = 'system' | 'light' | 'dark'

export default function App() {
  const [puzzles, setPuzzles] = useState<Puzzle[] | null>(null)
  const [failed, setFailed] = useState(false)
  useEffect(() => {
    loadPuzzles().then(setPuzzles, () => setFailed(true))
  }, [])
  if (puzzles) return <Lounge puzzles={puzzles} />
  return (
    <div className="grid min-h-dvh place-items-center px-4 text-center" role="status">
      {failed ? (
        <p className="text-muted">
          Couldn’t load today’s puzzles.{' '}
          <button className="font-semibold text-ink underline" onClick={() => location.reload()}>
            Try again
          </button>
        </p>
      ) : (
        <div className="animate-pulse">
          <Ball />
          <span className="sr-only">Loading puzzles</span>
        </div>
      )}
    </div>
  )
}

function Lounge({ puzzles }: { puzzles: Puzzle[] }) {
  // Fixed at load so a tab left open past midnight doesn't swap the puzzle mid-game.
  const [today] = useState(() => new Date())
  const day = dayNumber(today)
  const daily = puzzles[puzzleIndex(puzzles.length, today)]
  const [mode, setMode] = useState<Mode>('daily')
  const [stats, setStats] = useState(loadStats)
  const [statsOpen, setStatsOpen] = useState(false)
  const [theme, setTheme] = useState<Theme>(() => loadPref('theme', 'system'))
  const [filter, setFilter] = useState<Format | 'All'>(() => loadPref('filter', 'All'))
  const [practice, setPractice] = useState<{ puzzle: Puzzle; round: number } | null>(null)
  const [seen] = useState(() => new Set<string>([daily.id]))

  useEffect(() => {
    if (theme === 'system') delete document.documentElement.dataset.theme
    else document.documentElement.dataset.theme = theme
    savePref('theme', theme)
  }, [theme])

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
    setPractice((prev) => ({ puzzle, round: (prev?.round ?? 0) + 1 }))
  }

  function goPractice() {
    setMode('practice')
    if (!practice) nextPractice()
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function pickFilter(f: Format | 'All') {
    setFilter(f)
    savePref('filter', f)
    nextPractice(f)
  }

  const streak = liveStreak(stats, day)
  const dateLabel = today.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' })

  return (
    <div className="mx-auto flex min-h-dvh max-w-[560px] flex-col px-4 pt-[max(env(safe-area-inset-top),16px)] pb-10">
      <header className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <Ball />
          <div>
            <h1 className="whitespace-nowrap font-display text-[22px] font-extrabold uppercase leading-none tracking-wide sm:text-[26px]">Lineup Lounge</h1>
            <p className="mt-0.5 whitespace-nowrap text-[10px] font-semibold uppercase tracking-[0.2em] text-muted sm:text-[11px]">Daily cricket rankings</p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <span
            title="Current streak"
            className="flex h-8 items-center gap-1 rounded-full border border-line bg-surface px-2.5 font-display text-lg font-bold tabular-nums sm:h-9"
          >
            <span aria-hidden>🔥</span>
            <span className="sr-only">Streak </span>
            {streak}
          </span>
          <IconButton label="Stats" onClick={() => setStatsOpen(true)}>
            <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />
          </IconButton>
          <IconButton
            label={`Theme: ${theme}`}
            onClick={() => setTheme(theme === 'system' ? 'dark' : theme === 'dark' ? 'light' : 'system')}
          >
            {theme === 'dark' ? (
              <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
            ) : theme === 'light' ? (
              <>
                <circle cx="12" cy="12" r="4" />
                <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
              </>
            ) : (
              <>
                <circle cx="12" cy="12" r="9" />
                <path d="M12 3v18" />
                <path d="M12 3a9 9 0 0 1 0 18z" fill="currentColor" />
              </>
            )}
          </IconButton>
        </div>
      </header>

      <nav className="mt-5 grid grid-cols-2 rounded-2xl border border-line bg-surface-2 p-1" aria-label="Mode">
        {(['daily', 'practice'] as Mode[]).map((m) => (
          <button
            key={m}
            onClick={() => (m === 'practice' ? goPractice() : setMode('daily'))}
            aria-pressed={mode === m}
            className={`rounded-xl py-2 font-display text-base font-bold uppercase tracking-wider transition ${
              mode === m ? 'bg-surface text-ink shadow-[var(--shadow)]' : 'text-muted hover:text-ink'
            }`}
          >
            {m === 'daily' ? `Daily #${day + 1}` : 'Practice'}
          </button>
        ))}
      </nav>

      <main className="mt-6 flex-1">
        {mode === 'daily' ? (
          <>
            <p className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-muted">{dateLabel}</p>
            <Game
              key={`daily:${day}:${daily.id}`}
              puzzle={daily}
              storageKey={`cricket:${day}:${daily.id}`}
              day={day}
              onFinish={(solved, n) => setStats(recordResult(day, solved, n))}
              onNext={goPractice}
            />
          </>
        ) : (
          <>
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
                  {f !== 'All' && (
                    <span className="ml-1.5 text-xs opacity-60">{counts.get(f) ?? 0}</span>
                  )}
                </button>
              ))}
            </div>
            {practice && (
              <Game key={`practice:${practice.round}`} puzzle={practice.puzzle} onNext={() => nextPractice()} />
            )}
            <button
              onClick={() => nextPractice()}
              className="mt-4 w-full py-2 text-sm font-semibold text-muted underline-offset-4 hover:text-ink hover:underline"
            >
              Skip this one · {pool.length} puzzles in {filter === 'All' ? 'all formats' : filter}
            </button>
          </>
        )}
      </main>

      <footer className="mt-10 text-center text-xs text-muted">
        Stats from{' '}
        <a className="underline underline-offset-2" href="https://cricsheet.org/" target="_blank" rel="noreferrer">
          Cricsheet
        </a>{' '}
        &{' '}
        <a className="underline underline-offset-2" href="https://en.wikipedia.org/" target="_blank" rel="noreferrer">
          Wikipedia
        </a>
      </footer>

      <StatsDialog open={statsOpen} onClose={() => setStatsOpen(false)} stats={stats} streak={streak} />
    </div>
  )
}

function pickRandom<T>(items: T[]): T {
  return items[Math.floor(Math.random() * items.length)]
}

function IconButton({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      title={label}
      className="grid h-8 w-8 place-items-center rounded-full border border-line bg-surface text-muted transition hover:text-ink sm:h-9 sm:w-9"
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        {children}
      </svg>
    </button>
  )
}

function Ball() {
  return (
    <svg viewBox="0 0 64 64" aria-hidden className="h-8 w-8 shrink-0 drop-shadow-sm sm:h-[38px] sm:w-[38px]">
      <circle cx="32" cy="32" r="28" fill="#b3202a" />
      <circle cx="24" cy="22" r="10" fill="#fff" opacity="0.12" />
      <path d="M14 13c9 9 9 29 0 38M50 13c-9 9-9 29 0 38" fill="none" stroke="#f6efe2" strokeWidth="2.5" strokeDasharray="3 3" strokeLinecap="round" />
    </svg>
  )
}
