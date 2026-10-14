import { useTranslation } from 'react-i18next'
import { lessonFileStem } from '../../lib/lessonContent'
import { MediaField } from '../MediaField'

interface PdfFieldsProps {
  idPrefix: string
  lessonName: string
  pdfUrl: string
  pdfLabel: string
  onUrl: (url: string) => void
  onLabel: (label: string) => void
  onError: (message: string) => void
}

export function PdfFields({ idPrefix, lessonName, pdfUrl, pdfLabel, onUrl, onLabel, onError }: PdfFieldsProps) {
  const { t } = useTranslation()
  return (
    <div className="grid gap-3">
      <MediaField
        id={`${idPrefix}-pdf`}
        label={t('programs.pdfFile')}
        value={pdfUrl}
        onChange={(url) => {
          onUrl(url)
          if (url && !pdfLabel.trim()) onLabel(lessonName)
        }}
        onError={onError}
        accept="application/pdf,.pdf"
        folder="pdfs"
        hint={t('programs.pdfHint')}
        displayName={pdfLabel.trim() || lessonName}
        uploadName={lessonFileStem(lessonName, 'pdf')}
      />
      {pdfUrl ? (
        <label className="grid gap-1 text-sm font-medium text-ink" htmlFor={`${idPrefix}-pdf-label`}>
          {t('programs.fileDisplayName')}
          <input
            id={`${idPrefix}-pdf-label`}
            className="ui-field"
            value={pdfLabel}
            onChange={(event) => onLabel(event.target.value)}
            placeholder={lessonName}
          />
        </label>
      ) : null}
    </div>
  )
}

interface SlideFieldsProps {
  idPrefix: string
  lessonName: string
  slideUrl: string
  slideLabel: string
  slideMarkdown: string
  onUrl: (url: string) => void
  onLabel: (label: string) => void
  onMarkdown: (value: string) => void
  onError: (message: string) => void
}

export function SlideFields({
  idPrefix,
  lessonName,
  slideUrl,
  slideLabel,
  slideMarkdown,
  onUrl,
  onLabel,
  onMarkdown,
  onError,
}: SlideFieldsProps) {
  const { t } = useTranslation()
  return (
    <div className="grid gap-3">
      <MediaField
        id={`${idPrefix}-slides`}
        label={t('programs.slideFile')}
        value={slideUrl}
        onChange={(url) => {
          onUrl(url)
          if (url && !slideLabel.trim()) onLabel(lessonName)
        }}
        onError={onError}
        accept=".pdf,.ppt,.pptx,application/pdf,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation"
        folder="slides"
        hint={t('programs.slideHint')}
        placeholder={t('programs.slideLink')}
        displayName={slideLabel.trim() || lessonName}
        uploadName={lessonFileStem(lessonName, 'slides')}
      />
      {slideUrl ? (
        <label className="grid gap-1 text-sm font-medium text-ink" htmlFor={`${idPrefix}-slide-label`}>
          {t('programs.fileDisplayName')}
          <input
            id={`${idPrefix}-slide-label`}
            className="ui-field"
            value={slideLabel}
            onChange={(event) => onLabel(event.target.value)}
            placeholder={lessonName}
          />
        </label>
      ) : null}
      <label className="grid gap-1 text-sm font-medium text-ink" htmlFor={`${idPrefix}-slide-body`}>
        {t('programs.slideBody')}
        <textarea
          id={`${idPrefix}-slide-body`}
          className="ui-field min-h-28 py-2"
          value={slideMarkdown}
          onChange={(event) => onMarkdown(event.target.value)}
        />
      </label>
    </div>
  )
}

interface VideoFieldsProps {
  idPrefix: string
  videoUrl: string
  onUrl: (url: string) => void
}

export function VideoFields({ idPrefix, videoUrl, onUrl }: VideoFieldsProps) {
  const { t } = useTranslation()
  return (
    <label className="grid gap-1 text-sm font-medium text-ink" htmlFor={`${idPrefix}-video`}>
      {t('programs.videoLink')}
      <input
        id={`${idPrefix}-video`}
        className="ui-field"
        value={videoUrl}
        onChange={(event) => onUrl(event.target.value)}
        placeholder={t('editor.youtubePrompt')}
      />
      <span className="text-xs font-normal text-muted">{t('programs.videoHint')}</span>
    </label>
  )
}
