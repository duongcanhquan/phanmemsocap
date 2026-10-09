import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useParams } from 'react-router-dom'
import { MessageThread } from '../../components/messages/MessageThread'
import { DataTable } from '../../components/ui/DataSheet'
import { PageHeader } from '../../components/ui/PageHeader'
import { localizedLabel } from '../../lib/localized'
import { loadStudentFile, type StudentFile } from '../../lib/studentFile'

export function StudentFilePage() {
  const { t, i18n } = useTranslation()
  const { studentId = '' } = useParams()
  const [file, setFile] = useState<StudentFile | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    setLoading(true)
    setError('')
    setFile(null)
    void loadStudentFile(studentId)
      .then((next) => {
        if (!active) return
        setFile(next)
        if (!next) setError(t('studentFile.missing'))
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
  }, [studentId, t])

  return (
    <div className="ui-page">
      <PageHeader title={file?.fullName || t('studentFile.title')} back={{ to: '/teacher', label: t('teacher.back') }} />
      {loading ? <p className="text-muted">{t('accounts.loading')}</p> : null}
      {error ? <p className="text-danger">{error}</p> : null}
      {file ? (
        <>
          <section className="ui-card">
            <dl className="grid gap-3 text-sm sm:grid-cols-2 xl:grid-cols-3">
              <Fact label={t('accounts.studyStatus')} value={t(`accounts.study.${file.studyStatus}`)} />
              <Fact label={t('accounts.nationality')} value={file.nationality || '—'} />
              <Fact label={t('accounts.dateOfBirth')} value={file.dateOfBirth || '—'} />
              <Fact label={t('accounts.phone')} value={file.phone || '—'} />
              <Fact label={t('accounts.nationalId')} value={file.nationalId || '—'} />
              <Fact label={t('accounts.passport')} value={file.passport || '—'} />
            </dl>
          </section>
          <MessageThread studentId={studentId} />
          {file.placements.length === 0 ? <p className="text-muted">{t('studentFile.none')}</p> : null}
          {file.placements.map((place, index) => (
            <section key={`${place.programId}-${place.className}-${index}`} className="ui-card grid gap-4">
              <div className="grid gap-3 text-sm sm:grid-cols-2 xl:grid-cols-3">
                <Fact label={t('reports.className')} value={place.className || t('studentFile.noClass')} />
                <Fact label={t('dashboard.program')} value={localizedLabel(place.programTitle, i18n.language) || t('studentFile.noCourse')} />
                <Fact
                  label={t('studentFile.current')}
                  value={
                    place.total === 0
                      ? '—'
                      : place.currentIndex
                        ? t('studentFile.lessonAt', {
                            n: place.currentIndex,
                            total: place.total,
                            title: localizedLabel(place.currentTitle, i18n.language),
                          })
                        : t('studentFile.finished')
                  }
                />
                <Fact label={t('teacher.progress')} value={t('studentFile.rate', { done: place.done, total: place.total, percent: place.percent })} />
                <Fact label={t('transcript.summary')} value={place.average === null ? t('teacher.noScore') : place.average.toFixed(1)} />
              </div>
              {place.programId ? (
                <Link to={`/teacher/students/${studentId}/${place.programId}`} className="ui-inline ui-btn-ghost w-fit">
                  {t('studentFile.history')}
                </Link>
              ) : null}
              {place.lessons.length > 0 ? (
                <DataTable>
                  <thead>
                    <tr>
                      <th className="px-3 py-3 font-medium">{t('transcript.lesson')}</th>
                      <th className="px-3 py-3 font-medium">{t('transcript.score')}</th>
                      <th className="px-3 py-3 font-medium">{t('transcript.comment')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {place.lessons.map((lesson, lessonIndex) => (
                      <tr key={`${lessonIndex}-${localizedLabel(lesson.title, i18n.language)}`}>
                        <td className="px-3 py-2 text-ink">{localizedLabel(lesson.title, i18n.language) || t('programs.untitled')}</td>
                        <td className="px-3 py-2 text-ink">{lesson.score === null ? t('reports.emptyScore') : lesson.score.toFixed(1)}</td>
                        <td className="px-3 py-2 text-ink">{lesson.comment || t('transcript.noComment')}</td>
                      </tr>
                    ))}
                  </tbody>
                </DataTable>
              ) : null}
            </section>
          ))}
        </>
      ) : null}
    </div>
  )
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-muted">{label}</dt>
      <dd className="font-medium text-ink">{value}</dd>
    </div>
  )
}
