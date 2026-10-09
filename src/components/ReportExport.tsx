import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { localizedLabel } from '../lib/localized'
import { loadScoreReport, type ScoreCell, type ScoreReport } from '../lib/reports'
import { isSupabaseConfigured } from '../lib/supabase'
import { DataTable, FilterBar } from './ui/DataSheet'
import { ExportButtons } from './ExportButtons'

type ReportExportProps = {
  programId: string
  studentIds?: string[]
}

export function ReportExport({ programId, studentIds }: ReportExportProps) {
  const { t, i18n } = useTranslation()
  const [report, setReport] = useState<ScoreReport | null>(null)
  const [loading, setLoading] = useState(isSupabaseConfigured)
  const [error, setError] = useState('')
  const [query, setQuery] = useState('')
  useEffect(() => {
    if (!isSupabaseConfigured) return
    let active = true
    void loadScoreReport(programId)
      .then((next) => {
        if (active) setReport(next)
      })
      .catch(() => {
        if (active) setError(t('reports.loadError'))
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [programId, t])

  const lessonHeaders =
    report?.lessons.map((lesson, index) => localizedLabel(lesson.title, i18n.language) || t('reports.lesson', { n: index + 1 })) ??
    []
  const programName = report ? localizedLabel(report.programTitle, i18n.language) || t('programs.untitled') : ''

  function cellText(score: ScoreCell) {
    return score === null ? t('reports.emptyScore') : score.toFixed(1)
  }

  const allowed = studentIds ? new Set(studentIds) : null
  const students = (report?.students ?? []).filter(
    (student) =>
      (!allowed || allowed.has(student.id)) && (student.name || '').toLowerCase().includes(query.trim().toLowerCase()),
  )
  const exportRows = report
    ? students.map((student) => [
        student.name || t('enrollment.unnamed'),
        ...student.scores.map(cellText),
        cellText(student.average),
      ])
    : []

  return (
    <section className="ui-card grid gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex items-center gap-3">
          <img src="/logo-vietmy-blue.png" alt={t('brand.school')} className="h-20 w-auto" />
          <div>
            <h2 className="text-lg font-semibold text-ink">{t('reports.title')}</h2>
            <p className="text-sm text-muted">{programName || t('reports.lead')}</p>
          </div>
        </div>
        <ExportButtons
          filename={`bang-diem-${programId.slice(0, 8)}`}
          title={t('reports.title')}
          lines={[`${t('reports.className')}: ${programName}`]}
          headers={[t('reports.student'), ...lessonHeaders, t('reports.average')]}
          rows={exportRows}
          disabled={!report}
        />
      </div>
      {!isSupabaseConfigured ? <p className="text-sm text-warning">{t('supabase.missing')}</p> : null}
      {loading ? <p role="status">{t('reports.loading')}</p> : null}
      {error ? (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : null}
      {report && report.students.length === 0 ? <p className="text-sm text-muted">{t('reports.empty')}</p> : null}
      {report && report.students.length > 0 ? (
        <>
        <FilterBar query={query} onQuery={setQuery} count={students.length} />
        {students.length === 0 ? <p className="text-sm text-muted">{t('filters.noMatch')}</p> : null}
        <DataTable>
          <thead>
            <tr>
              <th>{t('reports.student')}</th>
              {report.lessons.map((lesson, index) => (
                <th key={lesson.id}>{lessonHeaders[index]}</th>
              ))}
              <th>{t('reports.average')}</th>
            </tr>
          </thead>
          <tbody>
            {students.map((student) => (
              <tr key={student.id}>
                <td className="font-medium text-ink">{student.name || t('enrollment.unnamed')}</td>
                {student.scores.map((score, index) => (
                  <td key={`${student.id}-${report.lessons[index]?.id ?? index}`} className="tabular-nums">
                    {cellText(score)}
                  </td>
                ))}
                <td className="font-semibold tabular-nums">{cellText(student.average)}</td>
              </tr>
            ))}
          </tbody>
        </DataTable>
        </>
      ) : null}
    </section>
  )
}
