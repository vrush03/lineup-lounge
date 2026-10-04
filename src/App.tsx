import { Analytics } from '@vercel/analytics/react'
import { useEffect, useState } from 'react'
import { BallparkMode } from './components/BallparkMode'
import { Home, type ModeCard } from './components/Home'
import { LineupMode } from './components/LineupMode'
import { ShowdownMode } from './components/ShowdownMode'
import { StatsDialog } from './components/StatsDialog'
import { WhoAmIMode } from './components/WhoAmIMode'
import { BALLPARK_LENGTH, MAX_POINTS } from './lib/ballpark'
import { dayNumber, puzzleIndex } from './lib/daily'
import { loadPuzzles } from './lib/puzzles'
import { ROUNDS } from './lib/showdown'
import {
  ballparkLiveStreak,
  liveStreak,
  loadBallparkStats,
  loadPref,
  loadShowdownStats,
  loadStats,
  loadWhoAmIStats,
  recordBallpark,
  recordResult,
  recordShowdown,
  recordWhoAmI,
  savePref,
} from './lib/storage'
import { SHOWDOWN_FORMATS, type Puzzle } from './lib/types'
import { MAX_GUESSES } from './lib/whoami'

type Theme = 'system' | 'light' | 'dark'

/** Buy Me a Coffee page for tips; the footer button is hidden while this is empty. */
const TIP_URL = 'https://buymeacoffee.com/lineuplounge'

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

type Route = 'home' | 'lineup' | 'ballpark' | 'showdown' | 'whoami'

const TITLE: Record<Route, string> = { home: 'Daily cricket games', lineup: 'Lineup', ballpark: 'Ballpark', showdown: 'Showdown', whoami: 'Who Am I?' }

function routeFromHash(): Route {
  const h = location.hash.slice(1)
  return h === 'lineup' || h === 'ballpark' || h === 'showdown' || h === 'whoami' ? h : 'home'
}

/** Hash routes (#lineup, #ballpark, #showdown, #whoami) so the browser back button returns to the mode list. */
function useRoute(): Route {
  const [route, setRoute] = useState(routeFromHash)
  useEffect(() => {
    const onChange = () => {
      setRoute(routeFromHash())
      window.scrollTo({ top: 0 })
    }
    window.addEventListener('hashchange', onChange)
    return () => window.removeEventListener('hashchange', onChange)
  }, [])
  return route
}

function Lounge({ puzzles }: { puzzles: Puzzle[] }) {
  // Fixed at load so a tab left open past midnight doesn't swap the puzzle mid-game.
  const [today] = useState(() => new Date())
  const day = dayNumber(today)
  const daily = puzzles[puzzleIndex(puzzles.length, today)]
  const route = useRoute()
  const page = route === 'home' ? '/' : `/${route}`
  const [stats, setStats] = useState(loadStats)
  const [ballparkStats, setBallparkStats] = useState(loadBallparkStats)
  const [showdownStats, setShowdownStats] = useState(loadShowdownStats)
  const [whoamiStats, setWhoamiStats] = useState(loadWhoAmIStats)
  const [statsOpen, setStatsOpen] = useState(false)
  const [theme, setTheme] = useState<Theme>(() => loadPref('theme', 'system'))

  useEffect(() => {
    if (theme === 'system') delete document.documentElement.dataset.theme
    else document.documentElement.dataset.theme = theme
    savePref('theme', theme)
  }, [theme])

  const lineupStreak = liveStreak(stats, day)
  const ballparkStreak = ballparkLiveStreak(ballparkStats, day)
  const whoamiStreak = liveStreak(whoamiStats, day)
  const streak =
    route === 'ballpark' ? ballparkStreak : route === 'showdown' ? showdownStats.streak : route === 'whoami' ? whoamiStreak : lineupStreak
  const dateLabel = today.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' })

  const modes: ModeCard[] = [
    {
      href: '#lineup',
      name: 'Lineup',
      tagline: 'Rank five cricket picks in order.',
      status: stats.lastPlayedDay === day ? (stats.lastWonDay === day ? 'solved' : 'bowled out') : null,
      streak: lineupStreak,
      icon: <LineupIcon />,
    },
    {
      href: '#ballpark',
      name: 'Ballpark',
      tagline: 'Estimate five cricket numbers.',
      status:
        ballparkStats.lastPlayedDay === day && ballparkStats.lastPoints !== null
          ? `${ballparkStats.lastPoints}/${BALLPARK_LENGTH * MAX_POINTS}`
          : null,
      streak: ballparkStreak,
      icon: <BallparkIcon />,
    },
    {
      href: '#showdown',
      name: 'Showdown',
      tagline: `Stat cards vs the computer, ${ROUNDS} rounds.`,
      status: null,
      anytime: true,
      pill: showdownStats.played ? `Won ${showdownStats.won} of ${showdownStats.played}` : undefined,
      streak: showdownStats.streak,
      streakLabel: 'win streak',
      icon: <ShowdownIcon />,
    },
    {
      href: '#whoami',
      name: 'Who Am I?',
      tagline: `Name the player from a stat card in ${MAX_GUESSES} guesses.`,
      status: whoamiStats.lastPlayedDay === day ? (whoamiStats.lastWonDay === day ? 'solved' : 'bowled') : null,
      streak: whoamiStreak,
      icon: <WhoAmIIcon />,
    },
  ]

  return (
    <div className="mx-auto flex min-h-dvh max-w-[560px] flex-col px-4 pt-[max(env(safe-area-inset-top),16px)] pb-10">
      <header className="flex items-center justify-between gap-3">
        <a href="#" className="flex min-w-0 items-center gap-2" aria-label="Lineup Lounge: all games">
          <Ball />
          <div>
            <h1 className="whitespace-nowrap font-display text-[22px] font-extrabold uppercase leading-none tracking-wide sm:text-[26px]">Lineup Lounge</h1>
            <p className="mt-0.5 whitespace-nowrap text-[10px] font-semibold uppercase tracking-[0.2em] text-muted sm:text-[11px]">
              {TITLE[route]}
            </p>
          </div>
        </a>
        <div className="flex shrink-0 items-center gap-1">
          {route !== 'home' && (
            <>
              <span
                title={route === 'showdown' ? 'Wins in a row' : 'Current streak'}
                className="flex h-8 items-center gap-1 rounded-full border border-line bg-surface px-2.5 font-display text-lg font-bold tabular-nums sm:h-9"
              >
                <span aria-hidden>🔥</span>
                <span className="sr-only">Streak </span>
                {streak}
              </span>
              <IconButton label="Stats" onClick={() => setStatsOpen(true)}>
                <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />
              </IconButton>
            </>
          )}
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

      <main className="mt-5 flex-1">
        {route !== 'home' && (
          <a href="#" className="mb-4 inline-flex items-center gap-1 text-sm font-semibold text-muted hover:text-ink">
            <span aria-hidden>←</span> All games
          </a>
        )}
        {route === 'home' ? (
          <Home modes={modes} />
        ) : route === 'lineup' ? (
          <LineupMode
            puzzles={puzzles}
            daily={daily}
            day={day}
            dateLabel={dateLabel}
            onFinishDaily={(solved, n) => setStats(recordResult(day, solved, n))}
          />
        ) : route === 'ballpark' ? (
          <BallparkMode day={day} dateLabel={dateLabel} onFinishDaily={(points) => setBallparkStats(recordBallpark(day, points))} />
        ) : route === 'showdown' ? (
          <ShowdownMode onFinish={(format, won) => setShowdownStats(recordShowdown(format, won))} />
        ) : (
          <WhoAmIMode day={day} dateLabel={dateLabel} onFinishDaily={(solved, n) => setWhoamiStats(recordWhoAmI(day, solved, n))} />
        )}
      </main>

      <footer className="mt-10 text-center text-xs text-muted">
        {TIP_URL && (
          <div className="mb-4">
            <a
              href={TIP_URL}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 rounded-full bg-gold px-5 py-2.5 text-sm font-bold text-[#1b1406] shadow-lg shadow-gold/25 transition hover:-translate-y-0.5 hover:brightness-110 hover:shadow-gold/40"
            >
              <span aria-hidden className="text-base">☕</span> Buy me a coffee
            </a>
          </div>
        )}
        Stats from{' '}
        <a className="underline underline-offset-2" href="https://cricsheet.org/" target="_blank" rel="noreferrer">
          Cricsheet
        </a>{' '}
        &{' '}
        <a className="underline underline-offset-2" href="https://en.wikipedia.org/" target="_blank" rel="noreferrer">
          Wikipedia
        </a>
        <br />
        Team names and logos are trademarks of their respective owners, and player photos belong to theirs. Unofficial fan game.
      </footer>

      {/* Hash routes don't change the path, so report each game as its own page. */}
      <Analytics route={page} path={page} />

      {route === 'ballpark' ? (
        <StatsDialog
          open={statsOpen}
          onClose={() => setStatsOpen(false)}
          title="Ballpark stats"
          tiles={[
            ['Played', ballparkStats.played],
            ['Avg', ballparkStats.played ? Math.round(ballparkStats.totalPoints / ballparkStats.played) : 0],
            ['Streak', ballparkStreak],
            ['Best', ballparkStats.bestPoints],
          ]}
          distTitle="Daily points"
          dist={ballparkStats.pointsDist.map((n, i) => [`${i * 100}+`, n] as [string, number]).reverse()}
          note={`Each question scores up to 100 points by how many times off your guess is, so a daily round is out of ${BALLPARK_LENGTH * MAX_POINTS}. Daily rounds count towards your stats; practice rounds don’t.`}
        />
      ) : route === 'showdown' ? (
        <StatsDialog
          open={statsOpen}
          onClose={() => setStatsOpen(false)}
          title="Showdown stats"
          tiles={[
            ['Played', showdownStats.played],
            ['Win %', showdownStats.played ? Math.round((100 * showdownStats.won) / showdownStats.played) : 0],
            ['Streak', showdownStats.streak],
            ['Best', showdownStats.maxStreak],
          ]}
          distTitle="Wins by format"
          dist={SHOWDOWN_FORMATS.map((f) => [f, showdownStats.wins[f] ?? 0] as [string, number])}
          note={`A game counts once all ${ROUNDS} rounds are played. The streak is games won in a row; a draw ends it.`}
        />
      ) : route === 'whoami' ? (
        <StatsDialog
          open={statsOpen}
          onClose={() => setStatsOpen(false)}
          title="Who Am I? stats"
          tiles={[
            ['Played', whoamiStats.played],
            ['Win %', whoamiStats.played ? Math.round((100 * whoamiStats.won) / whoamiStats.played) : 0],
            ['Streak', whoamiStreak],
            ['Best', whoamiStats.maxStreak],
          ]}
          distTitle="Guesses to solve"
          dist={whoamiStats.dist.map((n, i) => [String(i + 1), n] as [string, number])}
          note="The streak is daily players named in a row. Daily rounds count towards your stats; practice rounds don’t."
        />
      ) : (
        <StatsDialog
          open={statsOpen}
          onClose={() => setStatsOpen(false)}
          title="Lineup stats"
          tiles={[
            ['Played', stats.played],
            ['Win %', stats.played ? Math.round((100 * stats.won) / stats.played) : 0],
            ['Streak', lineupStreak],
            ['Best', stats.maxStreak],
          ]}
          distTitle="Attempts to solve"
          dist={stats.dist.map((n, i) => [String(i + 1), n] as [string, number])}
          note="Daily puzzles count towards your stats; practice rounds don’t."
        />
      )}
    </div>
  )
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

function LineupIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
      <path d="M9 6h11M9 12h11M9 18h11" />
      <path d="M4 5v2M3.5 11h1.5l-1.5 2h1.5M3.5 17h1.5v2h-1.5" strokeWidth="1.5" />
    </svg>
  )
}

function BallparkIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M3 18h18" />
      <path d="M5 18v-3M9 18v-6M13 18V9M17 18V5" />
    </svg>
  )
}

function ShowdownIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="3.5" y="5" width="10" height="14" rx="2" transform="rotate(-10 8.5 12)" />
      <rect x="10.5" y="5" width="10" height="14" rx="2" transform="rotate(10 15.5 12)" fill="currentColor" fillOpacity="0.18" />
    </svg>
  )
}

function WhoAmIIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="5" y="3" width="14" height="18" rx="2.5" />
      <path d="M9.6 9.3a2.5 2.5 0 1 1 3.6 2.3c-.8.4-1.2 1-1.2 1.9" />
      <path d="M12 16.8v.1" />
    </svg>
  )
}
