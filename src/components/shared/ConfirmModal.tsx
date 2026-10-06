import { useEffect } from 'react'

export interface ConfirmModalProps {
  open: boolean
  title: string
  body: React.ReactNode
  confirmLabel?: string
  cancelLabel?: string
  variant?: 'destructive' | 'primary'
  onConfirm: () => void
  onCancel: () => void
}

export function ConfirmModal({
  open, title, body, confirmLabel = 'Confirm', cancelLabel = 'Cancel',
  variant = 'primary', onConfirm, onCancel,
}: ConfirmModalProps) {
  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel()
      if (e.key === 'Enter') onConfirm()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open, onConfirm, onCancel])

  if (!open) return null

  const isDestructive = variant === 'destructive'
  const confirmClass = isDestructive
    ? 'bg-red-600 hover:bg-red-700 text-white'
    : 'bg-primary hover:bg-primary-hover text-white'

  return (
    <div className="fixed inset-0 z-50 bg-gray-900/30 flex items-center justify-center px-4" onClick={onCancel}>
      <div
        className="w-full max-w-md bg-white rounded-lg shadow-xl border border-gray-200"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        {/* Title row - destructive variant shows a red warning triangle (Screenshot_7.50.01). */}
        <div className="px-5 py-4 flex items-start gap-3">
          {isDestructive && (
            <div className="shrink-0 text-red-600 mt-0.5">
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M19.8199 17.2226C20.3326 18.1113 19.6891 19.2222 18.665 19.2222H5.33484C4.30881 19.2222 3.6682 18.1096 4.17992 17.2226L10.8451 5.66625C11.3581 4.77711 12.6429 4.77872 13.1549 5.66625L19.8199 17.2226ZM12 14.8333C11.2943 14.8333 10.7222 15.4054 10.7222 16.1111C10.7222 16.8168 11.2943 17.3889 12 17.3889C12.7057 17.3889 13.2778 16.8168 13.2778 16.1111C13.2778 15.4054 12.7057 14.8333 12 14.8333ZM10.7869 10.2404L10.9929 14.0182C11.0026 14.1949 11.1487 14.3333 11.3258 14.3333H12.6743C12.8513 14.3333 12.9974 14.1949 13.0071 14.0182L13.2131 10.2404C13.2236 10.0494 13.0715 9.88889 12.8803 9.88889H11.1197C10.9285 9.88889 10.7765 10.0494 10.7869 10.2404Z" />
              </svg>
            </div>
          )}
          <h3 className="text-base font-semibold text-gray-900">{title}</h3>
        </div>
        <div className="px-5 pb-4 text-sm text-gray-700">
          {body}
        </div>
        <div className="px-5 py-3 border-t border-gray-100 bg-gray-50 flex items-center justify-end gap-2 rounded-b-lg">
          <button
            onClick={onCancel}
            className="px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            className={`px-4 py-1.5 text-sm font-medium rounded-md ${confirmClass}`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
