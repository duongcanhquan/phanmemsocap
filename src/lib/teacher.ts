import { asLocalized, type LocalizedText } from './localized'
import { passingScore } from './student'
import { supabase } from './supabase'

export type RosterRow = {
  studentId: string
  studentName: string
  programId: string
  programTitle: LocalizedText
  category: string
  classId: string
  className: string
  progress: number
  averageScore: number | null
  studyStatus: string
}

export type StudyEntry = {
  id: string
  lessonTitle: LocalizedText
  question: LocalizedText
  essayAnswer: string
  score: number | null
  feedback: string
  submittedAt: string | null
}

export type UngradedEssay = {
  id: string
  studentId: string
  studentName: string
  classId: string
  className: string
  programId: string
  programTitle: LocalizedText
  lessonTitle: LocalizedText
  question: LocalizedText
  essayAnswer: string
  score: number | null
  submittedAt: string | null
}

function client() {
  if (!supabase) throw new Error('missing-supabase')
  return supabase
}

function asScore(value: number | null): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

export async function listTeacherRoster(): Promise<RosterRow[]> {
  const db = client()
  const programs = await db.from('programs').select('id, title, category')
  if (programs.error) throw programs.error
  const programRows = programs.data ?? []
  if (programRows.length === 0) return []

  const programIds = programRows.map((program) => program.id)
  const enrollments = await db
    .from('program_enrollments')
    .select('student_id, program_id, class_id')
    .in('program_id', programIds)
  if (enrollments.error) throw enrollments.error

  const lessons = await db.from('program_lessons').select('program_id, lesson_id').in('program_id', programIds)
  if (lessons.error) throw lessons.error
  const lessonRows = lessons.data ?? []
  const lessonIds = [...new Set(lessonRows.map((lesson) => lesson.lesson_id))]

  const quizzes =
    lessonIds.length === 0
      ? { data: [], error: null }
      : await db.from('quizzes').select('id, lesson_id').in('lesson_id', lessonIds)
  if (quizzes.error) throw quizzes.error

  const studentIds = [
    ...new Set((enrollments.data ?? []).map((row) => row.student_id).filter((id): id is string => Boolean(id))),
  ]
  const profiles =
    studentIds.length === 0
      ? { data: [] as { id: string; full_name: string | null; status: string | null }[], error: null }
      : await db.from('profiles').select('id, full_name, status').in('id', studentIds)
  if (profiles.error) throw profiles.error

  const quizIds = (quizzes.data ?? []).map((quiz) => quiz.id)
  const submissions =
    quizIds.length === 0 || studentIds.length === 0
      ? { data: [], error: null }
      : await db.from('quiz_submissions').select('student_id, quiz_id, score').in('quiz_id', quizIds).in('student_id', studentIds)
  if (submissions.error) throw submissions.error

  const programsByLesson = new Map<string, string[]>()
  for (const lesson of lessonRows) {
    const list = programsByLesson.get(lesson.lesson_id) ?? []
    list.push(lesson.program_id)
    programsByLesson.set(lesson.lesson_id, list)
  }
  const quizzesByProgram = new Map<string, string[]>()
  for (const quiz of quizzes.data ?? []) {
    const placed = quiz.lesson_id ? programsByLesson.get(quiz.lesson_id) ?? [] : []
    for (const programId of placed) {
      const list = quizzesByProgram.get(programId) ?? []
      list.push(quiz.id)
      quizzesByProgram.set(programId, list)
    }
  }

  const classIds = [...new Set((enrollments.data ?? []).map((row) => row.class_id).filter((id): id is string => Boolean(id)))]
  const classRows =
    classIds.length === 0
      ? { data: [], error: null }
      : await db.from('course_classes').select('id, name').in('id', classIds)
  if (classRows.error) throw classRows.error
  const classNames = new Map((classRows.data ?? []).map((item) => [item.id, item.name]))
  const names = new Map((profiles.data ?? []).map((profile) => [profile.id, profile.full_name ?? '']))
  const studyByStudent = new Map((profiles.data ?? []).map((profile) => [profile.id, profile.status || 'studying']))
  const titles = new Map(programRows.map((program) => [program.id, asLocalized(program.title)]))
  const categories = new Map(programRows.map((program) => [program.id, program.category ?? '']))

  return (enrollments.data ?? [])
    .filter((row) => row.student_id && row.program_id && row.class_id)
    .map((row) => {
      const studentId = row.student_id as string
      const programId = row.program_id as string
      const programQuizIds = new Set(quizzesByProgram.get(programId) ?? [])
      const mine = (submissions.data ?? []).filter(
        (submission) => submission.student_id === studentId && submission.quiz_id && programQuizIds.has(submission.quiz_id),
      )
      const scoreByQuiz = new Map<string, number>()
      for (const submission of mine) {
        const score = asScore(submission.score)
        if (submission.quiz_id && score !== null) scoreByQuiz.set(submission.quiz_id, score)
      }
      const scores = [...scoreByQuiz.values()]
      const passed = [...scoreByQuiz].filter(([, score]) => score >= passingScore).length
      const progress = programQuizIds.size === 0 ? 0 : Math.round((passed / programQuizIds.size) * 100)
      const averageScore = scores.length === 0 ? null : scores.reduce((sum, score) => sum + score, 0) / scores.length
      return {
        studentId,
        studentName: names.get(studentId) ?? '',
        programId,
        programTitle: titles.get(programId) ?? { vi: '', my: '', bn: '' },
        category: categories.get(programId) ?? '',
        classId: row.class_id as string,
        className: classNames.get(row.class_id as string) ?? '',
        studyStatus: studyByStudent.get(studentId) ?? 'studying',
        progress,
        averageScore,
      }
    })
}

export async function listStudyLog(studentId: string, programId: string): Promise<StudyEntry[]> {
  const db = client()
  const links = await db.from('program_lessons').select('lesson_id').eq('program_id', programId)
  if (links.error) throw links.error
  const linkedIds = [...new Set((links.data ?? []).map((link) => link.lesson_id))]
  const lessons =
    linkedIds.length === 0 ? { data: [], error: null } : await db.from('lessons').select('id, title').in('id', linkedIds)
  if (lessons.error) throw lessons.error
  const lessonRows = lessons.data ?? []
  if (lessonRows.length === 0) return []

  const quizzes = await db
    .from('quizzes')
    .select('id, lesson_id, question')
    .in(
      'lesson_id',
      lessonRows.map((lesson) => lesson.id),
    )
  if (quizzes.error) throw quizzes.error
  const quizRows = quizzes.data ?? []
  if (quizRows.length === 0) return []

  const submissions = await db
    .from('quiz_submissions')
    .select('id, quiz_id, essay_answer, score, teacher_feedback, submitted_at')
    .eq('student_id', studentId)
    .in(
      'quiz_id',
      quizRows.map((quiz) => quiz.id),
    )
    .order('submitted_at', { ascending: false })
  if (submissions.error) throw submissions.error

  const lessonTitle = new Map(lessonRows.map((lesson) => [lesson.id, asLocalized(lesson.title)]))
  const quizMeta = new Map(
    quizRows.map((quiz) => [
      quiz.id,
      { lessonTitle: lessonTitle.get(quiz.lesson_id ?? '') ?? { vi: '', my: '', bn: '' }, question: asLocalized(quiz.question) },
    ]),
  )

  return (submissions.data ?? []).map((submission) => {
    const meta = quizMeta.get(submission.quiz_id ?? '')
    return {
      id: submission.id,
      lessonTitle: meta?.lessonTitle ?? { vi: '', my: '', bn: '' },
      question: meta?.question ?? { vi: '', my: '', bn: '' },
      essayAnswer: submission.essay_answer ?? '',
      score: asScore(submission.score),
      feedback: submission.teacher_feedback ?? '',
      submittedAt: submission.submitted_at,
    }
  })
}

export async function listUngradedEssays(): Promise<UngradedEssay[]> {
  const db = client()
  const essays = await db.from('quizzes').select('id, lesson_id, question, is_essay').eq('is_essay', true)
  if (essays.error) throw essays.error
  const essayRows = essays.data ?? []
  if (essayRows.length === 0) return []

  const lessonIds = [...new Set(essayRows.map((quiz) => quiz.lesson_id).filter((id): id is string => Boolean(id)))]
  const lessons =
    lessonIds.length === 0
      ? { data: [], error: null }
      : await db.from('lessons').select('id, title, program_id').in('id', lessonIds)
  if (lessons.error) throw lessons.error

  const submissions = await db
    .from('quiz_submissions')
    .select('id, student_id, quiz_id, essay_answer, score, submitted_at')
    .in(
      'quiz_id',
      essayRows.map((quiz) => quiz.id),
    )
    .order('submitted_at', { ascending: false })
  if (submissions.error) throw submissions.error

  const pending = submissions.data ?? []
  const studentIds = [...new Set(pending.map((row) => row.student_id).filter((id): id is string => Boolean(id)))]
  const profiles =
    studentIds.length === 0
      ? { data: [], error: null }
      : await db.from('profiles').select('id, full_name').in('id', studentIds)
  if (profiles.error) throw profiles.error

  const names = new Map((profiles.data ?? []).map((profile) => [profile.id, profile.full_name ?? '']))
  const enrollments =
    studentIds.length === 0
      ? { data: [], error: null }
      : await db.from('program_enrollments').select('student_id, class_id, program_id').in('student_id', studentIds)
  if (enrollments.error) throw enrollments.error
  const classIds = [...new Set((enrollments.data ?? []).map((row) => row.class_id).filter((id): id is string => Boolean(id)))]
  const classRows = classIds.length === 0 ? { data: [], error: null } : await db.from('course_classes').select('id, name').in('id', classIds)
  if (classRows.error) throw classRows.error
  const className = new Map((classRows.data ?? []).map((row) => [row.id, row.name]))
  const lessonTitle = new Map((lessons.data ?? []).map((lesson) => [lesson.id, asLocalized(lesson.title)]))
  const lessonProgram = new Map((lessons.data ?? []).map((lesson) => [lesson.id, lesson.program_id ?? '']))
  const programIds = [...new Set([...lessonProgram.values()].filter(Boolean))]
  const programs =
    programIds.length === 0
      ? { data: [], error: null }
      : await db.from('programs').select('id, title').in('id', programIds)
  if (programs.error) throw programs.error
  const programTitle = new Map((programs.data ?? []).map((program) => [program.id, asLocalized(program.title)]))
  const questions = new Map(
    essayRows.map((quiz) => {
      const programId = lessonProgram.get(quiz.lesson_id ?? '') ?? ''
      return [
        quiz.id,
        {
          programId,
          programTitle: programTitle.get(programId) ?? { vi: '', my: '', bn: '' },
          question: asLocalized(quiz.question),
          lessonTitle: lessonTitle.get(quiz.lesson_id ?? '') ?? { vi: '', my: '', bn: '' },
        },
      ]
    }),
  )

  return pending.map((submission) => {
    const meta = questions.get(submission.quiz_id ?? '')
    const programId = meta?.programId ?? ''
    const place = (enrollments.data ?? []).find((row) => row.student_id === submission.student_id && (row.program_id === programId || !programId))
    return {
      id: submission.id,
      studentId: submission.student_id ?? '',
      studentName: names.get(submission.student_id ?? '') ?? '',
      classId: place?.class_id ?? '',
      className: className.get(place?.class_id ?? '') ?? '',
      programId,
      programTitle: meta?.programTitle ?? { vi: '', my: '', bn: '' },
      lessonTitle: meta?.lessonTitle ?? { vi: '', my: '', bn: '' },
      question: meta?.question ?? { vi: '', my: '', bn: '' },
      essayAnswer: submission.essay_answer ?? '',
      score: asScore(submission.score),
      submittedAt: submission.submitted_at,
    }
  })
}

export async function saveEssayGrade(submissionId: string, score: number, feedback: string): Promise<void> {
  const { error } = await client()
    .from('quiz_submissions')
    .update({ score, teacher_feedback: feedback.trim() || null })
    .eq('id', submissionId)
  if (error) throw error
}
