import { useTranslation } from 'react-i18next'
import { isAppLanguage, rememberLanguage, supportedLanguages, type AppLanguage } from '../lib/i18n'
import { supabase } from '../lib/supabase'

export function LanguageMenu() {
  const { t, i18n } = useTranslation()
  const currentLanguage = isAppLanguage(i18n.language.split('-')[0]) ? (i18n.language.split('-')[0] as AppLanguage) : 'vi'

  function chooseLanguage(language: AppLanguage) {
    rememberLanguage(language)
    void i18n.changeLanguage(language)
    const client = supabase
    if (!client) return
    void client.auth.getSession().then(({ data }) => {
      if (data.session) void client.rpc('set_my_language', { next_language: language })
    })
  }

  return (
    <div role="group" aria-label={t('header.language')} className="flex shrink-0 overflow-hidden rounded-xl border border-white/70">
      {supportedLanguages.map((language) => {
        const selected = language === currentLanguage
        return (
          <button
            key={language}
            type="button"
            aria-pressed={selected}
            className={selected ? 'ui-btn ui-btn-primary rounded-none px-3' : 'ui-btn ui-btn-ghost rounded-none px-3'}
            onClick={() => chooseLanguage(language)}
          >
            {t(`languages.${language}`)}
          </button>
        )
      })}
    </div>
  )
}
