import { NavLink } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../../hooks/useAuth'
import { isSchoolAdmin } from '../../lib/roles'
import { navItemsForRole } from './nav'

export function BottomNav() {
  const { t } = useTranslation()
  const { role } = useAuth()

  const items = navItemsForRole(role)

  return (
    <nav
      aria-label={t('nav.label')}
      className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-surface pb-[env(safe-area-inset-bottom)] lg:hidden"
    >
      <ul className="grid" style={{ gridTemplateColumns: `repeat(${Math.max(items.length, 1)}, minmax(0, 1fr))` }}>
        {items.map((item) => {
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
            <li key={item.to}>
              <NavLink
                to={to}
                end={item.end}
                className={({ isActive }) =>
                  [
                    'flex min-h-14 flex-col items-center justify-center gap-1 px-1 py-2 text-center text-xs leading-tight',
                    isActive ? 'font-semibold text-ink' : 'font-medium text-muted',
                  ].join(' ')
                }
              >
                {({ isActive }) => (
                  <>
                    <span
                      aria-hidden="true"
                      className={isActive ? 'h-1 w-6 rounded-full bg-accent' : 'h-1 w-6'}
                    />
                    <Icon aria-hidden="true" className="size-6" strokeWidth={isActive ? 2.4 : 1.8} />
                    <span className="line-clamp-2">{t(labelKey)}</span>
                  </>
                )}
              </NavLink>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
