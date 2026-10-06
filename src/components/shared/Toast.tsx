import { createContext, useCallback, useContext, useRef, useState } from 'react'

type ToastVariant = 'success' | 'info' | 'destructive'

interface ToastItem {
  id: number
  title?: string
  message: string
  variant: ToastVariant
}

interface ToastCtx {
  /**
   * Show a toast. Accepts either:
   * - a single message string (variant defaults to 'success'), or
   * - a structured object `{ title, message, variant }` for richer notifications
   *   matching the designer's spec (Screenshot_7.50.08 / 7.52.51).
   */
  show: (
    messageOrOptions: string | { title?: string; message: string; variant?: ToastVariant },
    variant?: ToastVariant,
  ) => void
}

const ToastContext = createContext<ToastCtx | null>(null)

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used within ToastProvider')
  return ctx
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([])
  const idRef = useRef(0)

  const show = useCallback(
    (
      messageOrOptions: string | { title?: string; message: string; variant?: ToastVariant },
      variantArg?: ToastVariant,
    ) => {
      const id = ++idRef.current
      const item: ToastItem =
        typeof messageOrOptions === 'string'
          ? { id, message: messageOrOptions, variant: variantArg ?? 'success' }
          : {
              id,
              title: messageOrOptions.title,
              message: messageOrOptions.message,
              variant: messageOrOptions.variant ?? 'success',
            }
      setItems((prev) => [...prev, item])
      setTimeout(() => {
        setItems((prev) => prev.filter((t) => t.id !== id))
      }, 4000)
    },
    [],
  )

  return (
    <ToastContext.Provider value={{ show }}>
      {children}
      {/* Top-right per designer's spec ("Alert should appear on top right corner"). */}
      <div className="fixed top-4 right-4 z-50 space-y-2 pointer-events-none">
        {items.map((t) => (
          <ToastView key={t.id} item={t} onClose={() => setItems((prev) => prev.filter((p) => p.id !== t.id))} />
        ))}
      </div>
    </ToastContext.Provider>
  )
}

const VARIANT_STYLES: Record<ToastVariant, { border: string; iconColor: string; titleColor: string }> = {
  success: { border: 'border-l-green-600', iconColor: 'text-green-600', titleColor: 'text-green-700' },
  info: { border: 'border-l-blue-500', iconColor: 'text-blue-500', titleColor: 'text-blue-700' },
  destructive: { border: 'border-l-red-600', iconColor: 'text-red-600', titleColor: 'text-red-700' },
}

function VariantIcon({ variant }: { variant: ToastVariant }) {
  if (variant === 'success') {
    return (
      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path fillRule="evenodd" d="M12 2.25a9.75 9.75 0 100 19.5 9.75 9.75 0 000-19.5zm4.28 7.97a.75.75 0 00-1.06-1.06l-5.47 5.47-2.47-2.47a.75.75 0 10-1.06 1.06l3 3a.75.75 0 001.06 0l6-6z" clipRule="evenodd" />
      </svg>
    )
  }
  // info + destructive use a filled triangle warning per designer's reference.
  return (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M19.8199 17.2226C20.3326 18.1113 19.6891 19.2222 18.665 19.2222H5.33484C4.30881 19.2222 3.6682 18.1096 4.17992 17.2226L10.8451 5.66625C11.3581 4.77711 12.6429 4.77872 13.1549 5.66625L19.8199 17.2226ZM12 14.8333C11.2943 14.8333 10.7222 15.4054 10.7222 16.1111C10.7222 16.8168 11.2943 17.3889 12 17.3889C12.7057 17.3889 13.2778 16.8168 13.2778 16.1111C13.2778 15.4054 12.7057 14.8333 12 14.8333ZM10.7869 10.2404L10.9929 14.0182C11.0026 14.1949 11.1487 14.3333 11.3258 14.3333H12.6743C12.8513 14.3333 12.9974 14.1949 13.0071 14.0182L13.2131 10.2404C13.2236 10.0494 13.0715 9.88889 12.8803 9.88889H11.1197C10.9285 9.88889 10.7765 10.0494 10.7869 10.2404Z" />
    </svg>
  )
}

function ToastView({ item, onClose }: { item: ToastItem; onClose: () => void }) {
  const styles = VARIANT_STYLES[item.variant]
  return (
    <div
      className={`pointer-events-auto flex items-start gap-3 bg-white border border-gray-200 border-l-4 ${styles.border} rounded-md shadow-lg pl-4 pr-4 py-3 min-w-[320px] max-w-md animate-[slide-down_0.2s_ease-out]`}
      role="status"
    >
      <div className={`shrink-0 ${styles.iconColor}`}>
        <VariantIcon variant={item.variant} />
      </div>
      <div className="flex-1 min-w-0">
        {item.title && (
          <div className={`text-sm font-semibold ${styles.titleColor}`}>{item.title}</div>
        )}
        <p className={`text-sm text-gray-700 ${item.title ? 'mt-0.5' : ''}`}>{item.message}</p>
      </div>
      <button onClick={onClose} className="shrink-0 text-gray-400 hover:text-gray-600 mt-0.5" aria-label="Dismiss">
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  )
}

// Keyframe used by the toast slide-down animation.
export function ToastStyles() {
  return (
    <style>{`
      @keyframes slide-down {
        from { opacity: 0; transform: translateY(-8px); }
        to { opacity: 1; transform: translateY(0); }
      }
    `}</style>
  )
}
