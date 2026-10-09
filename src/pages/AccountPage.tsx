import { Eye, EyeOff } from 'lucide-react'
import { useEffect, useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { PageHeader } from '../components/ui/PageHeader'
import { useAuth } from '../hooks/useAuth'
import { changeOwnPassword } from '../lib/accounts'
import { clearMyAvatar, loadMyProfile, saveMyAvatar } from '../lib/profile'

export function AccountPage() {
  const { t } = useTranslation()
  const { user, role } = useAuth()
  const [fullName, setFullName] = useState('')
  const [avatarUrl, setAvatarUrl] = useState('')
  const [photoUrl, setPhotoUrl] = useState('')
  const [profile, setProfile] = useState({
    dateOfBirth: '',
    nationality: '',
    phone: '',
    nationalId: '',
    passport: '',
    studyStatus: '',
    isForeign: false,
    visaStatus: '',
    visaExpiresOn: '',
  })
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [visible, setVisible] = useState(false)
  const [pending, setPending] = useState(false)
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')

  const email = user?.email ?? ''
  const metadataName = typeof user?.user_metadata?.full_name === 'string' ? user.user_metadata.full_name.trim() : ''
  const shownName = fullName || metadataName || email

  useEffect(() => {
    if (!user) return
    let active = true
    void loadMyProfile(user.id).then((profile) => {
      if (!active) return
      setFullName(profile.fullName)
      setAvatarUrl(profile.avatarUrl)
      setPhotoUrl(profile.photoUrl)
      setProfile({
        dateOfBirth: profile.dateOfBirth,
        nationality: profile.nationality,
        phone: profile.phone,
        nationalId: profile.nationalId,
        passport: profile.passport,
        studyStatus: profile.studyStatus,
        isForeign: profile.isForeign,
        visaStatus: profile.visaStatus,
        visaExpiresOn: profile.visaExpiresOn,
      })
    })
    return () => {
      active = false
    }
  }, [user])

  async function onIcon(file: File | undefined) {
    if (!file || !user) return
    setPending(true)
    setError('')
    setNotice('')
    try {
      setAvatarUrl(await saveMyAvatar(user.id, file))
      window.dispatchEvent(new Event('profile-updated'))
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
      setAvatarUrl('')
      window.dispatchEvent(new Event('profile-updated'))
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

  const initial = shownName.trim().charAt(0).toUpperCase() || '•'

  return (
    <div className="ui-page">
      <PageHeader title={t('header.selfTitle')} />
      <section className="ui-card grid gap-5 sm:grid-cols-[auto_1fr] sm:items-center">
        <div className="flex flex-wrap items-center gap-3">
          {avatarUrl || photoUrl ? (
            <img src={avatarUrl || photoUrl} alt="" className="size-20 rounded-full object-cover" />
          ) : (
            <span className="inline-flex size-20 items-center justify-center rounded-full bg-accent text-2xl font-semibold text-white">{initial}</span>
          )}
        </div>
        <div className="grid gap-1">
          <p className="text-sm text-muted">{t('accounts.name')}</p>
          <p className="text-2xl font-semibold text-ink">{shownName}</p>
          <p className="text-base text-ink">{email}</p>
          {role ? <p className="text-sm text-muted">{t(`accounts.roles.${role}`)}</p> : null}
          {role === 'student' ? <p className="text-sm text-muted">{t('accounts.readOnly')}</p> : (
          <div className="mt-2 flex flex-wrap gap-2">
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
          )}
        </div>
      </section>
      <section className="ui-card">
        <h2 className="mb-3 text-lg font-semibold text-ink">{t('accounts.profileTitle')}</h2>
        <dl className="grid gap-3 text-sm sm:grid-cols-2 xl:grid-cols-3">
          <Fact label={t('accounts.dateOfBirth')} value={profile.dateOfBirth || '—'} />
          <Fact label={t('accounts.phone')} value={profile.phone || '—'} />
          <Fact label={t('accounts.nationalId')} value={profile.nationalId || '—'} />
          <Fact label={t('accounts.passport')} value={profile.passport || '—'} />
          <Fact label={t('accounts.nationality')} value={profile.nationality || '—'} />
          {role === 'student' ? <Fact label={t('accounts.studyStatus')} value={profile.studyStatus ? t(`accounts.study.${profile.studyStatus}`) : '—'} /> : null}
          <Fact label={t('accounts.foreign')} value={profile.isForeign ? t('accounts.yes') : t('accounts.no')} />
          {profile.isForeign ? <Fact label={t('accounts.visaStatus')} value={profile.visaStatus ? t(`accounts.visa.${profile.visaStatus}`) : t('accounts.visaUnset')} /> : null}
          {profile.isForeign ? <Fact label={t('accounts.visaExpires')} value={profile.visaExpiresOn || '—'} /> : null}
        </dl>
      </section>
      <form className="ui-card grid max-w-xl gap-4" onSubmit={(event) => void onPassword(event)}>
        <div>
          <h2 className="text-lg font-semibold text-ink">{t('accounts.savePassword')}</h2>
          <p className="mt-1 text-sm text-muted">{t('accounts.passwordHint')}</p>
        </div>
        <PasswordField id="self-password" label={t('accounts.newPassword')} value={password} visible={visible} onChange={setPassword} onToggle={() => setVisible((value) => !value)} showLabel={t('accounts.showPassword')} hideLabel={t('accounts.hidePassword')} />
        <PasswordField id="self-confirm" label={t('accounts.confirmPassword')} value={confirm} visible={visible} onChange={setConfirm} onToggle={() => setVisible((value) => !value)} showLabel={t('accounts.showPassword')} hideLabel={t('accounts.hidePassword')} />
        <button type="submit" className="ui-btn ui-btn-primary w-fit" disabled={pending}>
          {pending ? t('accounts.saving') : t('accounts.savePassword')}
        </button>
        {notice ? <p role="status" className="text-sm font-medium text-accent">{notice}</p> : null}
        {error ? <p role="alert" className="text-sm text-danger">{error}</p> : null}
      </form>
    </div>
  )
}

function PasswordField({
  id,
  label,
  value,
  visible,
  onChange,
  onToggle,
  showLabel,
  hideLabel,
}: {
  id: string
  label: string
  value: string
  visible: boolean
  onChange: (value: string) => void
  onToggle: () => void
  showLabel: string
  hideLabel: string
}) {
  return (
    <label className="grid gap-1 text-sm font-medium text-ink" htmlFor={id}>
      {label}
      <span className="flex gap-2">
        <input
          id={id}
          className="ui-field min-w-0 flex-1"
          type={visible ? 'text' : 'password'}
          autoComplete="new-password"
          value={value}
          required
          onChange={(event) => onChange(event.target.value)}
        />
        <button type="button" className="ui-btn ui-btn-ghost shrink-0" aria-pressed={visible} onClick={onToggle}>
          {visible ? <EyeOff aria-hidden="true" className="size-4" /> : <Eye aria-hidden="true" className="size-4" />}
          {visible ? hideLabel : showLabel}
        </button>
      </span>
    </label>
  )
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-muted">{label}</dt>
      <dd className="font-medium text-ink">{value}</dd>
    </div>
  )
}

function accountMessage(t: (key: string) => string, reason: unknown) {
  const code = reason instanceof Error ? reason.message : 'failed'
  const key = `accounts.errors.${code}`
  const message = t(key)
  return message === key ? t('accounts.errors.failed') : message
}
