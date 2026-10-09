import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { ReportExport } from '../../components/ReportExport'
import { PageHeader } from '../../components/ui/PageHeader'
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
      {!loading && rows.length === 0 && isSupabaseConfigured ? <p className="text-muted">{t('teacher.emptyRoster')}</p> : null}
      <div className="overflow-x-auto rounded-2xl border border-white/80 bg-white/75 shadow-[0_12px_40px_rgb(15_23_42/0.06)] backdrop-blur-xl">
        <table className="w-full min-w-[40rem] text-left text-sm">
          <thead className="border-b border-line text-muted">
            <tr>
              <th className="px-4 py-3 font-medium">{t('teacher.student')}</th>
              <th className="px-4 py-3 font-medium">{t('teacher.program')}</th>
              <th className="px-4 py-3 font-medium">{t('teacher.progress')}</th>
              <th className="px-4 py-3 font-medium">{t('teacher.average')}</th>
              <th className="px-4 py-3 font-medium">{t('teacher.action')}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={`${row.studentId}-${row.programId}`} className="border-b border-line last:border-0">
                <td className="px-4 py-3 font-medium text-ink">{row.studentName || t('enrollment.unnamed')}</td>
                <td className="px-4 py-3 text-ink">
                  {localizedLabel(row.programTitle, i18n.language) || t('programs.untitled')}
                </td>
                <td className="px-4 py-3 tabular-nums text-ink">{row.progress}%</td>
                <td className="px-4 py-3 tabular-nums text-ink">
                  {row.averageScore === null ? t('teacher.noScore') : row.averageScore.toFixed(1)}
                </td>
                <td className="px-4 py-3">
                  <Link
                    to={`/teacher/students/${row.studentId}/${row.programId}`}
                    className="ui-btn ui-btn-ghost border border-line"
                  >
                    {t('teacher.viewLog')}
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {reportPrograms.length > 0 ? (
        <div className="grid gap-3">
          <label className="grid max-w-sm gap-1 text-sm font-medium text-ink" htmlFor="report-program">
            {t('reports.className')}
            <select
              id="report-program"
              className="ui-field"
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
  )
}
