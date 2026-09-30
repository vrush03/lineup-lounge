import { useId, useMemo, useState } from 'react'
import { suggest } from '../lib/quiz'

type Props = {
  /** Names to suggest; omit for a number answer. */
  names?: string[]
  /** For a number answer: its unit, shown in the field. */
  unit?: string
  /** Footer text under the field, e.g. how close a number must be. */
  note: string
  onSubmit: (guess: string) => void
  /** Bumped after a wrong guess to shake the field. */
  shake: number
  tries: number
}

/** Answer box: free text with name suggestions (ARIA combobox), or a number. */
export function AnswerInput({ names, unit, note, onSubmit, shake, tries }: Props) {
  const numeric = !names
  const [text, setText] = useState('')
  const [active, setActive] = useState(-1)
  const [open, setOpen] = useState(true)
  const options = useMemo(() => (open && names ? suggest(names, text) : []), [names, text, open])
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
          <div className="relative min-w-0 flex-1">
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
              {...(numeric
                ? { inputMode: 'decimal' as const, placeholder: 'Your estimate' }
                : {
                    role: 'combobox',
                    'aria-expanded': options.length > 0,
                    'aria-controls': list,
                    'aria-autocomplete': 'list' as const,
                    'aria-activedescendant': active >= 0 ? `${list}-${active}` : undefined,
                    autoCapitalize: 'words',
                    placeholder: 'Type a player or team',
                  })}
              aria-label={numeric ? `Your estimate${unit ? ` in ${unit}` : ''}` : 'Your answer'}
              autoComplete="off"
              spellCheck={false}
              className="w-full rounded-2xl border border-line bg-surface px-4 py-3.5 text-base font-medium shadow-[var(--shadow)] outline-none placeholder:text-muted/70 focus:border-pitch"
              style={unit ? { paddingRight: `${unit.length * 0.55 + 1.75}em` } : undefined}
            />
            {unit && (
              <span aria-hidden className="pointer-events-none absolute inset-y-0 right-4 flex items-center text-sm font-semibold text-muted">
                {unit}
              </span>
            )}
          </div>
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
        {!numeric && (tries === 1 ? 'Last try. ' : '2 tries per question. ')}
        {note}
      </p>
    </form>
  )
}
