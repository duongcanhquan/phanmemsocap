import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { localizedLabel } from '../../lib/localized'
import {
  loadExistingGrades,
  loadLessonQuestions,
  passingScore,
  submitLessonQuiz,
  type QuizGrade,
  type StudentQuestion,
} from '../../lib/student'

type QuizEngineProps = {
  lessonId: string
  programId: string
  nextLessonId: string | null
}

type AnswerState = {
  option?: number
  essay?: string
}

export function QuizEngine({ lessonId, programId, nextLessonId }: QuizEngineProps) {
  return <QuizSession key={lessonId} lessonId={lessonId} programId={programId} nextLessonId={nextLessonId} />
}

function lessonIsPassed(questions: StudentQuestion[], grades: QuizGrade[]) {
  return (
    questions.length > 0 &&
    questions.every((question) => {
      const grade = grades.find((item) => item.quizId === question.id)
      return grade?.score != null && grade.score >= passingScore
    })
  )
}

function QuizSession({ lessonId, programId, nextLessonId }: QuizEngineProps) {
  const { t, i18n } = useTranslation()
  const [questions, setQuestions] = useState<StudentQuestion[]>([])
  const [index, setIndex] = useState(0)
  const [answers, setAnswers] = useState<Record<string, AnswerState>>({})
  const [grades, setGrades] = useState<QuizGrade[]>([])
  const [passed, setPassed] = useState(false)
  const [loading, setLoading] = useState(true)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')
  const [submitted, setSubmitted] = useState(false)

  useEffect(() => {
    let active = true
    void loadLessonQuestions(lessonId)
      .then(async (nextQuestions) => {
        if (!active) return
        setQuestions(nextQuestions)
        const existing = await loadExistingGrades(nextQuestions.map((question) => question.id))
        if (!active) return
        setGrades(existing)
        setSubmitted(existing.length > 0 && existing.length >= nextQuestions.length)
        setPassed(lessonIsPassed(nextQuestions, existing))
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
  }, [lessonId, t])

  const question = questions[index]

  async function onSubmit() {
    const missing = questions.some((item) =>
      item.isEssay ? !answers[item.id]?.essay?.trim() : answers[item.id]?.option == null,
    )
    if (missing) {
      setError(t('student.answerRequired'))
      return
    }
    setPending(true)
    setError('')
    try {
      const result = await submitLessonQuiz(
        lessonId,
        questions.map((item) => ({
          quizId: item.id,
          selectedOptionIndex: answers[item.id]?.option,
          essayAnswer: answers[item.id]?.essay,
        })),
      )
      setGrades(result.results)
      setPassed(result.lessonPassed)
      setSubmitted(true)
    } catch {
      setError(t('student.submitError'))
    } finally {
      setPending(false)
    }
  }

  if (loading) return <p role="status">{t('student.loading')}</p>
  if (questions.length === 0) return <p className="text-sm text-muted">{t('student.noQuiz')}</p>

  if (submitted) {
    return (
      <div className="grid gap-3">
        {questions.map((item) => {
          const grade = grades.find((entry) => entry.quizId === item.id)
          const waiting = grade?.score == null
          const correct = item.isEssay ? (grade?.score ?? 0) >= passingScore : grade?.isCorrect === true
          return (
            <p
              key={item.id}
              className={[
                'rounded-2xl px-4 py-3 text-sm font-medium',
                waiting ? 'bg-warning-bg text-warning' : correct ? 'bg-emerald-50 text-emerald-800' : 'bg-red-50 text-danger',
              ].join(' ')}
            >
              {localizedLabel(item.question, i18n.language)}
              {' · '}
              {waiting ? t('student.waiting') : correct ? t('student.correct') : t('student.incorrect')}
            </p>
          )
        })}
        {passed && nextLessonId ? (
          <Link to={`/student/${programId}/${nextLessonId}`} className="ui-btn ui-btn-primary w-full">
            {t('student.continue')}
          </Link>
        ) : null}
        {error ? (
          <p role="alert" className="text-sm text-danger">
            {error}
          </p>
        ) : null}
      </div>
    )
  }

  if (!question) return null

  return (
    <div className="grid gap-3">
      <p className="text-sm text-muted">
        {index + 1}/{questions.length}
      </p>
      <h2 className="text-lg font-semibold text-ink">{localizedLabel(question.question, i18n.language)}</h2>
      {question.isEssay ? (
        <textarea
          className="ui-field min-h-28 py-2"
          value={answers[question.id]?.essay ?? ''}
          aria-label={t('student.answer')}
          onChange={(event) =>
            setAnswers({ ...answers, [question.id]: { ...answers[question.id], essay: event.target.value } })
          }
        />
      ) : (
        <div className="grid gap-2">
          {question.options.map((option, optionIndex) => {
            const selected = answers[question.id]?.option === optionIndex
            return (
              <button
                key={`${question.id}-${optionIndex}`}
                type="button"
                aria-pressed={selected}
                className={[
                  'min-h-12 cursor-pointer rounded-2xl border px-4 py-3 text-left text-base transition duration-200',
                  selected ? 'border-ink bg-ink font-semibold text-white' : 'border-line bg-white text-ink',
                ].join(' ')}
                onClick={() => setAnswers({ ...answers, [question.id]: { option: optionIndex } })}
              >
                {localizedLabel(option, i18n.language)}
              </button>
            )
          })}
        </div>
      )}
      {error ? (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : null}
      <div className="grid grid-cols-2 gap-2">
        {index > 0 ? (
          <button type="button" className="ui-btn ui-btn-ghost border border-line" onClick={() => setIndex(index - 1)}>
            {t('student.previous')}
          </button>
        ) : null}
        {index < questions.length - 1 ? (
          <button
            type="button"
            className={`ui-btn ui-btn-primary ${index === 0 ? 'col-span-2' : ''}`}
            onClick={() => setIndex(index + 1)}
          >
            {t('student.next')}
          </button>
        ) : (
          <button
            type="button"
            className={`ui-btn ui-btn-primary ${index === 0 ? 'col-span-2' : ''}`}
            disabled={pending}
            onClick={() => void onSubmit()}
          >
            {pending ? t('student.submitting') : t('student.submit')}
          </button>
        )}
      </div>
    </div>
  )
}
