import { useEffect, useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { ExportButtons } from '../../components/ExportButtons'
import { DataTable, FilterBar } from '../../components/ui/DataSheet'
import { PageHeader } from '../../components/ui/PageHeader'
import { Tabs } from '../../components/ui/Tabs'
import { useAuth } from '../../hooks/useAuth'
import {
  accountCsvHeader,
  canEditPerson,
  changeOwnPassword,
  createAccount,
  deleteAccount,
  importAccounts,
  listAccounts,
  parseAccountCsv,
  rolesFor,
  updateAccount,
  type AccountInput,
  type AccountPerson,
} from '../../lib/accounts'
import { isR2Configured, uploadToR2 } from '../../lib/r2'
import { isSupabaseConfigured, type AppRole } from '../../lib/supabase'

const emptyPerson = (role: AppRole): AccountInput => ({
  email: '',
  password: '',
  fullName: '',
  role,
  language: 'vi',
  dateOfBirth: '',
  passport: '',
  nationalId: '',
  phone: '',
  photoUrl: '',
})

export function Accounts() {
  const { t } = useTranslation()
  const { user, role } = useAuth()
  const [people, setPeople] = useState<AccountPerson[]>([])
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(isSupabaseConfigured)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [editing, setEditing] = useState<AccountPerson | null>(null)
  const [creating, setCreating] = useState(false)
  const [importing, setImporting] = useState(false)
  const [passwordOpen, setPasswordOpen] = useState(false)
  const [pendingDelete, setPendingDelete] = useState('')
  const [tab, setTab] = useState<'student' | 'teacher' | 'manager'>('student')
  const allowed = rolesFor(role)
  const tabRole: AppRole = tab === 'manager' ? 'admin' : tab
  const canCreate = allowed.includes(tabRole)

  useEffect(() => {
    if (!isSupabaseConfigured) return
    let active = true
    void listAccounts()
      .then((rows) => {
        if (active) setPeople(rows)
      })
      .catch((reason: unknown) => {
        if (active) setError(accountError(t, reason))
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [t])

  function applyPeople(rows: AccountPerson[], message: string) {
    setPeople(rows)
    setNotice(message)
    setError('')
  }

  const visible = people.filter((person) => {
    const inTab = tab === 'manager' ? person.role === 'admin' || person.role === 'superadmin' : person.role === tab
    const haystack = `${person.fullName} ${person.email} ${person.phone} ${person.nationalId} ${person.passport}`.toLowerCase()
    return inTab && haystack.includes(query.trim().toLowerCase())
  })

  return (
    <div className="ui-page">
      <PageHeader title={t('accounts.title')} description={t('accounts.lead')} />
      {loading ? <p role="status">{t('accounts.loading')}</p> : null}
      {notice ? <p role="status" className="text-sm font-medium text-accent">{notice}</p> : null}
      {error ? <p role="alert" className="text-sm text-danger">{error}</p> : null}
      <Tabs
        label={t('panels.label')}
        value={tab}
        onChange={(id) => {
          setTab(id as 'student' | 'teacher' | 'manager')
          setQuery('')
          setPendingDelete('')
        }}
        tabs={[
          { id: 'student', label: t('accounts.tabs.student') },
          { id: 'teacher', label: t('accounts.tabs.teacher') },
          { id: 'manager', label: t('accounts.tabs.manager') },
        ]}
      />
      <div className="ui-fill flex flex-col">
      <FilterBar query={query} onQuery={setQuery} count={visible.length}>
        {canCreate ? (
          <button type="button" className="ui-inline ui-btn-primary shrink-0" onClick={() => setCreating(true)}>
            {t('accounts.create')}
          </button>
        ) : null}
        {canCreate && tab !== 'manager' ? (
          <button type="button" className="ui-inline ui-btn-ghost shrink-0" onClick={() => setImporting(true)}>
            {t('accounts.importTitle')}
          </button>
        ) : null}
        <button type="button" className="ui-inline ui-btn-ghost shrink-0" onClick={() => setPasswordOpen(true)}>
          {t('accounts.savePassword')}
        </button>
        <ExportButtons
          filename={`tai-khoan-${tab}`}
          title={t(`accounts.tabs.${tab}`)}
          headers={[t('accounts.name'), t('accounts.email'), t('accounts.role'), t('accounts.dateOfBirth'), t('accounts.phone'), t('accounts.nationalId'), t('accounts.passport')]}
          rows={visible.map((person) => [
            person.fullName || t('accounts.unnamed'),
            person.email,
            t(`accounts.roles.${person.role}`),
            person.dateOfBirth,
            person.phone,
            person.nationalId,
            person.passport,
          ])}
        />
      </FilterBar>
      {!loading && people.length === 0 ? <p className="text-muted">{t('accounts.empty')}</p> : null}
      {!loading && people.length > 0 && visible.length === 0 ? <p className="text-muted">{t('filters.noMatch')}</p> : null}
      <DataTable className="min-h-0 flex-1">
          <thead>
            <tr>
              <th className="px-3 py-3 font-medium">{t('accounts.name')}</th>
              <th className="px-3 py-3 font-medium">{t('accounts.email')}</th>
              <th className="px-3 py-3 font-medium">{t('accounts.role')}</th>
              <th className="px-3 py-3 font-medium">{t('accounts.dateOfBirth')}</th>
              <th className="px-3 py-3 font-medium">{t('accounts.phone')}</th>
              <th className="px-3 py-3 font-medium">{t('accounts.nationalId')}</th>
              <th className="px-3 py-3 font-medium">{t('accounts.passport')}</th>
              <th className="px-3 py-3 font-medium">{t('teacher.action')}</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((person) => (
              <tr key={person.id} className="border-b border-line last:border-0">
                <td className="px-3 py-2 font-medium text-ink">
                  <span className="inline-flex items-center gap-2">
                    <Photo photoUrl={person.photoUrl} name={person.fullName} />
                    {person.fullName || t('accounts.unnamed')}
                  </span>
                </td>
                <td className="px-3 py-2 text-ink">{person.email}</td>
                <td className="px-3 py-2 text-ink">{t(`accounts.roles.${person.role}`)}</td>
                <td className="px-3 py-2 text-ink">{person.dateOfBirth}</td>
                <td className="px-3 py-2 text-ink">{person.phone}</td>
                <td className="px-3 py-2 text-ink">{person.nationalId}</td>
                <td className="px-3 py-2 text-ink">{person.passport}</td>
                <td className="px-3 py-2">
                  {canEditPerson(role, person, user?.id) ? (
                    <span className="inline-flex gap-2">
                      <button type="button" className="ui-inline ui-btn-ghost" onClick={() => setEditing(person)}>
                        {t('accounts.edit')}
                      </button>
                      {person.id === user?.id ? (
                        <span className="flex items-center text-sm text-muted">{t('accounts.you')}</span>
                      ) : pendingDelete === person.id ? (
                        <button
                          type="button"
                          className="ui-inline bg-danger text-white"
                          onClick={() => {
                            void deleteAccount(person.id)
                              .then((rows) => {
                                applyPeople(rows, t('accounts.removed'))
                                setPendingDelete('')
                              })
                              .catch((reason: unknown) => setError(accountError(t, reason)))
                          }}
                        >
                          {t('accounts.confirmRemove')}
                        </button>
                      ) : (
                        <button type="button" className="ui-inline text-danger" onClick={() => setPendingDelete(person.id)}>
                          {t('accounts.remove')}
                        </button>
                      )}
                    </span>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
      </DataTable>
      </div>
      {creating ? (
        <div className="fixed inset-0 z-40 flex items-end justify-center bg-ink/40 p-4 sm:items-center">
          <div className="ui-card max-h-[90dvh] w-full max-w-3xl overflow-y-auto">
            <PersonForm
              title={t('accounts.createTitle')}
              person={emptyPerson(tabRole)}
              allowed={[tabRole]}
              requirePassword
              submitLabel={t('accounts.create')}
              onSubmit={async (person) => {
                const rows = await createAccount(person)
                applyPeople(rows, t('accounts.created'))
                setCreating(false)
              }}
              onError={setError}
              onCancel={() => setCreating(false)}
            />
          </div>
        </div>
      ) : null}
      {importing ? (
        <div className="fixed inset-0 z-40 flex items-end justify-center bg-ink/40 p-4 sm:items-center">
          <div className="ui-card max-h-[90dvh] w-full max-w-3xl overflow-y-auto">
            <ImportPeople
              allowed={[tabRole]}
              onDone={(rows, failed) => {
                setPeople(rows)
                setError('')
                setNotice(failed.length > 0 ? t('accounts.importedPartial', { count: failed.length }) : t('accounts.imported'))
                setImporting(false)
              }}
              onError={setError}
            />
            <button type="button" className="ui-btn ui-btn-ghost mt-3" onClick={() => setImporting(false)}>{t('accounts.cancel')}</button>
          </div>
        </div>
      ) : null}
      {passwordOpen ? (
        <div className="fixed inset-0 z-40 flex items-end justify-center bg-ink/40 p-4 sm:items-center">
          <div className="ui-card w-full max-w-lg">
            <OwnPassword email={user?.email ?? ''} onSaved={() => { setNotice(t('accounts.passwordSaved')); setPasswordOpen(false) }} onError={setError} />
            <button type="button" className="ui-btn ui-btn-ghost mt-3" onClick={() => setPasswordOpen(false)}>{t('accounts.cancel')}</button>
          </div>
        </div>
      ) : null}
      {editing ? (
        <div className="fixed inset-0 z-40 flex items-end justify-center bg-ink/40 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:items-center">
          <div key={editing.id} className="ui-card max-h-[90dvh] w-full max-w-3xl overflow-y-auto">
            <PersonForm
              title={editing.email}
              person={{
                email: editing.email,
                password: '',
                fullName: editing.fullName,
                role: editing.role,
                language: editing.language,
                dateOfBirth: editing.dateOfBirth,
                passport: editing.passport,
                nationalId: editing.nationalId,
                phone: editing.phone,
                photoUrl: editing.photoUrl,
              }}
              allowed={editing.id === user?.id ? [editing.role] : allowed}
              emailLocked
              submitLabel={t('accounts.save')}
              onSubmit={async (person) => {
                const rows = await updateAccount(editing.id, person)
                applyPeople(rows, t('accounts.saved'))
                setEditing(null)
              }}
              onError={setError}
              onCancel={() => setEditing(null)}
            />
          </div>
        </div>
      ) : null}
    </div>
  )
}

function PersonForm({
  title,
  person,
  allowed,
  requirePassword = false,
  emailLocked = false,
  submitLabel,
  onSubmit,
  onError,
  onCancel,
}: {
  title: string
  person: AccountInput
  allowed: AppRole[]
  requirePassword?: boolean
  emailLocked?: boolean
  submitLabel: string
  onSubmit: (person: AccountInput) => Promise<void>
  onError: (message: string) => void
  onCancel?: () => void
}) {
  const { t } = useTranslation()
  const [draft, setDraft] = useState(person)
  const [pending, setPending] = useState(false)

  function setField(field: keyof AccountInput, value: string) {
    setDraft((current) => ({ ...current, [field]: value }))
  }

  async function onFormSubmit(event: FormEvent) {
    event.preventDefault()
    setPending(true)
    try {
      await onSubmit(draft)
      if (!emailLocked) setDraft(emptyPerson(allowed[0] ?? 'student'))
    } catch (reason) {
      onError(accountError(t, reason))
    } finally {
      setPending(false)
    }
  }

  return (
    <form className="ui-card grid gap-3" onSubmit={(event) => void onFormSubmit(event)}>
      <h2 className="text-lg font-semibold text-ink">{title}</h2>
      <PhotoField photoUrl={draft.photoUrl} onChange={(photoUrl) => setField('photoUrl', photoUrl)} onError={onError} />
      <TextField id={`${title}-name`} label={t('accounts.name')} value={draft.fullName} onChange={(value) => setField('fullName', value)} />
      <TextField id={`${title}-email`} label={t('accounts.email')} type="email" value={draft.email} disabled={emailLocked} required onChange={(value) => setField('email', value)} />
      <TextField
        id={`${title}-password`}
        label={requirePassword ? t('accounts.password') : t('accounts.resetPassword')}
        type="password"
        value={draft.password ?? ''}
        required={requirePassword}
        onChange={(value) => setField('password', value)}
      />
      <div className="grid gap-3 lg:grid-cols-3">
        <label className="grid gap-1 text-sm font-medium text-ink" htmlFor={`${title}-role`}>
          {t('accounts.role')}
          <select id={`${title}-role`} className="ui-field" value={draft.role} onChange={(event) => setField('role', event.target.value)}>
            {allowed.map((item) => (
              <option key={item} value={item}>{t(`accounts.roles.${item}`)}</option>
            ))}
          </select>
        </label>
        <TextField id={`${title}-dob`} label={t('accounts.dateOfBirth')} type="date" value={draft.dateOfBirth} onChange={(value) => setField('dateOfBirth', value)} />
        <TextField id={`${title}-phone`} label={t('accounts.phone')} value={draft.phone} onChange={(value) => setField('phone', value)} />
        <TextField id={`${title}-id`} label={t('accounts.nationalId')} value={draft.nationalId} onChange={(value) => setField('nationalId', value)} />
        <TextField id={`${title}-passport`} label={t('accounts.passport')} value={draft.passport} onChange={(value) => setField('passport', value)} />
      </div>
      <div className="grid grid-cols-2 gap-2">
        {onCancel ? (
          <button type="button" className="ui-btn ui-btn-ghost border border-line" onClick={onCancel}>{t('accounts.cancel')}</button>
        ) : null}
        <button type="submit" className={`ui-btn ui-btn-primary ${onCancel ? '' : 'col-span-2 sm:col-span-1 sm:w-fit'}`} disabled={pending}>
          {pending ? t('accounts.saving') : submitLabel}
        </button>
      </div>
    </form>
  )
}

function ImportPeople({
  allowed,
  onDone,
  onError,
}: {
  allowed: AppRole[]
  onDone: (people: AccountPerson[], failed: { email: string; error: string }[]) => void
  onError: (message: string) => void
}) {
  const { t } = useTranslation()
  const [role, setRole] = useState<AppRole>(allowed.includes('student') ? 'student' : allowed[0] ?? 'student')
  const [pending, setPending] = useState(false)

  function downloadTemplate() {
    const sample = `${accountCsvHeader}\nstudent@example.com,Matkhau123,Nguyen Van A,2005-04-12,P1234567,001234567890,0901234567,`
    const blob = new Blob([sample], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'danh-sach-tai-khoan.csv'
    link.click()
    URL.revokeObjectURL(url)
  }

  async function onFile(file: File | undefined) {
    if (!file) return
    setPending(true)
    try {
      const people = parseAccountCsv(await file.text(), role)
      const result = await importAccounts(people)
      onDone(result.people, result.failed)
    } catch (reason) {
      onError(accountError(t, reason))
    } finally {
      setPending(false)
    }
  }

  return (
    <section className="ui-card grid gap-3">
      <h2 className="text-lg font-semibold text-ink">{t('accounts.importTitle')}</h2>
      <p className="text-sm text-muted">{t('accounts.importLead')}</p>
      <label className="grid gap-1 text-sm font-medium text-ink" htmlFor="import-role">
        {t('accounts.role')}
        <select id="import-role" className="ui-field" value={role} onChange={(event) => setRole(event.target.value as AppRole)}>
          {allowed.map((item) => (
            <option key={item} value={item}>{t(`accounts.roles.${item}`)}</option>
          ))}
        </select>
      </label>
      <div className="grid gap-2 sm:grid-cols-2">
        <button type="button" className="ui-btn ui-btn-ghost border border-line" onClick={downloadTemplate}>
          {t('accounts.template')}
        </button>
        <label className="ui-btn ui-btn-primary cursor-pointer">
          {pending ? t('accounts.saving') : t('accounts.import')}
          <input
            className="sr-only"
            type="file"
            accept=".csv,text/csv"
            disabled={pending}
            onChange={(event) => {
              const file = event.target.files?.[0]
              event.target.value = ''
              void onFile(file)
            }}
          />
        </label>
      </div>
    </section>
  )
}

function PhotoField({
  photoUrl,
  onChange,
  onError,
}: {
  photoUrl: string
  onChange: (url: string) => void
  onError: (message: string) => void
}) {
  const { t } = useTranslation()
  const [pending, setPending] = useState(false)

  async function onFile(file: File | undefined) {
    if (!file) return
    if (!isR2Configured) {
      onError(t('editor.r2Missing'))
      return
    }
    setPending(true)
    try {
      onChange(await uploadToR2(file))
    } catch (reason) {
      onError(reason instanceof Error ? reason.message : t('editor.uploadError'))
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="flex items-center gap-3">
      <Photo photoUrl={photoUrl} name="" />
      <div className="grid min-w-0 flex-1 gap-2">
        <label className="ui-btn ui-btn-ghost cursor-pointer border border-line">
          {pending ? t('editor.uploading') : t('accounts.photo')}
          <input className="sr-only" type="file" accept="image/jpeg,image/png,image/webp,image/gif" disabled={pending} onChange={(event) => void onFile(event.target.files?.[0])} />
        </label>
        <input className="ui-field" type="url" placeholder={t('accounts.photoUrl')} value={photoUrl} onChange={(event) => onChange(event.target.value)} />
      </div>
    </div>
  )
}

function Photo({ photoUrl, name }: { photoUrl: string; name: string }) {
  if (photoUrl) return <img src={photoUrl} alt="" className="size-9 rounded-xl object-cover" />
  const initial = name.trim().charAt(0).toUpperCase() || '•'
  return <span className="flex size-9 items-center justify-center rounded-xl bg-canvas text-sm font-semibold text-ink">{initial}</span>
}

function TextField({
  id,
  label,
  value,
  onChange,
  type = 'text',
  required = false,
  disabled = false,
}: {
  id: string
  label: string
  value: string
  onChange: (value: string) => void
  type?: string
  required?: boolean
  disabled?: boolean
}) {
  return (
    <label className="grid gap-1 text-sm font-medium text-ink" htmlFor={id}>
      {label}
      <input id={id} className="ui-field" type={type} value={value} required={required} disabled={disabled} onChange={(event) => onChange(event.target.value)} />
    </label>
  )
}

function OwnPassword({ email, onSaved, onError }: { email: string; onSaved: () => void; onError: (message: string) => void }) {
  const { t } = useTranslation()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [pending, setPending] = useState(false)

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    if (password.length < 8) {
      onError(t('accounts.errors.weak-password'))
      return
    }
    if (password !== confirm) {
      onError(t('accounts.errors.mismatch'))
      return
    }
    setPending(true)
    try {
      await changeOwnPassword(password)
      setPassword('')
      setConfirm('')
      onSaved()
    } catch (reason) {
      onError(accountError(t, reason))
    } finally {
      setPending(false)
    }
  }

  return (
    <form className="ui-card grid gap-3" onSubmit={(event) => void onSubmit(event)}>
      <h2 className="text-lg font-semibold text-ink">{t('accounts.ownTitle')}</h2>
      <p className="text-sm text-muted">{email}</p>
      <TextField id="own-password" label={t('accounts.newPassword')} type="password" value={password} required onChange={setPassword} />
      <TextField id="own-confirm" label={t('accounts.confirmPassword')} type="password" value={confirm} required onChange={setConfirm} />
      <button type="submit" className="ui-btn ui-btn-primary w-full sm:w-fit" disabled={pending}>
        {pending ? t('accounts.saving') : t('accounts.savePassword')}
      </button>
    </form>
  )
}

function accountError(t: (key: string) => string, reason: unknown) {
  const code = reason instanceof Error ? reason.message : 'failed'
  const key = `accounts.errors.${code}`
  const message = t(key)
  return message === key ? t('accounts.errors.failed') : message
}
