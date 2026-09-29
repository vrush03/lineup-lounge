import { useEffect, useState } from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { Item } from '../lib/types'
import type { Mark } from '../lib/score'
import { TeamBadge } from './TeamBadge'

type Props = {
  item: Item
  rank: number
  mark?: Mark
  /** Bumped after each submit so marks re-animate. */
  pulse: number
  revealed: boolean
  revealDelay: number
  disabled: boolean
  canUp: boolean
  canDown: boolean
  onMove: (dir: -1 | 1) => void
}

const MARK_STYLE: Record<Mark, string> = {
  correct: 'border-correct/70 bg-correct/10 ring-1 ring-correct/40',
  near: 'border-near/70 bg-near/10 ring-1 ring-near/40',
  wrong: 'border-line bg-surface',
}
const MARK_LABEL: Record<Mark, string> = { correct: 'Correct position', near: 'One place off', wrong: 'Not close' }

export function Row({ item, rank, mark, pulse, revealed, revealDelay, disabled, canUp, canDown, onMove }: Props) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: item.label,
    disabled,
  })
  const tone = mark ? MARK_STYLE[mark] : 'border-line bg-surface'
  const anim = mark === 'correct' ? 'animate-pop' : mark === 'wrong' ? 'animate-shake' : ''
  // Before the reveal show who they played for (not for team rows, where it would just repeat the name).
  const meta = revealed ? item.note : item.team && !item.label.includes(item.team) ? item.team : undefined

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`relative flex items-stretch gap-2 ${isDragging ? 'z-20' : ''}`}
    >
      <span className="w-6 shrink-0 self-center text-center font-display text-2xl font-bold text-muted/70 tabular-nums">
        {rank}
      </span>
      <div
        key={pulse}
        className={`flex min-w-0 flex-1 items-center gap-3 rounded-2xl border px-3 py-2.5 transition-[background-color,border-color,box-shadow] duration-300 ${tone} ${anim} ${
          isDragging ? 'scale-[1.02] shadow-2xl ring-2 ring-pitch/50' : 'shadow-[var(--shadow)]'
        } ${disabled ? '' : 'cursor-grab touch-manipulation select-none [-webkit-touch-callout:none] active:cursor-grabbing'}`}
        style={revealed ? { animation: `rise 0.45s cubic-bezier(0.2,0.8,0.2,1) ${revealDelay}ms both` } : undefined}
        {...attributes}
        {...listeners}
        aria-roledescription="sortable item"
        aria-label={`${rank}. ${item.label}${mark ? `, ${MARK_LABEL[mark]}` : ''}`}
      >
        <TeamBadge team={item.team} label={item.label} />
        <div className="min-w-0 flex-1">
          <p className="line-clamp-2 text-[15px] font-semibold leading-tight [overflow-wrap:anywhere]">{item.label}</p>
          {meta && <p className="mt-0.5 truncate text-xs text-muted">{meta}</p>}
        </div>
        {revealed ? (
          <Value item={item} delay={revealDelay} />
        ) : mark ? (
          <MarkDot mark={mark} />
        ) : null}
        {!disabled && (
          <div
            className="-my-1 flex flex-col"
            onMouseDown={(e) => e.stopPropagation()}
            onTouchStart={(e) => e.stopPropagation()}
          >
            <MoveButton dir={-1} enabled={canUp} onMove={onMove} label={item.label} />
            <MoveButton dir={1} enabled={canDown} onMove={onMove} label={item.label} />
          </div>
        )}
      </div>
    </li>
  )
}

function MoveButton({ dir, enabled, onMove, label }: { dir: -1 | 1; enabled: boolean; onMove: (d: -1 | 1) => void; label: string }) {
  return (
    <button
      type="button"
      disabled={!enabled}
      onClick={() => onMove(dir)}
      onKeyDown={(e) => e.stopPropagation()}
      aria-label={`Move ${label} ${dir < 0 ? 'up' : 'down'}`}
      className="grid h-6 w-7 place-items-center rounded-md text-muted transition hover:bg-ink/5 hover:text-ink disabled:opacity-25 disabled:hover:bg-transparent"
    >
      <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden>
        <path
          d={dir < 0 ? 'M2.5 7.5 6 4l3.5 3.5' : 'M2.5 4.5 6 8l3.5-3.5'}
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </button>
  )
}

function MarkDot({ mark }: { mark: Mark }) {
  const cls = mark === 'correct' ? 'bg-correct' : mark === 'near' ? 'bg-near' : 'bg-transparent ring-2 ring-inset ring-muted/50'
  return <span aria-hidden className={`h-2.5 w-2.5 shrink-0 rounded-full ${cls}`} />
}

/** Revealed value; plain numbers count up, everything else ("10/53", "400*") fades in. */
function Value({ item, delay }: { item: Item; delay: number }) {
  const text = item.display ?? item.value.toLocaleString()
  // Years ("2007") show as-is; other plain numbers count up, keeping their own digit grouping.
  const numeric = /^[\d,]+(\.\d+)?$/.test(text) && !/^\d{4}$/.test(text)
  const grouped = text.includes(',')
  const target = numeric ? Number(text.replace(/,/g, '')) : 0
  const decimals = numeric ? (text.split('.')[1]?.length ?? 0) : 0
  const [animate] = useState(() => numeric && !matchMedia('(prefers-reduced-motion: reduce)').matches)
  const [shown, setShown] = useState(animate ? 0 : target)

  useEffect(() => {
    if (!animate) return
    let raf = 0
    const start = performance.now() + delay
    const dur = 700
    const tick = (now: number) => {
      const t = Math.min(1, Math.max(0, (now - start) / dur))
      setShown(target * (1 - Math.pow(1 - t, 3)))
      if (t < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    // Animation frames pause in background tabs; make sure the final value always lands.
    const done = setTimeout(() => setShown(target), delay + dur + 100)
    return () => {
      cancelAnimationFrame(raf)
      clearTimeout(done)
    }
  }, [animate, target, delay])

  const out = numeric
    ? shown.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals, useGrouping: grouped })
    : text
  return (
    <span className="shrink-0 text-right font-display text-2xl font-bold leading-none tabular-nums">
      <span aria-hidden>{out}</span>
      <span className="sr-only">{text}</span>
    </span>
  )
}
