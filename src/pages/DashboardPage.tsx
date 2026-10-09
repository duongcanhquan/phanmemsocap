import { BookOpen, GraduationCap, Users } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { Card } from '../components/ui/Card'
import { PageHeader } from '../components/ui/PageHeader'
import { useAuth } from '../hooks/useAuth'
import { isSchoolAdmin } from '../lib/roles'
import { isSupabaseConfigured, supabase } from '../lib/supabase'

const stats = [
  { labelKey: 'dashboard.learners', icon: Users, href: '/accounts' },
  { labelKey: 'dashboard.courses', icon: BookOpen, href: '/programs' },
  { labelKey: 'dashboard.classes', icon: GraduationCap, href: '/classes' },
] as const

export function DashboardPage() {
  const { t } = useTranslation()
  const { role } = useAuth()
  const linked = isSchoolAdmin(role)
  const [counts, setCounts] = useState<[number, number, number] | null>(null)

  useEffect(() => {
    if (!supabase) return
    let active = true
    void Promise.all([
      supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'student'),
      supabase.from('programs').select('id', { count: 'exact', head: true }),
      supabase.from('programs').select('id', { count: 'exact', head: true }),
    ]).then((results) => {
      if (!active) return
      setCounts(results.map((result) => result.count ?? 0) as [number, number, number])
    })
    return () => {
      active = false
    }
  }, [])

  return (
    <div className="ui-page">
      <PageHeader title={t('dashboard.title')} description={t('dashboard.subtitle')} />
      {!isSupabaseConfigured ? (
        <p role="status" className="rounded-2xl bg-warning-bg px-4 py-3 text-sm leading-relaxed text-warning">
          {t('supabase.missing')}
        </p>
      ) : null}
      <div className="grid gap-3 sm:grid-cols-3">
        {stats.map((stat, index) => {
          const Icon = stat.icon
          const card = (
            <Card>
              <div className="flex items-center gap-2 text-sm text-muted">
                <Icon aria-hidden="true" className="size-5 text-accent" />
                <p>{t(stat.labelKey)}</p>
              </div>
              <p className="mt-3 text-3xl font-semibold tracking-tight text-ink tabular-nums">
                {counts ? counts[index] : t('dashboard.emptyValue')}
              </p>
            </Card>
          )
          return linked ? (
            <Link key={stat.labelKey} to={stat.href} className="block">{card}</Link>
          ) : (
            <div key={stat.labelKey}>{card}</div>
          )
        })}
      </div>
    </div>
  )
}
