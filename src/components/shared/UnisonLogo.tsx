interface Props {
  height?: number
  showWordmark?: boolean
}

// Unison mark: two voices (arcs) resolving into one line.
export function UnisonMark({ size = 24 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden="true">
      <rect width="32" height="32" rx="8" fill="#0F6E56" />
      <path d="M9 9v7a7 7 0 0 0 14 0V9" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" />
      <path d="M13.5 9v7a2.5 2.5 0 0 0 5 0V9" stroke="#FAC775" strokeWidth="2.6" strokeLinecap="round" />
    </svg>
  )
}

export function UnisonLogo({ height = 24, showWordmark = true }: Props) {
  return (
    <span className="inline-flex items-center gap-2" aria-label="Unison">
      <UnisonMark size={height} />
      {showWordmark && (
        <span className="font-semibold tracking-tight text-ink" style={{ fontSize: Math.round(height * 0.7) }}>
          Unison
        </span>
      )}
    </span>
  )
}
