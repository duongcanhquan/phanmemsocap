export function isSlideDeck(value: string) {
  return value.split(/\n---\n/).filter((slide) => slide.trim()).length > 1
}

export function slideSections(value: string) {
  return value
    .split(/\n---\n/)
    .map((slide) => slide.trim())
    .filter(Boolean)
}

export function markdownToHtml(source: string) {
  const blocks = source.replace(/\r\n/g, '\n').split(/\n{2,}/)
  return blocks.map(renderBlock).join('')
}

function renderBlock(block: string) {
  const lines = block.split('\n').filter((line) => line.trim().length > 0)
  if (lines.length === 0) return ''
  if (lines.every((line) => /^---+$/.test(line.trim()))) return '<hr />'
  if (lines.every((line) => line.trim().startsWith('#'))) {
    return lines
      .map((line) => {
        const level = line.trim().startsWith('###') ? 3 : 2
        const text = line.trim().replace(/^#{1,6}\s*/, '')
        return `<h${level}>${inline(text)}</h${level}>`
      })
      .join('')
  }
  if (lines.every((line) => /^\s*[-*]\s+/.test(line))) {
    const items = lines.map((line) => `<li>${inline(line.replace(/^\s*[-*]\s+/, ''))}</li>`).join('')
    return `<ul>${items}</ul>`
  }
  if (lines.every((line) => /^\s*\d+\.\s+/.test(line))) {
    const items = lines.map((line) => `<li>${inline(line.replace(/^\s*\d+\.\s+/, ''))}</li>`).join('')
    return `<ol>${items}</ol>`
  }
  return `<p>${lines.map((line) => inline(line)).join('<br />')}</p>`
}

function inline(value: string) {
  return escapeHtml(value)
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*]+)\*/g, '<em>$1</em>')
}

function escapeHtml(value: string) {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}
