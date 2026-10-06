import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { RotateCcw, Users } from 'lucide-react'
import { ConfirmModal } from '../shared/ConfirmModal'
import { resetDemo } from '../../data/demo-store'

/** Top-bar "Demo" pill: the single home for demo-only controls. */
export function DemoMenu() {
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const itemClass = 'w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-sm text-gray-700 hover:bg-gray-50 transition-colors'

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-haspopup="true"
        aria-expanded={open}
        className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border transition-colors ${
          open ? 'bg-accent-tint border-accent/40 text-accent-text' : 'bg-accent-tint/60 border-accent/25 text-accent-text hover:bg-accent-tint'
        }`}
      >
        Demo
      </button>

      {open && (
        <div className="absolute left-0 top-full mt-2 w-64 bg-white border border-gray-200 rounded-lg shadow-lg p-1.5 z-50">
          <p className="px-3 pt-2 pb-2.5 text-xs text-gray-500 border-b border-gray-100 mb-1">
            Sample data. Changes stay in this browser.
          </p>
          <button
            type="button"
            className={itemClass}
            onClick={() => {
              setOpen(false)
              navigate('/login')
            }}
          >
            <Users className="w-4 h-4 text-gray-400" aria-hidden="true" />
            Switch role
          </button>
          <button
            type="button"
            className={itemClass}
            onClick={() => {
              setOpen(false)
              setConfirmOpen(true)
            }}
          >
            <RotateCcw className="w-4 h-4 text-gray-400" aria-hidden="true" />
            Reset demo data
          </button>
        </div>
      )}

      <ConfirmModal
        open={confirmOpen}
        title="Reset demo data?"
        body="This restores the original sample templates, partials, rules, and projects. Your changes in this browser will be lost."
        confirmLabel="Reset demo data"
        variant="destructive"
        onConfirm={resetDemo}
        onCancel={() => setConfirmOpen(false)}
      />
    </div>
  )
}
