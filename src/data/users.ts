import type { CurrentUser } from './types'

export const USERS: CurrentUser[] = [
  {
    id: 'user-admin',
    name: 'Jordan Lee',
    email: 'jordan.lee@meridianworks.example',
    role: 'admin',
    team: 'Platform',
  },
  {
    id: 'user-editor',
    name: 'Sarah Reynolds',
    email: 'sarah.r@meridianworks.example',
    role: 'editor',
    team: 'Sourcing',
  },
  {
    id: 'user-viewer',
    name: 'Marco Flores',
    email: 'marco.f@meridianworks.example',
    role: 'viewer',
    team: 'Payments',
  },
]

export const DEFAULT_USER = USERS[0]
