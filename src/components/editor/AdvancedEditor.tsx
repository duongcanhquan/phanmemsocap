import type { JSONContent } from '@tiptap/core'
import Image from '@tiptap/extension-image'
import { isValidYoutubeUrl } from '@tiptap/extension-youtube'
import Youtube from '@tiptap/extension-youtube'
import { EditorContent, useEditor, useEditorState } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { useEffect, useMemo, useRef, useState, type RefObject } from 'react'
import { markdownToHtml } from '../../lib/markdown'
import { useTranslation } from 'react-i18next'
import { isR2Configured, uploadToR2 } from '../../lib/r2'
import { EditorToolbar } from './EditorToolbar'
import { ExampleMark, type ExampleAttrs, type ExampleMediaType } from './example-mark'

const maxImageBytes = 8 * 1024 * 1024
const imageTypes = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif'])

export type AdvancedEditorHandle = {
  getText: () => string
  getHTML: () => string
  insertMarkdown: (markdown: string) => void
}

type AdvancedEditorProps = {
  mode?: 'teacher' | 'student'
  content?: JSONContent | string
  onChange?: (content: JSONContent) => void
  editorRef?: RefObject<AdvancedEditorHandle | null>
}

function imageFiles(list: FileList | null | undefined) {
  return [...(list ?? [])].filter((file) => imageTypes.has(file.type) && file.size <= maxImageBytes)
}

export function AdvancedEditor({ mode = 'teacher', content, onChange, editorRef }: AdvancedEditorProps) {
  const { t } = useTranslation()
  const imageInputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [status, setStatus] = useState('')
  const [youtubeOpen, setYoutubeOpen] = useState(false)
  const [youtubeUrl, setYoutubeUrl] = useState('')
  const [exampleOpen, setExampleOpen] = useState(false)
  const [explanation, setExplanation] = useState('')
  const [mediaType, setMediaType] = useState<ExampleMediaType>('text')
  const [mediaUrl, setMediaUrl] = useState('')
  const [exampleImage, setExampleImage] = useState<File | null>(null)
  const insertImagesRef = useRef<(files: File[], position?: number) => Promise<void>>(async () => {})
  const onChangeRef = useRef(onChange)

  const extensions = useMemo(
    () => [
      StarterKit.configure({ heading: { levels: [2, 3] } }),
      Image.configure({ HTMLAttributes: { class: 'lesson-image' } }),
      Youtube.configure({ width: '100%', height: 360, controls: true, nocookie: true }),
      ExampleMark,
    ],
    [],
  )

  const editorProps = useMemo(
    () => ({
      attributes: {
        class: 'lesson-prose h-full min-h-full px-5 py-6 focus:outline-none sm:px-8',
        'aria-label': t('editor.surface'),
      },
      handleDrop(view: { posAtCoords: (coords: { left: number; top: number }) => { pos: number } | null }, event: DragEvent) {
        const files = imageFiles(event.dataTransfer?.files)
        if (!files.length || mode !== 'teacher') return false
        event.preventDefault()
        const position = view.posAtCoords({ left: event.clientX, top: event.clientY })?.pos
        void insertImagesRef.current(files, position)
        return true
      },
      handlePaste(_view: unknown, event: ClipboardEvent) {
        const files = imageFiles(event.clipboardData?.files)
        if (!files.length || mode !== 'teacher') return false
        event.preventDefault()
        void insertImagesRef.current(files)
        return true
      },
    }),
    [mode, t],
  )

  const editor = useEditor({
    editable: mode === 'teacher',
    extensions,
    content,
    editorProps,
    onUpdate: ({ editor: current }) => onChangeRef.current?.(current.getJSON()),
  })

  const active = useEditorState({
    editor,
    selector: ({ editor: current }) => {
      if (!current) {
        return {
          bold: false,
          italic: false,
          heading2: false,
          heading3: false,
          bullet: false,
          ordered: false,
          example: false,
        }
      }
      return {
        bold: current.isActive('bold'),
        italic: current.isActive('italic'),
        heading2: current.isActive('heading', { level: 2 }),
        heading3: current.isActive('heading', { level: 3 }),
        bullet: current.isActive('bulletList'),
        ordered: current.isActive('orderedList'),
        example: current.isActive('example'),
      }
    },
  })

  useEffect(() => {
    onChangeRef.current = onChange
  }, [onChange])

  useEffect(() => {
    if (!editorRef) return
    editorRef.current = {
      getText: () => editor?.getText() ?? '',
      getHTML: () => editor?.getHTML() ?? '',
      insertMarkdown: (markdown: string) => {
        editor?.chain().focus().insertContent(markdownToHtml(markdown)).run()
      },
    }
  }, [editor, editorRef])

  useEffect(() => {
    insertImagesRef.current = async function insertImages(files: File[], position?: number) {
    if (!editor) return
    if (!isR2Configured) {
      setStatus(t('editor.r2Missing'))
      return
    }
    setUploading(true)
    setStatus(t('editor.uploading'))
    try {
      for (const file of files) {
        const url = await uploadToR2(file)
        const chain = editor.chain().focus()
        if (position != null) chain.setTextSelection(position)
        chain.setImage({ src: url, alt: file.name }).run()
      }
      setStatus('')
    } catch (error) {
      setStatus(error instanceof Error ? error.message : t('editor.uploadError'))
    } finally {
      setUploading(false)
    }
    }
  }, [editor, t])

  function insertYoutube() {
    if (!editor) return
    if (!isValidYoutubeUrl(youtubeUrl.trim())) {
      setStatus(t('editor.invalidYoutube'))
      return
    }
    editor.chain().focus().setYoutubeVideo({ src: youtubeUrl.trim(), width: '100%', height: 360 }).run()
    setYoutubeUrl('')
    setYoutubeOpen(false)
    setStatus('')
  }

  async function applyExample() {
    if (!editor) return
    if (editor.state.selection.empty) {
      setStatus(t('editor.needSelection'))
      return
    }
    const text = explanation.trim()
    if (!text) return

    let nextUrl = mediaUrl.trim()
    let nextType = mediaType
    if (mediaType === 'image' && exampleImage) {
      if (!isR2Configured) {
        setStatus(t('editor.r2Missing'))
        return
      }
      setUploading(true)
      try {
        nextUrl = await uploadToR2(exampleImage)
      } catch (error) {
        setStatus(error instanceof Error ? error.message : t('editor.uploadError'))
        setUploading(false)
        return
      } finally {
        setUploading(false)
      }
    }
    if (mediaType === 'video' && nextUrl && !isValidYoutubeUrl(nextUrl)) {
      try {
        if (new URL(nextUrl).protocol !== 'https:') {
          setStatus(t('editor.invalidMedia'))
          return
        }
      } catch {
        setStatus(t('editor.invalidMedia'))
        return
      }
    }
    if (mediaType !== 'text' && !nextUrl) nextType = 'text'

    const attributes: ExampleAttrs = {
      explanation: text,
      mediaUrl: nextType === 'text' ? '' : nextUrl,
      mediaType: nextType,
    }
    editor.chain().focus().setExample(attributes).run()
    setExampleOpen(false)
    setExplanation('')
    setMediaUrl('')
    setMediaType('text')
    setExampleImage(null)
    setStatus('')
  }

  if (!editor || !active) return null

  return (
    <div className="lesson-editor ui-card flex h-full min-h-0 flex-col overflow-hidden p-0">
      {mode === 'teacher' ? (
        <EditorToolbar
          editor={editor}
          active={active}
          uploading={uploading}
          onImage={() => imageInputRef.current?.click()}
          onYoutube={() => {
            setExampleOpen(false)
            setYoutubeOpen((open) => !open)
          }}
          onExample={() => {
            if (active.example) {
              editor.chain().focus().unsetExample().run()
              return
            }
            if (editor.state.selection.empty) {
              setStatus(t('editor.needSelection'))
              return
            }
            setYoutubeOpen(false)
            setExampleOpen(true)
            setStatus('')
          }}
        />
      ) : (
        <p className="border-b border-line px-4 py-3 text-sm text-muted">{t('editor.studentHint')}</p>
      )}

      {youtubeOpen ? (
        <form
          className="flex flex-col gap-2 border-b border-line p-3 sm:flex-row"
          onSubmit={(event) => {
            event.preventDefault()
            insertYoutube()
          }}
        >
          <label className="sr-only" htmlFor="youtube-url">
            {t('editor.youtubePrompt')}
          </label>
          <input
            id="youtube-url"
            value={youtubeUrl}
            onChange={(event) => setYoutubeUrl(event.target.value)}
            placeholder={t('editor.youtubePrompt')}
            inputMode="url"
            className="ui-field min-w-0 flex-1"
          />
          <button type="submit" className="ui-btn ui-btn-primary">
            {t('editor.insert')}
          </button>
        </form>
      ) : null}

      {exampleOpen ? (
        <form
          className="grid gap-3 border-b border-line p-3"
          onSubmit={(event) => {
            event.preventDefault()
            void applyExample()
          }}
        >
          <label className="grid gap-1 text-sm font-medium text-ink" htmlFor="example-text">
            {t('editor.explanation')}
            <textarea
              id="example-text"
              required
              value={explanation}
              onChange={(event) => setExplanation(event.target.value)}
              className="min-h-24 w-full rounded-xl border border-line bg-surface px-3 py-2 text-base font-normal text-ink"
            />
          </label>
          <fieldset className="flex flex-wrap gap-2">
            <legend className="sr-only">{t('editor.mediaKind')}</legend>
            {(['text', 'image', 'video'] as const).map((kind) => (
              <label key={kind} className="inline-flex h-11 cursor-pointer items-center gap-2 rounded-xl border border-line px-3 text-sm">
                <input
                  type="radio"
                  name="example-media"
                  checked={mediaType === kind}
                  onChange={() => setMediaType(kind)}
                />
                {t(`editor.media.${kind}`)}
              </label>
            ))}
          </fieldset>
          {mediaType === 'image' ? (
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              onChange={(event) => setExampleImage(event.target.files?.[0] ?? null)}
              className="text-sm"
            />
          ) : null}
          {mediaType === 'video' ? (
            <input
              value={mediaUrl}
              onChange={(event) => setMediaUrl(event.target.value)}
              placeholder={t('editor.mediaVideo')}
              inputMode="url"
              className="ui-field"
            />
          ) : null}
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={uploading}
              className="ui-btn ui-btn-primary"
            >
              {t('editor.apply')}
            </button>
            <button
              type="button"
              className="ui-btn ui-btn-ghost"
              onClick={() => setExampleOpen(false)}
            >
              {t('editor.cancel')}
            </button>
          </div>
        </form>
      ) : null}

      <EditorContent editor={editor} className="min-h-0 flex-1 overflow-y-auto" />
      <input
        ref={imageInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        className="sr-only"
        onChange={(event) => {
          const selected = event.target.files
          const files = imageFiles(selected)
          const hadSelection = Boolean(selected?.length)
          event.target.value = ''
          if (files.length) void insertImagesRef.current(files)
          else if (hadSelection) setStatus(t('editor.invalidImage'))
        }}
      />
      {status ? (
        <p role="status" className="border-t border-line px-4 py-3 text-sm text-ink">
          {status}
        </p>
      ) : null}
    </div>
  )
}
