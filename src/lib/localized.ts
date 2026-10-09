import type { Json } from './supabase'

export type LocalizedText = {
  vi: string
  my: string
  bn: string
}

const languageKeys = ['vi', 'my', 'bn'] as const

export function keepCopy(next: string | undefined, previous: string) {
  const value = (next ?? '').trim()
  return value || previous
}

export function emptyLocalized(): LocalizedText {
  return { vi: '', my: '', bn: '' }
}

export function asLocalized(value: Json | null | undefined): LocalizedText {
  const record = value && typeof value === 'object' && !Array.isArray(value) ? value : {}
  return {
    vi: typeof record.vi === 'string' ? record.vi : '',
    my: typeof record.my === 'string' ? record.my : '',
    bn: typeof record.bn === 'string' ? record.bn : '',
  }
}

export function localizedLabel(value: Json | null | undefined, language: string): string {
  const text = asLocalized(value)
  const base = language.split('-')[0]
  if (base === 'my' && text.my) return text.my
  if (base === 'bn' && text.bn) return text.bn
  if (text.vi) return text.vi
  return text.my || text.bn
}

export function toLocalizedJson(value: LocalizedText): Json {
  return { vi: value.vi.trim(), my: value.my.trim(), bn: value.bn.trim() }
}

export function hasLocalizedText(value: LocalizedText): boolean {
  return languageKeys.some((key) => value[key].trim().length > 0)
}

export function packLessonBody(value: LocalizedText): string {
  return JSON.stringify({ vi: value.vi, my: value.my, bn: value.bn })
}

export function unpackLessonBody(raw: string): LocalizedText {
  const trimmed = raw.trim()
  if (trimmed.startsWith('{')) {
    try {
      const parsed = JSON.parse(trimmed) as Partial<LocalizedText>
      if (typeof parsed.vi === 'string' && (typeof parsed.my === 'string' || typeof parsed.bn === 'string')) {
        return {
          vi: parsed.vi,
          my: typeof parsed.my === 'string' ? parsed.my : '',
          bn: typeof parsed.bn === 'string' ? parsed.bn : '',
        }
      }
    } catch {
      return { vi: raw, my: '', bn: '' }
    }
  }
  return { vi: raw, my: '', bn: '' }
}

export function lessonBody(raw: string, language: string): string {
  const text = unpackLessonBody(raw)
  return localizedLabel(text, language) || text.vi
}
