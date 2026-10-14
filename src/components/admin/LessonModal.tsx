import { useEffect, useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { translateLesson } from '../../lib/ai'
import { emptyLocalized, hasLocalizedText, keepCopy, localizedLabel, type LocalizedText } from '../../lib/localized'
import {
  hasVisibleText,
  packLessonContent,
  parseLessonContent,
  resolveContentType,
} from '../../lib/lessonContent'
import {
  deleteLesson,
  lessonCourseIds,
  lessonTypes,
  listPrograms,
  getLessonQuizSettings,
  listQuizzes,
  saveLesson,
  saveQuizzes,
  syncLessonCourses,
  type LessonQuizSettings,
  type LessonRecord,
  type LessonType,
  type ProgramRecord,
  type QuizRecord,
} from '../../lib/programs'

const composeTypes = lessonTypes.filter((type) => type !== 'quiz')
import { PdfFields, SlideFields, VideoFields } from '../lesson/MaterialFields'
import { Dialog } from '../ui/Dialog'
import { LocalizedFields } from './LocalizedFields'
import { QuizSetup } from './QuizSetup'
import { Link } from 'react-router-dom'

type LessonModalProps = {
  programId: string
  lesson: LessonRecord | null
  nextOrder: number
  onClose: () => void
  onSaved: () => void
}

export function LessonModal({ programId, lesson, nextOrder, onClose, onSaved }: LessonModalProps) {
  const { t, i18n } = useTranslation()
  const source = parseLessonContent(lesson?.contentUrl ?? '', lesson?.contentType ?? 'text')
  const [programs, setPrograms] = useState<ProgramRecord[]>([])
  const [courseIds, setCourseIds] = useState<string[]>(programId ? [programId] : [])
  const [orderIndex, setOrderIndex] = useState(lesson?.orderIndex ?? nextOrder)
  const [title, setTitle] = useState<LocalizedText>(lesson?.title ?? emptyLocalized())
  const [moduleName, setModuleName] = useState<LocalizedText>(lesson?.moduleName ?? emptyLocalized())
  const [focusType, setFocusType] = useState<LessonType>(
    lesson?.contentType && lesson.contentType !== 'quiz' ? lesson.contentType : 'text',
  )
  const [contentUrl, setContentUrl] = useState(source.body.vi)
  const [pdfUrl, setPdfUrl] = useState(source.pdfUrl)
  const [pdfLabel, setPdfLabel] = useState(source.pdfLabel)
  const [slideUrl, setSlideUrl] = useState(source.slideUrl)
  const [slideLabel, setSlideLabel] = useState(source.slideLabel)
  const [slideMarkdown, setSlideMarkdown] = useState(source.slideMarkdown)
  const [videoUrl, setVideoUrl] = useState(source.videoUrl)
  const [isPublished, setIsPublished] = useState(lesson?.isPublished ?? false)
  const [quizzes, setQuizzes] = useState<QuizRecord[]>([])
  const [quizSettings, setQuizSettings] = useState<LessonQuizSettings>({ passMark: 5, shuffleQuestions: false, shuffleOptions: false })
  const [quizzesLoaded, setQuizzesLoaded] = useState(!lesson)
  const [error, setError] = useState('')
  const [pending, setPending] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [note, setNote] = useState('')

  useEffect(() => {
    let active = true
    void listPrograms()
      .then((rows) => {
        if (active) setPrograms(rows)
      })
      .catch(() => {
        if (active) setError(t('programs.loadError'))
      })
    if (lesson) {
      void getLessonQuizSettings(lesson.id)
        .then((settings) => {
          if (active) setQuizSettings(settings)
        })
        .catch(() => undefined)
      void lessonCourseIds(lesson.id)
        .then((ids) => {
          if (active && ids.length > 0) setCourseIds(ids)
        })
        .catch(() => undefined)
    }
    return () => {
      active = false
    }
  }, [lesson, t])

  useEffect(() => {
    if (!lesson) return
    let active = true
    void listQuizzes(lesson.id)
      .then((rows) => {
        if (active) setQuizzes(rows)
      })
      .catch(() => {
        if (active) setError(t('programs.loadError'))
      })
      .finally(() => {
        if (active) setQuizzesLoaded(true)
      })
    return () => {
      active = false
    }
  }, [lesson, t])

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    if (!hasLocalizedText(title) || courseIds.length === 0) {
      setError(t('programs.titleRequired'))
      return
    }
    if (lesson && !quizzesLoaded) return
    setPending(true)
    setError('')
    try {
      const result = await translateLesson({
        title: title.vi,
        module: moduleName.vi,
        body: contentUrl,
        quizzes: quizzes.map((quiz) => ({
          question: quiz.question.vi,
          options: quiz.isEssay ? [] : quiz.options.map((option) => option.vi),
        })),
      }).catch(() => null)
      const titleText = result ? { vi: title.vi, my: keepCopy(result.my.title, title.my), bn: keepCopy(result.bn.title, title.bn) } : title
      const moduleText = result ? { vi: moduleName.vi, my: keepCopy(result.my.module, moduleName.my), bn: keepCopy(result.bn.module, moduleName.bn) } : moduleName
      const bodyText = result
        ? { vi: contentUrl, my: keepCopy(result.my.body, source.body.my), bn: keepCopy(result.bn.body, source.body.bn) }
        : { ...source.body, vi: contentUrl }
      const ready = result
        ? quizzes.map((quiz, index) => ({
            ...quiz,
            question: {
              vi: quiz.question.vi,
              my: keepCopy(result.my.quizzes[index]?.question, quiz.question.my),
              bn: keepCopy(result.bn.quizzes[index]?.question, quiz.question.bn),
            },
            options: quiz.options.map((option, optionIndex) => ({
              vi: option.vi,
              my: keepCopy(result.my.quizzes[index]?.options[optionIndex], option.my),
              bn: keepCopy(result.bn.quizzes[index]?.options[optionIndex], option.bn),
            })),
          }))
        : quizzes
      const lessonName = localizedLabel(titleText, 'vi') || t('programs.untitled')
      const materials = {
        body: bodyText,
        pdfUrl: pdfUrl.trim(),
        pdfLabel: (pdfLabel.trim() || lessonName).trim(),
        slideUrl: slideUrl.trim(),
        slideLabel: (slideLabel.trim() || lessonName).trim(),
        slideMarkdown: slideMarkdown.trim(),
        videoUrl: videoUrl.trim(),
      }
      const lessonId = await saveLesson(courseIds[0], {
        id: lesson?.id,
        title: titleText,
        moduleName: moduleText,
        contentType: resolveContentType(lesson?.contentType === 'quiz' ? 'quiz' : focusType, materials),
        contentUrl: packLessonContent(materials),
        isPublished,
        orderIndex,
        quiz: {
          passMark: Math.min(10, Math.max(0, quizSettings.passMark)),
          shuffleQuestions: quizSettings.shuffleQuestions,
          shuffleOptions: quizSettings.shuffleOptions,
        },
      })
      await syncLessonCourses(lessonId, courseIds, programId, orderIndex)
      await saveQuizzes(lessonId, ready)
      if (!result) setNote(t('editor.translateMissing'))
      onSaved()
    } catch {
      setError(t('programs.saveError'))
      setPending(false)
    }
  }

  async function onDelete() {
    if (!lesson) return
    if (!confirmDelete) {
      setConfirmDelete(true)
      return
    }
    setPending(true)
    try {
      await deleteLesson(lesson.id)
      onSaved()
    } catch {
      setError(t('programs.saveError'))
      setPending(false)
    }
  }

  const lessonName = localizedLabel(title, i18n.language) || t('programs.untitled')
  const extraCount = [
    focusType !== 'text' && hasVisibleText(contentUrl) ? 1 : 0,
    focusType !== 'pdf' && pdfUrl.trim() ? 1 : 0,
    focusType !== 'slides' && (slideUrl.trim() || slideMarkdown.trim()) ? 1 : 0,
    focusType !== 'video' && videoUrl.trim() ? 1 : 0,
  ].reduce((sum, value) => sum + value, 0)
  const richBody = /<[a-z][\s\S]*>/i.test(contentUrl)

  const pdfBlock = (idPrefix: string) => (
    <PdfFields
      idPrefix={idPrefix}
      lessonName={lessonName}
      pdfUrl={pdfUrl}
      pdfLabel={pdfLabel}
      onUrl={setPdfUrl}
      onLabel={setPdfLabel}
      onError={setError}
    />
  )
  const slideBlock = (idPrefix: string) => (
    <SlideFields
      idPrefix={idPrefix}
      lessonName={lessonName}
      slideUrl={slideUrl}
      slideLabel={slideLabel}
      slideMarkdown={slideMarkdown}
      onUrl={setSlideUrl}
      onLabel={setSlideLabel}
      onMarkdown={setSlideMarkdown}
      onError={setError}
    />
  )
  const videoBlock = (idPrefix: string) => (
    <VideoFields idPrefix={idPrefix} videoUrl={videoUrl} onUrl={setVideoUrl} />
  )

  return (
    <Dialog title={lesson ? t('programs.editLesson') : t('programs.addLesson')} onClose={onClose}>
      <form className="grid gap-6" onSubmit={(event) => void onSubmit(event)}>
        <div className="grid gap-4">
          <LocalizedFields id="lesson-title" label={t('programs.name')} value={title} onChange={setTitle} />
          <div className="grid gap-2">
            <div className="flex flex-wrap gap-2">
              {composeTypes.map((type) => (
                <button
                  key={type}
                  type="button"
                  className={focusType === type ? 'ui-btn ui-btn-primary' : 'ui-btn ui-btn-ghost'}
                  aria-pressed={focusType === type}
                  onClick={() => setFocusType(type)}
                >
                  {t(`programs.types.${type}`)}
                </button>
              ))}
            </div>
            <p className="text-xs text-muted">{t('programs.focusHint')}</p>
          </div>
          {focusType === 'text' ? (
            richBody ? (
              <div className="rounded-2xl border border-line bg-canvas/80 p-3 text-sm text-ink">
                <p>{t('programs.editInComposer')}</p>
                <Link className="ui-btn ui-btn-primary mt-2 w-fit" to="/lessons" onClick={onClose}>
                  {t('editor.title')}
                </Link>
              </div>
            ) : (
              <label className="grid gap-1 text-sm font-medium text-ink" htmlFor="lesson-body">
                {t('panels.write')}
                <textarea
                  id="lesson-body"
                  className="ui-field min-h-48 py-2"
                  value={contentUrl}
                  onChange={(event) => setContentUrl(event.target.value)}
                />
              </label>
            )
          ) : null}
          {focusType === 'pdf' ? pdfBlock('lesson-main') : null}
          {focusType === 'slides' ? slideBlock('lesson-main') : null}
          {focusType === 'video' ? videoBlock('lesson-main') : null}
          <details className="rounded-2xl border border-line bg-white/60 p-3" open={extraCount > 0}>
            <summary className="cursor-pointer text-sm font-medium text-ink">
              {t('programs.attachments')} · {t('programs.attachmentsCount', { count: extraCount })}
            </summary>
            <div className="mt-3 grid gap-3">
              <p className="text-xs text-muted">{t('programs.attachmentsHint')}</p>
              {focusType !== 'text' && !richBody ? (
                <label className="grid gap-1 text-sm font-medium text-ink" htmlFor="lesson-extra-body">
                  {t('panels.write')}
                  <textarea id="lesson-extra-body" className="ui-field min-h-28 py-2" value={contentUrl} onChange={(event) => setContentUrl(event.target.value)} />
                </label>
              ) : null}
              {focusType !== 'pdf' ? pdfBlock('lesson-extra') : null}
              {focusType !== 'slides' ? slideBlock('lesson-extra') : null}
              {focusType !== 'video' ? videoBlock('lesson-extra') : null}
            </div>
          </details>
          <details className="rounded-2xl border border-line bg-white/60 p-3">
            <summary className="cursor-pointer text-sm font-medium text-ink">
              {t('editor.moreOptions')} · {t('editor.coursesPicked', { count: courseIds.length })}
            </summary>
            <div className="mt-3 grid gap-3">
              <LocalizedFields id="lesson-module" label={t('programs.module')} value={moduleName} onChange={setModuleName} />
              <p className="text-xs text-muted">{t('programs.moduleHint')}</p>
              <fieldset className="grid max-h-36 gap-1 overflow-y-auto rounded-xl border border-line p-2 text-sm font-medium text-ink">
                <legend className="px-1">{t('editor.assignCourse')}</legend>
                {programs.map((program) => (
                  <label key={program.id} className="flex min-h-9 items-center gap-2 font-normal">
                    <input
                      type="checkbox"
                      checked={courseIds.includes(program.id)}
                      onChange={() => {
                        setCourseIds((current) => {
                          if (current.includes(program.id)) {
                            const next = current.filter((id) => id !== program.id)
                            return next.length === 0 ? current : next
                          }
                          return [...current, program.id]
                        })
                      }}
                    />
                    {localizedLabel(program.title, i18n.language) || t('programs.untitled')}
                  </label>
                ))}
              </fieldset>
              <label className="grid max-w-40 gap-1 text-sm font-medium text-ink" htmlFor="lesson-order">
                {t('editor.sortOrder')}
                <input
                  id="lesson-order"
                  className="ui-field"
                  type="number"
                  min={0}
                  value={orderIndex}
                  onChange={(event) => setOrderIndex(Number(event.target.value))}
                />
              </label>
              <label className="flex min-h-11 items-center gap-2 text-sm font-medium text-ink">
                <input
                  type="checkbox"
                  checked={isPublished}
                  onChange={(event) => setIsPublished(event.target.checked)}
                />
                {t('programs.published')}
              </label>
            </div>
          </details>
        </div>
        <details className="rounded-2xl border border-line bg-white/60 p-3" open={quizzes.length > 0}>
          <summary className="cursor-pointer text-sm font-medium text-ink">
            {t('student.materialQuiz')} · {quizzes.length}
          </summary>
          <div className="mt-3">
            <QuizSetup quizzes={quizzes} settings={quizSettings} onQuizzes={setQuizzes} onSettings={setQuizSettings} />
          </div>
        </details>
        {note ? <p className="text-sm text-muted">{note}</p> : null}
        {error ? (
          <p role="alert" className="text-sm text-danger">
            {error}
          </p>
        ) : null}
        <div className="ui-dialog-foot">
          {lesson ? (
            <button type="button" className="ui-btn ui-btn-danger" disabled={pending} onClick={() => void onDelete()}>
              {confirmDelete ? t('programs.confirmRemove') : t('programs.remove')}
            </button>
          ) : null}
          <button type="button" className="ui-btn ui-btn-ghost" onClick={onClose}>
            {t('programs.cancel')}
          </button>
          <button type="submit" className="ui-btn ui-btn-primary" disabled={pending || (Boolean(lesson) && !quizzesLoaded)}>
            {pending ? t('programs.saving') : t('programs.save')}
          </button>
        </div>
      </form>
    </Dialog>
  )
}
