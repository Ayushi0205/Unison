/**
 * Template access for pages. Backed by the live TEMPLATES collection, which
 * persists to localStorage (see demo-store.ts).
 */
import { TEMPLATES } from './templates'
import { upsert } from './demo-store'
import type { Template } from './types'

export function getAllTemplates(): Template[] {
  return [...TEMPLATES]
}

export function getTemplate(id: string): Template | undefined {
  return TEMPLATES.find((t) => t.id === id)
}

export function saveTemplate(template: Template): void {
  upsert('templates', TEMPLATES, template)
}
