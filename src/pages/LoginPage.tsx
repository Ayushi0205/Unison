import { useNavigate } from 'react-router-dom'
import { Eye, PenLine, ShieldCheck, type LucideIcon } from 'lucide-react'
import { UnisonLogo } from '../components/shared/UnisonLogo'
import { useCurrentUser } from '../hooks/useCurrentUser'
import type { Role } from '../data/taxonomy'
import { AUTHOR_NAME, CASE_STUDY_URL } from '../config/portfolio'

const ROLES: { role: Role; title: string; description: string; icon: LucideIcon }[] = [
  {
    role: 'admin',
    title: 'Admin',
    description: 'Set required partials, manage projects, and see every team’s templates.',
    icon: ShieldCheck,
  },
  {
    role: 'editor',
    title: 'Editor',
    description: 'Create and edit templates for your team using shared partials.',
    icon: PenLine,
  },
  {
    role: 'viewer',
    title: 'Viewer',
    description: 'Browse and preview templates without making changes.',
    icon: Eye,
  },
]

/**
 * Demo entry. Visitors pick a role instead of signing in; each role maps to a
 * seeded Meridian Works user.
 */
export function LoginPage() {
  const navigate = useNavigate()
  const { setRole, allUsers } = useCurrentUser()

  const enter = (role: Role) => {
    setRole(role)
    navigate('/')
  }

  return (
    <div className="min-h-screen bg-canvas flex flex-col">
      <header className="px-8 py-5">
        <UnisonLogo height={28} />
      </header>

      <main className="flex-1 flex items-start justify-center px-4 pt-12 pb-16">
        <div className="w-full max-w-2xl">
          <h1 className="text-4xl font-semibold tracking-tight text-ink">
            Many teams. One voice.
          </h1>
          <p className="mt-3 text-base text-gray-600">
            Your contributors don't see your org chart. Sourcing recruits them, Quality reviews their
            work, Payments pays them, and every team writes its own emails. Unison gives every team one
            shared library of templates and partials, so it all sounds like one company.
          </p>

          <h2 className="mt-10 text-sm font-medium text-gray-900">Explore the demo as</h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            {ROLES.map(({ role, title, description, icon: Icon }) => {
              const user = allUsers.find((u) => u.role === role)
              return (
                <button
                  key={role}
                  type="button"
                  onClick={() => enter(role)}
                  className="group text-left bg-white border border-gray-200 rounded-xl p-5 hover:border-primary hover:shadow-sm transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                >
                  <span className="w-9 h-9 rounded-lg bg-primary-tint text-primary-strong inline-flex items-center justify-center">
                    <Icon className="w-5 h-5" aria-hidden="true" />
                  </span>
                  <div className="mt-4 text-base font-semibold text-ink">{title}</div>
                  <p className="mt-1 text-sm text-gray-600">{description}</p>
                  {user && (
                    <div className="mt-4 text-xs text-gray-500">
                      as {user.name} · {user.team}
                    </div>
                  )}
                </button>
              )
            })}
          </div>

          <p className="mt-8 text-sm text-gray-500">
            Meridian Works is a fictional contributor network. All data is sample data, and your changes are saved in this browser only.
          </p>

          <p className="mt-10 pt-6 border-t border-gray-200 text-sm text-gray-600">
            A product by <span className="font-medium text-ink">{AUTHOR_NAME}</span>
            {CASE_STUDY_URL && (
              <>
                {' · '}
                <a href={CASE_STUDY_URL} className="font-medium text-primary hover:underline">
                  Read the case study →
                </a>
              </>
            )}
          </p>
        </div>
      </main>
    </div>
  )
}
