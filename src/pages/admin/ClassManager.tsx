import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ClassSetupDialog } from '../../components/admin/ClassSetupDialog'
import { ExportButtons } from '../../components/ExportButtons'
import { DataTable, FilterBar, SelectFilter } from '../../components/ui/DataSheet'
import { PageHeader } from '../../components/ui/PageHeader'
import { localizedLabel } from '../../lib/localized'
import { countsInClass } from '../../lib/accounts'
import {
  classHeadcounts,
  deleteClass,
  listClassTeacherIds,
  listClasses,
  listPrograms,
  listTeachers,
  type CourseClass,
  type ProgramRecord,
  type StudentRecord,
} from '../../lib/programs'
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
  const [editing, setEditing] = useState<CourseClass | null>(null)
  const [teachers, setTeachers] = useState<StudentRecord[]>([])
  const [classTeachers, setClassTeachers] = useState<Record<string, string[]>>({})
  const [pendingDelete, setPendingDelete] = useState('')
  const [pending, setPending] = useState(false)
  const [reloadKey, setReloadKey] = useState(0)

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
      setError(t('classesPage.saveError'))
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
              disabled={!isSupabaseConfigured || loading}
              onClick={() => {
                setError('')
                setCreating(true)
              }}
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
                      <button type="button" className="ui-inline ui-btn-primary" onClick={() => setEditing(item)}>
                        {t('accounts.edit')}
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
        <ClassSetupDialog
          mode="create"
          programs={programs}
          teachers={teachers}
          onClose={() => setCreating(false)}
          onSaved={() => {
            setCreating(false)
            setReloadKey((value) => value + 1)
          }}
        />
      ) : null}
      {editing ? (
        <ClassSetupDialog
          mode="edit"
          classroom={editing}
          programs={programs}
          teachers={teachers}
          initialTeacherIds={classTeachers[editing.id] ?? []}
          pendingDelete={pendingDelete === editing.id}
          onAskDelete={() => setPendingDelete(editing.id)}
          onDelete={() => void removeClass(editing.id)}
          onClose={() => {
            setEditing(null)
            setPendingDelete('')
          }}
          onSaved={() => {
            setEditing(null)
            setPendingDelete('')
            setReloadKey((value) => value + 1)
          }}
        />
      ) : null}
    </div>
  )
}
