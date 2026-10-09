import { asLocalized, type LocalizedText } from './localized'
import { supabase, type Json } from './supabase'

export const passingScore = 5

export type EnrolledProgram = {
  id: string
  title: LocalizedText
  category: string
  coverImageUrl: string
}

export type LessonPathItem = {
  id: string
  title: LocalizedText
  contentType: string
  contentUrl: string
  orderIndex: number
  locked: boolean
  hasQuiz: boolean
}

export type StudentQuestion = {
  id: string
  question: LocalizedText
  options: LocalizedText[]
  isEssay: boolean
}

export type QuizGrade = {
  quizId: string
  isEssay: boolean
  isCorrect: boolean | null
  score: number | null
}

export type QuizSubmitResult = {
  lessonPassed: boolean
  results: QuizGrade[]
}

function client() {
  if (!supabase) throw new Error('missing-supabase')
  return supabase
}

function asObject(value: Json | null): Record<string, Json | undefined> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {}
}

function asArray(value: Json | null | undefined): Json[] {
  return Array.isArray(value) ? value : []
}

export async function listEnrolledPrograms(): Promise<EnrolledProgram[]> {
  const db = client()
  const enrollments = await db.from('program_enrollments').select('program_id').eq('status', 'active')
  if (enrollments.error) throw enrollments.error
  const ids = [...new Set((enrollments.data ?? []).map((row) => row.program_id).filter((id): id is string => Boolean(id)))]
  if (ids.length === 0) return []

  const programs = await db.from('programs').select('id, title, category, cover_image_url').in('id', ids)
  if (programs.error) throw programs.error
  return (programs.data ?? []).map((program) => ({
    id: program.id,
    title: asLocalized(program.title),
    category: program.category ?? '',
    coverImageUrl: program.cover_image_url ?? '',
  }))
}

export async function listLessonPath(programId: string): Promise<LessonPathItem[]> {
  const db = client()
  const lessons = await db
    .from('lessons')
    .select('id, title, content_type, content_url, order_index')
    .eq('program_id', programId)
    .order('order_index', { ascending: true })
  if (lessons.error) throw lessons.error

  const state = await db.rpc('program_lesson_state', { program_id: programId })
  if (state.error) throw state.error
  const flags = new Map(
    asArray(state.data).map((item) => {
      const row = asObject(item)
      return [
        typeof row.id === 'string' ? row.id : '',
        { locked: row.locked === true, hasQuiz: row.has_quiz === true },
      ]
    }),
  )

  return (lessons.data ?? []).map((lesson, index) => ({
    id: lesson.id,
    title: asLocalized(lesson.title),
    contentType: lesson.content_type ?? 'text',
    contentUrl: lesson.content_url ?? '',
    orderIndex: lesson.order_index ?? index,
    locked: flags.get(lesson.id)?.locked ?? false,
    hasQuiz: flags.get(lesson.id)?.hasQuiz ?? false,
  }))
}

export async function loadLessonQuestions(lessonId: string): Promise<StudentQuestion[]> {
  const { data, error } = await client().rpc('get_lesson_questions', { lesson_id: lessonId })
  if (error) throw error
  return asArray(data).map((item) => {
    const row = asObject(item)
    const options = asArray(row.options).map((option) => asLocalized(option))
    return {
      id: typeof row.id === 'string' ? row.id : '',
      question: asLocalized(row.question ?? null),
      options,
      isEssay: row.is_essay === true,
    }
  })
}

export async function loadExistingGrades(quizIds: string[]): Promise<QuizGrade[]> {
  if (quizIds.length === 0) return []
  const { data, error } = await client()
    .from('quiz_submissions')
    .select('quiz_id, is_correct, score')
    .in('quiz_id', quizIds)
  if (error) throw error
  return (data ?? []).map((row) => ({
    quizId: row.quiz_id ?? '',
    isEssay: row.score === null && row.is_correct === null,
    isCorrect: row.is_correct,
    score: row.score,
  }))
}

export async function submitLessonQuiz(
  lessonId: string,
  answers: { quizId: string; selectedOptionIndex?: number; essayAnswer?: string }[],
): Promise<QuizSubmitResult> {
  const { data, error } = await client().rpc('submit_lesson_quiz', {
    lesson_id: lessonId,
    answers: answers.map((answer) => ({
      quiz_id: answer.quizId,
      selected_option_index: answer.selectedOptionIndex ?? null,
      essay_answer: answer.essayAnswer ?? null,
    })),
  })
  if (error) throw error
  const payload = asObject(data)
  return {
    lessonPassed: payload.lesson_passed === true,
    results: asArray(payload.results).map((item) => {
      const row = asObject(item)
      return {
        quizId: typeof row.quiz_id === 'string' ? row.quiz_id : '',
        isEssay: row.is_essay === true,
        isCorrect: typeof row.is_correct === 'boolean' ? row.is_correct : null,
        score: typeof row.score === 'number' ? row.score : null,
      }
    }),
  }
}
