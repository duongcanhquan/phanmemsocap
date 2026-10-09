import { ArrowLeft, Lock } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { DataTable, FilterBar } from '../../components/ui/DataSheet'
import { PageHeader } from '../../components/ui/PageHeader'
import { Tabs } from '../../components/ui/Tabs'
import { localizedLabel } from '../../lib/localized'
import { isSupabaseConfigured } from '../../lib/supabase'
import {
  listEnrolledPrograms,
  listLessonPath,
  listStudyHistory,
  type EnrolledProgram,
  type LessonPathItem,
  type StudyHistoryItem,
} from '../../lib/student'
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
      <PageHeader title={t('student.homeTitle')} />
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
          <article key={program.id} className="ui-card grid gap-3">
            <Link to={`/student/${program.id}`} className="grid gap-3">
            {program.coverImageUrl ? (
              <img src={program.coverImageUrl} alt="" className="aspect-video w-full rounded-xl object-cover" />
            ) : (
              <div className="aspect-video w-full rounded-xl bg-canvas" />
            )}
            <h2 className="text-lg font-semibold">{localizedLabel(program.title, i18n.language) || t('programs.untitled')}</h2>
            {program.category ? <p className="text-sm text-muted">{program.category}</p> : null}
            <p className="text-sm font-medium text-accent">
              {program.total > 0 && program.done === program.total
                ? t('student.completed')
                : t('student.progress', { done: program.done, total: program.total })}
            </p>
            </Link>
            {program.continueLessonId ? (
              <Link
                to={`/student/${program.id}/${program.continueLessonId}`}
                className="ui-inline ui-btn-primary w-fit"
                onClick={(event) => event.stopPropagation()}
              >
                {t('student.continue')}
              </Link>
            ) : null}
          </article>
        ))}
      </div>
    </div>
  )
}

function lessonStatus(lesson: LessonPathItem, currentId: string | null, t: (key: string) => string) {
  if (lesson.locked) return t('student.locked')
  if (!lesson.required && !lesson.passed) return t('programs.optionalLesson')
  if (lesson.waiting) return t('student.statusWaiting')
  if (lesson.passed) return t('student.statusPassed')
  if (lesson.id === currentId) return t('student.statusOpen')
  return t('student.statusReady')
}

function LessonTimeline({ programId }: { programId: string }) {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  const [lessons, setLessons] = useState<LessonPathItem[]>([])
  const [history, setHistory] = useState<StudyHistoryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [tab, setTab] = useState('path')
  const [query, setQuery] = useState('')

  useEffect(() => {
    let active = true
    void Promise.all([listLessonPath(programId), listStudyHistory(programId)])
      .then(([path, past]) => {
        if (!active) return
        setLessons(path)
        setHistory(past)
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

  const current = lessons.find((lesson) => !lesson.locked && !lesson.passed) ?? null
  const titles = new Map(lessons.map((lesson) => [lesson.id, lesson.title]))
  const needle = query.trim().toLowerCase()
  const visibleHistory = history.filter((item) => {
    const lesson = localizedLabel(titles.get(item.lessonId) ?? { vi: '', my: '', bn: '' }, i18n.language)
    const question = localizedLabel(item.question, i18n.language)
    return `${lesson} ${question}`.toLowerCase().includes(needle)
  })

  return (
    <div className="ui-page">
      <Link to="/student" className="ui-btn ui-btn-ghost w-fit px-2">
        <ArrowLeft aria-hidden="true" className="size-4" />
        {t('student.backPrograms')}
      </Link>
      <PageHeader
        title={t('student.pathTitle')}
        action={
          current ? (
            <Link to={`/student/${programId}/${current.id}`} className="ui-inline ui-btn-primary">
              {t('student.continue')}
            </Link>
          ) : lessons.length > 0 ? (
            <span className="text-sm font-medium text-accent">{t('student.completed')}</span>
          ) : null
        }
      />
      {loading ? <p role="status">{t('student.loading')}</p> : null}
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
          { id: 'path', label: t('panels.studyPath') },
          { id: 'history', label: t('panels.studyHistory') },
        ]}
      />
      <div className="ui-fill">
        {tab === 'path' ? (
          <DataTable>
            <thead>
              <tr>
                <th>#</th>
                <th>{t('programs.name')}</th>
                <th>{t('programs.module')}</th>
                <th>{t('filters.type')}</th>
                <th>{t('filters.status')}</th>
                <th>{t('transcript.score')}</th>
              </tr>
            </thead>
            <tbody>
              {lessons.map((lesson, index) => {
                const title = localizedLabel(lesson.title, i18n.language) || t('programs.untitled')
                const moduleName = localizedLabel(lesson.moduleName, i18n.language)
                return (
                  <tr
                    key={lesson.id}
                    className={lesson.locked ? 'opacity-60' : 'ui-row'}
                    onClick={() => {
                      if (!lesson.locked) navigate(`/student/${programId}/${lesson.id}`)
                    }}
                  >
                    <td className="tabular-nums">
                      {lesson.locked ? <Lock aria-hidden="true" className="size-4" /> : index + 1}
                    </td>
                    <td className="font-medium text-ink">{title}</td>
                    <td>{moduleName || '—'}</td>
                    <td>{t(`programs.types.${lesson.contentType}`, { defaultValue: lesson.contentType })}</td>
                    <td>{lessonStatus(lesson, current?.id ?? null, t)}</td>
                    <td className="tabular-nums">{lesson.score === null ? t('reports.emptyScore') : lesson.score.toFixed(1)}</td>
                  </tr>
                )
              })}
            </tbody>
          </DataTable>
        ) : (
          <>
            <FilterBar query={query} onQuery={setQuery} count={visibleHistory.length} />
            {!loading && history.length === 0 ? <p className="text-muted">{t('student.historyEmpty')}</p> : null}
            {history.length > 0 && visibleHistory.length === 0 ? <p className="text-muted">{t('filters.noMatch')}</p> : null}
            <DataTable>
              <thead>
                <tr>
                  <th>{t('filters.submitted')}</th>
                  <th>{t('programs.lessons')}</th>
                  <th>{t('teacher.question')}</th>
                  <th>{t('transcript.score')}</th>
                  <th>{t('transcript.comment')}</th>
                </tr>
              </thead>
              <tbody>
                {visibleHistory.map((item) => (
                  <tr key={item.id}>
                    <td>{item.submittedAt ? new Date(item.submittedAt).toLocaleString(i18n.language) : '—'}</td>
                    <td className="font-medium text-ink">
                      {localizedLabel(titles.get(item.lessonId) ?? { vi: '', my: '', bn: '' }, i18n.language) || t('programs.untitled')}
                    </td>
                    <td className="max-w-xs truncate">{localizedLabel(item.question, i18n.language)}</td>
                    <td className="tabular-nums">{item.score === null ? t('teacher.ungraded') : item.score.toFixed(1)}</td>
                    <td className="wrap">{item.feedback || t('transcript.noComment')}</td>
                  </tr>
                ))}
              </tbody>
            </DataTable>
          </>
        )}
      </div>
    </div>
  )
}
