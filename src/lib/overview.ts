import { passingScore } from './student'
import { asLocalized, type LocalizedText } from './localized'
import { supabase } from './supabase'

export const quietSpans = [3, 7, 14, 30] as const
export type QuietSpan = (typeof quietSpans)[number]

export type QuietStudent = {
  id: string
  fullName: string
  programTitle: LocalizedText
  lastSeen: string | null
  enrolledAt: string | null
}

export type SchoolOverview = {
  activeStudents: number
  programs: number
  classes: number
  completionRate: number
  passRate: number
  averageScore: number | null
  noQuiz: number
  leftSchool: number
  paused: number
  waiting: number
  belowAverage: number
  passed: number
  statusCounts: Record<string, number>
  inactive: QuietStudent[]
}

function client() {
  if (!supabase) throw new Error('missing-supabase')
  return supabase
}

export function isQuiet(person: QuietStudent, days: number, now = Date.now()) {
  const cutoff = now - days * 24 * 60 * 60 * 1000
  const seen = person.lastSeen ? new Date(person.lastSeen).getTime() : null
  if (seen !== null && Number.isFinite(seen)) return seen < cutoff
  const enrolled = person.enrolledAt ? new Date(person.enrolledAt).getTime() : null
  if (enrolled !== null && Number.isFinite(enrolled)) return enrolled < cutoff
  return true
}

export async function loadSchoolOverview(): Promise<SchoolOverview> {
  const db = client()
  const programs = await db.from('programs').select('id, title')
  if (programs.error) throw programs.error
  const classes = await db.from('course_classes').select('id')
  if (classes.error) throw classes.error
  const enrollments = await db.from('program_enrollments').select('student_id, program_id, enrollment_date, status').eq('status', 'active')
  if (enrollments.error) throw enrollments.error

  const programRows = programs.data ?? []
  const enrollmentRows = (enrollments.data ?? []).filter((row) => row.student_id && row.program_id)
  const studentIds = [...new Set(enrollmentRows.map((row) => row.student_id as string))]
  const programIds = [...new Set(enrollmentRows.map((row) => row.program_id as string))]

  const profiles =
    studentIds.length === 0
      ? { data: [] as { id: string; full_name: string | null; status: string | null }[], error: null }
      : await db.from('profiles').select('id, full_name, status').in('id', studentIds)
  if (profiles.error) throw profiles.error

  const links =
    programIds.length === 0
      ? { data: [] as { program_id: string; lesson_id: string }[], error: null }
      : await db.from('program_lessons').select('program_id, lesson_id').in('program_id', programIds)
  if (links.error) throw links.error
  const lessonIds = [...new Set((links.data ?? []).map((link) => link.lesson_id))]
  const quizzes =
    lessonIds.length === 0
      ? { data: [] as { id: string; lesson_id: string | null }[], error: null }
      : await db.from('quizzes').select('id, lesson_id').in('lesson_id', lessonIds)
  if (quizzes.error) throw quizzes.error
  const quizIds = (quizzes.data ?? []).map((quiz) => quiz.id)
  const submissions =
    quizIds.length === 0 || studentIds.length === 0
      ? { data: [] as { student_id: string | null; quiz_id: string | null; score: number | null; submitted_at: string | null }[], error: null }
      : await db.from('quiz_submissions').select('student_id, quiz_id, score, submitted_at').in('quiz_id', quizIds).in('student_id', studentIds)
  if (submissions.error) throw submissions.error

  const titles = new Map(programRows.map((program) => [program.id, asLocalized(program.title)]))
  const names = new Map((profiles.data ?? []).map((profile) => [profile.id, profile.full_name ?? '']))
  const study = new Map((profiles.data ?? []).map((profile) => [profile.id, profile.status || 'studying']))
  const lessonsByProgram = new Map<string, string[]>()
  for (const link of links.data ?? []) {
    const list = lessonsByProgram.get(link.program_id) ?? []
    list.push(link.lesson_id)
    lessonsByProgram.set(link.program_id, list)
  }
  const quizzesByLesson = new Map<string, string[]>()
  for (const quiz of quizzes.data ?? []) {
    if (!quiz.lesson_id) continue
    const list = quizzesByLesson.get(quiz.lesson_id) ?? []
    list.push(quiz.id)
    quizzesByLesson.set(quiz.lesson_id, list)
  }

  const statusCounts: Record<string, number> = { studying: 0, paused: 0, dropped: 0, withdrawn: 0 }
  for (const studentId of studentIds) {
    const status = study.get(studentId) || 'studying'
    statusCounts[status] = (statusCounts[status] ?? 0) + 1
  }

  let quizEnrollments = 0
  let completed = 0
  const noQuizIds = new Set<string>()
  const passedIds = new Set<string>()
  const belowIds = new Set<string>()
  const waitingIds = new Set<string>()
  const averages: number[] = []
  const inactive: QuietStudent[] = []

  for (const row of enrollmentRows) {
    const studentId = row.student_id as string
    const programId = row.program_id as string
    const status = study.get(studentId) || 'studying'
    const lessonList = lessonsByProgram.get(programId) ?? []
    const programQuizIds = new Set(lessonList.flatMap((lessonId) => quizzesByLesson.get(lessonId) ?? []))
    const mine = (submissions.data ?? []).filter(
      (submission) => submission.student_id === studentId && submission.quiz_id && programQuizIds.has(submission.quiz_id),
    )
    const lastSeen = mine.reduce<string | null>((latest, submission) => {
      if (!submission.submitted_at) return latest
      if (!latest || submission.submitted_at > latest) return submission.submitted_at
      return latest
    }, null)
    if (status === 'studying') {
      inactive.push({
        id: studentId,
        fullName: names.get(studentId) ?? '',
        programTitle: titles.get(programId) ?? { vi: '', my: '', bn: '' },
        lastSeen,
        enrolledAt: row.enrollment_date,
      })
    }
    if (programQuizIds.size === 0 || status !== 'studying') continue
    quizEnrollments += 1
    const answered = new Set(mine.map((submission) => submission.quiz_id))
    if (answered.size === 0) noQuizIds.add(studentId)
    if (answered.size >= programQuizIds.size) completed += 1
    if (mine.some((submission) => submission.score === null)) waitingIds.add(studentId)
    const scores = mine.map((submission) => submission.score).filter((score): score is number => typeof score === 'number' && Number.isFinite(score))
    if (scores.length === 0) continue
    const average = scores.reduce((sum, score) => sum + score, 0) / scores.length
    averages.push(average)
    if (average >= passingScore) passedIds.add(studentId)
    else belowIds.add(studentId)
  }

  const passed = passedIds.size
  const belowAverage = belowIds.size
  const scored = passed + belowAverage
  const averageScore = averages.length === 0 ? null : averages.reduce((sum, value) => sum + value, 0) / averages.length

  return {
    activeStudents: statusCounts.studying ?? 0,
    programs: programRows.length,
    classes: (classes.data ?? []).length,
    completionRate: quizEnrollments === 0 ? 0 : Math.round((completed / quizEnrollments) * 100),
    passRate: scored === 0 ? 0 : Math.round((passed / scored) * 100),
    averageScore,
    noQuiz: noQuizIds.size,
    leftSchool: (statusCounts.dropped ?? 0) + (statusCounts.withdrawn ?? 0),
    paused: statusCounts.paused ?? 0,
    waiting: waitingIds.size,
    belowAverage,
    passed,
    statusCounts,
    inactive,
  }
}
