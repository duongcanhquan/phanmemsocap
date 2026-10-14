import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { isMediaUploadReady, uploadMedia } from '../lib/media'

type MediaFolder = 'lessons' | 'photos' | 'slides' | 'pdfs'

type MediaFieldProps = {
  id: string
  label: string
  value: string
  onChange: (url: string) => void
  onError?: (message: string) => void
  accept: string
  folder: MediaFolder
  hint?: string
  placeholder?: string
  displayName?: string
  uploadName?: string
}

export function MediaField({
  id,
  label,
  value,
  onChange,
  onError,
  accept,
  folder,
  hint,
  placeholder,
  displayName,
  uploadName,
}: MediaFieldProps) {
  const { t } = useTranslation()
  const [pending, setPending] = useState(false)
  const shown = displayName?.trim() || (value ? decodeURIComponent(value.split('/').pop() || '') : '')

  async function onFile(file: File | undefined) {
    if (!file) return
    if (!isMediaUploadReady()) {
      onError?.(t('editor.storageMissing'))
      return
    }
    setPending(true)
    try {
      onChange(await uploadMedia(file, folder, uploadName || displayName))
    } catch (reason) {
      onError?.(reason instanceof Error && reason.message === 'storage-missing' ? t('editor.storageMissing') : t('editor.uploadError'))
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="grid gap-2">
      <label className="grid gap-1 text-sm font-medium text-ink" htmlFor={id}>
        {label}
        <input
          id={id}
          className="ui-field"
          type="url"
          value={value}
          placeholder={placeholder || t('programs.contentUrl')}
          onChange={(event) => onChange(event.target.value)}
        />
      </label>
      <div className="flex flex-wrap items-center gap-2">
        <label className="ui-inline ui-btn-ghost cursor-pointer">
          <input className="sr-only" type="file" accept={accept} disabled={pending} onChange={(event) => void onFile(event.target.files?.[0])} />
          {pending ? t('editor.uploading') : value ? t('programs.replaceFile') : t('programs.uploadFile')}
        </label>
        {value ? (
          <button type="button" className="ui-inline ui-btn-ghost" onClick={() => onChange('')}>
            {t('programs.clearFile')}
          </button>
        ) : null}
        {shown ? <span className="max-w-56 truncate text-xs text-muted">{shown}</span> : null}
      </div>
      {hint ? <p className="text-xs text-muted">{hint}</p> : null}
    </div>
  )
}
