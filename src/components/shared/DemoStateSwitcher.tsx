import { useEffect } from 'react'

export type DemoState = 'happy' | 'loading' | 'error' | 'empty'

const KEY = 'unison.showStates'
const LABELS: Record<DemoState, string> = { happy: 'Default', loading: 'Loading', error: 'Error', empty: 'Empty' }

/**
 * Lets reviewers preview loading, error, and empty states. Hidden unless the
 * app is opened with ?states=1 (linked from the case study); ?states=0 hides it again.
 * The choice is kept for the browser tab session so it survives navigation.
 */
function statesEnabled(): boolean {
  const param = new URLSearchParams(window.location.search).get('states')
  if (param === '1') sessionStorage.setItem(KEY, '1')
  if (param === '0') sessionStorage.removeItem(KEY)
  return sessionStorage.getItem(KEY) === '1'
}

export function DemoStateSwitcher({ value, onChange }: { value: DemoState; onChange: (s: DemoState) => void }) {
  const enabled = statesEnabled()

  // Leaving states mode mid-preview shouldn't strand the page in a fake state.
  useEffect(() => {
    if (!enabled && value !== 'happy') onChange('happy')
  }, [enabled, value, onChange])

  if (!enabled) return null

  return (
    <div className="fixed bottom-4 right-4 z-50">
      <details className="bg-white border border-gray-200 rounded-lg shadow-lg" open>
        <summary className="px-3 py-2 text-xs font-medium text-gray-500 cursor-pointer select-none hover:bg-gray-50">
          Preview states
        </summary>
        <div className="p-2 space-y-1 border-t border-gray-100">
          {(Object.keys(LABELS) as DemoState[]).map((s) => (
            <button
              key={s}
              onClick={() => onChange(s)}
              className={`block w-full text-left px-3 py-1.5 text-xs rounded ${value === s ? 'bg-primary-strong text-white' : 'text-gray-700 hover:bg-gray-50'}`}
            >
              {LABELS[s]}
            </button>
          ))}
        </div>
      </details>
    </div>
  )
}
