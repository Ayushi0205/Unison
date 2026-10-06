import { useState, useMemo, useEffect, useRef } from 'react'
import { Link, useSearchParams, useNavigate } from 'react-router-dom'
import { format } from 'date-fns'
import { PROJECTS } from '../data/programs'
import { OWNING_TEAMS, TEMPLATE_TYPES } from '../data/taxonomy'
import type { Template } from '../data/types'
import { getAllTemplates } from '../data/session-store'
import { useCurrentUser } from '../hooks/useCurrentUser'
import { StatusPill } from '../components/shared/StatusPill'
import { Tooltip } from '../components/shared/Tooltip'
import { EmptyState } from '../components/shared/EmptyState'
import { LoadingSkeleton } from '../components/shared/LoadingSkeleton'
import { ErrorState } from '../components/shared/ErrorState'
import { TagsFilter } from '../components/shared/TagsFilter'
import { OwnerFilter } from '../components/shared/OwnerFilter'
import { FilterSelect } from '../components/shared/FilterSelect'
import { AppliedFiltersBar } from '../components/shared/AppliedFiltersBar'
import { evaluateTemplateCompliance } from '../data/rule-compliance'
import { Copy, TriangleAlert } from 'lucide-react'
import { DemoStateSwitcher } from '../components/shared/DemoStateSwitcher'

type Scope = 'mine' | 'all'
type SortField = 'name' | 'owningTeam' | 'updatedAt'
type SortDir = 'asc' | 'desc'

function emailToName(email: string) {
  const local = email.split('@')[0] || ''
  return local.split('.').map((s) => s.charAt(0).toUpperCase() + s.slice(1)).join(' ')
}

export function LibraryPage() {
  const { user } = useCurrentUser()
  const [searchParams, setSearchParams] = useSearchParams()
  const [demoState, setDemoState] = useState<'happy' | 'loading' | 'error' | 'empty'>('happy')
  // The drawer should only open when the user explicitly taps "+ More filters".
  // Arriving via a project/tag/owner URL param applies the filter but must NOT
  // pop the drawer open (e.g. clicking "4 templates" from the Projects page).
  const [showMoreFilters, setShowMoreFilters] = useState(false)

  const scope = (searchParams.get('scope') as Scope) || 'all'
  const searchQ = searchParams.get('q') || ''
  // qList = applied search filter (set by "See all results"). Decoupled from `q` (live
  // typeahead query) so the list doesn't reactively filter as the user types.
  const appliedSearch = searchParams.get('qList') || ''
  const filterTeam = searchParams.get('team') || ''
  const filterType = searchParams.get('type') || ''
  const filterStatus = searchParams.get('status') || ''
  const filterProgram = searchParams.get('program') || ''
  const filterTagsRaw = searchParams.get('tags') || ''
  const filterTags = filterTagsRaw ? filterTagsRaw.split(',').filter(Boolean) : []
  const filterOwner = searchParams.get('owner') || ''
  const filterNonCompliant = searchParams.get('nonCompliant') === '1'
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

  const allTemplates = getAllTemplates()

  // Base list — all structural filters except applied search.
  // The typeahead derives its suggestions from this so it isn't constrained by
  // a previously-applied search filter.
  const filteredBase = useMemo(() => {
    let items = [...getAllTemplates()]

    if (filterStatus) items = items.filter((t) => t.lifecycle === filterStatus)
    if (scope === 'mine') items = items.filter((t) => t.owner === user.email)
    if (filterTeam) items = items.filter((t) => t.owningTeam === filterTeam)
    if (filterType) items = items.filter((t) => t.templateType === filterType)
    if (filterProgram) items = items.filter((t) => t.programId === filterProgram)
    if (filterOwner) items = items.filter((t) => t.owner === filterOwner)
    if (filterTags.length > 0) items = items.filter((t) => filterTags.every((tag) => t.tags.includes(tag)))
    if (filterNonCompliant) items = items.filter((t) => evaluateTemplateCompliance(t).missingPartialIds.length > 0)

    // Sort: templates needing updates (governance compliance gaps) appear first,
    // then by the user's chosen sort field. Per designer feedback item 12.
    items.sort((a, b) => {
      const aMissing = evaluateTemplateCompliance(a).missingPartialIds.length > 0 ? 1 : 0
      const bMissing = evaluateTemplateCompliance(b).missingPartialIds.length > 0 ? 1 : 0
      if (aMissing !== bMissing) return bMissing - aMissing

      let cmp = 0
      if (sortField === 'name') cmp = a.name.localeCompare(b.name)
      else if (sortField === 'owningTeam') cmp = a.owningTeam.localeCompare(b.owningTeam)
      else cmp = a.updatedAt.localeCompare(b.updatedAt)
      return sortDir === 'desc' ? -cmp : cmp
    })

    return items
  }, [scope, filterTeam, filterType, filterStatus, filterProgram, filterOwner, filterTagsRaw, filterNonCompliant, sortField, sortDir, user])

  // Visible list — base + applied search.
  // Live search input (`q`) does NOT filter the list — it's a pure typeahead.
  // The list filters by `appliedSearch` only, set when the user clicks "See all
  // results" in the dropdown. Decoupling these prevents reactive filter behaviour
  // while still letting users commit to a search.
  const filtered = useMemo(() => {
    if (!appliedSearch) return filteredBase
    const q = appliedSearch.toLowerCase()
    return filteredBase.filter((t) =>
      t.name.toLowerCase().includes(q) || t.subject.toLowerCase().includes(q),
    )
  }, [filteredBase, appliedSearch])

  // ── Typeahead suggestions ────────────────────────────────────────────────
  // Appears below the search input after 3+ characters. Respects all active
  // filters (team/type/status/etc.) so suggestions are scoped to what's visible.
  // Inline list filtering still happens character-by-character — typeahead is
  // additive for the "I know which template I want" job, not a replacement.
  const navigate = useNavigate()
  const [showSuggestions, setShowSuggestions] = useState(false)
  // -1 = "nothing explicitly highlighted" → Enter applies search as a list filter.
  // >= 0 = "user has arrow-keyed to a specific suggestion" → Enter navigates to it.
  const [highlightedIndex, setHighlightedIndex] = useState(-1)
  const searchContainerRef = useRef<HTMLDivElement>(null)

  // Scored matches against the structurally-filtered list. Used for both the
  // dropdown items (top 5) and the "Top N of M matches" footer (total count).
  const scoredMatches = useMemo(() => {
    if (searchQ.trim().length < 3) return []
    const q = searchQ.toLowerCase()
    // Match against the base (structurally-filtered) list — NOT `filtered` — so
    // suggestions aren't restricted by a previously-applied search.
    return [...filteredBase]
      .map((t) => {
        const name = t.name.toLowerCase()
        const subject = t.subject.toLowerCase()
        let score = 0
        if (name.startsWith(q)) score = 4
        else if (name.includes(q)) score = 3
        else if (subject.startsWith(q)) score = 2
        else if (subject.includes(q)) score = 1
        return { template: t, score }
      })
      .filter((m) => m.score > 0)
      .sort((a, b) => b.score - a.score)
  }, [searchQ, filteredBase])

  const suggestions = useMemo(() => scoredMatches.slice(0, 5).map((m) => m.template), [scoredMatches])
  const matchCount = scoredMatches.length

  // Reset to "no explicit highlight" whenever the query changes — so Enter defaults
  // to "see all results" until the user actively arrow-keys to a suggestion.
  useEffect(() => {
    setHighlightedIndex(-1)
  }, [searchQ])

  // Outside click dismisses the dropdown (Escape and selection are handled inline)
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

  // Note: nonCompliantCount + totalAll were used by the old PageHeader (count display +
  // "N need updates →" warning button). Both removed per designer feedback — the sidebar
  // amber triangle covers the non-compliant signal, and pagination handles the count.

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize))
  const paginated = filtered.slice((page - 1) * pageSize, page * pageSize)

  // Count of side-panel ("More filters") filters that are active. Drives the badge
  // on the More filters trigger button. Top-level filters (team/type/status) are NOT
  // counted here — they have their own trigger UI in the main filter row.
  const moreFiltersCount =
    (filterProgram ? 1 : 0) +
    (filterOwner ? 1 : 0) +
    (filterTags.length > 0 ? 1 : 0) +
    (filterNonCompliant ? 1 : 0)

  const activeFilters: { key: string; label: string; value: string; onRemove: () => void }[] = []
  if (filterTeam) activeFilters.push({ key: 'team', label: 'Team', value: filterTeam, onRemove: () => setParam('team', '') })
  if (filterType) activeFilters.push({ key: 'type', label: 'Type', value: filterType, onRemove: () => setParam('type', '') })
  if (filterStatus) activeFilters.push({ key: 'status', label: 'Status', value: filterStatus, onRemove: () => setParam('status', '') })
  if (filterProgram) {
    const prog = PROJECTS.find((p) => p.id === filterProgram)
    activeFilters.push({ key: 'program', label: 'Project', value: prog?.name || filterProgram, onRemove: () => setParam('program', '') })
  }
  if (filterOwner) {
    activeFilters.push({ key: 'owner', label: 'Owner', value: emailToName(filterOwner), onRemove: () => setParam('owner', '') })
  }
  filterTags.forEach((tag) => {
    activeFilters.push({
      key: `tag-${tag}`,
      label: 'Tag',
      value: tag,
      onRemove: () => {
        const next = filterTags.filter((t) => t !== tag)
        setParam('tags', next.join(','))
      },
    })
  })
  if (filterNonCompliant) activeFilters.push({ key: 'nonCompliant', label: 'Compliance', value: 'Needs update', onRemove: () => setParam('nonCompliant', '') })
  // Applied search filter (set by "See all results"). Shown as a dismissible chip.
  // Note: this is `qList`, not `q` — the live typeahead query isn't shown as a chip.
  if (appliedSearch) activeFilters.push({ key: 'qList', label: 'Search', value: appliedSearch, onRemove: () => setParam('qList', '') })

  const toggleSort = (field: SortField) => {
    if (sortField === field) setParam('dir', sortDir === 'asc' ? 'desc' : 'asc')
    else { setParam('sort', field); setParam('dir', 'asc') }
  }

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <span className="text-gray-300 ml-1">↕</span>
    return <span className="text-gray-600 ml-1">{sortDir === 'asc' ? '↑' : '↓'}</span>
  }

  const canEdit = user.role === 'admin' || user.role === 'editor'

  if (demoState === 'loading') return (
    <div className="space-y-5">
      <PageHeader canEdit={canEdit} />
      <LoadingSkeleton rows={6} />
    </div>
  )
  if (demoState === 'error') return (
    <div className="space-y-5">
      <PageHeader canEdit={canEdit} />
      <ErrorState message="Failed to load templates." onRetry={() => setDemoState('happy')} />
    </div>
  )

  return (
    <div className="space-y-5">
      <PageHeader canEdit={canEdit} />

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative" ref={searchContainerRef}>
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            placeholder="Search by name or subject…"
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
                // Floor at -1 — allows backing out to "no highlight" state
                setHighlightedIndex((i) => Math.max(i - 1, -1))
              } else if (e.key === 'Enter') {
                e.preventDefault()
                if (hasSuggestions && highlightedIndex >= 0) {
                  // Explicit highlight via arrow keys → navigate to that suggestion
                  const target = suggestions[highlightedIndex]
                  if (target) {
                    setShowSuggestions(false)
                    navigate(`/templates/${target.id}`)
                  }
                } else if (searchQ.trim().length > 0) {
                  // No explicit highlight → apply as list filter (search-engine pattern)
                  setParam('qList', searchQ)
                  setShowSuggestions(false)
                }
              } else if (e.key === 'Escape') {
                setShowSuggestions(false)
              }
            }}
            className="h-10 pl-9 pr-8 border border-gray-300 rounded-md text-sm w-72 placeholder:italic focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
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

          {/* Typeahead dropdown — minimalist:
              - Name + subject always visible
              - No status pills (status is discoverable on the detail page)
              - Match highlight on either field
              - Footer is a single centered "See all results" link */}
          {showSuggestions && searchQ.trim().length >= 3 && suggestions.length > 0 && (
            <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg z-30 overflow-hidden">
              {suggestions.map((t, idx) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => {
                    // Apply the typed query as a list filter — don't navigate directly.
                    // The dropdown shows only top 5; there may be many more matches.
                    // Filtering first lets the user browse all results, then pick one.
                    setParam('qList', searchQ)
                    setShowSuggestions(false)
                  }}
                  className={`w-full text-left px-4 py-3 transition-colors ${
                    highlightedIndex === idx ? 'bg-gray-50' : 'bg-white hover:bg-gray-50'
                  } ${idx > 0 ? 'border-t border-gray-100' : ''}`}
                >
                  <div className="text-sm text-gray-900 truncate">
                    {highlightMatch(t.name, searchQ)}
                  </div>
                  <div className="text-xs text-gray-500 truncate mt-1">
                    {highlightMatch(t.subject, searchQ)}
                  </div>
                </button>
              ))}

              {/* See all results — single centered link, no info-row clutter */}
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

          {/* No-match hint when user has typed 3+ chars but nothing matches */}
          {showSuggestions && searchQ.trim().length >= 3 && suggestions.length === 0 && (
            <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg z-30 px-3 py-3 text-xs text-gray-500">
              No templates match "<span className="text-gray-900 font-medium">{searchQ}</span>" in name or subject.
            </div>
          )}
        </div>

        <FilterSelect value={filterTeam} onChange={(v) => setParam('team', v)} placeholder="All teams" options={OWNING_TEAMS.map((t) => ({ value: t, label: t }))} />
        <FilterSelect value={filterType} onChange={(v) => setParam('type', v)} placeholder="All types" options={TEMPLATE_TYPES.map((t) => ({ value: t, label: t }))} />
        <FilterSelect
          value={filterStatus}
          onChange={(v) => setParam('status', v)}
          placeholder="All statuses"
          options={[
            { value: 'Active', label: 'Active' },
            { value: 'Draft', label: 'Draft' },
            { value: 'Inactive', label: 'Inactive' },
          ]}
        />

        {/* "More filters" trigger — opens the slide-in side panel. Badge shows count
            of applied side-panel filters (project, owner, tags, template updates). */}
        <button
          onClick={() => setShowMoreFilters(true)}
          className={`h-10 px-3 text-sm font-medium border rounded-md inline-flex items-center gap-2 transition-colors ${
            moreFiltersCount > 0
              ? 'border-primary text-primary bg-primary/5 hover:bg-primary/10'
              : 'border-gray-300 text-gray-700 bg-white hover:bg-gray-50'
          }`}
        >
          More filters
          {moreFiltersCount > 0 && (
            <>
              <span className="inline-flex items-center justify-center min-w-5 h-5 px-1.5 rounded bg-primary text-white text-xs font-semibold">
                {moreFiltersCount}
              </span>
              <span
                role="button"
                aria-label="Clear more filters"
                onClick={(e) => {
                  e.stopPropagation()
                  const next = new URLSearchParams(searchParams)
                  next.delete('program')
                  next.delete('owner')
                  next.delete('tags')
                  next.delete('nonCompliant')
                  setSearchParams(next)
                }}
                className="text-gray-400 hover:text-gray-700"
              >
                ×
              </span>
            </>
          )}
        </button>
      </div>

      {/* Applied filters — DF2: grouped by category (Tag: A · B · C), collapses
          to one line via chevron only when chips wrap. */}
      <AppliedFiltersBar
        filters={activeFilters}
        onClearAll={() => {
          const next = new URLSearchParams()
          if (scope !== 'all') next.set('scope', scope)
          setSearchParams(next)
        }}
      />

      {/* Pagination row — matches `Screenshot_6.30.51`:
          all elements left-aligned in one cluster, "1-N" range emphasised in bold dark text. */}
      <div className="flex items-center gap-3 text-sm text-gray-600 flex-wrap">
        <div>
          <span className="text-gray-900 font-semibold">{((page - 1) * pageSize) + 1}–{Math.min(page * pageSize, filtered.length)}</span>
          {' '}of <span className="text-gray-900 font-semibold">{filtered.length}</span> templates
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
          icon={<svg className="w-16 h-16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" /></svg>}
          title="No templates yet"
          description="Create your first template to start building your centralized email library."
          action={canEdit ? <Link to="/templates/new" className="bg-primary text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-primary-hover transition-colors">+ New template</Link> : undefined}
        />
      ) : demoState === 'happy' && filtered.length === 0 && activeFilters.length > 0 ? (
        // "No results found" — matches Screenshot_7.56.08 (magnifier icon + designer copy)
        <EmptyState
          icon={
            <svg className="w-16 h-16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
            </svg>
          }
          title="No results found"
          description="Your search returned no matches. Try searching again."
          action={
            <button
              onClick={() => setSearchParams(new URLSearchParams())}
              className="text-sm text-primary font-medium hover:underline"
            >
              Clear all filters
            </button>
          }
        />
      ) : (
        <div className="border border-gray-200 rounded-lg overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-left px-4 py-3 text-xs font-medium uppercase tracking-wide text-gray-500 cursor-pointer select-none" onClick={() => toggleSort('name')}>
                  Name <SortIcon field="name" />
                </th>
                <th className="text-left px-4 py-3 text-xs font-medium uppercase tracking-wide text-gray-500 cursor-pointer select-none" onClick={() => toggleSort('owningTeam')}>
                  Team <SortIcon field="owningTeam" />
                </th>
                <th className="text-left px-4 py-3 text-xs font-medium uppercase tracking-wide text-gray-500">Template type</th>
                <th className="text-left px-4 py-3 text-xs font-medium uppercase tracking-wide text-gray-500">Status</th>
                <th className="text-left px-4 py-3 text-xs font-medium uppercase tracking-wide text-gray-500 cursor-pointer select-none" onClick={() => toggleSort('updatedAt')}>
                  Updated <SortIcon field="updatedAt" />
                </th>
                {canEdit && <th className="text-right px-4 py-3 text-xs font-medium uppercase tracking-wide text-gray-500">Actions</th>}
              </tr>
            </thead>
            <tbody>
              {paginated.map((t) => (
                <TemplateRow key={t.id} template={t} canEdit={canEdit} />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* More filters side panel — slides in from the right per `Screenshot_6.28.11`.
          Filters apply immediately on change (same as the top-row filters); the Apply
          button at the bottom acts as a "Done" affordance that closes the panel. */}
      {showMoreFilters && (
        <MoreFiltersPanel
          filterProgram={filterProgram}
          filterOwner={filterOwner}
          filterTags={filterTags}
          filterNonCompliant={filterNonCompliant}
          owners={Array.from(new Set(allTemplates.map((t) => t.owner))).sort()}
          currentUserEmail={user.email}
          onChangeProgram={(v) => setParam('program', v)}
          onChangeOwner={(v) => setParam('owner', v)}
          onChangeTags={(tags) => setParam('tags', tags.join(','))}
          onChangeNonCompliant={(v) => setParam('nonCompliant', v ? '1' : '')}
          onClose={() => setShowMoreFilters(false)}
        />
      )}
      <DemoStateSwitcher value={demoState} onChange={setDemoState} />
    </div>
  )
}

// Read-only page header — matches PageHeader.jpg from the designer's spec:
// Title + subtitle on the left, primary green action on the right, bottom divider line.
// Template count was removed (lives in pagination per designer feedback).
// "N need updates →" warning button was removed (sidebar amber triangle covers this,
// and table sort surfaces those templates first per item 12 — handled in Phase 3).
function PageHeader({ canEdit }: { canEdit: boolean }) {
  return (
    <div className="sticky top-0 bg-white z-10 pt-6 pb-6 border-b border-gray-200 flex items-start justify-between gap-4">
      <div className="min-w-0">
        <h1 className="text-3xl font-semibold text-gray-900">Templates</h1>
        <p className="text-sm text-gray-500 mt-1">
          All email templates, managed in one place. Used by every team and sending tool.
        </p>
      </div>
      {canEdit && (
        <Link
          to="/templates/new"
          className="bg-primary text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-primary-hover transition-colors inline-flex items-center gap-1.5 shrink-0"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          New template
        </Link>
      )}
    </div>
  )
}

function RowWarningIcon() {
  return <TriangleAlert className="w-4 h-4 shrink-0 text-amber-500" aria-hidden="true" />
}

function PencilIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897L16.863 4.487zm0 0L19.5 7.125" />
    </svg>
  )
}

function CopyIcon() {
  return <Copy className="w-4 h-4" aria-hidden="true" />
}

function TemplateRow({ template: t, canEdit }: { template: Template; canEdit: boolean }) {
  const compliance = evaluateTemplateCompliance(t)
  const missingCount = compliance.missingPartialIds.length

  return (
    <tr className="border-b border-gray-100 hover:bg-gray-50/50 transition-colors">
      {/* NAME — link + amber ⚠ icon (when template needs governance update).
          No subject preview in this row per `Screenshot_6.30.51`. */}
      <td className="px-4 py-4">
        <div className="flex items-center gap-2 min-w-0">
          <Link to={`/templates/${t.id}`} className="text-sm text-primary font-medium hover:underline truncate">
            {t.name}
          </Link>
          {missingCount > 0 && (
            <span className="relative group inline-flex" aria-label="Needs update">
              <RowWarningIcon />
              <span
                role="tooltip"
                className="pointer-events-none absolute left-0 top-full mt-1.5 w-72 px-3 py-2.5 text-xs leading-snug text-white bg-gray-900 rounded-md shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-opacity z-50 normal-case tracking-normal font-normal text-left whitespace-normal"
              >
                <div className="font-semibold mb-1">
                  Missing {missingCount} required {missingCount === 1 ? 'partial' : 'partials'}
                </div>
                <ul className="space-y-0.5 text-gray-200">
                  {compliance.missingPartialNames.map((name) => (
                    <li key={name} className="flex items-start gap-1.5">
                      <span className="text-amber-300">•</span>
                      <span>{name}</span>
                    </li>
                  ))}
                </ul>
                <div className="text-gray-400 mt-2 text-[11px]">
                  Added on next edit, or open the template to add now.
                </div>
              </span>
            </span>
          )}
        </div>
      </td>
      <td className="px-4 py-4 text-sm text-gray-900">{t.owningTeam}</td>
      <td className="px-4 py-4 text-sm text-gray-900">{t.templateType}</td>
      <td className="px-4 py-4"><StatusPill status={t.lifecycle} /></td>
      <td className="px-4 py-4 text-sm text-gray-500">
        <div className="text-gray-900">{format(new Date(t.updatedAt), 'MMM d, yyyy')}</div>
        <div className="text-xs text-gray-500 mt-0.5">
          by {emailToName(t.lastEditedBy || t.owner)}
        </div>
      </td>
      {canEdit && (
        <td className="px-4 py-4">
          {/* Actions — icon-only with custom Tooltip (per designer feedback,
              using the Tooltip component instead of native `title`). */}
          <div className="flex items-center gap-1">
            <Tooltip label="Edit" placement="top">
              <Link
                to={`/templates/${t.id}/edit`}
                className="inline-flex items-center justify-center w-8 h-8 rounded-md text-gray-500 hover:text-gray-900 hover:bg-gray-100 transition-colors"
              >
                <PencilIcon />
              </Link>
            </Tooltip>
            <Tooltip label="Duplicate" placement="top">
              <button
                type="button"
                className="inline-flex items-center justify-center w-8 h-8 rounded-md text-gray-500 hover:text-gray-900 hover:bg-gray-100 transition-colors"
              >
                <CopyIcon />
              </button>
            </Tooltip>
          </div>
        </td>
      )}
    </tr>
  )
}

/**
 * More Filters side panel — slides in from the right with collapsible accordions
 * for each filter group. Matches `Screenshot_6.28.11`.
 *
 * Filter changes apply immediately (existing URL-param pattern); the Apply button
 * at the bottom is a "Done" affordance that closes the panel.
 */
function MoreFiltersPanel({
  filterProgram, filterOwner, filterTags, filterNonCompliant,
  owners, currentUserEmail,
  onChangeProgram, onChangeOwner, onChangeTags, onChangeNonCompliant,
  onClose,
}: {
  filterProgram: string
  filterOwner: string
  filterTags: string[]
  filterNonCompliant: boolean
  owners: string[]
  currentUserEmail: string
  onChangeProgram: (v: string) => void
  onChangeOwner: (v: string) => void
  onChangeTags: (tags: string[]) => void
  onChangeNonCompliant: (v: boolean) => void
  onClose: () => void
}) {
  // Accordion open state — each section opens by default if its filter is active,
  // so users land on the panel with active filters visible without needing to expand.
  const [openUpdates, setOpenUpdates] = useState(true)
  const [openProjects, setOpenProjects] = useState(true)
  const [openOwners, setOpenOwners] = useState(true)
  const [openTags, setOpenTags] = useState(true)

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-gray-900/30 z-40"
        onClick={onClose}
        aria-hidden="true"
      />
      {/* Panel */}
      <div
        role="dialog"
        aria-label="More filters"
        className="fixed top-0 right-0 bottom-0 w-[380px] bg-white border-l border-gray-200 shadow-xl z-50 flex flex-col"
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 shrink-0">
          <h2 className="text-base font-semibold text-gray-900">More filters</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="text-gray-400 hover:text-gray-600 p-1 rounded hover:bg-gray-100"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {/* Template updates */}
          <FilterAccordion title="Template updates" open={openUpdates} onToggle={() => setOpenUpdates((v) => !v)}>
            <label className="inline-flex items-center gap-2 cursor-pointer">
              <span className="relative inline-flex">
                <input
                  type="checkbox"
                  checked={filterNonCompliant}
                  onChange={(e) => onChangeNonCompliant(e.target.checked)}
                  className="sr-only peer"
                />
                <span className="w-9 h-5 bg-gray-200 rounded-full peer-checked:bg-primary transition-colors" />
                <span className="absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-transform peer-checked:translate-x-4" />
              </span>
              <span className="text-sm text-gray-700">Show templates that needed update</span>
            </label>
          </FilterAccordion>

          {/* Projects */}
          <FilterAccordion title="Projects" open={openProjects} onToggle={() => setOpenProjects((v) => !v)}>
            <select
              value={filterProgram}
              onChange={(e) => onChangeProgram(e.target.value)}
              className="w-full h-9 border border-gray-300 rounded-md text-sm px-3 bg-white"
            >
              <option value="">Filter project</option>
              {PROJECTS.filter((p) => !p.archived).map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </FilterAccordion>

          {/* Owners */}
          <FilterAccordion title="Owners" open={openOwners} onToggle={() => setOpenOwners((v) => !v)}>
            <OwnerFilter
              value={filterOwner}
              onChange={onChangeOwner}
              owners={owners}
              emailToName={emailToName}
              currentUserEmail={currentUserEmail}
            />
          </FilterAccordion>

          {/* Tags */}
          <FilterAccordion title="Tags" open={openTags} onToggle={() => setOpenTags((v) => !v)}>
            <TagsFilter value={filterTags} onChange={onChangeTags} />
          </FilterAccordion>
        </div>

        <div className="border-t border-gray-200 px-5 py-3 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="w-full bg-primary text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-primary-hover transition-colors"
          >
            Apply filters
          </button>
        </div>
      </div>
    </>
  )
}

function FilterAccordion({
  title, open, onToggle, children,
}: {
  title: string
  open: boolean
  onToggle: () => void
  children: React.ReactNode
}) {
  return (
    <div>
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center justify-between py-2"
      >
        <span className="text-sm font-semibold text-gray-900">{title}</span>
        <svg
          className={`w-4 h-4 text-gray-500 transition-transform ${open ? 'rotate-180' : ''}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && <div className="pt-1">{children}</div>}
    </div>
  )
}

// Renders text with the matched query substring visually emphasized.
// Case-insensitive single-match (template name/subject is short, so the first match is enough).
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
