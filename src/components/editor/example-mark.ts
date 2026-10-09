import { Mark, mergeAttributes } from '@tiptap/core'
import { ReactMarkViewRenderer } from '@tiptap/react'
import { ExampleMarkView } from './ExampleMarkView'

export type ExampleMediaType = 'text' | 'image' | 'video'

export type ExampleAttrs = {
  explanation: string
  mediaUrl: string
  mediaType: ExampleMediaType
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    example: {
      setExample: (attributes: ExampleAttrs) => ReturnType
      unsetExample: () => ReturnType
    }
  }
}

export const ExampleMark = Mark.create({
  name: 'example',
  inclusive: false,

  addAttributes() {
    return {
      explanation: {
        default: '',
        parseHTML: (element: HTMLElement) => element.getAttribute('data-explanation') ?? '',
        renderHTML: (attributes: ExampleAttrs) => ({ 'data-explanation': attributes.explanation }),
      },
      mediaUrl: {
        default: '',
        parseHTML: (element: HTMLElement) => element.getAttribute('data-media-url') ?? '',
        renderHTML: (attributes: ExampleAttrs) =>
          attributes.mediaUrl ? { 'data-media-url': attributes.mediaUrl } : {},
      },
      mediaType: {
        default: 'text',
        parseHTML: (element: HTMLElement) => element.getAttribute('data-media-type') ?? 'text',
        renderHTML: (attributes: ExampleAttrs) => ({ 'data-media-type': attributes.mediaType }),
      },
    }
  },

  parseHTML() {
    return [{ tag: 'span[data-example]' }]
  },

  renderHTML({ HTMLAttributes }) {
    return ['span', mergeAttributes(HTMLAttributes, { 'data-example': '' }), 0]
  },

  addCommands() {
    return {
      setExample:
        (attributes) =>
        ({ commands }) =>
          commands.setMark(this.name, attributes),
      unsetExample:
        () =>
        ({ commands }) =>
          commands.unsetMark(this.name),
    }
  },

  addMarkView() {
    return ReactMarkViewRenderer(ExampleMarkView)
  },
})
