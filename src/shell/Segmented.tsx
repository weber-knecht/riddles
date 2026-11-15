export interface SegmentedProps<T extends string> {
  options: readonly { id: T; label: string }[]
  value: T
  onChange(value: T): void
  /** Accessible name of the group. */
  label: string
  /** Short printed word in front of the options. */
  caption: string
}

// Two hand-drawn ellipses, so neighbouring circles do not look stamped.
const CIRCLES = [
  'M12 24C10 10 38 4 62 5c22 1 34 8 32 19-2 12-26 17-50 16C22 39 6 35 9 21c2-8 12-13 24-15',
  'M10 20C12 8 40 3 64 6c20 2 32 9 29 20-3 11-28 15-52 13C20 37 5 32 8 19c2-7 14-12 27-13',
]

/** One row of printed options. The chosen one is circled in pen. */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  label,
  caption,
}: SegmentedProps<T>) {
  return (
    <div class="choice" role="group" aria-label={label}>
      <span class="caption">{caption}</span>
      {options.map((o, i) => (
        <button
          key={o.id}
          type="button"
          aria-pressed={o.id === value}
          onClick={() => onChange(o.id)}
        >
          {o.label}
          {o.id === value && (
            <svg aria-hidden="true" viewBox="0 0 100 44" preserveAspectRatio="none">
              <path d={CIRCLES[i % CIRCLES.length]} vector-effect="non-scaling-stroke" />
            </svg>
          )}
        </button>
      ))}
    </div>
  )
}
