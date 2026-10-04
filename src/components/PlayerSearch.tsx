import { useId, useState } from 'react'
import { search } from '../lib/whoami'
import type { Card, Deck } from '../lib/types'

type Props = {
  deck: Deck
  /** Card ids already guessed, left out of the suggestions. */
  exclude: string[]
  onGuess: (card: Card) => void
}

/** Type-ahead over one deck's players: every guess is somebody who has a card in this format. */
export function PlayerSearch({ deck, exclude, onGuess }: Props) {
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)
  const list = useId()
  const matches = search(deck, query, exclude)
  const index = Math.min(active, matches.length - 1)

  function choose(card: Card) {
    setQuery('')
    setActive(0)
    onGuess(card)
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (!matches.length) return
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault()
      setActive((index + (e.key === 'ArrowDown' ? 1 : matches.length - 1)) % matches.length)
    } else if (e.key === 'Enter') {
      e.preventDefault()
      choose(matches[index])
    } else if (e.key === 'Escape') setQuery('')
  }

  return (
    <div className="relative">
      <input
        type="text"
        role="combobox"
        aria-label={`Guess the player: search the ${deck.format} deck`}
        aria-expanded={matches.length > 0}
        aria-controls={list}
        aria-activedescendant={matches.length ? `${list}-${index}` : undefined}
        aria-autocomplete="list"
        autoComplete="off"
        autoCorrect="off"
        spellCheck={false}
        enterKeyHint="search"
        placeholder="Type a player’s name"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value)
          setActive(0)
        }}
        onKeyDown={onKeyDown}
        className="w-full rounded-xl border border-line bg-surface px-4 py-3 text-base font-semibold shadow-[var(--shadow)] placeholder:font-normal placeholder:text-muted focus:border-pitch focus:outline-none"
      />
      {query.trim() && (
        <ul
          id={list}
          role="listbox"
          aria-label="Matching players"
          className="absolute inset-x-0 top-full z-20 mt-1 max-h-72 overflow-y-auto rounded-xl border border-line bg-surface py-1 shadow-2xl"
        >
          {matches.map((c, i) => (
            <li
              key={c.id}
              id={`${list}-${i}`}
              role="option"
              aria-selected={i === index}
              // mousedown, so the pick lands before the input loses focus.
              onMouseDown={(e) => {
                e.preventDefault()
                choose(c)
              }}
              onMouseEnter={() => setActive(i)}
              className={`cursor-pointer px-4 py-2.5 text-sm font-semibold ${i === index ? 'bg-pitch text-white' : 'text-ink'}`}
            >
              {c.name}
            </li>
          ))}
          {!matches.length && <li className="px-4 py-2.5 text-sm text-muted">Nobody by that name in the {deck.format} deck.</li>}
        </ul>
      )}
    </div>
  )
}
