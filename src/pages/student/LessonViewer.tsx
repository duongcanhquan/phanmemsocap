import { getEmbedUrlFromYoutubeUrl, isValidYoutubeUrl } from '@tiptap/extension-youtube'
import { BookOpen, CheckCircle2, ChevronLeft, ChevronRight, Circle, ExternalLink, Library, PenLine } from 'lucide-react'
import { useCallback, useEffect, useId, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type MouseEvent, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { QuizEngine } from '../../components/student/QuizEngine'
import { StudyBar } from '../../components/student/StudyBar'
import { PageHeader } from '../../components/ui/PageHeader'
import { Tabs } from '../../components/ui/Tabs'
import { SlideDeck } from '../../components/slides/SlideDeck'
import { materialFlags, parseLessonContent } from '../../lib/lessonContent'
import { splitLessonHtml } from '../../lib/lessonParts'
import { lessonBody, localizedLabel } from '../../lib/localized'
import { isSlideDeck, markdownToHtml } from '../../lib/markdown'
import { fileUrl, httpsUrl } from '../../lib/media'
import { sanitizeLessonHtml } from '../../lib/sanitizeHtml'
import { listLessonPath, rememberStudy, studyPercent, type LessonPathItem } from '../../lib/student'

type LessonViewerProps = {
  programId: string
  lessonId: string
}

type TermDetail = {
  term: string
  explanation: string
  mediaUrl: string
  mediaType: 'text' | 'image' | 'video'
}

export function LessonViewer({ programId, lessonId }: LessonViewerProps) {
  const { t, i18n } = useTranslation()
  const [lessons, setLessons] = useState<LessonPathItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [tab, setTab] = useState('theory')
  const [live, setLive] = useState({ lessonId: '', theory: 0, reference: 0, exercise: 0 })

  useEffect(() => {
    let active = true
    setLoading(true)
    void listLessonPath(programId)
      .then((rows) => {
        if (active) setLessons(rows)
      })
      .catch(() => {
        if (active) setError(t('student.loadError'))
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [programId, t])

  useEffect(() => {
    setTab('theory')
  }, [lessonId])

  const lesson = lessons.find((item) => item.id === lessonId)
  const saved = live.lessonId === lessonId
    ? live
    : { lessonId, theory: lesson?.theoryPct ?? 0, reference: lesson?.referencePct ?? 0, exercise: lesson?.exercisePct ?? 0 }
  const parts = {
    theory: Math.max(lesson?.theoryPct ?? 0, saved.theory),
    reference: Math.max(lesson?.referencePct ?? 0, saved.reference),
    exercise: Math.max(lesson?.exercisePct ?? 0, saved.exercise),
  }

  const bump = useCallback((part: 'theory' | 'reference' | 'exercise', percent: number) => {
    const next = Math.max(0, Math.min(100, Math.round(percent)))
    let changed = false
    setLive((current) => {
      const base = current.lessonId === lessonId ? current : { lessonId, theory: 0, reference: 0, exercise: 0 }
      if (base[part] >= next) return base
      changed = true
      return { ...base, [part]: next }
    })
    if (changed) void rememberStudy(programId, lessonId, part, next).catch(() => undefined)
  }, [programId, lessonId])

  const nextLesson = (() => {
    if (!lesson) return null
    const index = lessons.findIndex((item) => item.id === lesson.id)
    const following = lessons[index + 1]
    return following && !following.locked ? following : null
  })()
  const previousLesson = (() => {
    if (!lesson) return null
    const index = lessons.findIndex((item) => item.id === lesson.id)
    const earlier = lessons[index - 1]
    return earlier && !earlier.locked ? earlier : null
  })()
  const lessonPercent = lesson
    ? studyPercent(lesson.contentUrl, lesson.contentType, lesson.hasQuiz, parts, i18n.language)
    : 0
  const recordExercise = useCallback((percent: number) => bump('exercise', percent), [bump])
  const materials = lesson ? parseLessonContent(lesson.contentUrl, lesson.contentType) : null
  const flags = materials ? materialFlags(materials) : null
  const bodyHtml = materials ? lessonBody(JSON.stringify(materials.body), i18n.language) : ''
  const sections = splitLessonHtml(bodyHtml)
  const showReference = Boolean(sections.reference.trim())
  const showExerciseBody = Boolean(sections.exercise.trim())
  const showExerciseTab = showExerciseBody || Boolean(lesson?.hasQuiz)
  const visibleTabs = [
    { id: 'theory', label: t('student.theory'), icon: <BookOpen aria-hidden="true" className="size-4" /> },
    ...(showReference
      ? [{ id: 'reference', label: t('student.reference'), icon: <Library aria-hidden="true" className="size-4" /> }]
      : []),
    ...(showExerciseTab
      ? [{ id: 'exercise', label: t('student.exercise'), icon: <PenLine aria-hidden="true" className="size-4" /> }]
      : []),
  ]
  const activeTab = visibleTabs.some((item) => item.id === tab) ? tab : 'theory'

  return (
    <div className="ui-page">
      <PageHeader
        title={lesson ? localizedLabel(lesson.title, i18n.language) || t('programs.untitled') : t('student.pathTitle')}
        back={{ to: `/student/${programId}`, label: t('student.backPath') }}
      />
      {error ? (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : null}
      {loading ? <p className="text-muted">{t('student.loading')}</p> : null}
      {!loading && !error && !lesson ? <p className="text-muted">{t('student.noContent')}</p> : null}
      {lesson?.locked ? <p className="text-muted">{t('student.locked')}</p> : null}
      {lesson && !lesson.locked ? (
        <>
          <StudyBar percent={lessonPercent} label={t('student.learned', { percent: lessonPercent })} />
          {flags ? (
            <MaterialsChecklist
              flags={flags}
              hasQuiz={lesson.hasQuiz}
              theoryPct={parts.theory}
              exercisePct={parts.exercise}
              onJump={(section) => setTab(section)}
            />
          ) : null}
          <Tabs label={t('panels.label')} value={activeTab} onChange={setTab} tabs={visibleTabs} />
          <div className="ui-fill">
            {activeTab === 'theory' ? <LessonBody key={lesson.id} lesson={lesson} part="theory" onProgress={bump} /> : null}
            {activeTab === 'reference' ? <LessonBody key={`${lesson.id}-reference`} lesson={lesson} part="reference" onProgress={bump} /> : null}
            {activeTab === 'exercise' ? (
              <div className="grid gap-4">
                {showExerciseBody ? (
                  <LessonBody key={`${lesson.id}-exercise`} lesson={lesson} part="exercise" onProgress={bump} />
                ) : null}
                <section className="ui-card" aria-label={t('student.practice')}>
                  <h2 className="mb-3 text-lg font-semibold text-ink">{t('student.practice')}</h2>
                  <QuizEngine lessonId={lesson.id} programId={programId} nextLessonId={nextLesson?.id ?? null} onRecorded={recordExercise} />
                  {!lesson.hasQuiz && nextLesson ? (
                    <Link to={`/student/${programId}/${nextLesson.id}`} className="ui-btn ui-btn-primary mt-3">
                      {t('student.continue')}
                    </Link>
                  ) : null}
                </section>
              </div>
            ) : null}
          </div>
          <div className="flex items-center justify-between gap-3">
            {previousLesson ? (
              <Link to={`/student/${programId}/${previousLesson.id}`} className="ui-btn ui-btn-ghost min-w-0 max-w-[45%]">
                <ChevronLeft aria-hidden="true" className="size-4 shrink-0" />
                <span className="truncate">{localizedLabel(previousLesson.title, i18n.language) || t('student.previousLesson')}</span>
              </Link>
            ) : <span />}
            {nextLesson ? (
              <Link to={`/student/${programId}/${nextLesson.id}`} className="ui-btn ui-btn-primary min-w-0 max-w-[45%]">
                <span className="truncate">{localizedLabel(nextLesson.title, i18n.language) || t('student.nextLesson')}</span>
                <ChevronRight aria-hidden="true" className="size-4 shrink-0" />
              </Link>
            ) : null}
          </div>
        </>
      ) : null}
    </div>
  )
}

function MaterialsChecklist({
  flags,
  hasQuiz,
  theoryPct,
  exercisePct,
  onJump,
}: {
  flags: ReturnType<typeof materialFlags>
  hasQuiz: boolean
  theoryPct: number
  exercisePct: number
  onJump: (tab: string) => void
}) {
  const { t } = useTranslation()
  const theoryDone = theoryPct >= 40
  const theoryBits = [
    flags.article ? t('student.materialArticle') : null,
    flags.video ? t('student.materialVideo') : null,
    flags.pdf ? t('student.materialPdf') : null,
    flags.slides ? t('student.materialSlides') : null,
  ].filter(Boolean) as string[]
  const items = [
    theoryBits.length > 0
      ? {
          id: 'theory',
          label: theoryBits.length === 1 ? theoryBits[0] : t('student.materialsTheory'),
          detail: theoryBits.length > 1 ? theoryBits.join(' · ') : '',
          icon: BookOpen,
          done: theoryDone,
          tab: 'theory',
        }
      : null,
    hasQuiz
      ? {
          id: 'quiz',
          label: t('student.materialQuiz'),
          detail: '',
          icon: PenLine,
          done: exercisePct >= 100,
          tab: 'exercise',
        }
      : null,
  ].filter(Boolean) as { id: string; label: string; detail: string; icon: typeof BookOpen; done: boolean; tab: string }[]

  if (items.length === 0) return null

  return (
    <section className="ui-card" aria-label={t('student.materials')}>
      <h2 className="text-sm font-semibold text-ink">{t('student.materials')}</h2>
      <p className="mt-1 text-xs text-muted">{t('student.materialsHint')}</p>
      <ul className="mt-3 grid gap-2 sm:grid-cols-2">
        {items.map((item) => {
          const Icon = item.icon
          return (
            <li key={item.id}>
              <button
                type="button"
                className="flex w-full items-center gap-3 rounded-xl border border-line bg-white px-3 py-2.5 text-left text-sm text-ink hover:bg-canvas"
                onClick={() => onJump(item.tab)}
              >
                {item.done ? (
                  <CheckCircle2 aria-hidden="true" className="size-4 shrink-0 text-accent" />
                ) : (
                  <Circle aria-hidden="true" className="size-4 shrink-0 text-muted" />
                )}
                <Icon aria-hidden="true" className="size-4 shrink-0 text-muted" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{item.label}</span>
                  {item.detail ? <span className="block truncate text-xs text-muted">{item.detail}</span> : null}
                </span>
                <span className="text-xs text-muted">{item.done ? t('student.materialsDone') : t('student.materialsTodo')}</span>
              </button>
            </li>
          )
        })}
      </ul>
    </section>
  )
}

function LessonBody({
  lesson,
  part,
  onProgress,
}: {
  lesson: LessonPathItem
  part: 'theory' | 'reference' | 'exercise'
  onProgress: (part: 'theory' | 'reference' | 'exercise', percent: number) => void
}) {
  const { t, i18n } = useTranslation()
  const title = localizedLabel(lesson.title, i18n.language) || t('programs.untitled')
  const materials = parseLessonContent(lesson.contentUrl, lesson.contentType)
  const bodyHtml = lessonBody(packBodyOnly(materials), i18n.language)
  const [term, setTerm] = useState<TermDetail | null>(null)
  const parts = splitLessonHtml(sanitizeLessonHtml(articleFromHtml(bodyHtml)))
  const html = parts[part]
  const youtube = part === 'theory' ? lessonYoutube(materials.videoUrl) : null
  const showPdf = part === 'theory' && Boolean(materials.pdfUrl)
  const showSlideFile = part === 'theory' && Boolean(materials.slideUrl)
  const showSlideDeck = part === 'theory' && Boolean(materials.slideMarkdown) && isSlideDeck(materials.slideMarkdown)
  const showSlideNotes = part === 'theory' && Boolean(materials.slideMarkdown) && !isSlideDeck(materials.slideMarkdown)
  const scroller = useRef<HTMLElement>(null)
  const media = Boolean(youtube) || showPdf || showSlideFile || showSlideDeck || showSlideNotes

  useEffect(() => {
    const node = scroller.current
    if (!node) return
    const empty = !html.trim() && !media
    if (empty) return
    let timer = 0
    const send = () => {
      const room = node.scrollHeight - node.clientHeight
      const ratio = room <= 24 ? (media ? 40 : 100) : (node.scrollTop / room) * 100
      onProgress(part, Math.max(media ? 20 : 8, ratio))
    }
    send()
    const onScroll = () => {
      window.clearTimeout(timer)
      timer = window.setTimeout(send, 800)
    }
    node.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      window.clearTimeout(timer)
      node.removeEventListener('scroll', onScroll)
    }
  }, [html, media, part, onProgress, lesson.id])

  function openTerm(target: HTMLElement) {
    const example = target.closest('[data-example]')
    if (!(example instanceof HTMLElement)) return
    const mediaType = example.getAttribute('data-media-type')
    setTerm({
      term: example.textContent?.trim() || t('editor.exampleTitle'),
      explanation: example.getAttribute('data-explanation') ?? '',
      mediaUrl: httpsUrl(example.getAttribute('data-media-url') ?? ''),
      mediaType: mediaType === 'image' || mediaType === 'video' ? mediaType : 'text',
    })
  }

  function onClick(event: MouseEvent<HTMLElement>) {
    if (!(event.target instanceof HTMLElement)) return
    openTerm(event.target)
  }

  function onKeyDown(event: ReactKeyboardEvent<HTMLElement>) {
    if (event.key !== 'Enter' && event.key !== ' ') return
    if (!(event.target instanceof HTMLElement)) return
    if (!event.target.closest('[data-example]')) return
    event.preventDefault()
    openTerm(event.target)
  }

  const emptySection = !html.trim() && !media && part !== 'theory'
  const emptyTheory = part === 'theory' && !html.trim() && !media

  return (
    <section ref={scroller} className="ui-card h-full overflow-auto p-0" aria-label={t('student.content')}>
      <article className="lesson-article prose prose-slate max-w-none px-5 py-6 sm:px-8" onClick={onClick} onKeyDown={onKeyDown}>
        {part === 'theory' ? <h1>{title}</h1> : <h2>{t(`student.${part}`)}</h2>}
        {youtube ? <YoutubeFrame src={youtube} title={title} /> : null}
        {part === 'theory' && materials.videoUrl && !youtube ? (
          <video className="my-4 aspect-video w-full rounded-xl" src={httpsUrl(materials.videoUrl) || fileUrl(materials.videoUrl)} controls />
        ) : null}
        {html ? <div dangerouslySetInnerHTML={{ __html: html }} /> : null}
        {showPdf ? (
          <MaterialBlock
            title={materials.pdfLabel || title}
            kindLabel={t('student.materialPdf')}
            href={fileUrl(materials.pdfUrl)}
            openLabel={t('student.openPdf')}
          >
            {isPdfUrl(materials.pdfUrl) ? (
              <iframe className="lesson-pdf" src={fileUrl(materials.pdfUrl)} title={materials.pdfLabel || title} />
            ) : null}
          </MaterialBlock>
        ) : null}
        {showSlideFile ? (
          <MaterialBlock
            title={materials.slideLabel || title}
            kindLabel={t('student.materialSlides')}
            href={fileUrl(materials.slideUrl)}
            openLabel={t('student.openSlides')}
          >
            {isPdfUrl(materials.slideUrl) ? (
              <iframe className="lesson-pdf" src={fileUrl(materials.slideUrl)} title={materials.slideLabel || title} />
            ) : (
              <p className="text-sm text-muted">{t('student.slideOpenHint')}</p>
            )}
          </MaterialBlock>
        ) : null}
        {showSlideDeck ? (
          <div className="not-prose my-6 overflow-hidden rounded-2xl border border-line">
            <div className="border-b border-line bg-canvas px-4 py-2 text-sm font-medium text-ink">{t('student.materialSlides')}</div>
            <div className="min-h-[60dvh]">
              <SlideDeck markdown={materials.slideMarkdown} />
            </div>
          </div>
        ) : null}
        {showSlideNotes ? (
          <MaterialBlock title={materials.slideLabel || title} kindLabel={t('student.materialSlides')} href="" openLabel="">
            <div className="prose prose-slate max-w-none" dangerouslySetInnerHTML={{ __html: sanitizeLessonHtml(markdownToHtml(materials.slideMarkdown)) }} />
          </MaterialBlock>
        ) : null}
        {emptySection || emptyTheory ? <p className="text-muted">{t('student.sectionEmpty')}</p> : null}
      </article>
      {term ? <TermDialog detail={term} onClose={() => setTerm(null)} /> : null}
    </section>
  )
}

function MaterialBlock({
  title,
  kindLabel,
  href,
  openLabel,
  children,
}: {
  title: string
  kindLabel: string
  href: string
  openLabel: string
  children?: ReactNode
}) {
  return (
    <section className="not-prose my-6 overflow-hidden rounded-2xl border border-line bg-white">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line bg-canvas px-4 py-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted">{kindLabel}</p>
          <h3 className="text-base font-semibold text-ink">{title}</h3>
        </div>
        {href && openLabel ? (
          <a className="ui-btn ui-btn-primary" href={href} target="_blank" rel="noreferrer">
            {openLabel}
            <ExternalLink aria-hidden="true" className="size-3.5" />
          </a>
        ) : null}
      </div>
      {children ? <div className="p-3">{children}</div> : null}
    </section>
  )
}

function TermDialog({ detail, onClose }: { detail: TermDetail; onClose: () => void }) {
  const { t } = useTranslation()
  const titleId = useId()
  const youtube =
    detail.mediaType === 'video' && isValidYoutubeUrl(detail.mediaUrl)
      ? getEmbedUrlFromYoutubeUrl({ url: detail.mediaUrl, nocookie: true, controls: true })
      : null

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:items-center">
      <button type="button" className="absolute inset-0 bg-ink/50" aria-label={t('editor.close')} onClick={onClose} />
      <div role="dialog" aria-modal="true" aria-labelledby={titleId} className="ui-card relative z-10 max-h-[85dvh] w-full max-w-lg overflow-y-auto">
        <h2 id={titleId} className="text-lg font-semibold text-ink">
          {detail.term}
        </h2>
        {detail.explanation ? <p className="mt-3 text-base leading-relaxed text-ink">{detail.explanation}</p> : null}
        {detail.mediaType === 'image' && detail.mediaUrl ? (
          <img src={detail.mediaUrl} alt="" className="mt-4 aspect-video w-full rounded-xl object-cover" loading="lazy" />
        ) : null}
        {youtube ? <YoutubeFrame src={youtube} title={detail.term} /> : null}
        {detail.mediaType === 'video' && detail.mediaUrl && !youtube ? (
          <video className="mt-4 aspect-video w-full rounded-xl" src={detail.mediaUrl} controls />
        ) : null}
        <button type="button" className="ui-btn ui-btn-primary mt-4" onClick={onClose}>
          {t('editor.close')}
        </button>
      </div>
    </div>
  )
}

function YoutubeFrame({ src, title }: { src: string; title: string }) {
  return (
    <div className="my-4 aspect-video w-full overflow-hidden rounded-xl">
      <iframe
        className="h-full w-full"
        src={src}
        title={title}
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
      />
    </div>
  )
}

function packBodyOnly(materials: ReturnType<typeof parseLessonContent>) {
  return JSON.stringify({ vi: materials.body.vi, my: materials.body.my, bn: materials.body.bn })
}

function articleFromHtml(source: string) {
  const trimmed = source.trim()
  if (!trimmed) return ''
  if (/<[a-z][\s\S]*>/i.test(trimmed)) return trimmed
  return markdownToHtml(trimmed)
}

function lessonYoutube(videoUrl: string) {
  const url = httpsUrl(videoUrl)
  if (!url || !isValidYoutubeUrl(url)) return null
  return getEmbedUrlFromYoutubeUrl({ url, nocookie: true, controls: true })
}

function isPdfUrl(value: string) {
  const url = fileUrl(value)
  return Boolean(url && /\.pdf($|\?)/i.test(url))
}
