import type { Mark } from '../lib/score'

/** Colour plus a symbol, so marks read without relying on red/green alone. */
const STYLE: Record<Mark, { cls: string; symbol: string }> = {
  correct: { cls: 'bg-correct text-white', symbol: '✓' },
  near: { cls: 'bg-near text-[#3a2600]', symbol: '↕' },
  wrong: { cls: 'bg-wrong text-white', symbol: '✕' },
}

export function MarkIcon({ mark, size = 22 }: { mark: Mark; size?: number }) {
  const s = STYLE[mark]
  return (
    <span
      aria-hidden
      className={`grid shrink-0 place-items-center rounded-full font-bold leading-none ${s.cls}`}
      style={{ width: size, height: size, fontSize: size * 0.55 }}
    >
      {s.symbol}
    </span>
  )
}
