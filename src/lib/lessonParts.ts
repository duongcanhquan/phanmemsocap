export type LessonParts = {
  theory: string
  reference: string
  exercise: string
}

const referenceHeading = /tham khảo|tài liệu|đọc thêm|reference|further/i
const exerciseHeading = /bài tập|luyện tập|thực hành|exercise|practice/i

export function splitLessonHtml(html: string): LessonParts {
  const parts: LessonParts = { theory: '', reference: '', exercise: '' }
  if (!html.trim() || typeof DOMParser === 'undefined') {
    parts.theory = html
    return parts
  }
  const doc = new DOMParser().parseFromString(html, 'text/html')
  let bucket: keyof LessonParts = 'theory'
  const bins: Record<keyof LessonParts, HTMLElement> = {
    theory: doc.createElement('div'),
    reference: doc.createElement('div'),
    exercise: doc.createElement('div'),
  }
  for (const node of [...doc.body.childNodes]) {
    if (node instanceof HTMLElement && /^h[1-3]$/i.test(node.tagName)) {
      const label = node.textContent ?? ''
      if (referenceHeading.test(label)) bucket = 'reference'
      else if (exerciseHeading.test(label)) bucket = 'exercise'
    }
    bins[bucket].appendChild(node)
  }
  parts.theory = bins.theory.innerHTML.trim()
  parts.reference = bins.reference.innerHTML.trim()
  parts.exercise = bins.exercise.innerHTML.trim()
  if (!parts.theory && !parts.reference && !parts.exercise) parts.theory = html
  return parts
}
