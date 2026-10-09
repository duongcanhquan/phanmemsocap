import {
  asLocalized,
  emptyLocalized,
  toLocalizedJson,
  type LocalizedText,
} from './localized'
import { supabase, type Json } from './supabase'

export const lessonTypes = ['pdf', 'video', 'text', 'quiz'] as const

export type LessonType = (typeof lessonTypes)[number]

export type ProgramRecord = {
  id: string
  title: LocalizedText
  description: LocalizedText
  category: string
  coverImageUrl: string
  isActive: boolean
}

export type LessonRecord = {
  id: string
  title: LocalizedText
  moduleName: LocalizedText
  contentType: LessonType
  contentUrl: string
  orderIndex: number
  isPublished: boolean
}

export type QuizRecord = {
  id: string
  question: LocalizedText
  options: LocalizedText[]
  correctOptionIndex: number
  isEssay: boolean
}

export type StudentRecord = {
  id: string
  fullName: string
}

export type EnrollmentRecord = {
  id: string
  studentId: string
}

function client() {
  if (!supabase) {
    throw new Error('missing-supabase')
  }
  return supabase
}

function isLessonType(value: string | null): value is LessonType {
  return value === 'pdf' || value === 'video' || value === 'text' || value === 'quiz'
}

export async function listPrograms(): Promise<ProgramRecord[]> {
  const { data, error } = await client()
    .from('programs')
    .select('id, title, description, category, cover_image_url, is_active')
    .order('created_at', { ascending: false })

  if (error) throw error

  return (data ?? []).map((row) => ({
    id: row.id,
    title: asLocalized(row.title),
    description: asLocalized(row.description),
    category: row.category ?? '',
    coverImageUrl: row.cover_image_url ?? '',
    isActive: row.is_active ?? false,
  }))
}

export async function getProgram(programId: string): Promise<ProgramRecord | null> {
  const { data, error } = await client()
    .from('programs')
    .select('id, title, description, category, cover_image_url, is_active')
    .eq('id', programId)
    .maybeSingle()

  if (error) throw error
  if (!data) return null

  return {
    id: data.id,
    title: asLocalized(data.title),
    description: asLocalized(data.description),
    category: data.category ?? '',
    coverImageUrl: data.cover_image_url ?? '',
    isActive: data.is_active ?? false,
  }
}

export async function createProgram(input: Omit<ProgramRecord, 'id'>): Promise<string> {
  const { data, error } = await client()
    .from('programs')
    .insert({
      title: toLocalizedJson(input.title),
      description: toLocalizedJson(input.description),
      category: input.category.trim() || null,
      cover_image_url: input.coverImageUrl.trim() || null,
      is_active: input.isActive,
    })
    .select('id')
    .single()

  if (error) throw error
  return data.id
}

export async function updateProgram(programId: string, input: Omit<ProgramRecord, 'id'>): Promise<void> {
  const { error } = await client()
    .from('programs')
    .update({
      title: toLocalizedJson(input.title),
      description: toLocalizedJson(input.description),
      category: input.category.trim() || null,
      cover_image_url: input.coverImageUrl.trim() || null,
      is_active: input.isActive,
    })
    .eq('id', programId)

  if (error) throw error
}

export async function listLessons(programId: string): Promise<LessonRecord[]> {
  const { data, error } = await client()
    .from('lessons')
    .select('id, title, module_name, content_type, content_url, order_index, is_published')
    .eq('program_id', programId)
    .order('order_index', { ascending: true })

  if (error) throw error

  return (data ?? []).map((row, index) => ({
    id: row.id,
    title: asLocalized(row.title),
    moduleName: asLocalized(row.module_name),
    contentType: isLessonType(row.content_type) ? row.content_type : 'text',
    contentUrl: row.content_url ?? '',
    orderIndex: row.order_index ?? index,
    isPublished: row.is_published ?? false,
  }))
}

export async function saveLessonOrder(lessons: LessonRecord[]): Promise<void> {
  const db = client()
  const results = await Promise.all(
    lessons.map((lesson, index) => db.from('lessons').update({ order_index: index }).eq('id', lesson.id)),
  )
  const failed = results.find((result) => result.error)
  if (failed?.error) throw failed.error
}

export async function saveLesson(
  programId: string,
  lesson: Omit<LessonRecord, 'id' | 'orderIndex'> & { id?: string; orderIndex?: number },
): Promise<string> {
  const payload = {
    program_id: programId,
    title: toLocalizedJson(lesson.title),
    module_name: toLocalizedJson(lesson.moduleName),
    content_type: lesson.contentType,
    content_url: lesson.contentUrl.trim() || null,
    is_published: lesson.isPublished,
    order_index: lesson.orderIndex ?? 0,
  }
  if (lesson.id) {
    const { error } = await client().from('lessons').update(payload).eq('id', lesson.id)
    if (error) throw error
    return lesson.id
  }
  const { data, error } = await client().from('lessons').insert(payload).select('id').single()
  if (error) throw error
  return data.id
}

export async function saveLessonContent(lessonId: string, contentUrl: string): Promise<void> {
  const { error } = await client().from('lessons').update({ content_url: contentUrl }).eq('id', lessonId)
  if (error) throw error
}

export async function deleteLesson(lessonId: string): Promise<void> {
  const db = client()
  const quizzes = await db.from('quizzes').delete().eq('lesson_id', lessonId)
  if (quizzes.error) throw quizzes.error
  const { error } = await db.from('lessons').delete().eq('id', lessonId)
  if (error) throw error
}

function asOptionList(value: Json | null): LocalizedText[] {
  if (!Array.isArray(value)) return [emptyLocalized(), emptyLocalized()]
  const options = value.map((item) => asLocalized(item))
  return options.length > 0 ? options : [emptyLocalized(), emptyLocalized()]
}

export async function listQuizzes(lessonId: string): Promise<QuizRecord[]> {
  const { data, error } = await client()
    .from('quizzes')
    .select('id, question, options, correct_option_index, is_essay')
    .eq('lesson_id', lessonId)
    .order('created_at', { ascending: true })

  if (error) throw error

  return (data ?? []).map((row) => ({
    id: row.id,
    question: asLocalized(row.question),
    options: asOptionList(row.options),
    correctOptionIndex: row.correct_option_index ?? 0,
    isEssay: row.is_essay ?? false,
  }))
}

export async function saveQuizzes(lessonId: string, quizzes: QuizRecord[]): Promise<void> {
  const db = client()
  const existing = await db.from('quizzes').select('id').eq('lesson_id', lessonId)
  if (existing.error) throw existing.error
  const keep = new Set(quizzes.map((quiz) => quiz.id).filter((id) => !id.startsWith('new-')))
  const removeIds = (existing.data ?? []).map((row) => row.id).filter((id) => !keep.has(id))
  if (removeIds.length > 0) {
    const removed = await db.from('quizzes').delete().in('id', removeIds)
    if (removed.error) throw removed.error
  }

  for (const quiz of quizzes) {
    const payload = {
      lesson_id: lessonId,
      question: toLocalizedJson(quiz.question),
      options: quiz.isEssay ? [] : quiz.options.map((option) => toLocalizedJson(option)),
      correct_option_index: quiz.isEssay ? null : quiz.correctOptionIndex,
      is_essay: quiz.isEssay,
    }
    if (quiz.id.startsWith('new-')) {
      const inserted = await db.from('quizzes').insert(payload)
      if (inserted.error) throw inserted.error
    } else {
      const updated = await db.from('quizzes').update(payload).eq('id', quiz.id)
      if (updated.error) throw updated.error
    }
  }
}

export async function listStudents(): Promise<StudentRecord[]> {
  const { data, error } = await client()
    .from('profiles')
    .select('id, full_name')
    .eq('role', 'student')
    .order('full_name', { ascending: true })

  if (error) throw error
  return (data ?? []).map((row) => ({ id: row.id, fullName: row.full_name ?? '' }))
}

export async function listEnrollments(programId: string): Promise<EnrollmentRecord[]> {
  const { data, error } = await client()
    .from('program_enrollments')
    .select('id, student_id')
    .eq('program_id', programId)

  if (error) throw error
  return (data ?? [])
    .filter((row) => row.student_id)
    .map((row) => ({ id: row.id, studentId: row.student_id as string }))
}

export async function enrollStudents(programId: string, studentIds: string[]): Promise<void> {
  if (studentIds.length === 0) return
  const { error } = await client()
    .from('program_enrollments')
    .insert(studentIds.map((studentId) => ({ student_id: studentId, program_id: programId, status: 'active' })))
  if (error) throw error
}

export async function removeEnrollments(enrollmentIds: string[]): Promise<void> {
  if (enrollmentIds.length === 0) return
  const { error } = await client().from('program_enrollments').delete().in('id', enrollmentIds)
  if (error) throw error
}

export async function enrollmentCounts(): Promise<Record<string, number>> {
  const { data, error } = await client().from('program_enrollments').select('program_id')
  if (error) throw error
  const counts: Record<string, number> = {}
  for (const row of data ?? []) {
    if (!row.program_id) continue
    counts[row.program_id] = (counts[row.program_id] ?? 0) + 1
  }
  return counts
}
