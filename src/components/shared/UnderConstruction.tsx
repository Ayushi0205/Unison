import { Link } from 'react-router-dom'

/**
 * "Under construction" state for placeholder pages.
 * Matches `Screenshot_7.56.15` from the designer's spec:
 * - Wrench icon
 * - "We're working on it" heading
 * - Description
 * - Green primary "Back to templates page" button
 */
export function UnderConstruction({
  backTo = '/templates',
  backLabel = 'Back to templates page',
}: {
  backTo?: string
  backLabel?: string
}) {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      {/* Wrench icon */}
      <svg className="w-16 h-16 text-gray-300 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M11.42 15.17L17.25 21A2.652 2.652 0 0021 17.25l-5.877-5.877M11.42 15.17l2.496-3.03c.317-.384.74-.626 1.208-.766M11.42 15.17l-4.655 5.653a2.548 2.548 0 11-3.586-3.586l6.837-5.63m5.108-.233c.55-.164 1.163-.188 1.743-.14a4.5 4.5 0 004.486-6.336l-3.276 3.277a3.004 3.004 0 01-2.25-2.25l3.276-3.276a4.5 4.5 0 00-6.336 4.486c.091 1.076-.071 2.264-.904 2.95l-.102.085m-1.745 1.437L5.909 7.5H4.5L2.25 3.75l1.5-1.5L7.5 4.5v1.409l4.26 4.26m-1.745 1.437l1.745-1.437" />
      </svg>
      <h3 className="text-lg font-medium text-gray-900 mb-1">We're working on it</h3>
      <p className="text-sm text-gray-500 mb-5 max-w-md">
        This page is currently under construction. Please check back soon.
      </p>
      <Link
        to={backTo}
        className="bg-primary text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-primary-hover transition-colors"
      >
        {backLabel}
      </Link>
    </div>
  )
}
