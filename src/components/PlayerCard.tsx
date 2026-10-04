import { useState } from 'react'
import { statText } from '../lib/showdown'
import { FORMAT_STYLE, teamStyle } from '../lib/teams'
import type { Card, Deck } from '../lib/types'

export type CardResult = 'win' | 'lose' | 'tie'
/** `initials`: what a card without a photo shows instead of a question mark. */
export type Mystery = { blur: number; initials?: boolean }

type Props = {
  card: Card
  deck: Deck
  /** Whose card it is, for screen readers: "Your card", "Computer's card". */
  owner: string
  faceDown?: boolean
  /** The stat in play this round. */
  chosen?: string | null
  result?: CardResult | null
  /** Set when it is the player's turn: each stat becomes a button. */
  onPick?: (stat: string) => void
  /** Who Am I?: keep the name and team off the card, with the photo this many px out of focus. */
  mystery?: Mystery | null
}

const ROW: Record<CardResult, string> = {
  win: 'bg-correct text-white shadow-[0_0_18px_-2px_var(--color-correct)]',
  lose: 'bg-wrong text-white',
  tie: 'bg-near text-[#1b1406]',
}
const GLOW: Record<CardResult, string> = {
  win: 'shadow-[0_0_0_2px_var(--color-correct),0_0_36px_-4px_var(--color-correct)]',
  lose: 'opacity-70 saturate-[0.55]',
  tie: 'shadow-[0_0_0_2px_var(--color-near),0_0_30px_-6px_var(--color-near)]',
}

/** A stat card. It is always dark, like a printed card, whatever the page theme. */
export function PlayerCard({ card, deck, owner, faceDown = false, chosen, result, onPick, mystery }: Props) {
  // A mystery card wears neutral colours: the team's would give it away.
  const team = teamStyle(mystery ? undefined : card.team, '?')
  // A metallic frame in the team's colour: light catches the top-left edge, shade the bottom.
  const frame = `linear-gradient(150deg, ${team.bg}, color-mix(in srgb, ${team.bg} 40%, white) 32%, ${team.bg} 58%, color-mix(in srgb, ${team.bg} 55%, black))`

  return (
    <div className="[perspective:1200px]">
      <div
        className={`relative transition-transform duration-700 [transform-style:preserve-3d] ${faceDown ? '[transform:rotateY(180deg)]' : ''}`}
      >
        <article
          aria-label={faceDown ? undefined : mystery ? owner : `${owner}: ${card.name}, ${card.team}`}
          aria-hidden={faceDown}
          className={`relative rounded-[18px] p-[3px] transition duration-500 [backface-visibility:hidden] ${result ? GLOW[result] : 'shadow-[0_14px_30px_-14px_rgb(0_0_0/0.7)]'}`}
          style={{ background: frame }}
        >
          <div className="relative overflow-hidden rounded-[15px] bg-[#0a1210] text-white">
            {/* A mystery card is cut a little short so the guess box stays in reach. */}
            <div className={`relative ${mystery ? 'aspect-[10/8]' : 'aspect-[10/11]'}`}>
              <Photo card={card} bg={team.bg} fg={team.fg} mystery={mystery} />
              <div className="absolute inset-0 bg-[linear-gradient(to_bottom,rgb(10_18_16/0.35),transparent_22%,transparent_48%,rgb(10_18_16/0.92)_88%,#0a1210)]" />
              <div className="absolute inset-x-2 top-2 flex items-start justify-between gap-1">
                <span
                  className="rounded-md px-1.5 py-0.5 font-display text-[11px] font-bold uppercase leading-none tracking-widest ring-1 ring-black/20 sm:text-xs"
                  style={{ background: FORMAT_STYLE[deck.format].bg, color: FORMAT_STYLE[deck.format].fg }}
                >
                  {deck.format}
                </span>
                <span
                  className="rounded-md px-1.5 py-0.5 font-display text-[11px] font-bold uppercase leading-none tracking-widest ring-1 ring-white/25 sm:text-xs"
                  style={{ background: team.bg, color: team.fg }}
                >
                  {team.code}
                </span>
              </div>
              <div className="absolute inset-x-2.5 bottom-1.5">
                <h3 className="font-display text-[21px] font-extrabold uppercase leading-[0.95] tracking-wide text-balance drop-shadow-[0_1px_2px_rgb(0_0_0/0.8)] sm:text-[28px]">
                  {mystery ? 'Who am I?' : card.name}
                </h3>
                <p className="mt-0.5 truncate text-[10px] font-semibold uppercase tracking-[0.16em] text-white/65 sm:text-[11px]">
                  {mystery ? `One of ${deck.cards.length} in the ${deck.format} deck` : card.team}
                </p>
              </div>
            </div>

            <ul className="space-y-[3px] px-1.5 pt-1 pb-1.5 sm:px-2 sm:pb-2">
              {deck.stats.map((s) => {
                const active = chosen === s.key
                const tone = active && result ? ROW[result] : active ? 'bg-white text-[#0a1210]' : onPick ? 'bg-white/[0.07] hover:bg-white/20 active:bg-white/25' : 'bg-white/[0.04]'
                const row = `flex w-full items-center justify-between gap-2 rounded-lg px-2 py-[3px] text-left transition sm:px-2.5 sm:py-1 ${tone}`
                const inner = (
                  <>
                    <span className="text-[11px] font-semibold uppercase tracking-wider opacity-75 sm:hidden">{s.short}</span>
                    <span className="hidden text-xs font-semibold uppercase tracking-wider opacity-75 sm:inline">{s.label}</span>
                    <span className="font-display text-[19px] font-bold leading-none tabular-nums sm:text-[22px]">{statText(card, s)}</span>
                  </>
                )
                return (
                  <li key={s.key}>
                    {onPick ? (
                      <button className={row} onClick={() => onPick(s.key)} aria-label={`${s.label}: ${statText(card, s)}`}>
                        {inner}
                      </button>
                    ) : (
                      <div className={row} aria-label={`${s.label}: ${statText(card, s)}`}>
                        {inner}
                      </div>
                    )}
                  </li>
                )
              })}
            </ul>

            {/* Foil glint as the card lands. */}
            <div
              aria-hidden
              className="pointer-events-none absolute inset-y-0 left-0 w-1/2 animate-sheen bg-[linear-gradient(90deg,transparent,rgb(255_255_255/0.22),transparent)]"
            />
          </div>
          {result && result !== 'lose' && (
            <span className="pointer-events-none absolute inset-x-0 -top-2.5 flex justify-center">
              <span
                className={`animate-stamp rounded-md px-2.5 py-1 font-display text-base font-extrabold uppercase leading-none tracking-widest shadow-lg ring-2 ring-white/80 ${result === 'win' ? 'bg-correct text-white' : 'bg-near text-[#1b1406]'}`}
              >
                {result === 'win' ? 'Wins' : 'Tie'}
              </span>
            </span>
          )}
        </article>

        <CardBack />
      </div>
    </div>
  )
}

/** The portrait on a team-colour backdrop, which shows behind cut-out photos; initials if there is no photo. */
function Photo({ card, bg, fg, mystery }: { card: Card; bg: string; fg: string; mystery?: Mystery | null }) {
  const [broken, setBroken] = useState(false)
  const initials =
    mystery && !mystery.initials
      ? '?'
      : card.name
          .split(/\s+/)
          .map((w) => w[0])
          .join('')
          .slice(0, 3)
  return (
    <div
      aria-hidden
      className="absolute inset-0 grid place-items-center overflow-hidden pb-8"
      style={{ background: `radial-gradient(120% 90% at 50% 0%, color-mix(in srgb, ${bg} 62%, white), ${bg} 55%, color-mix(in srgb, ${bg} 45%, black))` }}
    >
      {card.photo && !broken ? (
        <img
          src={card.photo}
          alt=""
          decoding="async"
          draggable={false}
          onError={() => setBroken(true)}
          className={`absolute inset-0 h-full w-full object-cover object-top ${mystery ? 'scale-125' : ''} transition-[filter] duration-700`}
          style={mystery ? { filter: `blur(${mystery.blur}px)` } : undefined}
        />
      ) : (
        <span className="font-display text-[84px] font-extrabold leading-none opacity-30 sm:text-[120px]" style={{ color: fg }}>
          {initials}
        </span>
      )}
    </div>
  )
}

/** The back every card shares: club-tie stripes and the ball. */
export function CardBack({ small = false }: { small?: boolean }) {
  return (
    <div
      aria-hidden
      className={`absolute inset-0 rounded-[18px] bg-[linear-gradient(150deg,#e8c56a,#8a6417_45%,#f1d68e_70%,#6b4c10)] p-[3px] shadow-[0_14px_30px_-14px_rgb(0_0_0/0.7)] ${small ? '' : '[backface-visibility:hidden] [transform:rotateY(180deg)]'}`}
    >
      <div className="relative grid h-full place-items-center overflow-hidden rounded-[15px] bg-pitch-deep bg-[repeating-linear-gradient(135deg,rgb(255_255_255/0.05)_0_10px,transparent_10px_20px)]">
        <div className="absolute inset-2 rounded-xl border border-gold/40" />
        <div className="text-center">
          <svg viewBox="0 0 64 64" className={`mx-auto drop-shadow-lg ${small ? 'h-9 w-9' : 'h-16 w-16 sm:h-24 sm:w-24'}`}>
            <circle cx="32" cy="32" r="28" fill="#b3202a" />
            <circle cx="24" cy="22" r="10" fill="#fff" opacity="0.12" />
            <path d="M14 13c9 9 9 29 0 38M50 13c-9 9-9 29 0 38" fill="none" stroke="#f6efe2" strokeWidth="2.5" strokeDasharray="3 3" strokeLinecap="round" />
          </svg>
          <p className={`font-display font-extrabold uppercase leading-none text-gold ${small ? 'mt-1.5 text-xs tracking-[0.12em]' : 'mt-3 text-lg tracking-[0.2em] sm:text-2xl'}`}>Showdown</p>
          {!small && <p className="mt-1 text-[9px] font-semibold uppercase tracking-[0.3em] text-white/50 sm:text-[10px]">Lineup Lounge</p>}
        </div>
      </div>
    </div>
  )
}
