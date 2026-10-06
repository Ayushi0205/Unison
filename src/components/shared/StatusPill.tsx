import type { Lifecycle } from '../../data/taxonomy'

/**
 * Status badge - matches designer's May 28 review palette:
 * - ACTIVE: pale green fill + deep forest-green text
 * - DRAFT: white fill + medium gray border + dark gray text
 * - INACTIVE: light gray fill + medium gray text
 * Pill shape (rounded-full), all-caps text.
 */
const PILL_STYLES: Record<Lifecycle, string> = {
  Active: 'bg-primary-tint text-primary-strong',
  Draft: 'bg-white border border-gray-400 text-gray-700',
  Inactive: 'bg-gray-200 text-gray-500',
}

export function StatusPill({ status }: { status: Lifecycle }) {
  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold uppercase tracking-wide ${PILL_STYLES[status]}`}
    >
      {status}
    </span>
  )
}
