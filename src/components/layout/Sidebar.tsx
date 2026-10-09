import { NavLink } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../../hooks/useAuth'
import { isSchoolAdmin } from '../../lib/roles'
import { navItemsForRole } from './nav'

const linkClass = ({ isActive }: { isActive: boolean }) =>
  [
    'flex min-h-11 items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition-colors duration-200',
    isActive ? 'bg-accent text-white shadow-[0_8px_20px_rgb(3_105_161/0.28)]' : 'text-ink hover:bg-white/45',
  ].join(' ')

export function Sidebar() {
  const { t } = useTranslation()
  const { role } = useAuth()

  return (
    <aside className="ui-chrome hidden h-full overflow-y-auto border-r lg:flex lg:flex-col">
      <div className="px-5 py-5">
        <img src="/logo-vietmy-blue.png" alt={t('brand.school')} className="h-16 w-auto" />
        <p className="mt-3 text-sm leading-snug font-semibold text-ink">{t('brand.school')}</p>
        <p className="mt-1 text-xs text-muted">{t('appName')}</p>
      </div>
      <nav aria-label={t('nav.label')} className="flex flex-1 flex-col gap-1 px-3 pb-6">
        {navItemsForRole(role).map((item) => {
          const to =
            isSchoolAdmin(role) && item.adminTo
              ? item.adminTo
              : role === 'teacher' && item.teacherTo
                ? item.teacherTo
                : role === 'student' && item.studentTo
                  ? item.studentTo
                  : item.to
          const Icon = role === 'teacher' && item.teacherIcon ? item.teacherIcon : item.icon
          const labelKey =
            role === 'teacher' && item.teacherLabelKey
              ? item.teacherLabelKey
              : role === 'student' && item.studentLabelKey
                ? item.studentLabelKey
                : item.labelKey
          return (
            <NavLink key={item.to} to={to} end={item.end} className={linkClass}>
              <Icon aria-hidden="true" className="size-5 shrink-0" />
              <span>{t(labelKey)}</span>
            </NavLink>
          )
        })}
      </nav>
    </aside>
  )
}
