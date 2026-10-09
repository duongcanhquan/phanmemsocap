import { BookOpen, ClipboardCheck, GraduationCap, LayoutDashboard, Mail, NotebookPen, Sparkles, UserCog, type LucideIcon } from 'lucide-react'
import type { AppRole } from '../../lib/supabase'

export type NavItem = {
  to: string
  labelKey: string
  icon: LucideIcon
  roles: AppRole[]
  end?: boolean
  mobile?: boolean
  adminTo?: string
  teacherTo?: string
  teacherLabelKey?: string
  teacherIcon?: LucideIcon
  studentTo?: string
  studentLabelKey?: string
}

export const navItems: NavItem[] = [
  { to: '/', labelKey: 'nav.dashboard', icon: LayoutDashboard, roles: ['superadmin', 'admin', 'teacher', 'student'], end: true, mobile: true, teacherTo: '/teacher', studentTo: '/student', studentLabelKey: 'student.homeTitle' },
  { to: '/lessons', labelKey: 'nav.lessons', icon: NotebookPen, roles: ['superadmin', 'admin', 'teacher'], mobile: true },
  {
    to: '/teacher',
    labelKey: 'nav.review',
    icon: ClipboardCheck,
    roles: ['superadmin', 'admin'],
    mobile: true,
  },
  {
    to: '/courses',
    labelKey: 'nav.courses',
    icon: BookOpen,
    roles: ['superadmin', 'admin'],
    mobile: true,
    adminTo: '/programs',
  },
  { to: '/student?view=results', labelKey: 'student.results', icon: ClipboardCheck, roles: ['student'], mobile: true },
  { to: '/student?view=messages', labelKey: 'messages.title', icon: Mail, roles: ['student'], mobile: true },
  { to: '/classes', labelKey: 'nav.classes', icon: GraduationCap, roles: ['superadmin', 'admin'] },
  { to: '/accounts', labelKey: 'nav.accounts', icon: UserCog, roles: ['superadmin', 'admin'], mobile: true },
  { to: '/ai', labelKey: 'nav.ai', icon: Sparkles, roles: ['superadmin', 'admin'], mobile: true },
  { to: '/teacher/classes', labelKey: 'nav.myClasses', icon: GraduationCap, roles: ['teacher'], mobile: true },
  { to: '/teacher/grading', labelKey: 'nav.grading', icon: ClipboardCheck, roles: ['teacher'], mobile: true },
]

export function navItemsForRole(role: AppRole | null) {
  if (!role) return []
  return navItems.filter((item) => item.roles.includes(role))
}

export function isNavActive(to: string, pathname: string, search: string, end?: boolean) {
  const [path, query = ''] = to.split('?')
  const targetView = new URLSearchParams(query).get('view')
  const currentView = new URLSearchParams(search).get('view')
  if (path === '/student') {
    if (targetView) return pathname === '/student' && currentView === targetView
    return pathname === '/student' && !currentView
  }
  if (end) return pathname === path
  return pathname === path || pathname.startsWith(`${path}/`)
}
