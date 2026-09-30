/** The Daily / Practice switch shared by every mode. */
export function Tabs<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T
  options: [T, string][]
  onChange: (v: T) => void
}) {
  return (
    <nav className="grid grid-cols-2 rounded-2xl border border-line bg-surface-2 p-1" aria-label="Round">
      {options.map(([v, label]) => (
        <button
          key={v}
          onClick={() => onChange(v)}
          aria-pressed={value === v}
          className={`rounded-xl py-2 font-display text-base font-bold uppercase tracking-wider transition ${
            value === v ? 'bg-surface text-ink shadow-[var(--shadow)]' : 'text-muted hover:text-ink'
          }`}
        >
          {label}
        </button>
      ))}
    </nav>
  )
}
