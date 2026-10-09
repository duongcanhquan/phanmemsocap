import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

type FilterBarProps = {
  query: string
  onQuery: (value: string) => void
  count: number
  children?: ReactNode
}

export function FilterBar({ query, onQuery, count, children }: FilterBarProps) {
  const { t } = useTranslation()

  return (
    <div className="mb-3 flex flex-wrap items-center gap-2">
      <label className="flex min-w-0 w-full flex-1 items-center gap-2 text-sm font-medium text-ink sm:min-w-72 sm:w-auto">
        <span className="shrink-0">{t('filters.search')}</span>
        <input
          className="ui-field min-w-0 flex-1"
          value={query}
          onChange={(event) => onQuery(event.target.value)}
        />
      </label>
      {children}
      <p className="shrink-0 rounded-full bg-white/50 px-3 py-2 text-sm font-medium text-ink">
        {t('filters.count', { count })}
      </p>
    </div>
  )
}

type SelectFilterProps = {
  id: string
  label: string
  value: string
  onChange: (value: string) => void
  options: { value: string; label: string }[]
}

export function SelectFilter({ id, label, value, onChange, options }: SelectFilterProps) {
  return (
    <label className="flex shrink-0 items-center gap-2 text-sm font-medium text-ink" htmlFor={id}>
      <span>{label}</span>
      <select id={id} className="ui-field w-auto pr-8" value={value} onChange={(event) => onChange(event.target.value)}>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  )
}

export function DataTable({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={`ui-card overflow-auto p-0 ${className}`}>
      <table className="ui-grid">{children}</table>
    </div>
  )
}
