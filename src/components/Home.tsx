export type ModeCard = {
  href: string
  name: string
  tagline: string
  /** Today's daily: not started, or finished with a short result like "Solved in 3". */
  status: string | null
  /** Replaces the daily wording for a mode with no daily round, e.g. "Won 7 of 12". */
  pill?: string
  streak: number
  /** What the streak counts; "day streak" unless set. */
  streakLabel?: string
  icon: React.ReactNode
}

/** The catalogue of game modes. */
export function Home({ modes }: { modes: ModeCard[] }) {
  return (
    <div className="animate-rise">
      <h2 className="mb-4 text-xs font-semibold uppercase tracking-[0.18em] text-muted">Pick a game</h2>
      <ul className="grid grid-cols-2 gap-3">
        {modes.map((m) => (
          <li key={m.href} className="flex">
            <a
              href={m.href}
              className="group flex w-full flex-col gap-3 rounded-3xl border border-line bg-surface p-4 shadow-[var(--shadow)] transition hover:border-pitch/50 active:scale-[0.99]"
            >
              <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-pitch-deep text-white">{m.icon}</span>
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="block font-display text-2xl font-extrabold uppercase leading-none tracking-wide">{m.name}</span>
                <span className="mt-1 block text-sm text-muted">{m.tagline}</span>
                <span className="mt-auto flex flex-wrap items-center gap-x-2 gap-y-1 pt-3 text-xs font-semibold">
                  <span
                    className={`rounded-full px-2 py-0.5 ${m.status ? 'bg-correct/15 text-correct-ink' : 'bg-near/20 text-ink'}`}
                  >
                    {m.pill ?? (m.status ? `Today: ${m.status}` : 'Today’s daily is ready')}
                  </span>
                  {m.streak > 0 && (
                    <span className="text-muted">
                      <span aria-hidden>🔥</span> {m.streak} {m.streakLabel ?? 'day streak'}
                    </span>
                  )}
                </span>
              </span>
            </a>
          </li>
        ))}
      </ul>
    </div>
  )
}
