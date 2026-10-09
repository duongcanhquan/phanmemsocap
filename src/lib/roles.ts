import type { AppRole } from './supabase'

export const roleHome: Record<AppRole, string> = {
  admin: '/',
  teacher: '/teacher',
  student: '/student',
}
