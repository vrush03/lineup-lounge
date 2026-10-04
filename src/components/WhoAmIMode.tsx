import { useEffect, useState } from 'react'
import { WhoAmI } from './WhoAmI'
import { loadDecks, loadWhoAmIData } from '../lib/puzzles'
import { loadPref, savePref } from '../lib/storage'
import { dailyPick } from '../lib/whoami'
import { SHOWDOWN_FORMATS, type Deck, type ShowdownFormat, type WhoAmIData } from '../lib/types'

type Props = {
  day: number
  dateLabel: string
  onFinishDaily: (solved: boolean, guesses: number) => void
}

/** Guess the player from a stat card: one daily card, plus practice in a format of your choice. */
export function WhoAmIMode(props: Props) {
  const [loaded, setLoaded] = useState<{ decks: Deck[]; data: WhoAmIData } | null>(null)
  const [failed, setFailed] = useState(false)
  useEffect(() => {
    Promise.all([loadDecks(), loadWhoAmIData()]).then(
      ([decks, data]) => setLoaded({ decks, data }),
      () => setFailed(true),
    )
  }, [])

  if (!loaded)
    return (
      <p role="status" className="py-16 text-center text-muted">
        {failed ? 'Couldn’t load the cards. Check your connection and reload.' : 'Loading…'}
      </p>
    )
  return <Rounds {...props} {...loaded} />
}

function Rounds({ decks, data, day, dateLabel, onFinishDaily }: Props & { decks: Deck[]; data: WhoAmIData }) {
  const [round, setRound] = useState<'daily' | 'practice'>('daily')
  const [format, setFormat] = useState<ShowdownFormat>(() => {
    const f = loadPref<string>('whoami-format', 'ODI')
    return SHOWDOWN_FORMATS.find((x) => x === f) ?? 'ODI'
  })
  const [practice, setPractice] = useState<{ format: ShowdownFormat; id: string; n: number } | null>(null)
  const [seen] = useState(() => new Set<string>())

  const deckOf = (f: ShowdownFormat) => decks.find((d) => d.format === f)!
  const pick = dailyPick(day, data)
  const dailyDeck = deckOf(pick.format)
  // The order is generated from the decks; if the two ever disagree, still deal a card from the deck.
  const dailyId = dailyDeck.cards.some((c) => c.id === pick.id) ? pick.id : dailyDeck.cards[Math.abs(day) % dailyDeck.cards.length].id

  function nextPractice(f = format) {
    const key = (id: string) => `${f}:${id}`
    // Today's daily player stays out of practice, whatever the format.
    const cards = deckOf(f).cards.filter((c) => c.id !== dailyId)
    let fresh = cards.filter((c) => !seen.has(key(c.id)))
    if (!fresh.length) {
      cards.forEach((c) => seen.delete(key(c.id)))
      fresh = cards
    }
    const card = pickRandom(fresh)
    seen.add(key(card.id))
    setPractice((p) => ({ format: f, id: card.id, n: (p?.n ?? 0) + 1 }))
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function goPractice() {
    setRound('practice')
    if (!practice) nextPractice()
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function pickFormat(f: ShowdownFormat) {
    setFormat(f)
    savePref('whoami-format', f)
    nextPractice(f)
  }

  return round === 'daily' ? (
    <div>
      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">{dateLabel}</p>
        <button onClick={goPractice} className="text-sm font-semibold text-muted underline-offset-4 hover:text-ink hover:underline">
          Practice →
        </button>
      </div>
      <WhoAmI
        key={`daily:${day}`}
        deck={dailyDeck}
        bios={data.players}
        answer={dailyId}
        storageKey={`cricket:${day}`}
        day={day}
        onFinish={onFinishDaily}
        onNext={goPractice}
        nextLabel="Play a practice round"
      />
    </div>
  ) : (
    <div>
      <button onClick={() => setRound('daily')} className="mb-4 text-sm font-semibold text-muted underline-offset-4 hover:text-ink hover:underline">
        ← Back to daily #{day + 1}
      </button>
      <div className="-mx-4 mb-5 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none]">
        {SHOWDOWN_FORMATS.map((f) => (
          <button
            key={f}
            onClick={() => pickFormat(f)}
            aria-pressed={format === f}
            className={`shrink-0 rounded-full border px-3.5 py-1.5 text-sm font-semibold transition ${
              format === f ? 'border-ink bg-ink text-bg' : 'border-line bg-surface text-muted hover:text-ink'
            }`}
          >
            {f}
            <span className="ml-1.5 text-xs opacity-60">{deckOf(f).cards.length}</span>
          </button>
        ))}
      </div>
      {practice && (
        <WhoAmI
          key={`practice:${practice.n}`}
          deck={deckOf(practice.format)}
          bios={data.players}
          answer={practice.id}
          onNext={() => nextPractice()}
          nextLabel="Next player"
        />
      )}
    </div>
  )
}

function pickRandom<T>(items: T[]): T {
  return items[Math.floor(Math.random() * items.length)]
}
