import { useState, useRef, useEffect } from 'react'
import { useCurrentUser } from '../../hooks/useCurrentUser'
import { UnisonLogo } from '../shared/UnisonLogo'
import { DemoMenu } from './DemoMenu'

// Capitalise the role label (e.g. "admin" → "Admin")
function formatRole(role: string): string {
  return role.charAt(0).toUpperCase() + role.slice(1)
}

export function TopBar() {
  const { user } = useCurrentUser()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  return (
    <header className="h-14 border-b border-gray-200 bg-white px-4 flex items-center justify-between shrink-0 z-20">
      {/* Left: product logo + workspace */}
      <div className="flex items-center gap-3">
        <UnisonLogo height={24} />
        <span className="text-gray-300">/</span>
        <span className="text-sm text-gray-600">Meridian Works</span>
        <DemoMenu />
      </div>

      {/* Right: user popout chip */}
      <div className="relative" ref={ref}>
        <button
          onClick={() => setOpen(!open)}
          className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-gray-50 transition-colors"
          aria-haspopup="true"
          aria-expanded={open}
        >
          <span className="text-sm text-gray-900">{user.name}</span>
          <span className={`w-7 h-7 rounded-full inline-flex items-center justify-center transition-colors ${open ? 'bg-gray-100' : ''}`}>
            <svg
              className={`w-4 h-4 text-gray-600 transition-transform ${open ? 'rotate-180' : ''}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </span>
        </button>

        {open && (
          <div className="absolute right-0 top-full mt-2 w-72 bg-white border border-gray-200 rounded-lg shadow-lg py-6 px-4 z-50">
            {/* Name */}
            <div className="text-base font-semibold text-gray-900">{user.name}</div>
            {/* Email */}
            <div className="text-sm text-gray-500 mt-1">{user.email}</div>
            {/* Role */}
            <div className="text-sm text-gray-500 mt-3">{formatRole(user.role)}</div>

          </div>
        )}
      </div>
    </header>
  )
}
