import type { ReactNode } from 'react'

type PageHeaderProps = {
  title: string
  description?: string
  action?: ReactNode
}

export function PageHeader({ title, description, action }: PageHeaderProps) {
  return (
    <header className="flex flex-col gap-3 px-1 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="ui-title">{title}</h1>
        {description ? <p className="ui-lead">{description}</p> : null}
      </div>
      {action}
    </header>
  )
}
