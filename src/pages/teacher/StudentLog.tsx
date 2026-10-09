import { ArrowLeft } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useParams } from 'react-router-dom'
import { PageHeader } from '../../components/ui/PageHeader'
import { localizedLabel } from '../../lib/localized'
import { listStudyLog, type StudyEntry } from '../../lib/teacher'

export function StudentLog() {
  const { t, i18n } = useTranslation()
  const { studentId = '', programId = '' } = useParams()
  const [entries, setEntries] = useState<StudyEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    void listStudyLog(studentId, programId)
      .then((next) => {
        if (active) setEntries(next)
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
  }, [programId, studentId, t])

  return (
    <div className="ui-page">
      <Link to="/teacher" className="ui-btn ui-btn-ghost w-fit px-2">
        <ArrowLeft aria-hidden="true" className="size-4" />
        {t('teacher.back')}
      </Link>
      <PageHeader title={t('teacher.logTitle')} description={t('teacher.logLead')} />
      {loading ? <p role="status">{t('teacher.loading')}</p> : null}
      {error ? (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : null}
      {!loading && entries.length === 0 ? <p className="text-muted">{t('teacher.emptyLog')}</p> : null}
      <ul className="grid gap-3">
        {entries.map((entry) => (
          <li key={entry.id} className="ui-card grid gap-2">
            <p className="font-semibold text-ink">
              {localizedLabel(entry.lessonTitle, i18n.language) || t('programs.untitled')}
            </p>
            <p className="text-sm text-muted">{localizedLabel(entry.question, i18n.language)}</p>
            <p className="text-sm leading-relaxed text-ink">{entry.essayAnswer || t('teacher.noAnswer')}</p>
            <p className="text-sm text-muted">
              {entry.submittedAt ? new Date(entry.submittedAt).toLocaleString(i18n.language) : t('teacher.noScore')}
              {' · '}
              {entry.score === null ? t('teacher.ungraded') : entry.score.toFixed(1)}
            </p>
          </li>
        ))}
      </ul>
    </div>
  )
}
