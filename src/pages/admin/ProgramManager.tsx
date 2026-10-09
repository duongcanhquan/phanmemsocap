import { Plus } from 'lucide-react'
import { useEffect, useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { LocalizedFields } from '../../components/admin/LocalizedFields'
import { ExportButtons } from '../../components/ExportButtons'
import { DataTable, FilterBar, SelectFilter } from '../../components/ui/DataSheet'
import { Dialog } from '../../components/ui/Dialog'
import { PageHeader } from '../../components/ui/PageHeader'
import { emptyLocalized, hasLocalizedText, localizedLabel, type LocalizedText } from '../../lib/localized'
import { createClass, createProgram, deleteProgram, listClasses, listProgramTeacherIds, listPrograms, listTeachers, saveProgramTeachers, updateProgram, type CourseClass, type ProgramRecord, type StudentRecord } from '../../lib/programs'
import { isSupabaseConfigured } from '../../lib/supabase'

export function ProgramManager() {
  const { t, i18n } = useTranslation()
  const [programs, setPrograms] = useState<ProgramRecord[]>([])
  const [teachers, setTeachers] = useState<StudentRecord[]>([])
  const [teacherMap, setTeacherMap] = useState<Record<string, string[]>>({})
  const [loading, setLoading] = useState(isSupabaseConfigured)
  const [error, setError] = useState('')
  const [creating, setCreating] = useState(false)
  const [editing, setEditing] = useState<ProgramRecord | null>(null)
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState('all')
  const [category, setCategory] = useState('all')

  useEffect(() => {
    if (!isSupabaseConfigured) return
    let active = true
    void Promise.all([listPrograms(), listTeachers(), listProgramTeacherIds()])
      .then(([rows, staff, assigned]) => {
        if (!active) return
        setPrograms(rows)
        setTeachers(staff)
        setTeacherMap(assigned)
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
  }, [t])

  const categories = [...new Set(programs.map((program) => program.category).filter(Boolean))]
  const visiblePrograms = programs.filter((program) => {
    const title = localizedLabel(program.title, i18n.language).toLowerCase()
    const matchesQuery = `${title} ${program.category}`.toLowerCase().includes(query.trim().toLowerCase())
    const matchesStatus = status === 'all' || (status === 'active' ? program.isActive : !program.isActive)
    const matchesCategory = category === 'all' || program.category === category
    return matchesQuery && matchesStatus && matchesCategory
  })

  return (
    <div className="ui-page">
      <PageHeader
        title={t('programs.title')}
        action={
          <>
          <ExportButtons
            filename="khoa-hoc"
            title={t('programs.title')}
            headers={[t('programs.name'), t('programs.category'), t('filters.status')]}
            rows={visiblePrograms.map((program) => [
              localizedLabel(program.title, i18n.language) || t('programs.untitled'),
              program.category || '—',
              program.isActive ? t('programs.active') : t('programs.inactive'),
            ])}
          />
          <button type="button" className="ui-inline ui-btn-primary" onClick={() => setCreating(true)}>
            <Plus aria-hidden="true" className="size-4" />
            {t('programs.create')}
          </button>
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
      {!loading && programs.length === 0 && isSupabaseConfigured ? (
        <p className="text-muted">{t('programs.empty')}</p>
      ) : null}
      <div className="ui-fill">
        <FilterBar query={query} onQuery={setQuery} count={visiblePrograms.length}>
          <SelectFilter
            id="program-category"
            label={t('filters.category')}
            value={category}
            onChange={setCategory}
            options={[{ value: 'all', label: t('filters.all') }, ...categories.map((item) => ({ value: item, label: item }))]}
          />
          <SelectFilter
            id="program-status"
            label={t('filters.status')}
            value={status}
            onChange={setStatus}
            options={[
              { value: 'all', label: t('filters.all') },
              { value: 'active', label: t('programs.active') },
              { value: 'inactive', label: t('programs.inactive') },
            ]}
          />
        </FilterBar>
        {programs.length > 0 && visiblePrograms.length === 0 ? <p className="text-muted">{t('filters.noMatch')}</p> : null}
        <DataTable>
          <thead>
            <tr>
              <th>{t('programs.name')}</th>
              <th>{t('programs.category')}</th>
              <th>{t('programs.teacher')}</th>
              <th>{t('filters.status')}</th>
              <th>{t('teacher.action')}</th>
            </tr>
          </thead>
          <tbody>
            {visiblePrograms.map((program) => {
              const title = localizedLabel(program.title, i18n.language) || t('programs.untitled')
              return (
                <tr key={program.id} className="ui-row" onClick={() => setEditing(program)}>
                  <td className="font-semibold text-ink">{title}</td>
                  <td>{program.category || '—'}</td>
                  <td>{teacherNames(program, teacherMap, teachers, t('programs.unassigned'))}</td>
                  <td>{program.isActive ? t('programs.active') : t('programs.inactive')}</td>
                  <td>
                    <Link to={`/programs/${program.id}`} className="ui-inline ui-btn-primary" onClick={(event) => event.stopPropagation()}>
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
        <ProgramDialog
          program={null}
          teachers={teachers}
          teacherIds={[]}
          onClose={() => setCreating(false)}
          onSaved={(saved, staffIds) => {
            setPrograms((current) => [saved, ...current])
            setTeacherMap((current) => ({ ...current, [saved.id]: staffIds }))
            setCreating(false)
          }}
        />
      ) : null}
      {editing ? (
        <ProgramDialog
          key={editing.id}
          program={editing}
          teachers={teachers}
          teacherIds={editing ? assignedIds(editing, teacherMap) : []}
          onClose={() => setEditing(null)}
          onSaved={(saved, staffIds) => {
            setPrograms((current) => current.map((item) => (item.id === saved.id ? saved : item)))
            setTeacherMap((current) => ({ ...current, [saved.id]: staffIds }))
            setEditing(null)
          }}
          onDeleted={(programId) => {
            setPrograms((current) => current.filter((item) => item.id !== programId))
            setEditing(null)
          }}
        />
      ) : null}
    </div>
  )
}

function assignedIds(program: ProgramRecord, teacherMap: Record<string, string[]>) {
  const extra = teacherMap[program.id] ?? []
  return [...new Set([program.teacherId, ...extra].filter(Boolean))]
}

function teacherNames(program: ProgramRecord, teacherMap: Record<string, string[]>, teachers: StudentRecord[], empty: string) {
  const names = assignedIds(program, teacherMap)
    .map((id) => teachers.find((teacher) => teacher.id === id)?.fullName)
    .filter(Boolean)
  return names.length > 0 ? names.join(', ') : empty
}

function ProgramDialog({
  program,
  teachers,
  teacherIds,
  onClose,
  onSaved,
  onDeleted,
}: {
  program: ProgramRecord | null
  teachers: StudentRecord[]
  teacherIds: string[]
  onClose: () => void
  onSaved: (program: ProgramRecord, teacherIds: string[]) => void
  onDeleted?: (programId: string) => void
}) {
  const { t } = useTranslation()
  const [title, setTitle] = useState<LocalizedText>(program?.title ?? emptyLocalized())
  const [description, setDescription] = useState<LocalizedText>(program?.description ?? emptyLocalized())
  const [category, setCategory] = useState(program?.category ?? '')
  const [coverImageUrl, setCoverImageUrl] = useState(program?.coverImageUrl ?? '')
  const [staffIds, setStaffIds] = useState<string[]>(teacherIds)
  const [isActive, setIsActive] = useState(program?.isActive ?? true)
  const [error, setError] = useState('')
  const [pending, setPending] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [classes, setClasses] = useState<CourseClass[]>([])
  const [className, setClassName] = useState('')
  const [classStarts, setClassStarts] = useState('')
  const [classEnds, setClassEnds] = useState('')

  useEffect(() => {
    if (!program) return
    let active = true
    void listClasses(program.id)
      .then((rows) => {
        if (active) setClasses(rows)
      })
      .catch(() => {
        if (active) setError(t('programs.loadError'))
      })
    return () => {
      active = false
    }
  }, [program, t])

  async function addClass() {
    if (!program || !className.trim()) return
    setPending(true)
    setError('')
    try {
      await createClass(program.id, { name: className.trim(), startsOn: classStarts, endsOn: classEnds })
      setClasses(await listClasses(program.id))
      setClassName('')
      setClassStarts('')
      setClassEnds('')
    } catch {
      setError(t('programs.saveError'))
    } finally {
      setPending(false)
    }
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    if (!hasLocalizedText(title)) {
      setError(t('programs.titleRequired'))
      return
    }
    setPending(true)
    const input = { title, description, category, coverImageUrl, isActive, teacherId: staffIds[0] ?? '' }
    try {
      const id = program ? program.id : await createProgram(input)
      if (program) await updateProgram(program.id, input)
      await saveProgramTeachers(id, staffIds)
      onSaved({ ...(program ?? { id }), ...input, id }, staffIds)
    } catch {
      setError(t('programs.saveError'))
      setPending(false)
    }
  }

  async function onDelete() {
    if (!program || !onDeleted) return
    if (!confirmDelete) {
      setConfirmDelete(true)
      return
    }
    setPending(true)
    setError('')
    try {
      await deleteProgram(program.id)
      onDeleted(program.id)
    } catch {
      setError(t('programs.saveError'))
      setPending(false)
    }
  }

  return (
    <Dialog title={program ? t('programs.editProgram') : t('programs.create')} onClose={onClose}>
      <form className="grid gap-5 lg:grid-cols-2" onSubmit={(event) => void onSubmit(event)}>
          <LocalizedFields id="new-title" label={t('programs.name')} value={title} onChange={setTitle} />
          <LocalizedFields
            id="new-description"
            label={t('programs.description')}
            value={description}
            onChange={setDescription}
            multiline
          />
          <label className="grid gap-1 text-sm font-medium" htmlFor="new-category">
            {t('programs.category')}
            <input id="new-category" className="ui-field" value={category} onChange={(event) => setCategory(event.target.value)} />
          </label>
          <label className="grid gap-1 text-sm font-medium" htmlFor="new-cover">
            {t('programs.cover')}
            <input
              id="new-cover"
              className="ui-field"
              value={coverImageUrl}
              onChange={(event) => setCoverImageUrl(event.target.value)}
            />
          </label>
          {program ? (
            <div className="grid gap-3 rounded-xl border border-line p-3 lg:col-span-2">
              <p className="text-sm font-semibold text-ink">{t('classesPage.inCourse')}</p>
              {classes.length === 0 ? <p className="text-sm text-muted">{t('classesPage.empty')}</p> : null}
              {classes.length > 0 ? (
                <ul className="grid gap-1 text-sm text-ink">
                  {classes.map((item) => (
                    <li key={item.id}>
                      {item.name}
                      {item.startsOn || item.endsOn ? ` · ${item.startsOn || '—'} – ${item.endsOn || '—'}` : ''}
                    </li>
                  ))}
                </ul>
              ) : null}
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-[1fr_auto_auto_auto]">
                <label className="grid gap-1 text-sm font-medium text-ink">
                  {t('classesPage.className')}
                  <input className="ui-field" value={className} onChange={(event) => setClassName(event.target.value)} />
                </label>
                <label className="grid gap-1 text-sm font-medium text-ink">
                  {t('classesPage.startsOn')}
                  <input className="ui-field" type="date" value={classStarts} onChange={(event) => setClassStarts(event.target.value)} />
                </label>
                <label className="grid gap-1 text-sm font-medium text-ink">
                  {t('classesPage.endsOn')}
                  <input className="ui-field" type="date" value={classEnds} onChange={(event) => setClassEnds(event.target.value)} />
                </label>
                <button type="button" className="ui-inline ui-btn-primary self-end" disabled={pending || !className.trim()} onClick={() => void addClass()}>
                  {t('classesPage.add')}
                </button>
              </div>
            </div>
          ) : null}
          <fieldset className="grid gap-2 text-sm font-medium lg:col-span-2">
            <legend>{t('programs.teacher')}</legend>
            <div className="flex flex-wrap gap-2">
              {teachers.map((teacher) => {
                const checked = staffIds.includes(teacher.id)
                return (
                  <label key={teacher.id} className={checked ? 'ui-inline ui-btn-primary' : 'ui-inline ui-btn-ghost'}>
                    <input
                      type="checkbox"
                      className="sr-only"
                      checked={checked}
                      onChange={() => setStaffIds((current) => checked ? current.filter((id) => id !== teacher.id) : [...current, teacher.id])}
                    />
                    {teacher.fullName || teacher.id}
                  </label>
                )
              })}
            </div>
          </fieldset>
          <label className="flex min-h-11 items-center gap-2 text-sm font-medium">
            <input type="checkbox" checked={isActive} onChange={(event) => setIsActive(event.target.checked)} />
            {t('programs.active')}
          </label>
          {coverImageUrl ? (
            <img src={coverImageUrl} alt="" className="aspect-video w-full rounded-xl object-cover lg:col-span-2" />
          ) : null}
          {error ? (
            <p role="alert" className="text-sm text-danger lg:col-span-2">
              {error}
            </p>
          ) : null}
          <div className="ui-dialog-foot lg:col-span-2">
            {program && onDeleted ? (
              <button type="button" className="ui-btn bg-danger text-white" disabled={pending} onClick={() => void onDelete()}>
                {confirmDelete ? t('programs.confirmRemove') : t('programs.remove')}
              </button>
            ) : null}
            <button type="button" className="ui-btn ui-btn-ghost border border-line" onClick={onClose}>
              {t('programs.cancel')}
            </button>
            <button type="submit" className="ui-btn ui-btn-primary" disabled={pending}>
              {pending ? t('programs.saving') : t('programs.save')}
            </button>
          </div>
      </form>
    </Dialog>
  )
}
