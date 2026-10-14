import { emptyLocalized, unpackLessonBody, type LocalizedText } from './localized'
import { isSlideDeck } from './markdown'
import { isFileUrl } from './media'

type LessonKind = 'text' | 'pdf' | 'slides' | 'video' | 'quiz'

export type LessonMaterials = {
  body: LocalizedText
  pdfUrl: string
  pdfLabel: string
  slideUrl: string
  slideLabel: string
  slideMarkdown: string
  videoUrl: string
}

type PackedMaterials = {
  vi?: string
  my?: string
  bn?: string
  pdfUrl?: string
  pdfLabel?: string
  slideUrl?: string
  slideLabel?: string
  slideMarkdown?: string
  videoUrl?: string
}

function blank(): LessonMaterials {
  return {
    body: emptyLocalized(),
    pdfUrl: '',
    pdfLabel: '',
    slideUrl: '',
    slideLabel: '',
    slideMarkdown: '',
    videoUrl: '',
  }
}

function asString(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

export function hasVisibleText(html: string) {
  return html.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').trim().length > 0
}

export function parseLessonContent(raw: string, contentType: string = 'text'): LessonMaterials {
  const materials = blank()
  const trimmed = raw.trim()
  if (!trimmed) return materials

  if (trimmed.startsWith('{')) {
    try {
      const parsed = JSON.parse(trimmed) as PackedMaterials
      materials.body = {
        vi: asString(parsed.vi),
        my: asString(parsed.my),
        bn: asString(parsed.bn),
      }
      materials.pdfUrl = asString(parsed.pdfUrl)
      materials.pdfLabel = asString(parsed.pdfLabel)
      materials.slideUrl = asString(parsed.slideUrl)
      materials.slideLabel = asString(parsed.slideLabel)
      materials.slideMarkdown = asString(parsed.slideMarkdown)
      materials.videoUrl = asString(parsed.videoUrl)
      if (materials.pdfUrl || materials.slideUrl || materials.slideMarkdown || materials.videoUrl || hasVisibleText(materials.body.vi)) {
        return materials
      }
    } catch {
      /* fall through */
    }
  }

  if (contentType === 'pdf' && isFileUrl(trimmed)) {
    materials.pdfUrl = trimmed
    return materials
  }
  if (contentType === 'video' && isFileUrl(trimmed)) {
    materials.videoUrl = trimmed
    return materials
  }
  if (contentType === 'slides') {
    if (isFileUrl(trimmed)) materials.slideUrl = trimmed
    else materials.slideMarkdown = trimmed
    return materials
  }
  if (isFileUrl(trimmed) && /\.pdf($|\?)/i.test(trimmed)) {
    materials.pdfUrl = trimmed
    return materials
  }

  materials.body = unpackLessonBody(raw)
  return materials
}

export function packLessonContent(materials: LessonMaterials): string {
  const payload: PackedMaterials = {
    vi: materials.body.vi,
    my: materials.body.my,
    bn: materials.body.bn,
  }
  if (materials.pdfUrl) payload.pdfUrl = materials.pdfUrl
  if (materials.pdfLabel) payload.pdfLabel = materials.pdfLabel
  if (materials.slideUrl) payload.slideUrl = materials.slideUrl
  if (materials.slideLabel) payload.slideLabel = materials.slideLabel
  if (materials.slideMarkdown) payload.slideMarkdown = materials.slideMarkdown
  if (materials.videoUrl) payload.videoUrl = materials.videoUrl
  return JSON.stringify(payload)
}

export function primaryContentType(materials: LessonMaterials, fallback: LessonKind = 'text'): LessonKind {
  if (hasVisibleText(materials.body.vi) || hasVisibleText(materials.body.my) || hasVisibleText(materials.body.bn)) return 'text'
  if (materials.videoUrl) return 'video'
  if (materials.pdfUrl) return 'pdf'
  if (materials.slideUrl || materials.slideMarkdown) return 'slides'
  return fallback === 'quiz' ? 'quiz' : 'text'
}

/** Keep the teacher's chosen tab when that material exists; otherwise fall back. */
export function resolveContentType(preferred: LessonKind, materials: LessonMaterials): LessonKind {
  const flags = materialFlags(materials)
  if (preferred === 'pdf' && flags.pdf) return 'pdf'
  if (preferred === 'slides' && flags.slides) return 'slides'
  if (preferred === 'video' && flags.video) return 'video'
  if (preferred === 'text' && flags.article) return 'text'
  return primaryContentType(materials, preferred)
}

export function materialFlags(materials: LessonMaterials) {
  return {
    article: hasVisibleText(materials.body.vi) || hasVisibleText(materials.body.my) || hasVisibleText(materials.body.bn),
    pdf: Boolean(materials.pdfUrl),
    slides: Boolean(materials.slideUrl || materials.slideMarkdown),
    slideDeck: Boolean(materials.slideMarkdown && isSlideDeck(materials.slideMarkdown)),
    video: Boolean(materials.videoUrl),
  }
}

export function lessonMatchesType(materials: LessonMaterials, type: string, hasQuiz = false) {
  if (type === 'all') return true
  const flags = materialFlags(materials)
  if (type === 'text') return flags.article
  if (type === 'pdf') return flags.pdf
  if (type === 'slides') return flags.slides
  if (type === 'video') return flags.video
  if (type === 'quiz') return hasQuiz
  return false
}

export function materialLabels(
  materials: LessonMaterials,
  label: (key: 'article' | 'pdf' | 'slides' | 'video' | 'quiz') => string,
  hasQuiz = false,
) {
  const flags = materialFlags(materials)
  const chips: string[] = []
  if (flags.article) chips.push(label('article'))
  if (flags.video) chips.push(label('video'))
  if (flags.pdf) chips.push(label('pdf'))
  if (flags.slides) chips.push(label('slides'))
  if (hasQuiz) chips.push(label('quiz'))
  return chips
}

export function lessonFileStem(title: string, kind: 'pdf' | 'slides') {
  const base = title
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\w\s-]+/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .slice(0, 48)
  return `${base || 'bai-giang'}-${kind}`
}
