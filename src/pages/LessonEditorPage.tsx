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
import { emptyLocalized, localizedLabel } from '../lib/localized'
import {
  lessonTypes,
  deleteLesson,
  listLessons,
  listPrograms,
  listTeachers,
  saveLesson,
  type LessonRecord,
  type LessonType,
  type ProgramRecord,
  type StudentRecord,
} from '../lib/programs'
import { isSchoolAdmin } from '../lib/roles'
import { isSupabaseConfigured } from '../lib/supabase'

const composeTypes = lessonTypes.filter((type) => type !== 'quiz')

export function LessonEditorPage() {
  const { t, i18n } = useTranslation()
  const { user, role } = useAuth()
  const [programs, setPrograms] = useState<ProgramRecord[]>([])
  const [teachers, setTeachers] = useState<StudentRecord[]>([])
  const [lessons, setLessons] = useState<LessonRecord[]>([])
  const [programId, setProgramId] = useState('')
  const [sort, setSort] = useState<'order' | 'time'>('order')
  const [editing, setEditing] = useState<LessonRecord | null | undefined>(undefined)
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
    if (!programId) {
      setLessons([])
      return
    }
    let active = true
    void listLessons(programId)
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
      <PageHeader
        title={t('editor.title')}
        action={
          <button type="button" className="ui-inline ui-btn-primary" disabled={!programId} onClick={() => setEditing(null)}>
            {t('editor.newLesson')}
          </button>
        }
      />
      {error ? <p role="alert" className="text-sm text-danger">{error}</p> : null}
      <div className="flex shrink-0 items-center gap-2 overflow-x-auto">
        <label className="flex min-w-56 flex-1 items-center gap-2 text-sm font-medium text-ink" htmlFor="editor-program">
          <span className="shrink-0">{t('editor.assignCourse')}</span>
          <select
            id="editor-program"
            className="ui-field min-w-0 flex-1"
            value={programId}
            disabled={loading}
            onChange={(event) => setProgramId(event.target.value)}
          >
            <option value="">{t('editor.pickProgram')}</option>
            {programs.map((program) => (
              <option key={program.id} value={program.id}>
                {localizedLabel(program.title, i18n.language) || t('programs.untitled')}
              </option>
            ))}
          </select>
        </label>
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
          selfId={user?.id ?? ''}
          onClose={() => setEditing(undefined)}
          onSaved={(nextProgramId) => {
            setEditing(undefined)
            setProgramId(nextProgramId)
            void listLessons(nextProgramId).then(setLessons).catch(() => setError(t('programs.loadError')))
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
  selfId: string
  onClose: () => void
  onSaved: (programId: string) => void
}) {
  const { t, i18n } = useTranslation()
  const editorRef = useRef<AdvancedEditorHandle>(null)
  const [courseId, setCourseId] = useState(programId)
  const [title, setTitle] = useState(localizedLabel(lesson?.title ?? emptyLocalized(), 'vi'))
  const [moduleName, setModuleName] = useState(localizedLabel(lesson?.moduleName ?? emptyLocalized(), 'vi'))
  const [contentType, setContentType] = useState<LessonType>(lesson?.contentType ?? 'text')
  const [contentUrl, setContentUrl] = useState(lesson?.contentUrl ?? '')
  const [content, setContent] = useState<JSONContent | string | undefined>(lesson?.contentUrl || undefined)
  const [orderIndex, setOrderIndex] = useState(lesson?.orderIndex ?? nextOrder)
  const [isPublished, setIsPublished] = useState(lesson?.isPublished ?? false)
  const [authorId, setAuthorId] = useState(lesson?.authorId || selfId)
  const [pane, setPane] = useState('write')
  const [pending, setPending] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [error, setError] = useState('')

  async function onSubmit() {
    if (!title.trim() || !courseId) {
      setError(t('programs.titleRequired'))
      return
    }
    const body = contentType === 'text' ? (editorRef.current?.getHTML() ?? contentUrl) : contentUrl
    setPending(true)
    setError('')
    try {
      await saveLesson(courseId, {
        id: lesson?.id,
        title: { ...emptyLocalized(), ...(lesson?.title ?? {}), vi: title.trim() },
        moduleName: { ...emptyLocalized(), ...(lesson?.moduleName ?? {}), vi: moduleName.trim() },
        contentType,
        contentUrl: body,
        isPublished,
        orderIndex,
        authorId: authorId || selfId,
      })
      onSaved(courseId)
    } catch {
      setError(t('programs.saveError'))
      setPending(false)
    }
  }

  async function onDelete() {
    if (!lesson) return
    if (!confirmDelete) {
      setConfirmDelete(true)
      return
    }
    setPending(true)
    setError('')
    try {
      await deleteLesson(lesson.id)
      onSaved(courseId)
    } catch {
      setError(t('programs.saveError'))
      setPending(false)
    }
  }

  return (
    <Dialog title={lesson ? t('programs.editLesson') : t('editor.newLesson')} onClose={onClose}>
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
          <label className="grid gap-1 text-sm font-medium text-ink" htmlFor="compose-course">
            {t('editor.assignCourse')}
            <select id="compose-course" className="ui-field" value={courseId} onChange={(event) => setCourseId(event.target.value)}>
              {programs.map((program) => (
                <option key={program.id} value={program.id}>
                  {localizedLabel(program.title, i18n.language) || t('programs.untitled')}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-1 text-sm font-medium text-ink" htmlFor="compose-order">
            {t('editor.sortOrder')}
            <input id="compose-order" className="ui-field" type="number" min={0} value={orderIndex} onChange={(event) => setOrderIndex(Number(event.target.value))} />
          </label>
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
          <label className="flex min-h-10 items-center gap-2 text-sm font-medium text-ink">
            <input type="checkbox" checked={isPublished} onChange={(event) => setIsPublished(event.target.checked)} />
            {t('programs.published')}
          </label>
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
        {error ? <p role="alert" className="text-sm text-danger">{error}</p> : null}
        <div className="ui-dialog-foot">
          {lesson ? (
            <button type="button" className="ui-inline bg-danger text-white" disabled={pending} onClick={() => void onDelete()}>
              {confirmDelete ? t('programs.confirmRemove') : t('programs.remove')}
            </button>
          ) : null}
          <button type="button" className="ui-inline ui-btn-ghost" onClick={onClose}>{t('programs.cancel')}</button>
          <button type="button" className="ui-inline ui-btn-primary" disabled={pending} onClick={() => void onSubmit()}>
            {pending ? t('programs.saving') : t('programs.save')}
          </button>
        </div>
      </div>
    </Dialog>
  )
}
