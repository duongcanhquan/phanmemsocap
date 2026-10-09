import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  createClass,
  enrollStudents,
  listClasses,
  listEnrollments,
  listStudents,
  removeEnrollments,
  type CourseClass,
  type EnrollmentRecord,
  type StudentRecord,
} from '../../lib/programs'

type EnrollmentManagerProps = {
  programId: string
}

export function EnrollmentManager({ programId }: EnrollmentManagerProps) {
  const { t } = useTranslation()
  const [students, setStudents] = useState<StudentRecord[]>([])
  const [classes, setClasses] = useState<CourseClass[]>([])
  const [classId, setClassId] = useState('')
  const [className, setClassName] = useState('')
  const [enrollments, setEnrollments] = useState<EnrollmentRecord[]>([])
  const [availableSelection, setAvailableSelection] = useState<string[]>([])
  const [enrolledSelection, setEnrolledSelection] = useState<string[]>([])
  const [error, setError] = useState('')
  const [pending, setPending] = useState(false)
  const [loading, setLoading] = useState(true)
  const [availableQuery, setAvailableQuery] = useState('')
  const [enrolledQuery, setEnrolledQuery] = useState('')

  useEffect(() => {
    let active = true
    void Promise.all([listStudents(), listClasses(programId)])
      .then(([nextStudents, nextClasses]) => {
        if (!active) return
        setStudents(nextStudents)
        setClasses(nextClasses)
        setClassId((current) => current || nextClasses[0]?.id || '')
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

  useEffect(() => {
    if (!classId) return
    let active = true
    void listEnrollments(classId)
      .then((rows) => {
        if (active) setEnrollments(rows)
      })
      .catch(() => {
        if (active) setError(t('programs.loadError'))
      })
    return () => {
      active = false
    }
  }, [classId, t])

  const enrolledIds = useMemo(() => new Set(enrollments.map((item) => item.studentId)), [enrollments])
  const available = students.filter((student) => !enrolledIds.has(student.id))
  const enrolled = enrollments
    .map((enrollment) => ({
      enrollmentId: enrollment.id,
      student: students.find((student) => student.id === enrollment.studentId),
    }))
    .filter((item) => item.student)

  function nameOf(student: StudentRecord | undefined) {
    return student?.fullName || t('enrollment.unnamed')
  }

  async function moveIn() {
    setPending(true)
    setError('')
    try {
      await enrollStudents(programId, classId, availableSelection)
      setEnrollments(await listEnrollments(classId))
      setAvailableSelection([])
    } catch {
      setError(t('programs.saveError'))
    } finally {
      setPending(false)
    }
  }

  async function moveOut() {
    setPending(true)
    setError('')
    try {
      const ids = enrolled
        .filter((item) => enrolledSelection.includes(item.student?.id ?? ''))
        .map((item) => item.enrollmentId)
      await removeEnrollments(ids)
      setEnrollments(await listEnrollments(classId))
      setEnrolledSelection([])
    } catch {
      setError(t('programs.saveError'))
    } finally {
      setPending(false)
    }
  }

  return (
    <section id="class" className="ui-card grid gap-4">
      <div className="flex flex-wrap items-end gap-3">
        <h2 className="text-lg font-semibold text-ink">{t('enrollment.title')}</h2>
        <label className="grid gap-1 text-sm font-medium text-ink">
          {t('classesPage.className')}
          <select
            className="ui-field"
            value={classId}
            onChange={(event) => {
              setClassId(event.target.value)
              setEnrollments([])
              setEnrolledSelection([])
            }}
          >
            {classes.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </label>
        <form
          className="flex items-end gap-2"
          onSubmit={(event) => {
            event.preventDefault()
            if (!className.trim()) return
            setPending(true)
            void createClass(programId, className.trim())
              .then(async (created) => {
                setClasses(await listClasses(programId))
                setClassId(created.id)
                setClassName('')
              })
              .catch(() => setError(t('programs.saveError')))
              .finally(() => setPending(false))
          }}
        >
          <input
            className="ui-field"
            value={className}
            placeholder={t('classesPage.className')}
            aria-label={t('classesPage.className')}
            onChange={(event) => setClassName(event.target.value)}
          />
          <button type="submit" className="ui-inline ui-btn-primary" disabled={pending || !className.trim()}>
            {t('classesPage.add')}
          </button>
        </form>
      </div>
      {loading ? <p role="status">{t('programs.loading')}</p> : null}
      {error ? (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : null}
      <div className="grid items-center gap-3 lg:grid-cols-[1fr_auto_1fr]">
        <StudentColumn
          title={t('enrollment.available')}
          empty={t('enrollment.emptyAvailable')}
          students={available}
          query={availableQuery}
          onQuery={setAvailableQuery}
          selected={availableSelection}
          onChange={setAvailableSelection}
          nameOf={nameOf}
        />
        <div className="flex justify-center gap-2 lg:flex-col">
          <button
            type="button"
            className="ui-btn ui-btn-primary"
            aria-label={t('enrollment.add')}
            disabled={pending || !classId || availableSelection.length === 0}
            onClick={() => void moveIn()}
          >
            <ChevronRight aria-hidden="true" className="size-4" />
            <span className="lg:sr-only">{t('enrollment.add')}</span>
          </button>
          <button
            type="button"
            className="ui-btn ui-btn-ghost border border-line"
            aria-label={t('enrollment.remove')}
            disabled={pending || enrolledSelection.length === 0}
            onClick={() => void moveOut()}
          >
            <ChevronLeft aria-hidden="true" className="size-4" />
            <span className="lg:sr-only">{t('enrollment.remove')}</span>
          </button>
        </div>
        <StudentColumn
          title={t('enrollment.enrolled')}
          empty={t('enrollment.emptyEnrolled')}
          students={enrolled.map((item) => item.student as StudentRecord)}
          query={enrolledQuery}
          onQuery={setEnrolledQuery}
          selected={enrolledSelection}
          onChange={setEnrolledSelection}
          nameOf={nameOf}
        />
      </div>
    </section>
  )
}

type StudentColumnProps = {
  title: string
  empty: string
  students: StudentRecord[]
  query: string
  onQuery: (value: string) => void
  selected: string[]
  onChange: (ids: string[]) => void
  nameOf: (student: StudentRecord | undefined) => string
}

function StudentColumn({ title, empty, students, query, onQuery, selected, onChange, nameOf }: StudentColumnProps) {
  const { t } = useTranslation()
  const shown = students.filter((student) => nameOf(student).toLowerCase().includes(query.trim().toLowerCase()))
  return (
    <div className="grid gap-2">
      <p className="text-sm font-medium text-ink" id={`${title}-label`}>
        {title} · {shown.length}
      </p>
      <input
        className="ui-field"
        value={query}
        placeholder={t('filters.search')}
        onChange={(event) => onQuery(event.target.value)}
        aria-label={t('filters.search')}
      />
      <ul
        aria-labelledby={`${title}-label`}
        className="min-h-48 rounded-2xl border border-line bg-canvas p-2"
      >
        {students.length === 0 ? <li className="px-2 py-3 text-sm text-muted">{empty}</li> : null}
        {students.length > 0 && shown.length === 0 ? <li className="px-2 py-3 text-sm text-muted">{t('filters.noMatch')}</li> : null}
        {shown.map((student) => {
          const active = selected.includes(student.id)
          return (
            <li key={student.id}>
              <button
                type="button"
                aria-pressed={active}
                className={[
                  'flex min-h-11 w-full items-center rounded-xl px-3 text-left text-sm transition duration-200',
                  active ? 'bg-ink font-semibold text-white' : 'text-ink hover:bg-surface',
                ].join(' ')}
                onClick={() =>
                  onChange(active ? selected.filter((id) => id !== student.id) : [...selected, student.id])
                }
              >
                {nameOf(student)}
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
