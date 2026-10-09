import { BookOpen, Clock, GraduationCap, Users } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, Navigate } from 'react-router-dom'
import { Card } from '../components/ui/Card'
import { ExportButtons } from '../components/ExportButtons'
import { DataTable, FilterBar, SelectFilter } from '../components/ui/DataSheet'
import { PageHeader } from '../components/ui/PageHeader'
import { Tabs } from '../components/ui/Tabs'
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
  const [tab, setTab] = useState('metrics')
  const [query, setQuery] = useState('')
  const [programFilter, setProgramFilter] = useState('all')

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

  const quietPrograms = [
    ...new Set(
      (overview?.inactive ?? []).map((person) => localizedLabel(person.programTitle, i18n.language) || t('dashboard.program')),
    ),
  ]
  const quiet = (overview?.inactive ?? []).filter((person) => {
    const program = localizedLabel(person.programTitle, i18n.language) || t('dashboard.program')
    const matchesQuery = `${person.fullName} ${program}`.toLowerCase().includes(query.trim().toLowerCase())
    return matchesQuery && (programFilter === 'all' || program === programFilter)
  })

  const cards = [
    { label: t('dashboard.learners'), value: overview ? String(overview.activeStudents) : t('dashboard.emptyValue'), icon: Users, href: '/accounts', wash: 'bg-sky-500' },
    { label: t('dashboard.completion'), value: overview ? `${overview.completionRate}%` : t('dashboard.emptyValue'), icon: GraduationCap, href: '/programs', wash: 'bg-teal-500' },
    { label: t('dashboard.inactive', { days: overview?.inactiveDays ?? 7 }), value: overview ? String(overview.inactive.length) : t('dashboard.emptyValue'), icon: Clock, href: '/teacher', wash: 'bg-amber-500' },
    { label: t('dashboard.courses'), value: overview ? String(overview.programs) : t('dashboard.emptyValue'), icon: BookOpen, href: '/programs', wash: 'bg-indigo-500' },
  ]

  return (
    <div className="ui-page">
      <PageHeader title={t('dashboard.title')} />
      {!isSupabaseConfigured ? (
        <p role="status" className="rounded-2xl bg-warning-bg px-4 py-3 text-sm leading-relaxed text-warning">
          {t('supabase.missing')}
        </p>
      ) : null}
      {error ? <p role="alert" className="text-sm text-danger">{error}</p> : null}
      {linked ? (
        <Tabs
          label={t('panels.label')}
          value={tab}
          onChange={setTab}
          tabs={[
            { id: 'metrics', label: t('panels.metrics') },
            { id: 'inactive', label: t('panels.inactive') },
            { id: 'shortcuts', label: t('panels.shortcuts') },
          ]}
        />
      ) : null}
      <div className="ui-fill">
      {linked && tab === 'metrics' ? <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => {
          const Icon = card.icon
          const body = (
            <Card className="overflow-hidden">
              <span aria-hidden="true" className={`mb-4 block h-1.5 w-16 rounded-full ${card.wash}`} />
              <div className="flex items-center gap-2 text-sm text-muted">
                <span className={`inline-flex size-9 items-center justify-center rounded-xl text-white ${card.wash}`}>
                  <Icon aria-hidden="true" className="size-5" />
                </span>
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
      {linked && tab === 'inactive' ? (
        <section className="grid gap-3">
          <div className="flex items-center justify-between gap-3">
            <h2 className="truncate text-lg font-semibold text-ink">{t('dashboard.inactiveTitle', { days: overview?.inactiveDays ?? 7 })}</h2>
            {overview && overview.inactive.length > 0 ? (
              <ExportButtons
                filename="hoc-vien-im"
                title={t('dashboard.inactiveTitle', { days: overview?.inactiveDays ?? 7 })}
                headers={[t('dashboard.student'), t('dashboard.program'), t('dashboard.lastSeen')]}
                rows={quiet.map((person) => [
                  person.fullName || t('dashboard.unnamed'),
                  localizedLabel(person.programTitle, i18n.language) || t('dashboard.program'),
                  person.lastSeen ? new Date(person.lastSeen).toLocaleDateString(i18n.language) : t('dashboard.never'),
                ])}
              />
            ) : null}
          </div>
          {overview && overview.inactive.length === 0 ? <p className="text-sm text-muted">{t('dashboard.inactiveEmpty')}</p> : null}
          {overview && overview.inactive.length > 0 ? (
            <>
              <FilterBar query={query} onQuery={setQuery} count={quiet.length}>
                <SelectFilter
                  id="quiet-program"
                  label={t('filters.program')}
                  value={programFilter}
                  onChange={setProgramFilter}
                  options={[{ value: 'all', label: t('filters.all') }, ...quietPrograms.map((title) => ({ value: title, label: title }))]}
                />
              </FilterBar>
              {quiet.length === 0 ? <p className="text-muted">{t('filters.noMatch')}</p> : null}
              <DataTable>
                <thead>
                  <tr>
                    <th>{t('dashboard.student')}</th>
                    <th>{t('dashboard.program')}</th>
                    <th>{t('dashboard.lastSeen')}</th>
                  </tr>
                </thead>
                <tbody>
                  {quiet.map((person) => (
                    <tr key={`${person.id}-${localizedLabel(person.programTitle, i18n.language)}`}>
                      <td className="font-medium text-ink">{person.fullName || t('dashboard.unnamed')}</td>
                      <td>{localizedLabel(person.programTitle, i18n.language) || t('dashboard.program')}</td>
                      <td>{person.lastSeen ? new Date(person.lastSeen).toLocaleDateString(i18n.language) : t('dashboard.never')}</td>
                    </tr>
                  ))}
                </tbody>
              </DataTable>
            </>
          ) : null}
        </section>
      ) : null}
      {linked && tab === 'shortcuts' ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Link to="/teacher" className="ui-card text-base font-semibold text-ink">{t('nav.review')}</Link>
          <Link to="/lessons" className="ui-card text-base font-semibold text-ink">{t('nav.lessons')}</Link>
          <Link to="/accounts" className="ui-card text-base font-semibold text-ink">{t('nav.accounts')}</Link>
          <Link to="/ai" className="ui-card text-base font-semibold text-ink">{t('nav.ai')}</Link>
        </div>
      ) : null}
      </div>
    </div>
  )
}
