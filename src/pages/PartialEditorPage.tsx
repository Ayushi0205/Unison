import { useState, useMemo, useEffect, useRef } from 'react'
import { Link, useParams, useNavigate, useSearchParams, useLocation } from 'react-router-dom'
import { PARTIALS, savePartial } from '../data/partials'
import { useCurrentUser } from '../hooks/useCurrentUser'
import { TEMPLATES } from '../data/templates'
import { REQUIRED_PARTIAL_RULES } from '../data/required-partial-rules'
import { OWNING_TEAMS, PARTIAL_SECTIONS, PARTIAL_SECTION_DESCRIPTIONS } from '../data/taxonomy'
import type { OwningTeam, PartialSection } from '../data/taxonomy'
import { Breadcrumbs } from '../components/shared/Breadcrumbs'
import { OverflowMenu } from '../components/shared/OverflowMenu'
import { useToast } from '../components/shared/Toast'
import { FilterSelect } from '../components/shared/FilterSelect'
import { ConfirmModal } from '../components/shared/ConfirmModal'
import { neutralizeAttributeTokens } from '../utils/preview'

function extractVariableRefs(body: string): string[] {
  const matches = body.match(/\{\{\s*([^}]+?)\s*\}\}/g) || []
  return Array.from(new Set(matches.map((m) => m.replace(/\{\{|\}\}/g, '').trim())))
}

// Compile body for preview: substitute sample values, then amber-chip any remaining {{tokens}}
function compileBodyForPreview(body: string, sampleValues: Record<string, string>): string {
  let result = body
  // DF2-7: rehydrate CTA spans into real <a> tags for the preview render.
  // In the editor we use a plain <span> so the label is naturally editable;
  // here we restore the link semantics. We preserve the inline-block display
  // and add vertical margin for breathing room, but DO NOT inject any
  // text-align — the surrounding block's alignment (set by the editor's
  // Align toolbar) controls left/right/center placement of the button.
  result = result.replace(
    /<span\s+data-cta="1"\s+data-cta-url="([^"]*)"[^>]*style="([^"]*)"[^>]*>([\s\S]*?)<\/span>/g,
    (_m, url, style, inner) =>
      `<a href="${url}" style="${style};text-decoration:none;margin:8px 0">${inner}</a>`,
  )
  for (const [name, val] of Object.entries(sampleValues)) {
    if (val.trim()) {
      const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      // DF2-10: replace the WHOLE var-chip span (amber-styled wrapper) with the
      // raw value so filled variables aren't highlighted yellow in preview.
      result = result.replace(
        new RegExp(`<span[^>]*data-var="${escapedName}"[^>]*>[^<]*</span>`, 'g'),
        val,
      )
      // Also handle bare {{name}} text that wasn't wrapped in a chip.
      result = result.replace(new RegExp(`\\{\\{\\s*${escapedName}\\s*\\}\\}`, 'g'), val)
    }
  }
  result = neutralizeAttributeTokens(result)
  // Remaining unfilled {{tokens}} → amber chip matching the editor body chip styling
  result = result.replace(
    /\{\{\s*([^}]+?)\s*\}\}/g,
    (_m, name) =>
      `<span style="display:inline-block;padding:1px 8px;margin:0 1px;border-radius:6px;border:1px solid #a16207;background:#fffbeb;color:#111827;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:0.92em">{{ ${name.trim()} }}</span>`,
  )
  return result
}

// Variable token chip — rendered inline as a non-editable span in the contenteditable
// body. Designer reference shows `{{ name }}` with spaces inside braces, amber border,
// light/transparent background, monospace.
//
// The chip is wrapped with zero-width-space (​) sentinels on both sides so the
// caret has a guaranteed landing zone adjacent to a contenteditable="false" element.
// Without these, browsers (Chrome especially) fail to render a visible caret next to
// the chip — the user clicks beside it and sees nothing happen. Same pattern as the
// CTA button (see buildCTAHTML).
function buildVariableChip(name: string): string {
  const trimmed = name.trim()
  return (
    `​` +
    `<span class="var-chip" contenteditable="false" data-var="${trimmed}" ` +
    `style="display:inline-block;padding:1px 8px;margin:0 1px;border-radius:6px;` +
    `border:1px solid #a16207;background:#fffbeb;color:#111827;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:0.92em;line-height:1.4">` +
    `{{ ${trimmed} }}</span>` +
    `​`
  )
}

// CTA button HTML builder — opinionated styling, brand-conforming.
// DF2-7 fix: rendered as a single inline-block <span> (not <a>) so the cursor
// stays inside while editing. The URL is preserved on data-cta-url and
// rehydrated to <a> in compileBodyForPreview. Zero-width-space sentinels on
// each side give the caret a guaranteed landing spot outside the button.
function buildCTAHTML(text: string, url: string, color: 'green' | 'purple'): string {
  const palette = color === 'purple'
    ? { bg: '#4B286D', fg: '#FFFFFF' }
    : { bg: '#007F4A', fg: '#FFFFFF' }
  return (
    `​<span data-cta="1" data-cta-url="${url}" data-cta-color="${color}" ` +
    `style="display:inline-block;background:${palette.bg};color:${palette.fg};` +
    `padding:12px 32px;border-radius:6px;font-weight:600;text-decoration:none">` +
    `${text}</span>​ `
  )
}

type PopoverKind = 'link' | 'image' | 'cta' | 'variable' | null

// ─── Toolbar icons added to match designer's `texteditor.jpg` reference ───
function StrikethroughIcon() {
  return (
    <span className="text-sm font-semibold line-through select-none leading-none">S</span>
  )
}
function TextColorIcon({ color = '#dc2626' }: { color?: string }) {
  // A with a colored underline (matches designer's reference)
  return (
    <span className="inline-flex flex-col items-center leading-none">
      <span className="text-sm font-semibold select-none">A</span>
      <span className="w-3 h-1 rounded-sm" style={{ background: color }} />
    </span>
  )
}
function HighlightIcon({ color = '#fde68a' }: { color?: string }) {
  // Paint-bucket icon, matches designer's reference
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

function BulletListIcon() {
  return (
    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <line x1="9" y1="6" x2="20" y2="6" />
      <line x1="9" y1="12" x2="20" y2="12" />
      <line x1="9" y1="18" x2="20" y2="18" />
      <circle cx="4" cy="6" r="1.5" fill="currentColor" stroke="none" />
      <circle cx="4" cy="12" r="1.5" fill="currentColor" stroke="none" />
      <circle cx="4" cy="18" r="1.5" fill="currentColor" stroke="none" />
    </svg>
  )
}
function NumberedListIcon() {
  return (
    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <line x1="10" y1="6" x2="21" y2="6" />
      <line x1="10" y1="12" x2="21" y2="12" />
      <line x1="10" y1="18" x2="21" y2="18" />
      <text x="2" y="8" fontSize="7" fill="currentColor" stroke="none" fontFamily="monospace">1.</text>
      <text x="2" y="14" fontSize="7" fill="currentColor" stroke="none" fontFamily="monospace">2.</text>
      <text x="2" y="20" fontSize="7" fill="currentColor" stroke="none" fontFamily="monospace">3.</text>
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
  // DF2-9: bullseye-pointer (FontAwesome style) — bullseye in upper-left with
  // a mouse-cursor arrow whose hot-point sits at the bullseye center; the
  // cursor body sweeps down-right.
  return (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
      {/* Bullseye — outer ring + filled center dot */}
      <circle cx="9" cy="9" r="5.5" />
      <circle cx="9" cy="9" r="1.5" fill="currentColor" stroke="none" />
      {/* Mouse cursor — tip at bullseye center, body angles to lower-right.
          Classic notched cursor shape: tip → right-edge → notch → tail → close. */}
      <path
        d="M9 9 L20 13 L14.5 14.5 L17 20 L14.5 21 L12 15.5 Z"
        fill="currentColor"
        stroke="currentColor"
        strokeLinejoin="round"
        strokeWidth={1}
      />
    </svg>
  )
}
function TextSizeIcon() {
  // DF2-8: text-size icon — small T next to large T (designer reference).
  return (
    <span className="inline-flex items-baseline gap-[1px] text-gray-700 select-none leading-none">
      <span className="text-[9px] font-semibold">T</span>
      <span className="text-[14px] font-semibold">T</span>
    </span>
  )
}
export function PartialEditorPage() {
  const { id } = useParams<{ id?: string }>()
  const navigate = useNavigate()
  const { show: showToast } = useToast()
  const [searchParams] = useSearchParams()
  const location = useLocation()
  const { user } = useCurrentUser()

  const existing = id ? PARTIALS.find((p) => p.id === id) : undefined
  const isEdit = !!existing

  const presetSection = searchParams.get('section') as PartialSection | null
  const presetTeam = searchParams.get('team') as OwningTeam | null
  const duplicateFromId = searchParams.get('duplicateFrom')
  const duplicateSource = duplicateFromId ? PARTIALS.find((p) => p.id === duplicateFromId) : undefined

  const [name, setName] = useState(
    existing?.name ?? (duplicateSource ? `Copy of ${duplicateSource.name}` : ''),
  )
  const [section, setSection] = useState<PartialSection | ''>(
    existing?.section
      ?? duplicateSource?.section
      ?? (PARTIAL_SECTIONS.includes(presetSection as PartialSection) ? (presetSection as PartialSection) : ''),
  )
  const [authoringTeam, setAuthoringTeam] = useState<OwningTeam | ''>(
    existing?.authoringTeam
      ?? duplicateSource?.authoringTeam
      ?? (OWNING_TEAMS.includes(presetTeam as OwningTeam) ? (presetTeam as OwningTeam) : ''),
  )
  const [body, setBody] = useState(existing?.body ?? duplicateSource?.body ?? '')
  const [mode, setMode] = useState<'rich' | 'html'>('rich')
  const [popover, setPopover] = useState<PopoverKind>(null)
  // DF2: custom Discard-changes modal in place of window.confirm
  const [discardOpen, setDiscardOpen] = useState(false)
  const [activeFormats, setActiveFormats] = useState({
    bold: false, italic: false, underline: false, block: '',
  })

  // Session-scoped sample values used when opening the preview in a new tab.
  // Not persisted; reset when leaving the editor.
  const [sampleValues, setSampleValues] = useState<Record<string, string>>({})
  // Variables contract accordion
  const [varsExpanded, setVarsExpanded] = useState(false)

  const editorRef = useRef<HTMLDivElement>(null)
  const savedRange = useRef<Range | null>(null)

  // Track selection state to show active toolbar buttons (B/I/U + block)
  useEffect(() => {
    if (mode !== 'rich') return
    const handler = () => {
      const sel = window.getSelection()
      if (!sel || sel.rangeCount === 0 || !editorRef.current) return
      if (!editorRef.current.contains(sel.anchorNode)) return
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
  }, [mode])

  // Set initial content into the contenteditable on mount, on mode-switch,
  // and whenever the route id changes (so the editor re-initializes when
  // navigating between partials without remount). Body changes from live
  // typing are NOT a dependency — we don't want to wipe the user's caret.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (mode === 'rich' && editorRef.current) {
      editorRef.current.innerHTML = body
      // Ensure every var-chip has zero-width-space sentinels on both sides so
      // the caret has a landing zone adjacent to the contenteditable="false"
      // chip. Without this, the cursor doesn't render visibly next to chips
      // saved before the sentinels were introduced (or pasted in from elsewhere).
      const ZWSP = '​'
      editorRef.current.querySelectorAll('.var-chip').forEach((chip) => {
        const prev = chip.previousSibling
        const next = chip.nextSibling
        const prevIsZwsp = prev && prev.nodeType === Node.TEXT_NODE && (prev.textContent || '').endsWith(ZWSP)
        const nextIsZwsp = next && next.nodeType === Node.TEXT_NODE && (next.textContent || '').startsWith(ZWSP)
        if (!prevIsZwsp) chip.parentNode?.insertBefore(document.createTextNode(ZWSP), chip)
        if (!nextIsZwsp) chip.parentNode?.insertBefore(document.createTextNode(ZWSP), chip.nextSibling)
      })
    }
  }, [mode, id])

  const originalSnapshot = useMemo(
    () => JSON.stringify({
      name: existing?.name || '',
      section: existing?.section || '',
      authoringTeam: existing?.authoringTeam || '',
      body: existing?.body || '',
    }),
    [existing],
  )
  const currentSnapshot = JSON.stringify({ name, section, authoringTeam, body })
  const dirty = originalSnapshot !== currentSnapshot

  useEffect(() => {
    if (!dirty) return
    const handler = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = '' }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [dirty])

  if (id && !existing) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <h2 className="text-xl font-semibold text-gray-900 mb-2">Partial not found</h2>
        <p className="text-sm text-gray-500 mb-4">This partial may have been deleted or the link is incorrect.</p>
        <button onClick={() => navigate('/partials')} className="text-sm text-primary font-medium hover:underline">← Back to Partials</button>
      </div>
    )
  }

  const varRefs = extractVariableRefs(body)
  const dependentTemplates = existing ? TEMPLATES.filter((t) => t.requiredPartialIds.includes(existing.id)) : []
  const requiringRules = existing ? REQUIRED_PARTIAL_RULES.filter((r) => r.partialId === existing.id) : []
  const requiredByTypes = Array.from(new Set(requiringRules.map((r) => r.templateType)))

  const originalVars = useMemo(() => existing ? extractVariableRefs(existing.body) : [], [existing])
  const removedVars = isEdit ? originalVars.filter((v) => !varRefs.includes(v)) : []
  const addedVars = isEdit ? varRefs.filter((v) => !originalVars.includes(v)) : []

  const nameTrimmed = name.trim()
  const bodyTrimmed = body.trim()
  const duplicateName = nameTrimmed
    ? PARTIALS.some((p) => p.id !== existing?.id && p.name.trim().toLowerCase() === nameTrimmed.toLowerCase())
    : false
  const canSave = !!nameTrimmed && !!section && !!authoringTeam && !!bodyTrimmed && !duplicateName

  const navigateAway = () => {
    navigate(existing ? `/partials/${existing.id}` : '/partials')
  }
  const handleCancel = () => {
    if (dirty) {
      setDiscardOpen(true)
      return
    }
    navigateAway()
  }
  const handleSave = () => {
    if (!canSave || !section || !authoringTeam) return
    const now = new Date().toISOString()
    const id = existing?.id ?? `partial-${Date.now()}`
    savePartial({
      id,
      name: nameTrimmed,
      section,
      authoringTeam,
      body: bodyTrimmed,
      lifecycle: existing?.lifecycle ?? 'Active',
      owner: existing?.owner ?? user.email,
      lastEditedBy: existing ? user.email : undefined,
      version: existing ? existing.version + 1 : 1,
      createdBy: existing?.createdBy ?? user.email,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    })
    navigate(`/partials/${id}`)
  }

  // ── Selection + editor helpers ────────────────────────────────────────────
  const saveSelection = () => {
    const sel = window.getSelection()
    if (sel && sel.rangeCount > 0 && editorRef.current?.contains(sel.anchorNode)) {
      savedRange.current = sel.getRangeAt(0).cloneRange()
    }
  }
  const restoreSelection = () => {
    if (!savedRange.current) {
      editorRef.current?.focus()
      return
    }
    const sel = window.getSelection()
    if (sel) {
      sel.removeAllRanges()
      sel.addRange(savedRange.current)
    }
    editorRef.current?.focus()
  }

  const syncBodyFromEditor = () => {
    if (editorRef.current) setBody(editorRef.current.innerHTML)
  }

  // Editor keystrokes around variable chips. A var-chip is an atomic token —
  // the caret cannot land inside it, and Backspace/Delete adjacent to it must
  // remove the chip in a single keystroke (browser default doesn't, because
  // the chip is contenteditable="false").
  //
  // Cases handled below:
  //   • Backspace with caret immediately after a chip → remove the chip
  //   • Delete    with caret immediately before a chip → remove the chip
  //   • Backspace at start of a line that follows a <br> → drop the <br>
  //   • Backspace at start of a block whose previous sibling is a block →
  //     merge the two blocks (DF2 fix, preserved from earlier)
  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const isBackspace = e.key === 'Backspace'
    const isDelete = e.key === 'Delete'
    if (!isBackspace && !isDelete) return

    const sel = window.getSelection()
    if (!sel || sel.rangeCount === 0 || !sel.isCollapsed) return
    const range = sel.getRangeAt(0)
    const root = editorRef.current
    if (!root || !root.contains(range.startContainer)) return

    const isBlockEl = (n: Node | null): boolean => {
      if (!n || n.nodeType !== 1) return false
      const tag = (n as HTMLElement).tagName
      return tag === 'DIV' || tag === 'P' || /^H[1-6]$/.test(tag) || tag === 'LI' || tag === 'UL' || tag === 'OL' || tag === 'BLOCKQUOTE'
    }
    const isWhitespaceOnlyText = (n: Node | null): boolean => {
      if (!n || n.nodeType !== Node.TEXT_NODE) return false
      // Treat nbsp ( ) and zero-width space (​) as whitespace too —
      // the former is the spacer inserted after a chip; the latter is the
      // caret-landing sentinel that wraps every chip.
      return !(n.textContent || '').replace(/[\s ​]/g, '').length
    }

    // Find the node immediately adjacent to the caret in the given direction,
    // crossing inline wrappers but never a block boundary or the editor root.
    const findAdjacentNode = (dir: 'back' | 'forward'): Node | null => {
      const container = range.startContainer
      const offset = range.startOffset
      let probe: Node | null = null

      if (container.nodeType === Node.TEXT_NODE) {
        const len = (container.textContent || '').length
        if (dir === 'back' && offset !== 0) return null
        if (dir === 'forward' && offset !== len) return null
        probe = dir === 'back' ? container.previousSibling : container.nextSibling
        // Walk up out of inline wrappers when we're at the edge of one.
        let parent: Node | null = container.parentNode
        while (!probe && parent && parent !== root && !isBlockEl(parent)) {
          probe = dir === 'back' ? parent.previousSibling : parent.nextSibling
          parent = parent.parentNode
        }
      } else {
        probe = dir === 'back' ? container.childNodes[offset - 1] || null : container.childNodes[offset] || null
      }

      // Step over whitespace-only text nodes so a stray space/nbsp doesn't
      // mask the chip.
      while (probe && isWhitespaceOnlyText(probe)) {
        probe = dir === 'back' ? probe.previousSibling : probe.nextSibling
      }
      return probe
    }

    const isVarChip = (n: Node | null): n is HTMLElement =>
      !!n && n.nodeType === Node.ELEMENT_NODE && (n as HTMLElement).classList?.contains('var-chip')

    // ── Chip-deletion case (covers both reported symptoms) ──────────────
    if (isBackspace) {
      const adj = findAdjacentNode('back')
      if (isVarChip(adj)) {
        e.preventDefault()
        adj.parentNode?.removeChild(adj)
        syncBodyFromEditor()
        return
      }
    }
    if (isDelete) {
      const adj = findAdjacentNode('forward')
      if (isVarChip(adj)) {
        e.preventDefault()
        adj.parentNode?.removeChild(adj)
        syncBodyFromEditor()
        return
      }
    }

    // The remaining cases are Backspace-only block-merge fixes (DF2).
    if (!isBackspace) return

    // Only intervene when the caret sits at the very start of its container.
    if (range.startOffset !== 0) return

    // Walk up to the nearest block-level ancestor or the editor root.
    let node: Node | null = range.startContainer
    let blockAncestor: HTMLElement | null = null
    while (node && node !== root) {
      if (node.nodeType === 1) {
        const tag = (node as HTMLElement).tagName
        if (tag === 'DIV' || tag === 'P' || /^H[1-6]$/.test(tag) || tag === 'LI') {
          blockAncestor = node as HTMLElement
          break
        }
      }
      node = node.parentNode
    }

    // Case A: caret immediately follows a <br> in the same inline flow.
    // Remove the <br> so the line collapses upward.
    const startNode = range.startContainer
    const prevInline = startNode.previousSibling
    if (prevInline && prevInline.nodeName === 'BR') {
      e.preventDefault()
      prevInline.parentNode?.removeChild(prevInline)
      syncBodyFromEditor()
      return
    }

    // Case B: caret sits at the start of a block whose previous sibling is
    // also a block. Move this block's children to the end of the previous
    // block and remove the now-empty current block.
    if (blockAncestor) {
      const prevBlock = blockAncestor.previousElementSibling as HTMLElement | null
      if (prevBlock) {
        // Preserve the block boundary when the previous block contains a
        // variable chip. Without this guard, Backspace at the start of the
        // line below a chip-containing line would pull this block's text up
        // and glue it directly after the chip, which makes the variable
        // hard to read and hard to target for further edits. The user's
        // explicit ask: text following a variable should never merge into
        // the variable's line.
        if (prevBlock.querySelector('.var-chip')) {
          e.preventDefault()
          return
        }
        e.preventDefault()
        // Drop a trailing <br> on the previous block if any (browsers insert
        // these as line padding) so the merge doesn't leave an extra break.
        const prevLast = prevBlock.lastChild
        if (prevLast && prevLast.nodeName === 'BR') prevBlock.removeChild(prevLast)

        // Place caret at the join point before moving children.
        const newRange = document.createRange()
        newRange.selectNodeContents(prevBlock)
        newRange.collapse(false)

        while (blockAncestor.firstChild) {
          prevBlock.appendChild(blockAncestor.firstChild)
        }
        blockAncestor.parentNode?.removeChild(blockAncestor)

        sel.removeAllRanges()
        sel.addRange(newRange)
        syncBodyFromEditor()
        return
      }
    }
  }

  const exec = (cmd: string, value?: string) => {
    editorRef.current?.focus()
    document.execCommand(cmd, false, value)
    syncBodyFromEditor()
  }

  // Apply text-align to EVERY block-level child of the editor, not just the
  // block containing the caret. The default execCommand('justifyCenter') only
  // aligns the current block — but users expect Align Center / Right to align
  // the whole document, the way it works in Google Docs / Notion at the page
  // level. If the editor has only a bare text node, wrap it in a div first so
  // text-align has somewhere to live.
  //
  // For <ol>/<ul>: when centering or right-aligning, also flip the markers to
  // list-style-position: inside so the numerals/bullets travel with the text
  // instead of staying anchored in a left gutter. Restore outside on left
  // alignment so the default visual returns.
  const applyAlignment = (align: 'left' | 'center' | 'right') => {
    const root = editorRef.current
    if (!root) return
    root.focus()
    if (root.children.length === 0 && root.textContent && root.textContent.length > 0) {
      const div = document.createElement('div')
      div.style.textAlign = align
      div.textContent = root.textContent
      root.innerHTML = ''
      root.appendChild(div)
    } else {
      Array.from(root.children).forEach((child) => {
        const el = child as HTMLElement
        el.style.textAlign = align
        if (el.tagName === 'OL' || el.tagName === 'UL') {
          el.style.listStylePosition = align === 'left' ? '' : 'inside'
          el.style.paddingLeft = align === 'left' ? '' : '0'
        }
      })
    }
    syncBodyFromEditor()
  }

  const insertHTML = (html: string) => {
    restoreSelection()
    document.execCommand('insertHTML', false, html)
    syncBodyFromEditor()
  }

  const openPopover = (kind: PopoverKind) => {
    saveSelection()
    setPopover(kind)
  }

  // ── Preview HTML — substitutes sample values, amber-chips unfilled tokens ──
  const compiledBody = body
    ? compileBodyForPreview(body, sampleValues)
    : '<p style="color:#9ca3af;font-style:italic">Start writing your partial to see a live preview.</p>'

  const previewHtml = `<!DOCTYPE html><html><head><style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; margin: 0; padding: 20px; font-size: 14px; color: #111827; line-height: 1.5; }
    * { box-sizing: border-box; }
    img { max-width: 100%; height: auto; }
    a { color: #007F4A; }
    h1 { font-size: 22px; margin: 0 0 8px; color: #111827; }
    h2 { font-size: 18px; margin: 12px 0 6px; color: #111827; }
    h3 { font-size: 15px; margin: 10px 0 4px; color: #111827; }
    p { margin: 0 0 10px; }
    ul, ol { margin: 0 0 10px 20px; padding: 0; }
  </style></head><body>${compiledBody}</body></html>`

  // Open a standalone preview in a new tab with current sample values substituted.
  const openPreviewInNewTab = () => {
    const win = window.open('', '_blank')
    if (!win) return
    win.document.write(previewHtml)
    win.document.title = name || 'Untitled partial — preview'
    win.document.close()
  }

  // ── Layout ────────────────────────────────────────────────────────────────
  return (
    <div className="max-w-[1280px]">
      <div className="sticky top-0 bg-white z-10 pt-6">
        <Breadcrumbs items={
          existing
            ? [
                { label: 'Partials', to: '/partials' },
                { label: existing.name, to: `/partials/${existing.id}` },
                { label: 'Edit' },
              ]
            : [
                { label: 'Partials', to: '/partials' },
                { label: 'New partial' },
              ]
        } />

      {/* Editable page header — matches `Screenshot_7.12.00`:
          editable title, Cancel (secondary) + Save (primary) buttons, overflow "…" menu
          (edit-mode only), bottom divider line under the entire row. */}
      <div className="flex items-start justify-between gap-6 mt-4 pb-4 border-b border-gray-200">
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Untitled partial"
          className="flex-1 text-3xl font-semibold text-gray-900 bg-transparent border-0 px-0 focus:outline-none placeholder:text-gray-300"
        />
        <div className="flex items-center gap-2 shrink-0 mt-1">
          <button
            type="button"
            onClick={openPreviewInNewTab}
            className="px-3 py-1.5 text-sm font-medium text-primary hover:underline"
          >
            Preview
          </button>
          <button
            onClick={handleCancel}
            className="px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!canSave}
            className="px-4 py-1.5 text-sm font-medium text-white bg-primary rounded-md hover:bg-primary-hover disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Save
          </button>
          {/* Overflow menu — visible only when editing an existing partial.
              "Delete" is a placeholder for now; will wire to a confirm modal in Phase 8. */}
          {isEdit && (
            <OverflowMenu
              items={[
                {
                  label: 'Delete partial',
                  destructive: true,
                  onClick: () => showToast('Delete coming soon. (Will open a confirm modal in Phase 8.)'),
                },
              ]}
            />
          )}
        </div>
      </div>
      {duplicateName && (
        <p className="text-xs text-red-600 mt-1">A partial with this name already exists.</p>
      )}
      </div>

      {/* Details accordion — per designer feedback item 14, the metadata fields
          (Section, Created by, etc.) live in a collapsible "Details" section so the
          edit-mode UI matches the view-page structure. Open by default. */}
      <EditorPartialDetailsAccordion>
        <MetaField label="Section">
          {isEdit ? (
            <span className="text-sm text-gray-900">{section}</span>
          ) : (
            <FilterSelect
              value={section}
              onChange={(v) => setSection(v as PartialSection | '')}
              placeholder="Select…"
              options={PARTIAL_SECTIONS.map((s) => ({ value: s, label: s }))}
              minWidth="180px"
            />
          )}
        </MetaField>

        <MetaField label="Created by">
          {isEdit ? (
            <span className="text-sm text-gray-900">{authoringTeam}</span>
          ) : (
            <FilterSelect
              value={authoringTeam}
              onChange={(v) => setAuthoringTeam(v as OwningTeam | '')}
              placeholder="Select team…"
              options={OWNING_TEAMS.map((t) => ({ value: t, label: t }))}
              minWidth="180px"
            />
          )}
        </MetaField>

        <MetaField label="Required for">
          {requiredByTypes.length > 0 ? (
            <span className="text-sm text-gray-900">
              {requiredByTypes.map((t, i) => (
                <span key={t}>
                  <Link
                    to={`/admin/required-partials?type=${encodeURIComponent(t)}&from=${encodeURIComponent(location.pathname + location.search)}`}
                    className="text-primary hover:underline"
                    title="View the governance rule for this template type"
                  >
                    {t}
                  </Link>
                  {i < requiredByTypes.length - 1 && <span className="text-gray-400">, </span>}
                </span>
              ))}
            </span>
          ) : (
            <span className="text-sm text-gray-400">—</span>
          )}
        </MetaField>

        {section && !isEdit && (
          <p className="text-xs text-gray-500 italic">{PARTIAL_SECTION_DESCRIPTIONS[section as PartialSection]}</p>
        )}
      </EditorPartialDetailsAccordion>

      {/* Blast-radius warning — only fires when dependent templates exist.
          Governance role lives in the metadata row above as a property, not a warning. */}
      {isEdit && dependentTemplates.length > 0 && (
        <div className="mt-4 bg-amber-50 border border-amber-200 rounded-md px-4 py-3 text-sm text-amber-900 flex items-start gap-2">
          <svg className="w-4 h-4 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
          </svg>
          <div className="flex-1">
            Editing this partial will affect{' '}
            <span className="font-semibold">{dependentTemplates.length} template{dependentTemplates.length !== 1 ? 's' : ''}</span>
            {' '}that use it. They'll send with your changes on their next scheduled run.
          </div>
        </div>
      )}

      {/* Toolbar */}
      <EditorToolbar
        mode={mode}
        onMode={(m) => {
          if (mode === 'rich') syncBodyFromEditor()
          setMode(m)
        }}
        exec={exec}
        applyAlignment={applyAlignment}
        openPopover={openPopover}
        varRefs={varRefs}
        onInsertVariable={(v) => insertHTML(buildVariableChip(v) + '&nbsp;')}
        active={activeFormats}
        saveSelection={saveSelection}
        restoreSelection={restoreSelection}
      />

      {/* Editor — full width (preview opens in a new tab via the page header). */}
      <div className="mt-3 space-y-3">
        <div className="border border-gray-200 rounded-md bg-white overflow-hidden">
          {mode === 'rich' ? (
            <div
              ref={editorRef}
              contentEditable
              suppressContentEditableWarning
              onInput={syncBodyFromEditor}
              onKeyDown={handleKeyDown}
              onBlur={saveSelection}
              data-editor="rich"
              className="px-4 py-3 text-sm text-gray-900 outline-none min-h-[280px] leading-relaxed"
              style={{ wordBreak: 'break-word' }}
              data-placeholder="Start writing your partial. Use the toolbar to format, or switch to HTML for direct markup."
            />
          ) : (
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              spellCheck={false}
              className="w-full text-xs font-mono px-4 py-3 outline-none resize-none leading-relaxed min-h-[280px]"
              placeholder="HTML or plain text. Use {{varName}} for variables."
            />
          )}
        </div>

        {/* Variables — collapsible accordion at bottom, with sample-value inputs
            that feed the new-tab preview. */}
        <VariablesContract
          varRefs={varRefs}
          addedVars={addedVars}
          removedVars={removedVars}
          isEdit={isEdit}
          expanded={varsExpanded}
          onToggle={() => setVarsExpanded((v) => !v)}
          sampleValues={sampleValues}
          onChangeSample={(name, val) => setSampleValues((sv) => ({ ...sv, [name]: val }))}
        />
      </div>

      {/* Popovers */}
      {popover === 'link' && (
        <InsertPopover
          title="Insert link"
          fields={[
            { key: 'url', label: 'Link URL', placeholder: 'https://… or {{varName}}' },
            { key: 'text', label: 'Display text', placeholder: 'Click here' },
          ]}
          // Prefill Display text with the user's current selection so that
          // highlighting a phrase + clicking Insert link turns that phrase
          // into the link — no retyping required.
          initialValues={{
            text: (savedRange.current?.toString() || '').trim(),
          }}
          onSubmit={({ url, text }) => {
            const display = text || url
            // target="_blank" so links open in a new tab from the preview
            // iframe (email-client convention). rel prevents the destination
            // from accessing window.opener. insertHTML restores the saved
            // selection before inserting, so the new <a> replaces the
            // originally-highlighted text in-place.
            insertHTML(`<a href="${url}" target="_blank" rel="noopener noreferrer">${display}</a>`)
            setPopover(null)
          }}
          onCancel={() => setPopover(null)}
        />
      )}

      {popover === 'image' && (
        <InsertPopover
          title="Insert image"
          fields={[
            { key: 'url', label: 'Image URL', placeholder: 'https://…' },
            { key: 'alt', label: 'Alt text', placeholder: 'Description of the image' },
          ]}
          onSubmit={({ url, alt }) => {
            insertHTML(`<img src="${url}" alt="${alt}" style="max-width:100%;height:auto" />`)
            setPopover(null)
          }}
          onCancel={() => setPopover(null)}
        />
      )}

      {popover === 'cta' && (
        <CTAPopover
          onSubmit={({ text, url, color }) => {
            insertHTML(buildCTAHTML(text, url, color))
            setPopover(null)
          }}
          onCancel={() => setPopover(null)}
        />
      )}

      {popover === 'variable' && (
        <VariablePopover
          existing={varRefs}
          onSubmit={(varName) => {
            insertHTML(buildVariableChip(varName) + '&nbsp;')
            setPopover(null)
          }}
          onCancel={() => setPopover(null)}
        />
      )}

      {/* placeholder styling for contenteditable */}
      <style>{`
        [contenteditable][data-placeholder]:empty::before {
          content: attr(data-placeholder);
          color: #9ca3af;
          font-style: italic;
        }
      `}</style>

      {/* DF2: Custom Discard-changes modal — replaces native window.confirm. */}
      <ConfirmModal
        open={discardOpen}
        title="Discard changes?"
        body="Are you sure you want to discard unsaved changes?"
        confirmLabel="Confirm"
        cancelLabel="Cancel"
        onConfirm={() => { setDiscardOpen(false); navigateAway() }}
        onCancel={() => setDiscardOpen(false)}
      />
    </div>
  )
}

// ─── Variables contract (collapsible) ────────────────────────────────────────
function VariablesContract({
  varRefs, addedVars, removedVars, isEdit, expanded, onToggle,
  sampleValues, onChangeSample,
}: {
  varRefs: string[]
  addedVars: string[]
  removedVars: string[]
  isEdit: boolean
  expanded: boolean
  onToggle: () => void
  sampleValues: Record<string, string>
  onChangeSample: (name: string, val: string) => void
}) {
  const hasDiff = isEdit && (addedVars.length > 0 || removedVars.length > 0)
  return (
    <div className="border border-gray-200 rounded-md bg-gray-50 overflow-hidden">
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center px-4 py-3 text-left hover:bg-gray-100/60 transition-colors"
      >
        <span className="inline-flex items-center gap-2 text-sm font-medium text-gray-900">
          <svg className={`w-4 h-4 text-gray-500 shrink-0 transition-transform ${expanded ? 'rotate-0' : '-rotate-90'}`}
            fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
          Variables
          {varRefs.length > 0 && (
            <span className="font-normal text-gray-500">({varRefs.length})</span>
          )}
          {hasDiff && (
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400" title="Variables changed since last save" />
          )}
        </span>
      </button>

      {expanded && (
        <div className="px-4 pb-4 space-y-3">
          {varRefs.length === 0 ? (
            <p className="text-xs text-gray-500">
              No variables yet. Use the <code className="text-amber-700">{`{{x}}`}</code> toolbar button to insert one, or type <code className="text-amber-700">{`{{name}}`}</code> directly.
            </p>
          ) : (
            <div className="space-y-2">
              <p className="text-sm text-gray-600">
                Type a sample value to preview with custom data
              </p>
              {varRefs.map((v) => (
                <div key={v} className="flex items-center gap-2">
                  <code className="inline-flex items-center px-2.5 py-1 rounded-md bg-amber-50 border border-amber-700 text-xs font-mono text-gray-900 shrink-0 max-w-[220px] truncate">
                    {`{{ ${v} }}`}
                  </code>
                  <input
                    type="text"
                    value={sampleValues[v] ?? ''}
                    onChange={(e) => onChangeSample(v, e.target.value)}
                    placeholder="value"
                    className="flex-1 min-w-0 h-8 px-3 text-sm border border-gray-200 rounded bg-white focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/20"
                  />
                </div>
              ))}
            </div>
          )}
          {hasDiff && (
            <div className="space-y-0.5 border-t border-gray-200 pt-2">
              {addedVars.length > 0 && (
                <p className="text-xs text-gray-600">
                  <span className="text-green-700 font-medium">+ Added:</span>{' '}
                  {addedVars.map((v) => `{{${v}}}`).join(', ')}
                </p>
              )}
              {removedVars.length > 0 && (
                <p className="text-xs text-amber-800">
                  <span className="font-medium">− Removed:</span>{' '}
                  {removedVars.map((v) => `{{${v}}}`).join(', ')}{' '}
                  — templates that declare these may need updates.
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── MetaField ───────────────────────────────────────────────────────────────
function MetaField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-[10px] uppercase tracking-wider font-semibold text-gray-500">{label}</span>
      {children}
    </div>
  )
}

// Per designer feedback item 14: editor pages wrap the metadata fields in a
// collapsible "Details" accordion so edit-mode matches the view-page structure.
function EditorPartialDetailsAccordion({ children }: { children: React.ReactNode }) {
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
        <div className="flex items-center gap-8 mt-2 flex-wrap">
          {children}
        </div>
      )}
    </div>
  )
}

// ─── Toolbar ─────────────────────────────────────────────────────────────────
function EditorToolbar({
  mode, onMode, exec, applyAlignment, openPopover, varRefs, onInsertVariable, active, saveSelection, restoreSelection,
}: {
  mode: 'rich' | 'html'
  onMode: (m: 'rich' | 'html') => void
  exec: (cmd: string, value?: string) => void
  applyAlignment: (align: 'left' | 'center' | 'right') => void
  openPopover: (kind: PopoverKind) => void
  varRefs: string[]
  onInsertVariable: (v: string) => void
  active: { bold: boolean; italic: boolean; underline: boolean; block: string }
  saveSelection: () => void
  restoreSelection: () => void
}) {
  const richEnabled = mode === 'rich'
  return (
    <div className="sticky top-0 z-10 mt-4 bg-white border border-gray-200 rounded-md px-2 py-1.5 flex items-center gap-2">
      {/* Tools — wrap on very narrow widths but never push the right-side toggle to a new row */}
      <div className="flex items-center gap-1 flex-wrap flex-1 min-w-0">
      {/* Heading dropdown (aT ▾) — first item per designer reference */}
      <ToolbarGroup>
        <HeadingDropdown exec={exec} disabled={!richEnabled} activeBlock={active.block} saveSelection={saveSelection} restoreSelection={restoreSelection} />
      </ToolbarGroup>


      {/* B / I / U / S */}
      <ToolbarGroup>
        <TBtn label="Bold (Ctrl+B)" onClick={() => exec('bold')} disabled={!richEnabled} bold active={active.bold}>B</TBtn>
        <TBtn label="Italic (Ctrl+I)" onClick={() => exec('italic')} disabled={!richEnabled} italic active={active.italic}>I</TBtn>
        <TBtn label="Underline (Ctrl+U)" onClick={() => exec('underline')} disabled={!richEnabled} underline active={active.underline}>U</TBtn>
        <TBtn label="Strikethrough" onClick={() => exec('strikethrough')} disabled={!richEnabled}>
          <StrikethroughIcon />
        </TBtn>
      </ToolbarGroup>


      {/* Text color (A) / Highlight (paint bucket) */}
      <ToolbarGroup>
        <ColorDropdown
          label="Text color"
          icon={<TextColorIcon />}
          palette={TEXT_COLOR_PALETTE}
          onPick={(c) => exec('foreColor', c)}
          disabled={!richEnabled}
          saveSelection={saveSelection}
          restoreSelection={restoreSelection}
        />
        <ColorDropdown
          label="Highlight"
          icon={<HighlightIcon />}
          palette={HIGHLIGHT_PALETTE}
          onPick={(c) => exec('hiliteColor', c)}
          disabled={!richEnabled}
          saveSelection={saveSelection}
          restoreSelection={restoreSelection}
        />
      </ToolbarGroup>


      {/* Alignment */}
      <ToolbarGroup>
        <AlignDropdown applyAlignment={applyAlignment} disabled={!richEnabled} />
      </ToolbarGroup>


      {/* Lists + indent */}
      <ToolbarGroup>
        <TBtn label="Bullet list" onClick={() => exec('insertUnorderedList')} disabled={!richEnabled}>
          <BulletListIcon />
        </TBtn>
        <TBtn label="Numbered list" onClick={() => exec('insertOrderedList')} disabled={!richEnabled}>
          <NumberedListIcon />
        </TBtn>
        <TBtn label="Indent" onClick={() => exec('indent')} disabled={!richEnabled}>
          <IndentRightIcon />
        </TBtn>
        <TBtn label="Outdent" onClick={() => exec('outdent')} disabled={!richEnabled}>
          <IndentLeftIcon />
        </TBtn>
      </ToolbarGroup>


      {/* Insert tools — Link/Image icon-only; Button and Variable carry text labels per designer reference */}
      <ToolbarGroup>
        <TBtn label="Insert link" onClick={() => openPopover('link')} disabled={!richEnabled}>
          <LinkIcon />
        </TBtn>
        <TBtn label="Insert image" onClick={() => openPopover('image')} disabled={!richEnabled}>
          <ImageIcon />
        </TBtn>
        <TBtn label="Insert button" onClick={() => openPopover('cta')} disabled={!richEnabled}>
          <span className="inline-flex items-center gap-1">
            <ButtonIcon />
            <span className="text-xs">Button</span>
          </span>
        </TBtn>
        <VariableDropdown vars={varRefs} onInsert={onInsertVariable} onCustom={() => openPopover('variable')} disabled={!richEnabled} />
      </ToolbarGroup>
      </div>

      {/* TEXT EDITOR / </> HTML toggle — locked to the right of the toolbar in one row */}
      <div className="shrink-0 flex items-center bg-gray-100 rounded p-0.5">
        <button
          onClick={() => onMode('rich')}
          className={`px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide rounded transition-colors ${mode === 'rich' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
        >Text editor</button>
        <button
          onClick={() => onMode('html')}
          className={`px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide rounded transition-colors ${mode === 'html' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
        >&lt;/&gt; HTML</button>
      </div>
    </div>
  )
}

function ToolbarGroup({ children }: { children: React.ReactNode }) {
  return <div className="flex items-center gap-0.5">{children}</div>
}

function TBtn({
  children, onClick, disabled, label, bold, italic, underline, active,
}: {
  children: React.ReactNode; onClick: () => void; disabled?: boolean; label: string
  bold?: boolean; italic?: boolean; underline?: boolean; active?: boolean
}) {
  return (
    <button
      type="button"
      title={label}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      disabled={disabled}
      className={`h-7 min-w-7 px-1.5 inline-flex items-center justify-center rounded text-sm text-gray-700 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed ${active ? 'bg-gray-200 text-gray-900' : ''} ${bold ? 'font-bold' : ''} ${italic ? 'italic' : ''} ${underline ? 'underline' : ''}`}
    >
      {children}
    </button>
  )
}

function HeadingDropdown({
  exec, disabled, activeBlock, saveSelection, restoreSelection,
}: {
  exec: (cmd: string, val?: string) => void
  disabled?: boolean
  activeBlock: string
  saveSelection: () => void
  restoreSelection: () => void
}) {
  const currentLabel =
    activeBlock === 'h1' ? 'Heading 1'
    : activeBlock === 'h2' ? 'Heading 2'
    : activeBlock === 'h3' ? 'Heading 3'
    : 'Paragraph'
  return (
    <div className="relative inline-flex items-center">
      <span className="pointer-events-none absolute left-1.5 top-1/2 -translate-y-1/2 inline-flex items-center gap-0.5 text-gray-700">
        {/* DF2-8: text-size icon (replaces previous "aT" overlay) */}
        <TextSizeIcon />
        <svg className="w-3 h-3 -ml-0.5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </span>
      <select
        disabled={disabled}
        onMouseDown={(e) => { e.stopPropagation(); saveSelection() }}
        onFocus={() => saveSelection()}
        onChange={(e) => {
          const v = e.target.value
          if (v) {
            restoreSelection()
            exec('formatBlock', `<${v}>`)
          }
          e.target.value = ''
        }}
        className="appearance-none h-7 w-12 pl-8 bg-transparent border-0 rounded hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer focus:outline-none text-transparent"
        title={`Block format — current: ${currentLabel}`}
        value=""
        aria-label="Heading style"
      >
        <option value="" disabled>{currentLabel}</option>
        <option value="p">Paragraph</option>
        <option value="h1">Heading 1</option>
        <option value="h2">Heading 2</option>
        <option value="h3">Heading 3</option>
      </select>
    </div>
  )
}

function AlignDropdown({
  applyAlignment, disabled,
}: {
  applyAlignment: (align: 'left' | 'center' | 'right') => void
  disabled?: boolean
}) {
  return (
    <select
      disabled={disabled}
      onChange={(e) => {
        const v = e.target.value
        if (v === 'left' || v === 'center' || v === 'right') applyAlignment(v)
        e.target.value = ''
      }}
      className="h-7 text-xs text-gray-700 bg-transparent border-0 px-1 rounded hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer focus:outline-none"
      title="Alignment — applies to the whole document"
      value=""
    >
      <option value="" disabled>Align ▾</option>
      <option value="left">Left</option>
      <option value="center">Center</option>
      <option value="right">Right</option>
    </select>
  )
}

function VariableDropdown({
  vars, onInsert, onCustom, disabled,
}: {
  vars: string[]; onInsert: (v: string) => void; onCustom: () => void; disabled?: boolean
}) {
  const [open, setOpen] = useState(false)
  return (
    <div className="relative">
      <button
        type="button"
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => setOpen(!open)}
        disabled={disabled}
        title="Insert a placeholder that fills with real data when the email is sent"
        className="h-7 px-2.5 inline-flex items-center gap-1.5 rounded-md text-xs text-gray-900 bg-amber-50 border border-amber-700 hover:bg-amber-100 disabled:opacity-30 disabled:cursor-not-allowed font-medium"
      >
        {/* Curly-brace glyph — mirrors the `{{ }}` token syntax */}
        <span className="font-mono text-[12px] leading-none tracking-tight text-gray-900">{'{ }'}</span>
        Variable
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-1 w-48 bg-white border border-gray-200 rounded-lg shadow-lg py-1 z-50">
            <div className="px-3 py-1.5 text-[10px] uppercase tracking-wider font-semibold text-gray-500 border-b border-gray-100">
              {vars.length > 0 ? 'In this partial' : 'No variables yet'}
            </div>
            {vars.map((v) => (
              <button
                key={v}
                onClick={() => { setOpen(false); onInsert(v) }}
                className="block w-full text-left px-3 py-1.5 text-xs font-mono text-amber-800 hover:bg-amber-50"
              >
                {`{{${v}}}`}
              </button>
            ))}
            <button
              onClick={() => { setOpen(false); onCustom() }}
              className="block w-full text-left px-3 py-1.5 text-xs text-primary hover:bg-gray-50 border-t border-gray-100 font-medium"
            >
              + New variable…
            </button>
          </div>
        </>
      )}
    </div>
  )
}

// ─── Generic insert popover ─────────────────────────────────────────────────
function InsertPopover({
  title, fields, onSubmit, onCancel, initialValues,
}: {
  title: string
  fields: { key: string; label: string; placeholder?: string }[]
  onSubmit: (values: Record<string, string>) => void
  onCancel: () => void
  /**
   * Optional initial values for fields. Used to prefill, e.g., the Display
   * text of the Insert link dialog from the user's current selection.
   */
  initialValues?: Record<string, string>
}) {
  const [values, setValues] = useState<Record<string, string>>(
    Object.fromEntries(fields.map((f) => [f.key, initialValues?.[f.key] ?? ''])),
  )
  const canSubmit = fields.every((f) => values[f.key]?.trim())
  return (
    <PopoverShell title={title} onCancel={onCancel} onSubmit={() => canSubmit && onSubmit(values)} canSubmit={canSubmit}>
      {fields.map((f) => (
        <div key={f.key}>
          <label className="block text-xs font-medium text-gray-700 mb-1">{f.label}</label>
          <input
            type="text"
            value={values[f.key] || ''}
            onChange={(e) => setValues({ ...values, [f.key]: e.target.value })}
            placeholder={f.placeholder}
            className="w-full h-9 px-3 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
            autoFocus={f === fields[0]}
          />
        </div>
      ))}
    </PopoverShell>
  )
}

// ─── CTA popover ────────────────────────────────────────────────────────────
function CTAPopover({
  onSubmit, onCancel,
}: {
  onSubmit: (v: { text: string; url: string; color: 'green' | 'purple' }) => void
  onCancel: () => void
}) {
  const [text, setText] = useState('')
  const [url, setUrl] = useState('')
  const [color, setColor] = useState<'green' | 'purple'>('green')
  const canSubmit = !!text.trim() && !!url.trim()
  return (
    <PopoverShell title="Insert CTA button" onCancel={onCancel} onSubmit={() => canSubmit && onSubmit({ text, url, color })} canSubmit={canSubmit}>
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">Button text</label>
        <input
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Confirm your email"
          className="w-full h-9 px-3 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
          autoFocus
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">Link URL</label>
        <input
          type="text"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://… or {{varName}}"
          className="w-full h-9 px-3 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1.5">Color</label>
        <div className="flex items-center gap-3">
          <label className="inline-flex items-center gap-1.5 cursor-pointer">
            <input type="radio" checked={color === 'green'} onChange={() => setColor('green')} className="accent-primary" />
            <span className="inline-flex items-center gap-1.5 text-sm">
              <span className="inline-block w-3 h-3 rounded-sm bg-primary" />
              Green
            </span>
          </label>
          <label className="inline-flex items-center gap-1.5 cursor-pointer">
            <input type="radio" checked={color === 'purple'} onChange={() => setColor('purple')} className="accent-primary-strong" />
            <span className="inline-flex items-center gap-1.5 text-sm">
              <span className="inline-block w-3 h-3 rounded-sm bg-primary-strong" />
              Purple
            </span>
          </label>
        </div>
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1.5">Preview</label>
        <div className="bg-gray-50 border border-gray-200 rounded-md px-4 py-4 flex items-center justify-center">
          <span
            className="inline-flex items-center px-8 py-3 rounded-md text-sm font-semibold text-white shadow-sm"
            style={{ background: color === 'purple' ? '#4B286D' : '#007F4A' }}
          >
            {text.trim() || 'Button text'}
          </span>
        </div>
        <p className="text-xs text-gray-500 mt-1.5">Alignment is controlled by the toolbar align tool after inserting.</p>
      </div>
    </PopoverShell>
  )
}

// ─── Variable popover (for new variable) ────────────────────────────────────
function VariablePopover({
  existing, onSubmit, onCancel,
}: {
  existing: string[]
  onSubmit: (name: string) => void
  onCancel: () => void
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
          <input
            type="text"
            value={varName}
            onChange={(e) => setVarName(e.target.value)}
            placeholder="userName"
            className="flex-1 h-9 px-2 text-sm font-mono border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
            autoFocus
          />
          <span className="text-sm font-mono text-amber-700">{`}}`}</span>
        </div>
        {trimmed && !valid && (
          <p className="text-xs text-red-600 mt-1">Use letters, numbers, dots, and underscores. Must start with a letter.</p>
        )}
        {dup && (
          <p className="text-xs text-amber-700 mt-1">This variable is already in the partial.</p>
        )}
      </div>
    </PopoverShell>
  )
}

// ─── Popover shell ──────────────────────────────────────────────────────────
// Color palettes used by the text-color and highlight pickers.
const TEXT_COLOR_PALETTE = [
  '#111827', // gray-900 (near-black)
  '#6B7280', // gray-500
  '#DC2626', // red
  '#EA580C', // orange
  '#D97706', // amber
  '#16A34A', // green
  '#2563EB', // blue
  '#9333EA', // purple
]
const HIGHLIGHT_PALETTE = [
  'transparent',
  '#FEF3C7', // amber-100
  '#D1FAE5', // green-100
  '#DBEAFE', // blue-100
  '#FCE7F3', // pink-100
  '#F3F4F6', // gray-100
]

// Small dropdown that shows a palette of colored swatches.
// Each swatch click applies the color via execCommand (foreColor / hiliteColor).
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

function PopoverShell({
  title, onCancel, onSubmit, canSubmit, children,
}: {
  title: string
  onCancel: () => void
  onSubmit: () => void
  canSubmit: boolean
  children: React.ReactNode
}) {
  return (
    <>
      <div className="fixed inset-0 z-50 bg-gray-900/30 flex items-center justify-center px-4" onClick={onCancel}>
        <div
          className="w-full max-w-md bg-white rounded-lg shadow-xl border border-gray-200"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
            <button onClick={onCancel} className="text-gray-400 hover:text-gray-600" aria-label="Close">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <div className="px-5 py-4 space-y-3">
            {children}
          </div>
          <div className="px-5 py-3 border-t border-gray-100 bg-gray-50 flex items-center justify-end gap-2 rounded-b-lg">
            <button
              onClick={onCancel}
              className="px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              onClick={onSubmit}
              disabled={!canSubmit}
              className="px-4 py-1.5 text-sm font-medium text-white bg-primary rounded-md hover:bg-primary-hover disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Insert
            </button>
          </div>
        </div>
      </div>
    </>
  )
}
