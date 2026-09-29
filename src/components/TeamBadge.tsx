import { useState } from 'react'
import { teamStyle } from '../lib/teams'

export function TeamBadge({ team, label, size = 44 }: { team?: string; label: string; size?: number }) {
  const s = teamStyle(team, label)
  const [broken, setBroken] = useState(false)

  if (s.logo && !broken) {
    return (
      <span
        aria-hidden
        className="grid shrink-0 place-items-center rounded-full bg-white shadow-[inset_0_-2px_0_rgb(0_0_0/0.08)]"
        style={{ width: size, height: size, boxShadow: `0 0 0 2px ${s.bg}` }}
      >
        <img
          src={s.logo}
          alt=""
          loading="lazy"
          decoding="async"
          draggable={false}
          onError={() => setBroken(true)}
          className="object-contain"
          style={{ width: size * 0.8, height: size * 0.8 }}
        />
      </span>
    )
  }

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
