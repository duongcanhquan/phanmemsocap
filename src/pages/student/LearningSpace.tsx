import { ArrowLeft, Lock } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useParams } from 'react-router-dom'
import { PageHeader } from '../../components/ui/PageHeader'
import { localizedLabel } from '../../lib/localized'
import { isSupabaseConfigured } from '../../lib/supabase'
import { listEnrolledPrograms, listLessonPath, type EnrolledProgram, type LessonPathItem } from '../../lib/student'
import { LessonViewer } from './LessonViewer'

export function LearningSpace() {
  const { programId, lessonId } = useParams()
  if (programId && lessonId) return <LessonViewer programId={programId} lessonId={lessonId} />
  if (programId) return <LessonTimeline programId={programId} />
  return <ProgramList />
}

function ProgramList() {
  const { t, i18n } = useTranslation()
  const [programs, setPrograms] = useState<EnrolledProgram[]>([])
  const [loading, setLoading] = useState(isSupabaseConfigured)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!isSupabaseConfigured) return
    let active = true
    void listEnrolledPrograms()
      .then((rows) => {
        if (active) setPrograms(rows)
      })
      .catch(() => {
        if (active) setError(t('student.loadError'))
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
      <PageHeader title={t('student.homeTitle')} description={t('student.homeLead')} />
      {!isSupabaseConfigured ? (
        <p role="status" className="rounded-2xl bg-warning-bg px-4 py-3 text-sm text-warning">
          {t('supabase.missing')}
        </p>
      ) : null}
      {loading ? <p role="status">{t('student.loading')}</p> : null}
      {error ? (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : null}
      {!loading && programs.length === 0 && isSupabaseConfigured ? <p className="text-muted">{t('student.emptyPrograms')}</p> : null}
      <div className="ui-fill grid content-start gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {programs.map((program) => (
          <Link key={program.id} to={`/student/${program.id}`} className="ui-card grid gap-3">
            {program.coverImageUrl ? (
              <img src={program.coverImageUrl} alt="" className="aspect-video w-full rounded-xl object-cover" />
            ) : (
              <div className="aspect-video w-full rounded-xl bg-canvas" />
            )}
            <h2 className="text-lg font-semibold">{localizedLabel(program.title, i18n.language) || t('programs.untitled')}</h2>
            {program.category ? <p className="text-sm text-muted">{program.category}</p> : null}
          </Link>
        ))}
      </div>
    </div>
  )
}

function LessonTimeline({ programId }: { programId: string }) {
  const { t, i18n } = useTranslation()
  const [lessons, setLessons] = useState<LessonPathItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    void listLessonPath(programId)
      .then((rows) => {
        if (active) setLessons(rows)
      })
      .catch(() => {
        if (active) setError(t('student.loadError'))
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [programId, t])

  return (
    <div className="ui-page">
      <Link to="/student" className="ui-btn ui-btn-ghost w-fit px-2">
        <ArrowLeft aria-hidden="true" className="size-4" />
        {t('student.backPrograms')}
      </Link>
      <PageHeader title={t('student.pathTitle')} description={t('student.pathLead')} />
      {loading ? <p role="status">{t('student.loading')}</p> : null}
      {error ? (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : null}
      <ol className="ui-fill grid content-start gap-2">
        {lessons.map((lesson, index) => {
          const title = localizedLabel(lesson.title, i18n.language) || t('programs.untitled')
          const body = (
            <>
              <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-canvas text-sm font-semibold">
                {lesson.locked ? <Lock aria-hidden="true" className="size-4" /> : index + 1}
              </span>
              <span className="min-w-0">
                <span className="block font-medium">{title}</span>
                <span className="text-sm text-muted">
                  {lesson.locked ? t('student.locked') : t(`programs.types.${lesson.contentType}`, { defaultValue: lesson.contentType })}
                </span>
              </span>
            </>
          )
          if (lesson.locked) {
            return (
              <li key={lesson.id}>
                <div className="ui-card flex min-h-16 items-center gap-3 py-3 opacity-60" aria-disabled="true">
                  {body}
                </div>
              </li>
            )
          }
          return (
            <li key={lesson.id}>
              <Link
                to={`/student/${programId}/${lesson.id}`}
                className="ui-card flex min-h-16 items-center gap-3 py-3 transition duration-200 hover:ring-2 hover:ring-accent"
              >
                {body}
              </Link>
            </li>
          )
        })}
      </ol>
    </div>
  )
}
