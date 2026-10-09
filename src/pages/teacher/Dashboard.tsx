import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { ExportButtons } from '../../components/ExportButtons'
import { ReportExport } from '../../components/ReportExport'
import { DataTable, FilterBar, SelectFilter } from '../../components/ui/DataSheet'
import { PageHeader } from '../../components/ui/PageHeader'
import { Tabs } from '../../components/ui/Tabs'
import { useAuth } from '../../hooks/useAuth'
import { localizedLabel } from '../../lib/localized'
import { listClasses, listPrograms, type CourseClass, type ProgramRecord } from '../../lib/programs'
import { countsInClass, studyStatuses } from '../../lib/accounts'
import { isSchoolAdmin } from '../../lib/roles'
import { isSupabaseConfigured } from '../../lib/supabase'
import { listTeacherRoster, type RosterRow } from '../../lib/teacher'

export function TeacherDashboard() {
  const { t, i18n } = useTranslation()
  const { user, role } = useAuth()
  const [rows, setRows] = useState<RosterRow[]>([])
  const [catalog, setCatalog] = useState<CourseClass[]>([])
  const [programs, setPrograms] = useState<ProgramRecord[]>([])
  const [loading, setLoading] = useState(isSupabaseConfigured)
  const [error, setError] = useState('')
  const [tab, setTab] = useState<'class' | 'course'>('class')
  const [query, setQuery] = useState('')
  const [courseFilter, setCourseFilter] = useState('all')
  const [studyFilter, setStudyFilter] = useState('studying')
  const [selectedClass, setSelectedClass] = useState('')
  const [selectedCourse, setSelectedCourse] = useState<string | null>(null)

  useEffect(() => {
    if (!user || !isSupabaseConfigured) return
    let active = true
    void Promise.all([listTeacherRoster(), listClasses(), listPrograms()])
      .then(([next, nextClasses, nextPrograms]) => {
        if (!active) return
        setRows(next)
        setCatalog(nextClasses)
        setPrograms(nextPrograms)
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
  }, [t, user, role])

  const classes = catalog.map((item) => {
    const members = rows.filter((row) => row.classId === item.id && countsInClass(row.studyStatus))
    const program = programs.find((row) => row.id === item.programId)
    const scores = members.map((row) => row.averageScore).filter((score): score is number => score !== null)
    const progress = members.length === 0 ? 0 : Math.round(members.reduce((sum, row) => sum + row.progress, 0) / members.length)
    return {
      id: item.id,
      programId: item.programId,
      name: item.name,
      title: program?.title ?? { vi: '', my: '', bn: '' },
      students: members.length,
      progress,
      average: scores.length === 0 ? null : scores.reduce((sum, score) => sum + score, 0) / scores.length,
    }
  })
  const courses = programs
    .filter((program) => catalog.some((item) => item.programId === program.id))
    .map((program) => {
      const members = classes.filter((item) => item.programId === program.id)
      const scores = members.map((item) => item.average).filter((score): score is number => score !== null)
      return {
        id: program.id,
        title: program.title,
        classes: members.length,
        students: members.reduce((sum, item) => sum + item.students, 0),
        average: scores.length === 0 ? null : scores.reduce((sum, score) => sum + score, 0) / scores.length,
      }
    })
  const needle = query.trim().toLowerCase()
  const visibleClasses = classes.filter((item) => {
    const title = `${item.name} ${localizedLabel(item.title, i18n.language)}`.toLowerCase()
    const matchesCourse = courseFilter === 'all' || item.programId === courseFilter
    return matchesCourse && title.includes(needle)
  })
  const visibleCourses = courses.filter((item) => localizedLabel(item.title, i18n.language).toLowerCase().includes(needle))
  const classRows = rows.filter((row) => {
    const matchesStudy = studyFilter === 'all' || row.studyStatus === studyFilter
    return row.classId === selectedClass && matchesStudy && row.studentName.toLowerCase().includes(needle)
  })
  const openClass = classes.find((item) => item.id === selectedClass)

  return (
    <div className="ui-page">
      <PageHeader
        title={t(isSchoolAdmin(role) ? 'teacher.schoolTitle' : 'teacher.dashboardTitle')}
        action={
          <>
            {!selectedClass && tab === 'class' ? (
              <ExportButtons
                filename="tong-ket-lop"
                title={t('panels.byClass')}
                headers={[t('reports.className'), t('teacher.course'), t('teacher.headcount'), t('teacher.progress'), t('teacher.average')]}
                rows={visibleClasses.map((item) => [
                  item.name || t('classesPage.untitled'),
                  localizedLabel(item.title, i18n.language) || t('programs.untitled'),
                  item.students,
                  `${item.progress}%`,
                  item.average === null ? t('teacher.noScore') : item.average.toFixed(1),
                ])}
              />
            ) : null}
            {!selectedClass && tab === 'course' && selectedCourse === null ? (
              <ExportButtons
                filename="tong-ket-khoa"
                title={t('panels.byCourse')}
                headers={[t('teacher.course'), t('teacher.classCount'), t('teacher.headcount'), t('teacher.average')]}
                rows={visibleCourses.map((item) => [
                  localizedLabel(item.title, i18n.language) || t('programs.untitled'),
                  item.classes,
                  item.students,
                  item.average === null ? t('teacher.noScore') : item.average.toFixed(1),
                ])}
              />
            ) : null}
            <Link to="/teacher/grading" className="ui-inline ui-btn-primary">
              {t('teacher.openGrading')}
            </Link>
          </>
        }
      />
      {!isSupabaseConfigured ? (
        <p role="status" className="rounded-2xl bg-warning-bg px-4 py-3 text-sm text-warning">
          {t('supabase.missing')}
        </p>
      ) : null}
      {loading ? <p role="status">{t('teacher.loading')}</p> : null}
      {error ? (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : null}
      <Tabs
        label={t('panels.label')}
        value={tab}
        onChange={(id) => {
          setTab(id as 'class' | 'course')
          setQuery('')
          setSelectedClass('')
          setSelectedCourse(null)
          setCourseFilter('all')
        }}
        tabs={[
          { id: 'class', label: t('panels.byClass') },
          { id: 'course', label: t('panels.byCourse') },
        ]}
      />
      <div className="ui-fill">
      {!loading && catalog.length === 0 && isSupabaseConfigured ? <p className="text-muted">{t('teacher.emptyRoster')}</p> : null}
      {selectedClass && openClass ? (
        <div className="grid gap-3">
          <button type="button" className="ui-inline ui-btn-ghost w-fit" onClick={() => { setSelectedClass(''); setQuery('') }}>
            {t('teacher.back')}
          </button>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-lg font-semibold text-ink">
              {openClass.name || t('classesPage.untitled')}
              <span className="ml-2 text-sm font-medium text-muted">{localizedLabel(openClass.title, i18n.language) || t('programs.untitled')}</span>
            </p>
            <Link to={`/programs/${openClass.programId}`} className="ui-inline ui-btn-primary">{t('classesPage.manage')}</Link>
          </div>
          <FilterBar query={query} onQuery={setQuery} count={classRows.length}>
            <SelectFilter
              id="class-study"
              label={t('accounts.studyStatus')}
              value={studyFilter}
              onChange={setStudyFilter}
              options={[
                { value: 'studying', label: t('accounts.study.studying') },
                { value: 'all', label: t('filters.all') },
                ...studyStatuses.filter((status) => status !== 'studying').map((status) => ({
                  value: status,
                  label: t(`accounts.study.${status}`),
                })),
              ]}
            />
          </FilterBar>
          <DataTable>
            <thead>
              <tr>
                <th>{t('teacher.student')}</th>
                <th>{t('accounts.studyStatus')}</th>
                <th>{t('teacher.progress')}</th>
                <th>{t('teacher.average')}</th>
                <th>{t('teacher.action')}</th>
              </tr>
            </thead>
            <tbody>
              {classRows.map((row) => (
                <tr key={row.studentId}>
                  <td className="font-medium text-ink">{row.studentName || t('enrollment.unnamed')}</td>
                  <td>{t(`accounts.study.${row.studyStatus}`, { defaultValue: row.studyStatus })}</td>
                  <td className="tabular-nums">{row.progress}%</td>
                  <td className="tabular-nums">{row.averageScore === null ? t('teacher.noScore') : row.averageScore.toFixed(1)}</td>
                  <td>
                    <Link to={`/teacher/students/${row.studentId}/${row.programId}`} className="ui-inline ui-btn-ghost">
                      {t('teacher.viewLog')}
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </DataTable>
          <ReportExport key={selectedClass} programId={openClass.programId} studentIds={classRows.map((row) => row.studentId)} />
        </div>
      ) : null}
      {!selectedClass && tab === 'class' ? (
        <>
          <FilterBar query={query} onQuery={setQuery} count={visibleClasses.length}>
            <SelectFilter
              id="review-course"
              label={t('teacher.course')}
              value={courseFilter}
              onChange={setCourseFilter}
              options={[
                { value: 'all', label: t('filters.all') },
                ...courses.map((item) => ({ value: item.id, label: localizedLabel(item.title, i18n.language) || t('programs.untitled') })),
              ]}
            />
          </FilterBar>
          {classes.length > 0 && visibleClasses.length === 0 ? <p className="text-muted">{t('filters.noMatch')}</p> : null}
          <DataTable>
            <thead>
              <tr>
                <th>{t('reports.className')}</th>
                <th>{t('teacher.course')}</th>
                <th>{t('teacher.headcount')}</th>
                <th>{t('teacher.progress')}</th>
                <th>{t('teacher.average')}</th>
              </tr>
            </thead>
            <tbody>
              {visibleClasses.map((item) => (
                <tr key={item.id} className="ui-row" onClick={() => { setSelectedClass(item.id); setQuery('') }}>
                  <td className="font-semibold text-ink">{item.name || t('classesPage.untitled')}</td>
                  <td>{localizedLabel(item.title, i18n.language) || t('programs.untitled')}</td>
                  <td className="tabular-nums">{item.students}</td>
                  <td className="tabular-nums">{item.progress}%</td>
                  <td className="tabular-nums">{item.average === null ? t('teacher.noScore') : item.average.toFixed(1)}</td>
                </tr>
              ))}
            </tbody>
          </DataTable>
        </>
      ) : null}
      {!selectedClass && tab === 'course' && selectedCourse === null ? (
        <>
          <FilterBar query={query} onQuery={setQuery} count={visibleCourses.length} />
          {courses.length > 0 && visibleCourses.length === 0 ? <p className="text-muted">{t('filters.noMatch')}</p> : null}
          <DataTable>
            <thead>
              <tr>
                <th>{t('teacher.course')}</th>
                <th>{t('teacher.classCount')}</th>
                <th>{t('teacher.headcount')}</th>
                <th>{t('teacher.average')}</th>
              </tr>
            </thead>
            <tbody>
              {visibleCourses.map((item) => (
                <tr key={item.id} className="ui-row" onClick={() => { setSelectedCourse(item.id); setQuery('') }}>
                  <td className="font-semibold text-ink">{localizedLabel(item.title, i18n.language) || t('programs.untitled')}</td>
                  <td className="tabular-nums">{item.classes}</td>
                  <td className="tabular-nums">{item.students}</td>
                  <td className="tabular-nums">{item.average === null ? t('teacher.noScore') : item.average.toFixed(1)}</td>
                </tr>
              ))}
            </tbody>
          </DataTable>
        </>
      ) : null}
      {!selectedClass && selectedCourse !== null && tab === 'course' ? (
        <>
          <button type="button" className="ui-inline ui-btn-ghost mb-3 w-fit" onClick={() => { setSelectedCourse(null); setQuery('') }}>
            {t('teacher.backCourses')}
          </button>
          <p className="mb-3 text-lg font-semibold text-ink">{localizedLabel(courses.find((item) => item.id === selectedCourse)?.title ?? { vi: '', my: '', bn: '' }, i18n.language) || t('programs.untitled')}</p>
          <FilterBar query={query} onQuery={setQuery} count={visibleClasses.filter((item) => item.programId === selectedCourse).length} />
          <DataTable>
            <thead>
              <tr>
                <th>{t('reports.className')}</th>
                <th>{t('teacher.headcount')}</th>
                <th>{t('teacher.progress')}</th>
                <th>{t('teacher.average')}</th>
              </tr>
            </thead>
            <tbody>
              {visibleClasses.filter((item) => item.programId === selectedCourse).map((item) => (
                <tr key={item.id} className="ui-row" onClick={() => { setSelectedClass(item.id); setQuery('') }}>
                  <td className="font-semibold text-ink">{item.name || t('classesPage.untitled')}</td>
                  <td className="tabular-nums">{item.students}</td>
                  <td className="tabular-nums">{item.progress}%</td>
                  <td className="tabular-nums">{item.average === null ? t('teacher.noScore') : item.average.toFixed(1)}</td>
                </tr>
              ))}
            </tbody>
          </DataTable>
        </>
      ) : null}
      </div>
    </div>
  )
}
