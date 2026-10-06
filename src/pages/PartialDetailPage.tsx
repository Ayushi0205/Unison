import { useState } from 'react'
import { Link, useParams, useNavigate, useSearchParams, useLocation } from 'react-router-dom'
import { format } from 'date-fns'
import { PARTIALS, savePartial } from '../data/partials'
import { TEMPLATES } from '../data/templates'
import { AUDIT_EVENTS } from '../data/audit-events'
import { REQUIRED_PARTIAL_RULES } from '../data/required-partial-rules'
import { useCurrentUser } from '../hooks/useCurrentUser'
import { Breadcrumbs } from '../components/shared/Breadcrumbs'
import { StatusPill } from '../components/shared/StatusPill'
import { Avatar } from '../components/shared/Avatar'
import { ConfirmModal } from '../components/shared/ConfirmModal'
import { useToast } from '../components/shared/Toast'
import { neutralizeAttributeTokens } from '../utils/preview'

function emailToName(email: string) {
  const local = email.split('@')[0] || ''
  return local.split('.').map((s) => s.charAt(0).toUpperCase() + s.slice(1)).join(' ')
}

// Extract {{varName}} references from partial body
function extractVariableRefs(body: string): string[] {
  const matches = body.match(/\{\{([^}]+)\}\}/g) || []
  return Array.from(new Set(matches.map((m) => m.replace(/\{\{|\}\}/g, '').trim())))
}

// Substitute sample values into the body; remaining unfilled {{tokens}} render as amber chips.
function compileBodyForPreview(body: string, sampleValues: Record<string, string>): string {
  let result = body
  for (const [name, val] of Object.entries(sampleValues)) {
    if (val.trim()) {
      const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      // DF2-10: strip the entire var-chip span so filled vars don't stay yellow.
      result = result.replace(
        new RegExp(`<span[^>]*data-var="${escapedName}"[^>]*>[^<]*</span>`, 'g'),
        val,
      )
      result = result.replace(new RegExp(`\\{\\{\\s*${escapedName}\\s*\\}\\}`, 'g'), val)
    }
  }
  result = neutralizeAttributeTokens(result)
  result = result.replace(
    /\{\{([^}]+)\}\}/g,
    (_m, name) =>
      `<span style="display:inline-block;background:#fffbeb;color:#111827;padding:1px 8px;border-radius:6px;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:0.92em;border:1px solid #a16207">{{ ${name.trim()} }}</span>`,
  )
  return result
}

// Format HTML body with {{var}} tokens highlighted and basic indentation
function formatSourceWithTokens(body: string): Array<{ kind: 'text' | 'var'; value: string }> {
  const indented = body.replace(/></g, '>\n<')
  const parts: Array<{ kind: 'text' | 'var'; value: string }> = []
  const re = /\{\{([^}]+)\}\}/g
  let lastIdx = 0
  let m: RegExpExecArray | null
  while ((m = re.exec(indented)) !== null) {
    if (m.index > lastIdx) parts.push({ kind: 'text', value: indented.slice(lastIdx, m.index) })
    parts.push({ kind: 'var', value: `{{${m[1].trim()}}}` })
    lastIdx = re.lastIndex
  }
  if (lastIdx < indented.length) parts.push({ kind: 'text', value: indented.slice(lastIdx) })
  return parts
}

export function PartialDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user } = useCurrentUser()
  const toast = useToast()
  // Per designer feedback item 8: if the user navigated here FROM a template detail,
  // show a "← Back to {template name}" link at the top.
  const [searchParams] = useSearchParams()
  const location = useLocation()
  const fromParam = searchParams.get('from')
  const [view, setView] = useState<'preview' | 'source'>('preview')
  const [copied, setCopied] = useState(false)
  const [confirmKind, setConfirmKind] = useState<'duplicate' | 'deactivate' | 'reactivate' | null>(null)
  // Right-sidebar accordion states. Details and Preview open by default to match
  // designer's spec (Details first, contents visible immediately).
  const [detailsOpen, setDetailsOpen] = useState(true)
  const [varsOpenState, setVarsOpenState] = useState(true)
  const [sampleValues, setSampleValues] = useState<Record<string, string>>({})
  const [localLifecycle, setLocalLifecycle] = useState<'Active' | 'Inactive' | null>(null)

  const basePartial = PARTIALS.find((p) => p.id === id)
  const partial = basePartial
    ? (localLifecycle ? { ...basePartial, lifecycle: localLifecycle } : basePartial)
    : undefined

  if (!partial) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <svg className="w-12 h-12 text-gray-300 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9 5.25h.008v.008H12v-.008z" />
        </svg>
        <h2 className="text-xl font-semibold text-gray-900 mb-2">Partial not found</h2>
        <p className="text-sm text-gray-500 mb-4">This partial may have been deleted or the link is incorrect.</p>
        <button onClick={() => navigate('/partials')} className="text-sm text-primary font-medium hover:underline">← Back to Partials</button>
      </div>
    )
  }

  const isAdmin = user.role === 'admin'
  const isInactive = partial.lifecycle === 'Inactive'

  // Blast radius is keyed on ACTIVE templates only - they're the ones sending right now.
  // Drafts are future blast radius (shown as a sub-line). Inactive templates are
  // historical noise: they don't send, they don't block deactivation, and their
  // partial references are discoverable from the template side. Don't show them.
  const allDependents = TEMPLATES.filter((t) => t.requiredPartialIds.includes(partial.id))
  const activeDependents = allDependents.filter((t) => t.lifecycle === 'Active')
  const draftDependents = allDependents.filter((t) => t.lifecycle === 'Draft')
  const usedIn = activeDependents.length

  const requiredByTypes = Array.from(
    new Set(
      REQUIRED_PARTIAL_RULES
        .filter((r) => r.partialId === partial.id)
        .map((r) => r.templateType),
    ),
  )

  const deactivationBlocked = usedIn > 0 || requiredByTypes.length > 0

  const varRefs = extractVariableRefs(partial.body)

  const auditEvents = AUDIT_EVENTS
    .filter((e) => e.entityId === partial.id)
    .sort((a, b) => b.timestamp.localeCompare(a.timestamp))

  const actionLabels: Record<string, string> = {
    created: 'Created', updated: 'Updated', activated: 'Activated', deactivated: 'Deactivated', deleted: 'Deleted',
  }
  // DF2-5: align Activity badges with StatusPill color guidelines.
  // Per designer screenshot: UPDATED is parrot-green (recent change); CREATED uses
  // the muted gray pill (origin event). Activated mirrors Updated; Deactivated muted.
  const actionColors: Record<string, string> = {
    created: 'bg-gray-200 text-gray-700',
    updated: 'bg-primary-tint text-primary-strong',
    activated: 'bg-primary-tint text-primary-strong',
    deactivated: 'bg-gray-200 text-gray-500',
    deleted: 'bg-red-100 text-red-700',
  }

  return (
    <div className="max-w-5xl space-y-7">
      {/* Sticky page-header region - top nav + breadcrumbs (or "← Previous Page"
          variant when from-param set) + identity strip with name/status/actions.
          The body content below scrolls under this header. */}
      <div className="sticky top-0 bg-white z-10 pt-6 pb-4 space-y-3 border-b border-gray-100">
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
            { label: 'Partials', to: '/partials' },
            { label: partial.name },
          ]} />
        )}

        {/* Identity strip - name, status, inline metadata, admin actions */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3 flex-wrap min-w-0">
            <h1 className={`text-2xl font-semibold ${isInactive ? 'text-gray-400 line-through' : 'text-gray-900'}`}>
              {partial.name}
            </h1>
            <StatusPill status={partial.lifecycle} />
            {usedIn > 0 && !isInactive && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-amber-50 text-amber-800 border border-amber-200">
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                </svg>
                Editing affects {usedIn} template{usedIn !== 1 ? 's' : ''} on next send
              </span>
            )}
          </div>

          {isAdmin && (
            <div className="flex items-center gap-2 shrink-0">
              <Link
                to={`/admin/partials/${partial.id}/edit`}
                className="bg-white border border-gray-300 text-gray-700 px-3 py-1.5 rounded-md text-sm font-medium hover:bg-gray-50 transition-colors"
              >Edit</Link>
              <button
                onClick={() => setConfirmKind('duplicate')}
                className="bg-white border border-gray-300 text-gray-700 px-3 py-1.5 rounded-md text-sm font-medium hover:bg-gray-50 transition-colors"
              >
                Duplicate
              </button>
              {isInactive ? (
                <button
                  onClick={() => setConfirmKind('reactivate')}
                  className="bg-primary text-white px-3 py-1.5 rounded-md text-sm font-medium hover:bg-primary-hover transition-colors"
                >
                  Reactivate
                </button>
              ) : (() => {
                // Build the list of specific blockers, then render a hover-revealed
                // custom tooltip. Native `title` doesn't fire on disabled buttons,
                // so wrap the button in a `group` div and use opacity/visibility transitions.
                const blockers: string[] = []
                if (usedIn > 0) {
                  blockers.push(`Used by ${usedIn} ${usedIn === 1 ? 'template' : 'templates'}`)
                }
                if (requiredByTypes.length > 0) {
                  blockers.push(`Required for ${requiredByTypes.join(', ')} templates`)
                }
                return (
                  <div className="relative group">
                    <button
                      onClick={() => !deactivationBlocked && setConfirmKind('deactivate')}
                      disabled={deactivationBlocked}
                      className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                        deactivationBlocked
                          ? 'border border-gray-200 text-gray-400 cursor-not-allowed bg-gray-50'
                          : 'bg-red-600 hover:bg-red-700 text-white'
                      }`}
                    >Deactivate</button>
                    {deactivationBlocked && (
                      <div
                        role="tooltip"
                        className="absolute right-0 top-full mt-1.5 w-72 px-3 py-2.5 bg-gray-900 text-white text-xs leading-snug rounded-md shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-opacity z-20 pointer-events-none text-left"
                      >
                        <div className="font-semibold mb-1">Can't deactivate yet</div>
                        <ul className="space-y-0.5 text-gray-200">
                          {blockers.map((b) => (
                            <li key={b}>• {b}</li>
                          ))}
                        </ul>
                        <div className="text-gray-400 mt-1.5 text-[11px]">
                          Remove these dependencies first.
                        </div>
                        {/* Tooltip arrow */}
                        <div className="absolute -top-1 right-3 w-2 h-2 bg-gray-900 rotate-45" />
                      </div>
                    )}
                  </div>
                )
              })()}
            </div>
          )}
        </div>

        <ConfirmModal
          open={confirmKind === 'duplicate'}
          title="Duplicate this partial?"
          body={<>A copy named <em className="not-italic font-medium">Copy of {partial.name}</em> will be created.</>}
          confirmLabel="Duplicate"
          variant="primary"
          onConfirm={() => {
            setConfirmKind(null)
            // Match templates: show success toast (top-right, green variant)
            // instead of navigating to the editor. Mirrors the modal+toast pattern
            // in `Screenshot_7.52.44` + `Screenshot_7.52.51`.
            toast.show({
              title: 'Partial duplicated',
              message: `"Copy of ${partial.name}" created.`,
              variant: 'success',
            })
          }}
          onCancel={() => setConfirmKind(null)}
        />
        <ConfirmModal
          open={confirmKind === 'deactivate'}
          title="Deactivate this partial?"
          body="It will be hidden from new templates but kept for reference. You can reactivate it later."
          confirmLabel="Deactivate"
          variant="destructive"
          onConfirm={() => {
            setLocalLifecycle('Inactive')
            savePartial({ ...partial, lifecycle: 'Inactive', lastEditedBy: user.email, updatedAt: new Date().toISOString() })
            setConfirmKind(null)
            toast.show({
              title: 'Partial deactivated',
              message: `"${partial.name}" has been deactivated.`,
              variant: 'destructive',
            })
          }}
          onCancel={() => setConfirmKind(null)}
        />
        <ConfirmModal
          open={confirmKind === 'reactivate'}
          title="Reactivate this partial?"
          body="It will be available for templates and rules again."
          confirmLabel="Reactivate"
          variant="primary"
          onConfirm={() => {
            setLocalLifecycle('Active')
            savePartial({ ...partial, lifecycle: 'Active', lastEditedBy: user.email, updatedAt: new Date().toISOString() })
            setConfirmKind(null)
            toast.show({
              title: 'Partial reactivated',
              message: `"${partial.name}" is now available.`,
              variant: 'success',
            })
          }}
          onCancel={() => setConfirmKind(null)}
        />
      </div>

      {/* 2-column layout matching the Template detail pattern:
          left = Preview/Source (the primary "what is this" answer),
          right sidebar = Details + Variables accordions.
          "Used in templates" lives below as a full-width section. */}
      <div className="flex gap-6 items-start">
        {/* LEFT - Preview/Source main content */}
        <section className="flex-[3] min-w-0 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">Preview</h2>
            <div className="inline-flex items-center bg-gray-100 rounded-full p-0.5 text-xs">
              <button
                onClick={() => setView('preview')}
                className={`px-3 py-1 rounded-full font-semibold uppercase tracking-wide transition-colors ${
                  view === 'preview' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                }`}
              >Preview</button>
              <button
                onClick={() => setView('source')}
                className={`px-3 py-1 rounded-full font-semibold uppercase tracking-wide transition-colors ${
                  view === 'source' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                }`}
              >{'</> HTML'}</button>
            </div>
          </div>
          <div className="border border-gray-200 rounded-lg overflow-hidden bg-white">
            {view === 'preview' ? (
              <iframe
                sandbox="allow-same-origin allow-popups allow-popups-to-escape-sandbox"
                srcDoc={`<!DOCTYPE html><html><head><base target="_blank"><style>
                  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; margin: 0; padding: 16px; font-size: 14px; color: #111827; }
                  * { box-sizing: border-box; }
                  img { max-width: 100%; height: auto; }
                  a { color: #0f6e56; }
                  table { border-collapse: collapse; width: 100%; }
                  th, td { padding: 8px 12px; text-align: left; }
                </style></head><body>${compileBodyForPreview(partial.body, sampleValues)}</body></html>`}
                className="w-full"
                style={{ height: '420px' }}
                title={`Preview: ${partial.name}`}
              />
            ) : (
              <div className="bg-white">
                <div className="flex items-center justify-between px-4 py-2 border-b border-gray-200 bg-gray-50">
                  <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">HTML source</span>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(partial.body)
                      setCopied(true)
                      setTimeout(() => setCopied(false), 2000)
                    }}
                    className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-md border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 hover:text-gray-900 transition-colors"
                  >
                    {copied ? (
                      <>
                        <svg className="w-3.5 h-3.5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                        </svg>
                        Copied
                      </>
                    ) : (
                      <>
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15.666 3.888A2.25 2.25 0 0013.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 01-.75.75H9a.75.75 0 01-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 01-2.25 2.25H6.75A2.25 2.25 0 014.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 011.927-.184" />
                        </svg>
                        Copy
                      </>
                    )}
                  </button>
                </div>
                <pre className="text-xs font-mono text-gray-700 p-4 overflow-auto whitespace-pre-wrap break-words leading-relaxed" style={{ height: '378px' }}>
                  {formatSourceWithTokens(partial.body).map((part, i) =>
                    part.kind === 'var' ? (
                      <span key={i} className="inline-block px-2 py-0.5 rounded-md bg-amber-50 border border-amber-700 text-gray-900 font-semibold">
                        {part.value}
                      </span>
                    ) : (
                      <span key={i}>{part.value}</span>
                    ),
                  )}
                </pre>
              </div>
            )}
          </div>
          {view === 'source' && (
            <p className="text-xs text-gray-500">
              Variables in <code className="text-amber-700">{`{{amber}}`}</code> can appear inside HTML attributes. Those aren't visible in the rendered preview.
            </p>
          )}
        </section>

        {/* RIGHT SIDEBAR - Details + Variables accordions (matches Template detail pattern). */}
        <div className="flex-[2] min-w-0 space-y-4">
          <PartialCollapsibleCard title="Details" open={detailsOpen} onToggle={() => setDetailsOpen((v) => !v)}>
            <dl className="space-y-2.5">
              <div className="flex items-start gap-3 text-sm">
                <dt className="text-gray-500 w-24 shrink-0">Section</dt>
                <dd className="text-gray-900 min-w-0">{partial.section}</dd>
              </div>
              {requiredByTypes.length > 0 && (
                <div className="flex items-start gap-3 text-sm">
                  <dt className="text-gray-500 w-24 shrink-0">Required for</dt>
                  <dd className="text-gray-900 min-w-0">
                    {requiredByTypes.map((t, i) => (
                      <span key={t}>
                        <Link
                          to={`/admin/required-partials?type=${encodeURIComponent(t)}&from=${encodeURIComponent(location.pathname + location.search)}`}
                          className="text-primary hover:underline"
                        >
                          {t}
                        </Link>
                        {i < requiredByTypes.length - 1 && <span className="text-gray-400">, </span>}
                      </span>
                    ))}
                  </dd>
                </div>
              )}
              <div className="flex items-start gap-3 text-sm">
                <dt className="text-gray-500 w-24 shrink-0">Created by</dt>
                <dd className="text-gray-900 min-w-0">{partial.authoringTeam}</dd>
              </div>
              <div className="flex items-start gap-3 text-sm">
                <dt className="text-gray-500 w-24 shrink-0">Owner</dt>
                <dd className="flex items-center gap-2 min-w-0">
                  <Avatar email={partial.owner} size="sm" />
                  <span className="text-gray-900 truncate">{emailToName(partial.owner)}</span>
                </dd>
              </div>
              <div className="flex items-start gap-3 text-sm">
                <dt className="text-gray-500 w-24 shrink-0">Updated</dt>
                <dd className="text-gray-900 min-w-0">
                  {format(new Date(partial.updatedAt), 'MMM d, yyyy')}
                  {partial.lastEditedBy && partial.lastEditedBy !== partial.owner && (
                    <span className="text-gray-500"> by {emailToName(partial.lastEditedBy)}</span>
                  )}
                </dd>
              </div>
            </dl>
          </PartialCollapsibleCard>

          {varRefs.length > 0 && (
            <PartialCollapsibleCard
              title={`Variables (${varRefs.length})`}
              open={varsOpenState}
              onToggle={() => setVarsOpenState((v) => !v)}
            >
              <p className="text-xs text-gray-500 mb-2">
                Fill in sample values to preview how this partial renders. Unfilled tokens stay highlighted.
              </p>
              <div className="space-y-1.5">
                {varRefs.map((v) => (
                  <div key={v} className="flex items-center gap-2">
                    <code className="inline-flex items-center px-2 py-0.5 rounded-md bg-amber-50 border border-amber-700 text-[11px] font-mono text-gray-900 shrink-0 max-w-[160px] truncate">
                      {`{{ ${v} }}`}
                    </code>
                    <input
                      type="text"
                      value={sampleValues[v] ?? ''}
                      onChange={(e) => setSampleValues((sv) => ({ ...sv, [v]: e.target.value }))}
                      placeholder="sample value"
                      className="flex-1 min-w-0 h-7 px-2 text-xs border border-gray-200 rounded bg-white focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/20"
                    />
                  </div>
                ))}
              </div>
            </PartialCollapsibleCard>
          )}
        </div>
      </div>

      {/* Used in templates - full-width section below the 2-column layout. */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-gray-900">
          Used in{' '}
          <span className={usedIn === 0 ? 'text-gray-500' : 'text-green-700'}>
            {usedIn} template{usedIn !== 1 ? 's' : ''}
          </span>
        </h2>

        {isAdmin && !isInactive && deactivationBlocked && (
          <div className="flex items-start gap-2 text-sm bg-amber-50 border border-amber-200 rounded-md px-3 py-2 text-amber-800">
            <svg className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
            </svg>
            <div>
              <span className="font-medium">Cannot deactivate.</span>{' '}
              {usedIn > 0 && <>Used by {usedIn} template{usedIn !== 1 ? 's' : ''}{requiredByTypes.length > 0 ? ' and ' : '.'}</>}
              {requiredByTypes.length > 0 && (
                <>{usedIn > 0 ? 'is' : 'This partial is'} required for these template types: {requiredByTypes.join(', ')}.</>
              )}
            </div>
          </div>
        )}

        {usedIn === 0 ? (
          // Empty state - two branches: drafts reference it (future blast radius)
          // or nothing references it at all. Inactive references aren't surfaced here.
          <div className="border border-dashed border-gray-200 rounded-lg py-6 text-center">
            <p className="text-sm text-gray-500">
              {draftDependents.length === 0
                ? 'No templates use this partial.'
                : 'No Active templates use this partial today.'}
            </p>
            <p className="text-xs text-gray-400 mt-0.5">
              {draftDependents.length > 0
                ? `${draftDependents.length} draft${draftDependents.length !== 1 ? 's' : ''} reference it. They'll inherit your changes when activated.`
                : requiredByTypes.length > 0
                  ? `Required for new templates of type: ${requiredByTypes.join(', ')}.`
                  : 'Safe to edit or deactivate without downstream impact.'}
            </p>
          </div>
        ) : (
          <div className="border border-gray-200 rounded-lg overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="text-left px-4 py-2.5 text-xs font-medium uppercase tracking-wide text-gray-500">Template</th>
                  <th className="text-left px-4 py-2.5 text-xs font-medium uppercase tracking-wide text-gray-500">Team</th>
                  <th className="text-left px-4 py-2.5 text-xs font-medium uppercase tracking-wide text-gray-500">Status</th>
                  <th className="text-left px-4 py-2.5 text-xs font-medium uppercase tracking-wide text-gray-500">Updated</th>
                </tr>
              </thead>
              <tbody>
                {activeDependents.map((t) => (
                  <tr key={t.id} className="border-b border-gray-100 hover:bg-gray-50/50 transition-colors">
                    <td className="px-4 py-2.5">
                      <Link to={`/templates/${t.id}`} className="text-sm text-primary font-medium hover:underline">
                        {t.name}
                      </Link>
                    </td>
                    <td className="px-4 py-2.5 text-sm text-gray-900">{t.owningTeam}</td>
                    <td className="px-4 py-2.5"><StatusPill status={t.lifecycle} /></td>
                    <td className="px-4 py-2.5 text-sm text-gray-500">
                      {format(new Date(t.updatedAt), 'MMM d, yyyy')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Drafts sub-line - future blast radius. Shown only when there are drafts AND
            we already have Active dependents (otherwise the empty-state above covers it). */}
        {usedIn > 0 && draftDependents.length > 0 && (
          <p className="text-xs text-gray-500 mt-2 inline-flex items-center gap-1.5">
            <svg className="w-3.5 h-3.5 text-amber-500" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" clipRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm.75-11.25a.75.75 0 00-1.5 0v3.5a.75.75 0 00.22.53l2 2a.75.75 0 101.06-1.06l-1.78-1.78V6.75z" />
            </svg>
            <span><span className="font-medium text-gray-700">+{draftDependents.length} in draft</span>, which will inherit changes on activation.</span>
          </p>
        )}

      </section>

      {/* Audit - collapsed by default */}
      {auditEvents.length > 0 && (
        <details className="group">
          <summary className="cursor-pointer text-sm font-medium text-gray-600 hover:text-gray-900 inline-flex items-center gap-1.5 select-none">
            <svg className="w-4 h-4 transition-transform group-open:rotate-90" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
            Activity ({auditEvents.length})
          </summary>
          <div className="relative pl-4 mt-3">
            <div className="absolute left-[7px] top-2 bottom-2 w-px bg-gray-200" />
            <div className="space-y-3">
              {auditEvents.map((event) => (
                <div key={event.id} className="relative flex items-center gap-3">
                  <div className="absolute left-[-9px] top-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full bg-white border-2 border-gray-300" />
                  <div className="ml-4 flex items-center gap-2 flex-wrap">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold uppercase tracking-wide ${actionColors[event.action] || 'bg-gray-100 text-gray-600'}`}>
                      {actionLabels[event.action] || event.action}
                    </span>
                    <span className="text-sm text-gray-700">
                      by <span className="font-medium">{emailToName(event.actor)}</span>
                    </span>
                    <span className="text-xs text-gray-400">
                      {format(new Date(event.timestamp), 'MMM d, yyyy · h:mm a')}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </details>
      )}
    </div>
  )
}

// Collapsible card used in the right sidebar - header with chevron, click toggles open.
function PartialCollapsibleCard({
  title, open, onToggle, children,
}: {
  title: string
  open: boolean
  onToggle: () => void
  children: React.ReactNode
}) {
  return (
    <div className="bg-gray-50 rounded-lg">
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center justify-between gap-2 px-4 py-3 text-left hover:bg-gray-100/60 rounded-lg transition-colors"
        aria-expanded={open}
      >
        <h2 className="text-sm font-medium text-gray-900 inline-flex items-center gap-2 min-w-0">
          <svg
            className={`w-3.5 h-3.5 text-gray-400 shrink-0 transition-transform ${open ? 'rotate-90' : ''}`}
            fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
          <span className="truncate">{title}</span>
        </h2>
      </button>
      {open && <div className="px-4 pb-4 space-y-2">{children}</div>}
    </div>
  )
}
