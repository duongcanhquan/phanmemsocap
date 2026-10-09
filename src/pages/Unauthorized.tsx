import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { roleHome } from '../lib/roles'

export function Unauthorized() {
  const { t } = useTranslation()
  const { role } = useAuth()
  const destination = role ? roleHome[role] : '/login'

  return (
    <main className="flex min-h-dvh items-center justify-center bg-canvas px-4">
      <section className="ui-card w-full max-w-md">
        <h1 className="ui-title">{t('auth.unauthorizedTitle')}</h1>
        <p className="ui-lead">{t('auth.unauthorizedLead')}</p>
        <Link to={destination} className="ui-btn ui-btn-primary mt-6">
          {role ? t('auth.goHome') : t('auth.loginTitle')}
        </Link>
      </section>
    </main>
  )
}
