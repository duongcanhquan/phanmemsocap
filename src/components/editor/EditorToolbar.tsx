import type { Editor } from '@tiptap/core'
import type { ReactNode } from 'react'
import {
  Bold,
  Heading2,
  Heading3,
  ImagePlus,
  Italic,
  List,
  ListOrdered,
  Sparkles,
  Video,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'

type EditorToolbarProps = {
  editor: Editor
  active: {
    bold: boolean
    italic: boolean
    heading2: boolean
    heading3: boolean
    bullet: boolean
    ordered: boolean
    example: boolean
  }
  uploading: boolean
  onImage: () => void
  onYoutube: () => void
  onExample: () => void
}

type ToolButtonProps = {
  label: string
  pressed?: boolean
  disabled?: boolean
  onClick: () => void
  children: ReactNode
}

function ToolButton({ label, pressed = false, disabled = false, onClick, children }: ToolButtonProps) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={pressed}
      disabled={disabled}
      title={label}
      onClick={onClick}
      className={[
        'inline-flex h-11 shrink-0 cursor-pointer items-center gap-1.5 rounded-xl px-3 text-sm font-medium transition-colors duration-200',
        pressed ? 'bg-ink text-white' : 'text-ink hover:bg-canvas',
        'disabled:cursor-not-allowed disabled:opacity-50',
      ].join(' ')}
    >
      {children}
    </button>
  )
}

export function EditorToolbar({
  editor,
  active,
  uploading,
  onImage,
  onYoutube,
  onExample,
}: EditorToolbarProps) {
  const { t } = useTranslation()

  return (
    <div className="flex gap-1 overflow-x-auto border-b border-line p-2" role="toolbar" aria-label={t('editor.toolbar')}>
      <ToolButton
        label={t('editor.bold')}
        pressed={active.bold}
        onClick={() => editor.chain().focus().toggleBold().run()}
      >
        <Bold aria-hidden="true" className="size-4" />
        <span className="hidden sm:inline">{t('editor.bold')}</span>
      </ToolButton>
      <ToolButton
        label={t('editor.italic')}
        pressed={active.italic}
        onClick={() => editor.chain().focus().toggleItalic().run()}
      >
        <Italic aria-hidden="true" className="size-4" />
        <span className="hidden sm:inline">{t('editor.italic')}</span>
      </ToolButton>
      <ToolButton
        label={t('editor.heading2')}
        pressed={active.heading2}
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
      >
        <Heading2 aria-hidden="true" className="size-4" />
        <span className="hidden sm:inline">{t('editor.heading')}</span>
      </ToolButton>
      <ToolButton
        label={t('editor.heading3')}
        pressed={active.heading3}
        onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
      >
        <Heading3 aria-hidden="true" className="size-4" />
      </ToolButton>
      <ToolButton
        label={t('editor.bullet')}
        pressed={active.bullet}
        onClick={() => editor.chain().focus().toggleBulletList().run()}
      >
        <List aria-hidden="true" className="size-4" />
      </ToolButton>
      <ToolButton
        label={t('editor.ordered')}
        pressed={active.ordered}
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
      >
        <ListOrdered aria-hidden="true" className="size-4" />
      </ToolButton>
      <ToolButton label={t('editor.image')} disabled={uploading} onClick={onImage}>
        <ImagePlus aria-hidden="true" className="size-4" />
        <span className="hidden sm:inline">{t('editor.image')}</span>
      </ToolButton>
      <ToolButton label={t('editor.youtube')} onClick={onYoutube}>
        <Video aria-hidden="true" className="size-4" />
        <span className="hidden sm:inline">{t('editor.youtube')}</span>
      </ToolButton>
      <ToolButton label={active.example ? t('editor.removeExample') : t('editor.example')} pressed={active.example} onClick={onExample}>
        <Sparkles aria-hidden="true" className="size-4" />
        <span className="hidden md:inline">{active.example ? t('editor.removeExample') : t('editor.example')}</span>
      </ToolButton>
    </div>
  )
}
