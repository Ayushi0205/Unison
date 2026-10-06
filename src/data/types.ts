import type { ContentType, Lifecycle, OwningTeam, PartialSection, Role, TemplateType } from './taxonomy'

export interface Variable {
  name: string
  type: 'string' | 'number' | 'boolean' | 'url'
  required: boolean
  sampleValue?: string
  description?: string
  source?: 'pipeline-supplied' | 'sender-supplied'
  promptLabel?: string
  allowedValues?: string[]
  defaultValue?: string
}

// Block-based email composition (used by editor + preview)
// Each section (header/body/footer) is an ordered list of blocks.
// A block is either user-authored content (rich HTML) or a reference to a partial.
export type EmailBlock =
  | { id: string; type: 'content'; html: string }
  | { id: string; type: 'partial'; partialId: string }

export interface EmailSections {
  header: EmailBlock[]
  body: EmailBlock[]
  footer: EmailBlock[]
}

export interface Template {
  id: string
  name: string
  description?: string
  contentType: ContentType
  templateType: TemplateType
  owningTeam: OwningTeam
  lifecycle: Lifecycle
  programId: string | null
  owner: string
  lastEditedBy?: string
  subject: string
  preHeader?: string
  body: string
  // Block-based composition. Optional for backward compatibility with legacy fixtures.
  // When present, this is the source of truth for rendering. When absent, fall back
  // to `body` (HTML) + `requiredPartialIds` ordered by section.
  sections?: EmailSections
  variables: Variable[]
  tags: string[]
  requiredPartialIds: string[]
  version: number
  createdBy: string
  createdAt: string
  updatedAt: string
  activatedAt?: string
  deactivatedAt?: string
}

export interface Partial {
  id: string
  name: string
  section: PartialSection
  authoringTeam: OwningTeam
  body: string
  lifecycle: 'Active' | 'Inactive'
  owner: string
  lastEditedBy?: string
  version: number
  createdBy: string
  createdAt: string
  updatedAt: string
  usedInCount?: number
}

export interface Project {
  id: string
  name: string
  client: string
  archived?: boolean
}

export interface RequiredPartialRule {
  id: string
  team: OwningTeam | 'ALL'
  templateType: TemplateType
  partialId: string
  programId?: string | null
}

export interface AuditEvent {
  id: string
  entityType: 'template' | 'partial' | 'project'
  entityId: string
  entityName: string
  action: 'created' | 'updated' | 'activated' | 'deactivated' | 'deleted'
  actor: string
  timestamp: string
}

export interface CurrentUser {
  id: string
  name: string
  email: string
  role: Role
  team: OwningTeam
}
