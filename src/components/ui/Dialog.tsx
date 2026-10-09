import { X } from 'lucide-react'
import { useEffect, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

type DialogProps = {
  title: string
  onClose: () => void
  children: ReactNode
}

export function Dialog({ title, onClose, children }: DialogProps) {
  const { t } = useTranslation()

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="ui-dialog-backdrop" onMouseDown={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="sheet-dialog-title"
        className="ui-dialog"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="ui-dialog-head">
          <h2 id="sheet-dialog-title" className="text-xl font-semibold tracking-tight">
            {title}
          </h2>
          <button type="button" className="ui-inline ui-btn-ghost" onClick={onClose}>
            <X aria-hidden="true" className="size-4" />
            {t('teacher.close')}
          </button>
        </header>
        <div className="ui-dialog-body">{children}</div>
      </div>
    </div>
  )
}
