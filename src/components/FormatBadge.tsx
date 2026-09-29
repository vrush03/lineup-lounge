import { FORMAT_STYLE } from '../lib/teams'
import type { Format } from '../lib/types'

export function FormatBadge({ format }: { format: Format }) {
  const s = FORMAT_STYLE[format]
  return (
    <span
      className="inline-flex items-center rounded-full px-2.5 py-1 font-display text-[13px] font-bold uppercase leading-none tracking-wider ring-1 ring-black/10"
      style={{ background: s.bg, color: s.fg }}
    >
      {s.label}
    </span>
  )
}
