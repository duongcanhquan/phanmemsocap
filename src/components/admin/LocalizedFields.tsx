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
  const languages = ['vi', 'my', 'bn'] as const

  return (
    <fieldset className="grid gap-2">
      <legend className="text-sm font-medium text-ink">{label}</legend>
      {languages.map((language) => {
        const fieldId = `${id}-${language}`
        const shared = 'ui-field w-full'
        return (
          <label key={language} className="grid gap-1 text-sm text-muted" htmlFor={fieldId}>
            {t(`languages.${language}`)}
            {multiline ? (
              <textarea
                id={fieldId}
                className={`${shared} min-h-24 py-2`}
                value={value[language]}
                onChange={(event) => onChange({ ...value, [language]: event.target.value })}
              />
            ) : (
              <input
                id={fieldId}
                className={shared}
                value={value[language]}
                onChange={(event) => onChange({ ...value, [language]: event.target.value })}
              />
            )}
          </label>
        )
      })}
    </fieldset>
  )
}
