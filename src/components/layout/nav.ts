import { BookOpen, ClipboardCheck, GraduationCap, LayoutDashboard, NotebookPen, UserCog, Users, type LucideIcon } from 'lucide-react'
import type { AppRole } from '../../lib/supabase'

export type NavItem = {
  to: string
  labelKey: string
  icon: LucideIcon
  roles: AppRole[]
  end?: boolean
  adminTo?: string
  teacherTo?: string
  teacherLabelKey?: string
  teacherIcon?: LucideIcon
  studentTo?: string
  studentLabelKey?: string
}

export const navItems: NavItem[] = [
  { to: '/', labelKey: 'nav.dashboard', icon: LayoutDashboard, roles: ['superadmin', 'admin', 'teacher', 'student'], end: true, teacherTo: '/teacher' },
  {
    to: '/learners',
    labelKey: 'nav.learners',
    icon: Users,
    roles: ['teacher'],
    teacherTo: '/teacher/grading',
    teacherLabelKey: 'nav.grading',
    teacherIcon: ClipboardCheck,
  },
  {
    to: '/courses',
    labelKey: 'nav.courses',
    icon: BookOpen,
    roles: ['superadmin', 'admin', 'student'],
    adminTo: '/programs',
    studentTo: '/student',
    studentLabelKey: 'nav.learning',
  },
  { to: '/classes', labelKey: 'nav.classes', icon: GraduationCap, roles: ['superadmin', 'admin'] },
  { to: '/accounts', labelKey: 'nav.accounts', icon: UserCog, roles: ['superadmin', 'admin'] },
  { to: '/lessons', labelKey: 'nav.lessons', icon: NotebookPen, roles: ['superadmin', 'admin', 'teacher'] },
]

export function navItemsForRole(role: AppRole | null) {
  if (!role) return []
  return navItems.filter((item) => item.roles.includes(role))
}
