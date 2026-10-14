import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { localizedLabel } from '../../lib/localized'
import {
  assignClassProgram,
  createClass,
  enrollStudents,
  listEnrollments,
  listStudents,
  removeEnrollments,
  saveClassTeachers,
  updateClass,
  type CourseClass,
  type ProgramRecord,
  type StudentRecord,
} from '../../lib/programs'
import { Dialog } from '../ui/Dialog'
import { Tabs } from '../ui/Tabs'

type ClassSetupDialogProps = {
  mode: 'create' | 'edit'
  classroom?: CourseClass | null
  programs: ProgramRecord[]
  teachers: StudentRecord[]
  initialTeacherIds?: string[]
  onClose: () => void
  onSaved: () => void
  onDelete?: () => void
  pendingDelete?: boolean
  onAskDelete?: () => void
}

export function ClassSetupDialog({
  mode,
  classroom,
  programs,
  teachers,
  initialTeacherIds = [],
  onClose,
  onSaved,
  onDelete,
  pendingDelete = false,
  onAskDelete,
}: ClassSetupDialogProps) {
  const { t, i18n } = useTranslation()
  const [tab, setTab] = useState('setup')
  const [name, setName] = useState(classroom?.name ?? '')
  const [programId, setProgramId] = useState(classroom?.programId ?? '')
  const [startsOn, setStartsOn] = useState(classroom?.startsOn ?? '')
  const [endsOn, setEndsOn] = useState(classroom?.endsOn ?? '')
  const [pickedTeachers, setPickedTeachers] = useState<string[]>(initialTeacherIds)
  const [students, setStudents] = useState<StudentRecord[]>([])
  const [pickedStudents, setPickedStudents] = useState<string[]>([])
  const [enrollmentByStudent, setEnrollmentByStudent] = useState<Record<string, string>>({})
  const [teacherQuery, setTeacherQuery] = useState('')
  const [studentQuery, setStudentQuery] = useState('')
  const [pending, setPending] = useState(false)
  const [loadingPeople, setLoadingPeople] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    void listStudents()
      .then(async (rows) => {
        if (!active) return
        setStudents(rows)
        if (mode === 'edit' && classroom?.id) {
          const enrolled = await listEnrollments(classroom.id)
          if (!active) return
          const map: Record<string, string> = {}
          for (const item of enrolled) map[item.studentId] = item.id
          setEnrollmentByStudent(map)
          setPickedStudents(Object.keys(map))
        } else {
          setEnrollmentByStudent({})
          setPickedStudents([])
        }
        setLoadingPeople(false)
      })
      .catch(() => {
        if (!active) return
        setError(t('programs.loadError'))
        setLoadingPeople(false)
      })
    return () => {
      active = false
    }
  }, [classroom?.id, mode, t])

  const teacherIdsKey = initialTeacherIds.slice().sort().join(',')
  useEffect(() => {
    setPickedTeachers(teacherIdsKey ? teacherIdsKey.split(',') : [])
  }, [teacherIdsKey])

  const visibleTeachers = useMemo(() => {
    const needle = teacherQuery.trim().toLowerCase()
    if (!needle) return teachers
    return teachers.filter((teacher) => (teacher.fullName || teacher.id).toLowerCase().includes(needle))
  }, [teachers, teacherQuery])

  const visibleStudents = useMemo(() => {
    const needle = studentQuery.trim().toLowerCase()
    if (!needle) return students
    return students.filter((student) => (student.fullName || student.id).toLowerCase().includes(needle))
  }, [students, studentQuery])

  function toggle(list: string[], id: string, onChange: (next: string[]) => void) {
    onChange(list.includes(id) ? list.filter((item) => item !== id) : [...list, id])
  }

  async function save() {
    if (!name.trim()) {
      setError(t('classesPage.nameRequired'))
      setTab('setup')
      return
    }
    if (startsOn && endsOn && endsOn < startsOn) {
      setError(t('classesPage.dateOrder'))
      setTab('setup')
      return
    }
    setPending(true)
    setError('')
    try {
      if (mode === 'create') {
        await createClass({
          name: name.trim(),
          programId: programId || undefined,
          startsOn,
          endsOn,
          teacherIds: pickedTeachers,
          studentIds: pickedStudents,
        })
      } else if (classroom) {
        await updateClass(classroom.id, { name: name.trim(), startsOn, endsOn })
        await assignClassProgram(classroom.id, programId || null)
        await saveClassTeachers(classroom.id, pickedTeachers)
        const current = new Set(pickedStudents)
        const removeIds = Object.entries(enrollmentByStudent)
          .filter(([studentId]) => !current.has(studentId))
          .map(([, enrollmentId]) => enrollmentId)
        const addIds = pickedStudents.filter((id) => !enrollmentByStudent[id])
        if (removeIds.length) await removeEnrollments(removeIds)
        if (addIds.length) await enrollStudents(classroom.id, addIds)
      }
      onSaved()
    } catch {
      setError(t('classesPage.saveError'))
    } finally {
      setPending(false)
    }
  }

  return (
    <Dialog title={mode === 'create' ? t('classesPage.add') : name || t('classesPage.untitled')} onClose={onClose}>
      <div className="grid gap-4">
        <Tabs
          label={t('panels.label')}
          value={tab}
          onChange={setTab}
          tabs={[
            { id: 'setup', label: t('classesPage.tabSetup') },
            { id: 'teachers', label: `${t('classesPage.tabTeachers')} (${pickedTeachers.length})` },
            { id: 'students', label: `${t('classesPage.tabStudents')} (${pickedStudents.length})` },
          ]}
        />

        {tab === 'setup' ? (
          <div className="grid gap-4">
            <label className="grid gap-1 text-sm font-medium text-ink">
              {t('classesPage.className')}
              <input className="ui-field" value={name} onChange={(event) => setName(event.target.value)} required autoFocus />
            </label>
            <label className="grid gap-1 text-sm font-medium text-ink">
              {t('classesPage.pickCourse')}
              <select className="ui-field" value={programId} onChange={(event) => setProgramId(event.target.value)}>
                <option value="">{t('classesPage.unassigned')}</option>
                {programs.map((program) => (
                  <option key={program.id} value={program.id}>
                    {localizedLabel(program.title, i18n.language) || t('programs.untitled')}
                  </option>
                ))}
              </select>
            </label>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="grid gap-1 text-sm font-medium text-ink">
                {t('classesPage.startsOn')}
                <input className="ui-field" type="date" value={startsOn} onChange={(event) => setStartsOn(event.target.value)} />
              </label>
              <label className="grid gap-1 text-sm font-medium text-ink">
                {t('classesPage.endsOn')}
                <input className="ui-field" type="date" value={endsOn} onChange={(event) => setEndsOn(event.target.value)} min={startsOn || undefined} />
              </label>
            </div>
            <p className="text-sm text-muted">{t('classesPage.setupHint')}</p>
          </div>
        ) : null}

        {tab === 'teachers' ? (
          <PeoplePicker
            query={teacherQuery}
            onQuery={setTeacherQuery}
            empty={t('classesPage.noTeachers')}
            loading={false}
            people={visibleTeachers}
            selected={pickedTeachers}
            onToggle={(id) => toggle(pickedTeachers, id, setPickedTeachers)}
            selectAllLabel={t('classesPage.selectAll')}
            onSelectAll={() => setPickedTeachers(visibleTeachers.map((item) => item.id))}
            onClear={() => setPickedTeachers([])}
          />
        ) : null}

        {tab === 'students' ? (
          <PeoplePicker
            query={studentQuery}
            onQuery={setStudentQuery}
            empty={t('classesPage.noStudents')}
            loading={loadingPeople}
            people={visibleStudents}
            selected={pickedStudents}
            onToggle={(id) => toggle(pickedStudents, id, setPickedStudents)}
            selectAllLabel={t('classesPage.selectAll')}
            onSelectAll={() => setPickedStudents(visibleStudents.map((item) => item.id))}
            onClear={() => setPickedStudents([])}
          />
        ) : null}

        {error ? <p role="alert" className="text-sm text-danger">{error}</p> : null}

        <div className="ui-dialog-foot">
          {mode === 'edit' && onAskDelete ? (
            pendingDelete ? (
              <button type="button" className="ui-btn bg-danger text-white" disabled={pending} onClick={onDelete}>
                {t('programs.confirmRemove')}
              </button>
            ) : (
              <button type="button" className="ui-btn bg-danger text-white" disabled={pending} onClick={onAskDelete}>
                {t('programs.remove')}
              </button>
            )
          ) : null}
          <button type="button" className="ui-btn ui-btn-ghost border border-line" onClick={onClose}>
            {t('accounts.cancel')}
          </button>
          {tab !== 'setup' ? (
            <button type="button" className="ui-btn ui-btn-ghost border border-line" onClick={() => setTab(tab === 'students' ? 'teachers' : 'setup')}>
              {t('classesPage.backTab')}
            </button>
          ) : null}
          {tab !== 'students' ? (
            <button
              type="button"
              className="ui-btn ui-btn-primary"
              onClick={() => setTab(tab === 'setup' ? 'teachers' : 'students')}
            >
              {t('classesPage.nextTab')}
            </button>
          ) : null}
          <button type="button" className="ui-btn ui-btn-primary" disabled={pending || !name.trim()} onClick={() => void save()}>
            {pending ? t('programs.saving') : mode === 'create' ? t('classesPage.saveAll') : t('programs.save')}
          </button>
        </div>
      </div>
    </Dialog>
  )
}

function PeoplePicker({
  query,
  onQuery,
  empty,
  loading,
  people,
  selected,
  onToggle,
  selectAllLabel,
  onSelectAll,
  onClear,
  note,
}: {
  query: string
  onQuery: (value: string) => void
  empty: string
  loading: boolean
  people: StudentRecord[]
  selected: string[]
  onToggle: (id: string) => void
  selectAllLabel: string
  onSelectAll: () => void
  onClear: () => void
  note?: string
}) {
  const { t } = useTranslation()
  return (
    <div className="grid gap-3">
      <input
        className="ui-field"
        value={query}
        onChange={(event) => onQuery(event.target.value)}
        placeholder={t('filters.search')}
      />
      <div className="flex flex-wrap gap-2">
        <button type="button" className="ui-inline ui-btn-ghost" onClick={onSelectAll} disabled={people.length === 0}>
          {selectAllLabel}
        </button>
        <button type="button" className="ui-inline ui-btn-ghost" onClick={onClear} disabled={selected.length === 0}>
          {t('classesPage.clearPick')}
        </button>
        <span className="self-center text-xs text-muted">{t('classesPage.pickedCount', { count: selected.length })}</span>
      </div>
      {note ? <p className="text-xs text-muted">{note}</p> : null}
      {loading ? <p role="status" className="text-sm text-muted">{t('programs.loading')}</p> : null}
      {!loading && people.length === 0 ? <p className="text-sm text-muted">{empty}</p> : null}
      <div className="max-h-72 overflow-y-auto rounded-xl border border-line bg-white/70 p-2">
        <ul className="grid gap-1">
          {people.map((person) => (
            <li key={person.id}>
              <label className="flex min-h-10 cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-ink hover:bg-canvas">
                <input type="checkbox" checked={selected.includes(person.id)} onChange={() => onToggle(person.id)} />
                <span className="truncate">{person.fullName || person.id}</span>
              </label>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
