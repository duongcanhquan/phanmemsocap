import { asLocalized, type LocalizedText } from './localized'
import { passingScore } from './student'
import { supabase } from './supabase'
import type { TranscriptLesson } from './reports'

export type StudentPlacement = {
  className: string
  programId: string
  programTitle: LocalizedText
  done: number
  total: number
  percent: number
  currentIndex: number | null
  currentTitle: LocalizedText | null
  average: number | null
  lessons: TranscriptLesson[]
}

export type StudentFile = {
  fullName: string
  dateOfBirth: string
  phone: string
  nationalId: string
  passport: string
  nationality: string
  studyStatus: string
  placements: StudentPlacement[]
}

function client() {
  if (!supabase) throw new Error('missing-supabase')
  return supabase
}

function average(values: number[]) {
  if (values.length === 0) return null
  return Math.round((values.reduce((sum, value) => sum + value, 0) / values.length) * 10) / 10
}

export async function loadStudentFile(studentId: string): Promise<StudentFile | null> {
  const db = client()
  const withNation = await db
    .from('profiles')
    .select('full_name, date_of_birth, phone, national_id, passport, nationality, status, role')
    .eq('id', studentId)
    .maybeSingle()
  const missingNation = Boolean(withNation.error && /nationality/i.test(withNation.error.message))
  const profile = missingNation
    ? await db
        .from('profiles')
        .select('full_name, date_of_birth, phone, national_id, passport, status, role')
        .eq('id', studentId)
        .maybeSingle()
    : withNation
  if (profile.error) throw profile.error
  if (!profile.data || profile.data.role !== 'student') return null

  const enrollments = await db
    .from('program_enrollments')
    .select('class_id, program_id')
    .eq('student_id', studentId)
  if (enrollments.error) throw enrollments.error

  const classIds = [...new Set((enrollments.data ?? []).map((row) => row.class_id).filter((id): id is string => Boolean(id)))]
  const programIds = [...new Set((enrollments.data ?? []).map((row) => row.program_id).filter((id): id is string => Boolean(id)))]
  const [classes, programs] = await Promise.all([
    classIds.length === 0 ? Promise.resolve({ data: [], error: null }) : db.from('course_classes').select('id, name').in('id', classIds),
    programIds.length === 0 ? Promise.resolve({ data: [], error: null }) : db.from('programs').select('id, title').in('id', programIds),
  ])
  if (classes.error) throw classes.error
  if (programs.error) throw programs.error
  const className = new Map((classes.data ?? []).map((row) => [row.id, row.name]))
  const programTitle = new Map((programs.data ?? []).map((row) => [row.id, asLocalized(row.title)]))

  const placements = await Promise.all(
    (enrollments.data ?? []).map((row) =>
      loadPlacement(studentId, row.class_id ? className.get(row.class_id) ?? '' : '', row.program_id ?? '', programTitle.get(row.program_id ?? '') ?? asLocalized(null)),
    ),
  )

  const row = profile.data as { nationality?: string | null }
  return {
    fullName: profile.data.full_name ?? '',
    dateOfBirth: profile.data.date_of_birth ?? '',
    phone: profile.data.phone ?? '',
    nationalId: profile.data.national_id ?? '',
    passport: profile.data.passport ?? '',
    nationality: row.nationality ?? '',
    studyStatus: profile.data.status || 'studying',
    placements,
  }
}

async function loadPlacement(
  studentId: string,
  className: string,
  programId: string,
  programTitle: LocalizedText,
): Promise<StudentPlacement> {
  const empty: StudentPlacement = {
    className,
    programId,
    programTitle,
    done: 0,
    total: 0,
    percent: 0,
    currentIndex: null,
    currentTitle: null,
    average: null,
    lessons: [],
  }
  if (!programId) return empty

  const db = client()
  const links = await db.from('program_lessons').select('lesson_id, order_index').eq('program_id', programId).order('order_index')
  if (links.error) throw links.error
  const order = new Map((links.data ?? []).map((link) => [link.lesson_id, link.order_index]))
  const lessonIds = [...order.keys()]
  if (lessonIds.length === 0) return empty

  const lessons = await db.from('lessons').select('id, title').in('id', lessonIds)
  if (lessons.error) throw lessons.error
  const ordered = (lessons.data ?? [])
    .map((lesson) => ({ ...lesson, orderIndex: order.get(lesson.id) ?? 0 }))
    .sort((left, right) => left.orderIndex - right.orderIndex)

  const quizzes = await db.from('quizzes').select('id, lesson_id').in('lesson_id', lessonIds)
  if (quizzes.error) throw quizzes.error
  const quizIds = (quizzes.data ?? []).map((quiz) => quiz.id)
  const submissions =
    quizIds.length === 0
      ? { data: [], error: null }
      : await db.from('quiz_submissions').select('quiz_id, score, teacher_feedback').eq('student_id', studentId).in('quiz_id', quizIds)
  if (submissions.error) throw submissions.error

  const quizzesByLesson = new Map<string, string[]>()
  for (const quiz of quizzes.data ?? []) {
    if (!quiz.lesson_id) continue
    const list = quizzesByLesson.get(quiz.lesson_id) ?? []
    list.push(quiz.id)
    quizzesByLesson.set(quiz.lesson_id, list)
  }
  const scored = new Map((submissions.data ?? []).filter((row) => row.quiz_id).map((row) => [row.quiz_id as string, row]))

  let currentIndex: number | null = null
  let currentTitle: LocalizedText | null = null
  let done = 0
  let graded = 0
  const transcript: TranscriptLesson[] = ordered.map((lesson) => {
    const ids = quizzesByLesson.get(lesson.id) ?? []
    const mine = ids.map((id) => scored.get(id)).filter((row): row is NonNullable<typeof row> => Boolean(row))
    const scores = ids.map((id) => scored.get(id)?.score).filter((score): score is number => typeof score === 'number')
    const complete = ids.length > 0 && ids.every((id) => typeof scored.get(id)?.score === 'number')
    const passed = ids.length > 0 && ids.every((id) => (scored.get(id)?.score ?? -1) >= passingScore)
    if (ids.length > 0) {
      graded += 1
      if (passed) done += 1
      else if (currentIndex === null) {
        currentIndex = graded
        currentTitle = asLocalized(lesson.title)
      }
    }
    return {
      title: asLocalized(lesson.title),
      score: complete ? average(scores) : null,
      comment: mine.map((row) => row.teacher_feedback?.trim() ?? '').filter(Boolean).join('\n'),
    }
  })

  const total = graded
  return {
    className,
    programId,
    programTitle,
    done,
    total,
    percent: total === 0 ? 0 : Math.round((done / total) * 100),
    currentIndex,
    currentTitle,
    average: average(transcript.map((lesson) => lesson.score).filter((score): score is number => score !== null)),
    lessons: transcript,
  }
}
