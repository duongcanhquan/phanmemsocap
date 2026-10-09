import type { JSONContent } from '@tiptap/core'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { AILessonGenerator } from '../components/editor/AILessonGenerator'
import { AdvancedEditor, type AdvancedEditorHandle } from '../components/editor/AdvancedEditor'
import { PageHeader } from '../components/ui/PageHeader'
import { Tabs } from '../components/ui/Tabs'
import { localizedLabel } from '../lib/localized'
import { listLessons, listPrograms, saveLessonContent, type LessonRecord, type ProgramRecord } from '../lib/programs'
import { isSupabaseConfigured } from '../lib/supabase'

export function LessonEditorPage() {
  const { t, i18n } = useTranslation()
  const [mode, setMode] = useState<'teacher' | 'student'>('teacher')
  const [pane, setPane] = useState('write')
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
    <div className="ui-page">
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
      <div className="flex shrink-0 items-end gap-3 overflow-x-auto">
        <label className="grid min-w-56 flex-1 gap-1 text-sm font-medium text-ink" htmlFor="editor-program">
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
        <label className="grid min-w-56 flex-1 gap-1 text-sm font-medium text-ink" htmlFor="editor-lesson">
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
        <button type="button" className="ui-btn ui-btn-primary shrink-0" disabled={pending || !selectedLessonId} onClick={() => void onSave()}>
          {pending ? t('editor.saving') : t('editor.save')}
        </button>
      </div>
      <p className="shrink-0 truncate text-sm text-muted">{t('editor.textOnly')}</p>
      <Tabs
        label={t('panels.label')}
        value={pane}
        onChange={setPane}
        tabs={[
          { id: 'write', label: t('panels.write') },
          { id: 'assist', label: t('panels.assist') },
        ]}
      />
      {notice ? <p role="status" className="text-sm font-medium text-accent">{notice}</p> : null}
      {error ? (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : null}
      <div className="ui-fill">
        <div className={pane === 'write' || mode !== 'teacher' ? 'h-full min-h-0' : 'hidden'}>
          <AdvancedEditor
            key={`${selectedLessonId}-${mode}`}
            mode={mode}
            content={content}
            onChange={setContent}
            editorRef={editorRef}
          />
        </div>
        {pane === 'assist' && mode === 'teacher' ? (
          <AILessonGenerator
            getContent={() => editorRef.current?.getText() ?? ''}
            onInsert={(markdown) => {
              setPane('write')
              editorRef.current?.insertMarkdown(markdown)
            }}
          />
        ) : null}
      </div>
    </div>
  )
}
