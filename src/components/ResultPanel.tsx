import { useEffect, useState } from 'react'
import type { Mark } from '../lib/score'
import { shareText } from '../lib/share'
import { dayNumber } from '../lib/daily'
import type { Puzzle } from '../lib/types'
import { MAX_ATTEMPTS } from './Game'

const HEADLINES = ['Clean sweep!', 'Straight drive!', 'Well played!', 'Just made it!', 'Last-ball finish!']

type Props = { puzzle: Puzzle; attempts: Mark[][]; solved: boolean; day?: number; onNext?: () => void }

export function ResultPanel({ puzzle, attempts, solved, day, onNext }: Props) {
  const [copied, setCopied] = useState(false)
  const daily = day !== undefined

  async function share() {
    const text = shareText('Lineup Lounge', day ?? 0, attempts, solved, MAX_ATTEMPTS, daily ? undefined : puzzle.prompt)
    try {
      if (navigator.share && matchMedia('(pointer: coarse)').matches) await navigator.share({ text })
      else await navigator.clipboard.writeText(text)
      setCopied(true)
    } catch {
      /* share sheet dismissed */
    }
  }

  return (
    <div className="mt-6 animate-rise overflow-hidden rounded-3xl border border-line bg-surface shadow-[var(--shadow)]" style={{ animationDelay: '500ms' }}>
      <div className={`px-5 pt-5 pb-4 ${solved ? 'bg-correct/10' : 'bg-leather/8'}`}>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">
          {solved ? `Solved in ${attempts.length} of ${MAX_ATTEMPTS}` : 'Out of attempts'}
        </p>
        <p className="mt-1 font-display text-3xl font-extrabold uppercase">
          {solved ? HEADLINES[attempts.length - 1] : 'Bowled out'}
        </p>
        <div className="mt-3 flex gap-1" aria-hidden>
          {attempts.map((a, i) => (
            <div key={i} className="flex flex-col gap-0.5">
              {a.map((m, j) => (
                <span
                  key={j}
                  className={`h-2 w-5 rounded-sm ${m === 'correct' ? 'bg-correct' : m === 'near' ? 'bg-near' : 'bg-muted/25'}`}
                />
              ))}
            </div>
          ))}
        </div>
      </div>
      <div className="flex gap-2 p-4">
        <button
          onClick={share}
          className="flex-1 rounded-xl bg-ink py-3 font-display text-lg font-bold uppercase tracking-wider text-bg transition active:scale-[0.99]"
        >
          {copied ? 'Copied' : 'Share'}
        </button>
        {onNext && (
          <button
            onClick={onNext}
            className="flex-1 rounded-xl bg-pitch-deep py-3 font-display text-lg font-bold uppercase tracking-wider text-white transition hover:bg-pitch active:scale-[0.99]"
          >
            {daily ? 'Practice' : 'Next puzzle'}
          </button>
        )}
      </div>
      {daily && <Countdown day={day} />}
      {puzzle.source && (
        <p className="border-t border-line px-5 py-3 text-xs text-muted">
          Data:{' '}
          <a className="underline decoration-line underline-offset-2 hover:text-ink" href={puzzle.source.url} target="_blank" rel="noreferrer">
            {puzzle.source.name}
          </a>{' '}
          · {puzzle.source.license}
          {puzzle.asOf && ` · data as of ${formatDate(puzzle.asOf)}`}
        </p>
      )}
    </div>
  )
}

function formatDate(iso: string) {
  const d = new Date(`${iso}T00:00:00`)
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
}

function Countdown({ day }: { day: number }) {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(t)
  }, [])
  const next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1)
  const s = Math.max(0, Math.floor((next.getTime() - now.getTime()) / 1000))
  const hms = [Math.floor(s / 3600), Math.floor((s % 3600) / 60), s % 60].map((n) => String(n).padStart(2, '0')).join(':')
  if (dayNumber(now) !== day) {
    return (
      <div className="px-4 pb-4">
        <button
          onClick={() => location.reload()}
          className="w-full rounded-xl border border-pitch py-2.5 font-display text-lg font-bold uppercase tracking-wider text-pitch"
        >
          Today’s puzzle is ready
        </button>
      </div>
    )
  }
  return (
    <p className="px-5 pb-4 text-center text-sm text-muted">
      Next daily in <span className="font-display text-lg font-bold text-ink tabular-nums">{hms}</span>
    </p>
  )
}
