import { ArrowLeft } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useParams } from 'react-router-dom'
import { ExportButtons } from '../../components/ExportButtons'
import { DataTable, FilterBar, SelectFilter } from '../../components/ui/DataSheet'
import { PageHeader } from '../../components/ui/PageHeader'
import { localizedLabel } from '../../lib/localized'
import { loadStudentTranscript, type StudentTranscript } from '../../lib/reports'
import { listStudyLog, type StudyEntry } from '../../lib/teacher'

export function StudentLog() {
  const { t, i18n } = useTranslation()
  const { studentId = '', programId = '' } = useParams()
  const [entries, setEntries] = useState<StudyEntry[]>([])
  const [transcript, setTranscript] = useState<StudentTranscript | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [query, setQuery] = useState('')
  const [scoreFilter, setScoreFilter] = useState('all')

  useEffect(() => {
    let active = true
    void Promise.all([listStudyLog(studentId, programId), loadStudentTranscript(studentId, programId)])
      .then(([next, report]) => {
        if (!active) return
        setEntries(next)
        setTranscript(report)
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

  const visible = entries.filter((entry) => {
    const lesson = localizedLabel(entry.lessonTitle, i18n.language)
    const question = localizedLabel(entry.question, i18n.language)
    const matchesQuery = `${lesson} ${question} ${entry.essayAnswer}`.toLowerCase().includes(query.trim().toLowerCase())
    const matchesScore =
      scoreFilter === 'all' || (scoreFilter === 'scored' ? entry.score !== null : entry.score === null)
    return matchesQuery && matchesScore
  })

  return (
    <div className="ui-page">
      <Link to="/teacher" className="ui-btn ui-btn-ghost w-fit px-2">
        <ArrowLeft aria-hidden="true" className="size-4" />
        {t('teacher.back')}
      </Link>
      <PageHeader
        title={transcript?.fullName || t('transcript.title')}
        description={t('transcript.lead')}
        action={
          transcript ? (
            <ExportButtons
              filename={`bao-cao-${transcript.fullName || studentId.slice(0, 8)}`}
              title={t('transcript.title')}
              lines={[
                `${t('accounts.name')}: ${transcript.fullName || t('enrollment.unnamed')}`,
                `${t('accounts.dateOfBirth')}: ${transcript.dateOfBirth || '—'}`,
                `${t('accounts.phone')}: ${transcript.phone || '—'}`,
                `${t('accounts.nationalId')}: ${transcript.nationalId || '—'}`,
                `${t('accounts.passport')}: ${transcript.passport || '—'}`,
                `${t('dashboard.program')}: ${localizedLabel(transcript.programTitle, i18n.language) || t('programs.untitled')}`,
                `${t('transcript.summary')}: ${transcript.average === null ? t('teacher.noScore') : transcript.average.toFixed(1)}`,
              ]}
              headers={[t('transcript.lesson'), t('transcript.score'), t('transcript.comment')]}
              rows={transcript.lessons.map((lesson) => [
                localizedLabel(lesson.title, i18n.language) || t('programs.untitled'),
                lesson.score === null ? t('reports.emptyScore') : lesson.score.toFixed(1),
                lesson.comment || t('transcript.noComment'),
              ])}
            />
          ) : null
        }
      />
      {transcript ? (
        <section className="ui-card grid gap-4">
          <div className="flex items-center gap-4">
            <img src="/logo-vietmy-blue.png" alt={t('brand.school')} className="h-24 w-auto" />
            <div>
              <p className="text-sm font-semibold text-accent">{t('brand.school')}</p>
              <h2 className="text-xl font-semibold text-ink">{t('transcript.title')}</h2>
            </div>
          </div>
          <dl className="grid gap-2 text-sm sm:grid-cols-2 xl:grid-cols-3">
            <Fact label={t('accounts.name')} value={transcript.fullName || t('enrollment.unnamed')} />
            <Fact label={t('accounts.dateOfBirth')} value={transcript.dateOfBirth || '—'} />
            <Fact label={t('accounts.phone')} value={transcript.phone || '—'} />
            <Fact label={t('accounts.nationalId')} value={transcript.nationalId || '—'} />
            <Fact label={t('accounts.passport')} value={transcript.passport || '—'} />
            <Fact label={t('dashboard.program')} value={localizedLabel(transcript.programTitle, i18n.language) || t('programs.untitled')} />
          </dl>
          <DataTable>
            <thead>
              <tr>
                <th>{t('transcript.lesson')}</th>
                <th>{t('transcript.score')}</th>
                <th>{t('transcript.comment')}</th>
              </tr>
            </thead>
            <tbody>
              {transcript.lessons.map((lesson) => (
                <tr key={localizedLabel(lesson.title, i18n.language)}>
                  <td className="font-medium text-ink">{localizedLabel(lesson.title, i18n.language) || t('programs.untitled')}</td>
                  <td className="tabular-nums">{lesson.score === null ? t('reports.emptyScore') : lesson.score.toFixed(1)}</td>
                  <td className="wrap">{lesson.comment || t('transcript.noComment')}</td>
                </tr>
              ))}
              <tr>
                <td className="font-semibold text-ink">{t('transcript.summary')}</td>
                <td className="font-semibold tabular-nums">{transcript.average === null ? t('teacher.noScore') : transcript.average.toFixed(1)}</td>
                <td />
              </tr>
            </tbody>
          </DataTable>
        </section>
      ) : null}
      {loading ? <p role="status">{t('teacher.loading')}</p> : null}
      {error ? (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : null}
      {!loading && entries.length === 0 ? <p className="text-muted">{t('teacher.emptyLog')}</p> : null}
      <div className="ui-fill">
        <FilterBar query={query} onQuery={setQuery} count={visible.length}>
          <SelectFilter
            id="log-score"
            label={t('filters.score')}
            value={scoreFilter}
            onChange={setScoreFilter}
            options={[
              { value: 'all', label: t('filters.all') },
              { value: 'scored', label: t('filters.hasScore') },
              { value: 'unscored', label: t('filters.noScore') },
            ]}
          />
        </FilterBar>
        {entries.length > 0 && visible.length === 0 ? <p className="text-muted">{t('filters.noMatch')}</p> : null}
        <DataTable>
          <thead>
            <tr>
              <th>{t('programs.lessons')}</th>
              <th>{t('teacher.question')}</th>
              <th>{t('teacher.answer')}</th>
              <th>{t('filters.submitted')}</th>
              <th>{t('teacher.score')}</th>
              <th>{t('transcript.comment')}</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((entry) => (
              <tr key={entry.id}>
                <td className="font-medium text-ink">{localizedLabel(entry.lessonTitle, i18n.language) || t('programs.untitled')}</td>
                <td className="max-w-xs truncate">{localizedLabel(entry.question, i18n.language)}</td>
                <td className="max-w-sm truncate">{entry.essayAnswer || t('teacher.noAnswer')}</td>
                <td>{entry.submittedAt ? new Date(entry.submittedAt).toLocaleString(i18n.language) : '—'}</td>
                <td className="tabular-nums">{entry.score === null ? t('teacher.ungraded') : entry.score.toFixed(1)}</td>
                <td className="wrap">{entry.feedback || t('transcript.noComment')}</td>
              </tr>
            ))}
          </tbody>
        </DataTable>
      </div>
    </div>
  )
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-sky-200/80 bg-white/40 px-3 py-2">
      <dt className="text-muted">{label}</dt>
      <dd className="font-medium text-ink">{value}</dd>
    </div>
  )
}
