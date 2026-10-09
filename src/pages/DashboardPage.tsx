import { BookOpen, Clock, GraduationCap, Users } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, Navigate } from 'react-router-dom'
import { Card } from '../components/ui/Card'
import { PageHeader } from '../components/ui/PageHeader'
import { useAuth } from '../hooks/useAuth'
import { localizedLabel } from '../lib/localized'
import { loadSchoolOverview, type SchoolOverview } from '../lib/overview'
import { isSchoolAdmin } from '../lib/roles'
import { isSupabaseConfigured } from '../lib/supabase'

export function DashboardPage() {
  const { t, i18n } = useTranslation()
  const { role } = useAuth()
  const linked = isSchoolAdmin(role)
  const [overview, setOverview] = useState<SchoolOverview | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!linked || !isSupabaseConfigured) return
    let active = true
    void loadSchoolOverview()
      .then((next) => {
        if (active) setOverview(next)
      })
      .catch(() => {
        if (active) setError(t('dashboard.loadError'))
      })
    return () => {
      active = false
    }
  }, [linked, t])

  if (role === 'student') return <Navigate to="/student" replace />
  if (role === 'teacher') return <Navigate to="/teacher" replace />

  const cards = [
    { label: t('dashboard.learners'), value: overview ? String(overview.activeStudents) : t('dashboard.emptyValue'), icon: Users, href: '/accounts' },
    { label: t('dashboard.completion'), value: overview ? `${overview.completionRate}%` : t('dashboard.emptyValue'), icon: GraduationCap, href: '/programs' },
    { label: t('dashboard.inactive', { days: overview?.inactiveDays ?? 7 }), value: overview ? String(overview.inactive.length) : t('dashboard.emptyValue'), icon: Clock, href: '/teacher' },
    { label: t('dashboard.courses'), value: overview ? String(overview.programs) : t('dashboard.emptyValue'), icon: BookOpen, href: '/programs' },
  ]

  return (
    <div className="ui-page">
      <PageHeader title={t('dashboard.title')} description={t('dashboard.subtitle')} />
      {!isSupabaseConfigured ? (
        <p role="status" className="rounded-2xl bg-warning-bg px-4 py-3 text-sm leading-relaxed text-warning">
          {t('supabase.missing')}
        </p>
      ) : null}
      {error ? <p role="alert" className="text-sm text-danger">{error}</p> : null}
      {linked ? <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => {
          const Icon = card.icon
          const body = (
            <Card>
              <div className="flex items-center gap-2 text-sm text-muted">
                <Icon aria-hidden="true" className="size-5 text-accent" />
                <p>{card.label}</p>
              </div>
              <p className="mt-3 text-3xl font-semibold tracking-tight text-ink tabular-nums">{card.value}</p>
            </Card>
          )
          return linked ? (
            <Link key={card.label} to={card.href} className="block">{body}</Link>
          ) : (
            <div key={card.label}>{body}</div>
          )
        })}
      </div> : null}
      {linked ? (
        <section className="ui-card grid gap-3">
          <h2 className="text-lg font-semibold text-ink">{t('dashboard.inactiveTitle', { days: overview?.inactiveDays ?? 7 })}</h2>
          <p className="text-sm text-muted">{t('dashboard.inactiveLead')}</p>
          {overview && overview.inactive.length === 0 ? <p className="text-sm text-muted">{t('dashboard.inactiveEmpty')}</p> : null}
          {overview && overview.inactive.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[36rem] text-left text-sm">
                <thead className="border-b border-line text-muted">
                  <tr>
                    <th className="px-2 py-3 font-medium">{t('dashboard.student')}</th>
                    <th className="px-2 py-3 font-medium">{t('dashboard.program')}</th>
                    <th className="px-2 py-3 font-medium">{t('dashboard.lastSeen')}</th>
                  </tr>
                </thead>
                <tbody>
                  {overview.inactive.map((person) => (
                    <tr key={person.id} className="border-b border-line last:border-0">
                      <td className="px-2 py-3 font-medium text-ink">{person.fullName || t('dashboard.unnamed')}</td>
                      <td className="px-2 py-3 text-ink">{localizedLabel(person.programTitle, i18n.language) || t('dashboard.program')}</td>
                      <td className="px-2 py-3 text-ink">{person.lastSeen ? new Date(person.lastSeen).toLocaleDateString(i18n.language) : t('dashboard.never')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </section>
      ) : null}
      {linked ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <Link to="/teacher" className="ui-card text-base font-semibold text-ink">{t('nav.review')}</Link>
          <Link to="/lessons" className="ui-card text-base font-semibold text-ink">{t('nav.lessons')}</Link>
          <Link to="/accounts" className="ui-card text-base font-semibold text-ink">{t('nav.accounts')}</Link>
          <Link to="/ai" className="ui-card text-base font-semibold text-ink">{t('nav.ai')}</Link>
        </div>
      ) : null}
    </div>
  )
}
