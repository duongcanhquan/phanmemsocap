import { useEffect, useRef } from 'react'
import { Outlet, useLocation } from 'react-router-dom'

export function MainContent() {
  const location = useLocation()
  const mainRef = useRef<HTMLElement>(null)

  useEffect(() => {
    mainRef.current?.focus()
  }, [location.pathname])

  const editor = location.pathname === '/lessons'

  return (
    <main
      id="main-content"
      ref={mainRef}
      tabIndex={-1}
      className={
        editor
          ? 'flex min-h-0 min-w-0 flex-1 flex-col px-3 py-3 pb-[calc(5.5rem+env(safe-area-inset-bottom))] outline-none lg:px-4 lg:pb-4'
          : 'min-w-0 flex-1 px-4 py-5 pb-[calc(5.5rem+env(safe-area-inset-bottom))] outline-none sm:px-6 lg:pb-8'
      }
    >
      <Outlet />
    </main>
  )
}
