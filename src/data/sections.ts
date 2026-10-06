/**
 * Helpers for converting between block-based EmailSections and legacy body+requiredPartialIds.
 * Used by both the editor (load/save) and the detail page (preview rendering).
 */
import { PARTIALS } from './partials'
import { REQUIRED_PARTIAL_RULES } from './required-partial-rules'
import type { EmailBlock, EmailSections, Template } from './types'

let blockIdCounter = 0
export function newBlockId(prefix = 'blk'): string {
  blockIdCounter += 1
  return `${prefix}-${Date.now().toString(36)}-${blockIdCounter}`
}

/**
 * Build sections from a legacy template (or seed an empty new template).
 * For legacy templates: place each partial in its section, body=[content + body partials].
 */
export function sectionsFromTemplate(template: Template | undefined): EmailSections {
  if (template?.sections) return template.sections

  const sections: EmailSections = { header: [], body: [], footer: [] }
  if (!template) {
    sections.body = [{ id: newBlockId('content'), type: 'content', html: '' }]
    return sections
  }

  // Walk requiredPartialIds in order, placing partials in their respective sections
  const bodyPartials: EmailBlock[] = []
  for (const pid of template.requiredPartialIds) {
    const p = PARTIALS.find((x) => x.id === pid)
    if (!p) continue
    const block: EmailBlock = { id: newBlockId('part'), type: 'partial', partialId: pid }
    if (p.section === 'Header') sections.header.push(block)
    else if (p.section === 'Footer') sections.footer.push(block)
    else bodyPartials.push(block)
  }

  // Legacy body becomes one content block in the body section, placed after body partials
  const contentBlock: EmailBlock = { id: newBlockId('content'), type: 'content', html: template.body || '' }
  sections.body = [...bodyPartials, contentBlock]
  return sections
}

/**
 * Derive requiredPartialIds (flat list of partial IDs) from sections.
 * Used for compliance checking and backward compatibility.
 */
export function partialIdsFromSections(sections: EmailSections): string[] {
  const ids: string[] = []
  for (const section of [sections.header, sections.body, sections.footer]) {
    for (const block of section) {
      if (block.type === 'partial') ids.push(block.partialId)
    }
  }
  return ids
}

/**
 * Concatenate all content block HTML in the body section.
 * Used to populate Template.body for variable extraction + legacy display fallbacks.
 */
export function bodyHtmlFromSections(sections: EmailSections): string {
  return sections.body
    .filter((b): b is Extract<EmailBlock, { type: 'content' }> => b.type === 'content')
    .map((b) => b.html)
    .join('\n')
}

/**
 * Render a section to HTML by concatenating content (raw HTML) and partial bodies.
 * `renderContent` lets callers post-process content HTML (e.g., variable substitution).
 */
export function renderSection(
  blocks: EmailBlock[],
  renderContent: (html: string) => string,
): string {
  return blocks
    .map((block) => {
      if (block.type === 'content') return renderContent(block.html)
      const p = PARTIALS.find((x) => x.id === block.partialId)
      return p ? renderContent(p.body) : ''
    })
    .join('')
}

/**
 * Check if a partial ID is governance-required (cannot be removed).
 * Used by editor to disable remove buttons on required partials.
 */
export function isPartialRequired(partialId: string, team: string, templateType: string): boolean {
  return REQUIRED_PARTIAL_RULES.some(
    (r) =>
      r.partialId === partialId &&
      r.templateType === templateType &&
      (r.team === 'ALL' || r.team === team),
  )
}
