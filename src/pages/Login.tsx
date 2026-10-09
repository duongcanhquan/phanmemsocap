import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { Navigate, useNavigate } from 'react-router-dom'
import { LanguageMenu } from '../components/LanguageMenu'
import { useAuth } from '../hooks/useAuth'
import { roleHome } from '../lib/roles'
import { supabase } from '../lib/supabase'

interface LoginForm {
  email: string
  password: string
}

export function Login() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { user, role, isLoading, login } = useAuth()
  const [formError, setFormError] = useState('')
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginForm>({ defaultValues: { email: '', password: '' } })

  if (!isLoading && user) {
    return <Navigate to={role ? roleHome[role] : '/unauthorized'} replace />
  }

  async function onSubmit(values: LoginForm) {
    setFormError('')
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
    <div className="min-h-dvh bg-canvas lg:grid lg:grid-cols-2">
      <div className="relative hidden min-h-dvh lg:block">
        <img src="/login-cover.svg" alt={t('auth.coverAlt')} className="h-full w-full object-cover" />
      </div>
      <div className="relative flex min-h-dvh items-center justify-center px-4 py-20">
        <div className="absolute top-4 right-4 z-10 pt-[env(safe-area-inset-top)]">
          <LanguageMenu />
        </div>
        <form
          className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl sm:p-8"
          onSubmit={handleSubmit(onSubmit)}
          noValidate
        >
          <h1 className="ui-title">{t('auth.loginTitle')}</h1>
          <p className="ui-lead">{t('auth.loginLead')}</p>
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
            {formError ? (
              <p role="alert" className="text-sm text-danger">
                {formError}
              </p>
            ) : null}
            <button type="submit" className="ui-btn ui-btn-primary" disabled={isSubmitting || isLoading}>
              {isSubmitting ? t('auth.submitting') : t('auth.submit')}
            </button>
            <button
              type="button"
              className="ui-btn ui-btn-ghost border border-line"
              onClick={() => {
                if (!supabase) {
                  setFormError(t('supabase.missing'))
                  return
                }
                void supabase.auth
                  .signInWithOAuth({
                    provider: 'google',
                    options: { redirectTo: `${window.location.origin}/` },
                  })
                  .then(({ error }) => {
                    if (error) setFormError(t('auth.googleFailed'))
                  })
              }}
            >
              {t('auth.google')}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
