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
      <aside className="login-stage px-10 xl:px-16">
        <div className="login-orbit" aria-hidden="true" />
        <div className="relative z-10 grid max-w-lg gap-6">
          <p className="text-sm font-semibold tracking-wide text-sky-200">{t('brand.school')}</p>
          <h2 className="text-4xl font-semibold leading-tight">{t('auth.stageTitle')}</h2>
          <p className="text-lg leading-relaxed text-sky-100/90">{t('auth.stageLead')}</p>
          <ol className="grid gap-3">
            <li className="login-float rounded-2xl border border-white/20 bg-white/10 px-4 py-3 backdrop-blur-md">{t('auth.stageLessons')}</li>
            <li className="login-float login-float-late rounded-2xl border border-white/20 bg-white/10 px-4 py-3 backdrop-blur-md">{t('auth.stagePractice')}</li>
            <li className="login-float rounded-2xl border border-white/20 bg-white/10 px-4 py-3 backdrop-blur-md" style={{ animationDelay: '2.1s' }}>{t('auth.stagePath')}</li>
          </ol>
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
