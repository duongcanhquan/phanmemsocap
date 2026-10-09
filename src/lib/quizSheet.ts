import { emptyLocalized } from './localized'
import type { QuizRecord } from './programs'

const headers = ['Loại', 'Câu hỏi', 'Điểm', 'A', 'B', 'C', 'D', 'Đáp án đúng']

export async function downloadQuizTemplate(): Promise<void> {
  const XLSX = await import('xlsx')
  const table = XLSX.utils.aoa_to_sheet([
    headers,
    ['Trắc nghiệm', 'Điện áp danh định của mạch này là bao nhiêu?', 1, '5 V', '12 V', '24 V', '220 V', 'B'],
    ['Tự luận', 'Nêu trình tự kiểm tra an toàn trước khi cấp nguồn.', 2, '', '', '', '', ''],
  ])
  const book = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(book, table, 'KiemTra')
  XLSX.writeFile(book, 'mau-bai-kiem-tra.xlsx')
}

export async function readQuizSheet(file: File): Promise<QuizRecord[]> {
  const XLSX = await import('xlsx')
  const book = XLSX.read(await file.arrayBuffer(), { type: 'array' })
  const sheet = book.Sheets[book.SheetNames[0] ?? '']
  if (!sheet) return []
  const rows = XLSX.utils.sheet_to_json<(string | number | null)[]>(sheet, { header: 1, raw: false })
  return rows.slice(1).flatMap((row) => {
    const question = String(row[1] ?? '').trim()
    if (!question) return []
    const kind = String(row[0] ?? '').trim().toLowerCase()
    const essay = kind.includes('luận') || kind.includes('luan') || kind === 'essay'
    const points = Math.min(20, Math.max(1, Math.round(Number(row[2]) || 1)))
    const choices = [row[3], row[4], row[5], row[6]].map((cell) => String(cell ?? '').trim()).filter(Boolean)
    const mark = String(row[7] ?? '').trim().toUpperCase()
    const correct = mark === 'B' || mark === '2' ? 1 : mark === 'C' || mark === '3' ? 2 : mark === 'D' || mark === '4' ? 3 : 0
    const options = essay
      ? [emptyLocalized(), emptyLocalized()]
      : [...choices.map((choice) => ({ ...emptyLocalized(), vi: choice })), emptyLocalized(), emptyLocalized()].slice(0, Math.max(choices.length, 2))
    return [{
      id: `new-${crypto.randomUUID()}`,
      question: { ...emptyLocalized(), vi: question },
      options,
      correctOptionIndex: essay ? 0 : Math.min(correct, Math.max(options.length - 1, 0)),
      isEssay: essay,
      points,
    }]
  })
}
