import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate } from 'react-router-dom'
import { PasswordDialog } from '../account/PasswordDialog'
import { LanguageMenu } from '../LanguageMenu'
import { usePageTitle } from '../../context/PageTitleContext'
import { useAuth } from '../../hooks/useAuth'
import { loadMyProfile } from '../../lib/profile'
import { isSupabaseConfigured } from '../../lib/supabase'

export function Header() {
  const { t } = useTranslation()
  const { title, back } = usePageTitle()
  const navigate = useNavigate()
  const { user, role, logout } = useAuth()
  const [logoutMessage, setLogoutMessage] = useState('')
  const [avatarUrl, setAvatarUrl] = useState('')
  const [photoUrl, setPhotoUrl] = useState('')
  const [fullName, setFullName] = useState('')
  const [passwordOpen, setPasswordOpen] = useState(false)

  const metadataName = typeof user?.user_metadata?.full_name === 'string' ? user.user_metadata.full_name.trim() : ''
  const displayName = fullName || metadataName || user?.email || t('header.guest')
  const initial = displayName.trim().charAt(0).toUpperCase() || '•'

  useEffect(() => {
    if (!user) return
    const userId = user.id
    let active = true
    function refresh() {
      void loadMyProfile(userId).then((profile) => {
        if (!active) return
        setAvatarUrl(profile.avatarUrl)
        setPhotoUrl(profile.photoUrl)
        setFullName(profile.fullName)
      })
    }
    refresh()
    window.addEventListener('profile-updated', refresh)
    return () => {
      active = false
      window.removeEventListener('profile-updated', refresh)
    }
  }, [user])

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
    <header className="ui-chrome sticky top-0 z-10 border-b pt-[env(safe-area-inset-top)]">
      <div className="flex flex-wrap items-center gap-2 px-3 py-2 sm:px-6 sm:py-3">
        {back ? (
          back.to ? (
            <Link to={back.to} className="shrink-0 text-sm font-semibold tracking-tight text-ink uppercase">
              {back.label}
            </Link>
          ) : (
            <button type="button" className="shrink-0 text-sm font-semibold tracking-tight text-ink uppercase" onClick={back.onClick}>
              {back.label}
            </button>
          )
        ) : null}
        {title ? (
          <h1 className="min-w-0 max-w-[12rem] truncate text-left text-base font-semibold tracking-tight text-ink uppercase sm:max-w-none sm:text-xl">
            {title}
          </h1>
        ) : null}
        <img src="/logo-vietmy-blue.png" alt="" className="h-10 w-auto shrink-0 lg:hidden" />
        <p className="sr-only">{t('brand.school')}</p>
        <span className="min-w-0 flex-1" />
        <div className="ml-auto flex max-w-full flex-wrap items-center justify-end gap-2">
          {role === 'student' ? <LanguageMenu /> : null}
          <button type="button" className="ui-btn ui-btn-ghost shrink-0 px-2 whitespace-nowrap uppercase" onClick={() => setPasswordOpen(true)}>
            {t('accounts.savePassword')}
          </button>
          <button
            type="button"
            className="inline-flex h-11 max-w-64 items-center gap-2 rounded-full bg-white/70 py-1 pr-3 pl-1 text-left text-ink"
            aria-label={`${t('accounts.name')}: ${displayName}`}
            onClick={() => navigate('/account')}
          >
            <span className="inline-flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-accent text-sm font-semibold text-white">
              {user && (avatarUrl || photoUrl) ? <img src={avatarUrl || photoUrl} alt="" className="size-full object-cover" /> : initial}
            </span>
            <span className="min-w-0 max-w-28 sm:max-w-40">
              <span className="hidden text-[10px] font-medium tracking-wide text-muted uppercase sm:block">{t('accounts.name')}</span>
              <span className="block truncate text-sm font-semibold">{fullName || metadataName || t('header.noName')}</span>
            </span>
          </button>
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
      {passwordOpen && user ? (
        <PasswordDialog email={user.email ?? ''} fullName={fullName || metadataName} onClose={() => setPasswordOpen(false)} />
      ) : null}
      {logoutMessage ? (
        <p role="status" className="px-4 pb-3 text-sm text-danger sm:px-6">
          {logoutMessage}
        </p>
      ) : null}
    </header>
  )
}
