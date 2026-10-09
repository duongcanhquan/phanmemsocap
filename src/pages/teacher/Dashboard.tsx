import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useMatch } from 'react-router-dom'
import { ExportButtons } from '../../components/ExportButtons'
import { ReportExport } from '../../components/ReportExport'
import { Grading } from './Grading'
import { DataTable, FilterBar, SelectFilter } from '../../components/ui/DataSheet'
import { PageHeader } from '../../components/ui/PageHeader'
import { Tabs } from '../../components/ui/Tabs'
import { useAuth } from '../../hooks/useAuth'
import { localizedLabel } from '../../lib/localized'
import { listClassTeacherIds, listClasses, listProgramTeacherIds, listPrograms, type CourseClass, type ProgramRecord } from '../../lib/programs'
import { countsInClass, studyStatuses } from '../../lib/accounts'
import { isSchoolAdmin } from '../../lib/roles'
import { isSupabaseConfigured } from '../../lib/supabase'
import { passingScore } from '../../lib/student'
import { listTeacherRoster, type RosterRow } from '../../lib/teacher'

export function TeacherDashboard() {
  const { t, i18n } = useTranslation()
  const { user, role } = useAuth()
  const [rows, setRows] = useState<RosterRow[]>([])
  const [catalog, setCatalog] = useState<CourseClass[]>([])
  const [programs, setPrograms] = useState<ProgramRecord[]>([])
  const [loading, setLoading] = useState(isSupabaseConfigured)
  const [error, setError] = useState('')
  const onClasses = Boolean(useMatch('/teacher/classes'))
  const teaching = !isSchoolAdmin(role)
  const [tab, setTab] = useState<'overview' | 'class' | 'course' | 'roster' | 'scores' | 'grading'>(onClasses ? 'class' : teaching ? 'overview' : 'class')
  const [myClassIds, setMyClassIds] = useState<string[]>([])
  const [myProgramIds, setMyProgramIds] = useState<string[]>([])
  const [query, setQuery] = useState('')
  const [courseFilter, setCourseFilter] = useState('all')
  const [studyFilter, setStudyFilter] = useState('studying')
  const [selectedClass, setSelectedClass] = useState('')
  const [selectedCourse, setSelectedCourse] = useState<string | null>(null)
  const leaveCourse = useCallback(() => {
    setSelectedCourse(null)
    setQuery('')
  }, [])

  useEffect(() => {
    if (!user || !isSupabaseConfigured) return
    let active = true
    void Promise.all([listTeacherRoster(), listClasses(), listPrograms(), listClassTeacherIds(), listProgramTeacherIds()])
      .then(([next, nextClasses, nextPrograms, classTeachers, programTeachers]) => {
        if (!active || !user) return
        setRows(next)
        setCatalog(nextClasses)
        setPrograms(nextPrograms)
        setMyClassIds(Object.entries(classTeachers).filter(([, ids]) => ids.includes(user.id)).map(([id]) => id))
        setMyProgramIds(Object.entries(programTeachers).filter(([, ids]) => ids.includes(user.id)).map(([id]) => id))
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

  const classes = catalog.filter((item) => {
    if (!teaching) return true
    return myClassIds.includes(item.id) || (item.programId !== '' && myProgramIds.includes(item.programId)) || programs.some((program) => program.id === item.programId && program.teacherId === user?.id)
  }).map((item) => {
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

  function openClassRoster(classId: string) {
    setSelectedClass(classId)
    setQuery('')
    setTab(teaching ? 'class' : 'roster')
  }

  return (
    <div className="ui-page">
      <PageHeader
        title={t(isSchoolAdmin(role) ? 'teacher.schoolTitle' : onClasses ? 'teacher.myClasses' : 'teacher.overview')}
        back={tab === 'course' && selectedCourse ? { label: t('teacher.backCourses'), onClick: leaveCourse } : undefined}
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
          setTab(id as 'overview' | 'class' | 'course' | 'roster' | 'scores' | 'grading')
          setQuery('')
        }}
        tabs={teaching ? [
          { id: 'overview', label: t('teacher.overview') },
          { id: 'class', label: t('teacher.myClasses') },
        ] : [
          { id: 'class', label: t('panels.byClass') },
          { id: 'course', label: t('panels.byCourse') },
          { id: 'roster', label: t('panels.roster') },
          { id: 'scores', label: t('reports.title') },
          { id: 'grading', label: t('teacher.gradingTab') },
        ]}
      />
      <div className="ui-fill">
      {!loading && catalog.length === 0 && isSupabaseConfigured && tab !== 'grading' ? <p className="text-muted">{t('teacher.emptyRoster')}</p> : null}
      {tab === 'overview' ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {classes.length === 0 ? <p className="text-muted">{t('teacher.emptyRoster')}</p> : null}
          {classes.map((item) => (
            <button key={item.id} type="button" className="ui-card grid gap-1 text-left" onClick={() => openClassRoster(item.id)}>
              <span className="text-lg font-semibold text-ink">{item.name || t('classesPage.untitled')}</span>
              <span className="text-sm text-muted">{localizedLabel(item.title, i18n.language) || t('programs.untitled')}</span>
              <span className="text-sm text-ink">{t('teacher.headcount')}: {item.students}</span>
              <span className="text-sm text-ink">{t('teacher.progress')}: {item.progress}%</span>
            </button>
          ))}
        </div>
      ) : null}
      {tab === 'class' ? (
        <>
          <div className="mb-3 flex justify-end">
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
          </div>
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
                <tr key={item.id} className="ui-row" onClick={() => openClassRoster(item.id)}>
                  <td className="font-semibold text-ink">{item.name || t('classesPage.untitled')}</td>
                  <td>{localizedLabel(item.title, i18n.language) || t('programs.untitled')}</td>
                  <td className="tabular-nums">{item.students}</td>
                  <td className="tabular-nums">{item.progress}%</td>
                  <td className="tabular-nums">{item.average === null ? t('teacher.noScore') : item.average.toFixed(1)}</td>
                </tr>
              ))}
            </tbody>
          </DataTable>
          {teaching && selectedClass ? (
            <div className="mt-4 grid gap-3">
              <h2 className="text-lg font-semibold text-ink">{openClass?.name || t('classesPage.untitled')}</h2>
              <DataTable>
                <thead>
                  <tr>
                    <th>{t('teacher.student')}</th>
                    <th>{t('teacher.progress')}</th>
                    <th>{t('teacher.average')}</th>
                    <th>{t('teacher.finished')}</th>
                    <th>{t('teacher.action')}</th>
                  </tr>
                </thead>
                <tbody>
                  {classRows.map((row) => (
                    <tr key={row.studentId}>
                      <td className="font-medium text-ink">
                        <Link to={`/students/${row.studentId}`}>{row.studentName || t('enrollment.unnamed')}</Link>
                      </td>
                      <td className="tabular-nums">{row.progress}%</td>
                      <td className="tabular-nums">{row.averageScore === null ? t('teacher.noScore') : row.averageScore.toFixed(1)}</td>
                      <td>{row.progress >= 100 ? t('teacher.finishedAll') : t('teacher.stillLearning')}</td>
                      <td>
                        <Link to={`/teacher/grading?student=${row.studentId}&class=${row.classId}`} className="ui-inline ui-btn-ghost">
                          {t('teacher.gradeStudent')}
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </DataTable>
            </div>
          ) : null}
        </>
      ) : null}
      {tab === 'course' && selectedCourse === null ? (
        <>
          <div className="mb-3 flex justify-end">
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
          </div>
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
      {tab === 'course' && selectedCourse !== null ? (
        <>
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
                <tr key={item.id} className="ui-row" onClick={() => openClassRoster(item.id)}>
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
      {tab === 'roster' ? (
        <div className="grid gap-3">
          <ClassPick classes={classes} value={selectedClass} onChange={setSelectedClass} />
          {openClass ? (
            <>
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
                      <td className={`tabular-nums ${row.averageScore !== null && (row.progress < 100 || row.averageScore < passingScore) ? 'text-danger' : ''}`}>
                        {row.averageScore === null
                          ? t('teacher.noScore')
                          : `${row.averageScore.toFixed(1)} · ${row.progress < 100 ? t('teacher.incomplete') : t(row.averageScore >= passingScore ? 'teacher.passed' : 'teacher.belowPass')}`}
                      </td>
                      <td>
                        <Link to={`/students/${row.studentId}`} className="ui-inline ui-btn-ghost">
                          {t('teacher.viewLog')}
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </DataTable>
            </>
          ) : (
            <p className="text-sm text-muted">{t('teacher.pickClass')}</p>
          )}
        </div>
      ) : null}
      {tab === 'scores' ? (
        <div className="grid gap-3">
          <ClassPick classes={classes} value={selectedClass} onChange={setSelectedClass} />
          {openClass ? (
            <ReportExport key={selectedClass} programId={openClass.programId} studentIds={rows.filter((row) => row.classId === selectedClass).map((row) => row.studentId)} />
          ) : (
            <p className="text-sm text-muted">{t('teacher.pickClass')}</p>
          )}
        </div>
      ) : null}
      {tab === 'grading' ? <Grading embedded /> : null}
      </div>
    </div>
  )
}

function ClassPick({
  classes,
  value,
  onChange,
}: {
  classes: { id: string; name: string; title: ProgramRecord['title'] }[]
  value: string
  onChange: (id: string) => void
}) {
  const { t, i18n } = useTranslation()
  return (
    <label className="grid max-w-md gap-1 text-sm font-medium text-ink">
      {t('teacher.pickClass')}
      <select className="ui-field" value={value} onChange={(event) => onChange(event.target.value)}>
        <option value="">{t('teacher.pickClass')}</option>
        {classes.map((item) => (
          <option key={item.id} value={item.id}>
            {item.name || t('classesPage.untitled')} · {localizedLabel(item.title, i18n.language) || t('programs.untitled')}
          </option>
        ))}
      </select>
    </label>
  )
}
