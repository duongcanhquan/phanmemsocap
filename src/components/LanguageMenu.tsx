import { Check, Languages } from 'lucide-react'
import { useEffect, useId, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { isAppLanguage, supportedLanguages, type AppLanguage } from '../lib/i18n'

export function LanguageMenu() {
  const { t, i18n } = useTranslation()
  const menuId = useId()
  const rootRef = useRef<HTMLDivElement>(null)
  const [isOpen, setIsOpen] = useState(false)
  const currentLanguage = isAppLanguage(i18n.language.split('-')[0]) ? (i18n.language.split('-')[0] as AppLanguage) : 'vi'

  useEffect(() => {
    if (!isOpen) {
      return
    }

    function onPointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsOpen(false)
      }
    }

    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [isOpen])

  function chooseLanguage(language: AppLanguage) {
    void i18n.changeLanguage(language)
    setIsOpen(false)
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        className="ui-btn ui-btn-ghost border border-line shadow-sm"
        aria-haspopup="menu"
        aria-expanded={isOpen}
        aria-controls={menuId}
        onClick={() => setIsOpen((open) => !open)}
      >
        <Languages aria-hidden="true" className="size-4" />
        {t(`languages.${currentLanguage}`)}
      </button>
      {isOpen ? (
        <ul
          id={menuId}
          role="menu"
          aria-label={t('header.language')}
          className="absolute top-12 right-0 z-30 min-w-44 rounded-2xl border border-line bg-surface p-1 shadow-xl"
        >
          {supportedLanguages.map((language) => {
            const isSelected = language === currentLanguage
            return (
              <li key={language} role="none">
                <button
                  type="button"
                  role="menuitemradio"
                  aria-checked={isSelected}
                  className="flex h-11 w-full cursor-pointer items-center justify-between gap-3 rounded-xl px-3 text-sm text-ink hover:bg-canvas"
                  onClick={() => chooseLanguage(language)}
                >
                  {t(`languages.${language}`)}
                  {isSelected ? <Check aria-hidden="true" className="size-4 text-accent" /> : null}
                </button>
              </li>
            )
          })}
        </ul>
      ) : null}
    </div>
  )
}
