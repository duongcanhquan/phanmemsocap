import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { assignClassProgram, listClasses, type CourseClass } from '../../lib/programs'

interface ClassAssignmentProps {
  programId: string
  canEdit?: boolean
}

export function ClassAssignment({ programId, canEdit = true }: ClassAssignmentProps) {
  const { t } = useTranslation()
  const [classes, setClasses] = useState<CourseClass[]>([])
  const [pick, setPick] = useState('')
  const [error, setError] = useState('')
  const [pending, setPending] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    void listClasses()
      .then((rows) => {
        if (!active) return
        setClasses(rows)
        setError('')
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
  }, [programId, t])

  const assigned = classes.filter((item) => item.programId === programId)
  const free = classes.filter((item) => !item.programId)

  async function assign() {
    if (!pick) return
    setPending(true)
    setError('')
    try {
      await assignClassProgram(pick, programId)
      setClasses(await listClasses())
      setPick('')
    } catch {
      setError(t('programs.saveError'))
    } finally {
      setPending(false)
    }
  }

  async function detach(classId: string) {
    setPending(true)
    setError('')
    try {
      await assignClassProgram(classId, null)
      setClasses(await listClasses())
    } catch {
      setError(t('programs.saveError'))
    } finally {
      setPending(false)
    }
  }

  return (
    <section id="class" className="grid gap-3">
      <h2 className="text-sm font-semibold text-ink">{t('programs.assignedClasses')}</h2>
      {loading ? <p role="status">{t('programs.loading')}</p> : null}
      {!loading && assigned.length === 0 ? <p className="text-sm text-muted">{t('classesPage.empty')}</p> : null}
      {assigned.length > 0 ? (
        <ul className="grid gap-2">
          {assigned.map((item) => (
            <li key={item.id} className="flex flex-wrap items-center justify-between gap-2 text-sm text-ink">
              <span>
                {item.name}
                {item.startsOn || item.endsOn ? ` · ${item.startsOn || '—'} – ${item.endsOn || '—'}` : ''}
              </span>
              {canEdit ? (
                <button type="button" className="ui-inline ui-btn-ghost" disabled={pending} onClick={() => void detach(item.id)}>
                  {t('classesPage.detach')}
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
      {canEdit ? (
        <div className="flex flex-wrap items-end gap-2">
          <label className="grid min-w-48 flex-1 gap-1 text-sm font-medium text-ink">
            {t('programs.assignClass')}
            <select className="ui-field" value={pick} onChange={(event) => setPick(event.target.value)}>
              <option value="">{t('classesPage.pickClass')}</option>
              {free.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </label>
          <button type="button" className="ui-inline ui-btn-primary" disabled={pending || !pick} onClick={() => void assign()}>
            {t('programs.assignClass')}
          </button>
        </div>
      ) : null}
      {canEdit && !loading && free.length === 0 ? <p className="text-sm text-muted">{t('classesPage.noFree')}</p> : null}
      {error ? (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : null}
    </section>
  )
}
