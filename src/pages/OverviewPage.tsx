import { useMemo } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { format } from 'date-fns'
import { ArrowRight, CircleCheck, FileText, PenLine, Puzzle, ShieldCheck, TriangleAlert } from 'lucide-react'
import { useCurrentUser } from '../hooks/useCurrentUser'
import { getAllTemplates } from '../data/session-store'
import { evaluateTemplateCompliance } from '../data/rule-compliance'
import { PARTIALS } from '../data/partials'
import { AUDIT_EVENTS } from '../data/audit-events'
import { OWNING_TEAMS } from '../data/taxonomy'
import { Avatar } from '../components/shared/Avatar'
import type { AuditEvent } from '../data/types'

function greeting(): string {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 18) return 'Good afternoon'
  return 'Good evening'
}

// "sarah.r@meridianworks.example" → "Sarah R"
function nameFromEmail(email: string): string {
  return email
    .split('@')[0]
    .split('.')
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join(' ')
}

function eventHref(e: AuditEvent): string {
  if (e.entityType === 'template') return `/templates/${e.entityId}`
  if (e.entityType === 'partial') return `/partials/${e.entityId}`
  return '/admin/projects'
}

const ACTION_LABEL: Record<AuditEvent['action'], string> = {
  created: 'created',
  updated: 'updated',
  activated: 'activated',
  deactivated: 'deactivated',
  deleted: 'deleted',
}

export function OverviewPage() {
  const { user, hasEntered } = useCurrentUser()

  const data = useMemo(() => {
    const templates = getAllTemplates()
    const evaluated = templates.map((t) => ({ template: t, compliance: evaluateTemplateCompliance(t) }))
    const governed = evaluated.filter((e) => e.compliance.applicableRules.length > 0)
    const nonCompliant = evaluated.filter((e) => e.compliance.missingPartialIds.length > 0)
    const coverage = governed.length
      ? Math.round(((governed.length - nonCompliant.length) / governed.length) * 100)
      : 100

    const journey = OWNING_TEAMS.map((team) => {
      const own = evaluated.filter((e) => e.template.owningTeam === team)
      return {
        team,
        total: own.length,
        active: own.filter((e) => e.template.lifecycle === 'Active').length,
        needsReview: own.filter((e) => e.compliance.missingPartialIds.length > 0).length,
      }
    })

    const activePartials = PARTIALS.filter((p) => p.lifecycle === 'Active')
    const topPartials = [...activePartials]
      .sort((a, b) => (b.usedInCount ?? 0) - (a.usedInCount ?? 0))
      .slice(0, 4)

    const recent = [...AUDIT_EVENTS]
      .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
      .slice(0, 6)

    return {
      activeCount: templates.filter((t) => t.lifecycle === 'Active').length,
      draftCount: templates.filter((t) => t.lifecycle === 'Draft').length,
      teamsSending: journey.filter((j) => j.total > 0).length,
      coverage,
      nonCompliant,
      journey,
      activePartialCount: activePartials.length,
      partialReuse: activePartials.reduce((sum, p) => sum + (p.usedInCount ?? 0), 0),
      topPartials,
      maxUsage: Math.max(1, ...topPartials.map((p) => p.usedInCount ?? 0)),
      recent,
    }
  }, [])

  if (!hasEntered) return <Navigate to="/login" replace />

  const firstName = user.name.split(' ')[0]

  return (
    <div className="pt-8 pb-4">
      {/* Greeting */}
      <header className="reveal">
        <p className="text-sm text-gray-500">{format(new Date(), 'EEEE, MMMM d')}</p>
        <h1 className="mt-1 text-[28px] leading-tight font-semibold tracking-tight text-ink">
          {greeting()}, {firstName}
        </h1>
        <p className="mt-1.5 text-[15px] text-gray-600">
          Here's how Meridian Works sounds across {data.teamsSending} teams today.
        </p>
      </header>

      {/* Stat tiles */}
      <section className="mt-7 grid grid-cols-2 lg:grid-cols-4 gap-3" aria-label="Summary">
        <StatTile
          delay={1}
          icon={FileText}
          label="Active templates"
          value={String(data.activeCount)}
          caption={`Sent by ${data.teamsSending} teams`}
          to="/templates?status=Active"
        />
        <StatTile
          delay={2}
          icon={ShieldCheck}
          label="Required-partial coverage"
          value={`${data.coverage}%`}
          caption={
            data.nonCompliant.length
              ? `${data.nonCompliant.length} template${data.nonCompliant.length === 1 ? '' : 's'} missing a required partial`
              : 'Every governed template is compliant'
          }
          tone={data.nonCompliant.length ? 'warn' : 'ok'}
          to="/templates?nonCompliant=1"
          meter={data.coverage}
        />
        <StatTile
          delay={3}
          icon={PenLine}
          label="Drafts in progress"
          value={String(data.draftCount)}
          caption="Not yet live"
          to="/templates?status=Draft"
        />
        <StatTile
          delay={4}
          icon={Puzzle}
          label="Shared partials"
          value={String(data.activePartialCount)}
          caption={`Reused ${data.partialReuse} times in live templates`}
          to="/partials"
        />
      </section>

      {/* Contributor journey */}
      <section className="reveal mt-6 bg-white border border-gray-200 rounded-xl p-5" style={{ animationDelay: '250ms' }}>
        <div className="flex items-baseline justify-between gap-4">
          <div>
            <h2 className="text-base font-semibold text-ink">One contributor, many teams</h2>
            <p className="mt-0.5 text-sm text-gray-500">
              Who speaks to a Meridian Works contributor, in journey order. Select a team to see its templates.
            </p>
          </div>
          <Legend />
        </div>

        <div className="mt-6 overflow-x-auto -mx-1 px-1 pb-1">
          <ol className="relative grid min-w-[720px]" style={{ gridTemplateColumns: `repeat(${data.journey.length}, minmax(0, 1fr))` }}>
            {/* Connector line through the node centers */}
            <span aria-hidden="true" className="absolute top-5 h-0.5 bg-primary-tint" style={{ left: `${50 / data.journey.length}%`, right: `${50 / data.journey.length}%` }} />
            {data.journey.map((stop) => (
              <li key={stop.team} className="relative flex flex-col items-center text-center">
                <Link
                  to={`/templates?team=${encodeURIComponent(stop.team)}`}
                  className="group flex flex-col items-center focus:outline-none"
                  aria-label={`${stop.team}: ${stop.total} templates${stop.needsReview ? `, ${stop.needsReview} need review` : ''}`}
                >
                  <span
                    className={`relative w-10 h-10 rounded-full grid place-items-center text-sm font-semibold transition-transform group-hover:scale-110 group-focus-visible:ring-2 group-focus-visible:ring-primary/40 ${
                      stop.total === 0
                        ? 'bg-white border-2 border-dashed border-gray-300 text-gray-400'
                        : 'bg-primary text-white'
                    }`}
                  >
                    {stop.total || '–'}
                    {stop.needsReview > 0 && (
                      <span className="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-accent ring-2 ring-white" />
                    )}
                  </span>
                  <span className="mt-2.5 text-[13px] font-medium text-ink group-hover:text-primary">{stop.team}</span>
                  <span className="text-xs text-gray-500">
                    {stop.total === 0 ? 'No templates yet' : `${stop.active} live`}
                  </span>
                </Link>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Attention + activity */}
      <div className="mt-6 grid gap-6 lg:grid-cols-5">
        <section className="reveal lg:col-span-3 bg-white border border-gray-200 rounded-xl" style={{ animationDelay: '320ms' }}>
          <div className="px-5 pt-5 pb-3 flex items-center justify-between">
            <h2 className="text-base font-semibold text-ink">Needs attention</h2>
            <Link to="/templates?nonCompliant=1" className="text-sm text-primary hover:underline inline-flex items-center gap-1">
              View all <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
            </Link>
          </div>
          {data.nonCompliant.length === 0 ? (
            <div className="px-5 pb-6 flex items-center gap-2 text-sm text-gray-600">
              <CircleCheck className="w-4 h-4 text-primary" aria-hidden="true" />
              Every template includes its required partials.
            </div>
          ) : (
            <ul>
              {data.nonCompliant.slice(0, 5).map(({ template, compliance }) => (
                <li key={template.id} className="border-t border-gray-100">
                  <Link to={`/templates/${template.id}`} className="flex items-start gap-3 px-5 py-3 hover:bg-canvas transition-colors">
                    <TriangleAlert className="w-4 h-4 mt-0.5 shrink-0 text-accent" aria-hidden="true" />
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-medium text-ink truncate">{template.name}</span>
                      <span className="block text-xs text-gray-500 mt-0.5">
                        {template.owningTeam} · Missing {compliance.missingPartialNames.join(', ')}
                      </span>
                    </span>
                    <span className="text-xs text-gray-500 shrink-0 mt-0.5">{template.lifecycle}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="reveal lg:col-span-2 bg-white border border-gray-200 rounded-xl" style={{ animationDelay: '380ms' }}>
          <h2 className="px-5 pt-5 pb-3 text-base font-semibold text-ink">Recent activity</h2>
          <ul className="pb-2">
            {data.recent.map((e) => (
              <li key={e.id}>
                <Link to={eventHref(e)} className="flex items-start gap-3 px-5 py-2.5 hover:bg-canvas transition-colors">
                  <Avatar email={e.actor} size="sm" />
                  <span className="min-w-0 text-sm text-gray-700">
                    <span className="font-medium text-ink">{nameFromEmail(e.actor)}</span> {ACTION_LABEL[e.action]}{' '}
                    <span className="font-medium text-ink">{e.entityName}</span>
                    <span className="block text-xs text-gray-500 mt-0.5">
                      {e.entityType.charAt(0).toUpperCase() + e.entityType.slice(1)} · {format(new Date(e.timestamp), 'MMM d, yyyy')}
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      </div>

      {/* Most reused partials */}
      <section className="reveal mt-6 bg-white border border-gray-200 rounded-xl p-5" style={{ animationDelay: '440ms' }}>
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-ink">Most reused partials</h2>
            <p className="mt-0.5 text-sm text-gray-500">Edit one of these and every live template that uses it updates.</p>
          </div>
          <Link to="/partials" className="text-sm text-primary hover:underline inline-flex items-center gap-1">
            All partials <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
          </Link>
        </div>
        <ul className="mt-4 grid gap-3 sm:grid-cols-2">
          {data.topPartials.map((p) => (
            <li key={p.id}>
              <Link to={`/partials/${p.id}`} className="block rounded-lg border border-gray-100 px-4 py-3 hover:border-primary/40 transition-colors">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-sm font-medium text-ink truncate">{p.name}</span>
                  <span className="text-xs text-gray-500 shrink-0">
                    {p.section} · {p.usedInCount ?? 0} live
                  </span>
                </div>
                <div className="mt-2 h-1.5 rounded-full bg-gray-100 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-primary"
                    style={{ width: `${((p.usedInCount ?? 0) / data.maxUsage) * 100}%` }}
                  />
                </div>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}

function StatTile({
  icon: Icon,
  label,
  value,
  caption,
  to,
  delay,
  tone,
  meter,
}: {
  icon: typeof FileText
  label: string
  value: string
  caption: string
  to: string
  delay: number
  tone?: 'ok' | 'warn'
  meter?: number
}) {
  return (
    <Link
      to={to}
      className="reveal group bg-white border border-gray-200 rounded-xl p-4 hover:border-primary/40 hover:shadow-sm transition-all"
      style={{ animationDelay: `${delay * 50}ms` }}
    >
      <div className="flex items-center justify-between">
        <span className="text-[13px] text-gray-600">{label}</span>
        <Icon className="w-4 h-4 text-gray-400 group-hover:text-primary transition-colors" aria-hidden="true" />
      </div>
      <div className="mt-2 text-[28px] leading-none font-semibold tracking-tight text-ink tabular-nums">{value}</div>
      {meter !== undefined && (
        <div className="mt-3 h-1.5 rounded-full bg-gray-100 overflow-hidden">
          <div className={`h-full rounded-full ${tone === 'warn' ? 'bg-accent' : 'bg-primary'}`} style={{ width: `${meter}%` }} />
        </div>
      )}
      <div className={`mt-2 text-xs ${tone === 'warn' ? 'text-accent-text' : 'text-gray-500'}`}>{caption}</div>
    </Link>
  )
}

function Legend() {
  return (
    <div className="hidden md:flex items-center gap-4 text-xs text-gray-500 shrink-0">
      <span className="inline-flex items-center gap-1.5">
        <span className="w-2.5 h-2.5 rounded-full bg-primary" /> Templates owned
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span className="w-2.5 h-2.5 rounded-full bg-accent" /> Needs review
      </span>
    </div>
  )
}
