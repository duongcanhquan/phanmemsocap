import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { ExportButtons } from '../../components/ExportButtons'
import { ReportExport } from '../../components/ReportExport'
import { DataTable, FilterBar, SelectFilter } from '../../components/ui/DataSheet'
import { PageHeader } from '../../components/ui/PageHeader'
import { Tabs } from '../../components/ui/Tabs'
import { useAuth } from '../../hooks/useAuth'
import { isSchoolAdmin } from '../../lib/roles'
import { localizedLabel } from '../../lib/localized'
import { isSupabaseConfigured } from '../../lib/supabase'
import { listTeacherRoster, type RosterRow } from '../../lib/teacher'

export function TeacherDashboard() {
  const { t, i18n } = useTranslation()
  const { user, role } = useAuth()
  const [rows, setRows] = useState<RosterRow[]>([])
  const [loading, setLoading] = useState(isSupabaseConfigured)
  const [error, setError] = useState('')
  const [reportProgramId, setReportProgramId] = useState('')
  const [tab, setTab] = useState('roster')
  const [query, setQuery] = useState('')
  const [programFilter, setProgramFilter] = useState('all')
  const [scoreFilter, setScoreFilter] = useState('all')

  useEffect(() => {
    if (!user || !isSupabaseConfigured) return
    let active = true
    void listTeacherRoster(isSchoolAdmin(role) ? undefined : user.id)
      .then((next) => {
        if (active) setRows(next)
      })
      .catch(() => {
        if (active) setError(t('teacher.loadError'))
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [t, user, role])

  const reportPrograms = [...new Map(rows.map((row) => [row.programId, row.programTitle])).entries()].map(
    ([id, title]) => ({ id, title }),
  )
  const activeReportId = reportPrograms.some((program) => program.id === reportProgramId)
    ? reportProgramId
    : (reportPrograms[0]?.id ?? '')
  const visibleRows = rows.filter((row) => {
    const title = localizedLabel(row.programTitle, i18n.language).toLowerCase()
    const matchesQuery = `${row.studentName} ${title}`.toLowerCase().includes(query.trim().toLowerCase())
    const matchesProgram = programFilter === 'all' || row.programId === programFilter
    const matchesScore =
      scoreFilter === 'all' ||
      (scoreFilter === 'scored' && row.averageScore !== null) ||
      (scoreFilter === 'unscored' && row.averageScore === null) ||
      (scoreFilter === 'done' && row.progress >= 100)
    return matchesQuery && matchesProgram && matchesScore
  })

  return (
    <div className="ui-page">
      <PageHeader
        title={t(isSchoolAdmin(role) ? 'teacher.schoolTitle' : 'teacher.dashboardTitle')}
        description={t(isSchoolAdmin(role) ? 'teacher.schoolLead' : 'teacher.dashboardLead')}
        action={
          <Link to="/teacher/grading" className="ui-btn ui-btn-primary">
            {t('teacher.openGrading')}
          </Link>
        }
      />
      {!isSupabaseConfigured ? (
        <p role="status" className="rounded-2xl bg-warning-bg px-4 py-3 text-sm text-warning">
          {t('supabase.missing')}
        </p>
      ) : null}
      {loading ? <p role="status">{t('teacher.loading')}</p> : null}
      {error ? (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : null}
      <Tabs
        label={t('panels.label')}
        value={tab}
        onChange={setTab}
        tabs={[
          { id: 'roster', label: t('panels.roster') },
          { id: 'report', label: t('panels.report') },
        ]}
      />
      <div className="ui-fill">
      {tab === 'roster' ? (
      <>
      {!loading && rows.length === 0 && isSupabaseConfigured ? <p className="text-muted">{t('teacher.emptyRoster')}</p> : null}
      <FilterBar query={query} onQuery={setQuery} count={visibleRows.length}>
        <SelectFilter
          id="roster-program"
          label={t('filters.program')}
          value={programFilter}
          onChange={setProgramFilter}
          options={[{ value: 'all', label: t('filters.all') }, ...reportPrograms.map((program) => ({ value: program.id, label: localizedLabel(program.title, i18n.language) || t('programs.untitled') }))]}
        />
        <SelectFilter
          id="roster-score"
          label={t('filters.score')}
          value={scoreFilter}
          onChange={setScoreFilter}
          options={[
            { value: 'all', label: t('filters.all') },
            { value: 'scored', label: t('filters.hasScore') },
            { value: 'unscored', label: t('filters.noScore') },
            { value: 'done', label: t('filters.done') },
          ]}
        />
      </FilterBar>
      {rows.length > 0 && visibleRows.length === 0 ? <p className="text-muted">{t('filters.noMatch')}</p> : null}
      <div className="mb-3 flex justify-end">
        <ExportButtons
          filename="si-so"
          title={t(isSchoolAdmin(role) ? 'teacher.schoolTitle' : 'teacher.dashboardTitle')}
          headers={[t('teacher.student'), t('teacher.program'), t('teacher.progress'), t('teacher.average')]}
          rows={visibleRows.map((row) => [
            row.studentName || t('enrollment.unnamed'),
            localizedLabel(row.programTitle, i18n.language) || t('programs.untitled'),
            `${row.progress}%`,
            row.averageScore === null ? t('teacher.noScore') : row.averageScore.toFixed(1),
          ])}
        />
      </div>
      <DataTable>
          <thead>
            <tr>
              <th>{t('teacher.student')}</th>
              <th>{t('teacher.program')}</th>
              <th>{t('teacher.progress')}</th>
              <th>{t('teacher.average')}</th>
              <th>{t('teacher.action')}</th>
            </tr>
          </thead>
          <tbody>
            {visibleRows.map((row) => (
              <tr key={`${row.studentId}-${row.programId}`}>
                <td className="font-medium text-ink">{row.studentName || t('enrollment.unnamed')}</td>
                <td>{localizedLabel(row.programTitle, i18n.language) || t('programs.untitled')}</td>
                <td className="tabular-nums">{row.progress}%</td>
                <td className="tabular-nums">{row.averageScore === null ? t('teacher.noScore') : row.averageScore.toFixed(1)}</td>
                <td>
                  <Link to={`/teacher/students/${row.studentId}/${row.programId}`} className="ui-inline ui-btn-ghost">
                    {t('teacher.viewLog')}
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
      </DataTable>
      </>
      ) : null}
      {tab === 'report' && reportPrograms.length > 0 ? (
        <div className="grid gap-3">
          <label className="flex items-center gap-3 text-sm font-medium text-ink" htmlFor="report-program">
            {t('reports.className')}
            <select
              id="report-program"
              className="ui-field min-w-0 flex-1"
              value={activeReportId}
              onChange={(event) => setReportProgramId(event.target.value)}
            >
              {reportPrograms.map((program) => (
                <option key={program.id} value={program.id}>
                  {localizedLabel(program.title, i18n.language) || t('programs.untitled')}
                </option>
              ))}
            </select>
          </label>
          <ReportExport key={activeReportId} programId={activeReportId} />
        </div>
      ) : null}
      </div>
    </div>
  )
}
