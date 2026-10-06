import { useEffect, useState } from 'react'
import { Link, useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { format } from 'date-fns'
import { getTemplate, saveTemplate } from '../data/session-store'
import { PARTIALS } from '../data/partials'
import { PROJECTS } from '../data/programs'
import { AUDIT_EVENTS } from '../data/audit-events'
import { REQUIRED_PARTIAL_RULES } from '../data/required-partial-rules'
import { evaluateTemplateCompliance } from '../data/rule-compliance'
import { renderSection } from '../data/sections'
import { useCurrentUser } from '../hooks/useCurrentUser'
import { Breadcrumbs } from '../components/shared/Breadcrumbs'
import { StatusPill } from '../components/shared/StatusPill'
import { Avatar } from '../components/shared/Avatar'
import { ConfirmModal } from '../components/shared/ConfirmModal'
import { useToast } from '../components/shared/Toast'
import type { Lifecycle } from '../data/taxonomy'
import { neutralizeAttributeTokens } from '../utils/preview'

function emailToName(email: string) {
  const local = email.split('@')[0] || ''
  return local.split('.').map((s) => s.charAt(0).toUpperCase() + s.slice(1)).join(' ')
}

// Simple {{varName}} substitution for preview.
// Resolution per variable: sampleValue → defaultValue → leave as {{token}} (rendered as amber chip below).
// Unfilled variables stay visible as amber chips so users can see exactly what's missing.
function compileTemplate(body: string, variables: { name: string; sampleValue?: string; defaultValue?: string }[]): string {
  let result = body
  for (const v of variables) {
    const val = v.sampleValue || v.defaultValue
    if (val) {
      const escapedName = v.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      // DF2-10: strip whole var-chip span so filled vars render as plain text.
      result = result.replace(
        new RegExp(`<span[^>]*data-var="${escapedName}"[^>]*>[^<]*</span>`, 'g'),
        val,
      )
      result = result.replace(new RegExp(`\\{\\{\\s*${escapedName}\\s*\\}\\}`, 'g'), val)
    }
    // No value → leave {{token}} in place; caught by the catch-all below
  }
  result = neutralizeAttributeTokens(result)
  // Any remaining {{...}} are unfilled — render as amber chips so they're visually obvious
  result = result.replace(
    /\{\{([^}]+)\}\}/g,
    (_m, name) =>
      `<span style="display:inline-block;background:#fffbeb;color:#111827;padding:1px 8px;border-radius:6px;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:0.92em;border:1px solid #a16207">{{ ${name.trim()} }}</span>`,
  )
  return result
}


function partialPosition(section: string): 'header' | 'footer' | 'middle' {
  if (section === 'Header') return 'header'
  if (section === 'Footer') return 'footer'
  return 'middle'
}


export function TemplateDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { user } = useCurrentUser()
  // Show a one-time callout when the user lands here after creating a new template.
  // Reads the ?created=true param once on mount — dismissed locally, disappears on next visit.
  const [showCreatedCallout, setShowCreatedCallout] = useState(
    () => searchParams.get('created') === 'true',
  )
  const toast = useToast()
  const [confirmKind, setConfirmKind] = useState<'duplicate' | 'activate' | 'deactivate' | null>(null)
  // Local lifecycle override — survives in-session state changes
  const [localLifecycle, setLocalLifecycle] = useState<Lifecycle | null>(null)

  const baseTemplate = id ? getTemplate(id) : undefined
  const template = baseTemplate
    ? (localLifecycle ? { ...baseTemplate, lifecycle: localLifecycle } : baseTemplate)
    : undefined

  if (!template) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <svg className="w-12 h-12 text-gray-300 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
        </svg>
        <h2 className="text-xl font-semibold text-gray-900 mb-2">Template not found</h2>
        <p className="text-sm text-gray-500 mb-4">This template may have been deleted or the link is incorrect.</p>
        <button onClick={() => navigate('/templates')} className="text-sm text-primary font-medium hover:underline">← Back to Library</button>
      </div>
    )
  }

  const canEdit = user.role === 'admin' || user.role === 'editor'
  const isAdmin = user.role === 'admin'
  const isActive = template.lifecycle === 'Active'
  const isDraft = template.lifecycle === 'Draft'
  const isInactive = template.lifecycle === 'Inactive'

  const program = PROJECTS.find((p) => p.id === template.programId)

  // Partials this template uses
  const usedPartials = template.requiredPartialIds
    .map((pid) => PARTIALS.find((p) => p.id === pid))
    .filter(Boolean) as typeof PARTIALS

  // Compliance: which partials are required by current rules but not embedded?
  const compliance = evaluateTemplateCompliance(template)
  const missingPartials = compliance.missingPartialIds
    .map((pid) => {
      const partial = PARTIALS.find((p) => p.id === pid)
      const rule = REQUIRED_PARTIAL_RULES.find(
        (r) =>
          r.partialId === pid &&
          r.templateType === template.templateType &&
          (r.team === 'ALL' || r.team === template.owningTeam),
      )
      return partial && rule ? { partial, rule } : null
    })
    .filter(Boolean) as Array<{ partial: typeof PARTIALS[number]; rule: typeof REQUIRED_PARTIAL_RULES[number] }>
  const missingCount = missingPartials.length
  const hasApplicableRules = compliance.applicableRules.length > 0

  // Note: previously derived a "How it's sent" label from variable.source. Removed because
  // v0 doesn't capture source in the editor — the field always defaulted to "Manual / scheduled"
  // for new templates, which was misleading.

  const [previewMode, setPreviewMode] = useState<'samples' | 'html'>('samples')
  const [copied, setCopied] = useState(false)
  // Session-scoped sample values for testing how the template renders with custom data.
  // Not persisted — lost on page reload. Defaults remain the persistent fallback.
  const [sampleValues, setSampleValues] = useState<Record<string, string>>({})
  // Right-column card expansion state. Smart defaults:
  //   Variables — collapsed (most users don't test sample data on first visit)
  //   Partials  — auto-expand when there's a compliance issue, otherwise collapsed
  //   Details   — collapsed (low-signal metadata)
  // Per designer's Screenshot_6.57.33: Variables open by default to show sample inputs.
  const [varsOpen, setVarsOpen] = useState(true)
  const [partialsOpen, setPartialsOpen] = useState(false)
  // Per designer: Details is FIRST in the right sidebar and open by default.
  const [detailsOpen, setDetailsOpen] = useState(true)

  // Auto-expand the Partials card when there's a compliance issue or an inactive embedded
  // partial — users need to see what's wrong without an extra click.
  const hasInactiveEmbeddedPartial = template.requiredPartialIds.some((pid) => {
    const p = PARTIALS.find((x) => x.id === pid)
    return p?.lifecycle === 'Inactive'
  })
  const shouldAutoOpenPartials = compliance.missingPartialIds.length > 0 || hasInactiveEmbeddedPartial
  useEffect(() => {
    if (shouldAutoOpenPartials) setPartialsOpen(true)
  }, [shouldAutoOpenPartials])

  // Merge session sample values onto the template's variables for preview rendering.
  // Precedence: session sample → persisted defaultValue → bracket placeholder.
  const variablesForPreview = template.variables.map((v) => ({
    ...v,
    sampleValue: sampleValues[v.name] ?? v.sampleValue,
  }))

  const renderContent = (content: string): string => compileTemplate(content, variablesForPreview)

  const compiledSubject = renderContent(template.subject)
  const compiledPreHeader = template.preHeader ? renderContent(template.preHeader) : undefined

  // Raw HTML — template source with {{varName}} tokens intact.
  // Used in the HTML source view so users can copy it for migration.
  const rawComposedHtml = template.sections
    ? renderSection(template.sections.header, (s) => s)
      + renderSection(template.sections.body, (s) => s)
      + renderSection(template.sections.footer, (s) => s)
    : template.body

  // Compose the email HTML.
  // Prefer the block-based `sections` model (new editor output); fall back to legacy
  // body + requiredPartialIds ordering for templates created before block support.
  const composedHtml = template.sections
    ? renderSection(template.sections.header, renderContent)
      + renderSection(template.sections.body, renderContent)
      + renderSection(template.sections.footer, renderContent)
    : (() => {
        const compiledBody = renderContent(template.body)
        const headerPartials = usedPartials.filter((p) => partialPosition(p.section) === 'header')
        const middlePartials = usedPartials.filter((p) => partialPosition(p.section) === 'middle')
        const footerPartials = usedPartials.filter((p) => partialPosition(p.section) === 'footer')
        const renderedBody = template.contentType === 'text'
          ? `<pre style="background:transparent;padding:0;margin:0;white-space:pre-wrap;font-family:inherit;font-size:14px">${compiledBody}</pre>`
          : compiledBody
        return headerPartials.map((p) => renderContent(p.body)).join('')
          + middlePartials.map((p) => renderContent(p.body)).join('')
          + renderedBody
          + footerPartials.map((p) => renderContent(p.body)).join('')
      })()

  const emailPreviewHtml = `<!DOCTYPE html><html><head><base target="_blank"><style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; margin: 0; padding: 20px; font-size: 14px; color: #111827; line-height: 1.6; }
    * { box-sizing: border-box; }
    img { max-width: 100%; height: auto; }
    a { color: #0f6e56; }
    h1, h2, h3 { color: #111827; margin-top: 0; }
    table { border-collapse: collapse; width: 100%; }
    th, td { padding: 8px 12px; text-align: left; border-bottom: 1px solid #e5e7eb; }
    th { background: #f9fafb; font-weight: 600; }
    .disclaimer { font-size: 11px; color: #6b7280; margin-top: 24px; }
    footer { margin: 0; padding: 0; border: 0; font-size: 12px; color: #6b7280; }
    header { margin: 0; }
  </style></head><body>${composedHtml}</body></html>`

  // Audit events
  const auditEvents = AUDIT_EVENTS
    .filter((e) => e.entityId === template.id)
    .sort((a, b) => b.timestamp.localeCompare(a.timestamp))

  const actionLabels: Record<string, string> = {
    created: 'Created',
    updated: 'Updated',
    activated: 'Activated',
    deactivated: 'Deactivated',
    deleted: 'Deleted',
  }
  const actionColors: Record<string, string> = {
    created: 'bg-green-100 text-green-700',
    updated: 'bg-blue-100 text-blue-700',
    activated: 'bg-green-100 text-green-700',
    deactivated: 'bg-gray-100 text-gray-600',
    deleted: 'bg-red-100 text-red-600',
  }

  const contentTypeLabel: Record<string, string> = {
    structured: 'Structured',
    html: 'HTML',
    text: 'Plain text',
  }

  return (
    <div className="space-y-6">
      {/* Sticky page-header region — breadcrumbs + identity strip stay pinned;
          the rest of the page scrolls under them. */}
      <div className="sticky top-0 bg-white z-10 pt-6 pb-4 space-y-3 border-b border-gray-100">
        <Breadcrumbs items={[
          { label: 'Templates', to: '/templates' },
          { label: template.name },
        ]} />

        {/* Page header */}
        <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3 flex-wrap min-w-0">
          <h1 className={`text-2xl font-semibold truncate ${isInactive ? 'text-gray-400 line-through' : 'text-gray-900'}`}>
            {template.name}
          </h1>
          <StatusPill status={template.lifecycle} />
        </div>

        {canEdit && (
          <div className="flex items-center gap-2 shrink-0">
            <Link
              to={`/templates/${template.id}/edit`}
              className="bg-white border border-gray-300 text-gray-700 px-3 py-1.5 rounded-md text-sm font-medium hover:bg-gray-50 transition-colors"
            >
              Edit
            </Link>
            <button
              onClick={() => setConfirmKind('duplicate')}
              className="bg-white border border-gray-300 text-gray-700 px-3 py-1.5 rounded-md text-sm font-medium hover:bg-gray-50 transition-colors"
            >
              Duplicate
            </button>
            {isAdmin && isActive && (
              <button
                onClick={() => setConfirmKind('deactivate')}
                className="bg-red-600 hover:bg-red-700 text-white px-3 py-1.5 rounded-md text-sm font-medium transition-colors"
              >
                Deactivate
              </button>
            )}
            {(isDraft || isInactive) && (() => {
              // Block activation when the template can't render correctly:
              //   1. Missing partials required by current governance rules
              //   2. Any embedded partial whose own lifecycle is Inactive
              const inactiveUsed = usedPartials.filter((p) => p.lifecycle === 'Inactive')
              const blockers: string[] = []
              if (missingCount > 0) {
                blockers.push(`Missing ${missingCount} required ${missingCount === 1 ? 'partial' : 'partials'}`)
              }
              if (inactiveUsed.length > 0) {
                blockers.push(`Uses ${inactiveUsed.length} inactive ${inactiveUsed.length === 1 ? 'partial' : 'partials'}`)
              }
              const canActivate = blockers.length === 0
              // Custom hover tooltip — native `title` doesn't reliably fire on disabled buttons.
              // Wrapper div catches hover; tooltip is positioned below the button.
              return (
                <div className="relative group">
                  <button
                    onClick={() => canActivate && setConfirmKind('activate')}
                    disabled={!canActivate}
                    className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                      canActivate
                        ? 'bg-primary text-white hover:bg-primary-hover'
                        : 'bg-gray-100 text-gray-400 cursor-not-allowed border border-gray-200'
                    }`}
                  >
                    Activate
                  </button>
                  {!canActivate && (
                    <div role="tooltip"
                      className="absolute right-0 top-full mt-1.5 w-64 px-3 py-2 bg-gray-900 text-white text-xs rounded-md shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-opacity z-20 pointer-events-none">
                      <div className="font-semibold mb-1">Can't activate yet</div>
                      <ul className="space-y-0.5 text-gray-200">
                        {blockers.map((b) => (
                          <li key={b}>• {b}</li>
                        ))}
                      </ul>
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
      </div>

      {/* Post-creation callout — shown once when user lands here after saving a new template.
          Explains that Inactive is expected and points to the Activate button. Dismissed locally. */}
      {showCreatedCallout && (
        <div className="flex items-start gap-3 bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 text-sm text-blue-900">
          <svg className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
          </svg>
          <div className="flex-1 min-w-0">
            <span className="font-semibold">Template saved as Inactive.</span>
            {' '}It won't be sent until you activate it. Review everything here, then use the{' '}
            <span className="font-medium">Activate</span> button above when you're ready.
          </div>
          <button
            onClick={() => setShowCreatedCallout(false)}
            className="shrink-0 text-blue-400 hover:text-blue-600 p-0.5 -mr-1"
            aria-label="Dismiss"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      <ConfirmModal
        open={confirmKind === 'duplicate'}
        title="Duplicate this template?"
        body={<>A draft copy named <em className="not-italic font-medium">Copy of {template.name}</em> will be created.</>}
        confirmLabel="Duplicate"
        variant="primary"
        onConfirm={() => {
          setConfirmKind(null)
          toast.show({
            title: 'Template duplicated',
            message: `"Copy of ${template.name}" created as Draft.`,
            variant: 'success',
          })
        }}
        onCancel={() => setConfirmKind(null)}
      />
      <ConfirmModal
        open={confirmKind === 'activate'}
        title="Activate this template?"
        body="It will start sending on its next scheduled trigger."
        confirmLabel="Activate"
        variant="primary"
        onConfirm={() => {
          setLocalLifecycle('Active')
          saveTemplate({ ...template, lifecycle: 'Active', lastEditedBy: user.email, updatedAt: new Date().toISOString(), activatedAt: new Date().toISOString() })
          setConfirmKind(null)
          toast.show({
            title: 'Template activated',
            message: `"${template.name}" is now sending.`,
            variant: 'success',
          })
        }}
        onCancel={() => setConfirmKind(null)}
      />
      <ConfirmModal
        open={confirmKind === 'deactivate'}
        title="Deactivate this template?"
        body="It will stop sending immediately. You can reactivate it later."
        confirmLabel="Deactivate"
        variant="destructive"
        onConfirm={() => {
          setLocalLifecycle('Inactive')
          saveTemplate({ ...template, lifecycle: 'Inactive', lastEditedBy: user.email, updatedAt: new Date().toISOString(), deactivatedAt: new Date().toISOString() })
          setConfirmKind(null)
          toast.show({
            title: 'Template deactivated',
            message: `"${template.name}" has been deactivated.`,
            variant: 'destructive',
          })
        }}
        onCancel={() => setConfirmKind(null)}
      />

      {/* Active template edit banner */}
      {isActive && canEdit && (
        <div className="flex items-center gap-3 bg-blue-50 border border-blue-200 rounded-lg px-4 py-3">
          <svg className="w-4 h-4 text-blue-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
          </svg>
          <p className="text-sm text-blue-800">
            Editing this template will create a new <strong>Draft</strong>. The Active version continues rendering until the draft is activated.
          </p>
        </div>
      )}

      {/* Two-column body */}
      <div className="flex gap-6 items-start">
        {/* Left 60% — email preview */}
        <div className="flex-[3] min-w-0 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">Preview</h2>
            {/* Toggle: "Preview" (rendered with sample values) | "</> HTML" (raw source).
                Per designer feedback: "Sample value" label is renamed to "Preview". */}
            {template.variables.length > 0 && (
              <div className="inline-flex items-center bg-gray-100 rounded-full p-0.5 text-xs">
                <button
                  onClick={() => setPreviewMode('samples')}
                  className={`px-3 py-1 rounded-full font-semibold uppercase tracking-wide transition-colors ${
                    previewMode === 'samples' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                  }`}
                  title="Show how the email renders with sample data"
                >Preview</button>
                <button
                  onClick={() => setPreviewMode('html')}
                  className={`px-3 py-1 rounded-full font-semibold uppercase tracking-wide transition-colors ${
                    previewMode === 'html' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                  }`}
                  title="View raw HTML source — copy to migrate to another system"
                >&lt;/&gt; HTML</button>
              </div>
            )}
          </div>

          {/* Email envelope header */}
          <div className="bg-gray-50 border border-gray-200 rounded-t-lg px-4 py-3 space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-400 w-16 shrink-0">Subject</span>
              <span className="text-sm font-medium text-gray-900 truncate font-mono">
                {previewMode === 'html' ? template.subject : undefined}
                {previewMode === 'samples' && <span dangerouslySetInnerHTML={{ __html: compiledSubject }} />}
              </span>
            </div>
            {(previewMode === 'html' ? template.preHeader : compiledPreHeader) && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-400 w-20 shrink-0">Preview text</span>
                {previewMode === 'html'
                  ? <span className="text-xs text-gray-500 truncate italic font-mono">{template.preHeader}</span>
                  : <span className="text-xs text-gray-500 truncate italic" dangerouslySetInnerHTML={{ __html: compiledPreHeader! }} />
                }
              </div>
            )}
          </div>

          {previewMode === 'samples' ? (
            <div className="border border-t-0 border-gray-200 rounded-b-lg overflow-hidden">
              <iframe
                sandbox="allow-same-origin allow-popups allow-popups-to-escape-sandbox"
                srcDoc={emailPreviewHtml}
                className="w-full"
                style={{ height: '560px' }}
                title={`Preview: ${template.name}`}
              />
            </div>
          ) : (
            <div className="border border-t-0 border-gray-200 rounded-b-lg bg-white overflow-hidden">
              <div className="flex items-center justify-between px-4 py-2 border-b border-gray-200 bg-gray-50">
                <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">HTML source</span>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(rawComposedHtml)
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
              <pre className="text-xs text-gray-700 font-mono p-4 overflow-auto" style={{ height: '528px', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
                {rawComposedHtml || '<— no content blocks yet —>'}
              </pre>
            </div>
          )}

          {previewMode === 'samples' && variablesForPreview.some((v) => !v.sampleValue && !v.defaultValue) && (
            <p className="text-xs text-gray-400">
              Unfilled variables stay highlighted as <code className="bg-amber-50 text-amber-700 px-1 rounded font-mono">{`{{tokens}}`}</code> in the preview. Enter a sample value on the right to replace them.
            </p>
          )}
          {previewMode === 'html' && (
            <p className="text-xs text-gray-400">
              Raw template HTML with <code className="bg-amber-50 text-amber-700 px-1 rounded">{`{{varName}}`}</code> tokens intact. Copy to migrate to another system.
            </p>
          )}
        </div>

        {/* Right 40% — Details → Variables → Partials per `Screenshot_6.57.33`. */}
        <div className="flex-[2] min-w-0 space-y-4">
          {/* Details — first in the stack, default open. */}
          <CollapsibleCard
            open={detailsOpen}
            onToggle={() => setDetailsOpen((v) => !v)}
            title="Details"
          >
            <dl className="space-y-2.5">
              <MetaRow label="Team" value={template.owningTeam} />
              <MetaRow label="Template type" value={template.templateType} />
              <div className="flex items-start gap-3 text-sm">
                <dt className="text-gray-500 w-28 shrink-0">Content type</dt>
                <dd className="flex items-center gap-1.5 min-w-0">
                  <span className="text-gray-900">{contentTypeLabel[template.contentType]}</span>
                  <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-xs bg-gray-100 text-gray-500" title="Immutable after creation">
                    <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" /></svg>
                    Immutable
                  </span>
                </dd>
              </div>
              {program && <MetaRow label="Project" value={program.name} />}
              {template.tags.length > 0 && (
                <div className="flex items-start gap-3 text-sm">
                  <dt className="text-gray-500 w-28 shrink-0">Tags</dt>
                  <dd className="flex flex-wrap gap-1 min-w-0">
                    {template.tags.map((tag) => (
                      <span key={tag} className="px-1.5 py-0.5 bg-white border border-gray-200 rounded text-xs text-gray-600">{tag}</span>
                    ))}
                  </dd>
                </div>
              )}
              <div className="flex items-start gap-3 text-sm">
                <dt className="text-gray-500 w-28 shrink-0">Owner</dt>
                <dd className="flex items-center gap-2 min-w-0">
                  <Avatar email={template.owner} size="sm" />
                  <span className="text-gray-900 truncate">{emailToName(template.owner)}</span>
                </dd>
              </div>
              <MetaRow label="Created" value={`${format(new Date(template.createdAt), 'MMM d, yyyy')} by ${emailToName(template.createdBy)}`} />
              <div className="flex items-start gap-3 text-sm">
                <dt className="text-gray-500 w-28 shrink-0">Updated</dt>
                <dd className="text-gray-900 min-w-0">
                  {format(new Date(template.updatedAt), 'MMM d, yyyy')}
                  {template.lastEditedBy && template.lastEditedBy !== template.owner && (
                    <span className="text-gray-500"> by {emailToName(template.lastEditedBy)}</span>
                  )}
                </dd>
              </div>
            </dl>
          </CollapsibleCard>

          {/* Variables — second in the stack, default open. Sample value inputs. */}
          {template.variables.length > 0 && (
            <CollapsibleCard
              open={varsOpen}
              onToggle={() => setVarsOpen((v) => !v)}
              title={`Variables (${template.variables.length})`}
            >
              <p className="text-xs text-gray-500 mb-2">
                Type a sample value to preview with custom data. Empty fields fall back to the default.
              </p>
              <div className="space-y-1.5">
                {template.variables.map((v) => (
                  <div key={v.name} className="bg-white border border-gray-200 rounded-md px-3 py-2 space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <code className="inline-flex items-center px-2 py-0.5 rounded-md bg-amber-50 border border-amber-700 text-[11px] font-mono text-gray-900 shrink-0 max-w-[160px] truncate">{`{{ ${v.name} }}`}</code>
                      {v.defaultValue ? (
                        <span className="text-[10px] text-gray-400 shrink-0">
                          Default: <code className="text-gray-600">{v.defaultValue}</code>
                        </span>
                      ) : (
                        <span className="text-[10px] text-gray-400 italic shrink-0">No default</span>
                      )}
                    </div>
                    <input
                      type="text"
                      value={sampleValues[v.name] ?? ''}
                      onChange={(e) => setSampleValues((sv) => ({ ...sv, [v.name]: e.target.value }))}
                      placeholder={v.defaultValue ? `Sample (defaults to "${v.defaultValue}")` : 'Sample value for preview'}
                      className="w-full h-7 px-2 text-xs border border-gray-200 rounded bg-white focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                    />
                  </div>
                ))}
              </div>
            </CollapsibleCard>
          )}

          {/* Partials — composition contract + compliance status (single source of truth)
              Auto-expands when there's something to fix. */}
          <CollapsibleCard
            id="compliance"
            open={partialsOpen}
            onToggle={() => setPartialsOpen((v) => !v)}
            title={`Partials (${usedPartials.length})`}
            titleSuffix={
              hasApplicableRules ? (
                missingCount === 0 ? (
                  <span className="inline-flex items-center gap-1 text-[11px] font-normal text-green-700">
                    <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
                    Compliant
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-[11px] font-normal text-amber-700">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                    {missingCount} missing
                  </span>
                )
              ) : null
            }
          >
            <p className="text-xs text-gray-500 mb-2">Reusable blocks composed around this template's body.</p>

            {usedPartials.length > 0 && (
              <div className="space-y-1.5">
                {usedPartials.map((p) => {
                  const isPartialInactive = p.lifecycle === 'Inactive'
                  return (
                    <div key={p.id} className={`flex items-center justify-between gap-2 bg-white border rounded-md px-3 py-2 ${isPartialInactive ? 'border-red-200' : 'border-gray-200'}`}>
                      <div className="flex items-center gap-2 min-w-0">
                        <Link to={`/partials/${p.id}?from=${encodeURIComponent(`/templates/${template.id}`)}`} className="text-sm text-primary font-medium hover:underline truncate">
                          {p.name}
                        </Link>
                        {isPartialInactive && (
                          <svg className="w-3.5 h-3.5 text-red-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                          </svg>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <span className="text-xs text-gray-500">{p.section}</span>
                        {isPartialInactive && (
                          <span className="text-xs px-1.5 py-0.5 rounded bg-red-50 text-red-600">Inactive — blocks activation</span>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            {missingCount > 0 && (
              <div className="space-y-2 pt-2 border-t border-gray-200">
                <div className="flex items-center gap-1.5">
                  <svg className="w-3.5 h-3.5 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                  </svg>
                  <h3 className="text-sm font-medium text-amber-900">
                    Missing — required by current rules
                  </h3>
                </div>
                <div className="space-y-1.5">
                  {missingPartials.map(({ partial, rule }) => {
                    const isPartialInactive = partial.lifecycle === 'Inactive'
                    const teamLabel = rule.team === 'ALL' ? 'All teams' : rule.team
                    return (
                      <div key={partial.id} className="bg-white border border-amber-200 rounded-md px-3 py-2 space-y-1">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <Link to={`/partials/${partial.id}?from=${encodeURIComponent(`/templates/${template.id}`)}`} className="text-sm text-primary font-medium hover:underline truncate">
                              {partial.name}
                            </Link>
                          </div>
                          <span className="text-xs text-gray-500 shrink-0">{partial.section}</span>
                        </div>
                        <div className="text-xs text-gray-600">
                          Required by <span className="font-medium">{teamLabel}</span> rule on <span className="font-medium">{rule.templateType}</span> templates · {' '}
                          <Link
                            to={`/admin/required-partials?type=${encodeURIComponent(rule.templateType)}&team=${encodeURIComponent(rule.team)}&from=${encodeURIComponent(`/templates/${template.id}`)}`}
                            className="text-primary hover:underline"
                          >
                            View rule
                          </Link>
                        </div>
                        {isPartialInactive && (
                          <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded px-2 py-1 mt-1">
                            This partial is currently inactive. Contact{' '}
                            <span className="font-medium">{emailToName(partial.owner)}</span> before adding.
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
                <p className="text-xs text-gray-500 pt-1">
                  These will be added the next time someone edits this template.
                </p>
              </div>
            )}

            {!hasApplicableRules && usedPartials.length === 0 && (
              <div className="text-xs text-gray-500 bg-white border border-gray-200 rounded-md px-3 py-2">
                No required partials are configured for {template.templateType} templates.
              </div>
            )}
          </CollapsibleCard>

        </div>
      </div>

      {/* Audit timeline — collapsed by default */}
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
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${actionColors[event.action] || 'bg-gray-100 text-gray-600'}`}>
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

function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start gap-3 text-sm">
      <dt className="text-gray-500 w-28 shrink-0">{label}</dt>
      <dd className="text-gray-900 min-w-0">{value}</dd>
    </div>
  )
}

// Collapsible section used for the right-column metadata cards on the template detail page.
// Header is the click target; chevron rotates on expand. Optional `titleSuffix` slot for inline
// status indicators (e.g. compliance dot) that stay visible even when collapsed.
function CollapsibleCard({
  open, onToggle, title, titleSuffix, id, children,
}: {
  open: boolean
  onToggle: () => void
  title: string
  titleSuffix?: React.ReactNode
  id?: string
  children: React.ReactNode
}) {
  return (
    <div id={id} className="bg-gray-50 rounded-lg scroll-mt-6">
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center justify-between gap-2 px-4 py-3 text-left hover:bg-gray-100/60 rounded-lg transition-colors"
        aria-expanded={open}
      >
        <h2 className="text-sm font-medium text-gray-900 inline-flex items-center gap-2 min-w-0">
          <svg className={`w-3.5 h-3.5 text-gray-400 shrink-0 transition-transform ${open ? 'rotate-90' : ''}`}
            fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
          <span className="truncate">{title}</span>
          {titleSuffix && <span className="shrink-0">{titleSuffix}</span>}
        </h2>
      </button>
      {open && <div className="px-4 pb-4 space-y-2">{children}</div>}
    </div>
  )
}
