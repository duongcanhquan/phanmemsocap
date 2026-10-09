import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { OwnAccount } from '../account/OwnAccount'
import { LanguageMenu } from '../LanguageMenu'
import { Dialog } from '../ui/Dialog'
import { useAuth } from '../../hooks/useAuth'
import { loadMyAvatar } from '../../lib/profile'
import { isSupabaseConfigured } from '../../lib/supabase'

export function Header() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { user, logout } = useAuth()
  const [logoutMessage, setLogoutMessage] = useState('')
  const [avatarUrl, setAvatarUrl] = useState('')
  const [accountOpen, setAccountOpen] = useState(false)

  const displayName = user?.email ?? t('header.guest')
  const initial = displayName.trim().charAt(0).toUpperCase() || '•'

  useEffect(() => {
    if (!user) return
    let active = true
    void loadMyAvatar(user.id).then((url) => {
      if (active) setAvatarUrl(url)
    })
    return () => {
      active = false
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
      <div className="flex items-center gap-2 px-4 py-3 sm:px-6">
        <img src="/logo-vietmy-blue.png" alt={t('brand.school')} className="h-10 w-auto lg:hidden" />
        <p className="sr-only">{t('brand.school')}</p>
        <span className="min-w-0 flex-1" />
        <div className="flex shrink-0 items-center gap-2">
          <LanguageMenu />
          <button
            type="button"
            className="inline-flex size-11 items-center justify-center overflow-hidden rounded-full bg-accent text-sm font-semibold text-white"
            aria-label={`${t('header.account')}: ${displayName}`}
            title={displayName}
            onClick={() => setAccountOpen(true)}
          >
            {user && avatarUrl ? <img src={avatarUrl} alt="" className="size-full object-cover" /> : initial}
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
      {accountOpen && user ? (
        <Dialog title={t('header.selfTitle')} onClose={() => setAccountOpen(false)}>
          <OwnAccount userId={user.id} email={user.email ?? ''} avatarUrl={avatarUrl} onAvatar={setAvatarUrl} />
        </Dialog>
      ) : null}
      {logoutMessage ? (
        <p role="status" className="px-4 pb-3 text-sm text-danger sm:px-6">
          {logoutMessage}
        </p>
      ) : null}
    </header>
  )
}
