import { getEmbedUrlFromYoutubeUrl, isValidYoutubeUrl } from '@tiptap/extension-youtube'

/** Strip scripts/handlers; keep only YouTube embeds for iframes. */
export function sanitizeLessonHtml(html: string) {
  if (!html.trim() || typeof DOMParser === 'undefined') return html
  const doc = new DOMParser().parseFromString(html, 'text/html')
  doc.querySelectorAll('script, style, object, embed').forEach((node) => node.remove())
  doc.querySelectorAll('*').forEach((node) => {
    for (const attr of [...node.attributes]) {
      if (attr.name.startsWith('on')) node.removeAttribute(attr.name)
    }
  })
  doc.querySelectorAll('iframe').forEach((frame) => {
    const src = frame.getAttribute('src') ?? ''
    const embed = isValidYoutubeUrl(src) ? getEmbedUrlFromYoutubeUrl({ url: src, nocookie: true, controls: true }) : null
    if (!embed) {
      frame.remove()
      return
    }
    frame.setAttribute('src', embed)
    frame.setAttribute('loading', 'lazy')
    frame.setAttribute('allowfullscreen', '')
  })
  doc.querySelectorAll('[data-example]').forEach((node) => {
    node.setAttribute('role', 'button')
    node.setAttribute('tabindex', '0')
  })
  return doc.body.innerHTML
}
