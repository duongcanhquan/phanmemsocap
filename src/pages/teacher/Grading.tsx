import { X } from 'lucide-react'
import { useEffect, useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { PageHeader } from '../../components/ui/PageHeader'
import { localizedLabel } from '../../lib/localized'
import { isSupabaseConfigured } from '../../lib/supabase'
import { listUngradedEssays, saveEssayGrade, type UngradedEssay } from '../../lib/teacher'

export function Grading() {
  const { t, i18n } = useTranslation()
  const [rows, setRows] = useState<UngradedEssay[]>([])
  const [selected, setSelected] = useState<UngradedEssay | null>(null)
  const [score, setScore] = useState('')
  const [feedback, setFeedback] = useState('')
  const [loading, setLoading] = useState(isSupabaseConfigured)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!isSupabaseConfigured) return
    let active = true
    void listUngradedEssays()
      .then((next) => {
        if (active) setRows(next)
      })
      .catch(() => {
        if (active) setError(t('teacher.loadError'))
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [t])

  function openRow(row: UngradedEssay) {
    setSelected(row)
    setScore('')
    setFeedback('')
    setError('')
  }

  async function onSave(event: FormEvent) {
    event.preventDefault()
    if (!selected) return
    const value = Number(score)
    if (!Number.isFinite(value)) {
      setError(t('teacher.scoreInvalid'))
      return
    }
    setPending(true)
    setError('')
    try {
      await saveEssayGrade(selected.id, value, feedback)
      setRows((current) => current.filter((row) => row.id !== selected.id))
      setSelected(null)
    } catch {
      setError(t('teacher.saveError'))
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="ui-page">
      <PageHeader title={t('teacher.gradingTitle')} description={t('teacher.gradingLead')} />
      {!isSupabaseConfigured ? (
        <p role="status" className="rounded-2xl bg-warning-bg px-4 py-3 text-sm text-warning">
          {t('supabase.missing')}
        </p>
      ) : null}
      {loading ? <p role="status">{t('teacher.loading')}</p> : null}
      {error && !selected ? (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : null}
      {!loading && rows.length === 0 && isSupabaseConfigured ? <p className="text-muted">{t('teacher.emptyGrading')}</p> : null}
      <ul className="overflow-hidden rounded-2xl bg-white shadow-sm">
        {rows.map((row) => (
          <li key={row.id} className="border-b border-line last:border-0">
            <button
              type="button"
              className="flex min-h-14 w-full items-center justify-between gap-3 px-4 py-3 text-left transition duration-200 hover:bg-canvas"
              onClick={() => openRow(row)}
            >
              <span>
                <span className="block font-medium text-ink">{row.studentName || t('enrollment.unnamed')}</span>
                <span className="text-sm text-muted">
                  {localizedLabel(row.lessonTitle, i18n.language) || t('programs.untitled')}
                </span>
              </span>
              <span className="text-sm font-medium text-accent">{t('teacher.grade')}</span>
            </button>
          </li>
        ))}
      </ul>
      {selected ? (
        <div className="fixed inset-0 z-40 flex justify-end bg-ink/40">
          <form
            role="dialog"
            aria-modal="true"
            aria-labelledby="grade-title"
            className="flex h-full w-full max-w-md flex-col gap-4 overflow-y-auto bg-white p-5 shadow-xl"
            onSubmit={(event) => void onSave(event)}
          >
            <div className="flex items-start justify-between gap-3">
              <h2 id="grade-title" className="text-lg font-semibold text-ink">
                {selected.studentName || t('enrollment.unnamed')}
              </h2>
              <button type="button" className="ui-btn ui-btn-ghost" aria-label={t('teacher.close')} onClick={() => setSelected(null)}>
                <X aria-hidden="true" className="size-4" />
              </button>
            </div>
            <p className="text-sm text-muted">
              {localizedLabel(selected.lessonTitle, i18n.language) || t('programs.untitled')}
            </p>
            <div>
              <p className="text-sm font-medium text-ink">{t('teacher.question')}</p>
              <p className="mt-1 text-sm leading-relaxed text-ink">
                {localizedLabel(selected.question, i18n.language) || t('programs.untitled')}
              </p>
            </div>
            <div>
              <p className="text-sm font-medium text-ink">{t('teacher.answer')}</p>
              <p className="mt-1 text-sm leading-relaxed whitespace-pre-wrap text-ink">
                {selected.essayAnswer || t('teacher.noAnswer')}
              </p>
            </div>
            <label className="grid gap-1 text-sm font-medium text-ink" htmlFor="essay-score">
              {t('teacher.score')}
              <input
                id="essay-score"
                type="number"
                min={0}
                step="0.1"
                inputMode="decimal"
                className="ui-field"
                value={score}
                onChange={(event) => setScore(event.target.value)}
                required
              />
            </label>
            <label className="grid gap-1 text-sm font-medium text-ink" htmlFor="essay-feedback">
              {t('teacher.feedback')}
              <textarea
                id="essay-feedback"
                className="ui-field min-h-28 py-2"
                value={feedback}
                onChange={(event) => setFeedback(event.target.value)}
              />
            </label>
            {error ? (
              <p role="alert" className="text-sm text-danger">
                {error}
              </p>
            ) : null}
            <button type="submit" className="ui-btn ui-btn-primary" disabled={pending}>
              {pending ? t('teacher.saving') : t('teacher.saveGrade')}
            </button>
          </form>
        </div>
      ) : null}
    </div>
  )
}
