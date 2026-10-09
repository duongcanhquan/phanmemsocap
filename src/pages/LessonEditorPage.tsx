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
import { emptyLocalized, keepCopy, localizedLabel, packLessonBody, unpackLessonBody, type LocalizedText } from '../lib/localized'
import {
  lessonTypes,
  deleteLesson,
  getLessonQuizSettings,
  lessonCourseIds,
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
import { isSupabaseConfigured } from '../lib/supabase'

const composeTypes = lessonTypes.filter((type) => type !== 'quiz')

type LessonDraft = {
  courseId: string
  courseIds?: string[]
  title: string
  moduleName: string
  contentType: LessonType
  body: string
  orderIndex: number
  authorId: string
}

function readLessonDraft(key: string): LessonDraft | null {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<LessonDraft>
    if (!parsed.title?.trim() && !parsed.body?.trim()) return null
    if (!parsed.contentType || !lessonTypes.includes(parsed.contentType)) return null
    return {
      courseId: parsed.courseId ?? '',
      courseIds: Array.isArray(parsed.courseIds) ? parsed.courseIds.filter((id) => typeof id === 'string') : undefined,
      title: parsed.title ?? '',
      moduleName: parsed.moduleName ?? '',
      contentType: parsed.contentType,
      body: parsed.body ?? '',
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
        <button type="button" className="ui-inline ui-btn-primary" onClick={() => setEditing(null)}>
          {t('editor.newLesson')}
        </button>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <button type="button" className={sort === 'order' ? 'ui-inline ui-btn-primary' : 'ui-inline ui-btn-ghost'} onClick={() => setSort('order')}>
          {t('editor.sortOrder')}
        </button>
        <button type="button" className={sort === 'time' ? 'ui-inline ui-btn-primary' : 'ui-inline ui-btn-ghost'} onClick={() => setSort('time')}>
          {t('editor.sortTime')}
        </button>
      </div>
      <div className="ui-fill">
        <DataTable className="h-full">
          <thead>
            <tr>
              <th>#</th>
              <th>{t('programs.name')}</th>
              <th>{t('programs.contentType')}</th>
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
                <td>{t(`programs.types.${lesson.contentType}`)}</td>
                <td>{localizedLabel(lesson.moduleName, i18n.language) || '—'}</td>
                <td>{teachers.find((teacher) => teacher.id === lesson.authorId)?.fullName || '—'}</td>
                <td>{lesson.createdAt ? new Date(lesson.createdAt).toLocaleString(i18n.language) : '—'}</td>
                <td>{lesson.isPublished ? t('programs.published') : t('programs.draft')}</td>
                <td>
                  <span className="inline-flex gap-2" onClick={(event) => event.stopPropagation()}>
                    <button type="button" className="ui-inline ui-btn-ghost" onClick={() => setEditing(lesson)}>
                      {t('accounts.edit')}
                    </button>
                    {pendingDelete === lesson.id ? (
                      <button
                        type="button"
                        className="ui-inline bg-danger text-white"
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
                      <button type="button" className="ui-inline text-danger" onClick={() => setPendingDelete(lesson.id)}>
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
  const sourceBody = unpackLessonBody(lesson?.contentUrl ?? '').vi
  const [title, setTitle] = useState(stored?.title ?? localizedLabel(lesson?.title ?? emptyLocalized(), 'vi'))
  const [moduleName, setModuleName] = useState(stored?.moduleName ?? localizedLabel(lesson?.moduleName ?? emptyLocalized(), 'vi'))
  const [contentType, setContentType] = useState<LessonType>(stored?.contentType ?? lesson?.contentType ?? 'text')
  const [contentUrl, setContentUrl] = useState(stored?.body ?? sourceBody)
  const [content, setContent] = useState<JSONContent | string | undefined>(stored?.body || sourceBody || undefined)
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
  const copies = useRef({
    title: lesson?.title ?? emptyLocalized(),
    moduleName: lesson?.moduleName ?? emptyLocalized(),
    body: unpackLessonBody(lesson?.contentUrl ?? ''),
  })
  const latest = useRef({ courseIds, title, moduleName, contentType, contentUrl, orderIndex, authorId, quizzes, quizSettings })
  const queue = useRef(Promise.resolve())

  function writeLocal() {
    const current = latest.current
    const body = current.contentType === 'text' ? (editorRef.current?.getHTML() || current.contentUrl) : current.contentUrl
    localStorage.setItem(storageKey.current, JSON.stringify({
      courseId: current.courseIds[0] ?? '',
      courseIds: current.courseIds,
      title: current.title,
      moduleName: current.moduleName,
      contentType: current.contentType,
      body,
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
    const body = current.contentType === 'text' ? (editorRef.current?.getHTML() || current.contentUrl) : current.contentUrl
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
      const prose = current.contentType === 'text' || current.contentType === 'slides'
      let titleText: LocalizedText = { ...copies.current.title, vi: current.title.trim() }
      let moduleText: LocalizedText = { ...copies.current.moduleName, vi: current.moduleName.trim() }
      let bodyText: LocalizedText = { ...copies.current.body, vi: prose ? body : '' }
      let ready = current.quizzes.filter((quiz) => quiz.question.vi.trim() || quiz.options.some((option) => option.vi.trim()))
      let translated = false
      if (mode !== 'auto') {
        const result = await translateLesson({
          title: titleText.vi,
          module: moduleText.vi,
          body: prose ? body : '',
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
      const id = await saveLesson(current.courseIds[0] ?? '', {
        id: savedId.current,
        title: titleText,
        moduleName: moduleText,
        contentType: current.contentType,
        contentUrl: prose ? packLessonBody(bodyText) : body,
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
    latest.current = { courseIds, title, moduleName, contentType, contentUrl, orderIndex, authorId, quizzes, quizSettings }
    persistRef.current = persist
    writeLocal()
    const timer = window.setTimeout(() => void persistRef.current('auto'), 1600)
    return () => window.clearTimeout(timer)
    // persist is stored on persistRef so a new function identity does not reset the draft timer.
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [courseIds, title, moduleName, contentType, contentUrl, orderIndex, authorId, content, quizzes, quizSettings])

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

  return (
    <Dialog title={lesson ? t('programs.editLesson') : t('editor.newLesson')} onClose={() => void leave()}>
      <div className="grid gap-4">
        <div className="flex flex-wrap gap-2">
          {(lesson?.contentType === 'quiz' ? lessonTypes : composeTypes).map((type) => (
            <button
              key={type}
              type="button"
              className={contentType === type ? 'ui-inline ui-btn-primary' : 'ui-inline ui-btn-ghost'}
              aria-pressed={contentType === type}
              onClick={() => setContentType(type)}
            >
              {t(`programs.types.${type}`)}
            </button>
          ))}
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          <label className="grid gap-1 text-sm font-medium text-ink" htmlFor="compose-title">
            {t('programs.name')}
            <input id="compose-title" className="ui-field" value={title} onChange={(event) => setTitle(event.target.value)} />
          </label>
          <label className="grid gap-1 text-sm font-medium text-ink" htmlFor="compose-module">
            {t('programs.module')}
            <input id="compose-module" className="ui-field" value={moduleName} onChange={(event) => setModuleName(event.target.value)} />
          </label>
          {canPlaceCourse ? null : <p className="text-sm text-muted lg:col-span-2">{t('editor.adminPlaces')}</p>}
          {canPlaceCourse ? <fieldset className="grid gap-2 text-sm font-medium text-ink">
            <legend>{t('editor.assignCourse')}</legend>
            {programs.map((program) => (
              <label key={program.id} className="flex min-h-9 items-center gap-2 font-normal">
                <input
                  type="checkbox"
                  checked={courseIds.includes(program.id)}
                  onChange={() => {
                    setCourseIds((current) =>
                      current.includes(program.id) ? current.filter((id) => id !== program.id) : [...current, program.id],
                    )
                  }}
                />
                {localizedLabel(program.title, i18n.language) || t('programs.untitled')}
              </label>
            ))}
          </fieldset> : null}
          {canPlaceCourse && courseIds.length > 0 ? (
            <label className="grid gap-1 text-sm font-medium text-ink" htmlFor="compose-order">
              {t('editor.sortOrder')}
              <input id="compose-order" className="ui-field" type="number" min={0} value={orderIndex} onChange={(event) => setOrderIndex(Number(event.target.value))} />
            </label>
          ) : null}
          {canAssignAuthor ? (
            <label className="grid gap-1 text-sm font-medium text-ink" htmlFor="compose-author">
              {t('programs.author')}
              <select id="compose-author" className="ui-field" value={authorId} onChange={(event) => setAuthorId(event.target.value)}>
                <option value="">{t('programs.unassigned')}</option>
                {teachers.map((teacher) => (
                  <option key={teacher.id} value={teacher.id}>{teacher.fullName || teacher.id}</option>
                ))}
              </select>
            </label>
          ) : null}
          <p className="flex min-h-10 items-center text-sm font-medium text-ink">
            {published ? t('programs.published') : t('programs.draft')}
          </p>
        </div>
        {contentType === 'text' ? (
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
              <AdvancedEditor content={content} onChange={setContent} editorRef={editorRef} />
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
        {contentType === 'slides' ? (
          <label className="grid gap-1 text-sm font-medium text-ink" htmlFor="compose-slides">
            {t('programs.slideBody')}
            <textarea id="compose-slides" className="ui-field min-h-56 py-2" value={contentUrl} onChange={(event) => setContentUrl(event.target.value)} />
          </label>
        ) : null}
        {contentType === 'pdf' || contentType === 'video' ? (
          <label className="grid gap-1 text-sm font-medium text-ink" htmlFor="compose-url">
            {t('programs.contentUrl')}
            <input id="compose-url" className="ui-field" value={contentUrl} onChange={(event) => setContentUrl(event.target.value)} />
          </label>
        ) : null}
        <QuizSetup quizzes={quizzes} settings={quizSettings} onQuizzes={setQuizzes} onSettings={setQuizSettings} />
        {error ? <p role="alert" className="text-sm text-danger">{error}</p> : null}
        {draftNote ? <p className="text-sm text-muted">{draftNote}</p> : null}
        <div className="ui-dialog-foot">
          {hasSaved ? (
            <button type="button" className="ui-inline bg-danger text-white" disabled={pending} onClick={() => void onDelete()}>
              {confirmDelete ? t('programs.confirmRemove') : t('programs.remove')}
            </button>
          ) : null}
          <button type="button" className="ui-inline ui-btn-ghost" onClick={() => void leave()}>{t('programs.cancel')}</button>
          <button type="button" className="ui-inline ui-btn-ghost" disabled={pending} onClick={() => void persist('draft')}>
            {pending ? t('editor.draftSaving') : t('editor.saveDraft')}
          </button>
          <button type="button" className="ui-inline ui-btn-primary" disabled={pending} onClick={() => void persist('publish')}>
            {t('editor.publish')}
          </button>
        </div>
      </div>
    </Dialog>
  )
}
