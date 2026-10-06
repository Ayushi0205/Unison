import { createContext, useContext, useState, type ReactNode } from 'react'
import type { CurrentUser } from '../data/types'
import { USERS, DEFAULT_USER } from '../data/users'
import type { Role, OwningTeam } from '../data/taxonomy'

const ROLE_KEY = 'unison.demoRole'

function initialUser(): CurrentUser {
  const stored = localStorage.getItem(ROLE_KEY)
  return USERS.find((u) => u.role === stored) ?? DEFAULT_USER
}

interface UserContextValue {
  user: CurrentUser
  /** True once the visitor has picked a role on the demo entry page. */
  hasEntered: boolean
  setRole: (role: Role) => void
  setTeam: (team: OwningTeam) => void
  allUsers: CurrentUser[]
}

const UserContext = createContext<UserContextValue | null>(null)

export function UserProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<CurrentUser>(initialUser)
  const [hasEntered, setHasEntered] = useState(() => localStorage.getItem(ROLE_KEY) !== null)

  const setRole = (role: Role) => {
    localStorage.setItem(ROLE_KEY, role)
    setHasEntered(true)
    const match = USERS.find((u) => u.role === role)
    if (match) {
      setUser(match)
    } else {
      setUser({ ...user, role })
    }
  }

  const setTeam = (team: OwningTeam) => {
    setUser({ ...user, team })
  }

  return (
    <UserContext.Provider value={{ user, hasEntered, setRole, setTeam, allUsers: USERS }}>
      {children}
    </UserContext.Provider>
  )
}

export function useCurrentUser() {
  const ctx = useContext(UserContext)
  if (!ctx) throw new Error('useCurrentUser must be inside UserProvider')
  return ctx
}
