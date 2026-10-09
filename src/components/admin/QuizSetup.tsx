import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { emptyLocalized } from '../../lib/localized'
import { downloadQuizTemplate, readQuizSheet } from '../../lib/quizSheet'
import type { LessonQuizSettings, QuizRecord } from '../../lib/programs'
import { LocalizedFields } from './LocalizedFields'

type QuizSetupProps = {
  quizzes: QuizRecord[]
  settings: LessonQuizSettings
  onQuizzes: (quizzes: QuizRecord[]) => void
  onSettings: (settings: LessonQuizSettings) => void
}

function blankQuiz(essay = false): QuizRecord {
  return {
    id: `new-${crypto.randomUUID()}`,
    question: emptyLocalized(),
    options: [emptyLocalized(), emptyLocalized()],
    correctOptionIndex: 0,
    isEssay: essay,
    points: 1,
  }
}

export function QuizSetup({ quizzes, settings, onQuizzes, onSettings }: QuizSetupProps) {
  const { t } = useTranslation()
  const fileRef = useRef<HTMLInputElement>(null)
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')

  async function onUpload(file: File | undefined) {
    if (!file) return
    setError('')
    setNotice('')
    try {
      const imported = await readQuizSheet(file)
      if (imported.length === 0) {
        setError(t('exam.emptyFile'))
        return
      }
      onQuizzes([...quizzes, ...imported])
      setNotice(t('exam.imported', { count: imported.length }))
    } catch {
      setError(t('exam.templateError'))
    }
  }

  return (
    <section className="grid gap-4 rounded-2xl border border-line p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-base font-semibold text-ink">{t('exam.title')}</h3>
        <div className="flex flex-wrap gap-2">
          <button type="button" className="ui-inline ui-btn-ghost" onClick={() => void downloadQuizTemplate()}>
            {t('exam.download')}
          </button>
          <button type="button" className="ui-inline ui-btn-ghost" onClick={() => fileRef.current?.click()}>
            {t('exam.upload')}
          </button>
          <input
            ref={fileRef}
            type="file"
            accept=".xlsx,.xls"
            className="hidden"
            onChange={(event) => {
              void onUpload(event.target.files?.[0])
              event.target.value = ''
            }}
          />
        </div>
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <label className="grid gap-1 text-sm font-medium text-ink" htmlFor="quiz-pass">
          {t('exam.passMark')}
          <input
            id="quiz-pass"
            className="ui-field"
            type="number"
            min={0}
            max={10}
            step="0.5"
            value={settings.passMark}
            onChange={(event) => onSettings({ ...settings, passMark: Number(event.target.value) })}
          />
        </label>
        <label className="flex min-h-11 items-end gap-2 pb-2 text-sm font-medium text-ink">
          <input
            type="checkbox"
            checked={settings.shuffleQuestions}
            onChange={(event) => onSettings({ ...settings, shuffleQuestions: event.target.checked })}
          />
          {t('exam.shuffleQuestions')}
        </label>
        <label className="flex min-h-11 items-end gap-2 pb-2 text-sm font-medium text-ink">
          <input
            type="checkbox"
            checked={settings.shuffleOptions}
            onChange={(event) => onSettings({ ...settings, shuffleOptions: event.target.checked })}
          />
          {t('exam.shuffleOptions')}
        </label>
      </div>
      <p className="text-sm text-muted">{t('exam.passHint')}</p>
      {quizzes.map((quiz, index) => (
        <QuestionCard
          key={quiz.id}
          index={index}
          quiz={quiz}
          onChange={(next) => onQuizzes(quizzes.map((item) => (item.id === quiz.id ? next : item)))}
          onRemove={() => onQuizzes(quizzes.filter((item) => item.id !== quiz.id))}
        />
      ))}
      <div className="flex flex-wrap gap-2">
        <button type="button" className="ui-inline ui-btn-primary" onClick={() => onQuizzes([...quizzes, blankQuiz(false)])}>
          {t('exam.addChoice')}
        </button>
        <button type="button" className="ui-inline ui-btn-ghost" onClick={() => onQuizzes([...quizzes, blankQuiz(true)])}>
          {t('exam.addEssay')}
        </button>
      </div>
      {notice ? <p role="status" className="text-sm font-medium text-ink">{notice}</p> : null}
      {error ? <p role="alert" className="text-sm text-danger">{error}</p> : null}
    </section>
  )
}

function QuestionCard({
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
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-semibold text-ink">
          {t('programs.question')} {index + 1}
          {' · '}
          {quiz.isEssay ? t('programs.essay') : t('exam.choice')}
        </p>
        <button type="button" className="ui-btn text-danger" onClick={onRemove}>
          {t('programs.remove')}
        </button>
      </div>
      <label className="grid gap-1 text-sm font-medium text-ink" htmlFor={`points-${quiz.id}`}>
        {t('exam.points')}
        <input
          id={`points-${quiz.id}`}
          className="ui-field max-w-32"
          type="number"
          min={1}
          max={20}
          value={quiz.points}
          onChange={(event) => onChange({ ...quiz, points: Number(event.target.value) })}
        />
      </label>
      <LocalizedFields
        id={`quiz-${quiz.id}`}
        label={t('programs.question')}
        value={quiz.question}
        onChange={(question) => onChange({ ...quiz, question })}
      />
      {quiz.isEssay ? (
        <p className="text-sm text-muted">{t('exam.essayHint')}</p>
      ) : (
        <>
          {quiz.options.map((option, optionIndex) => (
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
          <button
            type="button"
            className="ui-btn ui-btn-ghost border border-line"
            onClick={() => onChange({ ...quiz, options: [...quiz.options, emptyLocalized()] })}
          >
            {t('programs.addOption')}
          </button>
        </>
      )}
    </div>
  )
}
