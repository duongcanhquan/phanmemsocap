import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { PageHeader } from '../../components/ui/PageHeader'
import { localizedLabel } from '../../lib/localized'
import { enrollmentCounts, listPrograms, type ProgramRecord } from '../../lib/programs'
import { isSupabaseConfigured } from '../../lib/supabase'

export function ClassManager() {
  const { t, i18n } = useTranslation()
  const [programs, setPrograms] = useState<ProgramRecord[]>([])
  const [counts, setCounts] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(isSupabaseConfigured)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!isSupabaseConfigured) return
    let active = true
    void Promise.all([listPrograms(), enrollmentCounts()])
      .then(([rows, nextCounts]) => {
        if (!active) return
        setPrograms(rows)
        setCounts(nextCounts)
      })
      .catch(() => {
        if (active) setError(t('programs.loadError'))
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [t])

  return (
    <div className="ui-page">
      <PageHeader title={t('classesPage.title')} description={t('classesPage.lead')} />
      {!isSupabaseConfigured ? (
        <p role="status" className="rounded-2xl bg-warning-bg px-4 py-3 text-sm text-warning">
          {t('supabase.missing')}
        </p>
      ) : null}
      {loading ? <p role="status">{t('programs.loading')}</p> : null}
      {error ? (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : null}
      {!loading && programs.length === 0 && isSupabaseConfigured ? (
        <p className="text-muted">{t('classesPage.empty')}</p>
      ) : null}
      <ul className="grid gap-3">
        {programs.map((program) => {
          const title = localizedLabel(program.title, i18n.language) || t('programs.untitled')
          return (
            <li key={program.id} className="ui-card flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-ink">{title}</h2>
                <p className="text-sm text-muted">
                  {program.category ? `${program.category} · ` : ''}
                  {t('classesPage.students')}: {counts[program.id] ?? 0}
                </p>
              </div>
              <Link to={`/programs/${program.id}#class`} className="ui-btn ui-btn-primary">
                {t('classesPage.manage')}
              </Link>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
