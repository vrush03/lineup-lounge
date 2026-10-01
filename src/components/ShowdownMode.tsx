import { useEffect, useState } from 'react'
import { Showdown } from './Showdown'
import { loadDecks } from '../lib/puzzles'
import { isGame, POINTS, ROUNDS, score, winner } from '../lib/showdown'
import { clearShowdown, loadShowdown } from '../lib/storage'
import { FORMAT_STYLE, teamStyle } from '../lib/teams'
import { SHOWDOWN_FORMATS, type Deck, type ShowdownFormat } from '../lib/types'

type Props = { onFinish: (format: ShowdownFormat, won: boolean) => void }

const BLURB: Record<ShowdownFormat, string> = {
  ODI: 'One-day greats, from Viv to Virat.',
  T20I: 'The short-form internationals.',
  Test: 'Five-day legends across the eras.',
  IPL: 'Franchise stars since 2008.',
}

/** Stat-card battle against the computer: pick a format, then play 15 rounds for points. */
export function ShowdownMode({ onFinish }: Props) {
  const [decks, setDecks] = useState<Deck[] | null>(null)
  const [failed, setFailed] = useState(false)
  const [format, setFormat] = useState<ShowdownFormat | null>(null)
  const [deal, setDeal] = useState(0)
  useEffect(() => {
    loadDecks().then(setDecks, () => setFailed(true))
  }, [])

  if (!decks)
    return (
      <p role="status" className="py-16 text-center text-muted">
        {failed ? 'Couldn’t load the cards. Check your connection and reload.' : 'Shuffling the cards…'}
      </p>
    )

  const deck = decks.find((d) => d.format === format)
  if (!deck)
    return (
      <div className="animate-rise">
        <h2 className="font-display text-3xl font-extrabold uppercase leading-none tracking-wide">Pick your format</h2>
        <p className="mt-2 text-sm text-muted">
          You and the computer get {ROUNDS} cards each. Take turns naming a stat: the higher number wins the round and {POINTS} points. Most points after {ROUNDS} rounds wins.
        </p>
        <ul className="mt-5 grid grid-cols-2 gap-3">
          {SHOWDOWN_FORMATS.flatMap((f) => decks.filter((d) => d.format === f)).map((d) => (
            <li key={d.format}>
              <FormatTile deck={d} onPick={() => setFormat(d.format)} />
            </li>
          ))}
        </ul>
      </div>
    )

  function restart() {
    clearShowdown(deck!.format)
    setDeal((n) => n + 1)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  return (
    <>
      <div className="mb-3 flex items-center justify-between text-sm font-semibold text-muted">
        <button className="hover:text-ink" onClick={() => setFormat(null)}>
          <span aria-hidden>←</span> Formats
        </button>
        <button className="hover:text-ink" onClick={restart}>
          New deal
        </button>
      </div>
      <Showdown key={`${deck.format}:${deal}`} deck={deck} onFinish={(won) => onFinish(deck.format, won)} onNewGame={restart} />
      <p className="mt-6 text-center text-xs text-muted">
        {deck.cards.length} players in the {deck.format} deck, {2 * ROUNDS} dealt at random each game. Stats from{' '}
        <a className="underline decoration-line underline-offset-2 hover:text-ink" href={deck.source.url} target="_blank" rel="noreferrer">
          {deck.source.name}
        </a>{' '}
        ({deck.source.license}), as of {new Date(`${deck.asOf}T00:00:00`).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}.
      </p>
    </>
  )
}

function FormatTile({ deck, onPick }: { deck: Deck; onPick: () => void }) {
  const style = FORMAT_STYLE[deck.format]
  const saved = loadShowdown(deck.format)
  const live = isGame(saved, deck) && !winner(saved) ? saved : null
  return (
    <button
      onClick={onPick}
      className="group relative block w-full overflow-hidden rounded-3xl p-4 pt-24 text-left shadow-[var(--shadow)] ring-1 ring-black/10 transition hover:-translate-y-0.5 active:scale-[0.99] sm:pt-28"
      style={{ background: `linear-gradient(160deg, ${style.bg}, color-mix(in srgb, ${style.bg} 62%, black))`, color: style.fg }}
    >
      {/* A fanned hand of the deck's first three cards. */}
      <span aria-hidden className="absolute top-3 right-3 flex">
        {deck.cards.slice(0, 3).map((c, i) => (
          <span
            key={c.id}
            className="-ml-7 h-[76px] w-[58px] overflow-hidden rounded-lg border-2 border-white/90 shadow-lg transition duration-300 first:ml-0 group-hover:-translate-y-1 sm:h-[92px] sm:w-[70px]"
            style={{ transform: `rotate(${(i - 1) * 9}deg) translateY(${Math.abs(i - 1) * 5}px)`, background: teamStyle(c.team).bg }}
          >
            {c.photo && (
              <img src={c.photo} alt="" loading="lazy" className="h-full w-full object-cover object-top" onError={(e) => (e.currentTarget.style.visibility = 'hidden')} />
            )}
          </span>
        ))}
      </span>
      <span className="block font-display text-4xl font-extrabold uppercase leading-none tracking-wide">{deck.format}</span>
      <span className="mt-1.5 block text-xs leading-snug opacity-80">{BLURB[deck.format]}</span>
      <span className="mt-3 inline-block rounded-full bg-black/20 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider">
        {live ? `Resume · ${score(live).you} v ${score(live).cpu}` : `${deck.cards.length} players`}
      </span>
    </button>
  )
}
