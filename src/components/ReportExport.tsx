import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { downloadExamPdf, type ExamPdfSheet } from '../lib/documents'
import { localizedLabel } from '../lib/localized'
import { loadExamSheets, loadScoreReport, type ExamSheet, type ScoreCell, type ScoreReport } from '../lib/reports'
import { passingScore } from '../lib/student'
import { isSupabaseConfigured } from '../lib/supabase'
import { DataTable, FilterBar } from './ui/DataSheet'
import { ExportButtons } from './ExportButtons'

type ReportExportProps = {
  programId: string
  studentIds?: string[]
  classLabel?: string
}

function letter(index: number) {
  return String.fromCharCode(65 + index)
}

function examScore(sheet: ExamSheet) {
  if (sheet.questions.some((question) => question.score === null)) return null
  const possible = sheet.questions.reduce((sum, question) => sum + question.points, 0)
  if (possible === 0) return null
  const earned = sheet.questions.reduce((sum, question) => sum + ((question.score ?? 0) / 10) * question.points, 0)
  return (earned / possible) * 10
}

export function ReportExport({ programId, studentIds, classLabel = '' }: ReportExportProps) {
  const { t, i18n } = useTranslation()
  const [report, setReport] = useState<ScoreReport | null>(null)
  const [loading, setLoading] = useState(isSupabaseConfigured)
  const [error, setError] = useState('')
  const [query, setQuery] = useState('')
  const [classFilter, setClassFilter] = useState('all')
  const [pickedStudents, setPickedStudents] = useState<string[]>([])
  const [pickedLessons, setPickedLessons] = useState<string[]>([])
  const [examining, setExamining] = useState(false)
  useEffect(() => {
    if (!isSupabaseConfigured) return
    let active = true
    void loadScoreReport(programId)
      .then((next) => {
        if (!active) return
        setReport(next)
        setPickedLessons((next?.lessons ?? []).filter((lesson) => lesson.hasQuiz).map((lesson) => lesson.id))
      })
      .catch(() => {
        if (active) setError(t('reports.loadError'))
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [programId, t])

  const lessonHeaders =
    report?.lessons.map((lesson, index) => localizedLabel(lesson.title, i18n.language) || t('reports.lesson', { n: index + 1 })) ??
    []
  const programName = report ? localizedLabel(report.programTitle, i18n.language) || t('programs.untitled') : ''

  function cellText(score: ScoreCell) {
    return score === null ? t('reports.emptyScore') : score.toFixed(1)
  }

  const allowed = studentIds ? new Set(studentIds) : null
  const enrolled = (report?.students ?? []).filter((student) => !allowed || allowed.has(student.id))
  const classes = [...new Map(enrolled.filter((student) => student.classId).map((student) => [student.classId, student.className])).entries()]
  const students = enrolled.filter(
    (student) =>
      (classFilter === 'all' || student.classId === classFilter) &&
      (student.name || '').toLowerCase().includes(query.trim().toLowerCase()),
  )
  const activeClass = classLabel || classes.find(([id]) => id === classFilter)?.[1] || ''
  const quizLessons = (report?.lessons ?? []).filter((lesson) => lesson.hasQuiz)
  const allPicked = students.length > 0 && students.every((student) => pickedStudents.includes(student.id))
  const exportRows = report
    ? students.map((student) => [
        student.name || t('enrollment.unnamed'),
        ...(classes.length > 1 ? [student.className] : []),
        ...student.scores.map(cellText),
        cellText(student.average),
      ])
    : []

  function paper(sheet: ExamSheet): ExamPdfSheet {
    const score = examScore(sheet)
    const course = localizedLabel(sheet.courseTitle, i18n.language) || t('programs.untitled')
    const lesson = localizedLabel(sheet.lessonTitle, i18n.language) || t('programs.untitled')
    return {
      schoolName: t('reports.schoolName'),
      title: t('reports.examTitle'),
      studentLine: `${t('reports.student')}: ${sheet.studentName || t('enrollment.unnamed')}`,
      meta: [
        `${t('reports.className')}: ${sheet.className || activeClass || '—'}`,
        `${t('reports.course')}: ${course}`,
        `${t('programs.lessons')}: ${lesson}`,
      ],
      questions: sheet.questions.map((question, index) => {
        const prompt = localizedLabel(question.question, i18n.language)
        const choice = (optionIndex: number | null) => {
          if (optionIndex === null || !question.options[optionIndex]) return t('reports.notTaken')
          const text = localizedLabel(question.options[optionIndex], i18n.language)
          return `${letter(optionIndex)}. ${text}`
        }
        const verdict = question.isEssay
          ? question.score === null
            ? question.essayAnswer
              ? t('reports.waiting')
              : t('reports.notTaken')
            : question.score >= 5
              ? t('reports.passed')
              : t('reports.failed')
          : question.score === null
            ? t('reports.notTaken')
            : question.score >= 5
              ? t('reports.correct')
              : t('reports.incorrect')
        const lines = question.isEssay
          ? [
              `${t('reports.essayAnswer')}: ${question.essayAnswer || t('reports.notTaken')}`,
              `${t('reports.feedback')}: ${question.feedback || '—'}`,
              `${t('reports.verdict')}: ${verdict}`,
              `${t('reports.questionPoints')}: ${question.score === null ? '—' : question.score.toFixed(1)}/10`,
            ]
          : [
              ...question.options.map((option, optionIndex) => `${letter(optionIndex)}. ${localizedLabel(option, i18n.language)}`),
              `${t('reports.answer')}: ${choice(question.selectedIndex)}`,
              `${t('reports.correctAnswer')}: ${choice(question.correctIndex)}`,
              `${t('reports.verdict')}: ${verdict}`,
            ]
        return { heading: `${index + 1}. ${prompt}`, lines }
      }),
      result:
        score === null
          ? `${t('reports.finalResult')}: ${t('reports.waiting')}`
          : `${t('reports.finalResult')}: ${score.toFixed(1)}/10 · ${score >= sheet.passMark ? t('reports.passed') : t('reports.failed')} · ${t('reports.passMark')} ${sheet.passMark}/10`,
      signLeft: t('reports.studentSign'),
      signRight: t('reports.teacherSign'),
      signHint: t('reports.signHint'),
    }
  }

  async function downloadExams() {
    setExamining(true)
    setError('')
    try {
      const chosen = pickedStudents.filter((id) =>
        enrolled.some((student) => student.id === id && (classFilter === 'all' || student.classId === classFilter)),
      )
      const sheets = await loadExamSheets(programId, chosen, pickedLessons)
      if (sheets.length === 0) {
        setError(t('reports.empty'))
        return
      }
      await downloadExamPdf(`phieu-kiem-tra-${programId.slice(0, 8)}`, sheets.map(paper))
    } catch {
      setError(t('reports.exportError'))
    } finally {
      setExamining(false)
    }
  }

  return (
    <section className="ui-card grid gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex items-center gap-3">
          <img src="/logo-vietmy-blue.png" alt={t('brand.school')} className="h-20 w-auto" />
          <div>
            <h2 className="text-lg font-semibold text-ink">{t('reports.title')}</h2>
            <p className="text-sm text-muted">{programName || t('reports.lead')}</p>
          </div>
        </div>
        <ExportButtons
          filename={`bang-diem-${programId.slice(0, 8)}`}
          title={t('reports.title')}
          lines={[
            `${t('reports.course')}: ${programName}`,
            ...(activeClass ? [`${t('reports.className')}: ${activeClass}`] : []),
          ]}
          headers={[
            t('reports.student'),
            ...(classes.length > 1 ? [t('reports.className')] : []),
            ...lessonHeaders,
            t('reports.average'),
          ]}
          rows={exportRows}
          disabled={!report}
        />
      </div>
      {!isSupabaseConfigured ? <p className="text-sm text-warning">{t('supabase.missing')}</p> : null}
      {loading ? <p role="status">{t('reports.loading')}</p> : null}
      {error ? (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : null}
      {report && report.students.length === 0 ? <p className="text-sm text-muted">{t('reports.empty')}</p> : null}
      {report && report.students.length > 0 ? (
        <>
        {classes.length > 1 && !classLabel ? (
          <label className="grid w-fit gap-1 text-sm font-medium text-ink" htmlFor="report-class">
            {t('reports.className')}
            <select id="report-class" className="ui-field" value={classFilter} onChange={(event) => setClassFilter(event.target.value)}>
              <option value="all">{t('reports.classAll')}</option>
              {classes.map(([id, name]) => (
                <option key={id} value={id}>{name}</option>
              ))}
            </select>
          </label>
        ) : null}
        {quizLessons.length > 0 ? (
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-sm font-medium text-ink">{t('reports.examLessons')}</span>
            {quizLessons.map((lesson, index) => (
              <label key={lesson.id} className="flex min-h-9 items-center gap-2 text-sm text-ink">
                <input
                  type="checkbox"
                  checked={pickedLessons.includes(lesson.id)}
                  onChange={() =>
                    setPickedLessons((current) =>
                      current.includes(lesson.id) ? current.filter((id) => id !== lesson.id) : [...current, lesson.id],
                    )
                  }
                />
                {localizedLabel(lesson.title, i18n.language) || t('reports.lesson', { n: index + 1 })}
              </label>
            ))}
            <button
              type="button"
              className="ui-inline ui-btn-primary"
              disabled={examining || pickedStudents.length === 0 || pickedLessons.length === 0}
              onClick={() => void downloadExams()}
            >
              {examining ? t('reports.exporting') : t('reports.examDownload')}
            </button>
          </div>
        ) : null}
        <FilterBar query={query} onQuery={setQuery} count={students.length} />
        {students.length === 0 ? <p className="text-sm text-muted">{t('filters.noMatch')}</p> : null}
        <DataTable>
          <thead>
            <tr>
              <th>
                <input
                  type="checkbox"
                  aria-label={t('reports.selectAll')}
                  checked={allPicked}
                  onChange={() =>
                    setPickedStudents((current) => {
                      const visible = new Set(students.map((student) => student.id))
                      return allPicked ? current.filter((id) => !visible.has(id)) : [...new Set([...current, ...visible])]
                    })
                  }
                />
              </th>
              <th>{t('reports.student')}</th>
              {classes.length > 1 ? <th>{t('reports.className')}</th> : null}
              {report.lessons.map((lesson, index) => (
                <th key={lesson.id}>{lessonHeaders[index]}</th>
              ))}
              <th>{t('reports.average')}</th>
            </tr>
          </thead>
          <tbody>
            {students.map((student) => (
              <tr key={student.id}>
                <td>
                  <input
                    type="checkbox"
                    aria-label={student.name || t('enrollment.unnamed')}
                    checked={pickedStudents.includes(student.id)}
                    onChange={() =>
                      setPickedStudents((current) =>
                        current.includes(student.id) ? current.filter((id) => id !== student.id) : [...current, student.id],
                      )
                    }
                  />
                </td>
                <td className="font-medium text-ink">{student.name || t('enrollment.unnamed')}</td>
                {classes.length > 1 ? <td>{student.className || '—'}</td> : null}
                {student.scores.map((score, index) => (
                  <td key={`${student.id}-${report.lessons[index]?.id ?? index}`} className={`tabular-nums ${score !== null && score < passingScore ? 'text-danger' : ''}`}>
                    {cellText(score)}
                  </td>
                ))}
                <td className={`font-semibold tabular-nums ${student.average !== null && student.average < passingScore ? 'text-danger' : ''}`}>{cellText(student.average)}</td>
              </tr>
            ))}
          </tbody>
        </DataTable>
        </>
      ) : null}
    </section>
  )
}
