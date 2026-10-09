import { BookOpen, Clock, GraduationCap, UserX, Users } from 'lucide-react'
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
import { isQuiet, loadSchoolOverview, quietSpans, type QuietSpan, type SchoolOverview } from '../lib/overview'
import { isSchoolAdmin } from '../lib/roles'
import { isSupabaseConfigured } from '../lib/supabase'

const statusOrder = ['studying', 'paused', 'dropped', 'withdrawn'] as const

export function DashboardPage() {
  const { t, i18n } = useTranslation()
  const { role } = useAuth()
  const linked = isSchoolAdmin(role)
  const [overview, setOverview] = useState<SchoolOverview | null>(null)
  const [error, setError] = useState('')
  const [tab, setTab] = useState('metrics')
  const [query, setQuery] = useState('')
  const [programFilter, setProgramFilter] = useState('all')
  const [quietDays, setQuietDays] = useState<QuietSpan>(7)

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

  const quietPool = (overview?.inactive ?? []).filter((person) => isQuiet(person, quietDays))
  const quietPrograms = [
    ...new Set(quietPool.map((person) => localizedLabel(person.programTitle, i18n.language) || t('dashboard.program'))),
  ]
  const quiet = quietPool.filter((person) => {
    const program = localizedLabel(person.programTitle, i18n.language) || t('dashboard.program')
    const matchesQuery = `${person.fullName} ${program}`.toLowerCase().includes(query.trim().toLowerCase())
    return matchesQuery && (programFilter === 'all' || program === programFilter)
  })
  const statusMax = Math.max(1, ...statusOrder.map((status) => overview?.statusCounts[status] ?? 0))
  const workMax = Math.max(1, overview?.noQuiz ?? 0, overview?.belowAverage ?? 0, overview?.passed ?? 0, overview?.waiting ?? 0)

  const cards = [
    { label: t('dashboard.learners'), value: overview ? String(overview.activeStudents) : t('dashboard.emptyValue'), icon: Users, href: '/accounts', wash: 'bg-sky-500' },
    { label: t('dashboard.completion'), value: overview ? `${overview.completionRate}%` : t('dashboard.emptyValue'), icon: GraduationCap, href: '/programs', wash: 'bg-teal-500' },
    { label: t('dashboard.passRate'), value: overview ? `${overview.passRate}%` : t('dashboard.emptyValue'), icon: GraduationCap, href: '/teacher', wash: 'bg-emerald-600' },
    { label: t('dashboard.inactive', { days: quietDays }), value: overview ? String(quietPool.length) : t('dashboard.emptyValue'), icon: Clock, href: '/teacher', wash: 'bg-amber-500' },
    { label: t('dashboard.noQuiz'), value: overview ? String(overview.noQuiz) : t('dashboard.emptyValue'), icon: BookOpen, href: '/teacher', wash: 'bg-indigo-500' },
    { label: t('dashboard.left'), value: overview ? String(overview.leftSchool) : t('dashboard.emptyValue'), icon: UserX, href: '/accounts', wash: 'bg-rose-600' },
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
          ]}
        />
      ) : null}
      <div className="ui-fill">
        {linked && tab === 'metrics' ? (
          <div className="grid gap-3">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {cards.map((card) => {
                const Icon = card.icon
                return (
                  <Link key={card.label} to={card.href} className="block">
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
                  </Link>
                )
              })}
            </div>
            <div className="grid gap-3 lg:grid-cols-2">
              <Card>
                <h2 className="text-lg font-semibold text-ink">{t('dashboard.chartStatus')}</h2>
                <div className="mt-4 grid gap-3">
                  {statusOrder.map((status) => (
                    <Meter
                      key={status}
                      label={t(`accounts.study.${status}`)}
                      value={overview?.statusCounts[status] ?? 0}
                      max={statusMax}
                    />
                  ))}
                </div>
              </Card>
              <Card>
                <h2 className="text-lg font-semibold text-ink">{t('dashboard.chartWork')}</h2>
                <p className="mt-1 text-sm text-muted">
                  {t('dashboard.average', {
                    score: overview?.averageScore === null || overview?.averageScore === undefined ? t('dashboard.emptyValue') : overview.averageScore.toFixed(1),
                  })}
                </p>
                <div className="mt-4 grid gap-3">
                  <Meter label={t('dashboard.noQuiz')} value={overview?.noQuiz ?? 0} max={workMax} />
                  <Meter label={t('dashboard.below')} value={overview?.belowAverage ?? 0} max={workMax} />
                  <Meter label={t('dashboard.passed')} value={overview?.passed ?? 0} max={workMax} />
                  <Meter label={t('dashboard.waiting')} value={overview?.waiting ?? 0} max={workMax} />
                </div>
                <p className="mt-4 text-sm text-muted">
                  {t('dashboard.summary', {
                    courses: overview?.programs ?? 0,
                    classes: overview?.classes ?? 0,
                    paused: overview?.paused ?? 0,
                    completion: overview?.completionRate ?? 0,
                    pass: overview?.passRate ?? 0,
                  })}
                </p>
              </Card>
            </div>
          </div>
        ) : null}
        {linked && tab === 'inactive' ? (
          <section className="grid gap-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="truncate text-lg font-semibold text-ink">{t('dashboard.inactiveTitle', { days: quietDays })}</h2>
              <ExportButtons
                filename="hoc-vien-khong-hoat-dong"
                title={t('dashboard.inactiveTitle', { days: quietDays })}
                headers={[t('dashboard.student'), t('dashboard.program'), t('dashboard.lastSeen')]}
                rows={quiet.map((person) => [
                  person.fullName || t('dashboard.unnamed'),
                  localizedLabel(person.programTitle, i18n.language) || t('dashboard.program'),
                  person.lastSeen ? new Date(person.lastSeen).toLocaleDateString(i18n.language) : t('dashboard.never'),
                ])}
              />
            </div>
            <p className="text-sm text-muted">{t('dashboard.inactiveLead')}</p>
            <FilterBar query={query} onQuery={setQuery} count={quiet.length}>
              <SelectFilter
                id="quiet-days"
                label={t('dashboard.quietSpan')}
                value={String(quietDays)}
                onChange={(value) => setQuietDays(Number(value) as QuietSpan)}
                options={quietSpans.map((days) => ({ value: String(days), label: t(`dashboard.spans.${days}`) }))}
              />
              <SelectFilter
                id="quiet-program"
                label={t('filters.program')}
                value={programFilter}
                onChange={setProgramFilter}
                options={[{ value: 'all', label: t('filters.all') }, ...quietPrograms.map((title) => ({ value: title, label: title }))]}
              />
            </FilterBar>
            {overview && quiet.length === 0 ? <p className="text-sm text-muted">{t('dashboard.inactiveEmpty')}</p> : null}
            {quiet.length > 0 ? (
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
                      <td className="font-medium text-ink">
                        <Link to={`/students/${person.id}`} className="underline-offset-2 hover:underline">
                          {person.fullName || t('dashboard.unnamed')}
                        </Link>
                      </td>
                      <td>{localizedLabel(person.programTitle, i18n.language) || t('dashboard.program')}</td>
                      <td>{person.lastSeen ? new Date(person.lastSeen).toLocaleDateString(i18n.language) : t('dashboard.never')}</td>
                    </tr>
                  ))}
                </tbody>
              </DataTable>
            ) : null}
          </section>
        ) : null}
      </div>
    </div>
  )
}

function Meter({ label, value, max }: { label: string; value: number; max: number }) {
  const width = Math.round((value / max) * 100)
  return (
    <div className="grid gap-1">
      <div className="flex items-center justify-between gap-3 text-sm">
        <span className="font-medium text-ink">{label}</span>
        <span className="tabular-nums text-muted">{value}</span>
      </div>
      <div className="h-2 rounded-full bg-canvas" role="img" aria-label={`${label}: ${value}`}>
        <div className="h-2 rounded-full bg-accent" style={{ width: `${width}%` }} />
      </div>
    </div>
  )
}
