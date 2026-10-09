import { createContext, useContext, useMemo, useState, type ReactNode } from 'react'

export type PageBack = {
  label: string
  to?: string
  onClick?: () => void
}

interface PageTitleValue {
  title: string
  back: PageBack | null
  setTitle: (title: string) => void
  setBack: (back: PageBack | null) => void
}

const PageTitleContext = createContext<PageTitleValue | null>(null)

export function PageTitleProvider({ children }: { children: ReactNode }) {
  const [title, setTitle] = useState('')
  const [back, setBack] = useState<PageBack | null>(null)
  const value = useMemo(() => ({ title, back, setTitle, setBack }), [title, back])
  return <PageTitleContext.Provider value={value}>{children}</PageTitleContext.Provider>
}

export function usePageTitle() {
  const value = useContext(PageTitleContext)
  if (!value) {
    throw new Error('missing-page-title')
  }
  return value
}
