import { useEffect, useRef } from 'react'

type Props = {
  open: boolean
  onClose: () => void
  title: string
  tiles: [string, number][]
  distTitle: string
  /** One bar per row: [label, count]. */
  dist: [string, number][]
  note: string
}

export function StatsDialog({ open, onClose, title, tiles, distTitle, dist, note }: Props) {
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const d = ref.current
    if (!d) return
    if (open && !d.open) d.showModal()
    if (!open && d.open) d.close()
  }, [open])

  const maxDist = Math.max(1, ...dist.map(([, n]) => n))

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => e.target === ref.current && onClose()}
      className="m-auto w-[min(92vw,420px)] rounded-3xl border border-line bg-surface p-0 text-ink shadow-2xl backdrop:bg-black/50 backdrop:backdrop-blur-sm"
    >
      <div className="p-6">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-2xl font-extrabold uppercase tracking-wide">{title}</h2>
          <button onClick={onClose} aria-label="Close" className="grid h-8 w-8 place-items-center rounded-full text-muted hover:bg-ink/5 hover:text-ink">
            ✕
          </button>
        </div>
        <div className="mt-5 grid grid-cols-4 gap-2 text-center">
          {tiles.map(([k, v]) => (
            <div key={k} className="rounded-2xl bg-surface-2 py-3">
              <p className="font-display text-3xl font-bold tabular-nums">{v}</p>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted">{k}</p>
            </div>
          ))}
        </div>
        <h3 className="mt-6 mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-muted">{distTitle}</h3>
        <div className="space-y-1.5">
          {dist.map(([label, n]) => (
            <div key={label} className="flex items-center gap-2">
              <span className="w-3 font-display font-bold tabular-nums">{label}</span>
              <div className="h-6 flex-1 rounded-md bg-surface-2">
                <div
                  className="flex h-full min-w-7 items-center justify-end rounded-md bg-pitch px-2 text-xs font-bold text-white tabular-nums"
                  style={{ width: `${(100 * n) / maxDist}%` }}
                >
                  {n}
                </div>
              </div>
            </div>
          ))}
        </div>
        <p className="mt-6 text-xs leading-relaxed text-muted">
          {note} Data from{' '}
          <a className="underline" href="https://cricsheet.org/" target="_blank" rel="noreferrer">Cricsheet</a> (ODC-By) and{' '}
          <a className="underline" href="https://en.wikipedia.org/" target="_blank" rel="noreferrer">Wikipedia</a> (CC BY-SA).
        </p>
      </div>
    </dialog>
  )
}
