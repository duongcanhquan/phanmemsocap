import type { JSONContent } from '@tiptap/core'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { AILessonGenerator } from '../components/editor/AILessonGenerator'
import { AdvancedEditor, type AdvancedEditorHandle } from '../components/editor/AdvancedEditor'
import { DataTable } from '../components/ui/DataSheet'
import { Dialog } from '../components/ui/Dialog'
import { PageHeader } from '../components/ui/PageHeader'
import { Tabs } from '../components/ui/Tabs'
import { useAuth } from '../hooks/useAuth'
import { translateLesson } from '../lib/ai'
import { emptyLocalized, keepCopy, localizedLabel, type LocalizedText } from '../lib/localized'
import {
  hasVisibleText,
  packLessonContent,
  parseLessonContent,
  resolveContentType,
} from '../lib/lessonContent'
import {
  deleteLesson,
  getLessonQuizSettings,
  lessonCourseIds,
  lessonTypes,
  listAllLessons,
  listLessons,
  listQuizzes,
  saveQuizzes,
  listPrograms,
  listTeachers,
  saveLesson,
  syncLessonCourses,
  type LessonQuizSettings,
  type LessonRecord,
  type LessonType,
  type ProgramRecord,
  type QuizRecord,
  type StudentRecord,
} from '../lib/programs'
import { isSchoolAdmin } from '../lib/roles'
import { QuizSetup } from '../components/admin/QuizSetup'
import { MaterialChips } from '../components/MaterialChips'
import { PdfFields, SlideFields, VideoFields } from '../components/lesson/MaterialFields'
import { isSupabaseConfigured } from '../lib/supabase'

const composeTypes = lessonTypes.filter((type) => type !== 'quiz')

type LessonDraft = {
  courseId: string
  courseIds?: string[]
  title: string
  moduleName: string
  contentType?: LessonType
  body: string
  pdfUrl?: string
  pdfLabel?: string
  slideUrl?: string
  slideLabel?: string
  slideMarkdown?: string
  videoUrl?: string
  orderIndex: number
  authorId: string
}

function readLessonDraft(key: string): LessonDraft | null {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<LessonDraft>
    const empty =
      !parsed.title?.trim() &&
      !parsed.body?.trim() &&
      !parsed.pdfUrl?.trim() &&
      !parsed.slideUrl?.trim() &&
      !parsed.slideMarkdown?.trim() &&
      !parsed.videoUrl?.trim()
    if (empty) return null
    const contentType = composeTypes.find((type) => type === parsed.contentType)
    return {
      courseId: parsed.courseId ?? '',
      courseIds: Array.isArray(parsed.courseIds) ? parsed.courseIds.filter((id) => typeof id === 'string') : undefined,
      title: parsed.title ?? '',
      moduleName: parsed.moduleName ?? '',
      contentType,
      body: parsed.body ?? '',
      pdfUrl: parsed.pdfUrl ?? '',
      pdfLabel: parsed.pdfLabel ?? '',
      slideUrl: parsed.slideUrl ?? '',
      slideLabel: parsed.slideLabel ?? '',
      slideMarkdown: parsed.slideMarkdown ?? '',
      videoUrl: parsed.videoUrl ?? '',
      orderIndex: Number(parsed.orderIndex ?? 0),
      authorId: parsed.authorId ?? '',
    }
  } catch {
    return null
  }
}

export function LessonEditorPage() {
  const { t, i18n } = useTranslation()
  const { user, role } = useAuth()
  const [programs, setPrograms] = useState<ProgramRecord[]>([])
  const [teachers, setTeachers] = useState<StudentRecord[]>([])
  const [lessons, setLessons] = useState<LessonRecord[]>([])
  const [programId, setProgramId] = useState('')
  const [sort, setSort] = useState<'order' | 'time'>('order')
  const [editing, setEditing] = useState<LessonRecord | null | undefined>(undefined)
  const [pendingDelete, setPendingDelete] = useState('')
  const [loading, setLoading] = useState(isSupabaseConfigured)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!isSupabaseConfigured) return
    let active = true
    void Promise.all([listPrograms(), listTeachers()])
      .then(([rows, staff]) => {
        if (!active) return
        setPrograms(rows)
        setTeachers(staff)
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

  useEffect(() => {
    if (!isSupabaseConfigured) return
    let active = true
    const load = programId ? listLessons(programId) : listAllLessons()
    void load
      .then((rows) => {
        if (active) setLessons(rows)
      })
      .catch(() => {
        if (active) setError(t('programs.loadError'))
      })
    return () => {
      active = false
    }
  }, [programId, t])

  const shown = [...lessons].sort((a, b) => {
    if (sort === 'time') return (b.createdAt ?? '').localeCompare(a.createdAt ?? '')
    return a.orderIndex - b.orderIndex
  })

  return (
    <div className="ui-page">
      <PageHeader title={t('editor.title')} />
      {error ? <p role="alert" className="text-sm text-danger">{error}</p> : null}
      <div className="flex shrink-0 flex-wrap items-center gap-2">
        <label className="flex min-w-56 flex-1 items-center gap-2 text-sm font-medium text-ink" htmlFor="editor-program">
          <span className="shrink-0">{t('editor.assignCourse')}</span>
          <select
            id="editor-program"
            className="ui-field min-w-0 flex-1"
            value={programId}
            disabled={loading}
            onChange={(event) => setProgramId(event.target.value)}
          >
            <option value="">{t('editor.allCourses')}</option>
            {programs.map((program) => (
              <option key={program.id} value={program.id}>
                {localizedLabel(program.title, i18n.language) || t('programs.untitled')}
              </option>
            ))}
          </select>
        </label>
        <button type="button" className="ui-btn ui-btn-primary" onClick={() => setEditing(null)}>
          {t('editor.newLesson')}
        </button>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <button type="button" className={sort === 'order' ? 'ui-btn ui-btn-primary' : 'ui-btn ui-btn-ghost'} onClick={() => setSort('order')}>
          {t('editor.sortOrder')}
        </button>
        <button type="button" className={sort === 'time' ? 'ui-btn ui-btn-primary' : 'ui-btn ui-btn-ghost'} onClick={() => setSort('time')}>
          {t('editor.sortTime')}
        </button>
      </div>
      <div className="ui-fill">
        <DataTable className="h-full">
          <thead>
            <tr>
              <th>#</th>
              <th>{t('programs.name')}</th>
              <th>{t('programs.materials')}</th>
              <th>{t('programs.module')}</th>
              <th>{t('programs.author')}</th>
              <th>{t('editor.createdAt')}</th>
              <th>{t('filters.status')}</th>
              <th>{t('teacher.action')}</th>
            </tr>
          </thead>
          <tbody>
            {shown.map((lesson, index) => (
              <tr key={lesson.id} className="ui-row" onClick={() => setEditing(lesson)}>
                <td className="tabular-nums">{sort === 'order' ? lesson.orderIndex + 1 : index + 1}</td>
                <td className="font-medium text-ink">{localizedLabel(lesson.title, i18n.language) || t('programs.untitled')}</td>
                <td>
                  <MaterialChips contentUrl={lesson.contentUrl} contentType={lesson.contentType} limit={3} />
                </td>
                <td>{localizedLabel(lesson.moduleName, i18n.language) || '—'}</td>
                <td>{teachers.find((teacher) => teacher.id === lesson.authorId)?.fullName || '—'}</td>
                <td>{lesson.createdAt ? new Date(lesson.createdAt).toLocaleString(i18n.language) : '—'}</td>
                <td>{lesson.isPublished ? t('programs.published') : t('programs.draft')}</td>
                <td>
                  <span className="inline-flex gap-2" onClick={(event) => event.stopPropagation()}>
                    <button type="button" className="ui-btn ui-btn-ghost" onClick={() => setEditing(lesson)}>
                      {t('accounts.edit')}
                    </button>
                    {pendingDelete === lesson.id ? (
                      <button
                        type="button"
                        className="ui-btn bg-danger text-white"
                        onClick={() => {
                          void deleteLesson(lesson.id)
                            .then(() => {
                              setLessons((current) => current.filter((item) => item.id !== lesson.id))
                              setPendingDelete('')
                              setEditing(undefined)
                            })
                            .catch(() => setError(t('programs.saveError')))
                        }}
                      >
                        {t('programs.confirmRemove')}
                      </button>
                    ) : (
                      <button type="button" className="ui-btn ui-btn-danger" onClick={() => setPendingDelete(lesson.id)}>
                        {t('programs.remove')}
                      </button>
                    )}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </DataTable>
      </div>
      {editing !== undefined ? (
        <LessonComposer
          key={editing?.id ?? 'new'}
          lesson={editing}
          programs={programs}
          teachers={teachers}
          programId={programId}
          nextOrder={lessons.length}
          canAssignAuthor={isSchoolAdmin(role)}
          canPlaceCourse={isSchoolAdmin(role)}
          selfId={user?.id ?? ''}
          onClose={() => setEditing(undefined)}
          onSaved={(nextProgramId, close) => {
            setProgramId(nextProgramId)
            const load = nextProgramId ? listLessons(nextProgramId) : listAllLessons()
            void load.then(setLessons).catch(() => setError(t('programs.loadError')))
            if (close) setEditing(undefined)
          }}
        />
      ) : null}
    </div>
  )
}

function LessonComposer({
  lesson,
  programs,
  teachers,
  programId,
  nextOrder,
  canAssignAuthor,
  canPlaceCourse,
  selfId,
  onClose,
  onSaved,
}: {
  lesson: LessonRecord | null
  programs: ProgramRecord[]
  teachers: StudentRecord[]
  programId: string
  nextOrder: number
  canAssignAuthor: boolean
  canPlaceCourse: boolean
  selfId: string
  onClose: () => void
  onSaved: (programId: string, close: boolean) => void
}) {
  const { t, i18n } = useTranslation()
  const editorRef = useRef<AdvancedEditorHandle>(null)
  const draftKey = `phanmemsocap.lesson-draft.${lesson?.id ?? `new-${programId}`}`
  const stored = readLessonDraft(draftKey)
  const storageKey = useRef(draftKey)
  const savedId = useRef(lesson?.id)
  const skipServerCourses = useRef(Boolean(stored?.courseIds?.length))
  const quizzesReady = useRef(!lesson?.id)
  const keepPublished = useRef(lesson?.isPublished ?? false)
  const mounted = useRef(true)
  const [courseIds, setCourseIds] = useState<string[]>(() => {
    if (stored?.courseIds?.length) return stored.courseIds
    if (stored?.courseId) return [stored.courseId]
    return programId ? [programId] : []
  })
  const source = parseLessonContent(lesson?.contentUrl ?? '', lesson?.contentType ?? 'text')
  const initialFocus: LessonType =
    stored?.contentType ||
    (lesson?.contentType && lesson.contentType !== 'quiz' ? lesson.contentType : null) ||
    'text'
  const [title, setTitle] = useState(stored?.title ?? localizedLabel(lesson?.title ?? emptyLocalized(), 'vi'))
  const [moduleName, setModuleName] = useState(stored?.moduleName ?? localizedLabel(lesson?.moduleName ?? emptyLocalized(), 'vi'))
  const [focusType, setFocusType] = useState<LessonType>(initialFocus)
  const [contentUrl, setContentUrl] = useState(stored?.body ?? source.body.vi)
  const [content, setContent] = useState<JSONContent | string | undefined>(stored?.body || source.body.vi || undefined)

  function onEditorChange(next: JSONContent) {
    setContent(next)
    const html = editorRef.current?.getHTML()
    if (html !== undefined) setContentUrl(html)
  }
  const [pdfUrl, setPdfUrl] = useState(stored?.pdfUrl ?? source.pdfUrl)
  const [pdfLabel, setPdfLabel] = useState(stored?.pdfLabel ?? source.pdfLabel)
  const [slideUrl, setSlideUrl] = useState(stored?.slideUrl ?? source.slideUrl)
  const [slideLabel, setSlideLabel] = useState(stored?.slideLabel ?? source.slideLabel)
  const [slideMarkdown, setSlideMarkdown] = useState(stored?.slideMarkdown ?? source.slideMarkdown)
  const [videoUrl, setVideoUrl] = useState(stored?.videoUrl ?? source.videoUrl)
  const [orderIndex, setOrderIndex] = useState(stored?.orderIndex ?? lesson?.orderIndex ?? nextOrder)
  const [authorId, setAuthorId] = useState(stored?.authorId || lesson?.authorId || selfId)
  const [published, setPublished] = useState(lesson?.isPublished ?? false)
  const [quizzes, setQuizzes] = useState<QuizRecord[]>([])
  const [quizSettings, setQuizSettings] = useState<LessonQuizSettings>({ passMark: 5, shuffleQuestions: false, shuffleOptions: false })
  const [hasSaved, setHasSaved] = useState(Boolean(lesson))
  const [pane, setPane] = useState('write')
  const [pending, setPending] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [error, setError] = useState('')
  const [draftNote, setDraftNote] = useState('')
  const [courseQuery, setCourseQuery] = useState('')
  const [teacherQuery, setTeacherQuery] = useState('')
  const copies = useRef({
    title: lesson?.title ?? emptyLocalized(),
    moduleName: lesson?.moduleName ?? emptyLocalized(),
    body: source.body,
  })
  const latest = useRef({
    courseIds,
    title,
    moduleName,
    focusType,
    contentUrl,
    pdfUrl,
    pdfLabel,
    slideUrl,
    slideLabel,
    slideMarkdown,
    videoUrl,
    orderIndex,
    authorId,
    quizzes,
    quizSettings,
  })
  const queue = useRef(Promise.resolve())

  function writeLocal() {
    const current = latest.current
    const body = editorRef.current?.getHTML() || current.contentUrl
    localStorage.setItem(storageKey.current, JSON.stringify({
      courseId: current.courseIds[0] ?? '',
      courseIds: current.courseIds,
      title: current.title,
      moduleName: current.moduleName,
      contentType: current.focusType,
      body,
      pdfUrl: current.pdfUrl,
      pdfLabel: current.pdfLabel,
      slideUrl: current.slideUrl,
      slideLabel: current.slideLabel,
      slideMarkdown: current.slideMarkdown,
      videoUrl: current.videoUrl,
      orderIndex: current.orderIndex,
      authorId: current.authorId,
    }))
  }

  function persist(mode: 'auto' | 'draft' | 'publish') {
    const run = queue.current.then(() => persistNow(mode), () => persistNow(mode))
    queue.current = run.then(() => undefined, () => undefined)
    return run
  }

  async function persistNow(mode: 'auto' | 'draft' | 'publish') {
    const current = latest.current
    const body = editorRef.current?.getHTML() || current.contentUrl
    if (!current.title.trim()) {
      writeLocal()
      if (mode !== 'auto' && mounted.current) setError(t('programs.titleRequired'))
      return false
    }
    const publish = mode === 'publish' ? true : mode === 'draft' ? false : keepPublished.current
    if (mode !== 'auto' && mounted.current) {
      setPending(true)
      setError('')
    }
    try {
      let titleText: LocalizedText = { ...copies.current.title, vi: current.title.trim() }
      let moduleText: LocalizedText = { ...copies.current.moduleName, vi: current.moduleName.trim() }
      let bodyText: LocalizedText = { ...copies.current.body, vi: body }
      let ready = current.quizzes.filter((quiz) => quiz.question.vi.trim() || quiz.options.some((option) => option.vi.trim()))
      let translated = false
      if (mode !== 'auto') {
        const result = await translateLesson({
          title: titleText.vi,
          module: moduleText.vi,
          body,
          quizzes: ready.map((quiz) => ({
            question: quiz.question.vi,
            options: quiz.isEssay ? [] : quiz.options.map((option) => option.vi),
          })),
        }).catch(() => null)
        if (result) {
          translated = true
          titleText = { vi: titleText.vi, my: keepCopy(result.my.title, titleText.my), bn: keepCopy(result.bn.title, titleText.bn) }
          moduleText = { vi: moduleText.vi, my: keepCopy(result.my.module, moduleText.my), bn: keepCopy(result.bn.module, moduleText.bn) }
          bodyText = { vi: bodyText.vi, my: keepCopy(result.my.body, bodyText.my), bn: keepCopy(result.bn.body, bodyText.bn) }
          ready = ready.map((quiz, index) => ({
            ...quiz,
            question: {
              vi: quiz.question.vi,
              my: keepCopy(result.my.quizzes[index]?.question, quiz.question.my),
              bn: keepCopy(result.bn.quizzes[index]?.question, quiz.question.bn),
            },
            options: quiz.options.map((option, optionIndex) => ({
              vi: option.vi,
              my: keepCopy(result.my.quizzes[index]?.options[optionIndex], option.my),
              bn: keepCopy(result.bn.quizzes[index]?.options[optionIndex], option.bn),
            })),
          }))
          copies.current = { title: titleText, moduleName: moduleText, body: bodyText }
        }
      }
      const lessonName = titleText.vi.trim() || t('programs.untitled')
      const materials = {
        body: bodyText,
        pdfUrl: current.pdfUrl.trim(),
        pdfLabel: (current.pdfLabel.trim() || lessonName).trim(),
        slideUrl: current.slideUrl.trim(),
        slideLabel: (current.slideLabel.trim() || lessonName).trim(),
        slideMarkdown: current.slideMarkdown.trim(),
        videoUrl: current.videoUrl.trim(),
      }
      const id = await saveLesson(current.courseIds[0] ?? '', {
        id: savedId.current,
        title: titleText,
        moduleName: moduleText,
        contentType: resolveContentType(
          lesson?.contentType === 'quiz' ? 'quiz' : current.focusType,
          materials,
        ),
        contentUrl: packLessonContent(materials),
        isPublished: publish,
        orderIndex: current.orderIndex,
        authorId: current.authorId || selfId,
        quiz: current.quizSettings,
      })
      if (quizzesReady.current) {
        await saveQuizzes(id, ready)
      }
      savedId.current = id
      if (canPlaceCourse) await syncLessonCourses(id, current.courseIds, programId, current.orderIndex)
      keepPublished.current = publish
      if (mounted.current) {
        setPublished(publish)
        setHasSaved(true)
      }
      const nextKey = `phanmemsocap.lesson-draft.${id}`
      if (storageKey.current !== nextKey) localStorage.removeItem(storageKey.current)
      storageKey.current = nextKey
      if (mode === 'publish') localStorage.removeItem(nextKey)
      else writeLocal()
      onSaved(programId, mode === 'publish')
      if (mounted.current) {
        setPending(false)
        setDraftNote(mode === 'auto' ? (publish ? '' : t('editor.draftSaved')) : translated ? t('editor.translated') : t('editor.translateMissing'))
      }
      return true
    } catch {
      if (mounted.current && mode !== 'auto') {
        setError(t('programs.saveError'))
        setPending(false)
      }
      return false
    }
  }

  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])

  useEffect(() => {
    if (!lesson?.id) return
    let active = true
    void Promise.all([listQuizzes(lesson.id), getLessonQuizSettings(lesson.id)])
      .then(([rows, settings]) => {
        if (!active) return
        setQuizzes(rows)
        setQuizSettings(settings)
        quizzesReady.current = true
      })
      .catch(() => undefined)
    return () => {
      active = false
    }
  }, [lesson?.id])

  useEffect(() => {
    if (!lesson?.id || skipServerCourses.current) return
    let active = true
    void lessonCourseIds(lesson.id)
      .then((ids) => {
        if (active && ids.length > 0) setCourseIds(ids)
      })
      .catch(() => undefined)
    return () => {
      active = false
    }
  }, [lesson?.id])

  const persistRef = useRef(persist)

  useEffect(() => {
    latest.current = {
      courseIds,
      title,
      moduleName,
      focusType,
      contentUrl,
      pdfUrl,
      pdfLabel,
      slideUrl,
      slideLabel,
      slideMarkdown,
      videoUrl,
      orderIndex,
      authorId,
      quizzes,
      quizSettings,
    }
    persistRef.current = persist
    writeLocal()
    const timer = window.setTimeout(() => void persistRef.current('auto'), 1600)
    return () => window.clearTimeout(timer)
    // persist is stored on persistRef so a new function identity does not reset the draft timer.
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [courseIds, title, moduleName, focusType, contentUrl, pdfUrl, pdfLabel, slideUrl, slideLabel, slideMarkdown, videoUrl, orderIndex, authorId, content, quizzes, quizSettings])

  useEffect(() => {
    const flush = () => {
      writeLocal()
      if (document.visibilityState === 'hidden') void persistRef.current('auto')
    }
    document.addEventListener('visibilitychange', flush)
    window.addEventListener('pagehide', flush)
    return () => {
      document.removeEventListener('visibilitychange', flush)
      window.removeEventListener('pagehide', flush)
      writeLocal()
      void persistRef.current('auto')
    }
  }, [])

  async function leave() {
    writeLocal()
    await persist('auto')
    onClose()
  }

  async function onDelete() {
    if (!savedId.current) return
    if (!confirmDelete) {
      setConfirmDelete(true)
      return
    }
    setPending(true)
    setError('')
    try {
      await deleteLesson(savedId.current)
      localStorage.removeItem(storageKey.current)
      onSaved(programId, true)
    } catch {
      setError(t('programs.saveError'))
      setPending(false)
    }
  }

  const visibleCourses = programs.filter((program) => {
    const label = localizedLabel(program.title, i18n.language) || t('programs.untitled')
    return label.toLowerCase().includes(courseQuery.trim().toLowerCase())
  })
  const visibleTeachers = teachers.filter((teacher) =>
    (teacher.fullName || teacher.id).toLowerCase().includes(teacherQuery.trim().toLowerCase()),
  )
  const authorName = teachers.find((teacher) => teacher.id === authorId)?.fullName || t('programs.unassigned')

  const lessonName = title.trim() || t('programs.untitled')
  const extraCount = [
    focusType !== 'text' && hasVisibleText(contentUrl) ? 1 : 0,
    focusType !== 'pdf' && pdfUrl.trim() ? 1 : 0,
    focusType !== 'slides' && (slideUrl.trim() || slideMarkdown.trim()) ? 1 : 0,
    focusType !== 'video' && videoUrl.trim() ? 1 : 0,
  ].reduce((sum, value) => sum + value, 0)

  const pdfBlock = (idPrefix: string) => (
    <PdfFields
      idPrefix={idPrefix}
      lessonName={lessonName}
      pdfUrl={pdfUrl}
      pdfLabel={pdfLabel}
      onUrl={setPdfUrl}
      onLabel={setPdfLabel}
      onError={setError}
    />
  )
  const slideBlock = (idPrefix: string) => (
    <SlideFields
      idPrefix={idPrefix}
      lessonName={lessonName}
      slideUrl={slideUrl}
      slideLabel={slideLabel}
      slideMarkdown={slideMarkdown}
      onUrl={setSlideUrl}
      onLabel={setSlideLabel}
      onMarkdown={setSlideMarkdown}
      onError={setError}
    />
  )
  const videoBlock = (idPrefix: string) => (
    <VideoFields idPrefix={idPrefix} videoUrl={videoUrl} onUrl={setVideoUrl} />
  )

  return (
    <Dialog title={lesson ? t('programs.editLesson') : t('editor.newLesson')} onClose={() => void leave()}>
      <div className="grid gap-4">
        <label className="grid gap-1 text-sm font-medium text-ink" htmlFor="compose-title">
          {t('programs.name')}
          <input id="compose-title" className="ui-field text-base font-semibold" value={title} onChange={(event) => setTitle(event.target.value)} autoFocus />
        </label>
        <div className="grid gap-2">
          <div className="flex flex-wrap gap-2">
            {composeTypes.map((type) => (
              <button
                key={type}
                type="button"
                className={focusType === type ? 'ui-btn ui-btn-primary' : 'ui-btn ui-btn-ghost'}
                aria-pressed={focusType === type}
                onClick={() => setFocusType(type)}
              >
                {t(`programs.types.${type}`)}
              </button>
            ))}
          </div>
          <p className="text-xs text-muted">{t('programs.focusHint')}</p>
        </div>
        {focusType === 'text' ? (
          <>
            <Tabs
              label={t('panels.label')}
              value={pane}
              onChange={setPane}
              tabs={[
                { id: 'write', label: t('panels.write') },
                { id: 'assist', label: t('panels.assist') },
              ]}
            />
            <div className={pane === 'write' ? 'min-h-[24rem]' : 'hidden'}>
              <AdvancedEditor content={content} onChange={onEditorChange} editorRef={editorRef} />
            </div>
            {pane === 'assist' ? (
              <AILessonGenerator
                getContent={() => editorRef.current?.getText() ?? ''}
                onInsert={(markdown) => {
                  setPane('write')
                  editorRef.current?.insertMarkdown(markdown)
                }}
              />
            ) : null}
          </>
        ) : null}
        {focusType === 'pdf' ? pdfBlock('compose-main') : null}
        {focusType === 'slides' ? slideBlock('compose-main') : null}
        {focusType === 'video' ? videoBlock('compose-main') : null}
        <details className="rounded-2xl border border-line bg-white/60 p-3" open={extraCount > 0}>
          <summary className="cursor-pointer list-none text-sm font-medium text-ink">
            <span className="inline-flex flex-wrap items-center gap-2">
              <span>{t('programs.attachments')}</span>
              <span className="rounded-full bg-canvas px-2 py-0.5 text-xs font-normal text-muted">
                {t('programs.attachmentsCount', { count: extraCount })}
              </span>
            </span>
          </summary>
          <div className="mt-3 grid gap-3">
            <p className="text-xs text-muted">{t('programs.attachmentsHint')}</p>
            {focusType !== 'text' ? (
              <label className="grid gap-1 text-sm font-medium text-ink" htmlFor="compose-extra-body">
                {t('panels.write')}
                <textarea
                  id="compose-extra-body"
                  className="ui-field min-h-28 py-2"
                  value={contentUrl}
                  onChange={(event) => setContentUrl(event.target.value)}
                />
              </label>
            ) : null}
            {focusType !== 'pdf' ? pdfBlock('compose-extra') : null}
            {focusType !== 'slides' ? slideBlock('compose-extra') : null}
            {focusType !== 'video' ? videoBlock('compose-extra') : null}
          </div>
        </details>
        <details className="rounded-2xl border border-line bg-white/60 p-3">
          <summary className="cursor-pointer list-none text-sm font-medium text-ink">
            <span className="inline-flex flex-wrap items-center gap-2">
              <span>{t('editor.moreOptions')}</span>
              <span className="rounded-full bg-canvas px-2 py-0.5 text-xs font-normal text-muted">
                {t('editor.coursesPicked', { count: courseIds.length })}
              </span>
              {canAssignAuthor ? (
                <span className="rounded-full bg-canvas px-2 py-0.5 text-xs font-normal text-muted">{authorName}</span>
              ) : null}
              <span className="rounded-full bg-canvas px-2 py-0.5 text-xs font-normal text-muted">
                {published ? t('programs.published') : t('programs.draft')}
              </span>
            </span>
          </summary>
          <div className="mt-3 grid gap-3">
            <label className="grid gap-1 text-sm font-medium text-ink" htmlFor="compose-module">
              {t('programs.module')}
              <input id="compose-module" className="ui-field" value={moduleName} onChange={(event) => setModuleName(event.target.value)} placeholder={t('programs.modulePlaceholder')} />
              <span className="text-xs font-normal text-muted">{t('programs.moduleHint')}</span>
            </label>
            {canPlaceCourse ? (
              <div className="grid gap-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-medium text-ink">{t('editor.assignCourse')}</p>
                  <button type="button" className="ui-btn ui-btn-ghost" onClick={() => setCourseIds([])} disabled={courseIds.length === 0}>
                    {t('classesPage.clearPick')}
                  </button>
                </div>
                <input className="ui-field" value={courseQuery} onChange={(event) => setCourseQuery(event.target.value)} placeholder={t('filters.search')} />
                <div className="max-h-36 overflow-y-auto rounded-xl border border-line bg-white/80 p-1">
                  {visibleCourses.length === 0 ? <p className="px-2 py-2 text-sm text-muted">{t('filters.noMatch')}</p> : null}
                  {visibleCourses.map((program) => (
                    <label key={program.id} className="flex min-h-9 cursor-pointer items-center gap-2 rounded-lg px-2 text-sm font-normal text-ink hover:bg-canvas">
                      <input
                        type="checkbox"
                        checked={courseIds.includes(program.id)}
                        onChange={() => {
                          setCourseIds((current) =>
                            current.includes(program.id) ? current.filter((id) => id !== program.id) : [...current, program.id],
                          )
                        }}
                      />
                      <span className="truncate">{localizedLabel(program.title, i18n.language) || t('programs.untitled')}</span>
                    </label>
                  ))}
                </div>
                {courseIds.length > 0 ? (
                  <label className="grid max-w-40 gap-1 text-sm font-medium text-ink" htmlFor="compose-order">
                    {t('editor.sortOrder')}
                    <input id="compose-order" className="ui-field" type="number" min={0} value={orderIndex} onChange={(event) => setOrderIndex(Number(event.target.value))} />
                  </label>
                ) : null}
              </div>
            ) : (
              <p className="text-sm text-muted">{t('editor.adminPlaces')}</p>
            )}
            {canAssignAuthor ? (
              <div className="grid gap-2">
                <p className="text-sm font-medium text-ink">{t('programs.author')}</p>
                <span className="text-xs text-muted">{t('programs.authorHint')}</span>
                <input className="ui-field" value={teacherQuery} onChange={(event) => setTeacherQuery(event.target.value)} placeholder={t('filters.search')} />
                <div className="max-h-32 overflow-y-auto rounded-xl border border-line bg-white/80 p-1">
                  <label className="flex min-h-9 cursor-pointer items-center gap-2 rounded-lg px-2 text-sm text-ink hover:bg-canvas">
                    <input type="radio" name="compose-author" checked={!authorId} onChange={() => setAuthorId('')} />
                    {t('programs.unassigned')}
                  </label>
                  {visibleTeachers.map((teacher) => (
                    <label key={teacher.id} className="flex min-h-9 cursor-pointer items-center gap-2 rounded-lg px-2 text-sm text-ink hover:bg-canvas">
                      <input type="radio" name="compose-author" checked={authorId === teacher.id} onChange={() => setAuthorId(teacher.id)} />
                      <span className="truncate">{teacher.fullName || teacher.id}</span>
                    </label>
                  ))}
                </div>
              </div>
            ) : null}
            <p className="text-sm font-medium text-ink">{published ? t('programs.published') : t('programs.draft')}</p>
          </div>
        </details>
        <details className="rounded-2xl border border-line bg-white/60 p-3" open={quizzes.length > 0}>
          <summary className="cursor-pointer list-none text-sm font-medium text-ink">
            {t('student.materialQuiz')} · {quizzes.length}
          </summary>
          <div className="mt-3">
            <QuizSetup quizzes={quizzes} settings={quizSettings} onQuizzes={setQuizzes} onSettings={setQuizSettings} />
          </div>
        </details>
        {error ? <p role="alert" className="text-sm text-danger">{error}</p> : null}
        {draftNote ? <p className="text-sm text-muted">{draftNote}</p> : null}
        <div className="ui-dialog-foot">
          {hasSaved ? (
            <button type="button" className="ui-btn ui-btn-danger" disabled={pending} onClick={() => void onDelete()}>
              {confirmDelete ? t('programs.confirmRemove') : t('programs.remove')}
            </button>
          ) : null}
          <button type="button" className="ui-btn ui-btn-ghost" onClick={() => void leave()}>{t('programs.cancel')}</button>
          <button type="button" className="ui-btn ui-btn-ghost" disabled={pending} onClick={() => void persist('draft')}>
            {pending ? t('editor.draftSaving') : t('editor.saveDraft')}
          </button>
          <button type="button" className="ui-btn ui-btn-primary" disabled={pending} onClick={() => void persist('publish')}>
            {t('editor.publish')}
          </button>
        </div>
      </div>
    </Dialog>
  )
}
