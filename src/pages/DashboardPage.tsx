import { BookOpen, GraduationCap, Users } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Card } from '../components/ui/Card'
import { PageHeader } from '../components/ui/PageHeader'
import { isSupabaseConfigured } from '../lib/supabase'

const stats = [
  { labelKey: 'dashboard.learners', valueKey: 'dashboard.emptyValue', icon: Users },
  { labelKey: 'dashboard.courses', valueKey: 'dashboard.emptyValue', icon: BookOpen },
  { labelKey: 'dashboard.classes', valueKey: 'dashboard.emptyValue', icon: GraduationCap },
] as const

export function DashboardPage() {
  const { t } = useTranslation()

  return (
    <div className="ui-page">
      <PageHeader title={t('dashboard.title')} description={t('dashboard.subtitle')} />
      {!isSupabaseConfigured ? (
        <p role="status" className="rounded-2xl bg-warning-bg px-4 py-3 text-sm leading-relaxed text-warning">
          {t('supabase.missing')}
        </p>
      ) : null}
      <div className="grid gap-3 sm:grid-cols-3">
        {stats.map((stat) => {
          const Icon = stat.icon
          return (
            <Card key={stat.labelKey}>
              <div className="flex items-center gap-2 text-sm text-muted">
                <Icon aria-hidden="true" className="size-5 text-accent" />
                <p>{t(stat.labelKey)}</p>
              </div>
              <p className="mt-3 text-3xl font-semibold tracking-tight text-ink tabular-nums">
                {t(stat.valueKey)}
              </p>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
