export type ModeCard = {
  href: string
  name: string
  tagline: string
  /** Today's daily: not started, or finished with a short result like "Solved in 3". */
  status: string | null
  /** A mode with no daily round: shown as "Any time" instead of "Daily". */
  anytime?: boolean
  /** A short record shown on the tile, e.g. "Won 7 of 12". */
  pill?: string
  streak: number
  /** What the streak counts; "day streak" unless set. */
  streakLabel?: string
  icon: React.ReactNode
}

/** The catalogue of game modes: one tile per mode with a badge, a big icon and a Play button. */
export function Home({ modes }: { modes: ModeCard[] }) {
  return (
    <div className="animate-rise">
      <h2 className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-muted">Pick a game</h2>
      <ul className="grid grid-cols-2 gap-3">
        {modes.map((m) => {
          const done = !m.anytime && m.status !== null
          const badge = m.anytime ? 'Any time' : done ? m.status : 'Daily'
          const note = m.pill ?? (m.streak > 0 ? `🔥 ${m.streak} ${m.streakLabel ?? 'day streak'}` : null)
          return (
            <li key={m.href} className="flex">
              <a
                href={m.href}
                className="group flex w-full flex-col rounded-3xl border border-line bg-surface p-4 shadow-[var(--shadow)] transition hover:border-pitch/50 active:scale-[0.99]"
              >
                <span className="relative grid h-24 place-items-center">
                  <span
                    className={`absolute right-0 top-0 rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.14em] ${
                      done ? 'border-correct/40 bg-correct/15 text-correct-ink' : 'border-line text-muted'
                    }`}
                  >
                    {badge}
                  </span>
                  <span className="grid h-16 w-16 place-items-center rounded-2xl bg-pitch-deep text-white [&>svg]:h-9 [&>svg]:w-9">
                    {m.icon}
                  </span>
                </span>
                <span className="mt-2 block font-display text-2xl font-extrabold uppercase leading-none tracking-wide">{m.name}</span>
                <span className="mt-1 block text-sm text-muted">{m.tagline}</span>
                <span className="mt-auto flex items-center justify-between gap-2 pt-4">
                  <span className="min-w-0 truncate text-xs font-semibold text-muted">{note}</span>
                  <span className="shrink-0 rounded-full bg-pitch px-3.5 py-1.5 text-sm font-bold text-white transition group-hover:bg-pitch-deep">
                    Play <span aria-hidden>→</span>
                  </span>
                </span>
              </a>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
