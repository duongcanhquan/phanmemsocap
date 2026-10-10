import { BookOpen, CheckCircle2, CirclePlay, ClipboardList, FileText, Lock, Presentation } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { MessageThread } from '../../components/messages/MessageThread'
import { StudyBar } from '../../components/student/StudyBar'
import { DataTable, FilterBar } from '../../components/ui/DataSheet'
import { PageHeader } from '../../components/ui/PageHeader'
import { Tabs } from '../../components/ui/Tabs'
import { localizedLabel } from '../../lib/localized'
import { isSupabaseConfigured } from '../../lib/supabase'
import {
  listEnrolledPrograms,
  listLessonPath,
  listMyResults,
  listStudyHistory,
  type EnrolledProgram,
  type LessonPathItem,
  type ResultRow,
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
  const [results, setResults] = useState<ResultRow[]>([])
  const [loading, setLoading] = useState(isSupabaseConfigured)
  const [error, setError] = useState('')
  const [params, setParams] = useSearchParams()
  const view = params.get('view')
  const tab = view === 'results' || view === 'messages' ? view : 'programs'

  function setTab(next: string) {
    if (next === 'programs') setParams({})
    else setParams({ view: next })
  }

  useEffect(() => {
    if (!isSupabaseConfigured) return
    let active = true
    void listEnrolledPrograms()
      .then(async (rows) => {
        if (!active) return
        setPrograms(rows)
        const next = await listMyResults(rows.map((program) => ({ id: program.id, title: program.title })))
        if (active) setResults(next)
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
      <Tabs
        label={t('panels.label')}
        value={tab}
        onChange={setTab}
        tabs={[
          { id: 'programs', label: t('student.homeTitle') },
          { id: 'results', label: t('student.results') },
          { id: 'messages', label: t('messages.title') },
        ]}
      />
      {tab === 'messages' ? (
        <div className="ui-fill">
          <MessageThread />
        </div>
      ) : null}
      {tab === 'results' ? (
        <div className="ui-fill">
          {!loading && results.length === 0 ? <p className="text-muted">{t('student.resultsEmpty')}</p> : null}
          {results.length > 0 ? (
            <>
            <div className="grid gap-3 sm:hidden">
              {results.map((item) => (
                <article key={`card-${item.programTitle.vi}-${item.id}`} className="ui-card grid gap-1 p-4">
                  <p className="text-base font-semibold text-ink">{localizedLabel(item.lessonTitle, i18n.language) || t('programs.untitled')}</p>
                  <p className="text-sm text-muted">{localizedLabel(item.question, i18n.language)}</p>
                  <p className="text-sm font-medium text-ink">
                    {t('transcript.score')}: {item.score === null ? t('teacher.ungraded') : item.score.toFixed(1)}
                  </p>
                  <p className="text-sm text-ink">{item.feedback || t('transcript.noComment')}</p>
                </article>
              ))}
            </div>
            <div className="hidden sm:block">
            <DataTable>
              <thead>
                <tr>
                  <th>{t('filters.submitted')}</th>
                  <th>{t('dashboard.program')}</th>
                  <th>{t('programs.lessons')}</th>
                  <th>{t('teacher.question')}</th>
                  <th>{t('transcript.score')}</th>
                  <th>{t('transcript.comment')}</th>
                </tr>
              </thead>
              <tbody>
                {results.map((item) => (
                  <tr key={`${item.programTitle.vi}-${item.id}`}>
                    <td>{item.submittedAt ? new Date(item.submittedAt).toLocaleString(i18n.language) : '—'}</td>
                    <td>{localizedLabel(item.programTitle, i18n.language) || t('programs.untitled')}</td>
                    <td className="font-medium text-ink">{localizedLabel(item.lessonTitle, i18n.language) || t('programs.untitled')}</td>
                    <td className="max-w-xs truncate">{localizedLabel(item.question, i18n.language)}</td>
                    <td className="tabular-nums">{item.score === null ? t('teacher.ungraded') : item.score.toFixed(1)}</td>
                    <td className="wrap">{item.feedback || t('transcript.noComment')}</td>
                  </tr>
                ))}
              </tbody>
            </DataTable>
            </div>
            </>
          ) : null}
        </div>
      ) : null}
      {tab === 'programs' ? (
      <>
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
            <StudyBar percent={program.percent} label={t('student.courseProgress')} />
            <p className="text-sm font-medium text-accent">
              {program.total > 0 && program.done === program.total
                ? t('student.completed')
                : t('student.learned', { percent: program.percent })}
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
      </>
      ) : null}
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
    setLoading(true)
    setError('')
    setLessons([])
    setHistory([])
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

  const current = lessons.find((lesson) => !lesson.locked && lesson.percent < 100) ?? lessons.find((lesson) => !lesson.locked && !lesson.passed) ?? null
  const coursePercent = lessons.length === 0 ? 0 : Math.round(lessons.reduce((sum, lesson) => sum + lesson.percent, 0) / lessons.length)
  const titles = new Map(lessons.map((lesson) => [lesson.id, lesson.title]))
  const needle = query.trim().toLowerCase()
  const visibleHistory = history.filter((item) => {
    const lesson = localizedLabel(titles.get(item.lessonId) ?? { vi: '', my: '', bn: '' }, i18n.language)
    const question = localizedLabel(item.question, i18n.language)
    return `${lesson} ${question}`.toLowerCase().includes(needle)
  })

  return (
    <div className="ui-page">
      <PageHeader
        title={t('student.pathTitle')}
        back={{ to: '/student', label: t('student.backPrograms') }}
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
      {lessons.length > 0 ? <StudyBar percent={coursePercent} label={t('student.courseProgress')} /> : null}
      <Tabs
        label={t('panels.label')}
        value={tab}
        onChange={setTab}
        tabs={[
          { id: 'path', label: t('panels.studyPath') },
          { id: 'history', label: t('student.results') },
        ]}
      />
      <div className="ui-fill">
        {tab === 'path' ? (
          <div className="grid gap-3">
            {lessons.map((lesson, index) => (
              <LessonCard
                key={lesson.id}
                lesson={lesson}
                index={index + 1}
                title={localizedLabel(lesson.title, i18n.language) || t('programs.untitled')}
                moduleName={localizedLabel(lesson.moduleName, i18n.language)}
                typeLabel={t(`programs.types.${lesson.contentType}`, { defaultValue: lesson.contentType })}
                status={lessonStatus(lesson, current?.id ?? null, t)}
                scoreLabel={`${t('transcript.score')}: ${lesson.score === null ? t('reports.emptyScore') : lesson.score.toFixed(1)}`}
                learned={t('student.learned', { percent: lesson.percent })}
                locked={lesson.locked}
                onOpen={() => navigate(`/student/${programId}/${lesson.id}`)}
              />
            ))}
          </div>
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

function LessonMark({ lesson, locked }: { lesson: LessonPathItem; locked: boolean }) {
  const className = 'size-6'
  if (locked) return <Lock aria-hidden="true" className={className} />
  if (lesson.percent >= 100 || lesson.passed) return <CheckCircle2 aria-hidden="true" className={className} />
  if (lesson.hasQuiz) return <ClipboardList aria-hidden="true" className={className} />
  if (lesson.contentType === 'video') return <CirclePlay aria-hidden="true" className={className} />
  if (lesson.contentType === 'pdf') return <FileText aria-hidden="true" className={className} />
  if (lesson.contentType === 'slides') return <Presentation aria-hidden="true" className={className} />
  return <BookOpen aria-hidden="true" className={className} />
}

function LessonCard({
  lesson,
  index,
  title,
  moduleName,
  typeLabel,
  status,
  scoreLabel,
  learned,
  locked,
  onOpen,
}: {
  lesson: LessonPathItem
  index: number
  title: string
  moduleName: string
  typeLabel: string
  status: string
  scoreLabel: string
  learned: string
  locked: boolean
  onOpen: () => void
}) {
  return (
    <button
      type="button"
      disabled={locked}
      className="ui-card grid gap-3 p-4 text-left disabled:opacity-60 sm:grid-cols-[auto_1fr] sm:items-center"
      onClick={onOpen}
    >
      <span className="grid size-12 place-items-center rounded-2xl bg-accent/10 text-accent">
        <LessonMark lesson={lesson} locked={locked} />
      </span>
      <span className="grid min-w-0 gap-2">
        <span className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-muted">{index}</span>
          <span className="rounded-full bg-canvas px-2 py-0.5 text-xs font-medium text-ink">{typeLabel}</span>
          <span className="rounded-full bg-accent/10 px-2 py-0.5 text-xs font-medium text-accent">{status}</span>
        </span>
        <span className="text-base font-semibold text-ink">{title}</span>
        {moduleName ? <span className="text-sm text-muted">{moduleName}</span> : null}
        <StudyBar percent={lesson.percent} label={learned} />
        <span className="text-xs tabular-nums text-muted">{scoreLabel}</span>
      </span>
    </button>
  )
}
