import type { AuditEvent } from './types'

export const AUDIT_EVENTS: AuditEvent[] = [
  { id: 'ae-1', entityType: 'template', entityId: 'tmpl-1', entityName: 'Welcome Email', action: 'created', actor: 'sarah.r@meridianworks.example', timestamp: '2025-01-10T00:00:00Z' },
  { id: 'ae-2', entityType: 'template', entityId: 'tmpl-1', entityName: 'Welcome Email', action: 'activated', actor: 'jordan.lee@meridianworks.example', timestamp: '2025-02-01T00:00:00Z' },
  { id: 'ae-3', entityType: 'template', entityId: 'tmpl-1', entityName: 'Welcome Email', action: 'updated', actor: 'sarah.r@meridianworks.example', timestamp: '2026-04-01T00:00:00Z' },
  { id: 'ae-4', entityType: 'template', entityId: 'tmpl-3', entityName: 'Rejection Notice', action: 'created', actor: 'diego.m@meridianworks.example', timestamp: '2025-01-15T00:00:00Z' },
  { id: 'ae-5', entityType: 'template', entityId: 'tmpl-3', entityName: 'Rejection Notice', action: 'activated', actor: 'diego.m@meridianworks.example', timestamp: '2025-02-01T00:00:00Z' },
  { id: 'ae-6', entityType: 'template', entityId: 'tmpl-6', entityName: 'Quality Alert', action: 'created', actor: 'alex.n@meridianworks.example', timestamp: '2025-01-05T00:00:00Z' },
  { id: 'ae-7', entityType: 'template', entityId: 'tmpl-6', entityName: 'Quality Alert', action: 'activated', actor: 'alex.n@meridianworks.example', timestamp: '2025-01-20T00:00:00Z' },
  { id: 'ae-8', entityType: 'template', entityId: 'tmpl-6', entityName: 'Quality Alert', action: 'updated', actor: 'alex.n@meridianworks.example', timestamp: '2026-04-20T00:00:00Z' },
  { id: 'ae-9', entityType: 'template', entityId: 'tmpl-8', entityName: 'Training Report Q1', action: 'created', actor: 'alex.n@meridianworks.example', timestamp: '2025-01-01T00:00:00Z' },
  { id: 'ae-10', entityType: 'template', entityId: 'tmpl-8', entityName: 'Training Report Q1', action: 'activated', actor: 'alex.n@meridianworks.example', timestamp: '2025-01-15T00:00:00Z' },
  { id: 'ae-11', entityType: 'template', entityId: 'tmpl-8', entityName: 'Training Report Q1', action: 'deactivated', actor: 'jordan.lee@meridianworks.example', timestamp: '2025-12-01T00:00:00Z' },
  { id: 'ae-12', entityType: 'partial', entityId: 'partial-brand-header', entityName: 'Brand Header', action: 'created', actor: 'sarah.r@meridianworks.example', timestamp: '2025-01-01T00:00:00Z' },
  { id: 'ae-13', entityType: 'partial', entityId: 'partial-brand-header', entityName: 'Brand Header', action: 'updated', actor: 'sarah.r@meridianworks.example', timestamp: '2025-03-12T00:00:00Z' },
  { id: 'ae-14', entityType: 'partial', entityId: 'partial-legal-footer', entityName: 'Legal Footer', action: 'created', actor: 'legal.team@meridianworks.example', timestamp: '2025-01-01T00:00:00Z' },
  { id: 'ae-15', entityType: 'partial', entityId: 'partial-legal-footer', entityName: 'Legal Footer', action: 'updated', actor: 'legal.team@meridianworks.example', timestamp: '2026-02-10T00:00:00Z' },
  { id: 'ae-16', entityType: 'partial', entityId: 'partial-old-holiday', entityName: 'Old Holiday Header', action: 'created', actor: 'sarah.r@meridianworks.example', timestamp: '2024-11-01T00:00:00Z' },
  { id: 'ae-17', entityType: 'partial', entityId: 'partial-old-holiday', entityName: 'Old Holiday Header', action: 'deactivated', actor: 'jordan.lee@meridianworks.example', timestamp: '2025-01-15T00:00:00Z' },
  { id: 'ae-18', entityType: 'project', entityId: 'prog-1', entityName: 'Project Gold', action: 'created', actor: 'jordan.lee@meridianworks.example', timestamp: '2025-01-01T00:00:00Z' },
  { id: 'ae-19', entityType: 'project', entityId: 'prog-2', entityName: 'Project Sonic', action: 'created', actor: 'jordan.lee@meridianworks.example', timestamp: '2025-02-01T00:00:00Z' },
  { id: 'ae-20', entityType: 'project', entityId: 'prog-3', entityName: 'Project Atlas', action: 'created', actor: 'jordan.lee@meridianworks.example', timestamp: '2025-03-01T00:00:00Z' },
]
