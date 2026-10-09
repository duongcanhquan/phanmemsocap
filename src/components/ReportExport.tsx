import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { localizedLabel } from '../lib/localized'
import { loadScoreReport, type ScoreCell, type ScoreReport } from '../lib/reports'
import { isSupabaseConfigured } from '../lib/supabase'

type ReportExportProps = {
  programId: string
}

export function ReportExport({ programId }: ReportExportProps) {
  const { t, i18n } = useTranslation()
  const [report, setReport] = useState<ScoreReport | null>(null)
  const [loading, setLoading] = useState(isSupabaseConfigured)
  const [error, setError] = useState('')
  const [exporting, setExporting] = useState<'excel' | 'pdf' | null>(null)

  useEffect(() => {
    if (!isSupabaseConfigured) return
    let active = true
    void loadScoreReport(programId)
      .then((next) => {
        if (active) setReport(next)
      })
      .catch(() => {
        if (active) setError(t('reports.loadError'))
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [programId, t])

  const lessonHeaders =
    report?.lessons.map((lesson, index) => localizedLabel(lesson.title, i18n.language) || t('reports.lesson', { n: index + 1 })) ??
    []
  const programName = report ? localizedLabel(report.programTitle, i18n.language) || t('programs.untitled') : ''

  function cellText(score: ScoreCell) {
    return score === null ? t('reports.emptyScore') : score.toFixed(1)
  }

  async function exportExcel() {
    if (!report) return
    setExporting('excel')
    setError('')
    try {
      const XLSX = await import('xlsx')
      const header = [t('reports.student'), ...lessonHeaders, t('reports.average')]
      const body = report.students.map((student) => [
        student.name || t('enrollment.unnamed'),
        ...student.scores.map((score) => (score === null ? '' : Number(score.toFixed(1)))),
        student.average === null ? '' : Number(student.average.toFixed(1)),
      ])
      const sheet = XLSX.utils.aoa_to_sheet([
        [t('reports.schoolName')],
        [t('reports.className'), programName],
        [t('reports.exportedAt'), new Date().toLocaleDateString(i18n.language)],
        [],
        header,
        ...body,
      ])
      const book = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(book, sheet, 'Diem')
      XLSX.writeFile(book, `bao-cao-${fileDate()}.xlsx`)
    } catch {
      setError(t('reports.exportError'))
    } finally {
      setExporting(null)
    }
  }

  async function exportPdf() {
    if (!report) return
    setExporting('pdf')
    setError('')
    try {
      const [{ jsPDF }, autoTableModule, fontResponse, logo] = await Promise.all([
        import('jspdf'),
        import('jspdf-autotable'),
        fetch('/fonts/NotoSans-Regular.ttf'),
        logoDataUrl(),
      ])
      if (!fontResponse.ok) throw new Error('font')
      const font = arrayBufferToBase64(await fontResponse.arrayBuffer())
      const doc = new jsPDF({ orientation: lessonHeaders.length > 4 ? 'landscape' : 'portrait', unit: 'pt', format: 'a4' })
      doc.addFileToVFS('NotoSans-Regular.ttf', font)
      doc.addFont('NotoSans-Regular.ttf', 'NotoSans', 'normal')
      doc.setFont('NotoSans')
      if (logo) doc.addImage(logo, 'PNG', 40, 32, 28, 28)
      doc.setFontSize(16)
      doc.text(t('reports.schoolName'), 78, 46)
      doc.setFontSize(11)
      doc.text(`${t('reports.className')}: ${programName}`, 78, 64)
      doc.text(`${t('reports.exportedAt')}: ${new Date().toLocaleDateString(i18n.language)}`, 78, 80)
      autoTableModule.default(doc, {
        startY: 100,
        head: [[t('reports.student'), ...lessonHeaders, t('reports.average')]],
        body: report.students.map((student) => [
          student.name || t('enrollment.unnamed'),
          ...student.scores.map(cellText),
          cellText(student.average),
        ]),
        styles: { font: 'NotoSans', fontSize: 9, cellPadding: 4 },
        headStyles: { fillColor: [3, 105, 161], font: 'NotoSans', textColor: 255 },
        margin: { left: 40, right: 40 },
      })
      doc.save(`bao-cao-${fileDate()}.pdf`)
    } catch {
      setError(t('reports.exportError'))
    } finally {
      setExporting(null)
    }
  }

  return (
    <section className="ui-card grid gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex items-center gap-3">
          <img src="/school-mark.svg" alt="" width={40} height={40} className="size-10" />
          <div>
            <h2 className="text-lg font-semibold text-ink">{t('reports.title')}</h2>
            <p className="text-sm text-muted">{programName || t('reports.lead')}</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" className="ui-btn ui-btn-primary" disabled={!report || exporting !== null} onClick={() => void exportExcel()}>
            {exporting === 'excel' ? t('reports.exporting') : t('reports.excel')}
          </button>
          <button type="button" className="ui-btn ui-btn-ghost border border-line" disabled={!report || exporting !== null} onClick={() => void exportPdf()}>
            {exporting === 'pdf' ? t('reports.exporting') : t('reports.pdf')}
          </button>
        </div>
      </div>
      {!isSupabaseConfigured ? <p className="text-sm text-warning">{t('supabase.missing')}</p> : null}
      {loading ? <p role="status">{t('reports.loading')}</p> : null}
      {error ? (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : null}
      {report && report.students.length === 0 ? <p className="text-sm text-muted">{t('reports.empty')}</p> : null}
      {report && report.students.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="w-full min-w-max border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-line text-muted">
                <th className="px-3 py-2 font-medium whitespace-nowrap">{t('reports.student')}</th>
                {report.lessons.map((lesson, index) => (
                  <th key={lesson.id} className="px-3 py-2 font-medium whitespace-nowrap">
                    {lessonHeaders[index]}
                  </th>
                ))}
                <th className="px-3 py-2 font-medium whitespace-nowrap">{t('reports.average')}</th>
              </tr>
            </thead>
            <tbody>
              {report.students.map((student) => (
                <tr key={student.id} className="border-b border-line last:border-0">
                  <td className="px-3 py-2 font-medium whitespace-nowrap text-ink">
                    {student.name || t('enrollment.unnamed')}
                  </td>
                  {student.scores.map((score, index) => (
                    <td key={`${student.id}-${report.lessons[index]?.id ?? index}`} className="px-3 py-2 tabular-nums whitespace-nowrap">
                      {cellText(score)}
                    </td>
                  ))}
                  <td className="px-3 py-2 font-semibold tabular-nums whitespace-nowrap">{cellText(student.average)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </section>
  )
}

function fileDate() {
  return new Date().toISOString().slice(0, 10)
}

function arrayBufferToBase64(buffer: ArrayBuffer) {
  const bytes = new Uint8Array(buffer)
  let binary = ''
  const chunk = 0x2000
  for (let index = 0; index < bytes.length; index += chunk) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunk))
  }
  return btoa(binary)
}

async function logoDataUrl(): Promise<string | null> {
  const response = await fetch('/school-mark.svg')
  if (!response.ok) return null
  const svg = await response.text()
  const blob = new Blob([svg], { type: 'image/svg+xml' })
  const url = URL.createObjectURL(blob)
  try {
    const image = new Image()
    image.src = url
    await image.decode()
    const canvas = document.createElement('canvas')
    canvas.width = 64
    canvas.height = 64
    const context = canvas.getContext('2d')
    if (!context) return null
    context.drawImage(image, 0, 0, 64, 64)
    return canvas.toDataURL('image/png')
  } catch {
    return null
  } finally {
    URL.revokeObjectURL(url)
  }
}
