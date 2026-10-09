import { useTranslation } from 'react-i18next'
import { Card } from '../components/ui/Card'
import { PageHeader } from '../components/ui/PageHeader'

type PlaceholderPageProps = {
  titleKey: string
  descriptionKey: string
}

export function PlaceholderPage({ titleKey, descriptionKey }: PlaceholderPageProps) {
  const { t } = useTranslation()

  return (
    <div className="ui-page">
      <PageHeader title={t(titleKey)} />
      <Card>
        <p className="max-w-2xl text-base leading-relaxed text-muted">{t(descriptionKey)}</p>
      </Card>
    </div>
  )
}
