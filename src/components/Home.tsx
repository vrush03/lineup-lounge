export type ModeCard = {
  href: string
  name: string
  tagline: string
  /** Today's daily: not started, or finished with a short result like "Solved in 3". */
  status: string | null
  streak: number
  icon: React.ReactNode
}

/** The catalogue of game modes. */
export function Home({ modes }: { modes: ModeCard[] }) {
  return (
    <div className="animate-rise">
      <h2 className="mb-4 text-xs font-semibold uppercase tracking-[0.18em] text-muted">Pick a game</h2>
      <ul className="space-y-3">
        {modes.map((m) => (
          <li key={m.href}>
            <a
              href={m.href}
              className="group flex items-center gap-4 rounded-3xl border border-line bg-surface p-4 shadow-[var(--shadow)] transition hover:border-pitch/50 active:scale-[0.99]"
            >
              <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-pitch-deep text-white">{m.icon}</span>
              <span className="min-w-0 flex-1">
                <span className="block font-display text-2xl font-extrabold uppercase leading-none tracking-wide">{m.name}</span>
                <span className="mt-1 block text-sm text-muted">{m.tagline}</span>
                <span className="mt-2 flex flex-wrap items-center gap-2 text-xs font-semibold">
                  <span
                    className={`rounded-full px-2 py-0.5 ${m.status ? 'bg-correct/15 text-correct-ink' : 'bg-near/20 text-ink'}`}
                  >
                    {m.status ? `Today: ${m.status}` : 'Today’s daily is ready'}
                  </span>
                  {m.streak > 0 && (
                    <span className="text-muted">
                      <span aria-hidden>🔥</span> {m.streak} day streak
                    </span>
                  )}
                </span>
              </span>
              <span aria-hidden className="text-2xl text-muted transition group-hover:translate-x-0.5 group-hover:text-ink">
                →
              </span>
            </a>
          </li>
        ))}
      </ul>
    </div>
  )
}
