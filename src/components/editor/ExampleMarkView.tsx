import { getEmbedUrlFromYoutubeUrl, isValidYoutubeUrl } from '@tiptap/extension-youtube'
import { MarkViewContent, type MarkViewProps } from '@tiptap/react'
import { useEffect, useId, useState } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import type { ExampleMediaType } from './example-mark'

function readMediaType(value: unknown): ExampleMediaType {
  if (value === 'image' || value === 'video') return value
  return 'text'
}

function httpsUrl(value: string) {
  try {
    return new URL(value).protocol === 'https:' ? value : ''
  } catch {
    return ''
  }
}

export function ExampleMarkView({ mark, editor }: MarkViewProps) {
  const { t } = useTranslation()
  const titleId = useId()
  const [open, setOpen] = useState(false)
  const explanation = String(mark.attrs.explanation ?? '')
  const mediaUrl = httpsUrl(String(mark.attrs.mediaUrl ?? ''))
  const mediaType = readMediaType(mark.attrs.mediaType)
  const youtubeEmbed =
    mediaType === 'video' && isValidYoutubeUrl(mediaUrl)
      ? getEmbedUrlFromYoutubeUrl({ url: mediaUrl, nocookie: true, controls: true })
      : null

  useEffect(() => {
    if (!open) return
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [open])

  return (
    <>
      <MarkViewContent
        className="cursor-pointer font-medium text-accent underline decoration-accent/40 decoration-2 underline-offset-4"
        role={editor.isEditable ? undefined : 'button'}
        tabIndex={editor.isEditable ? undefined : 0}
        onClick={(event) => {
          if (editor.isEditable) return
          event.preventDefault()
          setOpen(true)
        }}
        onKeyDown={(event) => {
          if (editor.isEditable) return
          if (event.key !== 'Enter' && event.key !== ' ') return
          event.preventDefault()
          setOpen(true)
        }}
      />
      {open
        ? createPortal(
            <div className="fixed inset-0 z-50 flex items-end justify-center p-4 sm:items-center">
              <button
                type="button"
                className="absolute inset-0 bg-ink/50"
                aria-label={t('editor.close')}
                onClick={() => setOpen(false)}
              />
              <div
                role="dialog"
                aria-modal="true"
                aria-labelledby={titleId}
                className="ui-card relative z-10 w-full max-w-lg"
              >
                <h2 id={titleId} className="text-lg font-semibold text-ink">
                  {t('editor.exampleTitle')}
                </h2>
                {explanation ? (
                  <p className="mt-3 text-base leading-relaxed text-ink">{explanation}</p>
                ) : null}
                {mediaType === 'image' && mediaUrl ? (
                  <img src={mediaUrl} alt="" className="mt-4 w-full rounded-xl" />
                ) : null}
                {youtubeEmbed ? (
                  <iframe
                    className="mt-4 aspect-video w-full rounded-xl"
                    src={youtubeEmbed}
                    title={t('editor.exampleTitle')}
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                  />
                ) : null}
                {mediaType === 'video' && mediaUrl && !youtubeEmbed ? (
                  <video className="mt-4 w-full rounded-xl" src={mediaUrl} controls />
                ) : null}
                <button
                  type="button"
                  className="ui-btn ui-btn-primary mt-4"
                  onClick={() => setOpen(false)}
                >
                  {t('editor.close')}
                </button>
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  )
}
