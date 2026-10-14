import { useTranslation } from 'react-i18next'
import { materialLabels, parseLessonContent } from '../lib/lessonContent'

type MaterialChipsProps = {
  contentUrl: string
  contentType: string
  hasQuiz?: boolean
  limit?: number
  emptyLabel?: string
}

export function MaterialChips({ contentUrl, contentType, hasQuiz = false, limit = 4, emptyLabel }: MaterialChipsProps) {
  const { t } = useTranslation()
  const chips = materialLabels(
    parseLessonContent(contentUrl, contentType),
    (key) =>
      key === 'article'
        ? t('student.materialArticle')
        : key === 'pdf'
          ? t('student.materialPdf')
          : key === 'slides'
            ? t('student.materialSlides')
            : key === 'video'
              ? t('student.materialVideo')
              : t('student.materialQuiz'),
    hasQuiz,
  )
  const shown = chips.slice(0, limit)
  const more = chips.length - shown.length

  if (shown.length === 0) {
    return (
      <span className="rounded-full bg-canvas px-2 py-0.5 text-xs font-medium text-ink">
        {emptyLabel || t(`programs.types.${contentType}`, { defaultValue: contentType })}
      </span>
    )
  }

  return (
    <span className="inline-flex flex-wrap gap-1">
      {shown.map((chip) => (
        <span key={chip} className="rounded-full bg-canvas px-2 py-0.5 text-xs font-medium text-ink">
          {chip}
        </span>
      ))}
      {more > 0 ? (
        <span className="rounded-full bg-canvas px-2 py-0.5 text-xs font-medium text-muted">+{more}</span>
      ) : null}
    </span>
  )
}
