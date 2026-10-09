import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { roleHome } from '../lib/roles'
import type { AppRole } from '../lib/supabase'

interface ProtectedRouteProps {
  allowedRoles: AppRole[]
}

export function ProtectedRoute({ allowedRoles }: ProtectedRouteProps) {
  const { user, role, isLoading } = useAuth()

  if (isLoading) {
    return (
      <p className="px-4 py-6 text-muted" role="status">
        …
      </p>
    )
  }

  if (!user) {
    return <Navigate to="/login" replace />
  }

  if (!role || !allowedRoles.includes(role)) {
    if (role) {
      return <Navigate to={roleHome[role]} replace />
    }
    return <Navigate to="/unauthorized" replace />
  }

  return <Outlet />
}
