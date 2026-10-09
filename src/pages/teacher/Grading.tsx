import { X } from 'lucide-react'
import { useEffect, useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { useSearchParams } from 'react-router-dom'
import { ExportButtons } from '../../components/ExportButtons'
import { DataTable, FilterBar, SelectFilter } from '../../components/ui/DataSheet'
import { PageHeader } from '../../components/ui/PageHeader'
import { localizedLabel } from '../../lib/localized'
import { isSupabaseConfigured } from '../../lib/supabase'
import { listUngradedEssays, saveEssayGrade, type UngradedEssay } from '../../lib/teacher'

export function Grading({ embedded = false }: { embedded?: boolean }) {
  const { t, i18n } = useTranslation()
  const [rows, setRows] = useState<UngradedEssay[]>([])
  const [selected, setSelected] = useState<UngradedEssay | null>(null)
  const [score, setScore] = useState('')
  const [feedback, setFeedback] = useState('')
  const [loading, setLoading] = useState(isSupabaseConfigured)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')
  const [query, setQuery] = useState('')
  const [params] = useSearchParams()
  const [programFilter, setProgramFilter] = useState('all')
  const [classFilter, setClassFilter] = useState(params.get('class') || 'all')
  const studentFocus = params.get('student') || ''

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
    setScore(row.score === null ? '' : String(row.score))
    setFeedback('')
    setError('')
  }

  async function onSave(event: FormEvent) {
    event.preventDefault()
    if (!selected) return
    const value = Number(score)
    if (!Number.isFinite(value) || value < 0 || value > 10) {
      setError(t('teacher.scoreInvalid'))
      return
    }
    setPending(true)
    setError('')
    try {
      await saveEssayGrade(selected.id, value, feedback)
      setRows((current) => current.map((row) => (row.id === selected.id ? { ...row, score: value } : row)))
      setSelected(null)
    } catch {
      setError(t('teacher.saveError'))
    } finally {
      setPending(false)
    }
  }

  const programs = [...new Map(rows.map((row) => [row.programId, row.programTitle])).entries()]
  const classOptions = [...new Map(rows.filter((row) => row.classId).map((row) => [row.classId, row.className])).entries()]
  const visible = rows.filter((row) => {
    const lesson = localizedLabel(row.lessonTitle, i18n.language)
    const question = localizedLabel(row.question, i18n.language)
    const course = localizedLabel(row.programTitle, i18n.language)
    const matchesQuery = `${row.studentName} ${lesson} ${question} ${course}`.toLowerCase().includes(query.trim().toLowerCase())
    const matchesStudent = !studentFocus || row.studentId === studentFocus
    const matchesClass = classFilter === 'all' || row.classId === classFilter
    return matchesQuery && matchesStudent && matchesClass && (programFilter === 'all' || row.programId === programFilter)
  })

  const exportButtons = (
    <ExportButtons
      filename="cham-bai"
      title={t('teacher.gradingTitle')}
      headers={[t('teacher.student'), t('teacher.course'), t('programs.lessons'), t('teacher.question'), t('filters.submitted')]}
      rows={visible.map((row) => [
        row.studentName || t('enrollment.unnamed'),
        localizedLabel(row.programTitle, i18n.language) || t('programs.untitled'),
        localizedLabel(row.lessonTitle, i18n.language) || t('programs.untitled'),
        localizedLabel(row.question, i18n.language),
        row.submittedAt ? new Date(row.submittedAt).toLocaleString(i18n.language) : '—',
      ])}
    />
  )

  return (
    <div className={embedded ? 'grid min-h-0 gap-3' : 'ui-page'}>
      {embedded ? null : <PageHeader title={t('teacher.gradingTitle')} action={exportButtons} />}
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
      <div className={embedded ? 'grid min-h-0 gap-3' : 'ui-fill'}>
        {embedded ? <div className="flex justify-end">{exportButtons}</div> : null}
        <FilterBar query={query} onQuery={setQuery} count={visible.length}>
          <SelectFilter
            id="grade-class"
            label={t('reports.className')}
            value={classFilter}
            onChange={setClassFilter}
            options={[
              { value: 'all', label: t('filters.all') },
              ...classOptions.map(([id, name]) => ({ value: id, label: name || t('classesPage.untitled') })),
            ]}
          />
          <SelectFilter
            id="grade-program"
            label={t('teacher.course')}
            value={programFilter}
            onChange={setProgramFilter}
            options={[
              { value: 'all', label: t('filters.all') },
              ...programs.map(([id, title]) => ({ value: id, label: localizedLabel(title, i18n.language) || t('programs.untitled') })),
            ]}
          />
        </FilterBar>
        {rows.length > 0 && visible.length === 0 ? <p className="text-muted">{t('filters.noMatch')}</p> : null}
        <DataTable>
          <thead>
            <tr>
              <th>{t('teacher.student')}</th>
              <th>{t('reports.className')}</th>
              <th>{t('teacher.course')}</th>
              <th>{t('programs.lessons')}</th>
              <th>{t('teacher.question')}</th>
              <th>{t('filters.submitted')}</th>
              <th>{t('transcript.score')}</th>
              <th>{t('teacher.action')}</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((row) => (
              <tr key={row.id}>
                <td className="font-medium text-ink">{row.studentName || t('enrollment.unnamed')}</td>
                <td>{row.className || '—'}</td>
                <td>{localizedLabel(row.programTitle, i18n.language) || t('programs.untitled')}</td>
                <td>{localizedLabel(row.lessonTitle, i18n.language) || t('programs.untitled')}</td>
                <td className="max-w-xs truncate">{localizedLabel(row.question, i18n.language)}</td>
                <td>{row.submittedAt ? new Date(row.submittedAt).toLocaleString(i18n.language) : '—'}</td>
                <td className="tabular-nums font-semibold">{row.score === null ? t('teacher.ungraded') : row.score.toFixed(1)}</td>
                <td>
                  <button type="button" className="ui-inline ui-btn-primary" onClick={() => openRow(row)}>
                    {row.score === null ? t('teacher.grade') : t('teacher.regrade')}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </DataTable>
      </div>
      {selected ? (
        <div className="fixed inset-0 z-40 flex justify-end bg-ink/40">
          <form
            role="dialog"
            aria-modal="true"
            aria-labelledby="grade-title"
            className="ui-card flex h-[min(90dvh,100%)] w-full max-w-5xl flex-col gap-4 overflow-y-auto"
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
                max={10}
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
