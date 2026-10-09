export type DocumentSheet = {
  filename: string
  schoolName: string
  title: string
  lines: string[]
  headers: string[]
  rows: (string | number)[][]
}

const logoAspect = 407 / 746

export async function downloadExcel(sheet: DocumentSheet) {
  const XLSX = await import('xlsx')
  const table = XLSX.utils.aoa_to_sheet([
    [sheet.schoolName],
    [sheet.title],
    ...sheet.lines.map((line) => [line]),
    [],
    sheet.headers,
    ...sheet.rows,
  ])
  table['!cols'] = sheet.headers.map((header, index) => {
    const width = Math.max(
      header.length,
      ...sheet.rows.map((row) => String(row[index] ?? '').length),
    )
    return { wch: Math.min(48, Math.max(14, width + 2)) }
  })
  const book = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(book, table, 'BaoCao')
  XLSX.writeFile(book, `${sheet.filename}.xlsx`)
}

export async function downloadPdf(sheet: DocumentSheet) {
  const [{ jsPDF }, autoTableModule, fontResponse, logo] = await Promise.all([
    import('jspdf'),
    import('jspdf-autotable'),
    fetch('/fonts/NotoSans-Regular.ttf'),
    logoDataUrl(),
  ])
  if (!fontResponse.ok) throw new Error('font')
  const font = arrayBufferToBase64(await fontResponse.arrayBuffer())
  const doc = new jsPDF({ orientation: sheet.headers.length > 6 ? 'landscape' : 'portrait', unit: 'pt', format: 'a4' })
  doc.addFileToVFS('NotoSans-Regular.ttf', font)
  doc.addFont('NotoSans-Regular.ttf', 'NotoSans', 'normal')
  doc.setFont('NotoSans')

  const pageWidth = doc.internal.pageSize.getWidth()
  const logoWidth = 210
  const logoHeight = logoWidth * logoAspect
  let cursor = 36
  if (logo) {
    doc.addImage(logo, 'PNG', (pageWidth - logoWidth) / 2, cursor, logoWidth, logoHeight)
    cursor += logoHeight + 14
  }
  doc.setFontSize(13)
  doc.text(sheet.schoolName, pageWidth / 2, cursor, { align: 'center' })
  cursor += 20
  doc.setFontSize(16)
  doc.text(sheet.title, pageWidth / 2, cursor, { align: 'center' })
  cursor += 18
  doc.setFontSize(11)
  for (const line of sheet.lines) {
    const wrapped = doc.splitTextToSize(line, pageWidth - 80) as string[]
    doc.text(wrapped, 40, cursor)
    cursor += wrapped.length * 14 + 2
  }

  autoTableModule.default(doc, {
    startY: cursor + 8,
    head: [sheet.headers],
    body: sheet.rows.map((row) => row.map((cell) => String(cell))),
    styles: { font: 'NotoSans', fontSize: 10, cellPadding: 5, overflow: 'linebreak' },
    headStyles: { fillColor: [3, 105, 161], font: 'NotoSans', textColor: 255 },
    margin: { left: 40, right: 40 },
  })
  doc.save(`${sheet.filename}.pdf`)
}

async function logoDataUrl(): Promise<string | null> {
  const response = await fetch('/logo-vietmy-blue.png')
  if (!response.ok) return null
  const blob = await response.blob()
  return await new Promise((resolve) => {
    const reader = new FileReader()
    reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : null)
    reader.onerror = () => resolve(null)
    reader.readAsDataURL(blob)
  })
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
