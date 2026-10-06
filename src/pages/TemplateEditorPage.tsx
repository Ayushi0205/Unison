import { useState, useMemo, useEffect, useRef, useCallback } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import {
  DndContext, closestCenter, PointerSensor, useSensor, useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext, useSortable, verticalListSortingStrategy, arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { PARTIALS } from '../data/partials'
import { PROJECTS } from '../data/programs'
import { REQUIRED_PARTIAL_RULES } from '../data/required-partial-rules'
import { OWNING_TEAMS, TEMPLATE_TYPES, TEMPLATE_TYPE_APPLICABILITY } from '../data/taxonomy'
import type { OwningTeam, TemplateType } from '../data/taxonomy'
import type { EmailBlock, EmailSections, Template, Variable } from '../data/types'
import { Breadcrumbs } from '../components/shared/Breadcrumbs'
import { OverflowMenu } from '../components/shared/OverflowMenu'
import { getTemplate, saveTemplate } from '../data/session-store'
import {
  bodyHtmlFromSections,
  newBlockId,
  partialIdsFromSections,
  renderSection,
  sectionsFromTemplate,
} from '../data/sections'
import { useCurrentUser } from '../hooks/useCurrentUser'
import { useToast } from '../components/shared/Toast'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function extractVariableRefs(text: string): string[] {
  const matches = text.match(/\{\{([^}]+)\}\}/g) || []
  return Array.from(new Set(matches.map((m) => m.replace(/\{\{|\}\}/g, '').trim())))
}

function buildVariables(refs: string[], existing: Variable[]): Variable[] {
  return refs.map((name) => {
    const found = existing.find((v) => v.name === name)
    return found ?? { name, type: 'string' as const, required: true, sampleValue: '' }
  })
}

function substituteVariables(text: string, variables: Variable[]): string {
  let result = text
  for (const v of variables) {
    // Resolution order: sampleValue (preview) → defaultValue (send-time fallback) → bracket placeholder
    const val = v.sampleValue || v.defaultValue || `[${v.name}]`
    result = result.replace(new RegExp(`\\{\\{${v.name.replace(/\./g, '\\.')}\\}\\}`, 'g'), val)
  }
  return result.replace(/\{\{([^}]+)\}\}/g, (_m, name) => `[${name.trim()}]`)
}

function buildCTAHTML(text: string, url: string, color: 'green' | 'purple'): string {
  const palette = color === 'purple' ? { bg: '#4B286D', fg: '#FFFFFF' } : { bg: '#007F4A', fg: '#FFFFFF' }
  // No hardcoded text-align on the wrapper — the toolbar's Align button
  // (which sets text-align on the closest block to the selection) needs to
  // be able to control the button's left/center/right placement.
  return `<div style="padding:16px 0"><a href="${url}" style="display:inline-block;background:${palette.bg};color:${palette.fg};padding:12px 32px;border-radius:6px;text-decoration:none;font-weight:600">${text}</a></div>`
}

type PopoverKind = 'link' | 'image' | 'cta' | 'variable' | null
type SectionKey = 'header' | 'body' | 'footer'

const SECTION_LABEL: Record<SectionKey, string> = { header: 'Header', body: 'Body', footer: 'Footer' }
const SECTION_PARTIAL_KEY: Record<SectionKey, 'Header' | 'Body' | 'Footer'> = {
  header: 'Header',
  body: 'Body',
  footer: 'Footer',
}

// ─── Main component ───────────────────────────────────────────────────────────

export function TemplateEditorPage() {
  const { id } = useParams<{ id?: string }>()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { user } = useCurrentUser()
  const { show } = useToast()

  const existing = id ? getTemplate(id) : undefined
  const isEdit = !!existing

  const duplicateFromId = searchParams.get('duplicateFrom')
  const duplicateSource = duplicateFromId ? getTemplate(duplicateFromId) : undefined
  const source = existing ?? duplicateSource

  // ── Form state ─────────────────────────────────────────────────────────────
  const [name, setName] = useState(
    existing?.name ?? (duplicateSource ? `Copy of ${duplicateSource.name}` : ''),
  )
  const [subject, setSubject] = useState(source?.subject ?? '')
  const [preHeader, setPreHeader] = useState(source?.preHeader ?? '')
  const [selectedTeam, setSelectedTeam] = useState<OwningTeam | ''>(
    source?.owningTeam ?? user.team,
  )
  const [selectedType, setSelectedType] = useState<TemplateType | ''>(
    source?.templateType ?? '',
  )
  const [selectedProgramId, setSelectedProgramId] = useState<string>(
    source?.programId ?? '',
  )

  // Block-based sections (header / body / footer)
  const [sections, setSections] = useState<EmailSections>(() => sectionsFromTemplate(source))

  // ── Editor state ───────────────────────────────────────────────────────────
  const [focusedBlockId, setFocusedBlockId] = useState<string | null>(null)
  const editorRefs = useRef<Map<string, HTMLDivElement>>(new Map())
  const savedRange = useRef<Range | null>(null)
  // Refs + cursor tracking for plain-text fields (subject / preview text)
  const subjectInputRef = useRef<HTMLInputElement>(null)
  const preHeaderInputRef = useRef<HTMLInputElement>(null)
  const subjectCursor = useRef<number>(0)
  const preHeaderCursor = useRef<number>(0)
  const [popover, setPopover] = useState<PopoverKind>(null)
  const [activeFormats, setActiveFormats] = useState({ bold: false, italic: false, underline: false, block: '' })
  const [expandedPartial, setExpandedPartial] = useState<string | null>(null)
  // Per-block HTML/source view mode. Default for any block is 'rich' (contenteditable).
  // In 'source' mode, the block renders a textarea with the raw HTML — useful for migrating
  // templates from other systems by pasting in HTML.
  const [blockViewModes, setBlockViewModes] = useState<Record<string, 'rich' | 'source'>>({})
  // Inline partial picker — only used now for picking via inserter popovers (no modal state needed)
  const [sampleValues, setSampleValues] = useState<Record<string, string>>({})
  // Default values — used at send time if the pipeline doesn't supply a value for a variable.
  // Initialized from the source template (if editing) and persisted on save.
  const [defaultValues, setDefaultValues] = useState<Record<string, string>>(() => {
    const map: Record<string, string> = {}
    for (const v of source?.variables ?? []) {
      if (v.defaultValue != null) map[v.name] = v.defaultValue
    }
    return map
  })
  // Preview side-by-side state: open by default for continuous visual feedback while editing.
  // The fullscreen modal is launched from the sidebar's ⤢ button.
  const [previewOpen, setPreviewOpen] = useState(true)
  const [showPreview, setShowPreview] = useState(false) // fullscreen modal
  const [variablesExpanded, setVariablesExpanded] = useState(false)
  const [readinessExpanded, setReadinessExpanded] = useState(false)

  // ── Computed ───────────────────────────────────────────────────────────────

  const availableTypes = useMemo<TemplateType[]>(() => {
    if (!selectedTeam) return [...TEMPLATE_TYPES]
    return TEMPLATE_TYPES.filter((t) => {
      const teams = TEMPLATE_TYPE_APPLICABILITY[t]
      return teams.length === 0 || teams.includes(selectedTeam as OwningTeam)
    })
  }, [selectedTeam])

  // Required partial IDs from governance rules (team+ALL × type).
  // "Others" is a catch-all type — by policy, no governance rules apply to it.
  const requiredRulePartialIds = useMemo<string[]>(() => {
    if (!selectedTeam || !selectedType) return []
    if (selectedType === 'Others') return []
    return REQUIRED_PARTIAL_RULES
      .filter((r) => (r.team === 'ALL' || r.team === selectedTeam) && r.templateType === selectedType)
      .map((r) => r.partialId)
  }, [selectedTeam, selectedType])

  // Group required partials by their section
  const requiredBySection = useMemo(() => {
    const map: Record<SectionKey, typeof PARTIALS> = { header: [], body: [], footer: [] }
    for (const pid of requiredRulePartialIds) {
      const p = PARTIALS.find((x) => x.id === pid)
      if (!p) continue
      const key = p.section.toLowerCase() as SectionKey
      map[key].push(p)
    }
    return map
  }, [requiredRulePartialIds])

  // All partial IDs currently embedded across all sections
  const allUsedPartialIds = useMemo(() => partialIdsFromSections(sections), [sections])

  // Body content concatenated (for variable extraction + legacy field)
  const concatenatedBody = useMemo(() => bodyHtmlFromSections(sections), [sections])

  // Variables: extract once across all sources and track where each one came from.
  // The source list lets the variables popover show "from Unsubscribe Link" etc. so users
  // understand why a variable appeared even if they didn't type it themselves.
  const { varRefs, varSource } = useMemo(() => {
    const source: Record<string, string[]> = {}
    const addSource = (varName: string, label: string) => {
      if (!source[varName]) source[varName] = []
      if (!source[varName].includes(label)) source[varName].push(label)
    }
    for (const v of extractVariableRefs(subject)) addSource(v, 'Subject')
    for (const v of extractVariableRefs(concatenatedBody)) addSource(v, 'Your content')
    for (const pid of partialIdsFromSections(sections)) {
      const p = PARTIALS.find((x) => x.id === pid)
      if (!p) continue
      for (const v of extractVariableRefs(p.body)) addSource(v, p.name)
    }
    return { varRefs: Object.keys(source), varSource: source }
  }, [subject, concatenatedBody, sections])

  const variables: Variable[] = useMemo(
    () => buildVariables(varRefs, source?.variables ?? []),
    [varRefs, source],
  )

  const resolvedVariables = useMemo(
    () => variables.map((v) => ({
      ...v,
      sampleValue: sampleValues[v.name] ?? v.sampleValue ?? '',
      defaultValue: defaultValues[v.name] ?? v.defaultValue,
    })),
    [variables, sampleValues, defaultValues],
  )

  // Unsaved-changes tracking
  const originalSnapshot = useMemo(
    () => JSON.stringify({
      name: existing?.name ?? (duplicateSource ? `Copy of ${duplicateSource.name}` : ''),
      subject: existing?.subject ?? '',
      preHeader: existing?.preHeader ?? '',
      owningTeam: existing?.owningTeam ?? user.team,
      templateType: existing?.templateType ?? '',
      programId: existing?.programId ?? '',
      sections: source ? sectionsFromTemplate(source) : { header: [], body: [{ id: '__seed__', type: 'content', html: '' }], footer: [] },
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [existing],
  )
  const currentSnapshot = JSON.stringify({
    name, subject, preHeader,
    owningTeam: selectedTeam, templateType: selectedType, programId: selectedProgramId,
    sections,
  })
  const dirty = originalSnapshot !== currentSnapshot

  const nameTrimmed = name.trim()
  const subjectTrimmed = subject.trim()
  // Body must have at least one non-empty content block
  const hasBodyContent = sections.body.some(
    (b) => b.type === 'content' && b.html.trim() !== '' && b.html.replace(/<[^>]*>/g, '').trim() !== '',
  )
  const canSave = !!nameTrimmed && !!subjectTrimmed && !!selectedTeam && !!selectedType && hasBodyContent

  // ── Activation readiness ──────────────────────────────────────────────────
  const missingPartialNames = useMemo(() => {
    const missing = requiredRulePartialIds.filter((pid) => !allUsedPartialIds.includes(pid))
    return missing.map((pid) => PARTIALS.find((p) => p.id === pid)?.name ?? pid)
  }, [requiredRulePartialIds, allUsedPartialIds])

  const readinessChecks = useMemo(() => {
    const checks: { label: string; actionLabel: string; passed: boolean }[] = [
      { label: 'Template name', actionLabel: 'Add a template name', passed: !!nameTrimmed },
      { label: 'Subject line', actionLabel: 'Add a subject line', passed: !!subjectTrimmed },
      { label: 'Team · Template type', actionLabel: 'Select team and type', passed: !!selectedTeam && !!selectedType },
      { label: 'Body content', actionLabel: 'Add body content', passed: hasBodyContent },
    ]
    if (missingPartialNames.length > 0) {
      for (const pName of missingPartialNames) {
        checks.push({ label: pName, actionLabel: `Missing partial: ${pName}`, passed: false })
      }
    } else if (requiredRulePartialIds.length > 0) {
      checks.push({ label: 'Required partials', actionLabel: '', passed: true })
    }
    return checks
  }, [nameTrimmed, subjectTrimmed, selectedTeam, selectedType, hasBodyContent, missingPartialNames, requiredRulePartialIds])

  const allReady = readinessChecks.every((c) => c.passed)
  const failedCount = readinessChecks.filter((c) => !c.passed).length

  // ── Effects ────────────────────────────────────────────────────────────────

  // Track active text formatting (B/I/U + block) from the focused content block's selection
  useEffect(() => {
    const handler = () => {
      const sel = window.getSelection()
      if (!sel || sel.rangeCount === 0) return
      // Only update formatting state when the selection lives inside a focused content editor
      if (!focusedBlockId) return
      const editor = editorRefs.current.get(focusedBlockId)
      if (!editor || !editor.contains(sel.anchorNode)) return
      let block = ''
      try { block = (document.queryCommandValue('formatBlock') || '').toLowerCase() } catch {}
      setActiveFormats({
        bold: document.queryCommandState('bold'),
        italic: document.queryCommandState('italic'),
        underline: document.queryCommandState('underline'),
        block,
      })
    }
    document.addEventListener('selectionchange', handler)
    return () => document.removeEventListener('selectionchange', handler)
  }, [focusedBlockId])

  // beforeunload warning when there are unsaved changes
  useEffect(() => {
    if (!dirty) return
    const handler = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = '' }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [dirty])

  // Sync governance-required partials into sections when team/type changes.
  // - Insert any missing required partial into its section at index 0 (front).
  // - Optional partials that were previously present remain untouched.
  useEffect(() => {
    if (requiredRulePartialIds.length === 0) return
    setSections((prev) => {
      const next: EmailSections = { header: [...prev.header], body: [...prev.body], footer: [...prev.footer] }
      let changed = false
      for (const pid of requiredRulePartialIds) {
        const p = PARTIALS.find((x) => x.id === pid)
        if (!p) continue
        const sectionKey = p.section.toLowerCase() as SectionKey
        const already = next[sectionKey].some((b) => b.type === 'partial' && b.partialId === pid)
        if (already) continue
        const block: EmailBlock = { id: newBlockId('part'), type: 'partial', partialId: pid }
        next[sectionKey] = [block, ...next[sectionKey]]
        changed = true
      }
      return changed ? next : prev
    })
  }, [requiredRulePartialIds])

  // ── Selection helpers (operate on the focused content block) ──────────────

  const saveSelection = useCallback(() => {
    const sel = window.getSelection()
    if (!sel || sel.rangeCount === 0 || !focusedBlockId) return
    const editor = editorRefs.current.get(focusedBlockId)
    if (editor && editor.contains(sel.anchorNode)) {
      savedRange.current = sel.getRangeAt(0).cloneRange()
    }
  }, [focusedBlockId])

  const restoreSelection = useCallback(() => {
    if (!focusedBlockId) return
    const editor = editorRefs.current.get(focusedBlockId)
    if (!editor) return
    if (!savedRange.current) { editor.focus(); return }
    const sel = window.getSelection()
    if (sel) { sel.removeAllRanges(); sel.addRange(savedRange.current) }
    editor.focus()
  }, [focusedBlockId])

  const syncBlockFromEditor = useCallback((blockId: string) => {
    const editor = editorRefs.current.get(blockId)
    if (!editor) return
    const html = editor.innerHTML
    setSections((prev) => ({
      ...prev,
      body: prev.body.map((b) => (b.id === blockId && b.type === 'content' ? { ...b, html } : b)),
      header: prev.header.map((b) => (b.id === blockId && b.type === 'content' ? { ...b, html } : b)),
      footer: prev.footer.map((b) => (b.id === blockId && b.type === 'content' ? { ...b, html } : b)),
    }))
  }, [])

  // Direct HTML setter — used by the source-mode textarea, which writes raw HTML
  // (the contenteditable-based syncBlockFromEditor would read from a DOM that doesn't exist).
  const setBlockHtml = useCallback((blockId: string, html: string) => {
    setSections((prev) => ({
      ...prev,
      body: prev.body.map((b) => (b.id === blockId && b.type === 'content' ? { ...b, html } : b)),
      header: prev.header.map((b) => (b.id === blockId && b.type === 'content' ? { ...b, html } : b)),
      footer: prev.footer.map((b) => (b.id === blockId && b.type === 'content' ? { ...b, html } : b)),
    }))
  }, [])

  // Toggle rich/source view for a single content block. Default is 'rich'.
  const toggleBlockViewMode = useCallback((blockId: string) => {
    setBlockViewModes((prev) => ({
      ...prev,
      [blockId]: (prev[blockId] ?? 'rich') === 'rich' ? 'source' : 'rich',
    }))
  }, [])

  const exec = useCallback((cmd: string, value?: string) => {
    if (!focusedBlockId) return
    const editor = editorRefs.current.get(focusedBlockId)
    if (!editor) return
    editor.focus()
    document.execCommand(cmd, false, value)
    syncBlockFromEditor(focusedBlockId)
  }, [focusedBlockId, syncBlockFromEditor])

  const insertHTML = useCallback((html: string) => {
    if (!focusedBlockId) return
    restoreSelection()
    document.execCommand('insertHTML', false, html)
    syncBlockFromEditor(focusedBlockId)
  }, [focusedBlockId, restoreSelection, syncBlockFromEditor])

  const openPopover = useCallback((kind: PopoverKind) => {
    saveSelection()
    setPopover(kind)
  }, [saveSelection])

  // ── Block helpers ──────────────────────────────────────────────────────────

  // updateSection helper kept inline as `setSections((prev) => ({ ...prev, [section]: ... }))`
  // in the block helpers below. The named helper was unused and was removed.

  const addContentBlock = (section: SectionKey, insertAt: number) => {
    const block: EmailBlock = { id: newBlockId('content'), type: 'content', html: '' }
    setSections((prev) => {
      const arr = [...prev[section]]
      arr.splice(insertAt, 0, block)
      return { ...prev, [section]: arr }
    })
    // Focus the new block on next tick
    setTimeout(() => {
      const el = editorRefs.current.get(block.id)
      el?.focus()
      setFocusedBlockId(block.id)
    }, 0)
  }

  const addPartialBlock = (section: SectionKey, partialId: string, insertAt: number) => {
    const block: EmailBlock = { id: newBlockId('part'), type: 'partial', partialId }
    setSections((prev) => {
      const arr = [...prev[section]]
      arr.splice(insertAt, 0, block)
      return { ...prev, [section]: arr }
    })
  }

  const removeBlock = (section: SectionKey, blockId: string) => {
    setSections((prev) => ({ ...prev, [section]: prev[section].filter((b) => b.id !== blockId) }))
  }

  // (Previously had a `moveBlock` helper for ↑/↓ keyboard reorder — removed; drag-and-drop
  // via @dnd-kit's `handleSectionDragEnd` below covers all reorder cases.)

  // Drag handler — reorders blocks within a single section based on @dnd-kit drag end
  const handleSectionDragEnd = (section: SectionKey) => (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return
    setSections((prev) => {
      const arr = prev[section]
      const fromIdx = arr.findIndex((b) => b.id === active.id)
      const toIdx = arr.findIndex((b) => b.id === over.id)
      if (fromIdx < 0 || toIdx < 0) return prev
      return { ...prev, [section]: arrayMove(arr, fromIdx, toIdx) }
    })
  }

  // dnd-kit sensors — small activation distance so clicks on the drag handle still work as clicks
  const dndSensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))

  // ── Partial picker (inline popovers) ──────────────────────────────────────

  const getPickablePartialsForSection = (section: SectionKey) => {
    const sectionPartialKey = SECTION_PARTIAL_KEY[section]
    return PARTIALS.filter(
      (p) =>
        p.lifecycle === 'Active' &&
        p.section === sectionPartialKey &&
        !allUsedPartialIds.includes(p.id),
    )
  }

  // ── Actions ────────────────────────────────────────────────────────────────

  const handleCancel = () => {
    if (dirty && !window.confirm('Discard unsaved changes?')) return
    navigate(existing ? `/templates/${existing.id}` : '/templates')
  }

  const handleSave = () => {
    if (!canSave) return
    const now = new Date().toISOString()
    const templateId = existing?.id ?? `tpl-${Date.now()}`

    const template: Template = {
      id: templateId,
      name: nameTrimmed,
      subject: subjectTrimmed,
      preHeader: preHeader.trim() || undefined,
      body: concatenatedBody, // legacy field — concat of all body content blocks
      sections,
      contentType: 'html',
      templateType: selectedType as TemplateType,
      owningTeam: selectedTeam as OwningTeam,
      programId: selectedProgramId || null,
      lifecycle: existing ? existing.lifecycle : 'Inactive',
      owner: existing?.owner ?? user.email,
      lastEditedBy: user.email,
      requiredPartialIds: partialIdsFromSections(sections),
      // Persist variables with the user-supplied default values folded in.
      variables: variables.map((v) => {
        const dv = defaultValues[v.name]
        return dv && dv.trim() !== '' ? { ...v, defaultValue: dv } : { ...v, defaultValue: undefined }
      }),
      tags: existing?.tags ?? [],
      version: existing ? existing.version + 1 : 1,
      createdBy: existing?.createdBy ?? user.email,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
      activatedAt: existing?.activatedAt,
      deactivatedAt: existing?.deactivatedAt,
    }
    saveTemplate(template)
    show('Template saved.', 'success')
    navigate(isEdit ? `/templates/${templateId}` : `/templates/${templateId}?created=true`)
  }

  // ── Preview HTML (fully assembled) ─────────────────────────────────────────

  const renderContent = (html: string) => substituteVariables(html, resolvedVariables)
  const previewSubject = substituteVariables(subject, resolvedVariables)
  const previewPreHeader = preHeader ? substituteVariables(preHeader, resolvedVariables) : ''

  const previewHtml = useMemo(() => {
    const headerHtml = renderSection(sections.header, renderContent)
    const bodyHtml = renderSection(sections.body, renderContent) ||
      '<p style="color:#9ca3af;font-style:italic">Start writing to see a preview.</p>'
    const footerHtml = renderSection(sections.footer, renderContent)
    return `<!DOCTYPE html><html><head><style>
      body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; margin: 0; padding: 0; font-size: 14px; color: #111827; line-height: 1.5; }
      * { box-sizing: border-box; }
      img { max-width: 100%; height: auto; }
      a { color: #007F4A; }
      h1 { font-size: 22px; margin: 0 0 8px; }
      h2 { font-size: 18px; margin: 12px 0 6px; }
      h3 { font-size: 15px; margin: 10px 0 4px; }
      p { margin: 0 0 10px; }
      ul, ol { margin: 0 0 10px 20px; padding: 0; }
      .subject-row { background: #f9fafb; border-bottom: 1px solid #e5e7eb; padding: 12px 20px; }
      .subject-label { font-size: 10px; text-transform: uppercase; letter-spacing: 0.06em; font-weight: 600; color: #9ca3af; margin-bottom: 3px; }
      .subject-value { font-size: 14px; font-weight: 600; color: #111827; }
      .preheader-row { background: #f9fafb; border-bottom: 1px solid #e5e7eb; padding: 8px 20px; }
      .preheader-label { font-size: 10px; text-transform: uppercase; letter-spacing: 0.06em; font-weight: 600; color: #9ca3af; margin-bottom: 2px; }
      .preheader-value { font-size: 12px; color: #6b7280; }
      .content { padding: 20px; }
    </style></head><body>
    <div class="subject-row">
      <div class="subject-label">Subject</div>
      <div class="subject-value">${previewSubject || '<span style="color:#9ca3af;font-style:italic;font-weight:400">Enter a subject line…</span>'}</div>
    </div>
    ${previewPreHeader ? `<div class="preheader-row"><div class="preheader-label">Preview text</div><div class="preheader-value">${previewPreHeader}</div></div>` : ''}
    <div class="content">${headerHtml}${bodyHtml}${footerHtml}</div>
    </body></html>`
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sections, previewSubject, previewPreHeader, resolvedVariables])

  // ── Not found ──────────────────────────────────────────────────────────────

  if (id && !existing) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <h2 className="text-xl font-semibold text-gray-900 mb-2">Template not found</h2>
        <p className="text-sm text-gray-500 mb-4">This template doesn't exist or the link is incorrect.</p>
        <button onClick={() => navigate('/templates')} className="text-sm text-primary font-medium hover:underline">← Back to Library</button>
      </div>
    )
  }

  // ── Layout ─────────────────────────────────────────────────────────────────

  return (
    <div className="max-w-[1280px]">
      <Breadcrumbs items={
        isEdit && existing
          ? [
              { label: 'Templates', to: '/templates' },
              { label: existing.name, to: `/templates/${existing.id}` },
              { label: 'Edit' },
            ]
          : [
              { label: 'Templates', to: '/templates' },
              { label: 'New template' },
            ]
      } />

      {/* Editable page header — matches `Screenshot_7.12.00`:
          editable title, Cancel (secondary) + Save (primary) buttons, overflow "…" menu
          (edit-mode only), bottom divider line under the entire row. */}
      <div className="flex items-start justify-between gap-6 mt-4 pb-4 border-b border-gray-200">
        <input
          type="text" value={name} onChange={(e) => setName(e.target.value)}
          placeholder="Untitled template"
          className="flex-1 text-3xl font-semibold text-gray-900 bg-transparent border-0 px-0 focus:outline-none placeholder:text-gray-300"
        />
        <div className="flex items-center gap-2 shrink-0 mt-1">
          <button onClick={handleCancel} className="px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50">Cancel</button>
          <button onClick={handleSave} disabled={!canSave}
            className="px-4 py-1.5 text-sm font-medium text-white bg-primary rounded-md hover:bg-primary-hover disabled:opacity-40 disabled:cursor-not-allowed">
            {isEdit ? 'Save changes' : 'Save template'}
          </button>
          {/* Overflow menu — visible only when editing an existing template.
              "Delete" is a placeholder for now; will wire to a confirm modal in Phase 8. */}
          {isEdit && (
            <OverflowMenu
              items={[
                {
                  label: 'Delete template',
                  destructive: true,
                  onClick: () => show('Delete coming soon. (Will open a confirm modal in Phase 8.)'),
                },
              ]}
            />
          )}
        </div>
      </div>

      {/* Active template warning */}
      {isEdit && existing.lifecycle === 'Active' && (
        <div className="mt-3 bg-amber-50 border border-amber-200 rounded-md px-4 py-3 text-sm text-amber-900 flex items-start gap-2">
          <WarningIcon />
          <span>
            <strong className="font-semibold">This template is currently Active.</strong>{' '}
            Your changes will update the live version immediately upon saving.
          </span>
        </div>
      )}

      {/* Details accordion — per designer feedback item 14:
          "Details can be placed first on the right side, it's collapsible anyway.
           So if in Edit mode or New Partial, user could edit the infos like Team,
           Section, Template Type, Tags."
          For the editor pages we keep Details at the top of the body (rather than in
          the right preview sidebar) to preserve the live-preview pane that authors
          actively use while editing. Fields stay editable. */}
      <EditorDetailsAccordion>
        <MetaField label="Team *">
          {isEdit ? (
            <span className="text-sm text-gray-900">{selectedTeam}</span>
          ) : (
            <select value={selectedTeam}
              onChange={(e) => { setSelectedTeam(e.target.value as OwningTeam | ''); setSelectedType('') }}
              className="h-8 border border-gray-300 rounded-md text-sm px-2 bg-white focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary">
              <option value="">Select team…</option>
              {OWNING_TEAMS.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          )}
        </MetaField>
        <MetaField label="Type *">
          <select value={selectedType} disabled={!selectedTeam}
            onChange={(e) => setSelectedType(e.target.value as TemplateType | '')}
            className="h-8 border border-gray-300 rounded-md text-sm px-2 bg-white focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary disabled:opacity-50 disabled:cursor-not-allowed">
            <option value="">{selectedTeam ? 'Select type…' : 'Select team first…'}</option>
            {availableTypes.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </MetaField>
        <MetaField label="Project">
          <select value={selectedProgramId} onChange={(e) => setSelectedProgramId(e.target.value)}
            className="h-8 border border-gray-300 rounded-md text-sm px-2 bg-white focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary">
            <option value="">None</option>
            {PROJECTS.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </MetaField>
      </EditorDetailsAccordion>

      {/* Subject */}
      <div className="mt-4 mb-1">
        <div className="flex items-center justify-between mb-1.5">
          <label className="text-[10px] uppercase tracking-wider font-semibold text-gray-500">Subject line *</label>
          <InlineVarPicker
            varRefs={varRefs}
            onPick={(varName) => {
              const insert = `{{${varName}}}`
              const pos = subjectCursor.current
              const next = subject.slice(0, pos) + insert + subject.slice(pos)
              setSubject(next)
              setTimeout(() => {
                const el = subjectInputRef.current
                if (!el) return
                el.focus()
                el.setSelectionRange(pos + insert.length, pos + insert.length)
              }, 0)
            }}
          />
        </div>
        <input
          ref={subjectInputRef}
          type="text" value={subject} onChange={(e) => setSubject(e.target.value)}
          onSelect={(e) => { subjectCursor.current = (e.target as HTMLInputElement).selectionStart ?? subject.length }}
          onKeyUp={(e) => { subjectCursor.current = (e.target as HTMLInputElement).selectionStart ?? subject.length }}
          onClick={(e) => { subjectCursor.current = (e.target as HTMLInputElement).selectionStart ?? subject.length }}
          placeholder="e.g. Welcome to the team, {{user.name}}!"
          className="w-full h-10 px-3 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
        />
      </div>

      {/* Preview text (also known as pre-header in email standards — stored as Template.preHeader) */}
      <div className="mt-2 mb-1">
        <div className="flex items-center justify-between mb-1.5">
          <label className="text-[10px] uppercase tracking-wider font-semibold text-gray-500">
            Preview text <span className="text-gray-400 normal-case tracking-normal font-normal">(optional)</span>
          </label>
          <InlineVarPicker
            varRefs={varRefs}
            onPick={(varName) => {
              const insert = `{{${varName}}}`
              const pos = preHeaderCursor.current
              const next = preHeader.slice(0, pos) + insert + preHeader.slice(pos)
              setPreHeader(next)
              setTimeout(() => {
                const el = preHeaderInputRef.current
                if (!el) return
                el.focus()
                el.setSelectionRange(pos + insert.length, pos + insert.length)
              }, 0)
            }}
          />
        </div>
        <input
          ref={preHeaderInputRef}
          type="text" value={preHeader} onChange={(e) => setPreHeader(e.target.value)}
          onSelect={(e) => { preHeaderCursor.current = (e.target as HTMLInputElement).selectionStart ?? preHeader.length }}
          onKeyUp={(e) => { preHeaderCursor.current = (e.target as HTMLInputElement).selectionStart ?? preHeader.length }}
          onClick={(e) => { preHeaderCursor.current = (e.target as HTMLInputElement).selectionStart ?? preHeader.length }}
          placeholder="Short text shown in the inbox preview, after the subject line" maxLength={150}
          className="w-full h-9 px-3 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
        />
        {preHeader.length > 120 && (
          <p className="text-[10px] text-gray-400 mt-0.5 text-right">{preHeader.length}/150</p>
        )}
      </div>

      {/* Sticky toolbar — acts on focused content block */}
      <EditorToolbar
        focused={!!focusedBlockId}
        exec={exec} openPopover={openPopover}
        varRefs={varRefs} onInsertVariable={(v) => insertHTML(`{{${v}}}`)}
        active={activeFormats} saveSelection={saveSelection} restoreSelection={restoreSelection}
        sourceMode={!!focusedBlockId && (blockViewModes[focusedBlockId] ?? 'rich') === 'source'}
        onToggleSource={() => focusedBlockId && toggleBlockViewMode(focusedBlockId)}
      />

      {/* ── Composition area: editor (left) + side-by-side preview (right) ──
          The preview pane is open by default and collapsible. When collapsed, a thin rail
          shows on the right with an arrow to re-expand. The editor takes the remaining width.
          Variables and Readiness live in the left column, below the three editor sections. */}
      <div className="mt-3 flex gap-3 items-start">
        <div className="flex-1 min-w-0 space-y-3">
          {/* Editor sections (header / body / footer) */}
          {(['header', 'body', 'footer'] as SectionKey[]).map((key) => (
            <DndContext key={key} sensors={dndSensors} collisionDetection={closestCenter} onDragEnd={handleSectionDragEnd(key)}>
              <SortableContext items={sections[key].map((b) => b.id)} strategy={verticalListSortingStrategy}>
                <SectionView
                  sectionKey={key}
                  blocks={sections[key]}
                  requiredCount={requiredBySection[key].length}
                  editorRefs={editorRefs}
                  focusedBlockId={focusedBlockId}
                  onFocusBlock={setFocusedBlockId}
                  onSyncBlock={syncBlockFromEditor}
                  onRemove={(blockId) => removeBlock(key, blockId)}
                  onAddContent={(at) => addContentBlock(key, at)}
                  onAddPartial={(at, partialId) => addPartialBlock(key, partialId, at)}
                  pickablePartialsFor={(_at) => getPickablePartialsForSection(key)}
                  isPartialRequired={(pid) => requiredRulePartialIds.includes(pid)}
                  expandedPartial={expandedPartial} onToggleExpand={setExpandedPartial}
                  blockViewModes={blockViewModes}
                  onChangeBlockHtml={setBlockHtml}
                />
              </SortableContext>
            </DndContext>
          ))}

          {/* Governance info */}
          {selectedTeam && selectedType && requiredRulePartialIds.length > 0 && (
            <div className="text-xs text-gray-500 flex items-start gap-1.5">
              <InfoIcon />
              <span>Required partials are enforced by governance rules for <strong className="text-gray-700">{selectedTeam} · {selectedType}</strong> templates. You can reposition them anywhere within their section.</span>
            </div>
          )}

          {/* Variables — collapsible section showing all variables in this template */}
          <VariablesSection
            varRefs={varRefs}
            varSource={varSource}
            defaultValues={defaultValues}
            onChangeDefault={(name, value) => setDefaultValues((dv) => ({ ...dv, [name]: value }))}
            expanded={variablesExpanded}
            onToggle={() => setVariablesExpanded((v) => !v)}
          />

          {/* Activation readiness — collapsible status row */}
          <ReadinessRow
            allReady={allReady} failedCount={failedCount}
            checks={readinessChecks}
            expanded={readinessExpanded}
            onToggle={() => setReadinessExpanded((v) => !v)}
          />
        </div>

        {/* Right column: preview sidebar (open) or thin rail (collapsed) */}
        {previewOpen ? (
          <PreviewSidebar
            html={previewHtml}
            variables={variables}
            sampleValues={sampleValues}
            defaultValues={defaultValues}
            onChangeSample={(name, value) => setSampleValues((sv) => ({ ...sv, [name]: value }))}
            onCollapse={() => setPreviewOpen(false)}
            onFullscreen={() => setShowPreview(true)}
          />
        ) : (
          <PreviewRail onExpand={() => setPreviewOpen(true)} />
        )}
      </div>

      {/* Preview modal — includes a collapsible "Sample data" panel for filling preview values */}
      {showPreview && (
        <PreviewModal
          html={previewHtml}
          onClose={() => setShowPreview(false)}
          variables={variables}
          sampleValues={sampleValues}
          defaultValues={defaultValues}
          onChangeSample={(name, value) => setSampleValues((sv) => ({ ...sv, [name]: value }))}
        />
      )}

      {/* Popovers */}
      {popover === 'link' && (
        <InsertPopover title="Insert link"
          fields={[
            { key: 'url', label: 'Link URL', placeholder: 'https://… or {{varName}}' },
            { key: 'text', label: 'Display text', placeholder: 'Click here' },
          ]}
          onSubmit={({ url, text }) => { insertHTML(`<a href="${url}">${text || url}</a>`); setPopover(null) }}
          onCancel={() => setPopover(null)} />
      )}
      {popover === 'image' && (
        <InsertPopover title="Insert image"
          fields={[
            { key: 'url', label: 'Image URL', placeholder: 'https://…' },
            { key: 'alt', label: 'Alt text', placeholder: 'Description of the image' },
          ]}
          onSubmit={({ url, alt }) => { insertHTML(`<img src="${url}" alt="${alt}" style="max-width:100%;height:auto" />`); setPopover(null) }}
          onCancel={() => setPopover(null)} />
      )}
      {popover === 'cta' && (
        <CTAPopover
          onSubmit={({ text, url, color }) => { insertHTML(buildCTAHTML(text, url, color)); setPopover(null) }}
          onCancel={() => setPopover(null)} />
      )}
      {popover === 'variable' && (
        <VariablePopover existing={varRefs}
          onSubmit={(varName) => { insertHTML(`{{${varName}}}`); setPopover(null) }}
          onCancel={() => setPopover(null)} />
      )}

      <style>{`
        [contenteditable][data-placeholder]:empty::before {
          content: attr(data-placeholder);
          color: #9ca3af;
          font-style: italic;
        }
      `}</style>
    </div>
  )
}

// ─── Section view: one section's block list + always-visible inserters ──────

function SectionView({
  sectionKey, blocks, requiredCount,
  editorRefs, focusedBlockId, onFocusBlock, onSyncBlock,
  onRemove, onAddContent, onAddPartial, pickablePartialsFor,
  isPartialRequired, expandedPartial, onToggleExpand,
  blockViewModes, onChangeBlockHtml,
}: {
  sectionKey: SectionKey
  blocks: EmailBlock[]
  requiredCount: number
  editorRefs: React.MutableRefObject<Map<string, HTMLDivElement>>
  focusedBlockId: string | null
  onFocusBlock: (id: string | null) => void
  onSyncBlock: (id: string) => void
  onRemove: (blockId: string) => void
  onAddContent: (insertAt: number) => void
  onAddPartial: (insertAt: number, partialId: string) => void
  pickablePartialsFor: (insertAt: number) => typeof PARTIALS
  isPartialRequired: (partialId: string) => boolean
  expandedPartial: string | null
  onToggleExpand: (pid: string | null) => void
  blockViewModes: Record<string, 'rich' | 'source'>
  onChangeBlockHtml: (blockId: string, html: string) => void
}) {
  const isStructural = sectionKey === 'header' || sectionKey === 'footer'
  const bandClass = isStructural ? 'bg-gray-50/70 border-gray-200' : 'bg-white border-gray-200'
  const dotColor = sectionKey === 'header' ? 'bg-blue-400' : sectionKey === 'footer' ? 'bg-purple-400' : 'bg-green-400'

  // Header and footer hold a single block (content or partial). Body is unlimited.
  // If a structural section already has 1+ block, suppress inserters so users can't stack.
  const allowMoreBlocks = !isStructural || blocks.length === 0
  const slotLabel = isStructural ? 'Single slot' : 'Multiple blocks'

  return (
    <div className={`rounded-lg border ${bandClass} px-3 pt-2 pb-3`}>
      {/* Section label */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5">
          <span className={`w-1.5 h-1.5 rounded-full ${dotColor}`} />
          <span className="text-[10px] uppercase tracking-wider font-semibold text-gray-500">
            {SECTION_LABEL[sectionKey]}
          </span>
          <span className="text-[9px] text-gray-400">· {slotLabel}</span>
          {requiredCount > 0 && (
            <span className="text-[9px] text-gray-400">· {requiredCount} required</span>
          )}
        </div>
        {blocks.length > 1 && (
          <span className="text-[10px] text-gray-400 italic">Drag blocks to reorder</span>
        )}
      </div>

      <div className="space-y-0">
        {/* Top inserter — only when this section can still accept blocks */}
        {allowMoreBlocks && (
          <BlockInserter
            sectionKey={sectionKey}
            partials={pickablePartialsFor(0)}
            onAddContent={() => onAddContent(0)}
            onAddPartial={(pid) => onAddPartial(0, pid)}
            emptyHint={blocks.length === 0 ? sectionEmptyHint(sectionKey) : null}
          />
        )}

        {blocks.map((block, idx) => (
          <div key={block.id}>
            <SortableBlock
              block={block}
              isFocused={focusedBlockId === block.id}
              editorRefs={editorRefs}
              onFocus={() => onFocusBlock(block.id)}
              onInput={() => onSyncBlock(block.id)}
              onRemove={() => onRemove(block.id)}
              isPartialRequired={(pid) => isPartialRequired(pid)}
              expandedPartial={expandedPartial}
              onToggleExpand={onToggleExpand}
              draggable={!isStructural && blocks.length > 1}
              viewMode={blockViewModes[block.id] ?? 'rich'}
              onChangeHtml={(html) => onChangeBlockHtml(block.id, html)}
            />
            {/* Inserter between blocks — only for body (header/footer cap at 1 block) */}
            {!isStructural && (
              <BlockInserter
                sectionKey={sectionKey}
                partials={pickablePartialsFor(idx + 1)}
                onAddContent={() => onAddContent(idx + 1)}
                onAddPartial={(pid) => onAddPartial(idx + 1, pid)}
                emptyHint={null}
              />
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

function sectionEmptyHint(sectionKey: SectionKey): string {
  if (sectionKey === 'header') return 'Empty — add one content block or one partial.'
  if (sectionKey === 'footer') return 'Empty — add one content block or one partial.'
  return 'Add a content block to start writing.'
}

// ─── Sortable wrapper for a block ────────────────────────────────────────────

function SortableBlock({
  block, isFocused, editorRefs,
  onFocus, onInput, onRemove,
  isPartialRequired, expandedPartial, onToggleExpand, draggable,
  viewMode, onChangeHtml,
}: {
  block: EmailBlock
  isFocused: boolean
  editorRefs: React.MutableRefObject<Map<string, HTMLDivElement>>
  onFocus: () => void
  onInput: () => void
  onRemove: () => void
  isPartialRequired: (pid: string) => boolean
  expandedPartial: string | null
  onToggleExpand: (pid: string | null) => void
  /** When false, the drag handle is hidden (single-slot sections have nothing to reorder). */
  draggable: boolean
  /** View mode for content blocks (ignored for partial blocks). */
  viewMode: 'rich' | 'source'
  /** Direct HTML setter, used by source-mode textarea. */
  onChangeHtml: (html: string) => void
}) {
  const required = block.type === 'partial' && isPartialRequired(block.partialId)
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: block.id,
  })
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  }

  return (
    <div ref={setNodeRef} style={style} className="relative group/block flex items-stretch gap-1">
      {/* Drag handle column — only when reordering is meaningful */}
      {draggable ? (
        <button
          {...attributes} {...listeners}
          className="shrink-0 w-5 flex items-center justify-center text-gray-300 hover:text-gray-600 cursor-grab active:cursor-grabbing"
          title="Drag to reorder"
          aria-label="Drag handle"
          onMouseDown={(e) => e.preventDefault()}
        >
          <GripIcon />
        </button>
      ) : (
        <div className="shrink-0 w-5" aria-hidden="true" />
      )}

      {/* Block content */}
      <div className="flex-1 min-w-0">
        {block.type === 'content' ? (
          <ContentBlockView
            blockId={block.id} html={block.html}
            isFocused={isFocused}
            editorRefs={editorRefs}
            onFocus={onFocus}
            onInput={onInput}
            onRemove={onRemove}
            viewMode={viewMode}
            onChangeHtml={onChangeHtml}
          />
        ) : (
          <PartialBlockView
            partialId={block.partialId}
            required={required}
            expanded={expandedPartial === block.id}
            onToggleExpand={() => onToggleExpand(expandedPartial === block.id ? null : block.id)}
            onRemove={required ? undefined : onRemove}
          />
        )}
      </div>
    </div>
  )
}

// ─── Inserter (always-visible "+ Content" / "+ Partial" row) ────────────────

function BlockInserter({
  sectionKey, partials, onAddContent, onAddPartial, emptyHint,
}: {
  sectionKey: SectionKey
  partials: typeof PARTIALS
  onAddContent: () => void
  onAddPartial: (pid: string) => void
  emptyHint: string | null
}) {
  const [pickerOpen, setPickerOpen] = useState(false)
  const [search, setSearch] = useState('')

  const filtered = search
    ? partials.filter((p) => p.name.toLowerCase().includes(search.toLowerCase()))
    : partials

  const dotColor = sectionKey === 'header' ? 'bg-blue-400' : sectionKey === 'footer' ? 'bg-purple-400' : 'bg-green-400'

  return (
    <div className={emptyHint ? 'py-1.5' : 'py-1 flex items-center gap-2'}>
      <div className="flex items-center gap-1.5 pl-6">
        <button onClick={onAddContent}
          className="text-[11px] px-2 py-0.5 text-gray-500 hover:text-primary hover:bg-white rounded border border-transparent hover:border-gray-200 inline-flex items-center gap-1">
          <PlusIcon /> Content
        </button>
        <div className="relative">
          <button onClick={() => { setPickerOpen(!pickerOpen); setSearch('') }}
            className="text-[11px] px-2 py-0.5 text-gray-500 hover:text-primary hover:bg-white rounded border border-transparent hover:border-gray-200 inline-flex items-center gap-1">
            <PlusIcon /> Partial
          </button>
          {pickerOpen && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setPickerOpen(false)} />
              <div className="absolute left-0 top-full mt-1 w-72 bg-white border border-gray-200 rounded-lg shadow-lg z-50">
                <div className="px-3 py-2 border-b border-gray-100 flex items-center gap-2">
                  <span className={`w-1.5 h-1.5 rounded-full ${dotColor}`} />
                  <span className="text-[10px] uppercase tracking-wider font-semibold text-gray-500">
                    Add {SECTION_LABEL[sectionKey].toLowerCase()} partial
                  </span>
                </div>
                <div className="p-2">
                  <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search partials…" autoFocus
                    className="w-full h-8 px-2 text-xs border border-gray-200 rounded focus:outline-none focus:border-primary" />
                </div>
                <div className="max-h-56 overflow-y-auto px-1 pb-2">
                  {filtered.length === 0 ? (
                    <p className="px-3 py-3 text-center text-xs text-gray-400 italic">
                      {search ? 'No matching partials.' : 'No available partials.'}
                    </p>
                  ) : (
                    filtered.map((p) => (
                      <button key={p.id}
                        onClick={() => { setPickerOpen(false); onAddPartial(p.id) }}
                        className="w-full text-left px-2.5 py-1.5 rounded text-xs text-gray-700 hover:bg-gray-50 flex items-center gap-2">
                        <span className="text-gray-400">📄</span>
                        <div className="flex-1 min-w-0">
                          <span className="font-medium block truncate">{p.name}</span>
                          <span className="text-[10px] text-gray-400">by {p.authoringTeam}</span>
                        </div>
                      </button>
                    ))
                  )}
                </div>
              </div>
            </>
          )}
        </div>
        {emptyHint && <span className="text-[10px] text-gray-400 italic ml-1">{emptyHint}</span>}
      </div>
    </div>
  )
}

// ─── Content block (contenteditable) ─────────────────────────────────────────

function ContentBlockView({
  blockId, html, isFocused, editorRefs,
  onFocus, onInput, onRemove,
  viewMode, onChangeHtml,
}: {
  blockId: string
  html: string
  isFocused: boolean
  editorRefs: React.MutableRefObject<Map<string, HTMLDivElement>>
  onFocus: () => void
  onInput: () => void
  onRemove: () => void
  viewMode: 'rich' | 'source'
  onChangeHtml: (html: string) => void
}) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    // Only register the contenteditable element when in rich mode.
    // In source mode, we don't track this ref — formatting commands are disabled anyway.
    if (viewMode === 'rich' && ref.current) editorRefs.current.set(blockId, ref.current)
    return () => { editorRefs.current.delete(blockId) }
  }, [blockId, editorRefs, viewMode])

  useEffect(() => {
    if (viewMode === 'rich' && ref.current && ref.current.innerHTML !== html) {
      ref.current.innerHTML = html
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewMode])

  // Source mode: textarea showing raw HTML. Useful for migration (paste HTML from other systems).
  if (viewMode === 'source') {
    return (
      <div className={`group relative rounded-md border-2 border-dashed bg-gray-50 transition-colors ${isFocused ? 'border-primary' : 'border-gray-300 hover:border-gray-400'}`}>
        <div className="px-3 pt-1.5 pb-0.5 flex items-center justify-between">
          <span className="text-[10px] uppercase tracking-wider font-semibold text-gray-500">HTML source</span>
          <span className="text-[9px] text-gray-400 italic">Paste raw HTML here</span>
        </div>
        <textarea
          value={html}
          onFocus={onFocus}
          onChange={(e) => onChangeHtml(e.target.value)}
          spellCheck={false}
          className="w-full px-3 py-2 text-xs text-gray-900 outline-none bg-transparent leading-relaxed font-mono resize-y"
          style={{ wordBreak: 'break-word', minHeight: '5rem' }}
          placeholder="<p>Paste or type HTML here…</p>"
        />
        <button onClick={onRemove}
          className={`absolute right-1 top-1 p-1 text-gray-400 hover:text-red-500 rounded ${isFocused ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'} transition-opacity bg-white/90`}
          title="Remove block">
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    )
  }

  // Rich mode: contenteditable WYSIWYG.
  return (
    <div className={`group relative rounded-md border bg-white transition-colors ${isFocused ? 'border-primary ring-2 ring-primary/20' : 'border-gray-200 hover:border-gray-300'}`}>
      <div
        ref={ref}
        contentEditable suppressContentEditableWarning
        onFocus={onFocus} onInput={onInput}
        className="px-3 py-2.5 text-sm text-gray-900 outline-none min-h-[3rem] leading-relaxed"
        style={{ wordBreak: 'break-word' }}
        data-placeholder="Type your content here…"
      />
      <button onClick={onRemove}
        className={`absolute right-1 top-1 p-1 text-gray-400 hover:text-red-500 rounded ${isFocused ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'} transition-opacity bg-white/90`}
        title="Remove block">
        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  )
}

// ─── Partial block (read-only card) ──────────────────────────────────────────

function PartialBlockView({
  partialId, required, expanded, onToggleExpand, onRemove,
}: {
  partialId: string
  required: boolean
  expanded: boolean
  onToggleExpand: () => void
  onRemove?: () => void
}) {
  const partial = PARTIALS.find((p) => p.id === partialId)
  if (!partial) {
    return (
      <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
        Unknown partial: {partialId}
      </div>
    )
  }
  return (
    <div className="rounded-md border border-gray-300 bg-gray-50 overflow-hidden">
      <div className="flex items-center gap-2 px-3 py-2">
        <button onClick={onToggleExpand} className="text-gray-400 hover:text-gray-600 shrink-0" title="Preview content">
          <svg className={`w-3 h-3 transition-transform ${expanded ? 'rotate-90' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
          </svg>
        </button>
        <span className="text-xs text-gray-500 shrink-0">📄</span>
        <span className="text-sm text-gray-800 font-medium flex-1 truncate">{partial.name}</span>
        {required && (
          <span className="text-[9px] uppercase tracking-wider font-semibold text-gray-500 bg-gray-200 px-1.5 py-0.5 rounded">Required</span>
        )}
        {onRemove && (
          <button onClick={onRemove} className="p-1 text-gray-400 hover:text-red-500" title="Remove">
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>
      {expanded && (
        <div className="border-t border-gray-200 bg-white px-3 py-2 max-h-32 overflow-y-auto">
          <div className="text-[11px] text-gray-700 leading-relaxed" dangerouslySetInnerHTML={{ __html: partial.body || '<em class="text-gray-400">Empty partial.</em>' }} />
        </div>
      )}
    </div>
  )
}

// ─── Readiness row — collapsible status at the bottom ────────────────────────

function ReadinessRow({
  allReady, failedCount, checks, expanded, onToggle,
}: {
  allReady: boolean
  failedCount: number
  checks: { label: string; actionLabel: string; passed: boolean }[]
  expanded: boolean
  onToggle: () => void
}) {
  return (
    <div className={`mt-3 rounded-lg border ${allReady ? 'border-green-200 bg-green-50' : 'border-amber-200 bg-amber-50'}`}>
      <button onClick={onToggle} className="w-full px-4 py-2.5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          {allReady ? (
            <>
              <svg className="w-4 h-4 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
              </svg>
              <span className="text-xs font-semibold text-green-800 uppercase tracking-wider">Ready to activate</span>
            </>
          ) : (
            <>
              <svg className="w-4 h-4 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
              </svg>
              <span className="text-xs font-semibold text-amber-800 uppercase tracking-wider">
                {failedCount} {failedCount === 1 ? 'item' : 'items'} to fix before activation
              </span>
            </>
          )}
        </div>
        <svg className={`w-4 h-4 text-gray-500 transition-transform ${expanded ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
        </svg>
      </button>
      {expanded && (
        <div className={`px-4 pb-3 ${allReady ? 'border-t border-green-200' : 'border-t border-amber-200'}`}>
          <div className="space-y-1 pt-2">
            {checks.map((check, i) => (
              <div key={i} className="flex items-center gap-1.5 text-xs">
                {check.passed ? (
                  <svg className="w-3 h-3 text-green-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                  </svg>
                ) : (
                  <svg className="w-3 h-3 text-amber-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                )}
                <span className={check.passed ? 'text-green-700' : 'text-amber-800'}>
                  {check.passed ? check.label : check.actionLabel}
                </span>
              </div>
            ))}
          </div>
          {!allReady && (
            <p className="text-[10px] text-amber-600 mt-2">Saves as Inactive. Fix the above to activate on the detail page.</p>
          )}
        </div>
      )}
    </div>
  )
}

// (VariablesPopover removed — Variables moved out of the action bar into a dedicated
//  VariablesSection below the editor content. See VariablesSection below.)

// ─── Preview sidebar — side-by-side rendered email with sample data accordion ──
// Open by default; collapse for focus mode; fullscreen button opens the existing PreviewModal.

function PreviewSidebar({
  html, variables, sampleValues, defaultValues, onChangeSample,
  onCollapse, onFullscreen,
}: {
  html: string
  variables: Variable[]
  sampleValues: Record<string, string>
  defaultValues: Record<string, string>
  onChangeSample: (name: string, value: string) => void
  onCollapse: () => void
  onFullscreen: () => void
}) {
  // Sample data accordion: default-open when there are variables AND no sample values yet
  // (nudges the user to fill one). Otherwise collapsed.
  const someSampleSet = variables.some((v) => (sampleValues[v.name] ?? '').trim() !== '')
  const [sampleOpen, setSampleOpen] = useState(variables.length > 0 && !someSampleSet)

  // Debounce the iframe srcDoc to ~250ms so we don't thrash on every keystroke.
  const [debouncedHtml, setDebouncedHtml] = useState(html)
  useEffect(() => {
    const t = setTimeout(() => setDebouncedHtml(html), 250)
    return () => clearTimeout(t)
  }, [html])

  return (
    <aside className="w-[420px] shrink-0 sticky top-0 self-start max-h-[calc(100vh-1rem)] flex flex-col bg-white border border-gray-200 rounded-md overflow-hidden">
      {/* Sidebar header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-gray-200 shrink-0 bg-gray-50">
        <div className="flex items-center gap-2">
          <EyeIcon />
          <h3 className="text-xs font-semibold text-gray-700 uppercase tracking-wider">Preview</h3>
        </div>
        <div className="flex items-center gap-0.5">
          <button onClick={onFullscreen} title="Open in fullscreen"
            className="p-1.5 text-gray-500 hover:text-gray-900 hover:bg-gray-200 rounded">
            <ExpandIcon />
          </button>
          <button onClick={onCollapse} title="Hide preview"
            className="p-1.5 text-gray-500 hover:text-gray-900 hover:bg-gray-200 rounded">
            <ChevronRightIcon />
          </button>
        </div>
      </div>

      {/* Sample data accordion — only when the template has variables */}
      {variables.length > 0 && (
        <div className="border-b border-gray-200 shrink-0">
          <button onClick={() => setSampleOpen((v) => !v)}
            className="w-full px-3 py-1.5 flex items-center justify-between hover:bg-gray-50">
            <span className="text-[10px] uppercase tracking-wider font-semibold text-gray-600 flex items-center gap-1.5">
              <svg className={`w-3 h-3 text-gray-400 transition-transform ${sampleOpen ? 'rotate-90' : ''}`}
                fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
              </svg>
              Sample data
              <span className="text-[9px] text-gray-400 normal-case tracking-normal font-normal">
                ({variables.length} {variables.length === 1 ? 'var' : 'vars'})
              </span>
            </span>
            <span className="text-[9px] text-gray-400">Empty → defaults</span>
          </button>
          {sampleOpen && (
            <div className="px-3 pb-2 max-h-[30vh] overflow-y-auto">
              <div className="grid grid-cols-[auto_1fr] gap-x-2 gap-y-1 items-center">
                {variables.map((v) => (
                  <div key={v.name} className="contents">
                    <code className="text-[10px] font-mono text-amber-700 truncate">{`{{${v.name}}}`}</code>
                    <input type="text" value={sampleValues[v.name] ?? ''}
                      onChange={(e) => onChangeSample(v.name, e.target.value)}
                      placeholder={defaultValues[v.name] ? `Default: ${defaultValues[v.name]}` : 'e.g. Jane'}
                      className="h-6 px-1.5 text-[11px] border border-gray-200 rounded bg-white focus:outline-none focus:border-primary" />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Rendered preview iframe */}
      <div className="flex-1 overflow-y-auto bg-gray-50">
        <iframe sandbox="allow-same-origin" srcDoc={debouncedHtml}
          className="w-full border-0 bg-white" style={{ minHeight: '480px', height: '100%' }}
          title="Email preview" />
      </div>
    </aside>
  )
}

// ─── Collapsed preview rail — thin strip with re-expand button ──────────────

function PreviewRail({ onExpand }: { onExpand: () => void }) {
  return (
    <aside className="w-9 shrink-0 sticky top-0 self-start">
      <button onClick={onExpand} title="Show preview"
        className="w-full flex flex-col items-center gap-2 py-3 bg-white border border-gray-200 rounded-md text-gray-500 hover:text-gray-900 hover:bg-gray-50">
        <ChevronLeftIcon />
        <span className="text-[10px] font-semibold tracking-wider text-gray-500" style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}>
          PREVIEW
        </span>
      </button>
    </aside>
  )
}

// ─── Variables section — collapsible list of all variables in the template ──
// Sits below the editor sections (Header/Body/Footer), above the readiness row.
// Replaces the Variables popover that used to live in the action bar.

function VariablesSection({
  varRefs, varSource, defaultValues, onChangeDefault, expanded, onToggle,
}: {
  varRefs: string[]
  varSource: Record<string, string[]>
  defaultValues: Record<string, string>
  onChangeDefault: (name: string, value: string) => void
  expanded: boolean
  onToggle: () => void
}) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white">
      <button onClick={onToggle}
        className="w-full px-3 py-2 flex items-center justify-between hover:bg-gray-50 rounded-lg">
        <div className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
          <span className="text-[10px] uppercase tracking-wider font-semibold text-gray-500">
            Variables
          </span>
          <span className="text-[10px] text-gray-400">· {varRefs.length} in this template</span>
        </div>
        <svg className={`w-3.5 h-3.5 text-gray-400 transition-transform ${expanded ? 'rotate-180' : ''}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
        </svg>
      </button>

      {expanded && (
        <div className="px-3 pb-3 border-t border-gray-100">
          {varRefs.length === 0 ? (
            <p className="text-xs text-gray-500 pt-2">
              No variables yet. Type <code className="text-amber-700">{`{{varName}}`}</code> in the subject, preview text, or any content block — or use the <strong>{`{{x}}`}</strong> picker.
            </p>
          ) : (
            <>
              <p className="text-[10px] text-gray-500 pt-2 pb-2">
                Set a default for each variable. Used at send time when the pipeline doesn't supply a value.
              </p>
              <div className="space-y-1.5">
                {varRefs.map((name) => {
                  const sources = varSource[name] || []
                  return (
                    <div key={name} className="grid grid-cols-[1fr_1.2fr] gap-2 items-start">
                      <div className="min-w-0">
                        <code className="block text-xs font-mono text-gray-900 bg-amber-50 border border-amber-700 rounded-md px-2 py-0.5 truncate">{`{{ ${name} }}`}</code>
                        {sources.length > 0 && (
                          <div className="mt-0.5 text-[10px] text-gray-500 leading-tight truncate">
                            from {sources.join(', ')}
                          </div>
                        )}
                      </div>
                      <input type="text" value={defaultValues[name] ?? ''}
                        onChange={(e) => onChangeDefault(name, e.target.value)}
                        placeholder="Default value (optional)"
                        className="h-7 px-2 text-xs border border-gray-200 rounded bg-white focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20" />
                    </div>
                  )
                })}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Preview modal — renders assembled email + collapsible Sample data panel ─

function PreviewModal({
  html, onClose, variables, sampleValues, defaultValues, onChangeSample,
}: {
  html: string
  onClose: () => void
  variables: Variable[]
  sampleValues: Record<string, string>
  defaultValues: Record<string, string>
  onChangeSample: (name: string, value: string) => void
}) {
  // Default-open if there are variables AND no sample values have been entered yet, so the
  // user is nudged to fill at least one. Otherwise start collapsed to keep the preview front-and-center.
  const someSampleSet = variables.some((v) => (sampleValues[v.name] ?? '').trim() !== '')
  const [expanded, setExpanded] = useState(variables.length > 0 && !someSampleSet)

  return (
    <div className="fixed inset-0 z-50 bg-gray-900/40 flex items-center justify-center px-4" onClick={onClose}>
      <div className="w-full max-w-2xl bg-white rounded-lg shadow-xl border border-gray-200 flex flex-col" style={{ maxHeight: '85vh' }} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-200 shrink-0">
          <div className="flex items-center gap-2"><EyeIcon /><h3 className="text-sm font-semibold text-gray-900">Email preview</h3></div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1" aria-label="Close preview">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Sample data panel — collapsible. Only shown when the template has variables. */}
        {variables.length > 0 && (
          <div className="border-b border-gray-200 shrink-0">
            <button onClick={() => setExpanded((v) => !v)}
              className="w-full px-5 py-2 flex items-center justify-between hover:bg-gray-50">
              <span className="text-xs uppercase tracking-wider font-semibold text-gray-600 flex items-center gap-2">
                <svg className={`w-3 h-3 text-gray-400 transition-transform ${expanded ? 'rotate-90' : ''}`}
                  fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                </svg>
                Sample data for preview
                <span className="text-[10px] text-gray-400 normal-case tracking-normal font-normal">
                  ({variables.length} {variables.length === 1 ? 'variable' : 'variables'})
                </span>
              </span>
              <span className="text-[10px] text-gray-400">Empty fields fall back to defaults</span>
            </button>
            {expanded && (
              <div className="px-5 pb-3 max-h-[30vh] overflow-y-auto">
                <div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 items-center">
                  {variables.map((v) => (
                    <div key={v.name} className="contents">
                      <code className="text-xs font-mono text-amber-700 truncate">{`{{${v.name}}}`}</code>
                      <input type="text" value={sampleValues[v.name] ?? ''}
                        onChange={(e) => onChangeSample(v.name, e.target.value)}
                        placeholder={defaultValues[v.name] ? `Default: ${defaultValues[v.name]}` : 'e.g. Jane Doe'}
                        className="h-7 px-2 text-xs border border-gray-200 rounded bg-white focus:outline-none focus:border-primary" />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        <div className="flex-1 overflow-y-auto">
          <iframe sandbox="allow-same-origin" srcDoc={html} className="w-full border-0" style={{ minHeight: '500px' }} title="Email preview" />
        </div>
      </div>
    </div>
  )
}

// ─── Misc ────────────────────────────────────────────────────────────────────

function MetaField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[10px] uppercase tracking-wider font-semibold text-gray-500">{label}</span>
      {children}
    </div>
  )
}

// Editor "Details" accordion — collapsible card wrapping the Team / Type / Project
// fields per designer feedback item 14. Open by default so users immediately see
// the fields they likely need to set.
function EditorDetailsAccordion({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(true)
  return (
    <div className="mt-3 pb-4 border-b border-gray-200">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between gap-2 py-2 text-left"
        aria-expanded={open}
      >
        <h2 className="text-sm font-semibold text-gray-900 inline-flex items-center gap-2">
          <svg
            className={`w-3.5 h-3.5 text-gray-400 shrink-0 transition-transform ${open ? 'rotate-90' : ''}`}
            fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
          Details
        </h2>
      </button>
      {open && (
        <div className="flex items-start gap-6 mt-2 flex-wrap">
          {children}
        </div>
      )}
    </div>
  )
}

function WarningIcon() {
  return (
    <svg className="w-4 h-4 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
    </svg>
  )
}

function EyeIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  )
}

function InfoIcon() {
  return (
    <svg className="w-3.5 h-3.5 mt-0.5 shrink-0 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
    </svg>
  )
}

function PlusIcon() {
  return (
    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
    </svg>
  )
}

function GripIcon() {
  return (
    <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 16 16">
      <circle cx="5" cy="3" r="1.2" />
      <circle cx="11" cy="3" r="1.2" />
      <circle cx="5" cy="8" r="1.2" />
      <circle cx="11" cy="8" r="1.2" />
      <circle cx="5" cy="13" r="1.2" />
      <circle cx="11" cy="13" r="1.2" />
    </svg>
  )
}

function LinkIcon() {
  return (
    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244" />
    </svg>
  )
}

function ImageIcon() {
  return (
    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
    </svg>
  )
}

function ButtonIcon() {
  return (
    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.042 21.672L13.684 16.6m0 0l-2.51 2.225.569-9.47 5.227 7.917-3.286-.672zM12 2.25V4.5m5.834.166l-1.591 1.591M20.25 10.5H18M7.757 14.743l-1.59 1.59M6 10.5H3.75m4.007-4.243l-1.59-1.59" />
    </svg>
  )
}

function TagIcon() {
  return (
    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.568 3H5.25A2.25 2.25 0 003 5.25v4.318c0 .597.237 1.17.659 1.591l9.581 9.581c.699.699 1.78.872 2.607.33a18.095 18.095 0 005.223-5.223c.542-.827.369-1.908-.33-2.607L11.16 3.66A2.25 2.25 0 009.568 3z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 6h.008v.008H6V6z" />
    </svg>
  )
}

// ─── Toolbar icons ─────────────────────────────────────────────────────────

function UndoIcon() {
  return (
    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 15L3 9m0 0l6-6M3 9h12a6 6 0 010 12h-3" />
    </svg>
  )
}

function RedoIcon() {
  return (
    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 15l6-6m0 0l-6-6m6 6H9a6 6 0 000 12h3" />
    </svg>
  )
}

function SourceIcon() {
  return (
    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M17.25 6.75L22.5 12l-5.25 5.25M6.75 17.25L1.5 12l5.25-5.25M14.25 4.75l-4.5 14.5" />
    </svg>
  )
}

// ─── Toolbar icons added to match designer's `texteditor.jpg` reference ───
function StrikethroughIcon() {
  return (
    <span className="text-sm font-semibold line-through select-none leading-none">S</span>
  )
}
function TextColorIcon({ color = '#dc2626' }: { color?: string }) {
  return (
    <span className="inline-flex flex-col items-center leading-none">
      <span className="text-sm font-semibold select-none">A</span>
      <span className="w-3 h-1 rounded-sm" style={{ background: color }} />
    </span>
  )
}
function HighlightIcon({ color = '#fde68a' }: { color?: string }) {
  return (
    <span className="inline-flex flex-col items-center leading-none">
      <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
        <path d="M19 11l-8-8-9 9 7 7 9-9-1.4-1.4" />
        <path d="M5 13l4 4" />
        <path d="M19 14s1 1.5 1 3a1.5 1.5 0 11-3 0c0-1.5 1-3 1-3z" />
      </svg>
      <span className="w-3 h-1 rounded-sm" style={{ background: color }} />
    </span>
  )
}
function IndentRightIcon() {
  return (
    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <line x1="3" y1="6" x2="21" y2="6" />
      <line x1="3" y1="18" x2="21" y2="18" />
      <line x1="11" y1="12" x2="21" y2="12" />
      <polyline points="3,9 6,12 3,15" />
    </svg>
  )
}
function IndentLeftIcon() {
  return (
    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <line x1="3" y1="6" x2="21" y2="6" />
      <line x1="3" y1="18" x2="21" y2="18" />
      <line x1="11" y1="12" x2="21" y2="12" />
      <polyline points="7,9 4,12 7,15" />
    </svg>
  )
}
const TEXT_COLOR_PALETTE = [
  '#111827', '#6B7280', '#DC2626', '#EA580C',
  '#D97706', '#16A34A', '#2563EB', '#9333EA',
]
const HIGHLIGHT_PALETTE = [
  'transparent', '#FEF3C7', '#D1FAE5', '#DBEAFE', '#FCE7F3', '#F3F4F6',
]

function ColorDropdown({
  label, icon, palette, onPick, disabled, saveSelection, restoreSelection,
}: {
  label: string
  icon: React.ReactNode
  palette: string[]
  onPick: (color: string) => void
  disabled?: boolean
  saveSelection: () => void
  restoreSelection: () => void
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])
  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        title={label}
        onMouseDown={(e) => { e.preventDefault(); saveSelection() }}
        onClick={() => !disabled && setOpen(!open)}
        disabled={disabled}
        className="h-7 px-1.5 inline-flex items-center justify-center rounded text-gray-700 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed"
      >
        {icon}
      </button>
      {open && (
        <div className="absolute left-0 top-full mt-1 bg-white border border-gray-200 rounded shadow-lg p-2 z-50 grid grid-cols-4 gap-1 w-32">
          {palette.map((color) => (
            <button
              key={color}
              type="button"
              title={color === 'transparent' ? 'No highlight' : color}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => { restoreSelection(); onPick(color); setOpen(false) }}
              className="w-6 h-6 rounded border border-gray-300 hover:scale-110 transition-transform relative overflow-hidden"
              style={{ background: color === 'transparent' ? 'white' : color }}
            >
              {color === 'transparent' && (
                <span className="absolute inset-0 flex items-center justify-center">
                  <svg className="w-full h-full text-red-400" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} fill="none">
                    <line x1="4" y1="20" x2="20" y2="4" />
                  </svg>
                </span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function BulletListIcon() {
  return (
    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <circle cx="5" cy="6" r="1.2" fill="currentColor" />
      <circle cx="5" cy="12" r="1.2" fill="currentColor" />
      <circle cx="5" cy="18" r="1.2" fill="currentColor" />
      <path strokeLinecap="round" d="M9 6h11M9 12h11M9 18h11" />
    </svg>
  )
}

function NumberedListIcon() {
  return (
    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" d="M9 6h11M9 12h11M9 18h11" />
      <text x="2" y="8" fontSize="6" fontWeight="700" fill="currentColor" stroke="none">1</text>
      <text x="2" y="14" fontSize="6" fontWeight="700" fill="currentColor" stroke="none">2</text>
      <text x="2" y="20" fontSize="6" fontWeight="700" fill="currentColor" stroke="none">3</text>
    </svg>
  )
}

function ExpandIcon() {
  return (
    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M20.25 3.75h-4.5m4.5 0v4.5m0-4.5L15 9M3.75 20.25v-4.5m0 4.5h4.5m-4.5 0L9 15M20.25 20.25h-4.5m4.5 0v-4.5m0 4.5L15 15" />
    </svg>
  )
}

function ChevronLeftIcon() {
  return (
    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
    </svg>
  )
}

function ChevronRightIcon() {
  return (
    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
    </svg>
  )
}

// ─── Sticky toolbar ──────────────────────────────────────────────────────────

function EditorToolbar({
  focused, exec, openPopover, varRefs, onInsertVariable, active, saveSelection, restoreSelection,
  sourceMode, onToggleSource,
}: {
  focused: boolean
  exec: (cmd: string, value?: string) => void
  openPopover: (kind: PopoverKind) => void
  varRefs: string[]
  onInsertVariable: (v: string) => void
  active: { bold: boolean; italic: boolean; underline: boolean; block: string }
  saveSelection: () => void
  restoreSelection: () => void
  /** Whether the focused content block is currently in HTML source mode */
  sourceMode: boolean
  /** Toggle source/rich view on the focused content block */
  onToggleSource: () => void
}) {
  // In source mode, formatting commands don't apply to a contenteditable surface — disable them
  // and keep only Undo/Redo + Source + Variable active (Variable insertion into the textarea).
  const formattingDisabled = !focused || sourceMode
  return (
    <div className="sticky top-0 z-10 mt-3 bg-white border border-gray-200 rounded-md px-2 py-1.5 flex items-center gap-1 flex-wrap">
      <ToolbarGroup>
        <TBtn label="Undo (Ctrl+Z)" onClick={() => exec('undo')} disabled={!focused}><UndoIcon /></TBtn>
        <TBtn label="Redo (Ctrl+Y)" onClick={() => exec('redo')} disabled={!focused}><RedoIcon /></TBtn>
        <TBtn label={sourceMode ? 'Show rich text view' : 'Show HTML source'} onClick={onToggleSource} disabled={!focused} active={sourceMode}>
          <SourceIcon />
        </TBtn>
      </ToolbarGroup>
      <Divider />
      {/* Heading dropdown (T▾) — per designer's `texteditor.jpg` */}
      <ToolbarGroup>
        <HeadingDropdown exec={exec} disabled={formattingDisabled} activeBlock={active.block} saveSelection={saveSelection} restoreSelection={restoreSelection} />
      </ToolbarGroup>
      <Divider />
      {/* B / I / U / S */}
      <ToolbarGroup>
        <TBtn label="Bold (Ctrl+B)" onClick={() => exec('bold')} disabled={formattingDisabled} bold active={active.bold}>B</TBtn>
        <TBtn label="Italic (Ctrl+I)" onClick={() => exec('italic')} disabled={formattingDisabled} italic active={active.italic}>I</TBtn>
        <TBtn label="Underline (Ctrl+U)" onClick={() => exec('underline')} disabled={formattingDisabled} underline active={active.underline}>U</TBtn>
        <TBtn label="Strikethrough" onClick={() => exec('strikethrough')} disabled={formattingDisabled}>
          <StrikethroughIcon />
        </TBtn>
      </ToolbarGroup>
      <Divider />
      {/* Text color / Highlight */}
      <ToolbarGroup>
        <ColorDropdown
          label="Text color"
          icon={<TextColorIcon />}
          palette={TEXT_COLOR_PALETTE}
          onPick={(c) => exec('foreColor', c)}
          disabled={formattingDisabled}
          saveSelection={saveSelection}
          restoreSelection={restoreSelection}
        />
        <ColorDropdown
          label="Highlight"
          icon={<HighlightIcon />}
          palette={HIGHLIGHT_PALETTE}
          onPick={(c) => exec('hiliteColor', c)}
          disabled={formattingDisabled}
          saveSelection={saveSelection}
          restoreSelection={restoreSelection}
        />
      </ToolbarGroup>
      <Divider />
      {/* Alignment */}
      <ToolbarGroup>
        <AlignDropdown exec={exec} disabled={formattingDisabled} saveSelection={saveSelection} restoreSelection={restoreSelection} />
      </ToolbarGroup>
      <Divider />
      {/* Lists + indent */}
      <ToolbarGroup>
        <TBtn label="Bullet list" onClick={() => exec('insertUnorderedList')} disabled={formattingDisabled}><BulletListIcon /></TBtn>
        <TBtn label="Numbered list" onClick={() => exec('insertOrderedList')} disabled={formattingDisabled}><NumberedListIcon /></TBtn>
        <TBtn label="Indent" onClick={() => exec('indent')} disabled={formattingDisabled}><IndentRightIcon /></TBtn>
        <TBtn label="Outdent" onClick={() => exec('outdent')} disabled={formattingDisabled}><IndentLeftIcon /></TBtn>
      </ToolbarGroup>
      <Divider />
      <ToolbarGroup>
        <TBtn label="Insert link" onClick={() => openPopover('link')} disabled={formattingDisabled}>
          <span className="inline-flex items-center gap-1"><LinkIcon /><span className="text-xs">Link</span></span>
        </TBtn>
        <TBtn label="Insert image" onClick={() => openPopover('image')} disabled={formattingDisabled}>
          <span className="inline-flex items-center gap-1"><ImageIcon /><span className="text-xs">Image</span></span>
        </TBtn>
        <TBtn label="Insert CTA button" onClick={() => openPopover('cta')} disabled={formattingDisabled}>
          <span className="inline-flex items-center gap-1"><ButtonIcon /><span className="text-xs">Button</span></span>
        </TBtn>
        <VariableDropdown vars={varRefs} onInsert={onInsertVariable} onCustom={() => openPopover('variable')} disabled={!focused} />
      </ToolbarGroup>
      {!focused && (
        <span className="ml-auto text-[10px] text-gray-400 italic">Click into a content block to edit</span>
      )}
    </div>
  )
}

function ToolbarGroup({ children }: { children: React.ReactNode }) {
  return <div className="flex items-center gap-0.5">{children}</div>
}

function Divider() {
  return <div className="h-5 w-px bg-gray-200 mx-1" />
}

function TBtn({ children, onClick, disabled, label, bold, italic, underline, active }: {
  children: React.ReactNode; onClick: () => void; disabled?: boolean; label: string
  bold?: boolean; italic?: boolean; underline?: boolean; active?: boolean
}) {
  return (
    <button type="button" title={label} onMouseDown={(e) => e.preventDefault()} onClick={onClick} disabled={disabled}
      className={`h-7 min-w-7 px-1.5 inline-flex items-center justify-center rounded text-sm text-gray-700 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed ${active ? 'bg-gray-200 text-gray-900' : ''} ${bold ? 'font-bold' : ''} ${italic ? 'italic' : ''} ${underline ? 'underline' : ''}`}>
      {children}
    </button>
  )
}

function HeadingDropdown({ exec, disabled, activeBlock, saveSelection, restoreSelection }: {
  exec: (cmd: string, val?: string) => void; disabled?: boolean; activeBlock: string; saveSelection: () => void; restoreSelection: () => void
}) {
  const currentLabel = activeBlock === 'h1' ? 'Heading 1' : activeBlock === 'h2' ? 'Heading 2' : activeBlock === 'h3' ? 'Heading 3' : 'Paragraph'
  return (
    <select disabled={disabled}
      onMouseDown={(e) => { e.stopPropagation(); saveSelection() }} onFocus={saveSelection}
      onChange={(e) => { const v = e.target.value; if (v) { restoreSelection(); exec('formatBlock', `<${v}>`) }; e.target.value = '' }}
      className="h-7 text-xs text-gray-700 bg-transparent border-0 px-1 rounded hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer focus:outline-none"
      title={`Block format — current: ${currentLabel}`} value="">
      <option value="" disabled>{currentLabel} ▾</option>
      <option value="p">Paragraph</option>
      <option value="h1">Heading 1</option>
      <option value="h2">Heading 2</option>
      <option value="h3">Heading 3</option>
    </select>
  )
}

function AlignDropdown({ exec, disabled, saveSelection, restoreSelection }: {
  exec: (cmd: string, val?: string) => void; disabled?: boolean; saveSelection: () => void; restoreSelection: () => void
}) {
  return (
    <select disabled={disabled}
      onMouseDown={(e) => { e.stopPropagation(); saveSelection() }} onFocus={saveSelection}
      onChange={(e) => { const v = e.target.value; if (v) restoreSelection(); if (v === 'left') exec('justifyLeft'); else if (v === 'center') exec('justifyCenter'); else if (v === 'right') exec('justifyRight'); e.target.value = '' }}
      className="h-7 text-xs text-gray-700 bg-transparent border-0 px-1 rounded hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer focus:outline-none"
      title="Alignment" value="">
      <option value="" disabled>Align ▾</option>
      <option value="left">Left</option>
      <option value="center">Center</option>
      <option value="right">Right</option>
    </select>
  )
}

function VariableDropdown({ vars, onInsert, onCustom, disabled }: {
  vars: string[]; onInsert: (v: string) => void; onCustom: () => void; disabled?: boolean
}) {
  const [open, setOpen] = useState(false)
  return (
    <div className="relative">
      <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => setOpen(!open)} disabled={disabled}
        title="Insert a placeholder that fills with real data when the email is sent"
        className="h-7 px-2 inline-flex items-center gap-1 rounded text-xs text-amber-800 bg-amber-50 border border-amber-200 hover:bg-amber-100 disabled:opacity-30 disabled:cursor-not-allowed font-medium">
        <TagIcon /> Variable <span className="text-gray-500">▾</span>
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-1 w-48 bg-white border border-gray-200 rounded-lg shadow-lg py-1 z-50">
            <div className="px-3 py-1.5 text-[10px] uppercase tracking-wider font-semibold text-gray-500 border-b border-gray-100">
              {vars.length > 0 ? 'In this template' : 'No variables yet'}
            </div>
            {vars.map((v) => (
              <button key={v} onClick={() => { setOpen(false); onInsert(v) }}
                className="block w-full text-left px-3 py-1.5 text-xs font-mono text-amber-800 hover:bg-amber-50">{`{{${v}}}`}</button>
            ))}
            <button onClick={() => { setOpen(false); onCustom() }}
              className="block w-full text-left px-3 py-1.5 text-xs text-primary hover:bg-gray-50 border-t border-gray-100 font-medium">
              + New variable…
            </button>
          </div>
        </>
      )}
    </div>
  )
}

// ─── Inline variable picker (for plain-text fields: subject + preview text) ──
// A small {{x}} pill that opens a compact dropdown. Existing vars are listed
// as one-click insertions; a text input lets the user define a brand-new name.

function InlineVarPicker({ varRefs, onPick }: { varRefs: string[]; onPick: (name: string) => void }) {
  const [open, setOpen] = useState(false)
  const [custom, setCustom] = useState('')

  const handlePick = (name: string) => {
    onPick(name)
    setOpen(false)
    setCustom('')
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`inline-flex items-center gap-0.5 text-[10px] font-mono px-1.5 py-0.5 rounded border transition-colors ${
          open
            ? 'bg-amber-100 border-amber-300 text-amber-800'
            : 'bg-amber-50 border-amber-200 text-amber-700 hover:bg-amber-100'
        }`}
        title="Insert variable into this field"
      >
        {'{{x}}'}
      </button>

      {open && (
        <>
          {/* Backdrop */}
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-1 w-56 bg-white border border-gray-200 rounded-lg shadow-xl z-50 overflow-hidden">
            {varRefs.length > 0 ? (
              <div>
                <p className="px-3 pt-2.5 pb-1 text-[10px] text-gray-400 uppercase tracking-wider font-semibold">Existing variables</p>
                <div className="max-h-36 overflow-y-auto">
                  {varRefs.map((name) => (
                    <button key={name} type="button"
                      className="w-full text-left px-3 py-1.5 text-xs font-mono text-amber-800 hover:bg-amber-50 transition-colors"
                      onClick={() => handlePick(name)}>
                      {`{{${name}}}`}
                    </button>
                  ))}
                </div>
                <div className="border-t border-gray-100 mx-3 my-1" />
              </div>
            ) : (
              <p className="px-3 pt-2.5 pb-1 text-[10px] text-gray-400">No variables yet. Define one below.</p>
            )}
            <div className="px-3 pb-3">
              <p className="text-[10px] text-gray-500 mb-1.5">New variable name:</p>
              <div className="flex gap-1.5">
                <input
                  type="text"
                  value={custom}
                  onChange={(e) => setCustom(e.target.value.replace(/[\s{}]/g, '_'))}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && custom.trim()) handlePick(custom.trim())
                    if (e.key === 'Escape') setOpen(false)
                  }}
                  placeholder="e.g. user.name"
                  className="flex-1 h-6 px-2 text-xs border border-gray-300 rounded focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/30"
                  autoFocus
                />
                <button
                  type="button"
                  disabled={!custom.trim()}
                  onClick={() => handlePick(custom.trim())}
                  className="px-2 h-6 text-xs bg-primary text-white rounded hover:bg-primary-hover disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Insert
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

// ─── Insert popovers ──────────────────────────────────────────────────────────

function InsertPopover({ title, fields, onSubmit, onCancel }: {
  title: string; fields: { key: string; label: string; placeholder?: string }[]
  onSubmit: (values: Record<string, string>) => void; onCancel: () => void
}) {
  const [values, setValues] = useState<Record<string, string>>(Object.fromEntries(fields.map((f) => [f.key, ''])))
  const canSubmit = fields.every((f) => values[f.key]?.trim())
  return (
    <PopoverShell title={title} onCancel={onCancel} onSubmit={() => canSubmit && onSubmit(values)} canSubmit={canSubmit}>
      {fields.map((f) => (
        <div key={f.key}>
          <label className="block text-xs font-medium text-gray-700 mb-1">{f.label}</label>
          <input type="text" value={values[f.key] || ''} onChange={(e) => setValues({ ...values, [f.key]: e.target.value })}
            placeholder={f.placeholder}
            className="w-full h-9 px-3 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
            autoFocus={f === fields[0]} />
        </div>
      ))}
    </PopoverShell>
  )
}

function CTAPopover({ onSubmit, onCancel }: {
  onSubmit: (v: { text: string; url: string; color: 'green' | 'purple' }) => void; onCancel: () => void
}) {
  const [text, setText] = useState('')
  const [url, setUrl] = useState('')
  const [color, setColor] = useState<'green' | 'purple'>('green')
  const canSubmit = !!text.trim() && !!url.trim()
  return (
    <PopoverShell title="Insert CTA button" onCancel={onCancel} onSubmit={() => canSubmit && onSubmit({ text, url, color })} canSubmit={canSubmit}>
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">Button text</label>
        <input type="text" value={text} onChange={(e) => setText(e.target.value)} placeholder="Confirm your email"
          className="w-full h-9 px-3 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary" autoFocus />
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">Link URL</label>
        <input type="text" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://… or {{varName}}"
          className="w-full h-9 px-3 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary" />
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1.5">Color</label>
        <div className="flex items-center gap-3">
          <label className="inline-flex items-center gap-1.5 cursor-pointer">
            <input type="radio" checked={color === 'green'} onChange={() => setColor('green')} className="accent-primary" />
            <span className="inline-flex items-center gap-1.5 text-sm"><span className="inline-block w-3 h-3 rounded-sm bg-primary" />Green</span>
          </label>
          <label className="inline-flex items-center gap-1.5 cursor-pointer">
            <input type="radio" checked={color === 'purple'} onChange={() => setColor('purple')} className="accent-primary-strong" />
            <span className="inline-flex items-center gap-1.5 text-sm"><span className="inline-block w-3 h-3 rounded-sm bg-primary-strong" />Purple</span>
          </label>
        </div>
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1.5">Preview</label>
        <div className="bg-gray-50 border border-gray-200 rounded-md px-4 py-4 flex items-center justify-center">
          <span className="inline-flex items-center px-8 py-3 rounded-md text-sm font-semibold text-white shadow-sm"
            style={{ background: color === 'purple' ? '#4B286D' : '#007F4A' }}>
            {text.trim() || 'Button text'}
          </span>
        </div>
      </div>
    </PopoverShell>
  )
}

function VariablePopover({ existing, onSubmit, onCancel }: {
  existing: string[]; onSubmit: (name: string) => void; onCancel: () => void
}) {
  const [varName, setVarName] = useState('')
  const trimmed = varName.trim()
  const valid = /^[a-zA-Z][a-zA-Z0-9_.]*$/.test(trimmed)
  const dup = existing.includes(trimmed)
  const canSubmit = valid && !dup
  return (
    <PopoverShell title="New variable" onCancel={onCancel} onSubmit={() => canSubmit && onSubmit(trimmed)} canSubmit={canSubmit}>
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">Variable name</label>
        <div className="flex items-center gap-1">
          <span className="text-sm font-mono text-amber-700">{`{{`}</span>
          <input type="text" value={varName} onChange={(e) => setVarName(e.target.value)} placeholder="userName"
            className="flex-1 h-9 px-2 text-sm font-mono border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary" autoFocus />
          <span className="text-sm font-mono text-amber-700">{`}}`}</span>
        </div>
        {trimmed && !valid && <p className="text-xs text-red-600 mt-1">Use letters, numbers, dots, and underscores. Must start with a letter.</p>}
        {dup && <p className="text-xs text-amber-700 mt-1">This variable is already in the template.</p>}
      </div>
    </PopoverShell>
  )
}

function PopoverShell({ title, onCancel, onSubmit, canSubmit, children }: {
  title: string; onCancel: () => void; onSubmit: () => void; canSubmit: boolean; children: React.ReactNode
}) {
  return (
    <div className="fixed inset-0 z-50 bg-gray-900/30 flex items-center justify-center px-4" onClick={onCancel}>
      <div className="w-full max-w-md bg-white rounded-lg shadow-xl border border-gray-200" onClick={(e) => e.stopPropagation()}>
        <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
          <button onClick={onCancel} className="text-gray-400 hover:text-gray-600" aria-label="Close">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="px-5 py-4 space-y-3">{children}</div>
        <div className="px-5 py-3 border-t border-gray-100 bg-gray-50 flex items-center justify-end gap-2 rounded-b-lg">
          <button onClick={onCancel} className="px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50">Cancel</button>
          <button onClick={onSubmit} disabled={!canSubmit}
            className="px-4 py-1.5 text-sm font-medium text-white bg-primary rounded-md hover:bg-primary-hover disabled:opacity-40 disabled:cursor-not-allowed">
            Insert
          </button>
        </div>
      </div>
    </div>
  )
}
