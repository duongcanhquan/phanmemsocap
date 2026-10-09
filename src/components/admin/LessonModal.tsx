import { useEffect, useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { emptyLocalized, hasLocalizedText, localizedLabel, type LocalizedText } from '../../lib/localized'
import {
  deleteLesson,
  lessonCourseIds,
  lessonTypes,
  listPrograms,
  getLessonQuizSettings,
  listQuizzes,
  saveLesson,
  saveQuizzes,
  syncLessonCourses,
  type LessonQuizSettings,
  type LessonRecord,
  type LessonType,
  type ProgramRecord,
  type QuizRecord,
} from '../../lib/programs'
import { Dialog } from '../ui/Dialog'
import { LocalizedFields } from './LocalizedFields'
import { QuizSetup } from './QuizSetup'

type LessonModalProps = {
  programId: string
  lesson: LessonRecord | null
  nextOrder: number
  onClose: () => void
  onSaved: () => void
}

function newQuiz(): QuizRecord {
  return {
    id: `new-${crypto.randomUUID()}`,
    question: emptyLocalized(),
    options: [emptyLocalized(), emptyLocalized()],
    correctOptionIndex: 0,
    isEssay: false,
    points: 1,
  }
}

export function LessonModal({ programId, lesson, nextOrder, onClose, onSaved }: LessonModalProps) {
  const { t, i18n } = useTranslation()
  const [programs, setPrograms] = useState<ProgramRecord[]>([])
  const [courseIds, setCourseIds] = useState<string[]>(programId ? [programId] : [])
  const [orderIndex, setOrderIndex] = useState(lesson?.orderIndex ?? nextOrder)
  const [title, setTitle] = useState<LocalizedText>(lesson?.title ?? emptyLocalized())
  const [moduleName, setModuleName] = useState<LocalizedText>(lesson?.moduleName ?? emptyLocalized())
  const [contentType, setContentType] = useState<LessonType>(lesson?.contentType ?? 'text')
  const [contentUrl, setContentUrl] = useState(lesson?.contentUrl ?? '')
  const [isPublished, setIsPublished] = useState(lesson?.isPublished ?? false)
  const [quizzes, setQuizzes] = useState<QuizRecord[]>([])
  const [quizSettings, setQuizSettings] = useState<LessonQuizSettings>({ passMark: 5, shuffleQuestions: false, shuffleOptions: false })
  const [quizzesLoaded, setQuizzesLoaded] = useState(!lesson)
  const [error, setError] = useState('')
  const [pending, setPending] = useState(false)

  useEffect(() => {
    let active = true
    void listPrograms()
      .then((rows) => {
        if (active) setPrograms(rows)
      })
      .catch(() => {
        if (active) setError(t('programs.loadError'))
      })
    if (lesson) {
      void getLessonQuizSettings(lesson.id)
        .then((settings) => {
          if (active) setQuizSettings(settings)
        })
        .catch(() => undefined)
      void lessonCourseIds(lesson.id)
        .then((ids) => {
          if (active && ids.length > 0) setCourseIds(ids)
        })
        .catch(() => undefined)
    }
    return () => {
      active = false
    }
  }, [lesson, t])

  useEffect(() => {
    if (!lesson) return
    let active = true
    void listQuizzes(lesson.id)
      .then((rows) => {
        if (active) setQuizzes(rows)
      })
      .catch(() => {
        if (active) setError(t('programs.loadError'))
      })
      .finally(() => {
        if (active) setQuizzesLoaded(true)
      })
    return () => {
      active = false
    }
  }, [lesson, t])

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    if (!hasLocalizedText(title) || courseIds.length === 0) {
      setError(t('programs.titleRequired'))
      return
    }
    if (lesson && !quizzesLoaded) return
    setPending(true)
    setError('')
    try {
      const lessonId = await saveLesson(courseIds[0], {
        id: lesson?.id,
        title,
        moduleName,
        contentType,
        contentUrl,
        isPublished,
        orderIndex,
        quiz: {
          passMark: Math.min(10, Math.max(0, quizSettings.passMark)),
          shuffleQuestions: quizSettings.shuffleQuestions,
          shuffleOptions: quizSettings.shuffleOptions,
        },
      })
      await syncLessonCourses(lessonId, courseIds, programId, orderIndex)
      await saveQuizzes(lessonId, quizzes)
      onSaved()
    } catch {
      setError(t('programs.saveError'))
      setPending(false)
    }
  }

  async function onDelete() {
    if (!lesson) return
    setPending(true)
    try {
      await deleteLesson(lesson.id)
      onSaved()
    } catch {
      setError(t('programs.saveError'))
      setPending(false)
    }
  }

  return (
    <Dialog title={lesson ? t('programs.editLesson') : t('programs.addLesson')} onClose={onClose}>
      <form className="grid gap-6" onSubmit={(event) => void onSubmit(event)}>
        <div className="grid gap-4 lg:grid-cols-2">
          <LocalizedFields id="lesson-title" label={t('programs.name')} value={title} onChange={setTitle} />
          <LocalizedFields id="lesson-module" label={t('programs.module')} value={moduleName} onChange={setModuleName} />
          <div className="grid gap-2 lg:col-span-2">
            <p className="text-sm font-medium text-ink">{t('programs.contentType')}</p>
            <div className="flex flex-wrap gap-2">
              {lessonTypes.map((type) => (
                <button
                  key={type}
                  type="button"
                  className={contentType === type ? 'ui-inline ui-btn-primary' : 'ui-inline ui-btn-ghost'}
                  aria-pressed={contentType === type}
                  onClick={() => {
                    setContentType(type)
                    if (type === 'quiz' && quizzes.length === 0) setQuizzes([newQuiz()])
                  }}
                >
                  {t(`programs.types.${type}`)}
                </button>
              ))}
            </div>
          </div>
          {contentType === 'text' || contentType === 'slides' ? (
            <label className="grid gap-1 text-sm font-medium text-ink lg:col-span-2" htmlFor="lesson-body">
              {contentType === 'slides' ? t('programs.slideBody') : t('programs.contentUrl')}
              <textarea
                id="lesson-body"
                className="ui-field min-h-40 py-2"
                value={contentUrl}
                onChange={(event) => setContentUrl(event.target.value)}
              />
            </label>
          ) : contentType === 'quiz' ? null : (
            <label className="grid gap-1 text-sm font-medium text-ink" htmlFor="lesson-url">
              {t('programs.contentUrl')}
              <input
                id="lesson-url"
                className="ui-field"
                value={contentUrl}
                onChange={(event) => setContentUrl(event.target.value)}
              />
            </label>
          )}
          <fieldset className="grid gap-2 text-sm font-medium text-ink lg:col-span-2">
            <legend>{t('editor.assignCourse')}</legend>
            {programs.map((program) => (
              <label key={program.id} className="flex min-h-9 items-center gap-2 font-normal">
                <input
                  type="checkbox"
                  checked={courseIds.includes(program.id)}
                  onChange={() => {
                    setCourseIds((current) => {
                      if (current.includes(program.id)) {
                        const next = current.filter((id) => id !== program.id)
                        return next.length === 0 ? current : next
                      }
                      return [...current, program.id]
                    })
                  }}
                />
                {localizedLabel(program.title, i18n.language) || t('programs.untitled')}
              </label>
            ))}
          </fieldset>
          <label className="grid gap-1 text-sm font-medium text-ink" htmlFor="lesson-order">
            {t('editor.sortOrder')}
            <input
              id="lesson-order"
              className="ui-field"
              type="number"
              min={0}
              value={orderIndex}
              onChange={(event) => setOrderIndex(Number(event.target.value))}
            />
          </label>
          <label className="flex min-h-11 items-center gap-2 text-sm font-medium text-ink">
            <input
              type="checkbox"
              checked={isPublished}
              onChange={(event) => setIsPublished(event.target.checked)}
            />
            {t('programs.published')}
          </label>
        </div>
        <QuizSetup quizzes={quizzes} settings={quizSettings} onQuizzes={setQuizzes} onSettings={setQuizSettings} />
        {error ? (
          <p role="alert" className="text-sm text-danger">
            {error}
          </p>
        ) : null}
        <div className="ui-dialog-foot">
          {lesson ? (
            <button type="button" className="ui-btn text-danger" disabled={pending} onClick={() => void onDelete()}>
              {t('programs.remove')}
            </button>
          ) : null}
          <button type="button" className="ui-btn ui-btn-ghost border border-line" onClick={onClose}>
            {t('programs.cancel')}
          </button>
          <button type="submit" className="ui-btn ui-btn-primary" disabled={pending || (Boolean(lesson) && !quizzesLoaded)}>
            {pending ? t('programs.saving') : t('programs.save')}
          </button>
        </div>
      </form>
    </Dialog>
  )
}
