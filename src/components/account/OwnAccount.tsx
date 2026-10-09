import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { changeOwnPassword } from '../../lib/accounts'
import { clearMyAvatar, saveMyAvatar } from '../../lib/profile'

export function OwnAccount({
  userId,
  email,
  avatarUrl,
  onAvatar,
}: {
  userId: string
  email: string
  avatarUrl: string
  onAvatar: (url: string) => void
}) {
  const { t } = useTranslation()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [pending, setPending] = useState(false)
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')

  async function onIcon(file: File | undefined) {
    if (!file) return
    setPending(true)
    setError('')
    setNotice('')
    try {
      const url = await saveMyAvatar(userId, file)
      onAvatar(url)
      setNotice(t('header.selfIconSaved'))
    } catch (reason) {
      setError(accountMessage(t, reason))
    } finally {
      setPending(false)
    }
  }

  async function onRemove() {
    setPending(true)
    setError('')
    setNotice('')
    try {
      await clearMyAvatar()
      onAvatar('')
      setNotice(t('header.selfIconRemoved'))
    } catch (reason) {
      setError(accountMessage(t, reason))
    } finally {
      setPending(false)
    }
  }

  async function onPassword(event: FormEvent) {
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
      setError(accountMessage(t, reason))
    } finally {
      setPending(false)
    }
  }

  const initial = email.trim().charAt(0).toUpperCase() || '•'

  return (
    <div className="grid gap-5">
      <p className="text-sm text-muted">{email}</p>
      <section className="grid gap-3">
        <h3 className="text-sm font-semibold text-ink">{t('header.selfIcon')}</h3>
        <p className="text-sm text-muted">{t('header.selfIconHint')}</p>
        <div className="flex flex-wrap items-center gap-3">
          {avatarUrl ? (
            <img src={avatarUrl} alt="" className="size-16 rounded-full object-cover" />
          ) : (
            <span className="inline-flex size-16 items-center justify-center rounded-full bg-accent text-lg font-semibold text-white">{initial}</span>
          )}
          <label className="ui-inline ui-btn-primary">
            {t('header.selfIconChange')}
            <input
              className="sr-only"
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              disabled={pending}
              onChange={(event) => {
                const file = event.target.files?.[0]
                event.target.value = ''
                void onIcon(file)
              }}
            />
          </label>
          {avatarUrl ? (
            <button type="button" className="ui-inline ui-btn-ghost" disabled={pending} onClick={() => void onRemove()}>
              {t('header.selfIconRemove')}
            </button>
          ) : null}
        </div>
      </section>
      <form className="grid gap-3" onSubmit={(event) => void onPassword(event)}>
        <h3 className="text-sm font-semibold text-ink">{t('accounts.savePassword')}</h3>
        <label className="grid gap-1 text-sm font-medium text-ink" htmlFor="self-password">
          {t('accounts.newPassword')}
          <input id="self-password" className="ui-field" type="password" autoComplete="new-password" value={password} required onChange={(event) => setPassword(event.target.value)} />
        </label>
        <label className="grid gap-1 text-sm font-medium text-ink" htmlFor="self-confirm">
          {t('accounts.confirmPassword')}
          <input id="self-confirm" className="ui-field" type="password" autoComplete="new-password" value={confirm} required onChange={(event) => setConfirm(event.target.value)} />
        </label>
        <div className="ui-dialog-foot">
          <button type="submit" className="ui-btn ui-btn-primary" disabled={pending}>
            {pending ? t('accounts.saving') : t('accounts.savePassword')}
          </button>
        </div>
      </form>
      {notice ? <p role="status" className="text-sm font-medium text-accent">{notice}</p> : null}
      {error ? <p role="alert" className="text-sm text-danger">{error}</p> : null}
    </div>
  )
}

function accountMessage(t: (key: string) => string, reason: unknown) {
  const code = reason instanceof Error ? reason.message : 'failed'
  const key = `accounts.errors.${code}`
  const message = t(key)
  return message === key ? t('accounts.errors.failed') : message
}
