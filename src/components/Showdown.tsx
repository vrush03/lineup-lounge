import { useEffect, useMemo, useRef, useState } from 'react'
import { PlayerCard, type CardResult } from './PlayerCard'
import { compare, cpuPick, deal, HAND, isGame, playRound, statText, winner, type Game, type Outcome } from '../lib/showdown'
import { clearShowdown, loadShowdown, saveShowdown } from '../lib/storage'
import type { Card, Deck } from '../lib/types'

/** The round on the table: the two cards played, the stat named and who took it. */
type Played = { you: Card; cpu: Card; stat: string; outcome: Outcome; by: 'you' | 'cpu'; pot: number }

type Props = {
  deck: Deck
  /** Called once when a game ends. */
  onFinish: (won: boolean) => void
  onNewGame: () => void
}

const CPU_THINKS_MS = 1100

/** One game against the computer: play top cards until one side holds them all. */
export function Showdown({ deck, onFinish, onNewGame }: Props) {
  const byId = useMemo(() => new Map(deck.cards.map((c) => [c.id, c])), [deck])
  const [game, setGame] = useState<Game>(() => {
    const saved = loadShowdown(deck.format)
    return isGame(saved, deck) && !winner(saved) ? saved : deal(deck)
  })
  const [played, setPlayed] = useState<Played | null>(null)
  const next = useRef<HTMLButtonElement>(null)
  const result = winner(game)
  const cpuToPick = !played && !result && game.turn === 'cpu'

  function play(stat: string) {
    if (played || result) return
    const you = byId.get(game.you[0])!
    const cpu = byId.get(game.cpu[0])!
    const outcome = compare(you, cpu, stat)
    const after = playRound(game, outcome)
    setPlayed({ you, cpu, stat, outcome, by: game.turn, pot: game.pot.length })
    setGame(after)
    // Saved as soon as the stat is named, so a reload can't replay a lost round.
    const end = winner(after)
    if (end) {
      clearShowdown(deck.format)
      onFinish(end === 'you')
    } else saveShowdown(deck.format, after)
  }

  // The computer takes a moment over its pick so the player can read their own card first.
  useEffect(() => {
    if (!cpuToPick) return
    const t = setTimeout(() => play(cpuPick(byId.get(game.cpu[0])!, deck)), CPU_THINKS_MS)
    return () => clearTimeout(t)
    // Runs once per computer turn; `play` and the top card are read fresh from that render.
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [cpuToPick, game.round])

  useEffect(() => {
    if (played) next.current?.focus({ preventScroll: true })
  }, [played])

  const yours = played?.you ?? byId.get(game.you[0])
  const theirs = played?.cpu ?? byId.get(game.cpu[0])
  const stat = played && deck.stats.find((s) => s.key === played.stat)
  const mine: CardResult | null = played ? (played.outcome === 'tie' ? 'tie' : played.outcome === 'you' ? 'win' : 'lose') : null
  const other: CardResult | null = played ? (played.outcome === 'tie' ? 'tie' : played.outcome === 'cpu' ? 'win' : 'lose') : null
  // `game` has already moved on to the next round while the played cards are on the table.
  const round = played ? game.round - 1 : game.round

  return (
    <div className="animate-rise">
      <Scoreboard game={game} round={round} />

      <p role="status" className="mt-4 flex min-h-12 items-center justify-center text-center text-sm font-medium text-muted">
        {played && stat ? (
          <span className="animate-fade">
            <span className="block font-display text-2xl font-extrabold uppercase leading-none tracking-wide text-ink">
              {played.outcome === 'you' ? 'You take the round' : played.outcome === 'cpu' ? 'Computer takes the round' : 'Tied'}
            </span>
            <span className="mt-1 block">
              {stat.label}: {statText(played.you, stat)} v {statText(played.cpu, stat)}
              {played.outcome === 'tie'
                ? '. Both cards go to the pot.'
                : played.pot
                  ? `, plus ${played.pot} from the pot.`
                  : '.'}
            </span>
          </span>
        ) : cpuToPick ? (
          <span className="animate-pulse font-display text-xl font-bold uppercase tracking-wide text-ink">Computer is choosing a stat…</span>
        ) : (
          <span>
            <span className="block font-display text-2xl font-extrabold uppercase leading-none tracking-wide text-ink">Your pick</span>
            <span className="mt-1 block">Tap the stat you think beats the computer’s card.</span>
          </span>
        )}
      </p>

      <div className="mt-3 grid grid-cols-2 gap-2.5 sm:gap-4">
        <div>
          <Label>You</Label>
          {yours && (
            <div key={`you:${round}`} className="animate-deal">
              <PlayerCard
                card={yours}
                deck={deck}
                owner="Your card"
                chosen={played?.stat}
                result={mine}
                onPick={!played && !result && game.turn === 'you' ? play : undefined}
              />
            </div>
          )}
        </div>
        <div>
          <Label>Computer</Label>
          {theirs && (
            <div key={`cpu:${round}`} className="animate-deal [animation-delay:80ms]">
              <PlayerCard card={theirs} deck={deck} owner="Computer’s card" faceDown={!played} chosen={played?.stat} result={other} />
            </div>
          )}
        </div>
      </div>

      {played && !result && (
        <button
          ref={next}
          onClick={() => setPlayed(null)}
          className="mt-5 flex w-full animate-rise items-center justify-center gap-2 rounded-xl bg-pitch-deep py-3.5 font-display text-xl font-bold uppercase tracking-wider text-white shadow-lg shadow-pitch-deep/25 transition hover:bg-pitch active:scale-[0.99]"
        >
          Next card <span aria-hidden>→</span>
        </button>
      )}

      {result && (
        <div className="mt-5 animate-rise overflow-hidden rounded-3xl border border-line bg-surface shadow-[var(--shadow)]">
          <div className={`px-5 pt-5 pb-4 ${result === 'you' ? 'bg-correct/10' : 'bg-leather/8'}`}>
            <p className={`text-xs font-semibold uppercase tracking-[0.18em] ${result === 'you' ? 'text-correct-ink' : 'text-muted'}`}>
              {deck.format} showdown · {round} rounds
            </p>
            <p className="mt-1 font-display text-3xl font-extrabold uppercase">
              {result === 'you' ? 'You win the lot!' : result === 'cpu' ? 'Cleaned out' : 'Honours even'}
            </p>
            <p className="mt-1 text-sm text-muted">
              {result === 'you'
                ? `All ${2 * HAND} cards are yours.`
                : result === 'cpu'
                  ? 'The computer holds every card.'
                  : 'The last two cards tied, so nobody takes the pot.'}
            </p>
          </div>
          <div className="p-4">
            <button
              onClick={onNewGame}
              autoFocus
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-pitch-deep py-3.5 font-display text-xl font-bold uppercase tracking-wider text-white shadow-lg shadow-pitch-deep/25 transition hover:bg-pitch active:scale-[0.99]"
            >
              Deal again <span aria-hidden>→</span>
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function Label({ children }: { children: React.ReactNode }) {
  return <p className="mb-3 text-center text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">{children}</p>
}

/** Card counts as a tug of war: your share from the left, the computer's from the right, the pot between. */
function Scoreboard({ game, round }: { game: Game; round: number }) {
  const total = game.you.length + game.cpu.length + game.pot.length
  return (
    <div className="rounded-2xl border border-line bg-surface px-4 py-3 shadow-[var(--shadow)]">
      <div className="flex items-end justify-between font-display font-bold uppercase leading-none tracking-wide">
        <span className="text-pitch">
          <span className="text-3xl tabular-nums">{game.you.length}</span> <span className="text-sm text-muted">you</span>
        </span>
        <span className="text-xs tracking-[0.18em] text-muted">
          Round {round}
          {game.pot.length > 0 && <span className="text-near-ink"> · pot {game.pot.length}</span>}
        </span>
        <span className="text-leather">
          <span className="text-sm text-muted">computer</span> <span className="text-3xl tabular-nums">{game.cpu.length}</span>
        </span>
      </div>
      <div
        className="mt-2 flex h-2.5 overflow-hidden rounded-full bg-surface-2"
        role="img"
        aria-label={`You hold ${game.you.length} cards, the computer ${game.cpu.length}${game.pot.length ? `, ${game.pot.length} in the pot` : ''}`}
      >
        <div className="bg-pitch transition-[width] duration-500" style={{ width: `${(100 * game.you.length) / total}%` }} />
        <div className="bg-near transition-[width] duration-500" style={{ width: `${(100 * game.pot.length) / total}%` }} />
        <div className="bg-leather transition-[width] duration-500" style={{ width: `${(100 * game.cpu.length) / total}%` }} />
      </div>
    </div>
  )
}
