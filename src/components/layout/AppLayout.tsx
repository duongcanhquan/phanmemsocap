import { useTranslation } from 'react-i18next'
import { PageTitleProvider } from '../../context/PageTitleContext'
import { BottomNav } from './BottomNav'
import { Header } from './Header'
import { MainContent } from './MainContent'
import { Sidebar } from './Sidebar'

export function AppLayout() {
  const { t } = useTranslation()

  return (
    <div className="h-dvh overflow-hidden text-ink">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-3 focus:left-3 focus:z-50 focus:rounded-xl focus:bg-white focus:px-4 focus:py-3 focus:shadow-sm"
      >
        {t('skipToContent')}
      </a>
      <div className="h-full lg:grid lg:grid-cols-[16.5rem_minmax(0,1fr)]">
        <Sidebar />
        <PageTitleProvider>
          <div className="flex h-full min-h-0 min-w-0 flex-col">
            <Header />
            <MainContent />
          </div>
        </PageTitleProvider>
      </div>
      <BottomNav />
    </div>
  )
}
