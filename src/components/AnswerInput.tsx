import { useId, useMemo, useState } from 'react'
import { suggest } from '../lib/quiz'

type Props = {
  names: string[]
  onSubmit: (guess: string) => void
  /** Bumped after a wrong guess to shake the field. */
  shake: number
  tries: number
}

/** Free-text answer box with name suggestions (ARIA combobox). */
export function AnswerInput({ names, onSubmit, shake, tries }: Props) {
  const [text, setText] = useState('')
  const [active, setActive] = useState(-1)
  const [open, setOpen] = useState(true)
  const options = useMemo(() => (open ? suggest(names, text) : []), [names, text, open])
  const list = useId()

  function submit(guess: string) {
    if (!guess.trim()) return
    onSubmit(guess.trim())
    setText('')
    setActive(-1)
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'ArrowDown' && options.length) {
      e.preventDefault()
      setActive((a) => (a + 1) % options.length)
    } else if (e.key === 'ArrowUp' && options.length) {
      e.preventDefault()
      setActive((a) => (a <= 0 ? options.length - 1 : a - 1))
    } else if (e.key === 'Escape') {
      setOpen(false)
      setActive(-1)
    } else if (e.key === 'Enter') {
      e.preventDefault()
      submit(active >= 0 ? options[active] : text)
    }
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        submit(text)
      }}
    >
      <div className="relative">
        <div key={shake} className={`flex gap-2 ${shake ? 'animate-shake' : ''}`}>
          <input
            autoFocus
            value={text}
            onChange={(e) => {
              setText(e.target.value)
              setActive(-1)
              setOpen(true)
            }}
            onKeyDown={onKeyDown}
            onBlur={() => setOpen(false)}
            onFocus={() => setOpen(true)}
            role="combobox"
            aria-label="Your answer"
            aria-expanded={options.length > 0}
            aria-controls={list}
            aria-autocomplete="list"
            aria-activedescendant={active >= 0 ? `${list}-${active}` : undefined}
            autoComplete="off"
            autoCapitalize="words"
            spellCheck={false}
            placeholder="Type a player or team"
            className="min-w-0 flex-1 rounded-2xl border border-line bg-surface px-4 py-3.5 text-base font-medium shadow-[var(--shadow)] outline-none placeholder:text-muted/70 focus:border-pitch"
          />
          <button
            type="submit"
            disabled={!text.trim()}
            className="shrink-0 rounded-2xl bg-pitch-deep px-5 font-display text-lg font-bold uppercase tracking-wider text-white shadow-lg shadow-pitch-deep/25 transition hover:bg-pitch active:scale-[0.98] disabled:opacity-40"
          >
            Answer
          </button>
        </div>
        {options.length > 0 && (
          <ul
            id={list}
            role="listbox"
            className="absolute inset-x-0 top-full z-10 mt-1.5 overflow-hidden rounded-2xl border border-line bg-surface py-1 shadow-xl"
          >
            {options.map((name, i) => (
              <li
                key={name}
                id={`${list}-${i}`}
                role="option"
                aria-selected={i === active}
                // mousedown, not click: the input's blur would close the list before a click lands
                onMouseDown={(e) => {
                  e.preventDefault()
                  submit(name)
                }}
                onMouseEnter={() => setActive(i)}
                className={`cursor-pointer px-4 py-2.5 text-[15px] ${i === active ? 'bg-pitch/12 text-ink' : 'text-ink'}`}
              >
                {name}
              </li>
            ))}
          </ul>
        )}
      </div>
      <p className="mt-2 text-xs text-muted">
        {tries === 1 ? 'Last try.' : '2 tries per question.'} Pick a suggestion or type the name.
      </p>
    </form>
  )
}
