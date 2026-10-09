import { useEffect, type ReactNode } from 'react'
import { usePageTitle, type PageBack } from '../../context/PageTitleContext'

interface PageHeaderProps {
  title: string
  action?: ReactNode
  back?: PageBack
}

export function PageHeader({ title, action, back }: PageHeaderProps) {
  const { setTitle, setBack } = usePageTitle()
  const backTo = back?.to ?? ''
  const backLabel = back?.label ?? ''
  const backClick = back?.onClick

  useEffect(() => {
    setTitle(title)
    setBack(backLabel ? { label: backLabel, to: backTo || undefined, onClick: backClick } : null)
    return () => {
      setTitle('')
      setBack(null)
    }
  }, [setTitle, setBack, title, backTo, backLabel, backClick])

  if (!action) return null

  return <div className="flex shrink-0 items-center justify-end gap-2">{action}</div>
}
