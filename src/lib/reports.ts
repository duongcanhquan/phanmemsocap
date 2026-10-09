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
