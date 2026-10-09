import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { isAppLanguage, type AppLanguage } from '../../lib/i18n'
import { isSupabaseConfigured } from '../../lib/supabase'

const languages: AppLanguage[] = ['vi', 'my', 'bn']

export function Header() {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  const { user, logout } = useAuth()
  const [logoutMessage, setLogoutMessage] = useState('')

  const displayName = user?.email ?? t('header.guest')
  const initial = displayName.trim().charAt(0).toUpperCase() || '•'
  const currentLanguage = isAppLanguage(i18n.language) ? i18n.language : 'vi'

  async function handleLogout() {
    setLogoutMessage('')
    if (!isSupabaseConfigured) {
      setLogoutMessage(t('supabase.logoutUnavailable'))
      return
    }
    try {
      await logout()
      navigate('/login', { replace: true })
    } catch (error) {
      setLogoutMessage(error instanceof Error ? error.message : t('supabase.logoutUnavailable'))
    }
  }

  return (
    <header className="sticky top-0 z-10 border-b border-line bg-surface/95 pt-[env(safe-area-inset-top)] backdrop-blur">
      <div className="flex items-center gap-2 px-4 py-3 sm:px-6">
        <p className="min-w-0 flex-1 truncate text-base font-semibold text-ink lg:sr-only">
          {t('appName')}
        </p>
        <div className="flex shrink-0 items-center gap-2">
          <label className="sr-only" htmlFor="language">
            {t('header.language')}
          </label>
          <select
            id="language"
            value={currentLanguage}
            onChange={(event) => {
              const next = event.target.value
              if (isAppLanguage(next)) void i18n.changeLanguage(next)
            }}
            className="ui-field max-w-36 cursor-pointer px-2 text-sm"
          >
            {languages.map((language) => (
              <option key={language} value={language}>
                {t(`languages.${language}`)}
              </option>
            ))}
          </select>
          <span
            className="inline-flex size-11 items-center justify-center rounded-full bg-ink text-sm font-semibold text-white"
            aria-label={`${t('header.account')}: ${displayName}`}
            title={displayName}
          >
            {initial}
          </span>
          <button
            type="button"
            onClick={() => void handleLogout()}
            disabled={!isSupabaseConfigured}
            className="ui-btn ui-btn-ghost shrink-0 px-2 whitespace-nowrap"
          >
            {t('header.logout')}
          </button>
        </div>
      </div>
      {logoutMessage ? (
        <p role="status" className="px-4 pb-3 text-sm text-danger sm:px-6">
          {logoutMessage}
        </p>
      ) : null}
    </header>
  )
}
