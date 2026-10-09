import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import Reveal, { type RevealApi } from 'reveal.js'
import 'reveal.js/reveal.css'
import 'reveal.js/theme/white.css'
import { markdownToHtml, slideSections } from '../../lib/markdown'

type SlideDeckProps = {
  markdown: string
}

export function SlideDeck({ markdown }: SlideDeckProps) {
  const { t } = useTranslation()
  const rootRef = useRef<HTMLDivElement>(null)
  const deckRef = useRef<RevealApi | null>(null)
  const slides = slideSections(markdown)

  useEffect(() => {
    const root = rootRef.current
    if (!root) return
    const deck = new Reveal(root, {
      embedded: true,
      controls: false,
      progress: true,
      hash: false,
      keyboard: true,
      center: true,
    })
    deckRef.current = deck
    void deck.initialize()
    return () => {
      deckRef.current = null
      deck.destroy()
    }
  }, [markdown])

  return (
    <div className="flex h-full min-h-[70dvh] flex-col overflow-hidden bg-white lg:min-h-[36rem]">
      <div ref={rootRef} className="reveal min-h-0 flex-1">
        <div className="slides">
          {slides.map((slide, index) => (
            <section key={`${index}-${slide.slice(0, 24)}`} dangerouslySetInnerHTML={{ __html: markdownToHtml(slide) }} />
          ))}
        </div>
      </div>
      <div className="flex gap-2 border-t border-line p-2">
        <button type="button" className="ui-btn ui-btn-ghost border border-line flex-1" onClick={() => deckRef.current?.prev()}>
          <ChevronLeft aria-hidden="true" className="size-4" />
          {t('ai.previous')}
        </button>
        <button type="button" className="ui-btn ui-btn-primary flex-1" onClick={() => deckRef.current?.next()}>
          {t('ai.next')}
          <ChevronRight aria-hidden="true" className="size-4" />
        </button>
      </div>
    </div>
  )
}
