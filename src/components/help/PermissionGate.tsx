import type { Role } from '../../data/taxonomy'
import { RoleBadge } from './RoleBadge'

const ROLE_LABEL: Record<Role, string> = { admin: 'Admin', editor: 'Editor', viewer: 'Viewer' }

export function PermissionGate({ roles, note }: { roles: Role[]; note?: string }) {
  return (
    <div className="flex items-center flex-wrap gap-2 bg-primary-tint border border-[#cdeadf] border-l-[3px] border-l-primary-strong rounded-lg px-3 py-2.5 text-[12.5px] mb-5">
      <span className="text-primary-strong font-bold tracking-wide">Who can do this</span>
      <span className="text-gray-300">·</span>
      {roles.map((r) => (
        <RoleBadge key={r} label={ROLE_LABEL[r]} />
      ))}
      {note && <span className="text-gray-500">— {note}</span>}
    </div>
  )
}
