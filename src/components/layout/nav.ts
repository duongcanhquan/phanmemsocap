import { BookOpen, ClipboardCheck, GraduationCap, LayoutDashboard, NotebookPen, Users, type LucideIcon } from 'lucide-react'
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
  { to: '/', labelKey: 'nav.dashboard', icon: LayoutDashboard, roles: ['admin', 'teacher', 'student'], end: true, teacherTo: '/teacher' },
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
    roles: ['admin', 'student'],
    adminTo: '/programs',
    studentTo: '/student',
    studentLabelKey: 'nav.learning',
  },
  { to: '/classes', labelKey: 'nav.classes', icon: GraduationCap, roles: ['admin'] },
  { to: '/lessons', labelKey: 'nav.lessons', icon: NotebookPen, roles: ['admin', 'teacher'] },
]

export function navItemsForRole(role: AppRole | null) {
  if (!role) return []
  return navItems.filter((item) => item.roles.includes(role))
}
