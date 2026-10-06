import { Fragment, useEffect, useLayoutEffect, useRef, useState } from 'react'

/**
 * Active-filter item passed in. `key` must be unique per chip — group identity
 * for multi-select filters comes from `label` (e.g. all "Tag" rows are grouped).
 */
export type AppliedFilterItem = {
  key: string
  label: string
  value: string
  onRemove: () => void
}

type Props = {
  filters: AppliedFilterItem[]
  onClearAll: () => void
}

/**
 * Applied filters bar — designer DF2 spec (screenshot references):
 *
 *   LABEL (Value ×) | LABEL (Value ×) | TAGS (A ×) (B ×) (C ×)
 *
 *   - Label = uppercase muted gray, floats outside any box.
 *   - Value = rounded-full gray pill with × to remove.
 *   - Multi-value filters (e.g. Tag) stay as multiple pills under one label;
 *     individual pills wrap independently when the row is full.
 *   - Vertical `|` separator between groups.
 *   - Collapse chevron sits left of the "Applied filters (N)" header. Appears
 *     only when chips wrap to 2+ lines. Collapsed → single line; expanded → all.
 *
 * Implementation note: the chip row is a flat flex-wrap of mixed elements
 * (label+first-pill, follow-up pills, separators) so that pills within a
 * multi-value group can break across lines individually.
 */
export function AppliedFiltersBar({ filters, onClearAll }: Props) {
  // Group by label so each filter category renders as one logical section.
  const grouped: { label: string; items: AppliedFilterItem[] }[] = []
  for (const f of filters) {
    const existing = grouped.find((g) => g.label === f.label)
    if (existing) existing.items.push(f)
    else grouped.push({ label: f.label, items: [f] })
  }

  const chipsRef = useRef<HTMLDivElement | null>(null)
  const [wraps, setWraps] = useState(false)
  const [collapsed, setCollapsed] = useState(false)
  const [lineHeight, setLineHeight] = useState<number>(0)

  // Measure after layout — if chips exceed one row height, show the collapse arrow.
  useLayoutEffect(() => {
    const el = chipsRef.current
    if (!el) return
    const measure = () => {
      const firstChild = el.firstElementChild as HTMLElement | null
      const rowHeight = firstChild?.offsetHeight ?? 0
      setLineHeight(rowHeight)
      // 2px slack to absorb sub-pixel rounding.
      setWraps(el.scrollHeight > rowHeight + 2)
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [filters.length, grouped.length])

  // If chips collapse back to one line (user removed filters), drop collapsed state.
  useEffect(() => {
    if (!wraps && collapsed) setCollapsed(false)
  }, [wraps, collapsed])

  if (filters.length === 0) return null

  const ChipPill = ({ it }: { it: AppliedFilterItem }) => (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-gray-100 text-sm text-gray-900">
      {it.value}
      <button
        onClick={it.onRemove}
        className="text-gray-500 hover:text-gray-800 leading-none"
        aria-label={`Remove ${it.label} ${it.value}`}
      >×</button>
    </span>
  )

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-sm">
        {wraps && (
          <button
            onClick={() => setCollapsed((c) => !c)}
            className="inline-flex items-center justify-center w-5 h-5 text-gray-600 hover:text-gray-900"
            aria-label={collapsed ? 'Expand applied filters' : 'Collapse applied filters'}
          >
            <svg
              className={`w-4 h-4 transition-transform ${collapsed ? '-rotate-90' : ''}`}
              fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </button>
        )}
        <span className="text-gray-900 font-medium">Applied filters ({filters.length})</span>
        <button
          onClick={onClearAll}
          className="text-primary font-medium hover:underline"
        >
          Clear all
        </button>
      </div>
      <div
        ref={chipsRef}
        className="flex items-center gap-x-2 gap-y-2 flex-wrap"
        style={collapsed && lineHeight ? { maxHeight: lineHeight, overflow: 'hidden' } : undefined}
      >
        {grouped.map((group, gi) => (
          <Fragment key={group.label}>
            {/* Label + first pill — atomic so the label never wraps alone. */}
            <span className="inline-flex items-center gap-2">
              <span className="text-[11px] font-medium uppercase tracking-wide text-gray-500">
                {group.label}
              </span>
              <ChipPill it={group.items[0]} />
            </span>
            {/* Remaining pills in the group — each its own flex-wrap sibling so
                they can break across lines individually. */}
            {group.items.slice(1).map((it) => (
              <ChipPill key={it.key} it={it} />
            ))}
            {/* Separator after each group except the last. */}
            {gi < grouped.length - 1 && (
              <span className="w-px h-5 bg-gray-300" aria-hidden="true" />
            )}
          </Fragment>
        ))}
      </div>
    </div>
  )
}
