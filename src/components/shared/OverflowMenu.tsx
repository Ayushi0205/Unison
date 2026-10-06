import { useState, useRef, useEffect } from 'react'

export interface OverflowMenuItem {
  label: string
  onClick: () => void
  /** Renders the item in red, for destructive actions like Delete. */
  destructive?: boolean
}

/**
 * Small "..." overflow menu used in editor page headers.
 * Matches the pattern in the designer's `Screenshot_7.12.00` (editable page header).
 *
 * Renders an icon-only button (three vertical dots) that opens a small dropdown
 * with the provided items. Outside-click and Escape dismiss it.
 */
export function OverflowMenu({ items }: { items: OverflowMenuItem[] }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    document.addEventListener('keydown', handleKey)
    return () => {
      document.removeEventListener('mousedown', handleClick)
      document.removeEventListener('keydown', handleKey)
    }
  }, [open])

  if (items.length === 0) return null

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="true"
        aria-expanded={open}
        aria-label="More actions"
        className="w-9 h-9 inline-flex items-center justify-center rounded-md border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 transition-colors"
      >
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <circle cx="12" cy="5" r="1.5" />
          <circle cx="12" cy="12" r="1.5" />
          <circle cx="12" cy="19" r="1.5" />
        </svg>
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 min-w-[180px] bg-white border border-gray-200 rounded-md shadow-lg py-1 z-50">
          {items.map((item, i) => (
            <button
              key={i}
              type="button"
              onClick={() => {
                setOpen(false)
                item.onClick()
              }}
              className={`w-full text-left px-3 py-2 text-sm transition-colors ${
                item.destructive
                  ? 'text-red-600 hover:bg-red-50'
                  : 'text-gray-700 hover:bg-gray-50'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
