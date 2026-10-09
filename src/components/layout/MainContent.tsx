import { useEffect, useRef } from 'react'
import { Outlet, useLocation } from 'react-router-dom'

export function MainContent() {
  const location = useLocation()
  const mainRef = useRef<HTMLElement>(null)

  useEffect(() => {
    mainRef.current?.focus()
  }, [location.pathname])

  return (
    <main
      id="main-content"
      ref={mainRef}
      tabIndex={-1}
      className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden px-3 py-3 pb-[calc(5.5rem+env(safe-area-inset-bottom))] outline-none sm:px-4 lg:px-5 lg:pb-4"
    >
      <Outlet />
    </main>
  )
}
