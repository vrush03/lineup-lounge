import { useEffect, useMemo, useState } from 'react'
import {
  DndContext,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import { restrictToVerticalAxis, restrictToParentElement } from '@dnd-kit/modifiers'
import { SortableContext, arrayMove, sortableKeyboardCoordinates, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { Row } from './Row'
import { ResultPanel } from './ResultPanel'
import { FormatBadge } from './FormatBadge'
import { isSolved, scoreGuess, solution, type Mark } from '../lib/score'
import { loadGame, saveGame } from '../lib/storage'
import type { Item, Puzzle } from '../lib/types'

export const MAX_ATTEMPTS = 5

type Props = {
  puzzle: Puzzle
  /** Persist progress under this key (daily); omit for practice rounds. */
  storageKey?: string
  day?: number
  onFinish?: (solved: boolean, attempts: number) => void
  onNext?: () => void
}

function initialOrder(puzzle: Puzzle, saved: string[] | undefined): Item[] {
  if (saved) {
    const byLabel = new Map(puzzle.items.map((i) => [i.label, i]))
    const restored = saved.map((l) => byLabel.get(l)).filter((i): i is Item => !!i)
    if (restored.length === puzzle.items.length) return restored
  }
  return [...puzzle.items]
}

function railLabels(p: Puzzle): [string, string] {
  if (p.unit === 'season') return ['Earliest', 'Latest']
  return p.direction === 'desc' ? ['Highest', 'Lowest'] : ['Lowest', 'Highest']
}

export function Game({ puzzle, storageKey, day, onFinish, onNext }: Props) {
  const saved = useMemo(() => (storageKey ? loadGame(storageKey) : null), [storageKey])
  const [order, setOrder] = useState(() => initialOrder(puzzle, saved?.labels))
  const [attempts, setAttempts] = useState<Mark[][]>(saved?.attempts ?? [])
  const [lastGuess, setLastGuess] = useState<string[]>(() => saved?.guess ?? [])

  const solved = attempts.length > 0 && isSolved(attempts[attempts.length - 1])
  const over = solved || attempts.length >= MAX_ATTEMPTS
  const answer = useMemo(() => solution(puzzle), [puzzle])
  const shown = over ? answer : order

  // Marks stick to the item they were given to, so they travel with it when dragged.
  const markByLabel = useMemo(() => {
    const m = new Map<string, Mark>()
    const last = attempts[attempts.length - 1]
    if (last) lastGuess.forEach((l, i) => m.set(l, last[i]))
    return m
  }, [attempts, lastGuess])

  useEffect(() => {
    if (storageKey) saveGame(storageKey, { labels: order.map((i) => i.label), attempts, guess: lastGuess })
  }, [storageKey, order, attempts, lastGuess])

  const sensors = useSensors(
    // Mouse drags immediately; touch needs a short press so a normal swipe still scrolls the page.
    useSensor(MouseSensor, { activationConstraint: { distance: 4 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  function onDragEnd({ active, over: target }: DragEndEvent) {
    if (!target || active.id === target.id) return
    setOrder((o) => arrayMove(o, o.findIndex((i) => i.label === active.id), o.findIndex((i) => i.label === target.id)))
  }

  function move(index: number, dir: -1 | 1) {
    setOrder((o) => arrayMove(o, index, index + dir))
  }

  function submit() {
    const marks = scoreGuess(puzzle, order)
    const next = [...attempts, marks]
    setLastGuess(order.map((i) => i.label))
    setAttempts(next)
    if (isSolved(marks) || next.length >= MAX_ATTEMPTS) onFinish?.(isSolved(marks), next.length)
  }

  const [top, bottom] = railLabels(puzzle)
  const unchanged = attempts.length > 0 && order.every((i, k) => i.label === lastGuess[k])

  return (
    <section aria-labelledby="prompt" className="animate-rise">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        {puzzle.format && <FormatBadge format={puzzle.format} />}
        {puzzle.difficulty && <Difficulty level={puzzle.difficulty} />}
      </div>
      <h2 id="prompt" className="font-display text-[28px] font-bold uppercase leading-[1.05] tracking-tight text-balance sm:text-[32px]">
        {puzzle.prompt}
      </h2>
      <div className="mt-3 mb-5 flex items-center justify-between gap-4">
        <p className="text-sm text-muted">
          {over ? 'Final order' : 'Press and drag, or use the arrows, to put them in order.'}
        </p>
        <AttemptPips attempts={attempts} />
      </div>

      <RailLabel text={top} up />
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={onDragEnd}
        modifiers={[restrictToVerticalAxis, restrictToParentElement]}
      >
        <SortableContext items={shown.map((i) => i.label)} strategy={verticalListSortingStrategy}>
          <ol className="my-2 space-y-2">
            {shown.map((item, i) => (
              <Row
                key={item.label}
                item={item}
                rank={i + 1}
                mark={over ? undefined : markByLabel.get(item.label)}
                pulse={attempts.length}
                revealed={over}
                revealDelay={i * 90}
                disabled={over}
                canUp={i > 0}
                canDown={i < shown.length - 1}
                onMove={(d) => move(i, d)}
              />
            ))}
          </ol>
        </SortableContext>
      </DndContext>
      <RailLabel text={bottom} />

      {!over ? (
        <div className="mt-5">
          <button
            onClick={submit}
            disabled={unchanged}
            className="w-full rounded-2xl bg-pitch-deep py-3.5 font-display text-xl font-bold uppercase tracking-wider text-white shadow-lg shadow-pitch-deep/25 transition hover:bg-pitch active:scale-[0.99] disabled:opacity-40"
          >
            {unchanged ? 'Change the order to try again' : `Lock it in · ${MAX_ATTEMPTS - attempts.length} left`}
          </button>
          <Legend />
        </div>
      ) : (
        <ResultPanel puzzle={puzzle} attempts={attempts} solved={solved} day={day} onNext={onNext} />
      )}
    </section>
  )
}

function RailLabel({ text, up }: { text: string; up?: boolean }) {
  return (
    <p className="flex items-center gap-2 pl-8 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">
      <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden className={up ? '' : 'rotate-180'}>
        <path d="M5 1.5 9 8H1z" fill="currentColor" />
      </svg>
      {text}
    </p>
  )
}

function AttemptPips({ attempts }: { attempts: Mark[][] }) {
  return (
    <div className="flex shrink-0 gap-1.5" aria-label={`${attempts.length} of ${MAX_ATTEMPTS} attempts used`}>
      {Array.from({ length: MAX_ATTEMPTS }, (_, k) => {
        const a = attempts[k]
        return (
          <span key={k} className="flex flex-col gap-[2px] rounded-[4px] p-[2px] ring-1 ring-line">
            {Array.from({ length: 5 }, (_, j) => (
              <span
                key={j}
                className={`h-[3px] w-3 rounded-full ${
                  !a ? 'bg-line/60' : a[j] === 'correct' ? 'bg-correct' : a[j] === 'near' ? 'bg-near' : 'bg-muted/30'
                }`}
              />
            ))}
          </span>
        )
      })}
    </div>
  )
}

function Difficulty({ level }: { level: 'easy' | 'medium' | 'hard' }) {
  const n = level === 'easy' ? 1 : level === 'medium' ? 2 : 3
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-line px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-muted">
      <span className="flex gap-0.5" aria-hidden>
        {[1, 2, 3].map((k) => (
          <span key={k} className={`h-1.5 w-1.5 rounded-full ${k <= n ? 'bg-leather' : 'bg-line'}`} />
        ))}
      </span>
      {level}
    </span>
  )
}

function Legend() {
  return (
    <p className="mt-3 flex items-center justify-center gap-4 text-xs text-muted">
      <span className="flex items-center gap-1.5">
        <span className="h-2.5 w-2.5 rounded-full bg-correct" /> Right spot
      </span>
      <span className="flex items-center gap-1.5">
        <span className="h-2.5 w-2.5 rounded-full bg-near" /> One off
      </span>
      <span className="flex items-center gap-1.5">
        <span className="h-2.5 w-2.5 rounded-full ring-2 ring-inset ring-muted/50" /> Further
      </span>
    </p>
  )
}
