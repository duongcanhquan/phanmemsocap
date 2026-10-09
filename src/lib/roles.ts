import type { AppRole } from './supabase'

export const roleHome: Record<AppRole, string> = {
  superadmin: '/',
  admin: '/',
  teacher: '/teacher',
  student: '/student',
}

export function isSchoolAdmin(role: AppRole | null) {
  return role === 'superadmin' || role === 'admin'
}
