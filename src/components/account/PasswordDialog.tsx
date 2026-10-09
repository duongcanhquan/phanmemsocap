import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { changeOwnPassword } from '../../lib/accounts'

export function PasswordDialog({
  email,
  fullName,
  onClose,
}: {
  email: string
  fullName: string
  onClose: () => void
}) {
  const { t } = useTranslation()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [pending, setPending] = useState(false)
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    if (password.length < 8) {
      setError(t('accounts.errors.weak-password'))
      return
    }
    if (password !== confirm) {
      setError(t('accounts.errors.mismatch'))
      return
    }
    setPending(true)
    setError('')
    setNotice('')
    try {
      await changeOwnPassword(password)
      setPassword('')
      setConfirm('')
      setNotice(t('accounts.passwordSaved'))
    } catch (reason) {
      const code = reason instanceof Error ? reason.message : 'failed'
      const key = `accounts.errors.${code}`
      const message = t(key)
      setError(message === key ? t('accounts.errors.failed') : message)
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 p-4" onMouseDown={onClose}>
      <form
        className="grid w-full max-w-md gap-4 rounded-2xl bg-white p-5 text-ink shadow-xl"
        onMouseDown={(event) => event.stopPropagation()}
        onSubmit={(event) => void onSubmit(event)}
      >
        <div className="flex items-start justify-between gap-3">
          <h2 className="text-lg font-semibold uppercase">{t('accounts.savePassword')}</h2>
          <button type="button" className="ui-inline ui-btn-ghost" onClick={onClose}>
            {t('teacher.close')}
          </button>
        </div>
        <p className="text-sm text-muted">{t('accounts.passwordHint')}</p>
        <p className="text-base">
          <span className="text-muted">{t('accounts.name')}: </span>
          <span className="font-semibold">{fullName || t('header.noName')}</span>
        </p>
        <p className="text-sm text-ink">{email}</p>
        <label className="grid gap-1 text-sm font-medium" htmlFor="popup-password">
          {t('accounts.newPassword')}
          <input id="popup-password" className="ui-field" type="password" autoComplete="new-password" value={password} required onChange={(event) => setPassword(event.target.value)} />
        </label>
        <label className="grid gap-1 text-sm font-medium" htmlFor="popup-confirm">
          {t('accounts.confirmPassword')}
          <input id="popup-confirm" className="ui-field" type="password" autoComplete="new-password" value={confirm} required onChange={(event) => setConfirm(event.target.value)} />
        </label>
        {notice ? <p role="status" className="text-sm font-medium text-accent">{notice}</p> : null}
        {error ? <p role="alert" className="text-sm text-danger">{error}</p> : null}
        <button type="submit" className="ui-btn ui-btn-primary w-fit" disabled={pending}>
          {pending ? t('accounts.saving') : t('accounts.savePassword')}
        </button>
      </form>
    </div>
  )
}
