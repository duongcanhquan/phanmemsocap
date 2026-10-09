import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { Navigate, useNavigate } from 'react-router-dom'
import { LanguageMenu } from '../components/LanguageMenu'
import { useAuth } from '../hooks/useAuth'
import { roleHome } from '../lib/roles'
import { rememberedEmail, rememberEmail, rememberLoginEnabled } from '../lib/supabase'

interface LoginForm {
  email: string
  password: string
}

export function Login() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { user, role, isLoading, login } = useAuth()
  const [formError, setFormError] = useState('')
  const [remember, setRemember] = useState(rememberLoginEnabled)
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginForm>({ defaultValues: { email: rememberedEmail(), password: '' } })

  if (!isLoading && user && role) {
    return <Navigate to={roleHome[role]} replace />
  }

  async function onSubmit(values: LoginForm) {
    setFormError('')
    rememberEmail(values.email.trim(), remember)
    try {
      const nextRole = await login(values.email.trim(), values.password)
      if (!nextRole) {
        setFormError(t('auth.missingProfile'))
        return
      }
      navigate(roleHome[nextRole], { replace: true })
    } catch (error) {
      const message = error instanceof Error ? error.message : ''
      if (message === 'missing-supabase') {
        setFormError(t('supabase.missing'))
        return
      }
      setFormError(t('auth.invalidCredentials'))
    }
  }

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-2">
      <aside className="login-stage" aria-label={t('auth.stageTitle')}>
        <div className="factory" aria-hidden="true">
          <div className="factory-floor" />
          <div className="factory-beam" />
          <svg className="factory-svg" viewBox="0 0 640 900" preserveAspectRatio="xMidYMid slice">
            <defs>
              <linearGradient id="bay" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#16384a" />
                <stop offset="100%" stopColor="#0c1e2b" />
              </linearGradient>
              <linearGradient id="copper" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#67e8f9" />
                <stop offset="100%" stopColor="#0369a1" />
              </linearGradient>
              <clipPath id="belt-window">
                <rect x="48" y="500" width="544" height="130" rx="16" />
              </clipPath>
            </defs>
            <g className="factory-rail">
              <rect x="48" y="78" width="544" height="10" rx="5" fill="#1b3344" />
              <rect x="48" y="118" width="544" height="4" rx="2" fill="#0ea5e9" opacity="0.35" />
            </g>
            <g>
              <rect x="56" y="150" width="250" height="250" rx="18" fill="url(#bay)" stroke="#38bdf8" strokeOpacity="0.35" />
              <rect x="78" y="172" width="206" height="10" rx="5" fill="#0b2230" />
              <path d="M90 250 H150 M150 250 V300 H210 M110 280 H190" fill="none" stroke="#22d3ee" strokeOpacity="0.45" strokeWidth="2" />
              <circle cx="150" cy="250" r="4" fill="#67e8f9" />
              <circle cx="210" cy="300" r="4" fill="#fbbf24" />
              <g className="factory-head">
                <rect x="86" y="164" width="46" height="18" rx="6" fill="#e0f2fe" />
                <rect x="102" y="182" width="14" height="36" rx="4" fill="#7dd3fc" />
                <circle cx="109" cy="224" r="5" className="factory-led" fill="#22d3ee" />
              </g>
              <g className="factory-arm">
                <path d="M250 210 H310" stroke="#7dd3fc" strokeWidth="6" strokeLinecap="round" />
                <circle cx="318" cy="210" r="10" fill="#0369a1" stroke="#a5f3fc" />
              </g>
            </g>
            <g>
              <rect x="334" y="150" width="250" height="250" rx="18" fill="url(#bay)" stroke="#38bdf8" strokeOpacity="0.28" />
              <rect x="358" y="178" width="202" height="120" rx="12" fill="#07141d" stroke="#164e63" />
              <path
                className="factory-trace"
                d="M372 250 C400 190 430 300 458 230 S520 200 546 248"
                fill="none"
                stroke="url(#copper)"
                strokeWidth="3"
              />
              <circle className="factory-led" cx="372" cy="318" r="6" fill="#34d399" />
              <circle className="factory-led factory-led-late" cx="396" cy="318" r="6" fill="#fbbf24" />
              <circle className="factory-led" cx="420" cy="318" r="6" fill="#38bdf8" style={{ animationDelay: '0.4s' }} />
            </g>
            <g clipPath="url(#belt-window)">
              <rect x="48" y="500" width="544" height="130" rx="16" fill="#0b1822" stroke="#155e75" strokeOpacity="0.5" />
              <rect x="70" y="572" width="500" height="22" rx="6" fill="#142633" />
              <g className="factory-belt">
                {[0, 1, 2, 3, 4, 5].map((index) => (
                  <g key={index} transform={`translate(${70 + index * 130} 524)`}>
                    <rect width="96" height="64" rx="8" fill="#0e7490" />
                    <rect x="10" y="12" width="28" height="16" rx="3" fill="#ecfeff" />
                    <rect x="46" y="12" width="38" height="8" rx="2" fill="#67e8f9" />
                    <rect x="46" y="28" width="28" height="8" rx="2" fill="#0369a1" />
                    <circle cx="22" cy="46" r="5" fill="#fbbf24" />
                    <circle cx="42" cy="46" r="5" fill="#34d399" />
                    <circle cx="70" cy="46" r="5" fill="#38bdf8" />
                  </g>
                ))}
              </g>
            </g>
            <g className="factory-sparks">
              <circle cx="180" cy="480" r="3" fill="#fde68a" />
              <circle cx="420" cy="484" r="2.5" fill="#a5f3fc" />
              <circle cx="300" cy="476" r="2" fill="#86efac" />
            </g>
            <g>
              <rect x="56" y="670" width="528" height="180" rx="18" fill="url(#bay)" stroke="#38bdf8" strokeOpacity="0.28" />
              <rect x="80" y="698" width="480" height="8" rx="4" fill="#0b2230" />
              <g className="factory-probe">
                <rect x="96" y="688" width="18" height="54" rx="6" fill="#e0f2fe" />
                <circle cx="105" cy="748" r="5" className="factory-led" fill="#22d3ee" />
              </g>
              {[0, 1, 2, 3, 4, 5, 6, 7].map((index) => (
                <circle
                  key={index}
                  className="factory-led"
                  cx={160 + index * 48}
                  cy={760}
                  r="7"
                  fill={index % 3 === 0 ? '#34d399' : index % 3 === 1 ? '#fbbf24' : '#38bdf8'}
                  style={{ animationDelay: `${index * 0.18}s` }}
                />
              ))}
            </g>
          </svg>
        </div>
      </aside>
      <div className="relative flex min-h-dvh items-center justify-center px-4 py-20">
        <form
          className="ui-card w-full max-w-md sm:p-8"
          onSubmit={handleSubmit(onSubmit)}
          noValidate
        >
          <div className="mb-4 flex items-center justify-between gap-3">
            <img src="/logo-vietmy-blue.png" alt={t('brand.school')} className="h-16 w-auto" />
            <LanguageMenu />
          </div>
          <div className="mt-6 grid gap-4">
            <label className="grid gap-1 text-sm font-medium text-ink" htmlFor="email">
              {t('auth.email')}
              <input
                id="email"
                type="email"
                autoComplete="email"
                inputMode="email"
                className="ui-field"
                aria-invalid={errors.email ? true : undefined}
                aria-describedby={errors.email ? 'email-error' : undefined}
                {...register('email', {
                  required: 'emailRequired',
                  pattern: { value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, message: 'emailInvalid' },
                })}
              />
            </label>
            {errors.email ? (
              <p id="email-error" className="text-sm text-danger">
                {t(`auth.${errors.email.message}`)}
              </p>
            ) : null}
            <label className="grid gap-1 text-sm font-medium text-ink" htmlFor="password">
              {t('auth.password')}
              <input
                id="password"
                type="password"
                autoComplete="current-password"
                className="ui-field"
                aria-invalid={errors.password ? true : undefined}
                aria-describedby={errors.password ? 'password-error' : undefined}
                {...register('password', {
                  required: 'passwordRequired',
                  minLength: { value: 6, message: 'passwordShort' },
                })}
              />
            </label>
            {errors.password ? (
              <p id="password-error" className="text-sm text-danger">
                {t(`auth.${errors.password.message}`)}
              </p>
            ) : null}
            <label className="flex min-h-11 items-center gap-2 text-sm font-medium text-ink" htmlFor="remember-login">
              <input
                id="remember-login"
                type="checkbox"
                className="size-4"
                checked={remember}
                onChange={(event) => setRemember(event.target.checked)}
              />
              {t('auth.remember')}
            </label>
            {formError ? (
              <p role="alert" className="text-sm text-danger">
                {formError}
              </p>
            ) : null}
            <button type="submit" className="ui-btn ui-btn-primary" disabled={isSubmitting || isLoading}>
              {isSubmitting ? t('auth.submitting') : t('auth.submit')}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
