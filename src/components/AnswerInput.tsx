import { useState } from 'react'

type Props = {
  /** Its unit, shown in the field. */
  unit?: string
  /** The full keyboard, so suffixes like "25k" or "1.5 lakh" can be typed. */
  words?: boolean
  /** Footer text under the field, e.g. how close a guess must be. */
  note: string
  onSubmit: (guess: string) => void
  /** Bumped after a wrong guess to shake the field. */
  shake: number
}

/** The number box for a Ballpark guess. */
export function AnswerInput({ unit, words, note, onSubmit, shake }: Props) {
  const [text, setText] = useState('')

  function submit(guess: string) {
    if (!guess.trim()) return
    onSubmit(guess.trim())
    setText('')
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        submit(text)
      }}
    >
      <div>
        <div key={shake} className={`flex gap-2 ${shake ? 'animate-shake' : ''}`}>
          <div className="relative min-w-0 flex-1">
            <input
              autoFocus
              value={text}
              onChange={(e) => setText(e.target.value)}
              inputMode={words ? 'text' : 'decimal'}
              placeholder="Your estimate"
              aria-label={`Your estimate${unit ? ` in ${unit}` : ''}`}
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
      </div>
      <p className="mt-2 text-xs text-muted">{note}</p>
    </form>
  )
}
