import { useEffect, useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { ExportButtons } from '../../components/ExportButtons'
import { DataTable, FilterBar, SelectFilter } from '../../components/ui/DataSheet'
import { Dialog } from '../../components/ui/Dialog'
import { PageHeader } from '../../components/ui/PageHeader'
import { Tabs } from '../../components/ui/Tabs'
import { useAuth } from '../../hooks/useAuth'
import {
  accountCsvHeader,
  canEditPerson,
  createAccount,
  deleteAccount,
  importAccounts,
  visaWindow,
  listAccounts,
  parseAccountCsv,
  rolesFor,
  studyStatuses,
  updateAccount,
  visaStatuses,
  type AccountInput,
  type AccountPerson,
  type StudyStatus,
  type VisaStatus,
} from '../../lib/accounts'
import { isMediaUploadReady, uploadMedia } from '../../lib/media'
import { isSupabaseConfigured, type AppRole } from '../../lib/supabase'

const emptyPerson = (role: AppRole): AccountInput => ({
  email: '',
  password: '',
  fullName: '',
  role,
  language: 'vi',
  dateOfBirth: '',
  passport: '',
  nationality: '',
  nationalId: '',
  phone: '',
  photoUrl: '',
  studyStatus: 'studying',
  isForeign: false,
  visaStatus: '',
  visaExpiresOn: '',
})

export function Accounts() {
  const { t } = useTranslation()
  const { user, role } = useAuth()
  const navigate = useNavigate()
  const [people, setPeople] = useState<AccountPerson[]>([])
  const [query, setQuery] = useState('')
  const [studyFilter, setStudyFilter] = useState('all')
  const [nationFilter, setNationFilter] = useState('all')
  const [visaFilter, setVisaFilter] = useState('all')
  const [loading, setLoading] = useState(isSupabaseConfigured)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [editing, setEditing] = useState<AccountPerson | null>(null)
  const [creating, setCreating] = useState(false)
  const [importing, setImporting] = useState(false)
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
    const nation = person.nationality ?? ''
    const haystack = `${person.fullName} ${person.email} ${person.phone} ${person.nationalId} ${person.passport} ${nation}`.toLowerCase()
    const matchesStudy = tab !== 'student' || studyFilter === 'all' || person.studyStatus === studyFilter
    const matchesNation = tab !== 'student' || nationFilter === 'all' || nation === nationFilter
    const visaSpan = person.isForeign ? visaWindow(person.visaExpiresOn) : 'ok'
    const inVisaWindow = visaFilter === 'quarter' ? visaSpan === 'quarter' || visaSpan === 'month' : visaSpan === visaFilter
    const matchesVisa = tab !== 'student' || visaFilter === 'all' || (person.isForeign && inVisaWindow)
    return inTab && matchesStudy && matchesNation && matchesVisa && haystack.includes(query.trim().toLowerCase())
  })

  return (
    <div className="ui-page">
      <PageHeader
        title={t('accounts.title')}
        action={
          <ExportButtons
            filename={`tai-khoan-${tab}`}
            title={t(`accounts.tabs.${tab}`)}
            headers={[
              t('accounts.name'),
              t('accounts.email'),
              t('accounts.role'),
              t('accounts.studyStatus'),
              t('accounts.dateOfBirth'),
              t('accounts.phone'),
              t('accounts.nationalId'),
              t('accounts.passport'),
              t('accounts.nationality'),
              t('accounts.visaStatus'),
              t('accounts.visaExpires'),
            ]}
            rows={visible.map((person) => [
              person.fullName || t('accounts.unnamed'),
              person.email,
              t(`accounts.roles.${person.role}`),
              person.role === 'student' ? t(`accounts.study.${person.studyStatus}`) : '',
              person.dateOfBirth,
              person.phone,
              person.nationalId,
              person.passport,
              person.nationality,
              person.isForeign && person.visaStatus ? t(`accounts.visa.${person.visaStatus}`) : '',
              person.isForeign ? person.visaExpiresOn : '',
            ])}
          />
        }
      />
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
      {tab === 'student' ? (
        <VisaBoard
          people={people.filter((person) => person.role === 'student' && person.isForeign)}
          filter={visaFilter}
          onFilter={setVisaFilter}
        />
      ) : null}
      <FilterBar query={query} onQuery={setQuery} count={visible.length}>
        {tab === 'student' ? (
          <>
          <SelectFilter
            id="student-study"
            label={t('accounts.studyStatus')}
            value={studyFilter}
            onChange={setStudyFilter}
            options={[
              { value: 'all', label: t('filters.all') },
              ...studyStatuses.map((status) => ({ value: status, label: t(`accounts.study.${status}`) })),
            ]}
          />
          <SelectFilter
            id="student-nation"
            label={t('accounts.nationality')}
            value={nationFilter}
            onChange={setNationFilter}
            options={[
              { value: 'all', label: t('filters.all') },
              ...[...new Set(people.filter((person) => person.role === 'student' && person.nationality).map((person) => person.nationality))].map((name) => ({
                value: name,
                label: name,
              })),
            ]}
          />
          </>
        ) : null}
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
        <button type="button" className="ui-inline ui-btn-ghost shrink-0" onClick={() => navigate('/account')}>
          {t('accounts.savePassword')}
        </button>
      </FilterBar>
      {!loading && people.length === 0 ? <p className="text-muted">{t('accounts.empty')}</p> : null}
      {!loading && people.length > 0 && visible.length === 0 ? <p className="text-muted">{t('filters.noMatch')}</p> : null}
      <DataTable className="min-h-0 flex-1">
          <thead>
            <tr>
              <th className="px-3 py-3 font-medium">{t('accounts.name')}</th>
              <th className="px-3 py-3 font-medium">{t('accounts.email')}</th>
              {tab === 'student' ? <th className="px-3 py-3 font-medium">{t('accounts.studyStatus')}</th> : <th className="px-3 py-3 font-medium">{t('accounts.role')}</th>}
              {tab === 'student' ? <th className="px-3 py-3 font-medium">{t('accounts.nationality')}</th> : <th className="px-3 py-3 font-medium">{t('accounts.phone')}</th>}
              {tab === 'student' ? <th className="px-3 py-3 font-medium">{t('accounts.visaExpires')}</th> : <th className="px-3 py-3 font-medium">{t('accounts.passport')}</th>}
              <th className="px-3 py-3 font-medium">{t('teacher.action')}</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((person) => (
              <tr
                key={person.id}
                className="ui-row"
                onClick={() => {
                  if (person.role === 'student') navigate(`/students/${person.id}`)
                  else if (canEditPerson(role, person, user?.id)) setEditing(person)
                }}
              >
                <td className="px-3 py-2 font-medium text-ink">
                  <span className="inline-flex items-center gap-2">
                    <Photo photoUrl={person.photoUrl} name={person.fullName} />
                    <span className="grid min-w-0">
                      <span className="truncate">{person.fullName || t('accounts.unnamed')}</span>
                      {tab === 'student' && person.phone ? <span className="truncate text-xs font-normal text-muted">{person.phone}</span> : null}
                    </span>
                  </span>
                </td>
                <td className="px-3 py-2 text-ink">{person.email}</td>
                {tab === 'student' ? (
                  <td className="px-3 py-2 text-ink">{t(`accounts.study.${person.studyStatus}`)}</td>
                ) : (
                  <td className="px-3 py-2 text-ink">{t(`accounts.roles.${person.role}`)}</td>
                )}
                {tab === 'student' ? (
                  <td className="px-3 py-2 text-ink">{person.nationality || '—'}</td>
                ) : (
                  <td className="px-3 py-2 text-ink">{person.phone || '—'}</td>
                )}
                {tab === 'student' ? (
                  <td className={`px-3 py-2 text-ink ${person.isForeign && ['month', 'expired'].includes(visaWindow(person.visaExpiresOn)) ? 'font-semibold text-danger' : ''}`}>
                    {person.isForeign ? person.visaExpiresOn || '—' : '—'}
                  </td>
                ) : (
                  <td className="px-3 py-2 text-ink">{person.passport || '—'}</td>
                )}
                <td className="px-3 py-2">
                  {canEditPerson(role, person, user?.id) ? (
                    <span className="inline-flex gap-2" onClick={(event) => event.stopPropagation()}>
                      {person.role === 'student' ? (
                        <button type="button" className="ui-inline ui-btn-primary" onClick={() => navigate(`/students/${person.id}`)}>
                          {t('accounts.detail')}
                        </button>
                      ) : null}
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
        <Dialog title={t('accounts.createTitle')} onClose={() => setCreating(false)}>
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
        </Dialog>
      ) : null}
      {importing ? (
        <Dialog title={t('accounts.importTitle')} onClose={() => setImporting(false)}>
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
        </Dialog>
      ) : null}
      {editing ? (
        <Dialog key={editing.id} title={editing.fullName || editing.email} onClose={() => setEditing(null)}>
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
              nationality: editing.nationality,
              nationalId: editing.nationalId,
              phone: editing.phone,
              photoUrl: editing.photoUrl,
              studyStatus: editing.studyStatus,
              isForeign: editing.isForeign,
              visaStatus: editing.visaStatus,
              visaExpiresOn: editing.visaExpiresOn,
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
        </Dialog>
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
    <form className="grid items-start gap-6 lg:grid-cols-[11rem_1fr]" onSubmit={(event) => void onFormSubmit(event)}>
      <PhotoField photoUrl={draft.photoUrl} onChange={(photoUrl) => setField('photoUrl', photoUrl)} onError={onError} />
      <div className="grid gap-5 sm:grid-cols-2">
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
      {draft.role === 'student' ? (
        <TextField id={`${title}-nation`} label={t('accounts.nationality')} value={draft.nationality} onChange={(value) => setField('nationality', value)} />
      ) : null}
      {draft.role === 'student' ? (
        <>
          <label className="grid gap-1 text-sm font-medium text-ink" htmlFor={`${title}-study`}>
            {t('accounts.studyStatus')}
            <select
              id={`${title}-study`}
              className="ui-field"
              value={draft.studyStatus}
              onChange={(event) => setField('studyStatus', event.target.value as StudyStatus)}
            >
              {studyStatuses.map((status) => (
                <option key={status} value={status}>{t(`accounts.study.${status}`)}</option>
              ))}
            </select>
          </label>
          <label className="flex min-h-11 items-center gap-2 text-sm font-medium text-ink" htmlFor={`${title}-foreign`}>
            <input
              id={`${title}-foreign`}
              type="checkbox"
              className="size-4"
              checked={draft.isForeign}
              onChange={(event) => setDraft((current) => ({ ...current, isForeign: event.target.checked }))}
            />
            {t('accounts.foreign')}
          </label>
          {draft.isForeign ? (
            <>
              <label className="grid gap-1 text-sm font-medium text-ink" htmlFor={`${title}-visa`}>
                {t('accounts.visaStatus')}
                <select
                  id={`${title}-visa`}
                  className="ui-field"
                  value={draft.visaStatus}
                  onChange={(event) => setField('visaStatus', event.target.value as VisaStatus | '')}
                >
                  <option value="">{t('accounts.visaUnset')}</option>
                  {visaStatuses.map((status) => (
                    <option key={status} value={status}>{t(`accounts.visa.${status}`)}</option>
                  ))}
                </select>
              </label>
              <TextField
                id={`${title}-visa-date`}
                label={t('accounts.visaExpires')}
                type="date"
                value={draft.visaExpiresOn}
                onChange={(value) => setField('visaExpiresOn', value)}
              />
            </>
          ) : null}
        </>
      ) : null}
      <div className="ui-dialog-foot sm:col-span-2">
        {onCancel ? (
          <button type="button" className="ui-btn ui-btn-ghost border border-line" onClick={onCancel}>{t('accounts.cancel')}</button>
        ) : null}
        <button type="submit" className="ui-btn ui-btn-primary" disabled={pending}>
          {pending ? t('accounts.saving') : submitLabel}
        </button>
      </div>
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
    const sample = `${accountCsvHeader}\nstudent@example.com,Matkhau123,Nguyen Van A,2005-04-12,P1234567,Viet Nam,001234567890,0901234567,`
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
    <section className="grid max-w-xl gap-4">
      <p className="text-base text-muted">{t('accounts.importLead')}</p>
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
    if (!isMediaUploadReady()) {
      onError(t('editor.storageMissing'))
      return
    }
    setPending(true)
    try {
      onChange(await uploadMedia(file, 'photos'))
    } catch {
      onError(t('editor.uploadError'))
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="grid justify-items-center gap-2">
      <label className="portrait-frame">
        {photoUrl ? <img src={photoUrl} alt="" /> : null}
        <input className="sr-only" type="file" accept="image/jpeg,image/png,image/webp,image/gif" disabled={pending} onChange={(event) => void onFile(event.target.files?.[0])} />
      </label>
      <span className="text-sm font-semibold text-accent">{pending ? t('editor.uploading') : t('accounts.uploadPhoto')}</span>
      <input className="ui-field w-full" type="url" placeholder={t('accounts.photoUrl')} value={photoUrl} onChange={(event) => onChange(event.target.value)} />
    </div>
  )
}

function Photo({ photoUrl, name }: { photoUrl: string; name: string }) {
  if (photoUrl) return <img src={photoUrl} alt="" className="h-12 w-9 rounded-md object-cover object-top" />
  const initial = name.trim().charAt(0).toUpperCase() || '•'
  return <span className="flex h-12 w-9 items-center justify-center rounded-md bg-canvas text-sm font-semibold text-ink">{initial}</span>
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

function VisaBoard({
  people,
  filter,
  onFilter,
}: {
  people: AccountPerson[]
  filter: string
  onFilter: (value: string) => void
}) {
  const { t } = useTranslation()
  const month = people.filter((person) => visaWindow(person.visaExpiresOn) === 'month').length
  const quarter = people.filter((person) => {
    const span = visaWindow(person.visaExpiresOn)
    return span === 'quarter' || span === 'month'
  }).length
  const expired = people.filter((person) => visaWindow(person.visaExpiresOn) === 'expired').length

  return (
    <section className="mb-3 grid gap-2 sm:grid-cols-3">
      <VisaCount
        label={t('accounts.visaMonth')}
        value={month}
        active={filter === 'month'}
        tone="danger"
        onClick={() => onFilter(filter === 'month' ? 'all' : 'month')}
      />
      <VisaCount
        label={t('accounts.visaQuarter')}
        value={quarter}
        active={filter === 'quarter'}
        tone="accent"
        onClick={() => onFilter(filter === 'quarter' ? 'all' : 'quarter')}
      />
      <VisaCount
        label={t('accounts.visa.expired')}
        value={expired}
        active={filter === 'expired'}
        tone="danger"
        onClick={() => onFilter(filter === 'expired' ? 'all' : 'expired')}
      />
    </section>
  )
}

function VisaCount({
  label,
  value,
  active,
  tone,
  onClick,
}: {
  label: string
  value: number
  active: boolean
  tone: 'danger' | 'accent'
  onClick: () => void
}) {
  return (
    <button
      type="button"
      className={`ui-card grid gap-1 p-3 text-left ${active ? 'ring-2 ring-accent' : ''}`}
      onClick={onClick}
    >
      <span className="text-xs font-medium text-muted">{label}</span>
      <span className={`text-2xl font-semibold tabular-nums ${tone === 'danger' ? 'text-danger' : 'text-accent'}`}>{value}</span>
    </button>
  )
}

function accountError(t: (key: string) => string, reason: unknown) {
  const code = reason instanceof Error ? reason.message : 'failed'
  const key = `accounts.errors.${code}`
  const message = t(key)
  return message === key ? t('accounts.errors.failed') : message
}
