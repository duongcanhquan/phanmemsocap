import { Plus } from 'lucide-react'
import { useEffect, useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate } from 'react-router-dom'
import { LocalizedFields } from '../../components/admin/LocalizedFields'
import { ExportButtons } from '../../components/ExportButtons'
import { DataTable, FilterBar, SelectFilter } from '../../components/ui/DataSheet'
import { PageHeader } from '../../components/ui/PageHeader'
import { emptyLocalized, hasLocalizedText, localizedLabel, type LocalizedText } from '../../lib/localized'
import { createProgram, listPrograms, type ProgramRecord } from '../../lib/programs'
import { isSupabaseConfigured } from '../../lib/supabase'

export function ProgramManager() {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  const [programs, setPrograms] = useState<ProgramRecord[]>([])
  const [loading, setLoading] = useState(isSupabaseConfigured)
  const [error, setError] = useState('')
  const [creating, setCreating] = useState(false)
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState('all')
  const [category, setCategory] = useState('all')

  useEffect(() => {
    if (!isSupabaseConfigured) return
    let active = true
    void listPrograms()
      .then((rows) => {
        if (active) setPrograms(rows)
      })
      .catch(() => {
        if (active) setError(t('programs.loadError'))
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [t])

  const categories = [...new Set(programs.map((program) => program.category).filter(Boolean))]
  const visiblePrograms = programs.filter((program) => {
    const title = localizedLabel(program.title, i18n.language).toLowerCase()
    const matchesQuery = `${title} ${program.category}`.toLowerCase().includes(query.trim().toLowerCase())
    const matchesStatus = status === 'all' || (status === 'active' ? program.isActive : !program.isActive)
    const matchesCategory = category === 'all' || program.category === category
    return matchesQuery && matchesStatus && matchesCategory
  })

  return (
    <div className="ui-page">
      <PageHeader
        title={t('programs.title')}
        description={t('programs.lead')}
        action={
          <button type="button" className="ui-btn ui-btn-primary" onClick={() => setCreating(true)}>
            <Plus aria-hidden="true" className="size-4" />
            {t('programs.create')}
          </button>
        }
      />
      {!isSupabaseConfigured ? (
        <p role="status" className="rounded-2xl bg-warning-bg px-4 py-3 text-sm text-warning">
          {t('supabase.missing')}
        </p>
      ) : null}
      {loading ? <p role="status">{t('programs.loading')}</p> : null}
      {error ? (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : null}
      {!loading && programs.length === 0 && isSupabaseConfigured ? (
        <p className="text-muted">{t('programs.empty')}</p>
      ) : null}
      <div className="ui-fill">
        <FilterBar query={query} onQuery={setQuery} count={visiblePrograms.length}>
          <SelectFilter
            id="program-category"
            label={t('filters.category')}
            value={category}
            onChange={setCategory}
            options={[{ value: 'all', label: t('filters.all') }, ...categories.map((item) => ({ value: item, label: item }))]}
          />
          <SelectFilter
            id="program-status"
            label={t('filters.status')}
            value={status}
            onChange={setStatus}
            options={[
              { value: 'all', label: t('filters.all') },
              { value: 'active', label: t('programs.active') },
              { value: 'inactive', label: t('programs.inactive') },
            ]}
          />
        </FilterBar>
        {programs.length > 0 && visiblePrograms.length === 0 ? <p className="text-muted">{t('filters.noMatch')}</p> : null}
        <div className="mb-3 flex justify-end">
          <ExportButtons
            filename="khoa-hoc"
            title={t('programs.title')}
            headers={[t('programs.name'), t('programs.category'), t('filters.status')]}
            rows={visiblePrograms.map((program) => [
              localizedLabel(program.title, i18n.language) || t('programs.untitled'),
              program.category || '—',
              program.isActive ? t('programs.active') : t('programs.inactive'),
            ])}
          />
        </div>
        <DataTable>
          <thead>
            <tr>
              <th>{t('programs.name')}</th>
              <th>{t('programs.category')}</th>
              <th>{t('filters.status')}</th>
              <th>{t('teacher.action')}</th>
            </tr>
          </thead>
          <tbody>
            {visiblePrograms.map((program) => {
              const title = localizedLabel(program.title, i18n.language) || t('programs.untitled')
              return (
                <tr key={program.id}>
                  <td className="font-semibold text-ink">{title}</td>
                  <td>{program.category || '—'}</td>
                  <td>{program.isActive ? t('programs.active') : t('programs.inactive')}</td>
                  <td>
                    <Link to={`/programs/${program.id}`} className="ui-inline ui-btn-primary">
                      {t('classesPage.manage')}
                    </Link>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </DataTable>
      </div>
      {creating ? (
        <CreateProgramDialog
          onClose={() => setCreating(false)}
          onCreated={(id) => navigate(`/programs/${id}`)}
        />
      ) : null}
    </div>
  )
}

function CreateProgramDialog({ onClose, onCreated }: { onClose: () => void; onCreated: (id: string) => void }) {
  const { t } = useTranslation()
  const [title, setTitle] = useState<LocalizedText>(emptyLocalized())
  const [description, setDescription] = useState<LocalizedText>(emptyLocalized())
  const [category, setCategory] = useState('')
  const [coverImageUrl, setCoverImageUrl] = useState('')
  const [isActive, setIsActive] = useState(true)
  const [error, setError] = useState('')
  const [pending, setPending] = useState(false)

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    if (!hasLocalizedText(title)) {
      setError(t('programs.titleRequired'))
      return
    }
    setPending(true)
    try {
      const id = await createProgram({ title, description, category, coverImageUrl, isActive })
      onCreated(id)
    } catch {
      setError(t('programs.saveError'))
      setPending(false)
    }
  }

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-ink/40 p-4 sm:items-center">
      <form
        role="dialog"
        aria-modal="true"
        aria-labelledby="create-program-title"
        className="ui-card max-h-[90dvh] w-full max-w-xl overflow-y-auto"
        onSubmit={(event) => void onSubmit(event)}
      >
        <h2 id="create-program-title" className="text-lg font-semibold">
          {t('programs.create')}
        </h2>
        <div className="mt-4 grid gap-4">
          <LocalizedFields id="new-title" label={t('programs.name')} value={title} onChange={setTitle} />
          <LocalizedFields
            id="new-description"
            label={t('programs.description')}
            value={description}
            onChange={setDescription}
            multiline
          />
          <label className="grid gap-1 text-sm font-medium" htmlFor="new-category">
            {t('programs.category')}
            <input id="new-category" className="ui-field" value={category} onChange={(event) => setCategory(event.target.value)} />
          </label>
          <label className="grid gap-1 text-sm font-medium" htmlFor="new-cover">
            {t('programs.cover')}
            <input
              id="new-cover"
              className="ui-field"
              value={coverImageUrl}
              onChange={(event) => setCoverImageUrl(event.target.value)}
            />
          </label>
          <label className="flex min-h-11 items-center gap-2 text-sm font-medium">
            <input type="checkbox" checked={isActive} onChange={(event) => setIsActive(event.target.checked)} />
            {t('programs.active')}
          </label>
          {error ? (
            <p role="alert" className="text-sm text-danger">
              {error}
            </p>
          ) : null}
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" className="ui-btn ui-btn-ghost border border-line" onClick={onClose}>
            {t('programs.cancel')}
          </button>
          <button type="submit" className="ui-btn ui-btn-primary" disabled={pending}>
            {pending ? t('programs.saving') : t('programs.save')}
          </button>
        </div>
      </form>
    </div>
  )
}
