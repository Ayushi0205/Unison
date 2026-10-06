import { Outlet } from 'react-router-dom'
import { useCurrentUser } from '../../hooks/useCurrentUser'

export function AdminGuard() {
  const { user } = useCurrentUser()
  if (user.role !== 'admin') {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <svg className="w-16 h-16 text-gray-300 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
        </svg>
        <h2 className="text-lg font-medium text-gray-900 mb-1">Admins only</h2>
        <p className="text-sm text-gray-500 max-w-sm">
          This page is for admins. Switch to an admin role in the top bar to view it.
        </p>
      </div>
    )
  }
  return <Outlet />
}
