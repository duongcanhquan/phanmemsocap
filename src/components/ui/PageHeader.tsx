import type { ReactNode } from 'react'

type PageHeaderProps = {
  title: string
  action?: ReactNode
}

export function PageHeader({ title, action }: PageHeaderProps) {
  return (
    <header className="flex shrink-0 items-center justify-between gap-3">
      <h1 className="ui-title min-w-0">{title}</h1>
      {action ? <div className="flex shrink-0 items-center gap-2">{action}</div> : null}
    </header>
  )
}
