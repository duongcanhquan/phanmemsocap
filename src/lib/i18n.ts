import i18n from 'i18next'
import LanguageDetector from 'i18next-browser-languagedetector'
import { initReactI18next } from 'react-i18next'
import bn from '../locales/bn.json'
import my from '../locales/my.json'
import vi from '../locales/vi.json'

export const supportedLanguages = ['vi', 'my', 'bn'] as const

export type AppLanguage = (typeof supportedLanguages)[number]

const storageKey = 'phanmemsocap.lang'

void i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      vi: { common: vi },
      my: { common: my },
      bn: { common: bn },
    },
    fallbackLng: 'vi',
    supportedLngs: [...supportedLanguages],
    load: 'languageOnly',
    defaultNS: 'common',
    interpolation: { escapeValue: false },
    detection: {
      order: ['localStorage', 'navigator'],
      lookupLocalStorage: storageKey,
      caches: ['localStorage'],
    },
  })
  .then(() => {
    syncDocumentLanguage(i18n.resolvedLanguage ?? i18n.language)
  })

function syncDocumentLanguage(language: string) {
  const base = language.split('-')[0]
  document.documentElement.lang = isAppLanguage(base) ? base : 'vi'
}

i18n.on('languageChanged', syncDocumentLanguage)

export function isAppLanguage(value: string): value is AppLanguage {
  return value === 'vi' || value === 'my' || value === 'bn'
}

export default i18n
