import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { EnrollmentManager } from '../../components/admin/EnrollmentManager'
import { ExportButtons } from '../../components/ExportButtons'
import { Dialog } from '../../components/ui/Dialog'
import { DataTable, FilterBar, SelectFilter } from '../../components/ui/DataSheet'
import { PageHeader } from '../../components/ui/PageHeader'
import { localizedLabel } from '../../lib/localized'
import { countsInClass } from '../../lib/accounts'
import { assignClassProgram, classHeadcounts, createClass, deleteClass, listClassTeacherIds, listClasses, listPrograms, listTeachers, saveClassTeachers, updateClass, type CourseClass, type ProgramRecord, type StudentRecord } from '../../lib/programs'
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
  const [draftName, setDraftName] = useState('')
  const [draftStarts, setDraftStarts] = useState('')
  const [draftEnds, setDraftEnds] = useState('')
  const [editing, setEditing] = useState<CourseClass | null>(null)
  const [teachers, setTeachers] = useState<StudentRecord[]>([])
  const [classTeachers, setClassTeachers] = useState<Record<string, string[]>>({})
  const [pickedTeachers, setPickedTeachers] = useState<string[]>([])
  const [enrolling, setEnrolling] = useState<CourseClass | null>(null)
  const [pendingDelete, setPendingDelete] = useState('')
  const [pending, setPending] = useState(false)
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    setPickedTeachers(editing ? classTeachers[editing.id] ?? [] : [])
  }, [editing, classTeachers])

  useEffect(() => {
    if (!isSupabaseConfigured) return
    let active = true
    void Promise.all([listPrograms(), listClasses(), listTeacherRoster(), classHeadcounts(), listTeachers(), listClassTeacherIds()])
      .then(([courseRows, classRows, roster, headcounts, teacherRows, teacherMap]) => {
        if (!active) return
        setPrograms(courseRows)
        setClasses(classRows)
        setCounts(headcounts)
        const buckets: Record<string, number[]> = {}
        for (const row of roster.filter((item) => countsInClass(item.studyStatus))) {
          const list = buckets[row.classId] ?? []
          list.push(row.progress)
          buckets[row.classId] = list
        }
        const nextProgress: Record<string, number> = {}
        for (const [classId, values] of Object.entries(buckets)) {
          nextProgress[classId] = Math.round(values.reduce((sum, value) => sum + value, 0) / values.length)
        }
        setProgress(nextProgress)
        setTeachers(teacherRows)
        setClassTeachers(teacherMap)
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
    const matchesCourse = course === 'all' || (course === 'none' ? !item.programId : item.programId === course)
    return matchesCourse && `${item.name} ${courseName}`.toLowerCase().includes(query.trim().toLowerCase())
  })

  async function removeClass(classId: string) {
    setPending(true)
    setError('')
    try {
      await deleteClass(classId)
      setPendingDelete('')
      setEditing(null)
      setReloadKey((value) => value + 1)
    } catch {
      setError(t('programs.saveError'))
    } finally {
      setPending(false)
    }
  }

  async function saveClass() {
    if (!draftName.trim()) return
    setPending(true)
    setError('')
    try {
      await createClass({ name: draftName.trim(), startsOn: draftStarts, endsOn: draftEnds })
      setCreating(false)
      setDraftName('')
      setDraftStarts('')
      setDraftEnds('')
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
            <button
              type="button"
              className="ui-inline ui-btn-primary"
              onClick={() => setCreating(true)}
            >
              {t('classesPage.add')}
            </button>
            <ExportButtons
              filename="lop-hoc"
              title={t('classesPage.title')}
              headers={[t('classesPage.className'), t('filters.program'), t('classesPage.startsOn'), t('classesPage.endsOn'), t('classesPage.students'), t('teacher.progress')]}
              rows={visible.map((item) => {
                const program = programs.find((row) => row.id === item.programId)
                return [
                  item.name,
                  program ? localizedLabel(program.title, i18n.language) || t('programs.untitled') : t('classesPage.unassigned'),
                  item.startsOn || '—',
                  item.endsOn || '—',
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
            label={t('filters.program')}
            value={course}
            onChange={setCourse}
            options={[
              { value: 'all', label: t('filters.all') },
              { value: 'none', label: t('classesPage.unassigned') },
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
              <th>{t('filters.program')}</th>
              <th>{t('classesPage.startsOn')}</th>
              <th>{t('classesPage.endsOn')}</th>
              <th>{t('classesPage.students')}</th>
              <th>{t('teacher.progress')}</th>
              <th>{t('teacher.action')}</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((item) => {
              const program = programs.find((row) => row.id === item.programId)
              return (
                <tr key={item.id} className="ui-row" onClick={() => setEditing(item)}>
                  <td className="font-semibold text-ink">{item.name}</td>
                  <td>{program ? localizedLabel(program.title, i18n.language) || t('programs.untitled') : t('classesPage.unassigned')}</td>
                  <td>{item.startsOn || '—'}</td>
                  <td>{item.endsOn || '—'}</td>
                  <td className="tabular-nums">{counts[item.id] ?? 0}</td>
                  <td className="tabular-nums">{progress[item.id] ?? 0}%</td>
                  <td>
                    <span className="inline-flex gap-2" onClick={(event) => event.stopPropagation()}>
                      <button type="button" className="ui-inline ui-btn-ghost" onClick={() => setEditing(item)}>
                        {t('accounts.edit')}
                      </button>
                      <button type="button" className="ui-inline ui-btn-primary" onClick={() => setEnrolling(item)}>
                        {t('classesPage.manage')}
                      </button>
                      {pendingDelete === item.id ? (
                        <button type="button" className="ui-inline bg-danger text-white" disabled={pending} onClick={() => void removeClass(item.id)}>
                          {t('programs.confirmRemove')}
                        </button>
                      ) : (
                        <button type="button" className="ui-inline text-danger" onClick={() => setPendingDelete(item.id)}>
                          {t('programs.remove')}
                        </button>
                      )}
                    </span>
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
              {t('classesPage.className')}
              <input className="ui-field" value={draftName} onChange={(event) => setDraftName(event.target.value)} required />
            </label>
            <label className="grid gap-1 text-sm font-medium text-ink">
              {t('classesPage.startsOn')}
              <input className="ui-field" type="date" value={draftStarts} onChange={(event) => setDraftStarts(event.target.value)} />
            </label>
            <label className="grid gap-1 text-sm font-medium text-ink">
              {t('classesPage.endsOn')}
              <input className="ui-field" type="date" value={draftEnds} onChange={(event) => setDraftEnds(event.target.value)} />
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
      {editing ? (
        <Dialog title={editing.name} onClose={() => setEditing(null)}>
          <form
            className="grid gap-4"
            onSubmit={(event) => {
              event.preventDefault()
              const form = event.currentTarget
              const name = (form.elements.namedItem('class-name') as HTMLInputElement).value.trim()
              const startsOn = (form.elements.namedItem('class-start') as HTMLInputElement).value
              const endsOn = (form.elements.namedItem('class-end') as HTMLInputElement).value
              const programId = (form.elements.namedItem('class-program') as HTMLSelectElement).value
              if (!name) return
              setPending(true)
              void updateClass(editing.id, { name, startsOn, endsOn })
                .then(() => assignClassProgram(editing.id, programId || null))
                .then(() => saveClassTeachers(editing.id, pickedTeachers))
                .then(() => {
                  setEditing(null)
                  setReloadKey((value) => value + 1)
                })
                .catch(() => setError(t('programs.saveError')))
                .finally(() => setPending(false))
            }}
          >
            <fieldset className="grid gap-2 text-sm font-medium text-ink">
              <legend>{t('classesPage.teachers')}</legend>
              {teachers.map((teacher) => (
                <label key={teacher.id} className="flex min-h-9 items-center gap-2 font-normal">
                  <input
                    type="checkbox"
                    checked={pickedTeachers.includes(teacher.id)}
                    onChange={() => {
                      setPickedTeachers((current) => current.includes(teacher.id) ? current.filter((id) => id !== teacher.id) : [...current, teacher.id])
                    }}
                  />
                  {teacher.fullName || teacher.id}
                </label>
              ))}
            </fieldset>
            <label className="grid gap-1 text-sm font-medium text-ink">
              {t('classesPage.className')}
              <input className="ui-field" name="class-name" defaultValue={editing.name} required />
            </label>
            <label className="grid gap-1 text-sm font-medium text-ink">
              {t('filters.program')}
              <select className="ui-field" name="class-program" defaultValue={editing.programId}>
                <option value="">{t('classesPage.unassigned')}</option>
                {programs.map((program) => (
                  <option key={program.id} value={program.id}>
                    {localizedLabel(program.title, i18n.language) || t('programs.untitled')}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-1 text-sm font-medium text-ink">
              {t('classesPage.startsOn')}
              <input className="ui-field" name="class-start" type="date" defaultValue={editing.startsOn} />
            </label>
            <label className="grid gap-1 text-sm font-medium text-ink">
              {t('classesPage.endsOn')}
              <input className="ui-field" name="class-end" type="date" defaultValue={editing.endsOn} />
            </label>
            <div className="ui-dialog-foot">
              {pendingDelete === editing.id ? (
                <button type="button" className="ui-btn bg-danger text-white" disabled={pending} onClick={() => void removeClass(editing.id)}>
                  {t('programs.confirmRemove')}
                </button>
              ) : (
                <button type="button" className="ui-btn bg-danger text-white" disabled={pending} onClick={() => setPendingDelete(editing.id)}>
                  {t('programs.remove')}
                </button>
              )}
              <button type="button" className="ui-btn ui-btn-ghost border border-line" onClick={() => setEditing(null)}>
                {t('accounts.cancel')}
              </button>
              <button type="submit" className="ui-btn ui-btn-primary" disabled={pending}>
                {t('programs.save')}
              </button>
            </div>
          </form>
        </Dialog>
      ) : null}
      {enrolling ? (
        <Dialog
          title={enrolling.name}
          onClose={() => {
            setEnrolling(null)
            setReloadKey((value) => value + 1)
          }}
        >
          <EnrollmentManager key={enrolling.id} classId={enrolling.id} />
        </Dialog>
      ) : null}
    </div>
  )
}
