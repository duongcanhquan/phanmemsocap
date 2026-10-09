import type { ReactNode } from 'react'

type PageHeaderProps = {
  title: string
  description?: string
  action?: ReactNode
}

export function PageHeader({ title, description, action }: PageHeaderProps) {
  return (
    <header className="flex shrink-0 items-center justify-between gap-3">
      <div className="min-w-0">
        <h1 className="ui-title">{title}</h1>
        {description ? <p className="ui-lead">{description}</p> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </header>
  )
}
