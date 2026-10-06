import type { ReactNode } from 'react'

export type TooltipPlacement = 'top' | 'bottom' | 'left' | 'right'

/**
 * Reusable hover-revealed tooltip. CSS-driven (no JS state) so it works
 * cleanly on disabled buttons and any wrapped element.
 *
 * Usage:
 *   <Tooltip label="Edit">
 *     <button>...</button>
 *   </Tooltip>
 *
 * Visual: dark gray-900 background, white text, small arrow, fade in on hover.
 */
export function Tooltip({
  label, children, placement = 'bottom', align = 'center',
}: {
  label: ReactNode
  children: ReactNode
  placement?: TooltipPlacement
  /** Horizontal alignment when placement is top/bottom. Defaults to 'center'. */
  align?: 'start' | 'center' | 'end'
}) {
  // Position classes for the popover element
  const positionClass = (() => {
    if (placement === 'top') return 'bottom-full mb-1.5'
    if (placement === 'bottom') return 'top-full mt-1.5'
    if (placement === 'left') return 'right-full mr-1.5 top-1/2 -translate-y-1/2'
    return 'left-full ml-1.5 top-1/2 -translate-y-1/2' // right
  })()

  const alignClass = (() => {
    if (placement === 'left' || placement === 'right') return ''
    if (align === 'start') return 'left-0'
    if (align === 'end') return 'right-0'
    return 'left-1/2 -translate-x-1/2'
  })()

  // Per designer feedback: tooltip shape matches a clean rounded rectangle —
  // no arrow, slightly larger padding, slightly larger text. Same shape for
  // every placement so the visual is consistent across the app.
  return (
    <span className="relative group inline-flex">
      {children}
      <span
        role="tooltip"
        className={`pointer-events-none absolute z-50 px-3 py-2 bg-gray-900 text-white text-sm font-normal whitespace-nowrap rounded-md shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-opacity ${positionClass} ${alignClass}`}
      >
        {label}
      </span>
    </span>
  )
}
