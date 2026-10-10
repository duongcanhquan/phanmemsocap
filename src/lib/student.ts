import { splitLessonHtml } from './lessonParts'
import { asLocalized, type LocalizedText } from './localized'
import { supabase, type Json } from './supabase'

export const passingScore = 5

export type EnrolledProgram = {
  id: string
  title: LocalizedText
  category: string
  coverImageUrl: string
  done: number
  total: number
  percent: number
  continueLessonId: string | null
}

export type LessonPathItem = {
  id: string
  title: LocalizedText
  moduleName: LocalizedText
  contentType: string
  contentUrl: string
  orderIndex: number
  locked: boolean
  required: boolean
  hasQuiz: boolean
  passed: boolean
  waiting: boolean
  score: number | null
  theoryPct: number
  referencePct: number
  exercisePct: number
  percent: number
}

export type StudyHistoryItem = {
  id: string
  lessonId: string
  question: LocalizedText
  score: number | null
  feedback: string
  submittedAt: string | null
}

export type StudentQuestion = {
  id: string
  question: LocalizedText
  options: LocalizedText[]
  isEssay: boolean
  points: number
  passMark: number
  shuffleQuestions: boolean
  shuffleOptions: boolean
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

export function studyPercent(
  contentUrl: string,
  contentType: string,
  hasQuiz: boolean,
  parts: { theory: number; reference: number; exercise: number },
) {
  const html = contentType === 'pdf' || contentType === 'video' ? '' : contentUrl
  const split = splitLessonHtml(html)
  const weights: [number, number][] = [[parts.theory, contentType === 'pdf' || contentType === 'video' || split.theory.trim() ? 50 : 0]]
  if (split.reference.trim()) weights.push([parts.reference, 20])
  if (split.exercise.trim() || hasQuiz) weights.push([parts.exercise, hasQuiz ? 40 : 25])
  const total = weights.reduce((sum, [, weight]) => sum + weight, 0)
  if (total === 0) return 0
  return Math.min(100, Math.round(weights.reduce((sum, [value, weight]) => sum + value * weight, 0) / total))
}

export async function rememberStudy(programId: string, lessonId: string, part: 'theory' | 'reference' | 'exercise', percent: number) {
  const db = client()
  const { data: userData } = await db.auth.getUser()
  const studentId = userData.user?.id
  if (!studentId) return
  const next = Math.max(0, Math.min(100, Math.round(percent)))
  const row = {
    student_id: studentId,
    lesson_id: lessonId,
    program_id: programId,
    ...(part === 'theory' ? { theory_pct: next } : {}),
    ...(part === 'reference' ? { reference_pct: next } : {}),
    ...(part === 'exercise' ? { exercise_pct: next } : {}),
  }
  const { error } = await db.from('lesson_progress').upsert(row, { onConflict: 'student_id,lesson_id,program_id' })
  if (error) throw error
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

function asNumber(value: Json | undefined): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim() !== '' && Number.isFinite(Number(value))) return Number(value)
  return null
}

export async function listEnrolledPrograms(): Promise<EnrolledProgram[]> {
  const db = client()
  const enrollments = await db.from('program_enrollments').select('program_id').eq('status', 'active')
  if (enrollments.error) throw enrollments.error
  const ids = [...new Set((enrollments.data ?? []).map((row) => row.program_id).filter((id): id is string => Boolean(id)))]
  if (ids.length === 0) return []

  const programs = await db.from('programs').select('id, title, category, cover_image_url').in('id', ids)
  if (programs.error) throw programs.error
  const rows = await Promise.all(
    (programs.data ?? []).map(async (program) => {
      const path = await listLessonPath(program.id)
      const continueLesson = path.find((lesson) => !lesson.locked && lesson.percent < 100) ?? path.find((lesson) => !lesson.locked && !lesson.passed)
      const percent = path.length === 0 ? 0 : Math.round(path.reduce((sum, lesson) => sum + lesson.percent, 0) / path.length)
      return {
        id: program.id,
        title: asLocalized(program.title),
        category: program.category ?? '',
        coverImageUrl: program.cover_image_url ?? '',
        done: path.filter((lesson) => lesson.percent >= 100).length,
        total: path.length,
        percent,
        continueLessonId: continueLesson?.id ?? null,
      }
    }),
  )
  return rows
}

export async function listLessonPath(programId: string): Promise<LessonPathItem[]> {
  const db = client()
  const links = await db.from('program_lessons').select('lesson_id, order_index').eq('program_id', programId).order('order_index')
  if (links.error) throw links.error
  const order = new Map((links.data ?? []).map((link) => [link.lesson_id, link.order_index]))
  const ids = [...order.keys()]
  const lessons =
    ids.length === 0
      ? { data: [], error: null }
      : await db.from('lessons').select('id, title, module_name, content_type, content_url').in('id', ids)
  if (lessons.error) throw lessons.error

  const { data: userData } = await db.auth.getUser()
  const studentId = userData.user?.id
  const stored = studentId
    ? await db.from('lesson_progress').select('lesson_id, theory_pct, reference_pct, exercise_pct').eq('program_id', programId).eq('student_id', studentId)
    : { data: [], error: null }
  if (stored.error) throw stored.error
  const studied = new Map(
    (stored.data ?? []).map((row) => [
      row.lesson_id,
      { theory: row.theory_pct, reference: row.reference_pct, exercise: row.exercise_pct },
    ]),
  )

  const [state, record] = await Promise.all([
    db.rpc('program_lesson_state', { program_id: programId }),
    db.rpc('my_study_record', { program_id: programId }),
  ])
  if (state.error) throw state.error
  if (record.error) throw record.error
  const flags = new Map(
    asArray(state.data).map((item) => {
      const row = asObject(item)
      return [
        typeof row.id === 'string' ? row.id : '',
        { locked: row.locked === true, hasQuiz: row.has_quiz === true, required: row.required !== false },
      ]
    }),
  )
  const progress = new Map(
    asArray(asObject(record.data).lessons).map((item) => {
      const row = asObject(item)
      return [
        typeof row.id === 'string' ? row.id : '',
        {
          passed: row.passed === true,
          waiting: row.waiting === true,
          score: asNumber(row.score),
        },
      ]
    }),
  )

  return (lessons.data ?? [])
    .slice()
    .sort((left, right) => (order.get(left.id) ?? 0) - (order.get(right.id) ?? 0))
    .flatMap((lesson) => {
    const flag = flags.get(lesson.id)
    if (!flag) return []
    const mark = progress.get(lesson.id)
    const contentUrl = lesson.content_url ?? ''
    const saved = studied.get(lesson.id) ?? { theory: 0, reference: 0, exercise: 0 }
    const parts = saved.exercise >= 100 || mark?.passed ? { ...saved, exercise: 100 } : saved
    return [{
      id: lesson.id,
      title: asLocalized(lesson.title),
      moduleName: asLocalized(lesson.module_name),
      contentType: lesson.content_type ?? 'text',
      contentUrl,
      orderIndex: order.get(lesson.id) ?? 0,
      locked: flag.locked,
      required: flag.required,
      hasQuiz: flag.hasQuiz,
      passed: mark?.passed ?? false,
      waiting: mark?.waiting ?? false,
      score: mark?.score ?? null,
      theoryPct: parts.theory,
      referencePct: parts.reference,
      exercisePct: parts.exercise,
      percent: studyPercent(contentUrl, lesson.content_type ?? 'text', flag.hasQuiz, parts),
    }]
  })
}

export type ResultRow = StudyHistoryItem & {
  programTitle: LocalizedText
  lessonTitle: LocalizedText
}

export async function listMyResults(programs: { id: string; title: LocalizedText }[]): Promise<ResultRow[]> {
  const groups = await Promise.all(
    programs.map(async (program) => {
      const items = await listStudyHistory(program.id)
      return items.map((item) => ({ ...item, programTitle: program.title, lessonTitle: emptyTitle() }))
    }),
  )
  const rows = groups.flat()
  const lessonIds = [...new Set(rows.map((row) => row.lessonId).filter(Boolean))]
  const lessons =
    lessonIds.length === 0
      ? { data: [], error: null }
      : await client().from('lessons').select('id, title').in('id', lessonIds)
  if (lessons.error) throw lessons.error
  const titles = new Map((lessons.data ?? []).map((lesson) => [lesson.id, asLocalized(lesson.title)]))
  return rows
    .map((row) => ({ ...row, lessonTitle: titles.get(row.lessonId) ?? emptyTitle() }))
    .sort((left, right) => (right.submittedAt ?? '').localeCompare(left.submittedAt ?? ''))
}

function emptyTitle(): LocalizedText {
  return { vi: '', my: '', bn: '' }
}

export async function listStudyHistory(programId: string): Promise<StudyHistoryItem[]> {
  const { data, error } = await client().rpc('my_study_record', { program_id: programId })
  if (error) throw error
  return asArray(asObject(data).history).map((item) => {
    const row = asObject(item)
    return {
      id: typeof row.id === 'string' ? row.id : '',
      lessonId: typeof row.lesson_id === 'string' ? row.lesson_id : '',
      question: asLocalized(row.question ?? null),
      score: asNumber(row.score),
      feedback: typeof row.feedback === 'string' ? row.feedback : '',
      submittedAt: typeof row.submitted_at === 'string' ? row.submitted_at : null,
    }
  })
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
      points: typeof row.points === 'number' ? row.points : 1,
      passMark: typeof row.pass_mark === 'number' ? row.pass_mark : Number(row.pass_mark ?? 5) || 5,
      shuffleQuestions: row.shuffle_questions === true,
      shuffleOptions: row.shuffle_options === true,
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
