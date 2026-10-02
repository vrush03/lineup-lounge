import { useEffect, useMemo, useRef, useState } from 'react'
import { CardBack, PlayerCard, type CardResult } from './PlayerCard'
import {
  compare,
  cpuPick,
  deal,
  isGame,
  playRound,
  POINTS,
  roundOf,
  ROUNDS,
  score,
  statText,
  turnOf,
  winner,
  type Game,
  type Outcome,
} from '../lib/showdown'
import { clearShowdown, loadShowdown, saveShowdown } from '../lib/storage'
import type { Card, Deck } from '../lib/types'

/** The round on the table: the two cards played, the stat named and who took it. */
type Played = { you: Card; cpu: Card; stat: string; outcome: Outcome }

type Props = {
  deck: Deck
  /** Called once when a game ends. */
  onFinish: (won: boolean) => void
  onNewGame: () => void
}

const CPU_THINKS_MS = 2600
const SHUFFLE_MS = 2500
const DEAL_MS = 2700

/** One game against the computer: 15 rounds, 10 points a round, most points wins. */
export function Showdown({ deck, onFinish, onNewGame }: Props) {
  const byId = useMemo(() => new Map(deck.cards.map((c) => [c.id, c])), [deck])
  const [game, setGame] = useState<Game>(() => {
    const saved = loadShowdown(deck.format)
    return isGame(saved, deck) && !winner(saved) ? saved : deal(deck)
  })
  // A new game opens with the shuffle and deal; a resumed one (always at least a round in) skips it.
  const [dealing, setDealing] = useState(() => game.log.length === 0)
  const [played, setPlayed] = useState<Played | null>(null)
  const next = useRef<HTMLButtonElement>(null)
  const result = winner(game)
  const cpuToPick = !dealing && !played && !result && turnOf(game) === 'cpu'

  function play(stat: string) {
    if (played || result) return
    const you = byId.get(game.you[0])!
    const cpu = byId.get(game.cpu[0])!
    const outcome = compare(you, cpu, stat)
    const after = playRound(game, outcome)
    setPlayed({ you, cpu, stat, outcome })
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
  }, [cpuToPick, game.log.length])

  useEffect(() => {
    if (played) next.current?.focus({ preventScroll: true })
  }, [played])

  const yours = played?.you ?? byId.get(game.you[0])
  const theirs = played?.cpu ?? byId.get(game.cpu[0])
  const stat = played && deck.stats.find((s) => s.key === played.stat)
  const mine: CardResult | null = played ? (played.outcome === 'tie' ? 'tie' : played.outcome === 'you' ? 'win' : 'lose') : null
  const other: CardResult | null = played ? (played.outcome === 'tie' ? 'tie' : played.outcome === 'cpu' ? 'win' : 'lose') : null
  // `game` has already moved on to the next round while the played cards are on the table.
  const round = played ? roundOf(game) - 1 : roundOf(game)
  const points = score(game)

  if (dealing) return <DealIntro onDone={() => setDealing(false)} />

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
              {played.outcome === 'tie' ? `. ${POINTS / 2} points each.` : `. ${POINTS} points to ${played.outcome === 'you' ? 'you' : 'the computer'}.`}
            </span>
          </span>
        ) : cpuToPick ? (
          <span className="animate-pulse font-display text-xl font-bold uppercase tracking-wide text-ink">Computer is choosing a stat…</span>
        ) : (
          <span>
            <span className="block font-display text-2xl font-extrabold uppercase leading-none tracking-wide text-ink">
              {round === ROUNDS ? 'Last round: your pick' : 'Your pick'}
            </span>
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
                onPick={!played && !result && turnOf(game) === 'you' ? play : undefined}
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
          <div className={`px-5 pt-5 pb-4 text-center ${result === 'you' ? 'bg-correct/10' : result === 'cpu' ? 'bg-leather/8' : 'bg-near/10'}`}>
            <p className={`text-xs font-semibold uppercase tracking-[0.18em] ${result === 'you' ? 'text-correct-ink' : 'text-muted'}`}>
              {deck.format} showdown · final score
            </p>
            <p className="mt-1 font-display text-4xl font-extrabold uppercase">
              {result === 'you' ? 'You win!' : result === 'cpu' ? 'Computer wins' : 'It’s a draw'}
            </p>
            <div className="mt-3 flex items-end justify-center gap-5 font-display font-extrabold leading-none">
              <Total label="You" points={points.you} tone={result === 'you' ? 'text-pitch' : 'text-ink'} />
              <span className="pb-5 text-2xl text-muted">–</span>
              <Total label="Computer" points={points.cpu} tone={result === 'cpu' ? 'text-leather' : 'text-ink'} />
            </div>
            <p className="mt-3 text-sm text-muted">
              You took {count(game, 'you')} of {ROUNDS} rounds, the computer {count(game, 'cpu')}
              {count(game, 'tie') > 0 && `, with ${count(game, 'tie')} tied`}.
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

const PACK = 12
const FLIGHTS = 10

/** Opening ceremony: the pack is riffle-shuffled, then dealt face down, one for you and one for the computer. */
function DealIntro({ onDone }: { onDone: () => void }) {
  const [phase, setPhase] = useState<'shuffle' | 'deal'>('shuffle')
  useEffect(() => {
    const t = setTimeout(() => (phase === 'shuffle' ? setPhase('deal') : onDone()), phase === 'shuffle' ? SHUFFLE_MS : DEAL_MS)
    return () => clearTimeout(t)
  }, [phase, onDone])

  const slot = 'absolute left-1/2 top-0 -ml-[3.25rem] h-36 w-[6.5rem] sm:-ml-14 sm:h-40 sm:w-28'
  return (
    <div className="animate-rise">
      <p role="status" className="text-center">
        <span className="block font-display text-2xl font-extrabold uppercase leading-none tracking-wide text-ink">
          {phase === 'shuffle' ? 'Shuffling the deck' : 'Dealing the cards'}
        </span>
        <span className="mt-1 block text-sm font-medium text-muted">Everyone gets a hand, face down.</span>
      </p>

      <div className="relative mx-auto mt-10 h-[22rem] max-w-md [--dx:7.5rem] [--dy:11rem] [--split:4.5rem] sm:h-96 sm:[--dx:10rem] sm:[--dy:12rem] sm:[--split:6rem]">
        {phase === 'shuffle'
          ? Array.from({ length: PACK }, (_, i) => (
              <div
                key={i}
                aria-hidden
                className={`${slot} animate-riffle [animation-iteration-count:3]`}
                style={{
                  ['--dir' as string]: i % 2 === 0 ? -1 : 1,
                  animationDelay: `${i * 45}ms`,
                  top: `${(PACK - i) * -1.5}px`,
                  zIndex: i,
                }}
              >
                <CardBack small />
              </div>
            ))
          : (
            <>
              <div aria-hidden className={slot} style={{ zIndex: 0 }}>
                <CardBack small />
              </div>
              {Array.from({ length: FLIGHTS * 2 }, (_, i) => {
                const side = i % 2 === 0 ? -1 : 1
                const n = Math.floor(i / 2)
                return (
                  <div
                    key={i}
                    aria-hidden
                    className={`${slot} animate-deal-out`}
                    style={{
                      ['--dir' as string]: side,
                      ['--tilt' as string]: `${side * (n % 3 - 1) * 3}deg`,
                      animationDelay: `${i * 110}ms`,
                      top: `${-n * 1.5}px`,
                      zIndex: 10 + i,
                    }}
                  >
                    <CardBack small />
                  </div>
                )
              })}
              <span className="absolute left-1/2 bottom-0 -ml-[calc(var(--dx)+3rem)] w-24 text-center text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">You</span>
              <span className="absolute left-1/2 bottom-0 ml-[calc(var(--dx)-3rem)] w-24 text-center text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">Computer</span>
            </>
          )}
      </div>

      <button onClick={onDone} className="mx-auto mt-4 block text-sm font-semibold text-muted underline-offset-4 hover:text-ink hover:underline">
        Skip
      </button>
    </div>
  )
}

const count = (game: Game, outcome: Outcome) => game.log.filter((o) => o === outcome).length

function Total({ label, points, tone }: { label: string; points: number; tone: string }) {
  return (
    <span>
      <span className={`block text-6xl tabular-nums ${tone}`}>{points}</span>
      <span className="mt-1 block text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">{label}</span>
    </span>
  )
}

function Label({ children }: { children: React.ReactNode }) {
  return <p className="mb-3 text-center text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">{children}</p>
}

const PIP: Record<Outcome, string> = { you: 'bg-pitch', cpu: 'bg-leather', tie: 'bg-near' }

/** Points for each side, with one pip per round: green yours, red the computer's, amber tied. */
function Scoreboard({ game, round }: { game: Game; round: number }) {
  const points = score(game)
  return (
    <div className="rounded-2xl border border-line bg-surface px-4 py-3 shadow-[var(--shadow)]">
      <div className="flex items-end justify-between font-display font-bold uppercase leading-none tracking-wide">
        <span className="text-pitch">
          <span className="text-3xl tabular-nums">{points.you}</span> <span className="text-sm text-muted">you</span>
        </span>
        <span className="text-xs tracking-[0.18em] text-muted">
          Round {Math.min(round, ROUNDS)} of {ROUNDS}
        </span>
        <span className="text-leather">
          <span className="text-sm text-muted">computer</span> <span className="text-3xl tabular-nums">{points.cpu}</span>
        </span>
      </div>
      <div
        className="mt-2.5 flex gap-1"
        role="img"
        aria-label={`You have ${points.you} points, the computer ${points.cpu}, after ${game.log.length} of ${ROUNDS} rounds`}
      >
        {Array.from({ length: ROUNDS }, (_, i) => (
          <span key={i} className={`h-2 flex-1 rounded-full transition-colors duration-500 ${game.log[i] ? PIP[game.log[i]] : 'bg-surface-2'}`} />
        ))}
      </div>
    </div>
  )
}
