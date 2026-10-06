import { useState, useMemo, useEffect, useRef } from 'react'
import { Link, useSearchParams, useNavigate } from 'react-router-dom'
import { format } from 'date-fns'
import { PARTIALS, savePartial } from '../data/partials'
import { OWNING_TEAMS, PARTIAL_SECTIONS } from '../data/taxonomy'
import type { Partial } from '../data/types'
import { useCurrentUser } from '../hooks/useCurrentUser'
import { StatusPill } from '../components/shared/StatusPill'
import { Tooltip } from '../components/shared/Tooltip'
import { EmptyState } from '../components/shared/EmptyState'
import { LoadingSkeleton } from '../components/shared/LoadingSkeleton'
import { ErrorState } from '../components/shared/ErrorState'
import { ConfirmModal } from '../components/shared/ConfirmModal'
import { useToast } from '../components/shared/Toast'
import { FilterSelect } from '../components/shared/FilterSelect'
import { AppliedFiltersBar } from '../components/shared/AppliedFiltersBar'
import { Copy } from 'lucide-react'
import { DemoStateSwitcher } from '../components/shared/DemoStateSwitcher'

type SortField = 'name' | 'updatedAt' | 'usedInCount'
type SortDir = 'asc' | 'desc'


function emailToName(email: string) {
  const local = email.split('@')[0] || ''
  return local.split('.').map((s) => s.charAt(0).toUpperCase() + s.slice(1)).join(' ')
}

// Strip HTML tags for body preview / search matching
function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
}

// Renders text with the matched query substring visually emphasized.
function highlightMatch(text: string, query: string): React.ReactNode {
  if (!query) return text
  const lowerText = text.toLowerCase()
  const lowerQuery = query.toLowerCase()
  const idx = lowerText.indexOf(lowerQuery)
  if (idx < 0) return text
  return (
    <>
      {text.slice(0, idx)}
      <mark className="bg-amber-100 text-amber-900 rounded px-0.5">
        {text.slice(idx, idx + query.length)}
      </mark>
      {text.slice(idx + query.length)}
    </>
  )
}

export function PartialsPage() {
  const { user } = useCurrentUser()
  const toast = useToast()
  const [searchParams, setSearchParams] = useSearchParams()
  const [demoState, setDemoState] = useState<'happy' | 'loading' | 'error' | 'empty'>('happy')
  // Row-action state — which partial is being confirmed and for what action.
  // One modal at the page level keeps the implementation simple (only one
  // partial can be in confirm state at a time).
  const [rowAction, setRowAction] = useState<{ kind: 'duplicate' | 'deactivate'; partial: Partial } | null>(null)
  // Session-local lifecycle overrides so the table reflects deactivations.
  const [lifecycleOverrides, setLifecycleOverrides] = useState<Record<string, 'Active' | 'Inactive'>>({})
  // Session-local list of partials created via the Duplicate action so the
  // newly-copied row shows up at the top of the table immediately after
  // confirmation. Reset on page reload (no persistence in the mockup).
  const [duplicatedPartials, setDuplicatedPartials] = useState<Partial[]>([])

  const searchQ = searchParams.get('q') || ''
  // appliedSearch = committed search filter (set when user clicks a suggestion or
  // "See all results"). Decoupled from `q` (live typeahead) so the list doesn't
  // reactively filter on every keystroke.
  const appliedSearch = searchParams.get('qList') || ''
  const filterTeam = searchParams.get('team') || ''
  const filterSection = searchParams.get('section') || ''
  const filterStatus = searchParams.get('status') || ''
  const sortField = (searchParams.get('sort') as SortField) || 'updatedAt'
  const sortDir = (searchParams.get('dir') as SortDir) || 'desc'
  const page = parseInt(searchParams.get('page') || '1', 10)
  const pageSize = parseInt(searchParams.get('size') || '25', 10)

  const setParam = (key: string, value: string) => {
    const next = new URLSearchParams(searchParams)
    if (value) next.set(key, value)
    else next.delete(key)
    if (key !== 'page') next.delete('page')
    setSearchParams(next)
  }

  // Base list — structural filters only (team, section, status, sort).
  // The typeahead derives its suggestions from this so it isn't constrained by
  // a previously-applied search filter.
  const filteredBase = useMemo(() => {
    let items = [
      ...PARTIALS.map((p) =>
        lifecycleOverrides[p.id] ? { ...p, lifecycle: lifecycleOverrides[p.id] } : p,
      ),
    ]

    if (filterStatus) items = items.filter((p) => p.lifecycle === filterStatus)
    if (filterTeam) items = items.filter((p) => p.authoringTeam === filterTeam)
    if (filterSection) items = items.filter((p) => p.section === filterSection)

    items.sort((a, b) => {
      let cmp = 0
      if (sortField === 'name') cmp = a.name.localeCompare(b.name)
      else if (sortField === 'usedInCount') cmp = (a.usedInCount ?? 0) - (b.usedInCount ?? 0)
      else cmp = a.updatedAt.localeCompare(b.updatedAt)
      return sortDir === 'desc' ? -cmp : cmp
    })

    return items
  }, [filterTeam, filterSection, filterStatus, sortField, sortDir, lifecycleOverrides, duplicatedPartials])

  // Visible list — base + applied search (committed via dropdown, not live typing).
  const filtered = useMemo(() => {
    if (!appliedSearch) return filteredBase
    const q = appliedSearch.toLowerCase()
    return filteredBase.filter((p) =>
      p.name.toLowerCase().includes(q) ||
      stripHtml(p.body).toLowerCase().includes(q)
    )
  }, [filteredBase, appliedSearch])

  // ── Typeahead suggestions ────────────────────────────────────────────────
  const navigate = useNavigate()
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [highlightedIndex, setHighlightedIndex] = useState(-1)
  const searchContainerRef = useRef<HTMLDivElement>(null)

  const scoredMatches = useMemo(() => {
    if (searchQ.trim().length < 3) return []
    const q = searchQ.toLowerCase()
    return [...filteredBase]
      .map((p) => {
        const name = p.name.toLowerCase()
        const body = stripHtml(p.body).toLowerCase()
        let score = 0
        if (name.startsWith(q)) score = 4
        else if (name.includes(q)) score = 3
        else if (body.startsWith(q)) score = 2
        else if (body.includes(q)) score = 1
        return { partial: p, score }
      })
      .filter((m) => m.score > 0)
      .sort((a, b) => b.score - a.score)
  }, [searchQ, filteredBase])

  const suggestions = useMemo(() => scoredMatches.slice(0, 5).map((m) => m.partial), [scoredMatches])
  const matchCount = scoredMatches.length

  useEffect(() => {
    setHighlightedIndex(-1)
  }, [searchQ])

  useEffect(() => {
    if (!showSuggestions) return
    const handler = (e: MouseEvent) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target as Node)) {
        setShowSuggestions(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [showSuggestions])

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize))
  const paginated = filtered.slice((page - 1) * pageSize, page * pageSize)

  const activeFilters: { key: string; label: string; value: string; onRemove: () => void }[] = []
  if (filterTeam) activeFilters.push({ key: 'team', label: 'Team', value: filterTeam, onRemove: () => setParam('team', '') })
  if (filterSection) activeFilters.push({ key: 'section', label: 'Section', value: filterSection, onRemove: () => setParam('section', '') })
  if (filterStatus) activeFilters.push({ key: 'status', label: 'Status', value: filterStatus, onRemove: () => setParam('status', '') })
  if (appliedSearch) activeFilters.push({ key: 'qList', label: 'Search', value: appliedSearch, onRemove: () => setParam('qList', '') })

  const toggleSort = (field: SortField) => {
    if (sortField === field) setParam('dir', sortDir === 'asc' ? 'desc' : 'asc')
    else { setParam('sort', field); setParam('dir', field === 'usedInCount' ? 'asc' : 'desc') }
  }

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <span className="text-gray-300 ml-1">↕</span>
    return <span className="text-gray-600 ml-1">{sortDir === 'asc' ? '↑' : '↓'}</span>
  }

  const canEdit = user.role === 'admin' || user.role === 'editor'
  const isAdmin = user.role === 'admin'

  if (demoState === 'loading') return (
    <div className="space-y-5">
      <PageHeader isAdmin={isAdmin} />
      <LoadingSkeleton rows={6} />
    </div>
  )
  if (demoState === 'error') return (
    <div className="space-y-5">
      <PageHeader isAdmin={isAdmin} />
      <ErrorState message="Failed to load partials." onRetry={() => setDemoState('happy')} />
    </div>
  )

  return (
    <div className="space-y-5">
      <PageHeader isAdmin={isAdmin} />

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative" ref={searchContainerRef}>
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            placeholder="Search by name or content…"
            value={searchQ}
            onChange={(e) => {
              setParam('q', e.target.value)
              setShowSuggestions(true)
            }}
            onFocus={() => setShowSuggestions(true)}
            onKeyDown={(e) => {
              const hasSuggestions = showSuggestions && suggestions.length > 0

              if (e.key === 'ArrowDown' && hasSuggestions) {
                e.preventDefault()
                setHighlightedIndex((i) => Math.min(i + 1, suggestions.length - 1))
              } else if (e.key === 'ArrowUp' && hasSuggestions) {
                e.preventDefault()
                setHighlightedIndex((i) => Math.max(i - 1, -1))
              } else if (e.key === 'Enter') {
                e.preventDefault()
                if (hasSuggestions && highlightedIndex >= 0) {
                  // Explicit arrow-key highlight → navigate to that partial
                  const target = suggestions[highlightedIndex]
                  if (target) {
                    setShowSuggestions(false)
                    navigate(`/partials/${target.id}`)
                  }
                } else if (searchQ.trim().length > 0) {
                  // No highlight → apply as list filter
                  setParam('qList', searchQ)
                  setShowSuggestions(false)
                }
              } else if (e.key === 'Escape') {
                setShowSuggestions(false)
              }
            }}
            className="h-10 pl-9 pr-8 border border-gray-300 rounded-md text-sm w-64 placeholder:italic focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
          />
          {searchQ && (
            <button
              type="button"
              onClick={() => {
                const next = new URLSearchParams(searchParams)
                next.delete('q')
                next.delete('qList')
                setSearchParams(next)
                setShowSuggestions(false)
              }}
              aria-label="Clear search"
              className="absolute right-2 top-1/2 -translate-y-1/2 w-5 h-5 inline-flex items-center justify-center rounded text-gray-400 hover:text-gray-700 hover:bg-gray-100"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}

          {/* Typeahead dropdown — name + body-text preview sub-line (no subject on partials) */}
          {showSuggestions && searchQ.trim().length >= 3 && suggestions.length > 0 && (
            <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg z-30 overflow-hidden">
              {suggestions.map((p, idx) => {
                const bodyPreview = stripHtml(p.body).slice(0, 70)
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => {
                      // Filter list by typed query — don't navigate directly.
                      // Dropdown shows top 5 only; filtering reveals all matches.
                      setParam('qList', searchQ)
                      setShowSuggestions(false)
                    }}
                    className={`w-full text-left px-4 py-3 transition-colors ${
                      highlightedIndex === idx ? 'bg-gray-50' : 'bg-white hover:bg-gray-50'
                    } ${idx > 0 ? 'border-t border-gray-100' : ''}`}
                  >
                    <div className="text-sm text-gray-900 truncate">
                      {highlightMatch(p.name, searchQ)}
                    </div>
                    <div className="text-xs text-gray-500 truncate mt-1">
                      {highlightMatch(bodyPreview, searchQ)}
                    </div>
                  </button>
                )
              })}

              <button
                type="button"
                onClick={() => {
                  setParam('qList', searchQ)
                  setShowSuggestions(false)
                }}
                className="w-full text-center py-3 text-sm font-medium text-primary bg-white border-t border-gray-200 hover:bg-gray-50 transition-colors"
              >
                See all {matchCount} {matchCount === 1 ? 'result' : 'results'} for{' '}
                <span className="font-semibold">"{searchQ}"</span>
              </button>
            </div>
          )}

          {/* No-match hint */}
          {showSuggestions && searchQ.trim().length >= 3 && suggestions.length === 0 && (
            <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg z-30 px-3 py-3 text-xs text-gray-500">
              No partials match "<span className="text-gray-900 font-medium">{searchQ}</span>" in name or content.
            </div>
          )}
        </div>

        <FilterSelect
          value={filterTeam}
          onChange={(v) => setParam('team', v)}
          placeholder="All teams"
          options={OWNING_TEAMS.map((t) => ({ value: t, label: t }))}
        />
        <FilterSelect
          value={filterSection}
          onChange={(v) => setParam('section', v)}
          placeholder="All sections"
          options={PARTIAL_SECTIONS.map((s) => ({ value: s, label: s }))}
          minWidth="170px"
        />
        <FilterSelect
          value={filterStatus}
          onChange={(v) => setParam('status', v)}
          placeholder="All statuses"
          options={[
            { value: 'Active', label: 'Active' },
            { value: 'Inactive', label: 'Inactive' },
          ]}
          minWidth="140px"
        />
      </div>

      {/* Applied filters — DF2: grouped + responsive collapse via shared bar. */}
      <AppliedFiltersBar
        filters={activeFilters}
        onClearAll={() => setSearchParams(new URLSearchParams())}
      />

      {/* Pagination row — matches Templates pattern */}
      <div className="flex items-center gap-3 text-sm text-gray-600 flex-wrap">
        <div>
          <span className="text-gray-900 font-semibold">{Math.min((page - 1) * pageSize + 1, filtered.length)}–{Math.min(page * pageSize, filtered.length)}</span>
          {' '}of <span className="text-gray-900 font-semibold">{filtered.length}</span> partials
        </div>
        <div className="flex items-center gap-0.5">
          <button
            disabled={page <= 1}
            onClick={() => setParam('page', String(page - 1))}
            aria-label="Previous page"
            className="w-7 h-7 inline-flex items-center justify-center rounded border border-gray-300 text-gray-600 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <button
            disabled={page >= totalPages}
            onClick={() => setParam('page', String(page + 1))}
            aria-label="Next page"
            className="w-7 h-7 inline-flex items-center justify-center rounded border border-gray-300 text-gray-600 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
        <span>Go to page</span>
        <select value={page} onChange={(e) => setParam('page', e.target.value)} className="h-8 border border-gray-300 rounded text-sm px-1 bg-white">
          {Array.from({ length: totalPages }, (_, i) => (
            <option key={i + 1} value={i + 1}>{i + 1}</option>
          ))}
        </select>
        <select value={pageSize} onChange={(e) => setParam('size', e.target.value)} className="h-8 border border-gray-300 rounded text-sm px-1 bg-white text-primary font-semibold">
          {[10, 20, 25, 50].map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <span>per page</span>
      </div>

      {/* Table or states */}
      {demoState === 'empty' || (demoState === 'happy' && filtered.length === 0 && activeFilters.length === 0) ? (
        <EmptyState
          icon={
            <svg className="w-16 h-16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M14.25 6.087c0-.355.186-.676.401-.959.221-.29.349-.634.349-1.003 0-1.036-1.007-1.875-2.25-1.875S10.5 3.089 10.5 4.125c0 .369.128.713.349 1.003.215.283.401.604.401.959v0a.64.64 0 01-.657.643 48.39 48.39 0 01-4.163-.3c.186 1.613.293 3.25.315 4.907a.656.656 0 01-.658.663v0c-.355 0-.676-.186-.959-.401a1.647 1.647 0 00-1.003-.349c-1.036 0-1.875 1.007-1.875 2.25s.84 2.25 1.875 2.25c.369 0 .713-.128 1.003-.349.283-.215.604-.401.959-.401v0c.31 0 .555.26.532.57a48.039 48.039 0 01-.642 5.056c1.518.19 3.058.309 4.616.354a.64.64 0 00.657-.643v0c0-.355-.186-.676-.401-.959a1.647 1.647 0 01-.349-1.003c0-1.035 1.008-1.875 2.25-1.875 1.243 0 2.25.84 2.25 1.875 0 .369-.128.713-.349 1.003-.215.283-.4.604-.4.959v0c0 .333.277.599.61.58a48.1 48.1 0 005.427-.63 48.05 48.05 0 00.582-4.717.532.532 0 00-.533-.57v0c-.355 0-.676.186-.959.401-.29.221-.634.349-1.003.349-1.035 0-1.875-1.007-1.875-2.25s.84-2.25 1.875-2.25c.37 0 .713.128 1.003.349.283.215.604.401.96.401v0a.656.656 0 00.658-.663 48.422 48.422 0 00-.37-5.36c-1.886.342-3.81.574-5.766.689a.578.578 0 01-.61-.58v0z" />
            </svg>
          }
          title="No partials yet"
          description="Create your first partial to start building reusable blocks for your templates."
          action={isAdmin ? <Link to="/admin/partials/new" className="bg-primary text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-primary-hover transition-colors">+ New partial</Link> : undefined}
        />
      ) : demoState === 'happy' && filtered.length === 0 && activeFilters.length > 0 ? (
        // "No results found" — matches Screenshot_7.56.08
        <EmptyState
          icon={
            <svg className="w-16 h-16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
            </svg>
          }
          title="No results found"
          description="Your search returned no matches. Try searching again."
          action={
            <button onClick={() => setSearchParams(new URLSearchParams())} className="text-sm text-primary font-medium hover:underline">
              Clear all filters
            </button>
          }
        />
      ) : (
        <div className="border border-gray-200 rounded-lg overflow-hidden">
          <table className="w-full">
            <thead>
              {/* Table columns match designer's `Screenshot_7.25.53`:
                  NAME | TEAM | SECTION | USED IN TEMPLATES | STATUS | UPDATED | ACTIONS
                  (Owner column dropped per item 21; status moved to its own column per item 22.) */}
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-left px-4 py-3 text-xs font-medium uppercase tracking-wide text-gray-500 cursor-pointer select-none" onClick={() => toggleSort('name')}>
                  Name <SortIcon field="name" />
                </th>
                <th className="text-left px-4 py-3 text-xs font-medium uppercase tracking-wide text-gray-500">Team</th>
                <th className="text-left px-4 py-3 text-xs font-medium uppercase tracking-wide text-gray-500">Section</th>
                <th className="text-left px-4 py-3 text-xs font-medium uppercase tracking-wide text-gray-500 cursor-pointer select-none" onClick={() => toggleSort('usedInCount')}>
                  Used in Templates <SortIcon field="usedInCount" />
                </th>
                <th className="text-left px-4 py-3 text-xs font-medium uppercase tracking-wide text-gray-500">Status</th>
                <th className="text-left px-4 py-3 text-xs font-medium uppercase tracking-wide text-gray-500 cursor-pointer select-none" onClick={() => toggleSort('updatedAt')}>
                  Updated <SortIcon field="updatedAt" />
                </th>
                {canEdit && <th className="text-left px-4 py-3 text-xs font-medium uppercase tracking-wide text-gray-500">Actions</th>}
              </tr>
            </thead>
            <tbody>
              {paginated.map((p) => (
                <PartialRow
                  key={p.id}
                  partial={p}
                  canEdit={canEdit}
                  isAdmin={isAdmin}
                  onDuplicate={() => setRowAction({ kind: 'duplicate', partial: p })}
                  onDeactivate={() => setRowAction({ kind: 'deactivate', partial: p })}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Row-action confirmation modals — driven by `rowAction` state.
          Duplicate uses primary variant + success toast.
          Deactivate uses destructive variant + destructive toast + lifecycle override. */}
      <ConfirmModal
        open={rowAction?.kind === 'duplicate'}
        title="Duplicate this partial?"
        body={rowAction?.kind === 'duplicate'
          ? <>A copy named <em className="not-italic font-medium">Copy of {rowAction.partial.name}</em> will be created.</>
          : null}
        confirmLabel="Duplicate"
        variant="primary"
        onConfirm={() => {
          if (rowAction?.kind === 'duplicate') {
            const src = rowAction.partial
            const now = new Date().toISOString()
            const copy: Partial = {
              ...src,
              id: `partial-copy-${Date.now()}`,
              name: `[Copy] ${src.name}`,
              lifecycle: 'Active',
              version: 1,
              createdBy: user.email,
              createdAt: now,
              updatedAt: now,
              lastEditedBy: undefined,
              usedInCount: 0,
            }
            savePartial(copy)
            setDuplicatedPartials((arr) => [copy, ...arr])
            toast.show({
              title: 'Partial duplicated',
              message: `"${copy.name}" created as Active.`,
              variant: 'success',
            })
          }
          setRowAction(null)
        }}
        onCancel={() => setRowAction(null)}
      />
      <ConfirmModal
        open={rowAction?.kind === 'deactivate'}
        title="Deactivate this partial?"
        body="It will be hidden from new templates but kept for reference. You can reactivate it later."
        confirmLabel="Deactivate"
        variant="destructive"
        onConfirm={() => {
          if (rowAction?.kind === 'deactivate') {
            setLifecycleOverrides((prev) => ({ ...prev, [rowAction.partial.id]: 'Inactive' }))
            savePartial({ ...rowAction.partial, lifecycle: 'Inactive', lastEditedBy: user.email, updatedAt: new Date().toISOString() })
            toast.show({
              title: 'Partial deactivated',
              message: `"${rowAction.partial.name}" has been deactivated.`,
              variant: 'destructive',
            })
          }
          setRowAction(null)
        }}
        onCancel={() => setRowAction(null)}
      />
      <DemoStateSwitcher value={demoState} onChange={setDemoState} />
    </div>
  )
}

// Read-only page header — matches `PageHeader.jpg`. No count (pagination shows it),
// title + subtitle on left, primary green CTA on right, bottom divider.
function PageHeader({ isAdmin }: { isAdmin: boolean }) {
  return (
    <div className="sticky top-0 bg-white z-10 pt-6 pb-6 border-b border-gray-200 flex items-start justify-between gap-4">
      <div className="min-w-0">
        <h1 className="text-3xl font-semibold text-gray-900">Partials</h1>
        <p className="text-sm text-gray-500 mt-1">
          Reusable blocks embedded in templates. Changes here propagate to every template that uses them.
        </p>
      </div>
      {isAdmin && (
        <Link
          to="/admin/partials/new"
          className="bg-primary text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-primary-hover transition-colors inline-flex items-center gap-1.5 shrink-0"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          New partial
        </Link>
      )}
    </div>
  )
}

// Icon-only action buttons for the partials table.
function RowPencilIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897L16.863 4.487zm0 0L19.5 7.125" />
    </svg>
  )
}
function RowCopyIcon() {
  return <Copy className="w-4 h-4" aria-hidden="true" />
}
function RowDeactivateIcon() {
  // Circle with diagonal line — "no entry" / deactivate
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <circle cx="12" cy="12" r="9" />
      <line x1="5.6" y1="5.6" x2="18.4" y2="18.4" strokeLinecap="round" />
    </svg>
  )
}

function PartialRow({
  partial: p, canEdit, isAdmin, onDuplicate, onDeactivate,
}: {
  partial: Partial
  canEdit: boolean
  isAdmin: boolean
  onDuplicate: () => void
  onDeactivate: () => void
}) {
  const usedIn = p.usedInCount ?? 0

  return (
    <tr className="border-b border-gray-100 hover:bg-gray-50/50 transition-colors">
      {/* NAME — link only (no status pill inline; status is its own column now) */}
      <td className="px-4 py-4">
        <Link to={`/partials/${p.id}`} className="text-sm text-primary font-medium hover:underline">
          {p.name}
        </Link>
      </td>
      {/* TEAM */}
      <td className="px-4 py-4 text-sm text-gray-900">{p.authoringTeam}</td>
      {/* SECTION */}
      <td className="px-4 py-4 text-sm text-gray-900">{p.section}</td>
      {/* USED IN TEMPLATES — value formatted as "N templates" per designer feedback */}
      <td className="px-4 py-4 text-sm text-gray-900">
        {usedIn} {usedIn === 1 ? 'template' : 'templates'}
      </td>
      {/* STATUS — separate column (was previously inline on Name) */}
      <td className="px-4 py-4"><StatusPill status={p.lifecycle} /></td>
      {/* UPDATED — date + "by Author" stacked */}
      <td className="px-4 py-4 text-sm text-gray-500">
        <div className="text-gray-900">{format(new Date(p.updatedAt), 'MMM d, yyyy')}</div>
        <div className="text-xs text-gray-500 mt-0.5">
          by {emailToName(p.lastEditedBy || p.owner)}
        </div>
      </td>
      {canEdit && (
        <td className="px-4 py-4">
          {/* Actions — icon-only with custom Tooltip per designer feedback.
              Pencil = Edit · Copy = Duplicate · ⊘ = Deactivate (admin + active only).
              Deactivate is disabled when the partial is used by ≥1 template. */}
          <div className="flex items-center gap-1">
            {isAdmin && (
              <Tooltip label="Edit" placement="top">
                <Link
                  to={`/admin/partials/${p.id}/edit`}
                  className="inline-flex items-center justify-center w-8 h-8 rounded-md text-gray-500 hover:text-gray-900 hover:bg-gray-100 transition-colors"
                >
                  <RowPencilIcon />
                </Link>
              </Tooltip>
            )}
            <Tooltip label="Duplicate" placement="top">
              <button
                type="button"
                onClick={onDuplicate}
                className="inline-flex items-center justify-center w-8 h-8 rounded-md text-gray-500 hover:text-gray-900 hover:bg-gray-100 transition-colors"
              >
                <RowCopyIcon />
              </button>
            </Tooltip>
            {isAdmin && p.lifecycle === 'Active' && (
              <Tooltip
                label={usedIn > 0 ? `Used by ${usedIn} ${usedIn === 1 ? 'template' : 'templates'} — resolve dependencies first` : 'Deactivate'}
                placement="top"
                align="end"
              >
                <button
                  type="button"
                  disabled={usedIn > 0}
                  onClick={onDeactivate}
                  className="inline-flex items-center justify-center w-8 h-8 rounded-md text-gray-500 hover:text-red-600 hover:bg-red-50 transition-colors disabled:text-gray-300 disabled:cursor-not-allowed disabled:hover:bg-transparent"
                >
                  <RowDeactivateIcon />
                </button>
              </Tooltip>
            )}
          </div>
        </td>
      )}
    </tr>
  )
}
