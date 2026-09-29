import { teamStyle } from '../lib/teams'

export function TeamBadge({ team, label, size = 40 }: { team?: string; label: string; size?: number }) {
  const s = teamStyle(team, label)
  return (
    <span
      aria-hidden
      className="grid shrink-0 place-items-center rounded-full font-display font-bold tracking-wide shadow-[inset_0_-2px_0_rgb(0_0_0/0.18)]"
      style={{
        width: size,
        height: size,
        background: s.bg,
        color: s.fg,
        fontSize: s.code.length > 3 ? size * 0.3 : size * 0.36,
      }}
    >
      {s.code}
    </span>
  )
}
