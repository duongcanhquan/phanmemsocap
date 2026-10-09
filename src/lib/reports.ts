import { asLocalized, type LocalizedText } from './localized'
import { supabase } from './supabase'

export type ScoreCell = number | null

export type ScoreReport = {
  programTitle: LocalizedText
  lessons: { id: string; title: LocalizedText }[]
  students: {
    id: string
    name: string
    scores: ScoreCell[]
    average: ScoreCell
  }[]
}

function client() {
  if (!supabase) throw new Error('missing-supabase')
  return supabase
}

function average(values: number[]): ScoreCell {
  if (values.length === 0) return null
  return values.reduce((sum, value) => sum + value, 0) / values.length
}

export async function loadScoreReport(programId: string): Promise<ScoreReport | null> {
  const db = client()
  const program = await db.from('programs').select('id, title').eq('id', programId).maybeSingle()
  if (program.error) throw program.error
  if (!program.data) return null

  const lessons = await db
    .from('lessons')
    .select('id, title, order_index')
    .eq('program_id', programId)
    .order('order_index', { ascending: true })
  if (lessons.error) throw lessons.error
  const lessonRows = lessons.data ?? []

  const enrollments = await db.from('program_enrollments').select('student_id').eq('program_id', programId)
  if (enrollments.error) throw enrollments.error
  const studentIds = [
    ...new Set((enrollments.data ?? []).map((row) => row.student_id).filter((id): id is string => Boolean(id))),
  ]

  const profiles =
    studentIds.length === 0
      ? { data: [], error: null }
      : await db.from('profiles').select('id, full_name').in('id', studentIds)
  if (profiles.error) throw profiles.error

  const lessonIds = lessonRows.map((lesson) => lesson.id)
  const quizzes =
    lessonIds.length === 0
      ? { data: [], error: null }
      : await db.from('quizzes').select('id, lesson_id').in('lesson_id', lessonIds)
  if (quizzes.error) throw quizzes.error

  const quizIds = (quizzes.data ?? []).map((quiz) => quiz.id)
  const submissions =
    quizIds.length === 0 || studentIds.length === 0
      ? { data: [], error: null }
      : await db.from('quiz_submissions').select('student_id, quiz_id, score').in('quiz_id', quizIds).in('student_id', studentIds)
  if (submissions.error) throw submissions.error

  const quizzesByLesson = new Map<string, string[]>()
  for (const quiz of quizzes.data ?? []) {
    if (!quiz.lesson_id) continue
    const list = quizzesByLesson.get(quiz.lesson_id) ?? []
    list.push(quiz.id)
    quizzesByLesson.set(quiz.lesson_id, list)
  }

  const names = new Map((profiles.data ?? []).map((profile) => [profile.id, profile.full_name ?? '']))

  const students = studentIds
    .map((studentId) => {
      const scores = lessonRows.map((lesson) => {
        const ids = new Set(quizzesByLesson.get(lesson.id) ?? [])
        const values = (submissions.data ?? [])
          .filter((row) => row.student_id === studentId && row.quiz_id && ids.has(row.quiz_id) && typeof row.score === 'number')
          .map((row) => row.score as number)
        return average(values)
      })
      return {
        id: studentId,
        name: names.get(studentId) ?? '',
        scores,
        average: average(scores.filter((score): score is number => score !== null)),
      }
    })
    .sort((a, b) => a.name.localeCompare(b.name))

  return {
    programTitle: asLocalized(program.data.title),
    lessons: lessonRows.map((lesson) => ({ id: lesson.id, title: asLocalized(lesson.title) })),
    students,
  }
}

export type TranscriptLesson = {
  title: LocalizedText
  score: ScoreCell
  comment: string
}

export type StudentTranscript = {
  fullName: string
  dateOfBirth: string
  phone: string
  nationalId: string
  passport: string
  programTitle: LocalizedText
  lessons: TranscriptLesson[]
  average: ScoreCell
}

export async function loadStudentTranscript(studentId: string, programId: string): Promise<StudentTranscript | null> {
  const db = client()
  const [profile, program, lessons] = await Promise.all([
    db.from('profiles').select('full_name, date_of_birth, phone, national_id, passport').eq('id', studentId).maybeSingle(),
    db.from('programs').select('title').eq('id', programId).maybeSingle(),
    db.from('lessons').select('id, title, order_index').eq('program_id', programId).order('order_index', { ascending: true }),
  ])
  if (profile.error) throw profile.error
  if (program.error) throw program.error
  if (lessons.error) throw lessons.error
  if (!profile.data || !program.data) return null

  const lessonRows = lessons.data ?? []
  const lessonIds = lessonRows.map((lesson) => lesson.id)
  const quizzes =
    lessonIds.length === 0
      ? { data: [], error: null }
      : await db.from('quizzes').select('id, lesson_id').in('lesson_id', lessonIds)
  if (quizzes.error) throw quizzes.error

  const quizIds = (quizzes.data ?? []).map((quiz) => quiz.id)
  const submissions =
    quizIds.length === 0
      ? { data: [], error: null }
      : await db
          .from('quiz_submissions')
          .select('quiz_id, score, teacher_feedback')
          .eq('student_id', studentId)
          .in('quiz_id', quizIds)
  if (submissions.error) throw submissions.error

  const quizzesByLesson = new Map<string, string[]>()
  for (const quiz of quizzes.data ?? []) {
    if (!quiz.lesson_id) continue
    const list = quizzesByLesson.get(quiz.lesson_id) ?? []
    list.push(quiz.id)
    quizzesByLesson.set(quiz.lesson_id, list)
  }

  const transcriptLessons = lessonRows.map((lesson) => {
    const ids = new Set(quizzesByLesson.get(lesson.id) ?? [])
    const mine = (submissions.data ?? []).filter((row) => row.quiz_id && ids.has(row.quiz_id))
    const scores = mine.map((row) => row.score).filter((score): score is number => typeof score === 'number')
    const comments = mine.map((row) => row.teacher_feedback?.trim() ?? '').filter(Boolean)
    return {
      title: asLocalized(lesson.title),
      score: average(scores),
      comment: comments.join('\n'),
    }
  })

  return {
    fullName: profile.data.full_name ?? '',
    dateOfBirth: profile.data.date_of_birth ?? '',
    phone: profile.data.phone ?? '',
    nationalId: profile.data.national_id ?? '',
    passport: profile.data.passport ?? '',
    programTitle: asLocalized(program.data.title),
    lessons: transcriptLessons,
    average: average(transcriptLessons.map((lesson) => lesson.score).filter((score): score is number => score !== null)),
  }
}
