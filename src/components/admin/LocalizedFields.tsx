import { useTranslation } from 'react-i18next'
import type { LocalizedText } from '../../lib/localized'

type LocalizedFieldsProps = {
  id: string
  label: string
  value: LocalizedText
  onChange: (value: LocalizedText) => void
  multiline?: boolean
}

export function LocalizedFields({ id, label, value, onChange, multiline = false }: LocalizedFieldsProps) {
  const { t } = useTranslation()
  const shared = 'ui-field w-full'

  return (
    <label className="grid gap-1 text-sm font-medium text-ink" htmlFor={id}>
      {label}
      {multiline ? (
        <textarea
          id={id}
          className={`${shared} min-h-24 py-2`}
          value={value.vi}
          onChange={(event) => onChange({ ...value, vi: event.target.value })}
        />
      ) : (
        <input
          id={id}
          className={shared}
          value={value.vi}
          onChange={(event) => onChange({ ...value, vi: event.target.value })}
        />
      )}
      <span className="text-sm font-normal text-muted">{t('content.authorNote')}</span>
    </label>
  )
}
