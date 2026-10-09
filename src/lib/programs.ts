import {
  asLocalized,
  emptyLocalized,
  toLocalizedJson,
  type LocalizedText,
} from './localized'
import { supabase, type Json } from './supabase'

export const lessonTypes = ['text', 'pdf', 'slides', 'video', 'quiz'] as const

export type LessonType = (typeof lessonTypes)[number]

export type ProgramRecord = {
  id: string
  title: LocalizedText
  description: LocalizedText
  category: string
  coverImageUrl: string
  isActive: boolean
  teacherId: string
}

export type LessonRecord = {
  id: string
  title: LocalizedText
  moduleName: LocalizedText
  contentType: LessonType
  contentUrl: string
  orderIndex: number
  isPublished: boolean
  authorId: string
  createdAt: string | null
  gated: boolean
  required: boolean
}

export type QuizRecord = {
  id: string
  question: LocalizedText
  options: LocalizedText[]
  correctOptionIndex: number
  isEssay: boolean
  points: number
}

export type LessonQuizSettings = {
  passMark: number
  shuffleQuestions: boolean
  shuffleOptions: boolean
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
    .select('id, title, description, category, cover_image_url, is_active, teacher_id')
    .order('created_at', { ascending: false })

  if (error) throw error

  return (data ?? []).map((row) => ({
    id: row.id,
    title: asLocalized(row.title),
    description: asLocalized(row.description),
    category: row.category ?? '',
    coverImageUrl: row.cover_image_url ?? '',
    isActive: row.is_active ?? false,
    teacherId: row.teacher_id ?? '',
  }))
}

export async function getProgram(programId: string): Promise<ProgramRecord | null> {
  const { data, error } = await client()
    .from('programs')
    .select('id, title, description, category, cover_image_url, is_active, teacher_id')
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
    teacherId: data.teacher_id ?? '',
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
      teacher_id: input.teacherId || null,
    })
    .select('id')
    .single()

  if (error) throw error
  const classroom = await client().from('course_classes').insert({ program_id: data.id, name: 'Lớp 1' })
  if (classroom.error) throw classroom.error
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
      teacher_id: input.teacherId || null,
    })
    .eq('id', programId)

  if (error) throw error
}

export async function listLessons(programId: string): Promise<LessonRecord[]> {
  const db = client()
  const links = await db
    .from('program_lessons')
    .select('lesson_id, order_index, gated, required')
    .eq('program_id', programId)
    .order('order_index', { ascending: true })
  if (links.error) throw links.error
  const order = new Map((links.data ?? []).map((link) => [link.lesson_id, link]))
  const ids = [...order.keys()]
  if (ids.length === 0) return []

  const { data, error } = await db
    .from('lessons')
    .select('id, title, module_name, content_type, content_url, is_published, author_id, created_at')
    .in('id', ids)
  if (error) throw error

  return (data ?? [])
    .map((row) => ({
      id: row.id,
      title: asLocalized(row.title),
      moduleName: asLocalized(row.module_name),
      contentType: isLessonType(row.content_type) ? row.content_type : 'text',
      contentUrl: row.content_url ?? '',
      orderIndex: order.get(row.id)?.order_index ?? 0,
      isPublished: row.is_published ?? false,
      authorId: row.author_id ?? '',
      createdAt: row.created_at,
      gated: order.get(row.id)?.gated ?? true,
      required: order.get(row.id)?.required ?? true,
    }))
    .sort((left, right) => left.orderIndex - right.orderIndex || (left.createdAt ?? '').localeCompare(right.createdAt ?? ''))
}

export async function lessonCourseIds(lessonId: string): Promise<string[]> {
  const { data, error } = await client()
    .from('program_lessons')
    .select('program_id, order_index')
    .eq('lesson_id', lessonId)
    .order('order_index', { ascending: true })
  if (error) throw error
  return (data ?? []).map((row) => row.program_id)
}

export async function saveLessonOrder(programId: string, lessons: LessonRecord[]): Promise<void> {
  const db = client()
  const results = await Promise.all(
    lessons.map((lesson, index) =>
      db.from('program_lessons').update({ order_index: index }).eq('program_id', programId).eq('lesson_id', lesson.id),
    ),
  )
  const failed = results.find((result) => result.error)
  if (failed?.error) throw failed.error
}

export async function syncLessonCourses(lessonId: string, programIds: string[], orderedProgramId: string, orderIndex: number): Promise<void> {
  const db = client()
  const existing = await db.from('program_lessons').select('program_id').eq('lesson_id', lessonId)
  if (existing.error) throw existing.error
  const have = new Set((existing.data ?? []).map((row) => row.program_id))
  const keep = new Set(programIds)
  const remove = [...have].filter((id) => !keep.has(id))
  if (remove.length > 0) {
    const removed = await db.from('program_lessons').delete().eq('lesson_id', lessonId).in('program_id', remove)
    if (removed.error) throw removed.error
  }
  const added = programIds.filter((id) => !have.has(id))
  if (added.length > 0) {
    const tops = await Promise.all(
      added.map((programId) =>
        db.from('program_lessons').select('order_index').eq('program_id', programId).order('order_index', { ascending: false }).limit(1),
      ),
    )
    const failed = tops.find((result) => result.error)
    if (failed?.error) throw failed.error
    const modes = await db.from('programs').select('id, advance_mode').in('id', added)
    if (modes.error) throw modes.error
    const openCourses = new Set((modes.data ?? []).filter((row) => row.advance_mode === 'open').map((row) => row.id))
    const inserted = await db.from('program_lessons').insert(
      added.map((programId, index) => ({
        program_id: programId,
        lesson_id: lessonId,
        order_index: (tops[index]?.data?.[0]?.order_index ?? -1) + 1,
        gated: !openCourses.has(programId),
        required: true,
      })),
    )
    if (inserted.error) throw inserted.error
  }
  if (keep.has(orderedProgramId)) {
    const placed = await db
      .from('program_lessons')
      .update({ order_index: orderIndex })
      .eq('program_id', orderedProgramId)
      .eq('lesson_id', lessonId)
    if (placed.error) throw placed.error
  }
}

export async function setAdvanceMode(programId: string, mode: 'sequence' | 'open'): Promise<void> {
  const db = client()
  const program = await db.from('programs').update({ advance_mode: mode }).eq('id', programId)
  if (program.error) throw program.error
  const links = await db.from('program_lessons').update({ gated: mode === 'sequence' }).eq('program_id', programId)
  if (links.error) throw links.error
}

export async function setLessonRule(
  programId: string,
  lessonId: string,
  rule: { gated?: boolean; required?: boolean },
): Promise<void> {
  const { error } = await client()
    .from('program_lessons')
    .update(rule)
    .eq('program_id', programId)
    .eq('lesson_id', lessonId)
  if (error) throw error
}

export async function getAdvanceMode(programId: string): Promise<'sequence' | 'open'> {
  const { data, error } = await client().from('programs').select('advance_mode').eq('id', programId).maybeSingle()
  if (error) throw error
  return data?.advance_mode === 'open' ? 'open' : 'sequence'
}

export async function saveLesson(
  programId: string,
  lesson: Omit<LessonRecord, 'id' | 'orderIndex' | 'createdAt' | 'authorId' | 'gated' | 'required'> & {
    id?: string
    orderIndex?: number
    authorId?: string
    quiz?: LessonQuizSettings
  },
): Promise<string> {
  const payload = {
    program_id: programId,
    title: toLocalizedJson(lesson.title),
    module_name: toLocalizedJson(lesson.moduleName),
    content_type: lesson.contentType,
    content_url: lesson.contentUrl.trim() || null,
    is_published: lesson.isPublished,
    order_index: lesson.orderIndex ?? 0,
    ...(lesson.authorId !== undefined ? { author_id: lesson.authorId || null } : {}),
    ...(lesson.quiz
      ? {
          pass_mark: lesson.quiz.passMark,
          shuffle_questions: lesson.quiz.shuffleQuestions,
          shuffle_options: lesson.quiz.shuffleOptions,
        }
      : {}),
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

export async function deleteProgram(programId: string): Promise<void> {
  const { error } = await client().from('programs').delete().eq('id', programId)
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
    .select('id, question, options, correct_option_index, is_essay, points, position')
    .eq('lesson_id', lessonId)
    .order('position', { ascending: true })
    .order('created_at', { ascending: true })

  if (error) throw error

  return (data ?? []).map((row) => ({
    id: row.id,
    question: asLocalized(row.question),
    options: asOptionList(row.options),
    correctOptionIndex: row.correct_option_index ?? 0,
    isEssay: row.is_essay ?? false,
    points: row.points ?? 1,
  }))
}

export async function getLessonQuizSettings(lessonId: string): Promise<LessonQuizSettings> {
  const { data, error } = await client()
    .from('lessons')
    .select('pass_mark, shuffle_questions, shuffle_options')
    .eq('id', lessonId)
    .maybeSingle()
  if (error) throw error
  const passMark = Number(data?.pass_mark ?? 5)
  return {
    passMark: Number.isFinite(passMark) ? passMark : 5,
    shuffleQuestions: data?.shuffle_questions ?? false,
    shuffleOptions: data?.shuffle_options ?? false,
  }
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
      points: Math.min(20, Math.max(1, Math.round(quiz.points || 1))),
      position: quizzes.indexOf(quiz),
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

export async function listTeachers(): Promise<StudentRecord[]> {
  const { data, error } = await client().rpc('list_teacher_names')
  if (error) throw error
  return (data ?? [])
    .map((row) => ({ id: row.id, fullName: row.full_name ?? '' }))
    .sort((a, b) => a.fullName.localeCompare(b.fullName))
}

export async function listProgramTeacherIds(): Promise<Record<string, string[]>> {
  const { data, error } = await client().from('program_teachers').select('program_id, teacher_id')
  if (error) throw error
  const grouped: Record<string, string[]> = {}
  for (const row of data ?? []) {
    const list = grouped[row.program_id] ?? []
    list.push(row.teacher_id)
    grouped[row.program_id] = list
  }
  return grouped
}

export async function saveProgramTeachers(programId: string, teacherIds: string[]): Promise<void> {
  const db = client()
  const removed = await db.from('program_teachers').delete().eq('program_id', programId)
  if (removed.error) throw removed.error
  if (teacherIds.length === 0) return
  const inserted = await db.from('program_teachers').insert(
    teacherIds.map((teacherId) => ({ program_id: programId, teacher_id: teacherId })),
  )
  if (inserted.error) throw inserted.error
}

export async function listStudents(): Promise<StudentRecord[]> {
  const { data, error } = await client().rpc('list_enrollable_students')
  if (error) throw error
  return (data ?? [])
    .map((row) => ({ id: row.id, fullName: row.full_name ?? '' }))
    .sort((a, b) => a.fullName.localeCompare(b.fullName))
}

export type CourseClass = {
  id: string
  programId: string
  name: string
  startsOn: string
  endsOn: string
}

function asClass(row: { id: string; program_id: string; name: string; starts_on: string | null; ends_on: string | null }): CourseClass {
  return { id: row.id, programId: row.program_id, name: row.name, startsOn: row.starts_on ?? '', endsOn: row.ends_on ?? '' }
}

export async function listClasses(programId?: string): Promise<CourseClass[]> {
  let query = client().from('course_classes').select('id, program_id, name, starts_on, ends_on').order('name')
  if (programId) query = query.eq('program_id', programId)
  const { data, error } = await query
  if (error) throw error
  return (data ?? []).map(asClass)
}

export async function createClass(
  programId: string,
  input: { name: string; startsOn?: string; endsOn?: string },
): Promise<CourseClass> {
  const { data, error } = await client()
    .from('course_classes')
    .insert({
      program_id: programId,
      name: input.name,
      starts_on: input.startsOn || null,
      ends_on: input.endsOn || null,
    })
    .select('id, program_id, name, starts_on, ends_on')
    .single()
  if (error) throw error
  return asClass(data)
}

export async function updateClass(
  classId: string,
  input: { name: string; startsOn?: string; endsOn?: string },
): Promise<void> {
  const { error } = await client()
    .from('course_classes')
    .update({ name: input.name, starts_on: input.startsOn || null, ends_on: input.endsOn || null })
    .eq('id', classId)
  if (error) throw error
}

export async function listEnrollments(classId: string): Promise<EnrollmentRecord[]> {
  const { data, error } = await client()
    .from('program_enrollments')
    .select('id, student_id')
    .eq('class_id', classId)

  if (error) throw error
  return (data ?? [])
    .filter((row) => row.student_id)
    .map((row) => ({ id: row.id, studentId: row.student_id as string }))
}

export async function enrollStudents(programId: string, classId: string, studentIds: string[]): Promise<void> {
  if (studentIds.length === 0) return
  const { error } = await client()
    .from('program_enrollments')
    .insert(studentIds.map((studentId) => ({ student_id: studentId, program_id: programId, class_id: classId, status: 'active' })))
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
