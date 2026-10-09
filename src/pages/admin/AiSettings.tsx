import { Component, useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { PageHeader } from '../../components/ui/PageHeader'
import { Tabs } from '../../components/ui/Tabs'
import { aiCatalog, listAiConnections, saveAiConnection, type AiConnection, type AiProvider } from '../../lib/ai'
import { isSupabaseConfigured } from '../../lib/supabase'

export function AiSettings() {
  const { t } = useTranslation()
  return (
    <SettingsBoundary message={t('aiSettings.errors.failed')}>
      <AiSettingsScreen />
    </SettingsBoundary>
  )
}

function AiSettingsScreen() {
  const { t } = useTranslation()
  const [connections, setConnections] = useState<AiConnection[]>([])
  const [loading, setLoading] = useState(isSupabaseConfigured)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [provider, setProvider] = useState<AiProvider>('openai')

  useEffect(() => {
    if (!isSupabaseConfigured) return
    let active = true
    void listAiConnections()
      .then((rows) => {
        if (active) setConnections(rows)
      })
      .catch((reason: unknown) => {
        if (active) setError(aiError(t, reason))
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
      <PageHeader title={t('aiSettings.title')} />
      <p className="rounded-2xl bg-canvas px-4 py-3 text-sm leading-relaxed text-ink">{t('aiSettings.lead')}</p>
      {loading ? <p role="status">{t('aiSettings.loading')}</p> : null}
      {notice ? <p role="status" className="text-sm font-medium text-accent">{notice}</p> : null}
      {error ? <p role="alert" className="text-sm text-danger">{error}</p> : null}
      <Tabs
        label={t('panels.label')}
        value={provider}
        onChange={(id) => setProvider(id as AiProvider)}
        tabs={aiCatalog.map((item) => ({ id: item.provider, label: t(item.labelKey) }))}
      />
      <div className="ui-fill">
        {aiCatalog.filter((item) => item.provider === provider).map((item) => {
          const connection = connections.find((row) => row.provider === item.provider)
          const models = connection?.models ?? []
          return (
          <ProviderCard
            key={`${item.provider}:${connection?.enabled}:${models.join(',')}:${connection?.hasKey}`}
            provider={item.provider}
            label={t(item.labelKey)}
            models={item.models}
            connection={connection}
            onSaved={(rows) => {
              setConnections(rows)
              setNotice(t('aiSettings.saved'))
              setError('')
            }}
            onError={(message) => setError(message)}
          />
          )
        })}
      </div>
    </div>
  )
}

class SettingsBoundary extends Component<{ children: ReactNode; message: string }, { failed: boolean }> {
  state = { failed: false }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  render() {
    if (this.state.failed) return <p role="alert" className="px-1 text-sm text-danger">{this.props.message}</p>
    return this.props.children
  }
}

function ProviderCard({
  provider,
  label,
  models,
  connection,
  onSaved,
  onError,
}: {
  provider: AiProvider
  label: string
  models: readonly { id: string; label: string }[]
  connection: AiConnection | undefined
  onSaved: (rows: AiConnection[]) => void
  onError: (message: string) => void
}) {
  const { t } = useTranslation()
  const [apiKey, setApiKey] = useState('')
  const [enabled, setEnabled] = useState(connection?.enabled ?? false)
  const [selected, setSelected] = useState<string[]>(connection?.models ?? [])
  const [pending, setPending] = useState(false)

  function toggle(model: string) {
    setSelected((current) => (current.includes(model) ? current.filter((item) => item !== model) : [...current, model]))
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    setPending(true)
    try {
      onSaved(await saveAiConnection({ provider, apiKey, enabled, models: selected }))
      setApiKey('')
    } catch (reason) {
      onError(aiError(t, reason))
    } finally {
      setPending(false)
    }
  }

  return (
    <form className="ui-card grid gap-3" onSubmit={(event) => void onSubmit(event)}>
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-ink">{label}</h2>
        <label className="flex items-center gap-2 text-sm font-medium text-ink">
          <input type="checkbox" checked={enabled} onChange={(event) => setEnabled(event.target.checked)} />
          {t('aiSettings.enabled')}
        </label>
      </div>
      <p className="text-sm text-muted">
        {connection?.hasKey ? t('aiSettings.keySaved', { hint: connection.keyHint }) : t('aiSettings.keyMissing')}
      </p>
      <label className="grid gap-1 text-sm font-medium text-ink" htmlFor={`${provider}-key`}>
        {t('aiSettings.apiKey')}
        <input
          id={`${provider}-key`}
          className="ui-field"
          type="password"
          autoComplete="off"
          value={apiKey}
          placeholder={connection?.hasKey ? connection.keyHint : ''}
          onChange={(event) => setApiKey(event.target.value)}
        />
      </label>
      <fieldset className="flex gap-4 overflow-x-auto">
        <legend className="text-sm font-medium text-ink">{t('aiSettings.models')}</legend>
        {models.map((model) => (
          <label key={model.id} className="flex shrink-0 items-center gap-2 text-sm whitespace-nowrap text-ink">
            <input type="checkbox" checked={selected.includes(model.id)} onChange={() => toggle(model.id)} />
            {model.label}
          </label>
        ))}
      </fieldset>
      <button type="submit" className="ui-btn ui-btn-primary w-full sm:w-fit" disabled={pending}>
        {pending ? t('aiSettings.saving') : t('aiSettings.save')}
      </button>
    </form>
  )
}

function aiError(t: (key: string) => string, reason: unknown) {
  const code = reason instanceof Error ? reason.message : 'failed'
  const key = `aiSettings.errors.${code}`
  const message = t(key)
  return message === key ? t('aiSettings.errors.failed') : message
}
