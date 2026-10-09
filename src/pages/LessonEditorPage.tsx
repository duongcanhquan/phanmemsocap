import type { JSONContent } from '@tiptap/core'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { AILessonGenerator } from '../components/editor/AILessonGenerator'
import { AdvancedEditor, type AdvancedEditorHandle } from '../components/editor/AdvancedEditor'
import { PageHeader } from '../components/ui/PageHeader'
import { localizedLabel } from '../lib/localized'
import { listLessons, listPrograms, saveLessonContent, type LessonRecord, type ProgramRecord } from '../lib/programs'
import { isSupabaseConfigured } from '../lib/supabase'

export function LessonEditorPage() {
  const { t, i18n } = useTranslation()
  const [mode, setMode] = useState<'teacher' | 'student'>('teacher')
  const [content, setContent] = useState<JSONContent | string | undefined>()
  const [programs, setPrograms] = useState<ProgramRecord[]>([])
  const [lessons, setLessons] = useState<LessonRecord[]>([])
  const [programId, setProgramId] = useState('')
  const [lessonId, setLessonId] = useState('')
  const [loading, setLoading] = useState(isSupabaseConfigured)
  const [pending, setPending] = useState(false)
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')
  const editorRef = useRef<AdvancedEditorHandle>(null)
  const textLessons = lessons.filter((lesson) => lesson.contentType === 'text')
  const selectedLessonId = textLessons.some((lesson) => lesson.id === lessonId) ? lessonId : ''

  useEffect(() => {
    if (!isSupabaseConfigured) return
    let active = true
    void listPrograms()
      .then((rows) => {
        if (active) setPrograms(rows)
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
    if (!programId) return
    let active = true
    void listLessons(programId)
      .then((rows) => {
        if (!active) return
        setLessons(rows)
        const firstText = rows.find((lesson) => lesson.contentType === 'text')
        setLessonId(firstText?.id ?? '')
        setContent(firstText?.contentUrl || undefined)
      })
      .catch(() => {
        if (active) setError(t('programs.loadError'))
      })
    return () => {
      active = false
    }
  }, [programId, t])

  function chooseLesson(nextId: string) {
    const lesson = textLessons.find((item) => item.id === nextId)
    setLessonId(nextId)
    setContent(lesson?.contentUrl || undefined)
    setNotice('')
    setError('')
  }

  async function onSave() {
    if (!selectedLessonId) {
      setError(t('editor.pickLesson'))
      return
    }
    setPending(true)
    setNotice('')
    setError('')
    try {
      const html = editorRef.current?.getHTML() ?? ''
      await saveLessonContent(selectedLessonId, html)
      setLessons((current) =>
        current.map((lesson) => (lesson.id === selectedLessonId ? { ...lesson, contentUrl: html } : lesson)),
      )
      setNotice(t('editor.saved'))
    } catch {
      setError(t('editor.saveError'))
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="flex min-h-0 w-full flex-1 flex-col gap-3">
      <PageHeader
        title={t('editor.title')}
        description={t('editor.subtitle')}
        action={
          <button
            type="button"
            className="ui-btn ui-btn-ghost border border-line shadow-sm"
            onClick={() => setMode((current) => (current === 'teacher' ? 'student' : 'teacher'))}
          >
            {mode === 'teacher' ? t('editor.preview') : t('editor.edit')}
          </button>
        }
      />
      {!isSupabaseConfigured ? (
        <p role="status" className="rounded-2xl bg-warning-bg px-4 py-3 text-sm text-warning">
          {t('supabase.missing')}
        </p>
      ) : null}
      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] sm:items-end">
        <label className="grid gap-1 text-sm font-medium text-ink" htmlFor="editor-program">
          {t('editor.program')}
          <select
            id="editor-program"
            className="ui-field"
            value={programId}
            disabled={loading}
            onChange={(event) => {
              setProgramId(event.target.value)
              setLessonId('')
              setContent(undefined)
              setNotice('')
            }}
          >
            <option value="">{t('editor.pickProgram')}</option>
            {programs.map((program) => (
              <option key={program.id} value={program.id}>
                {localizedLabel(program.title, i18n.language) || t('programs.untitled')}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1 text-sm font-medium text-ink" htmlFor="editor-lesson">
          {t('editor.lesson')}
          <select
            id="editor-lesson"
            className="ui-field"
            value={selectedLessonId}
            disabled={!programId}
            onChange={(event) => chooseLesson(event.target.value)}
          >
            <option value="">{t('editor.pickLesson')}</option>
            {textLessons.map((lesson) => (
              <option key={lesson.id} value={lesson.id}>
                {localizedLabel(lesson.title, i18n.language) || t('programs.untitled')}
              </option>
            ))}
          </select>
        </label>
        <button type="button" className="ui-btn ui-btn-primary" disabled={pending || !selectedLessonId} onClick={() => void onSave()}>
          {pending ? t('editor.saving') : t('editor.save')}
        </button>
      </div>
      <p className="text-sm text-muted">{t('editor.textOnly')}</p>
      {notice ? <p role="status" className="text-sm font-medium text-accent">{notice}</p> : null}
      {error ? (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : null}
      <div className="grid min-h-0 flex-1 items-stretch gap-3 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <AdvancedEditor
          key={`${selectedLessonId}-${mode}`}
          mode={mode}
          content={content}
          onChange={setContent}
          editorRef={editorRef}
        />
        {mode === 'teacher' ? (
          <AILessonGenerator
            getContent={() => editorRef.current?.getText() ?? ''}
            onInsert={(markdown) => editorRef.current?.insertMarkdown(markdown)}
          />
        ) : null}
      </div>
    </div>
  )
}
