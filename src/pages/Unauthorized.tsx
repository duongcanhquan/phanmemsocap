import { useTranslation } from 'react-i18next'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { roleHome } from '../lib/roles'

export function Unauthorized() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { role, logout } = useAuth()

  return (
    <main className="flex min-h-dvh items-center justify-center px-4">
      <section className="ui-card w-full max-w-md">
        <h1 className="ui-title">{t('auth.unauthorizedTitle')}</h1>
        <p className="ui-lead">{t('auth.unauthorizedLead')}</p>
        {role ? (
          <Link to={roleHome[role]} className="ui-btn ui-btn-primary mt-6">
            {t('auth.goHome')}
          </Link>
        ) : (
          <button
            type="button"
            className="ui-btn ui-btn-primary mt-6"
            onClick={() => {
              void logout().finally(() => navigate('/login', { replace: true }))
            }}
          >
            {t('auth.loginTitle')}
          </button>
        )}
      </section>
    </main>
  )
}
