import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { ExportButtons } from '../../components/ExportButtons'
import { Dialog } from '../../components/ui/Dialog'
import { DataTable, FilterBar, SelectFilter } from '../../components/ui/DataSheet'
import { PageHeader } from '../../components/ui/PageHeader'
import { localizedLabel } from '../../lib/localized'
import { countsInClass } from '../../lib/accounts'
import { createClass, listClasses, listPrograms, type CourseClass, type ProgramRecord } from '../../lib/programs'
import { isSupabaseConfigured } from '../../lib/supabase'
import { listTeacherRoster } from '../../lib/teacher'

export function ClassManager() {
  const { t, i18n } = useTranslation()
  const [programs, setPrograms] = useState<ProgramRecord[]>([])
  const [classes, setClasses] = useState<CourseClass[]>([])
  const [counts, setCounts] = useState<Record<string, number>>({})
  const [progress, setProgress] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(isSupabaseConfigured)
  const [error, setError] = useState('')
  const [query, setQuery] = useState('')
  const [course, setCourse] = useState('all')
  const [creating, setCreating] = useState(false)
  const [draftCourse, setDraftCourse] = useState('')
  const [draftName, setDraftName] = useState('')
  const [pending, setPending] = useState(false)
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    if (!isSupabaseConfigured) return
    let active = true
    void Promise.all([listPrograms(), listClasses(), listTeacherRoster()])
      .then(([courseRows, classRows, roster]) => {
        if (!active) return
        setPrograms(courseRows)
        setClasses(classRows)
        const nextCounts: Record<string, number> = {}
        const buckets: Record<string, number[]> = {}
        for (const row of roster.filter((item) => countsInClass(item.studyStatus))) {
          nextCounts[row.classId] = (nextCounts[row.classId] ?? 0) + 1
          const list = buckets[row.classId] ?? []
          list.push(row.progress)
          buckets[row.classId] = list
        }
        const nextProgress: Record<string, number> = {}
        for (const [classId, values] of Object.entries(buckets)) {
          nextProgress[classId] = Math.round(values.reduce((sum, value) => sum + value, 0) / values.length)
        }
        setCounts(nextCounts)
        setProgress(nextProgress)
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
  }, [t, reloadKey])

  const visible = classes.filter((item) => {
    const program = programs.find((row) => row.id === item.programId)
    const courseName = program ? localizedLabel(program.title, i18n.language) : ''
    const matchesCourse = course === 'all' || item.programId === course
    return matchesCourse && `${item.name} ${courseName}`.toLowerCase().includes(query.trim().toLowerCase())
  })

  async function saveClass() {
    if (!draftCourse || !draftName.trim()) return
    setPending(true)
    setError('')
    try {
      await createClass(draftCourse, draftName.trim())
      setCreating(false)
      setDraftName('')
      setReloadKey((value) => value + 1)
    } catch {
      setError(t('programs.saveError'))
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="ui-page">
      <PageHeader
        title={t('classesPage.title')}
        action={
          <>
            <button type="button" className="ui-inline ui-btn-primary" onClick={() => setCreating(true)}>
              {t('classesPage.add')}
            </button>
            <ExportButtons
              filename="lop-hoc"
              title={t('classesPage.title')}
              headers={[t('classesPage.className'), t('teacher.course'), t('classesPage.students'), t('teacher.progress')]}
              rows={visible.map((item) => {
                const program = programs.find((row) => row.id === item.programId)
                return [
                  item.name,
                  program ? localizedLabel(program.title, i18n.language) || t('programs.untitled') : t('programs.untitled'),
                  counts[item.id] ?? 0,
                  `${progress[item.id] ?? 0}%`,
                ]
              })}
            />
          </>
        }
      />
      {!isSupabaseConfigured ? (
        <p role="status" className="rounded-2xl bg-warning-bg px-4 py-3 text-sm text-warning">
          {t('supabase.missing')}
        </p>
      ) : null}
      {loading ? <p role="status">{t('programs.loading')}</p> : null}
      {error ? (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : null}
      {!loading && classes.length === 0 && isSupabaseConfigured ? <p className="text-muted">{t('classesPage.empty')}</p> : null}
      <div className="ui-fill">
        <FilterBar query={query} onQuery={setQuery} count={visible.length}>
          <SelectFilter
            id="class-course"
            label={t('teacher.course')}
            value={course}
            onChange={setCourse}
            options={[
              { value: 'all', label: t('filters.all') },
              ...programs.map((program) => ({
                value: program.id,
                label: localizedLabel(program.title, i18n.language) || t('programs.untitled'),
              })),
            ]}
          />
        </FilterBar>
        {classes.length > 0 && visible.length === 0 ? <p className="text-muted">{t('filters.noMatch')}</p> : null}
        <DataTable>
          <thead>
            <tr>
              <th>{t('classesPage.className')}</th>
              <th>{t('teacher.course')}</th>
              <th>{t('classesPage.students')}</th>
              <th>{t('teacher.progress')}</th>
              <th>{t('teacher.action')}</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((item) => {
              const program = programs.find((row) => row.id === item.programId)
              return (
                <tr key={item.id}>
                  <td className="font-semibold text-ink">{item.name}</td>
                  <td>{program ? localizedLabel(program.title, i18n.language) || t('programs.untitled') : t('programs.untitled')}</td>
                  <td className="tabular-nums">{counts[item.id] ?? 0}</td>
                  <td className="tabular-nums">{progress[item.id] ?? 0}%</td>
                  <td>
                    <Link to={`/programs/${item.programId}#class`} className="ui-inline ui-btn-primary">
                      {t('classesPage.manage')}
                    </Link>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </DataTable>
      </div>
      {creating ? (
        <Dialog title={t('classesPage.add')} onClose={() => setCreating(false)}>
          <form
            className="grid gap-4"
            onSubmit={(event) => {
              event.preventDefault()
              void saveClass()
            }}
          >
            <label className="grid gap-1 text-sm font-medium text-ink">
              {t('teacher.course')}
              <select className="ui-field" value={draftCourse} onChange={(event) => setDraftCourse(event.target.value)} required>
                <option value="">{t('classesPage.pickCourse')}</option>
                {programs.map((program) => (
                  <option key={program.id} value={program.id}>
                    {localizedLabel(program.title, i18n.language) || t('programs.untitled')}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-1 text-sm font-medium text-ink">
              {t('classesPage.className')}
              <input className="ui-field" value={draftName} onChange={(event) => setDraftName(event.target.value)} required />
            </label>
            <div className="ui-dialog-foot">
              <button type="button" className="ui-btn ui-btn-ghost border border-line" onClick={() => setCreating(false)}>
                {t('accounts.cancel')}
              </button>
              <button type="submit" className="ui-btn ui-btn-primary" disabled={pending}>
                {t('programs.save')}
              </button>
            </div>
          </form>
        </Dialog>
      ) : null}
    </div>
  )
}
