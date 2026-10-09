import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import bn from '../locales/bn.json'
import my from '../locales/my.json'
import vi from '../locales/vi.json'

export const supportedLanguages = ['vi', 'my', 'bn'] as const

export type AppLanguage = (typeof supportedLanguages)[number]

const storageKey = 'phanmemsocap.lang'

export function isAppLanguage(value: string): value is AppLanguage {
  return value === 'vi' || value === 'my' || value === 'bn'
}

export function rememberedLanguage(): AppLanguage | null {
  try {
    const value = localStorage.getItem(storageKey)?.split('-')[0] ?? ''
    return isAppLanguage(value) ? value : null
  } catch {
    return null
  }
}

export function rememberLanguage(language: AppLanguage) {
  localStorage.setItem(storageKey, language)
}

void i18n.use(initReactI18next).init({
  resources: {
    vi: { common: vi },
    my: { common: my },
    bn: { common: bn },
  },
  lng: rememberedLanguage() ?? 'vi',
  fallbackLng: 'vi',
  supportedLngs: [...supportedLanguages],
  load: 'languageOnly',
  defaultNS: 'common',
  interpolation: { escapeValue: false },
})
  .then(() => {
    syncDocumentLanguage(i18n.resolvedLanguage ?? i18n.language)
  })

function syncDocumentLanguage(language: string) {
  const base = language.split('-')[0]
  document.documentElement.lang = isAppLanguage(base) ? base : 'vi'
}

i18n.on('languageChanged', syncDocumentLanguage)

export default i18n
