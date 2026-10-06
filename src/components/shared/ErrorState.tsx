interface ErrorStateProps {
  message?: string
  onRetry?: () => void
}

/**
 * Error state shown when a page fails to load.
 * Matches `Screenshot_7.56.00` from the designer's spec:
 * - Ghost icon
 * - "There's a problem loading this page" heading
 * - Description text
 * - Outlined "Reload page" button (secondary, not primary)
 */
export function ErrorState({ message, onRetry }: ErrorStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      {/* Ghost outline icon — matches designer's reference for error-on-load state. */}
      <svg className="w-16 h-16 text-gray-300 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75c0 .414-.336.75-.75.75s-.75-.336-.75-.75.336-.75.75-.75.75.336.75.75zM16.5 12.75c0 .414-.336.75-.75.75s-.75-.336-.75-.75.336-.75.75-.75.75.336.75.75zM4 21V8a8 8 0 1116 0v13l-2.5-2-2.5 2-2.5-2-2.5 2-2.5-2L4 21z" />
      </svg>
      <h3 className="text-lg font-medium text-gray-900 mb-1">There's a problem loading this page</h3>
      <p className="text-sm text-gray-500 mb-5 max-w-md">
        {message || 'Technical problem has prevented this page from loading. Please try reloading this page.'}
      </p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded-md text-sm font-medium hover:bg-gray-50 transition-colors"
        >
          Reload page
        </button>
      )}
    </div>
  )
}
