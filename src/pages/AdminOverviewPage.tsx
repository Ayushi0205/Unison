import { Link } from 'react-router-dom'

interface AdminCard {
  title: string
  description: string
  to: string
  icon: React.ReactNode
}

const CARDS: AdminCard[] = [
  {
    title: 'Required partials',
    description: 'Set which partials must be included in each team\'s templates.',
    to: '/admin/required-partials',
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12c0 1.268-.63 2.39-1.593 3.068a3.745 3.745 0 01-1.043 3.296 3.745 3.745 0 01-3.296 1.043A3.745 3.745 0 0112 21c-1.268 0-2.39-.63-3.068-1.593a3.746 3.746 0 01-3.296-1.043 3.745 3.745 0 01-1.043-3.296A3.745 3.745 0 013 12c0-1.268.63-2.39 1.593-3.068a3.745 3.745 0 011.043-3.296 3.746 3.746 0 013.296-1.043A3.746 3.746 0 0112 3c1.268 0 2.39.63 3.068 1.593a3.746 3.746 0 013.296 1.043 3.746 3.746 0 011.043 3.296A3.745 3.745 0 0121 12z" />
      </svg>
    ),
  },
  {
    title: 'Projects',
    description: 'Manage the projects templates and rules belong to.',
    to: '/admin/projects',
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15A2.25 2.25 0 0121.75 12v.75m-8.69-6.44l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z" />
      </svg>
    ),
  },
  {
    title: 'New partial',
    description: 'Create a new reusable block that teams can drop into templates.',
    to: '/admin/partials/new',
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
      </svg>
    ),
  },
]

export function AdminOverviewPage() {
  return (
    <div className="space-y-6">
      <div className="sticky top-0 bg-white z-10 pt-6 pb-2">
        <h1 className="text-2xl font-semibold text-gray-900">Admin</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Set the rules and shared blocks that every team uses to build templates.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {CARDS.map((card) => (
          <Link
            key={card.to}
            to={card.to}
            className="group block p-5 border border-gray-200 rounded-lg bg-white hover:border-primary hover:shadow-sm transition-all"
          >
            <div className="text-primary mb-3 group-hover:scale-105 transition-transform inline-flex">
              {card.icon}
            </div>
            <h3 className="text-base font-medium text-gray-900 mb-1 group-hover:text-primary">
              {card.title}
            </h3>
            <p className="text-sm text-gray-500">{card.description}</p>
          </Link>
        ))}
      </div>
    </div>
  )
}
