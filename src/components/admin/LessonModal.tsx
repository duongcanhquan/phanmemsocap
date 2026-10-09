import { useEffect, useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { emptyLocalized, hasLocalizedText, type LocalizedText } from '../../lib/localized'
import {
  deleteLesson,
  lessonTypes,
  listQuizzes,
  saveLesson,
  saveQuizzes,
  type LessonRecord,
  type LessonType,
  type QuizRecord,
} from '../../lib/programs'
import { Dialog } from '../ui/Dialog'
import { LocalizedFields } from './LocalizedFields'

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
  }
}

export function LessonModal({ programId, lesson, nextOrder, onClose, onSaved }: LessonModalProps) {
  const { t } = useTranslation()
  const [title, setTitle] = useState<LocalizedText>(lesson?.title ?? emptyLocalized())
  const [moduleName, setModuleName] = useState<LocalizedText>(lesson?.moduleName ?? emptyLocalized())
  const [contentType, setContentType] = useState<LessonType>(lesson?.contentType ?? 'text')
  const [contentUrl, setContentUrl] = useState(lesson?.contentUrl ?? '')
  const [isPublished, setIsPublished] = useState(lesson?.isPublished ?? false)
  const [quizzes, setQuizzes] = useState<QuizRecord[]>([])
  const [quizzesLoaded, setQuizzesLoaded] = useState(!lesson)
  const [error, setError] = useState('')
  const [pending, setPending] = useState(false)

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
    if (!hasLocalizedText(title)) {
      setError(t('programs.titleRequired'))
      return
    }
    if (lesson && !quizzesLoaded) return
    setPending(true)
    setError('')
    try {
      const lessonId = await saveLesson(programId, {
        id: lesson?.id,
        title,
        moduleName,
        contentType,
        contentUrl,
        isPublished,
        orderIndex: lesson?.orderIndex ?? nextOrder,
      })
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
          <label className="grid gap-1 text-sm font-medium text-ink" htmlFor="lesson-type">
            {t('programs.contentType')}
            <select
              id="lesson-type"
              className="ui-field"
              value={contentType}
              onChange={(event) => {
                const next = event.target.value as LessonType
                setContentType(next)
                if (next === 'quiz' && quizzes.length === 0) setQuizzes([newQuiz()])
              }}
            >
              {lessonTypes.map((type) => (
                <option key={type} value={type}>
                  {t(`programs.types.${type}`)}
                </option>
              ))}
            </select>
          </label>
          {contentType === 'text' ? (
            <label className="grid gap-1 text-sm font-medium text-ink" htmlFor="lesson-body">
              {t('programs.contentUrl')}
              <textarea
                id="lesson-body"
                className="ui-field min-h-28 py-2"
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
          <label className="flex min-h-11 items-center gap-2 text-sm font-medium text-ink">
            <input
              type="checkbox"
              checked={isPublished}
              onChange={(event) => setIsPublished(event.target.checked)}
            />
            {t('programs.published')}
          </label>
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          {quizzes.map((quiz, index) => (
                <QuizFields
                  key={quiz.id}
                  index={index}
                  quiz={quiz}
                  onChange={(next) => setQuizzes(quizzes.map((item) => (item.id === quiz.id ? next : item)))}
                  onRemove={() => setQuizzes(quizzes.filter((item) => item.id !== quiz.id))}
                />
          ))}
          <button type="button" className="ui-btn ui-btn-ghost border border-line" onClick={() => setQuizzes([...quizzes, newQuiz()])}>
            {t('programs.addQuestion')}
          </button>
          {error ? (
            <p role="alert" className="text-sm text-danger">
              {error}
            </p>
          ) : null}
        </div>
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

function QuizFields({
  quiz,
  index,
  onChange,
  onRemove,
}: {
  quiz: QuizRecord
  index: number
  onChange: (quiz: QuizRecord) => void
  onRemove: () => void
}) {
  const { t } = useTranslation()
  return (
    <div className="grid gap-3 rounded-2xl border border-line p-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-ink">
          {t('programs.question')} {index + 1}
        </p>
        <button type="button" className="ui-btn text-danger" onClick={onRemove}>
          {t('programs.remove')}
        </button>
      </div>
      <LocalizedFields
        id={`quiz-${quiz.id}`}
        label={t('programs.question')}
        value={quiz.question}
        onChange={(question) => onChange({ ...quiz, question })}
      />
      <label className="flex min-h-11 items-center gap-2 text-sm font-medium text-ink">
        <input
          type="checkbox"
          checked={quiz.isEssay}
          onChange={(event) => onChange({ ...quiz, isEssay: event.target.checked })}
        />
        {t('programs.essay')}
      </label>
      {quiz.isEssay
        ? null
        : quiz.options.map((option, optionIndex) => (
            <div key={`${quiz.id}-${optionIndex}`} className="grid gap-2">
              <label className="flex min-h-11 items-center gap-2 text-sm font-medium text-ink">
                <input
                  type="radio"
                  name={`correct-${quiz.id}`}
                  checked={quiz.correctOptionIndex === optionIndex}
                  onChange={() => onChange({ ...quiz, correctOptionIndex: optionIndex })}
                />
                {t('programs.correct')} {optionIndex + 1}
              </label>
              <LocalizedFields
                id={`option-${quiz.id}-${optionIndex}`}
                label={t('programs.option')}
                value={option}
                onChange={(next) =>
                  onChange({
                    ...quiz,
                    options: quiz.options.map((item, itemIndex) => (itemIndex === optionIndex ? next : item)),
                  })
                }
              />
            </div>
          ))}
      {quiz.isEssay ? null : (
        <button
          type="button"
          className="ui-btn ui-btn-ghost border border-line"
          onClick={() => onChange({ ...quiz, options: [...quiz.options, emptyLocalized()] })}
        >
          {t('programs.addOption')}
        </button>
      )}
    </div>
  )
}
