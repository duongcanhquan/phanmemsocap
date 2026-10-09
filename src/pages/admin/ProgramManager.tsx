import { Plus } from 'lucide-react'
import { useEffect, useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate } from 'react-router-dom'
import { LocalizedFields } from '../../components/admin/LocalizedFields'
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
      <div className="grid gap-4 sm:grid-cols-2">
        {programs.map((program) => {
          const title = localizedLabel(program.title, i18n.language) || t('programs.untitled')
          return (
            <Link
              key={program.id}
              to={`/programs/${program.id}`}
              className="ui-card grid gap-3 transition duration-200 hover:ring-2 hover:ring-accent"
            >
              {program.coverImageUrl ? (
                <img
                  src={program.coverImageUrl}
                  alt=""
                  className="aspect-video w-full rounded-xl object-cover"
                  loading="lazy"
                />
              ) : (
                <div className="aspect-video w-full rounded-xl bg-canvas" />
              )}
              <h2 className="text-lg font-semibold text-ink">{title}</h2>
              <div className="flex flex-wrap gap-2">
                {program.category ? (
                  <span className="rounded-full bg-canvas px-3 py-1 text-sm font-medium text-ink">{program.category}</span>
                ) : null}
                <span className="rounded-full bg-canvas px-3 py-1 text-sm font-semibold text-ink">
                  {program.isActive ? t('programs.active') : t('programs.inactive')}
                </span>
              </div>
            </Link>
          )
        })}
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
        className="max-h-[90dvh] w-full max-w-xl overflow-y-auto rounded-2xl bg-white p-5 shadow-xl"
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
