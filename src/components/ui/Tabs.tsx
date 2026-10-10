import type { ReactNode } from 'react'

type TabItem = {
  id: string
  label: string
  icon?: ReactNode
}

type TabsProps = {
  label: string
  tabs: TabItem[]
  value: string
  onChange: (id: string) => void
}

export function Tabs({ label, tabs, value, onChange }: TabsProps) {
  return (
    <div role="tablist" aria-label={label} className="flex shrink-0 gap-2 overflow-x-auto">
      {tabs.map((tab) => {
        const selected = tab.id === value
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={selected}
            className={selected ? 'ui-btn ui-btn-primary shrink-0' : 'ui-btn ui-btn-ghost shrink-0'}
            onClick={() => onChange(tab.id)}
          >
            <span className="inline-flex items-center gap-2">
              {tab.icon}
              {tab.label}
            </span>
          </button>
        )
      })}
    </div>
  )
}
