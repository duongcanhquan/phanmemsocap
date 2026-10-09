import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { downloadExcel, downloadPdf, type DocumentSheet } from '../lib/documents'

type ExportButtonsProps = {
  filename: string
  title: string
  lines?: string[]
  headers: string[]
  rows: (string | number)[][]
  disabled?: boolean
}

export function ExportButtons({ filename, title, lines = [], headers, rows, disabled = false }: ExportButtonsProps) {
  const { t } = useTranslation()
  const [exporting, setExporting] = useState<'excel' | 'pdf' | null>(null)
  const [error, setError] = useState('')

  async function run(kind: 'excel' | 'pdf') {
    setExporting(kind)
    setError('')
    const sheet: DocumentSheet = {
      filename,
      schoolName: t('brand.school'),
      title,
      lines: [...lines, `${t('reports.exportedAt')}: ${new Date().toLocaleDateString()}`],
      headers,
      rows,
    }
    try {
      if (kind === 'excel') await downloadExcel(sheet)
      else await downloadPdf(sheet)
    } catch {
      setError(t('reports.exportError'))
    } finally {
      setExporting(null)
    }
  }

  return (
    <div className="flex shrink-0 flex-wrap items-center gap-2">
      <button type="button" className="ui-inline ui-btn-primary" disabled={disabled || exporting !== null} onClick={() => void run('excel')}>
        {exporting === 'excel' ? t('reports.exporting') : t('reports.excel')}
      </button>
      <button type="button" className="ui-inline ui-btn-ghost" disabled={disabled || exporting !== null} onClick={() => void run('pdf')}>
        {exporting === 'pdf' ? t('reports.exporting') : t('reports.pdf')}
      </button>
      {error ? (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : null}
    </div>
  )
}
