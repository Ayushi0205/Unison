import { useState, useRef, useEffect, useMemo } from 'react'
import { TEMPLATES } from '../../data/templates'

interface Props {
  value: string[]
  onChange: (tags: string[]) => void
}

export function TagsFilter({ value, onChange }: Props) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const ref = useRef<HTMLDivElement>(null)

  const allTags = useMemo(() => {
    const set = new Set<string>()
    TEMPLATES.forEach((t) => t.tags.forEach((tag) => set.add(tag)))
    return Array.from(set).sort()
  }, [])

  const filtered = allTags.filter(
    (t) => !value.includes(t) && t.toLowerCase().includes(query.toLowerCase())
  )

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
        setQuery('')
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const addTag = (tag: string) => {
    onChange([...value, tag])
    setQuery('')
  }

  const removeTag = (tag: string) => {
    onChange(value.filter((t) => t !== tag))
  }

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="h-10 border border-gray-300 rounded-md text-sm px-3 bg-white min-w-[140px] flex items-center gap-2 hover:bg-gray-50 transition-colors"
      >
        {value.length === 0 ? (
          <span className="text-gray-500 italic">All tags</span>
        ) : (
          <span className="text-gray-900">
            {value.length === 1 ? value[0] : `${value.length} tags`}
          </span>
        )}
        <svg className="w-4 h-4 text-gray-400 ml-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="absolute left-0 top-full mt-1 w-64 bg-white border border-gray-200 rounded-lg shadow-lg z-50">
          {value.length > 0 && (
            <div className="px-3 py-2 border-b border-gray-100 flex flex-wrap gap-1">
              {value.map((tag) => (
                <span key={tag} className="inline-flex items-center gap-1 px-2 py-0.5 bg-primary/10 text-primary text-xs rounded">
                  {tag}
                  <button onClick={() => removeTag(tag)} className="text-primary/60 hover:text-primary">×</button>
                </span>
              ))}
            </div>
          )}
          <div className="px-3 py-2 border-b border-gray-100">
            <input
              autoFocus
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Find a tag…"
              className="w-full h-8 text-sm border border-gray-200 rounded px-2 placeholder:italic focus:outline-none focus:ring-1 focus:ring-primary/30 focus:border-primary"
            />
          </div>
          <div className="max-h-60 overflow-y-auto py-1">
            {filtered.length === 0 ? (
              <div className="px-3 py-3 text-xs text-gray-400 italic">
                {query ? 'No matching tags' : 'All tags selected'}
              </div>
            ) : (
              filtered.map((tag) => (
                <button
                  key={tag}
                  onClick={() => addTag(tag)}
                  className="w-full text-left px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
                >
                  {tag}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
