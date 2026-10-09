import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { ExportButtons } from '../../components/ExportButtons'
import { DataTable, FilterBar, SelectFilter } from '../../components/ui/DataSheet'
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
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('all')

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

  const categories = [...new Set(programs.map((program) => program.category).filter(Boolean))]
  const visible = programs.filter((program) => {
    const title = localizedLabel(program.title, i18n.language).toLowerCase()
    const matchesQuery = `${title} ${program.category}`.toLowerCase().includes(query.trim().toLowerCase())
    return matchesQuery && (category === 'all' || program.category === category)
  })

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
      <div className="ui-fill">
        <FilterBar query={query} onQuery={setQuery} count={visible.length}>
          <SelectFilter
            id="class-category"
            label={t('filters.category')}
            value={category}
            onChange={setCategory}
            options={[{ value: 'all', label: t('filters.all') }, ...categories.map((item) => ({ value: item, label: item }))]}
          />
        </FilterBar>
        {programs.length > 0 && visible.length === 0 ? <p className="text-muted">{t('filters.noMatch')}</p> : null}
        <div className="mb-3 flex justify-end">
          <ExportButtons
            filename="lop-hoc"
            title={t('classesPage.title')}
            headers={[t('programs.name'), t('programs.category'), t('filters.status'), t('classesPage.students')]}
            rows={visible.map((program) => [
              localizedLabel(program.title, i18n.language) || t('programs.untitled'),
              program.category || '—',
              program.isActive ? t('programs.active') : t('programs.inactive'),
              counts[program.id] ?? 0,
            ])}
          />
        </div>
        <DataTable>
          <thead>
            <tr>
              <th>{t('programs.name')}</th>
              <th>{t('programs.category')}</th>
              <th>{t('filters.status')}</th>
              <th>{t('classesPage.students')}</th>
              <th>{t('teacher.action')}</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((program) => {
              const title = localizedLabel(program.title, i18n.language) || t('programs.untitled')
              return (
                <tr key={program.id}>
                  <td className="font-semibold text-ink">{title}</td>
                  <td>{program.category || '—'}</td>
                  <td>{program.isActive ? t('programs.active') : t('programs.inactive')}</td>
                  <td className="tabular-nums">{counts[program.id] ?? 0}</td>
                  <td>
                    <Link to={`/programs/${program.id}#class`} className="ui-inline ui-btn-primary">
                      {t('classesPage.manage')}
                    </Link>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </DataTable>
      </div>
    </div>
  )
}
