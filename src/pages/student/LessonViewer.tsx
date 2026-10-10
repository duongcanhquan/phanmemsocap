import { getEmbedUrlFromYoutubeUrl, isValidYoutubeUrl } from '@tiptap/extension-youtube'
import { BookOpen, ChevronLeft, ChevronRight, Library, PenLine } from 'lucide-react'
import { useCallback, useEffect, useId, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type MouseEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { QuizEngine } from '../../components/student/QuizEngine'
import { StudyBar } from '../../components/student/StudyBar'
import { PageHeader } from '../../components/ui/PageHeader'
import { Tabs } from '../../components/ui/Tabs'
import { SlideDeck } from '../../components/slides/SlideDeck'
import { splitLessonHtml } from '../../lib/lessonParts'
import { lessonBody, localizedLabel } from '../../lib/localized'
import { isSlideDeck, markdownToHtml } from '../../lib/markdown'
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
  const [error, setError] = useState('')
  const [tab, setTab] = useState('theory')
  const [live, setLive] = useState({ lessonId: '', theory: 0, reference: 0, exercise: 0 })

  useEffect(() => {
    let active = true
    void listLessonPath(programId)
      .then((rows) => {
        if (active) setLessons(rows)
      })
      .catch(() => {
        if (active) setError(t('student.loadError'))
      })
    return () => {
      active = false
    }
  }, [programId, t])

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
  const lessonPercent = lesson ? studyPercent(lesson.contentUrl, lesson.contentType, lesson.hasQuiz, parts) : 0
  const recordExercise = useCallback((percent: number) => bump('exercise', percent), [bump])

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
      {lesson?.locked ? <p className="text-muted">{t('student.locked')}</p> : null}
      {lesson && !lesson.locked ? (
        <>
          <StudyBar percent={lessonPercent} label={t('student.learned', { percent: lessonPercent })} />
          <Tabs
            label={t('panels.label')}
            value={tab}
            onChange={setTab}
            tabs={[
              { id: 'theory', label: t('student.theory'), icon: <BookOpen aria-hidden="true" className="size-4" /> },
              { id: 'reference', label: t('student.reference'), icon: <Library aria-hidden="true" className="size-4" /> },
              { id: 'exercise', label: t('student.exercise'), icon: <PenLine aria-hidden="true" className="size-4" /> },
            ]}
          />
          <div className="ui-fill">
            {tab === 'theory' ? <LessonBody key={lesson.id} lesson={lesson} part="theory" onProgress={bump} /> : null}
            {tab === 'reference' ? <LessonBody key={`${lesson.id}-reference`} lesson={lesson} part="reference" onProgress={bump} /> : null}
            {tab === 'exercise' ? (
              <div className="grid gap-4">
                <LessonBody key={`${lesson.id}-exercise`} lesson={lesson} part="exercise" onProgress={bump} />
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
              <Link to={`/student/${programId}/${previousLesson.id}`} className="ui-inline ui-btn-ghost">
                <ChevronLeft aria-hidden="true" className="size-4" />
                {localizedLabel(previousLesson.title, i18n.language) || t('student.previousLesson')}
              </Link>
            ) : <span />}
            {nextLesson ? (
              <Link to={`/student/${programId}/${nextLesson.id}`} className="ui-inline ui-btn-primary">
                {localizedLabel(nextLesson.title, i18n.language) || t('student.nextLesson')}
                <ChevronRight aria-hidden="true" className="size-4" />
              </Link>
            ) : null}
          </div>
        </>
      ) : null}
    </div>
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
  const viewed = {
    ...lesson,
    contentUrl: lesson.contentType === 'pdf' || lesson.contentType === 'video' ? lesson.contentUrl : lessonBody(lesson.contentUrl, i18n.language),
  }
  const slides = hasSlideMarkup(viewed)
  const [mode, setMode] = useState<'article' | 'slides'>(lesson.contentType === 'slides' ? 'slides' : 'article')
  const [term, setTerm] = useState<TermDetail | null>(null)
  const parts = splitLessonHtml(articleHtml(viewed))
  const html = parts[part]
  const youtube = part === 'theory' ? lessonYoutube(viewed) : null
  const showSlides = part === 'theory' && slides
  const scroller = useRef<HTMLElement>(null)
  const media = Boolean(youtube) || (part === 'theory' && (lesson.contentType === 'pdf' || lesson.contentType === 'video'))

  useEffect(() => {
    const node = scroller.current
    if (!node) return
    const empty = !html.trim() && !youtube && !(showSlides && mode === 'slides') && !media
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
  }, [html, youtube, showSlides, mode, media, part, onProgress, lesson.id])

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

  return (
    <section ref={scroller} className="ui-card h-full overflow-auto p-0" aria-label={t('student.content')}>
      {showSlides ? (
        <div className="sticky top-0 z-10 flex gap-2 border-b border-line bg-white/80 p-2 backdrop-blur-xl">
          <button
            type="button"
            className={mode === 'article' ? 'ui-btn ui-btn-primary flex-1' : 'ui-btn ui-btn-ghost flex-1 border border-line'}
            aria-pressed={mode === 'article'}
            onClick={() => setMode('article')}
          >
            {t('student.articleMode')}
          </button>
          <button
            type="button"
            className={mode === 'slides' ? 'ui-btn ui-btn-primary flex-1' : 'ui-btn ui-btn-ghost flex-1 border border-line'}
            aria-pressed={mode === 'slides'}
            onClick={() => setMode('slides')}
          >
            {t('student.slideMode')}
          </button>
        </div>
      ) : null}
      {mode === 'slides' && showSlides ? (
        <div className="h-full min-h-[70dvh]">
          <SlideDeck markdown={viewed.contentUrl} />
        </div>
      ) : (
        <article
          className="lesson-article prose prose-slate max-w-none px-5 py-6 sm:px-8"
          onClick={onClick}
          onKeyDown={onKeyDown}
        >
          {part === 'theory' ? <h1>{title}</h1> : <h2>{t(`student.${part}`)}</h2>}
          {youtube ? <YoutubeFrame src={youtube} title={title} /> : null}
          {html ? <div dangerouslySetInnerHTML={{ __html: html }} /> : null}
          {!html && !youtube ? <p className="text-muted">{t('student.sectionEmpty')}</p> : null}
        </article>
      )}
      {term ? <TermDialog detail={term} onClose={() => setTerm(null)} /> : null}
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

function lessonYoutube(lesson: LessonPathItem) {
  if (lesson.contentType !== 'video') return null
  const url = httpsUrl(lesson.contentUrl)
  if (!url || !isValidYoutubeUrl(url)) return null
  return getEmbedUrlFromYoutubeUrl({ url, nocookie: true, controls: true })
}

function articleHtml(lesson: LessonPathItem) {
  if (lesson.contentType === 'pdf') {
    const url = httpsUrl(lesson.contentUrl)
    return url ? `<iframe class="lesson-pdf" src="${escapeAttr(url)}" title=""></iframe>` : ''
  }
  if (lesson.contentType === 'video' && !lessonYoutube(lesson)) {
    const url = httpsUrl(lesson.contentUrl)
    return url ? `<video src="${escapeAttr(url)}" controls></video>` : ''
  }
  const source = lesson.contentUrl.trim()
  if (!source || lesson.contentType === 'video') return ''
  if (/<[a-z][\s\S]*>/i.test(source)) return sanitizeLessonHtml(source)
  return markdownToHtml(source)
}

function hasSlideMarkup(lesson: LessonPathItem) {
  return lesson.contentType === 'slides' || isSlideDeck(lesson.contentUrl) || lesson.contentUrl.includes('class="reveal"') || lesson.contentUrl.includes("class='reveal'")
}

function sanitizeLessonHtml(html: string) {
  const doc = new DOMParser().parseFromString(html, 'text/html')
  doc.querySelectorAll('script, style, object, embed').forEach((node) => node.remove())
  doc.querySelectorAll('*').forEach((node) => {
    for (const attr of [...node.attributes]) {
      if (attr.name.startsWith('on')) node.removeAttribute(attr.name)
    }
  })
  doc.querySelectorAll('iframe').forEach((frame) => {
    const src = frame.getAttribute('src') ?? ''
    const embed = isValidYoutubeUrl(src) ? getEmbedUrlFromYoutubeUrl({ url: src, nocookie: true, controls: true }) : null
    if (!embed) {
      frame.remove()
      return
    }
    frame.setAttribute('src', embed)
    frame.setAttribute('loading', 'lazy')
    frame.setAttribute('allowfullscreen', '')
  })
  doc.querySelectorAll('[data-example]').forEach((node) => {
    node.setAttribute('role', 'button')
    node.setAttribute('tabindex', '0')
  })
  return doc.body.innerHTML
}

function escapeAttr(value: string) {
  return value.replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;')
}

function httpsUrl(value: string) {
  try {
    return new URL(value).protocol === 'https:' ? value : ''
  } catch {
    return ''
  }
}
