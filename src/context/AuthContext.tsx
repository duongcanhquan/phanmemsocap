import type { Session, User } from '@supabase/supabase-js'
import { createContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { fetchProfileRole, isSupabaseConfigured, supabase, type AppRole } from '../lib/supabase'

interface AuthContextValue {
  session: Session | null
  user: User | null
  role: AppRole | null
  isLoading: boolean
  login: (email: string, password: string) => Promise<AppRole | null>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

interface AuthProviderProps {
  children: ReactNode
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [session, setSession] = useState<Session | null>(null)
  const [user, setUser] = useState<User | null>(null)
  const [role, setRole] = useState<AppRole | null>(null)
  const [isLoading, setIsLoading] = useState(isSupabaseConfigured)
  const roleRequest = useRef(0)

  useEffect(() => {
    if (!supabase) {
      return
    }

    const client = supabase

    function applySession(nextSession: Session | null) {
      setSession(nextSession)
      setUser(nextSession?.user ?? null)

      if (!nextSession?.user) {
        roleRequest.current += 1
        setRole(null)
        setIsLoading(false)
        return
      }

      const userId = nextSession.user.id
      const accessToken = nextSession.access_token
      const requestId = roleRequest.current + 1
      roleRequest.current = requestId
      setIsLoading(true)
      window.setTimeout(() => {
        void fetchProfileRole(userId, accessToken).then((nextRole) => {
          if (roleRequest.current !== requestId) {
            return
          }
          setRole(nextRole)
          setIsLoading(false)
        })
      }, 0)
    }

    const { data } = client.auth.onAuthStateChange((_event, nextSession) => {
      applySession(nextSession)
    })

    return () => {
      data.subscription.unsubscribe()
    }
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      user,
      role,
      isLoading,
      async login(email, password) {
        if (!supabase) {
          throw new Error('missing-supabase')
        }
        const { data, error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) {
          throw error
        }
        const requestId = roleRequest.current + 1
        roleRequest.current = requestId
        const nextRole = data.user ? await fetchProfileRole(data.user.id, data.session?.access_token) : null
        if (roleRequest.current === requestId) {
          setRole(nextRole)
          setIsLoading(false)
        }
        return nextRole
      },
      async logout() {
        if (!supabase) {
          return
        }
        const { error } = await supabase.auth.signOut()
        if (error) {
          throw error
        }
      },
    }),
    [session, user, role, isLoading],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export { AuthContext }
