import { useEffect, useMemo, useRef, useState } from 'react'
import { PlayerCard } from './PlayerCard'
import { PlayerSearch } from './PlayerSearch'
import { NEXT_BUTTON } from './roundStyles'
import { whoamiShareText } from '../lib/share'
import { loadWhoAmI, saveWhoAmI } from '../lib/storage'
import {
  closingLine,
  compareGuess,
  hintsFor,
  hintsShown,
  isOver,
  isRound,
  isSolved,
  MAX_GUESSES,
  warmth,
  wrongLine,
  type Chips,
  type Round,
  type Warmth,
} from '../lib/whoami'
import type { Bio, Card, Deck } from '../lib/types'

type Props = {
  deck: Deck
  bios: Record<string, Bio>
  /** The mystery card's id in `deck`. */
  answer: string
  /** Set for the daily round: where it is saved, and its number for the share text. */
  storageKey?: string
  day?: number
  /** Called once when the round ends. */
  onFinish?: (solved: boolean, guesses: number) => void
  onNext: () => void
  nextLabel: string
}

const WARM_TEXT: Record<Warmth, string> = { cold: 'text-wrong-ink', warm: 'text-near-ink', close: 'text-correct-ink' }

/** One mystery card: read the stat line, name the player in five guesses. Wrong guesses earn hints. */
export function WhoAmI({ deck, bios, answer, storageKey, day, onFinish, onNext, nextLabel }: Props) {
  const byId = useMemo(() => new Map(deck.cards.map((c) => [c.id, c])), [deck])
  const [round, setRound] = useState<Round>(() => {
    const saved = storageKey ? loadWhoAmI(storageKey) : null
    return isRound(saved, answer, deck) ? saved : { id: answer, guesses: [] }
  })
  // Varies the commentary: the day for a daily, so everyone hears the same lines.
  const [seed] = useState(() => day ?? Math.floor(Math.random() * 1000))
  const [justFinished, setJustFinished] = useState(false)
  const [copied, setCopied] = useState(false)
  const panel = useRef<HTMLDivElement>(null)
  const next = useRef<HTMLButtonElement>(null)

  const card = byId.get(answer)!
  const solved = isSolved(round)
  const over = isOver(round)
  const wrong = round.guesses
    .filter((id) => id !== answer)
    .map((id) => {
      const guess = byId.get(id)!
      const chips = compareGuess(guess, card, bios, deck.format)
      return { guess, chips, warmth: warmth(chips) }
    })
  const hints = hintsFor(card, deck, bios[answer])
  const shown = hintsShown(wrong.map((w) => w.warmth))
  const photoHint = hints.slice(0, shown).some((h) => h.kind === 'photo')
  const last = wrong.at(-1)

  function guess(c: Card) {
    if (over) return
    const after = { id: answer, guesses: [...round.guesses, c.id] }
    setRound(after)
    if (storageKey) saveWhoAmI(storageKey, after)
    if (isOver(after)) {
      setJustFinished(true)
      onFinish?.(isSolved(after), after.guesses.length)
    }
  }

  // Bring the result into view once the card has turned, and focus "Next" so Enter moves on.
  useEffect(() => {
    if (!justFinished) return
    const t = setTimeout(() => {
      next.current?.focus({ preventScroll: true })
      panel.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    }, 650)
    return () => clearTimeout(t)
  }, [justFinished])

  async function share() {
    const text = whoamiShareText(deck.format, wrong.map((w) => w.warmth), solved, day)
    try {
      if (navigator.share && matchMedia('(pointer: coarse)').matches) await navigator.share({ text })
      else await navigator.clipboard.writeText(text)
      setCopied(true)
    } catch {
      /* share sheet dismissed */
    }
  }

  return (
    <div className="animate-rise">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h2 className="font-display text-3xl font-extrabold uppercase leading-none tracking-wide">Who am I?</h2>
          <p className="mt-1.5 text-sm text-muted">
            {over ? `${deck.format} career figures.` : `These are one player’s ${deck.format} career figures. Name them in ${MAX_GUESSES} guesses.`}
          </p>
        </div>
        <div
          className="flex shrink-0 gap-1 pb-1"
          role="img"
          aria-label={over ? `${round.guesses.length} of ${MAX_GUESSES} guesses used` : `Guess ${round.guesses.length + 1} of ${MAX_GUESSES}`}
        >
          {Array.from({ length: MAX_GUESSES }, (_, i) => {
            const id = round.guesses[i]
            const tone = !id ? 'bg-surface-2 ring-1 ring-line' : id === answer ? 'bg-correct' : wrong[i]?.warmth === 'cold' ? 'bg-wrong' : 'bg-near'
            return <span key={i} className={`h-2.5 w-6 rounded-full transition-colors duration-500 ${tone}`} />
          })}
        </div>
      </div>

      <div className="mx-auto mt-5 max-w-[280px]">
        <div key={over ? 'revealed' : 'mystery'} className={over ? 'animate-deal' : ''}>
          <PlayerCard
            card={card}
            deck={deck}
            owner={over ? 'The answer' : 'Mystery player'}
            mystery={over ? null : photoHint ? 'blurred' : 'hidden'}
          />
        </div>
      </div>

      {over ? (
        <div ref={panel} className="mt-6 animate-rise scroll-mb-6 overflow-hidden rounded-3xl border border-line bg-surface shadow-[var(--shadow)]">
          <div className={`px-5 pt-5 pb-4 text-center ${solved ? 'bg-correct/10' : 'bg-leather/8'}`}>
            <p className={`text-xs font-semibold uppercase tracking-[0.18em] ${solved ? 'text-correct-ink' : 'text-muted'}`}>
              {solved ? `Got it in ${round.guesses.length} of ${MAX_GUESSES}` : 'Out of guesses'}
            </p>
            <p className="mt-1 font-display text-3xl font-extrabold uppercase leading-tight text-balance">{closingLine(round, seed)}</p>
            <p className="mt-2 text-sm text-muted">
              It was <strong className="font-semibold text-ink">{card.name}</strong>, {card.team}.
            </p>
          </div>
          <div className="space-y-2 p-4">
            <button ref={next} onClick={onNext} className={`${NEXT_BUTTON} rounded-xl`}>
              {nextLabel} <span aria-hidden>→</span>
            </button>
            <button onClick={share} className="w-full rounded-xl border border-line py-3 text-sm font-semibold text-muted transition hover:text-ink">
              {copied ? 'Copied to clipboard' : 'Share result'}
            </button>
          </div>
        </div>
      ) : (
        <div className="mt-5">
          {last && (
            <p key={wrong.length} role="status" className={`mb-3 animate-fade text-center font-display text-2xl font-extrabold uppercase leading-tight tracking-wide ${WARM_TEXT[last.warmth]}`}>
              {wrongLine(last.warmth, seed + wrong.length)}
            </p>
          )}
          <PlayerSearch deck={deck} exclude={round.guesses} onGuess={guess} />
          <p className="mt-2 text-center text-xs text-muted">
            Guess {round.guesses.length + 1} of {MAX_GUESSES}. A wrong guess earns a hint; a close one earns two.
          </p>
        </div>
      )}

      {shown > 0 && (
        <section className="mt-6" aria-label="Hints">
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-muted">Hints</h3>
          <ol className="space-y-1.5">
            {hints.slice(0, shown).map((h, i) => (
              <li key={i} className="flex animate-rise gap-3 rounded-xl border border-line bg-surface px-3.5 py-2.5 text-sm">
                <span className="font-display text-lg font-bold leading-none text-gold tabular-nums">{i + 1}</span>
                <span>{h.kind === 'photo' ? (card.photo ? 'An out-of-focus photo, on the card.' : 'The initials, on the card.') : h.text}</span>
              </li>
            ))}
          </ol>
        </section>
      )}

      {wrong.length > 0 && (
        <section className="mt-6" aria-label="Your guesses">
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-muted">Your guesses</h3>
          <ol className="space-y-2">
            {wrong
              .map((w, i) => (
                <li key={w.guess.id} className="animate-rise rounded-xl border border-line bg-surface px-3.5 py-3">
                  <p className="flex items-baseline justify-between gap-2">
                    <span className="font-semibold">
                      <span className="mr-2 font-display text-lg font-bold text-muted tabular-nums">{i + 1}</span>
                      {w.guess.name}
                    </span>
                    <span className={`shrink-0 text-xs font-bold uppercase tracking-wider ${WARM_TEXT[w.warmth]}`}>{w.warmth}</span>
                  </p>
                  <GuessChips guess={w.guess} chips={w.chips} bio={bios[w.guess.id]} deck={deck} />
                </li>
              ))
              .reverse()}
          </ol>
        </section>
      )}
    </div>
  )
}

/** What the guessed player shares with the answer: green where it matches. */
function GuessChips({ guess, chips, bio, deck }: { guess: Card; chips: Chips; bio?: Bio; deck: Deck }) {
  const span = bio?.span[deck.format]
  const years = span ? (span[0] === span[1] ? `${span[0]}` : `${span[0]}–${String(span[1]).slice(2)}`) : 'Era'
  const era = chips.era === 'overlap' ? 'same era' : chips.era === 'earlier' ? 'answer played earlier' : 'answer played later'
  const items: [string, boolean, string][] = [
    [guess.team, chips.team, chips.team ? 'same team' : 'different team'],
    [bio?.role ?? 'Role', chips.role, chips.role ? 'same role' : 'different role'],
    [chips.era === 'overlap' ? years : `${chips.era === 'earlier' ? '← ' : ''}${years}${chips.era === 'later' ? ' →' : ''}`, chips.era === 'overlap', era],
    [bio ? `${bio.bats}-hand bat` : 'Batting hand', chips.bats, chips.bats ? 'same batting hand' : 'other batting hand'],
  ]
  return (
    <ul className="mt-2 flex flex-wrap gap-1.5">
      {items.map(([label, match, note]) => (
        <li
          key={note}
          title={note}
          className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${
            match ? 'border-correct/40 bg-correct/15 text-correct-ink' : 'border-line bg-surface-2 text-muted'
          }`}
        >
          <span aria-hidden>{match ? '✓ ' : '✗ '}</span>
          {label}
          <span className="sr-only">: {note}</span>
        </li>
      ))}
    </ul>
  )
}
