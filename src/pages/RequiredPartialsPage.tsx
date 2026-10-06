import { useState, useMemo, useEffect, useRef, Fragment } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { REQUIRED_PARTIAL_RULES, saveRules } from '../data/required-partial-rules'
import { PARTIALS } from '../data/partials'
import { TEMPLATES } from '../data/templates'
import { OWNING_TEAMS, TEMPLATE_TYPES, TEMPLATE_TYPE_APPLICABILITY } from '../data/taxonomy'
import type { OwningTeam, TemplateType, PartialSection } from '../data/taxonomy'
import type { RequiredPartialRule } from '../data/types'
import { Breadcrumbs } from '../components/shared/Breadcrumbs'
import { useToast } from '../components/shared/Toast'
import { ConfirmModal } from '../components/shared/ConfirmModal'
import { EmptyState } from '../components/shared/EmptyState'
import { LoadingSkeleton } from '../components/shared/LoadingSkeleton'
import { ErrorState } from '../components/shared/ErrorState'
import { FilterSelect } from '../components/shared/FilterSelect'
import { AppliedFiltersBar } from '../components/shared/AppliedFiltersBar'
import { DemoStateSwitcher } from '../components/shared/DemoStateSwitcher'

type RuleTeam = OwningTeam | 'ALL'

type FormState = {
  team: RuleTeam | ''
  templateType: TemplateType | ''
  // Designer feedback item 27: multi-select on Add (one rule per selected partial).
  // In Edit mode, this holds exactly one element (the rule being edited).
  partialIds: string[]
}

const EMPTY_FORM: FormState = { team: '', templateType: '', partialIds: [] }

const TEAM_OPTIONS: RuleTeam[] = ['ALL', ...OWNING_TEAMS]

export function RequiredPartialsPage() {
  const toast = useToast()
  const [searchParams, setSearchParams] = useSearchParams()
  const [demoState, setDemoState] = useState<'happy' | 'loading' | 'error' | 'empty'>('happy')
  const [rules, setRules] = useState<RequiredPartialRule[]>(() => [...REQUIRED_PARTIAL_RULES])
  // Every rule change is saved to the visitor's demo store.
  const updateRules = (fn: (prev: RequiredPartialRule[]) => RequiredPartialRule[]) =>
    setRules((prev) => {
      const next = fn(prev)
      saveRules(next)
      return next
    })
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [confirmingDeleteId, setConfirmingDeleteId] = useState<string | null>(null)
  const [form, setForm] = useState<FormState>(EMPTY_FORM)

  const filterTeam = searchParams.get('team') || ''
  const filterType = searchParams.get('type') || ''
  const searchQ = searchParams.get('q') || ''

  const setParam = (key: string, value: string) => {
    const next = new URLSearchParams(searchParams)
    if (value) next.set(key, value)
    else next.delete(key)
    setSearchParams(next)
  }

  // Team filter has two distinct modes:
  // - "ALL (global)": show only rules where r.team === 'ALL'
  // - A specific team (e.g., "Sourcing"): show the effective view - rules a Sourcing template
  //   would actually receive at creation = ALL rules + Sourcing-specific rules,
  //   narrowed to template types Sourcing actually uses.
  const visibleRules = useMemo(() => {
    let items = demoState === 'empty' ? [] : rules

    if (filterTeam === 'ALL') {
      items = items.filter((r) => r.team === 'ALL')
    } else if (filterTeam) {
      // Specific team view: applicable types only + ALL rules + this team's rules
      const applicableTypes = new Set(
        TEMPLATE_TYPES.filter((t) =>
          TEMPLATE_TYPE_APPLICABILITY[t]?.includes(filterTeam as OwningTeam),
        ),
      )
      items = items.filter(
        (r) => applicableTypes.has(r.templateType) && (r.team === 'ALL' || r.team === filterTeam),
      )
    }

    if (filterType) items = items.filter((r) => r.templateType === filterType)
    if (searchQ) {
      const q = searchQ.toLowerCase()
      items = items.filter((r) => {
        const partial = PARTIALS.find((p) => p.id === r.partialId)
        return partial?.name.toLowerCase().includes(q) || false
      })
    }
    return items
  }, [rules, filterTeam, filterType, searchQ, demoState])

  const groupedByType = useMemo(() => {
    const buckets = new Map<TemplateType, RequiredPartialRule[]>()
    visibleRules.forEach((r) => {
      const list = buckets.get(r.templateType) || []
      list.push(r)
      buckets.set(r.templateType, list)
    })
    return TEMPLATE_TYPES
      .filter((t) => buckets.has(t))
      .map((templateType) => ({ templateType, rules: buckets.get(templateType)! }))
  }, [visibleRules])

  // When filtering by a specific team, identify overridden global rules (a global rule in
  // Header/Footer section that's superseded by a team-specific rule for the selected team).
  const overriddenRuleIds = useMemo(() => {
    if (!filterTeam || filterTeam === 'ALL') return new Set<string>()
    const overridden = new Set<string>()
    visibleRules.forEach((r) => {
      if (r.team !== filterTeam) return
      const partial = PARTIALS.find((p) => p.id === r.partialId)
      if (!partial || partial.section === 'Body') return
      // Find global rule in same templateType + section
      visibleRules.forEach((other) => {
        if (other.team !== 'ALL' || other.templateType !== r.templateType) return
        const otherPartial = PARTIALS.find((p) => p.id === other.partialId)
        if (otherPartial?.section === partial.section) {
          overridden.add(other.id)
        }
      })
    })
    return overridden
  }, [visibleRules, filterTeam])

  const activeFilters: { key: string; label: string; value: string; onRemove: () => void }[] = []
  if (filterTeam) activeFilters.push({ key: 'team', label: 'Team', value: filterTeam, onRemove: () => setParam('team', '') })
  if (filterType) activeFilters.push({ key: 'type', label: 'Template type', value: filterType, onRemove: () => setParam('type', '') })
  if (searchQ) activeFilters.push({ key: 'q', label: 'Search', value: searchQ, onRemove: () => setParam('q', '') })

  const openAddForm = () => {
    setEditingId(null)
    setForm(EMPTY_FORM)
    setShowForm(true)
    setConfirmingDeleteId(null)
  }

  const openEditForm = (rule: RequiredPartialRule) => {
    setEditingId(rule.id)
    setForm({
      team: rule.team,
      templateType: rule.templateType,
      partialIds: [rule.partialId], // edit mode = single rule = one partial
    })
    setShowForm(true)
    setConfirmingDeleteId(null)
  }

  const closeForm = () => {
    setShowForm(false)
    setEditingId(null)
    setForm(EMPTY_FORM)
  }

  const submitForm = () => {
    if (!form.team || !form.templateType || form.partialIds.length === 0) return
    if (editingId) {
      // Edit: a single rule maps to one partial. Use the first (only) selected id.
      const partialId = form.partialIds[0]
      updateRules((prev) =>
        prev.map((r) =>
          r.id === editingId
            ? {
                ...r,
                team: form.team as RuleTeam,
                templateType: form.templateType as TemplateType,
                partialId,
              }
            : r,
        ),
      )
    } else {
      // Add: create one rule per selected partial (designer feedback item 27).
      const baseId = Date.now()
      const newRules: RequiredPartialRule[] = form.partialIds.map((pid, i) => ({
        id: `rule-${baseId}-${i}`,
        team: form.team as RuleTeam,
        templateType: form.templateType as TemplateType,
        partialId: pid,
      }))
      updateRules((prev) => [...prev, ...newRules])
    }
    closeForm()
  }

  const deleteRule = (id: string) => {
    const rule = rules.find((r) => r.id === id)
    const partial = rule ? PARTIALS.find((p) => p.id === rule.partialId) : undefined
    updateRules((prev) => prev.filter((r) => r.id !== id))
    setConfirmingDeleteId(null)
    // Per designer feedback (item 29): "use a modal to prompt user. And toast alert
    // afterwards to confirm removal of partial on rule."
    if (rule && partial) {
      toast.show({
        title: 'Partial removed from rule',
        message: `"${partial.name}" is no longer required for ${rule.team === 'ALL' ? 'all teams\'' : `${rule.team}'s`} ${rule.templateType} templates.`,
        variant: 'destructive',
      })
    }
  }

  if (demoState === 'loading') {
    return (
      <div className="space-y-5">
        <PageHeader count={0} totalAll={0} onAdd={openAddForm} />
        <LoadingSkeleton rows={6} />
      </div>
    )
  }
  if (demoState === 'error') {
    return (
      <div className="space-y-5">
        <PageHeader count={0} totalAll={0} onAdd={openAddForm} />
        <ErrorState message="Failed to load rules." onRetry={() => setDemoState('happy')} />
      </div>
    )
  }

  const isEmptyData = rules.length === 0 || demoState === 'empty'

  // When the user arrived via ?from=, replace breadcrumbs with a "← Previous Page" link.
  const fromParam = searchParams.get('from')

  return (
    <div className="space-y-5">
      {/* Sticky page-header region. When ?from is set, breadcrumbs are replaced
          by a single "← Previous Page" link (designer feedback May 28). */}
      <div className="sticky top-0 bg-white z-10 pt-6 pb-4 space-y-4 border-b border-gray-100">
        {fromParam ? (
          <Link
            to={fromParam}
            className="inline-flex items-center gap-1.5 text-sm text-gray-600 hover:text-gray-900"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
            </svg>
            Previous Page
          </Link>
        ) : (
          <Breadcrumbs items={[
            { label: 'Admin', to: '/admin' },
            { label: 'Required partials' },
          ]} />
        )}

        <PageHeader
          count={visibleRules.length}
          totalAll={rules.length}
          onAdd={openAddForm}
          hasFilters={activeFilters.length > 0}
        />
      </div>

      {!isEmptyData && (
        <>
          <div className="flex items-center gap-3 flex-wrap">
            <div className="relative">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                placeholder="Search by partial name…"
                value={searchQ}
                onChange={(e) => setParam('q', e.target.value)}
                className="h-10 pl-9 pr-3 border border-gray-300 rounded-md text-sm w-64 placeholder:italic focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
              />
            </div>

            <FilterSelect
              value={filterTeam}
              onChange={(v) => setParam('team', v)}
              placeholder="All teams"
              options={[
                { value: 'ALL', label: 'ALL (global)' },
                ...OWNING_TEAMS.map((t) => ({ value: t, label: t })),
              ]}
              minWidth="140px"
            />

            <FilterSelect
              value={filterType}
              onChange={(v) => setParam('type', v)}
              placeholder="All template types"
              options={TEMPLATE_TYPES.map((t) => ({ value: t, label: t }))}
              minWidth="160px"
            />
          </div>

          <AppliedFiltersBar
            filters={activeFilters}
            onClearAll={() => setSearchParams(new URLSearchParams())}
          />
        </>
      )}

      {showForm && (
        <RuleFormPanel
          form={form}
          setForm={setForm}
          editing={!!editingId}
          onSubmit={submitForm}
          onCancel={closeForm}
          existingRules={rules}
          editingId={editingId}
        />
      )}

      {isEmptyData ? (
        <EmptyState
          icon={
            <svg className="w-16 h-16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12c0 1.268-.63 2.39-1.593 3.068a3.745 3.745 0 01-1.043 3.296 3.745 3.745 0 01-3.296 1.043A3.745 3.745 0 0112 21c-1.268 0-2.39-.63-3.068-1.593a3.746 3.746 0 01-3.296-1.043 3.745 3.745 0 01-1.043-3.296A3.745 3.745 0 013 12c0-1.268.63-2.39 1.593-3.068a3.745 3.745 0 011.043-3.296 3.746 3.746 0 013.296-1.043A3.746 3.746 0 0112 3c1.268 0 2.39.63 3.068 1.593a3.746 3.746 0 013.296 1.043 3.746 3.746 0 011.043 3.296A3.745 3.745 0 0121 12z" />
            </svg>
          }
          title="No rules yet"
          description="Add a rule to require certain partials in a team's templates. When someone creates a new template, the required partials are added for them."
          action={
            <button
              onClick={openAddForm}
              className="bg-primary text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-primary-hover transition-colors inline-flex items-center gap-1.5"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
              Add rule
            </button>
          }
        />
      ) : visibleRules.length === 0 ? (
        <EmptyState
          title="No rules match your filters"
          description="Try clearing some filters or changing your search."
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
        <div className="border border-gray-200 rounded-lg bg-white">
          {groupedByType.map(({ templateType, rules: groupRules }) => (
            <TemplateTypeRow
              key={templateType}
              templateType={templateType}
              rules={groupRules}
              allRules={rules}
              overriddenRuleIds={overriddenRuleIds}
              onEdit={openEditForm}
              confirmingDeleteId={confirmingDeleteId}
              onConfirmDelete={setConfirmingDeleteId}
              onDelete={deleteRule}
            />
          ))}
        </div>
      )}
      <DemoStateSwitcher value={demoState} onChange={setDemoState} />
    </div>
  )
}

function PageHeader({
  count, totalAll, onAdd, hasFilters,
}: {
  count: number; totalAll: number; onAdd: () => void; hasFilters?: boolean
}) {
  return (
    <div className="flex items-start justify-between">
      <div>
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-semibold text-gray-900">Required partials</h1>
          <span className="text-sm text-gray-500">
            {hasFilters
              ? <>{count} of {totalAll} · <span className="text-primary font-medium">filters applied</span></>
              : <>{count} rules</>
            }
          </span>
        </div>
        <p className="text-sm text-gray-500 mt-0.5 max-w-2xl">
          Define which partials each template type must include. A rule can apply to every team or just one. When someone creates a new template, the required partials are added for them.
        </p>
      </div>
      <button
        onClick={onAdd}
        className="bg-primary text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-primary-hover transition-colors inline-flex items-center gap-1.5"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
        </svg>
        Add rule
      </button>
    </div>
  )
}

const SECTION_ORDER: Record<PartialSection, number> = { Header: 0, Body: 1, Footer: 2 }

// DF2 designer feedback: Section column uses the Tags component's light-gray
// (default) variant - all three sections share the same neutral pill.
function SectionPill({ section }: { section: PartialSection }) {
  return (
    <span className="inline-flex items-center text-[10px] uppercase tracking-wider font-semibold px-2.5 py-0.5 rounded-full bg-gray-100 text-gray-700">
      {section}
    </span>
  )
}

// DF2 designer feedback: Team Scope column uses the Tags component's white
// variant - white fill with a thin gray border.
function TeamChip({ team }: { team: RuleTeam }) {
  const label = team === 'ALL' ? 'All teams' : team
  return (
    <span className="inline-flex items-center text-[10px] uppercase tracking-wide font-semibold px-2.5 py-0.5 rounded-full bg-white border border-gray-300 text-gray-700">
      {label}
    </span>
  )
}

function TemplateTypeRow({
  templateType, rules, allRules, overriddenRuleIds, onEdit, confirmingDeleteId, onConfirmDelete, onDelete,
}: {
  templateType: TemplateType
  rules: RequiredPartialRule[]
  allRules: RequiredPartialRule[]
  overriddenRuleIds: Set<string>
  onEdit: (r: RequiredPartialRule) => void
  confirmingDeleteId: string | null
  onConfirmDelete: (id: string | null) => void
  onDelete: (id: string) => void
}) {
  const navigate = useNavigate()
  // Sort: Header → Body → Footer, ALL rules first within each section
  const sortedRules = useMemo(() => {
    return [...rules].sort((a, b) => {
      const pa = PARTIALS.find((p) => p.id === a.partialId)
      const pb = PARTIALS.find((p) => p.id === b.partialId)
      const sa = pa ? SECTION_ORDER[pa.section as PartialSection] : 99
      const sb = pb ? SECTION_ORDER[pb.section as PartialSection] : 99
      if (sa !== sb) return sa - sb
      const ta = a.team === 'ALL' ? 0 : 1
      const tb = b.team === 'ALL' ? 0 : 1
      if (ta !== tb) return ta - tb
      return (pa?.name || '').localeCompare(pb?.name || '')
    })
  }, [rules])

  const confirmingRule = rules.find((r) => r.id === confirmingDeleteId)
  const confirmingPartial = confirmingRule ? PARTIALS.find((p) => p.id === confirmingRule.partialId) : null
  const otherRulesForConfirmingPartial = confirmingRule
    ? allRules.filter((r) => r.partialId === confirmingRule.partialId && r.id !== confirmingRule.id).length
    : 0

  // For overridden rules, find which team's rule replaced them (for the inline note)
  const overrideReplacedBy = useMemo(() => {
    const map = new Map<string, string>()
    rules.forEach((r) => {
      if (!overriddenRuleIds.has(r.id)) return
      const partial = PARTIALS.find((p) => p.id === r.partialId)
      if (!partial || partial.section === 'Body') return
      const replacer = rules.find((other) => {
        if (other.team === 'ALL' || other.id === r.id) return false
        const op = PARTIALS.find((p) => p.id === other.partialId)
        return op?.section === partial.section
      })
      if (replacer) map.set(r.id, replacer.team as string)
    })
    return map
  }, [rules, overriddenRuleIds])

  return (
    <section className="border border-gray-200 rounded-lg bg-white mb-3">
      <header className="flex items-center justify-between px-4 py-3 bg-gray-50/60 border-b border-gray-200">
        <div className="flex items-center gap-2.5">
          <span className="text-sm font-semibold text-gray-900">{templateType}</span>
          <span className="text-xs text-gray-500">{rules.length} {rules.length === 1 ? 'rule' : 'rules'}</span>
        </div>
      </header>
      <table className="w-full">
        <thead>
          <tr className="bg-gray-50/30">
            <th className="text-left px-4 py-2 text-[10px] font-semibold uppercase tracking-wide text-gray-500 w-[90px] border-b border-gray-100">Section</th>
            <th className="text-left px-4 py-2 text-[10px] font-semibold uppercase tracking-wide text-gray-500 border-b border-gray-100">Required partial</th>
            <th className="text-left px-4 py-2 text-[10px] font-semibold uppercase tracking-wide text-gray-500 w-[150px] border-b border-gray-100">Team scope</th>
            <th className="px-4 py-2 w-12 border-b border-gray-100"></th>
          </tr>
        </thead>
        <tbody>
          {sortedRules.map((rule) => {
            const partial = PARTIALS.find((p) => p.id === rule.partialId)
            const isOverridden = overriddenRuleIds.has(rule.id)
            const replacedBy = overrideReplacedBy.get(rule.id)
            return (
              <Fragment key={rule.id}>
                <tr className={`border-b border-gray-100 last:border-b-0 transition-colors ${isOverridden ? 'bg-gray-50/60' : 'hover:bg-gray-50/40'}`}>
                  <td className="px-4 py-3 align-middle">
                    {partial ? <SectionPill section={partial.section as PartialSection} /> : null}
                  </td>
                  <td className="px-4 py-3 align-middle">
                    {partial ? (
                      <div className="flex items-center gap-2 flex-wrap">
                        <Link
                          to={`/partials/${partial.id}`}
                          className={`text-sm font-medium ${isOverridden ? 'text-gray-400 line-through' : 'text-primary hover:underline'}`}
                        >
                          {partial.name}
                        </Link>
                        {partial.lifecycle === 'Inactive' && (
                          <span
                            className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide bg-red-50 text-red-700 border border-red-200"
                            title="This partial is inactive. Templates created under this rule will fail to compile until it's reactivated or the rule is removed."
                          >
                            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                            </svg>
                            Inactive
                          </span>
                        )}
                        {isOverridden && replacedBy && (
                          <span className="text-xs text-gray-500 italic">
                            Replaced by {replacedBy} rule below
                          </span>
                        )}
                      </div>
                    ) : (
                      <span className="text-sm text-gray-400 italic">Missing partial</span>
                    )}
                  </td>
                  <td className="px-4 py-3 align-middle">
                    <TeamChip team={rule.team} />
                  </td>
                  <td className="px-2 py-3 align-middle text-right">
                    <RowActions
                      onEditRule={() => onEdit(rule)}
                      onEditPartial={() => {
                        // Per designer feedback item 28: "Edit partial" should navigate
                        // to the partial editor itself, not the rule editor.
                        if (partial) navigate(`/admin/partials/${partial.id}/edit`)
                      }}
                      onRemove={() => onConfirmDelete(rule.id)}
                    />
                  </td>
                </tr>
              </Fragment>
            )
          })}
        </tbody>
      </table>

      {/* Remove-rule confirmation modal - per designer feedback item 29:
          "When removing a partial, use a modal to prompt user." */}
      {confirmingRule && (
        <ConfirmModal
          open={true}
          variant="destructive"
          title="Remove this rule?"
          body={
            <div className="space-y-1">
              <p>
                {confirmingPartial ? <em className="not-italic font-medium">{confirmingPartial.name}</em> : 'This partial'}{' '}
                won't be required for{' '}
                <em className="not-italic font-medium">{confirmingRule.team === 'ALL' ? 'every team\'s' : `${confirmingRule.team}'s`}</em>{' '}
                <em className="not-italic font-medium">{confirmingRule.templateType}</em> templates anymore.
              </p>
              <p className="text-gray-500 text-xs">
                {otherRulesForConfirmingPartial > 0
                  ? `It's still required by ${otherRulesForConfirmingPartial} other ${otherRulesForConfirmingPartial === 1 ? 'rule' : 'rules'}, so it can't be deactivated yet.`
                  : 'No other rules require it, so it can now be deactivated if needed.'}
              </p>
            </div>
          }
          confirmLabel="Remove"
          onConfirm={() => onDelete(confirmingRule.id)}
          onCancel={() => onConfirmDelete(null)}
        />
      )}
    </section>
  )
}

// Three-action overflow menu per designer feedback item 28:
// - "Edit rule" - opens the rule editor (was the previous "Edit")
// - "Edit partial" - navigates to the partial editor (NEW; previously the partial-edit
//   action was incorrectly mapped to rule edit)
// - "Remove" - removes the rule (triggers the destructive ConfirmModal)
function RowActions({
  onEditRule, onEditPartial, onRemove,
}: {
  onEditRule: () => void
  onEditPartial: () => void
  onRemove: () => void
}) {
  const [menuOpen, setMenuOpen] = useState(false)
  const [openUpward, setOpenUpward] = useState(false)
  const btnRef = useRef<HTMLButtonElement>(null)

  // Decide whether to open the menu above or below the trigger based on the
  // available space in the viewport. The menu is ~140px tall (3 items + divider);
  // if there's less than that below the trigger, flip it upward.
  const handleToggle = () => {
    if (menuOpen) { setMenuOpen(false); return }
    const rect = btnRef.current?.getBoundingClientRect()
    if (rect) {
      const spaceBelow = window.innerHeight - rect.bottom
      const MENU_HEIGHT = 150
      setOpenUpward(spaceBelow < MENU_HEIGHT)
    }
    setMenuOpen(true)
  }

  return (
    <div className="relative inline-block">
      <button
        ref={btnRef}
        onClick={handleToggle}
        className="text-gray-400 hover:text-gray-600 p-1"
        aria-label="Rule actions"
      >
        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
          <circle cx="12" cy="5" r="1.5" />
          <circle cx="12" cy="12" r="1.5" />
          <circle cx="12" cy="19" r="1.5" />
        </svg>
      </button>
      {menuOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
          <div className={`absolute right-0 w-40 bg-white border border-gray-200 rounded-lg shadow-lg py-1 z-50 text-left ${openUpward ? 'bottom-full mb-1' : 'top-full mt-1'}`}>
            <button
              onClick={() => { setMenuOpen(false); onEditRule() }}
              className="block w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
            >
              Edit rule
            </button>
            <button
              onClick={() => { setMenuOpen(false); onEditPartial() }}
              className="block w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
            >
              Edit partial
            </button>
            <div className="border-t border-gray-100 my-1" />
            <button
              onClick={() => { setMenuOpen(false); onRemove() }}
              className="block w-full text-left px-3 py-2 text-sm text-red-600 hover:bg-red-50"
            >
              Remove
            </button>
          </div>
        </>
      )}
    </div>
  )
}

function RuleFormPanel({
  form, setForm, editing, onSubmit, onCancel, existingRules, editingId,
}: {
  form: FormState
  setForm: (f: FormState) => void
  editing: boolean
  onSubmit: () => void
  onCancel: () => void
  existingRules: RequiredPartialRule[]
  editingId: string | null
}) {
  // Derived value: when adding multiple, the FIRST selected partial powers the
  // conflict/impact preview. When the user has selected multiple, the preview
  // reflects just the first; rules are still created for all on submit.
  const primaryPartialId = form.partialIds[0] ?? ''
  const canSubmit = !!form.team && !!form.templateType && form.partialIds.length > 0
  const partial = primaryPartialId ? PARTIALS.find((p) => p.id === primaryPartialId) : null

  // Eligible partials: any active partial. Partials are universal - the rule layer
  // determines which team's templates use which partial.
  const eligiblePartials = useMemo(() => {
    return PARTIALS.filter((p) => p.lifecycle === 'Active')
  }, [])

  const duplicate = existingRules.find(
    (r) =>
      r.id !== editingId &&
      r.team === form.team &&
      r.templateType === form.templateType &&
      r.partialId === primaryPartialId,
  )

  // Section relationships with other rules.
  // Header/Footer are unique per template; Body allows multiples.
  // Two cases:
  //   1) BLOCKING conflict: another rule at the same scope (team + templateType) already
  //      uses a different partial in the same Header/Footer section.
  //   2) OVERRIDE note: an ALL-team rule covers the same section; this team-specific rule
  //      will replace it for this team at template creation.
  const { sectionConflict, sectionOverride } = useMemo(() => {
    if (!partial || !form.team || !form.templateType || partial.section === 'Body') {
      return { sectionConflict: null, sectionOverride: null }
    }
    let conflict = null as RequiredPartialRule | null
    let override = null as RequiredPartialRule | null
    for (const r of existingRules) {
      if (r.id === editingId) continue
      if (r.partialId === primaryPartialId) continue
      if (r.templateType !== form.templateType) continue
      const otherPartial = PARTIALS.find((p) => p.id === r.partialId)
      if (otherPartial?.section !== partial.section) continue
      const sameScope = r.team === form.team
      if (sameScope) { conflict = r; break }
      // Cross-scope override: r is broader (ALL) than this rule
      if (r.team === 'ALL' && form.team !== 'ALL') override = r
    }
    return { sectionConflict: conflict, sectionOverride: override }
  }, [partial, form, existingRules, editingId])

  const conflictingPartial = sectionConflict
    ? PARTIALS.find((p) => p.id === sectionConflict.partialId)
    : null
  const overridingPartial = sectionOverride
    ? PARTIALS.find((p) => p.id === sectionOverride.partialId)
    : null

  const impact = useMemo(() => {
    if (!canSubmit || !partial) return null
    const team = form.team as RuleTeam
    const matchingTemplates = TEMPLATES.filter((t) => {
      if (t.templateType !== form.templateType) return false
      if (team !== 'ALL' && t.owningTeam !== team) return false
      return true
    })
    const missingPartial = matchingTemplates.filter((t) => !t.requiredPartialIds.includes(primaryPartialId))
    return {
      total: matchingTemplates.length,
      missing: missingPartial.length,
    }
  }, [canSubmit, partial, form])

  const handleTeamChange = (next: RuleTeam | '') => {
    // If the currently selected partials are no longer eligible under the new team, clear.
    const partialStillEligible = form.partialIds.length > 0
      ? form.partialIds.every((pid) => PARTIALS.some((p) => p.id === pid && p.lifecycle === 'Active'))
      : true
    // If the currently selected template type is no longer applicable to the new team, clear it.
    const typeStillApplicable = form.templateType
      ? (!next || next === 'ALL' || TEMPLATE_TYPE_APPLICABILITY[form.templateType as TemplateType]?.includes(next as OwningTeam))
      : true
    setForm({
      ...form,
      team: next,
      // Clear all selected partials when team change makes them ineligible.
      partialIds: partialStillEligible ? form.partialIds : [],
      templateType: typeStillApplicable ? form.templateType : '',
    })
  }

  return (
    // DF2: Slide-in side panel (drawer) - replaces the inline expanding block
    // so the rules list never scrolls out of view when adding/editing a rule.
    <div className="fixed inset-0 z-40 flex justify-end" role="dialog" aria-modal="true">
      {/* Backdrop - click to dismiss */}
      <div className="absolute inset-0 bg-gray-900/20" onClick={onCancel} />
      <aside className="relative w-full max-w-[480px] h-full bg-white shadow-xl border-l border-gray-200 flex flex-col">
      <div className="px-6 py-4 flex items-start justify-between border-b border-gray-100 shrink-0">
        <div>
          <h3 className="text-base font-semibold text-gray-900">
            {editing ? 'Edit rule' : 'Add a required partial'}
          </h3>
          <p className="text-xs text-gray-500 mt-1">
            Pick a partial that must be included in a team's templates.
          </p>
        </div>
        <button onClick={onCancel} className="text-gray-400 hover:text-gray-600 -mr-1 -mt-1" aria-label="Close">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div className="px-6 py-5 space-y-5 flex-1 overflow-y-auto">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Team</label>
            <FilterSelect
              value={form.team}
              onChange={(v) => handleTeamChange(v as RuleTeam | '')}
              placeholder="Select team…"
              options={TEAM_OPTIONS.map((t) => ({
                value: t,
                label: t === 'ALL' ? 'ALL (global)' : t,
              }))}
              fullWidth
              height="md"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Template type</label>
            <FilterSelect
              value={form.templateType}
              onChange={(v) => setForm({ ...form, templateType: v as TemplateType | '' })}
              placeholder="Select type…"
              options={TEMPLATE_TYPES.filter((t) => {
                if (t === 'Others') return false
                if (!form.team || form.team === 'ALL') return true
                return TEMPLATE_TYPE_APPLICABILITY[t]?.includes(form.team as OwningTeam)
              }).map((t) => ({ value: t, label: t }))}
              fullWidth
              height="md"
            />
            {form.team && form.team !== 'ALL' && (
              <p className="text-xs text-gray-500 mt-1">
                Showing template types {form.team} uses.
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Required {editing ? 'partial' : 'partial(s)'}
            </label>
            {editing ? (
              // Edit mode - single rule = single partial. Use the existing dropdown picker.
              <PartialPicker
                partials={eligiblePartials}
                value={form.partialIds[0] ?? ''}
                disabled={!form.team}
                placeholder={form.team ? 'Search and pick a partial…' : 'Pick a team first'}
                onChange={(id) => setForm({ ...form, partialIds: [id] })}
              />
            ) : (
              // Add mode - multi-select per designer feedback item 27.
              // User picks one or more partials; the form creates one rule per selection.
              <MultiPartialPicker
                partials={eligiblePartials}
                value={form.partialIds}
                disabled={!form.team}
                placeholder={form.team ? 'Pick one or more partials…' : 'Pick a team first'}
                onChange={(ids) => setForm({ ...form, partialIds: ids })}
              />
            )}
          </div>

        </div>

        {duplicate && (
          <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2">
            This rule already exists.
          </div>
        )}

        {sectionConflict && conflictingPartial && !duplicate && (
          <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2.5">
            {sectionConflict.team === 'ALL' ? 'All teams already use' : `${sectionConflict.team} already uses`}{' '}
            <em className="not-italic font-medium">{conflictingPartial.name}</em>{' '}
            as the {partial?.section?.toLowerCase()} for {sectionConflict.templateType} templates. You can only have one {partial?.section?.toLowerCase()} per template. Pick a different partial, or remove the existing rule first.
          </div>
        )}

        {sectionOverride && overridingPartial && !duplicate && !sectionConflict && (
          <div className="text-sm text-amber-900 bg-amber-50 border border-amber-200 rounded-md px-3 py-2.5">
            Today, {sectionOverride.team === 'ALL' ? 'every team' : sectionOverride.team} uses{' '}
            <em className="not-italic font-medium">{overridingPartial.name}</em> as the {partial?.section?.toLowerCase()} for {sectionOverride.templateType} templates. This rule will change that for{' '}
            <em className="not-italic font-medium">{form.team === 'ALL' ? 'all teams' : form.team}</em>.
          </div>
        )}

        {impact && !duplicate && !sectionConflict && (
          <div className="text-sm text-gray-700 bg-amber-50/60 border border-amber-200 rounded-md px-3 py-2.5">
            {impact.total === 0 ? (
              <>From now on, new templates of type <em className="not-italic font-medium">{form.templateType}</em> will include <em className="not-italic font-medium">{partial?.name}</em>. There are no existing ones to update.</>
            ) : impact.missing === 0 ? (
              <>From now on, new templates of type <em className="not-italic font-medium">{form.templateType}</em> will include <em className="not-italic font-medium">{partial?.name}</em>. Every existing one already does.</>
            ) : (
              <>
                From now on, new templates of type <em className="not-italic font-medium">{form.templateType}</em> will include <em className="not-italic font-medium">{partial?.name}</em>.{' '}
                <strong className="font-medium">{impact.missing}</strong> existing {impact.missing === 1 ? 'one' : 'ones'} will need it added the next time {impact.missing === 1 ? "it's" : "they're"} edited.
              </>
            )}
          </div>
        )}

        {/* Info note inside the scroll area so footer stays anchored. */}
        <div className="text-xs text-gray-500 flex items-start gap-1.5 bg-gray-50 border border-gray-100 rounded-md px-3 py-2.5">
          <svg className="w-3.5 h-3.5 shrink-0 mt-0.5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
          </svg>
          <div className="space-y-0.5">
            <p>
              <strong className="font-medium text-gray-600">Header &amp; Footer:</strong> team rules replace the global rule for that team.
            </p>
            <p>
              <strong className="font-medium text-gray-600">Body:</strong> both global and team rules apply additively.
            </p>
          </div>
        </div>
      </div>

      <div className="px-6 py-3 border-t border-gray-100 bg-white flex items-center justify-end gap-2 shrink-0">
        <button
          onClick={onCancel}
          className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900 hover:bg-gray-50 border border-gray-200 rounded-md"
        >
          Cancel
        </button>
        <button
          onClick={onSubmit}
          disabled={!canSubmit || !!duplicate || !!sectionConflict}
          className="px-4 py-2 text-sm font-medium text-white bg-primary hover:bg-primary-hover rounded-md disabled:opacity-40 disabled:cursor-not-allowed shadow-sm"
        >
          {editing ? 'Save changes' : 'Add rule'}
        </button>
      </div>
      </aside>
    </div>
  )
}

// ─── Searchable partial picker ─────────────────────────────────────────────
function PartialPicker({
  partials, value, disabled, placeholder, onChange,
}: {
  partials: typeof PARTIALS
  value: string
  disabled?: boolean
  placeholder: string
  onChange: (id: string) => void
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  useEffect(() => {
    if (open) inputRef.current?.focus()
  }, [open])

  const selected = partials.find((p) => p.id === value)

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return partials
    return partials.filter((p) =>
      p.name.toLowerCase().includes(q) ||
      p.section.toLowerCase().includes(q) ||
      p.authoringTeam.toLowerCase().includes(q),
    )
  }, [partials, query])

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={() => !disabled && setOpen(!open)}
        disabled={disabled}
        className={`h-11 w-full text-left border rounded-md text-sm pl-3 pr-9 bg-white flex items-center justify-between gap-2 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary ${
          disabled ? 'border-gray-200 text-gray-400 cursor-not-allowed bg-gray-50' : 'border-gray-300 hover:border-gray-400'
        }`}
      >
        <span className={`truncate ${selected ? 'text-gray-900' : 'text-gray-400'}`}>
          {selected
            ? `${selected.name} | ${selected.section} | by ${selected.authoringTeam}`
            : placeholder}
        </span>
        <svg className="w-4 h-4 text-gray-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg z-50 overflow-hidden">
          <div className="p-2 border-b border-gray-100">
            <div className="relative">
              <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search by name, section, or team…"
                className="w-full h-9 pl-8 pr-3 border border-gray-200 rounded text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
              />
            </div>
          </div>
          <div className="max-h-64 overflow-y-auto py-1">
            {filtered.length === 0 ? (
              <div className="px-3 py-4 text-sm text-gray-500 text-center">No partials match "{query}".</div>
            ) : (
              filtered.map((p) => {
                const isSelected = p.id === value
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => { onChange(p.id); setOpen(false); setQuery('') }}
                    className={`w-full text-left px-3 py-2 text-sm flex items-start gap-2 hover:bg-gray-50 ${isSelected ? 'bg-primary/5' : ''}`}
                  >
                    <span className={`shrink-0 w-4 h-4 mt-0.5 ${isSelected ? 'text-primary' : 'text-transparent'}`}>
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                      </svg>
                    </span>
                    <span className="flex-1 min-w-0">
                      <div className="text-gray-900 font-medium truncate">{p.name}</div>
                      <div className="text-xs text-gray-500">{p.section} · by {p.authoringTeam}</div>
                    </span>
                  </button>
                )
              })
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// Multi-select partial picker for ADD mode (designer feedback item 27).
// Same dropdown layout as PartialPicker, but each row is a checkbox.
// Selected partials display as removable chips in the trigger.
function MultiPartialPicker({
  partials, value, disabled, placeholder, onChange,
}: {
  partials: typeof PARTIALS
  value: string[]
  disabled?: boolean
  placeholder: string
  onChange: (ids: string[]) => void
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const selected = partials.filter((p) => value.includes(p.id))
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return partials
    return partials.filter((p) =>
      p.name.toLowerCase().includes(q) ||
      p.section.toLowerCase().includes(q) ||
      p.authoringTeam.toLowerCase().includes(q),
    )
  }, [partials, query])

  const toggle = (id: string) => {
    if (value.includes(id)) onChange(value.filter((v) => v !== id))
    else onChange([...value, id])
  }

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={() => !disabled && setOpen(!open)}
        disabled={disabled}
        className={`min-h-11 w-full text-left border rounded-md text-sm pl-3 pr-9 py-1.5 bg-white flex items-center justify-between gap-2 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary ${
          disabled ? 'border-gray-200 text-gray-400 cursor-not-allowed bg-gray-50' : 'border-gray-300 hover:border-gray-400'
        }`}
      >
        <span className="flex flex-wrap gap-1 min-w-0 flex-1">
          {selected.length === 0 ? (
            <span className="text-gray-400">{placeholder}</span>
          ) : (
            selected.map((p) => (
              // DF2 designer feedback: Tag component, Light Gray/Default variant.
              <span
                key={p.id}
                className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-gray-100 text-gray-700 text-xs font-medium"
                onClick={(e) => e.stopPropagation()}
              >
                {p.name}
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); toggle(p.id) }}
                  className="text-gray-500 hover:text-gray-800 leading-none"
                  aria-label={`Remove ${p.name}`}
                >×</button>
              </span>
            ))
          )}
        </span>
        <svg className="w-4 h-4 text-gray-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg z-50 overflow-hidden">
          <div className="p-2 border-b border-gray-100">
            <div className="relative">
              <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search by name, section, or team…"
                className="w-full h-9 pl-8 pr-3 border border-gray-200 rounded text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
              />
            </div>
          </div>
          <div className="max-h-64 overflow-y-auto py-1">
            {filtered.length === 0 ? (
              <div className="px-3 py-4 text-sm text-gray-500 text-center">No partials match "{query}".</div>
            ) : (
              filtered.map((p) => {
                const checked = value.includes(p.id)
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => toggle(p.id)}
                    className={`w-full text-left px-3 py-2 text-sm flex items-start gap-2 hover:bg-gray-50 ${checked ? 'bg-primary/5' : ''}`}
                  >
                    <span className={`shrink-0 w-4 h-4 mt-0.5 inline-flex items-center justify-center rounded border ${checked ? 'bg-primary border-primary text-white' : 'border-gray-300 bg-white'}`}>
                      {checked && (
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                        </svg>
                      )}
                    </span>
                    <span className="flex-1 min-w-0">
                      <div className="text-gray-900 font-medium truncate">{p.name}</div>
                      <div className="text-xs text-gray-500">{p.section} · by {p.authoringTeam}</div>
                    </span>
                  </button>
                )
              })
            )}
          </div>
          {selected.length > 0 && (
            <div className="border-t border-gray-100 px-3 py-2 text-xs text-gray-500 bg-gray-50">
              {selected.length} {selected.length === 1 ? 'partial' : 'partials'} selected. One rule will be created per selection.
            </div>
          )}
        </div>
      )}
    </div>
  )
}
