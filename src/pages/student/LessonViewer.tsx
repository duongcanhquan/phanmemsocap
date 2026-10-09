import { getEmbedUrlFromYoutubeUrl, isValidYoutubeUrl } from '@tiptap/extension-youtube'
import { ArrowLeft } from 'lucide-react'
import { useEffect, useId, useState, type KeyboardEvent as ReactKeyboardEvent, type MouseEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { QuizEngine } from '../../components/student/QuizEngine'
import { SlideDeck } from '../../components/slides/SlideDeck'
import { localizedLabel } from '../../lib/localized'
import { isSlideDeck, markdownToHtml } from '../../lib/markdown'
import { listLessonPath, type LessonPathItem } from '../../lib/student'

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
  const { t } = useTranslation()
  const [lessons, setLessons] = useState<LessonPathItem[]>([])
  const [error, setError] = useState('')

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
  const nextLesson = (() => {
    if (!lesson) return null
    const index = lessons.findIndex((item) => item.id === lesson.id)
    const following = lessons[index + 1]
    return following && !following.locked ? following.id : null
  })()

  return (
    <div className="grid gap-3">
      <Link to={`/student/${programId}`} className="ui-btn ui-btn-ghost w-fit px-2">
        <ArrowLeft aria-hidden="true" className="size-4" />
        {t('student.backPath')}
      </Link>
      {error ? (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : null}
      {lesson?.locked ? <p className="text-muted">{t('student.locked')}</p> : null}
      {lesson && !lesson.locked ? (
        <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_22rem]">
          <LessonBody lesson={lesson} />
          <section className="ui-card lg:sticky lg:top-4" aria-label={t('student.practice')}>
            <h2 className="text-lg font-semibold text-ink">{t('student.practice')}</h2>
            <div className="mt-3">
              <QuizEngine lessonId={lesson.id} programId={programId} nextLessonId={nextLesson} />
              {!lesson.hasQuiz && nextLesson ? (
                <Link to={`/student/${programId}/${nextLesson}`} className="ui-btn ui-btn-primary mt-3 w-full">
                  {t('student.continue')}
                </Link>
              ) : null}
            </div>
          </section>
        </div>
      ) : null}
    </div>
  )
}

function LessonBody({ lesson }: { lesson: LessonPathItem }) {
  const { t, i18n } = useTranslation()
  const title = localizedLabel(lesson.title, i18n.language) || t('programs.untitled')
  const slides = hasSlideMarkup(lesson.contentUrl)
  const [mode, setMode] = useState<'article' | 'slides'>('article')
  const [term, setTerm] = useState<TermDetail | null>(null)
  const html = articleHtml(lesson)
  const youtube = lessonYoutube(lesson)

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
    <section className="ui-card overflow-hidden p-0" aria-label={t('student.content')}>
      {slides ? (
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
      {mode === 'slides' && slides ? (
        <div className="h-[70dvh] lg:h-[36rem]">
          <SlideDeck markdown={lesson.contentUrl} />
        </div>
      ) : (
        <article
          className="lesson-article prose prose-slate mx-auto max-w-3xl px-4 py-6 sm:px-8 sm:py-8"
          onClick={onClick}
          onKeyDown={onKeyDown}
        >
          <h1>{title}</h1>
          {youtube ? <YoutubeFrame src={youtube} title={title} /> : null}
          {html ? <div dangerouslySetInnerHTML={{ __html: html }} /> : null}
          {!html && !youtube ? <p className="text-muted">{t('student.noContent')}</p> : null}
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

function hasSlideMarkup(value: string) {
  return isSlideDeck(value) || value.includes('class="reveal"') || value.includes("class='reveal'")
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
