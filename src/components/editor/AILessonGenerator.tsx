import { Sparkles } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { generateLesson, lessonModels, type LessonModel, type LessonTask } from '../../lib/ai'
import { SlideDeck } from '../slides/SlideDeck'

type AILessonGeneratorProps = {
  getContent: () => string
  onInsert: (markdown: string) => void
}

type ChatMessage = {
  id: string
  task: LessonTask
  prompt: string
  result: string
}

const actions: LessonTask[] = ['outline', 'terms', 'quiz', 'slides']

export function AILessonGenerator({ getContent, onInsert }: AILessonGeneratorProps) {
  const { t, i18n } = useTranslation()
  const [model, setModel] = useState<LessonModel>(lessonModels[0].id)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [pending, setPending] = useState<LessonTask | null>(null)
  const [error, setError] = useState('')

  async function run(task: LessonTask) {
    setPending(task)
    setError('')
    try {
      const result = await generateLesson({
        model,
        task,
        content: getContent(),
        language: i18n.language.split('-')[0],
      })
      setMessages((current) => [{ id: crypto.randomUUID(), task, prompt: t(`ai.tasks.${task}`), result }, ...current])
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : ''
      setError(message === 'missing-supabase' ? t('supabase.missing') : t('ai.failed'))
    } finally {
      setPending(null)
    }
  }

  return (
    <aside className="grid gap-3 rounded-2xl bg-white p-4 shadow-sm lg:sticky lg:top-4 lg:max-h-[calc(100dvh-7rem)] lg:overflow-y-auto">
      <div className="flex items-center gap-2">
        <Sparkles aria-hidden="true" className="size-5 text-accent" />
        <h2 className="text-lg font-semibold text-ink">{t('ai.title')}</h2>
      </div>
      <label className="grid gap-1 text-sm font-medium text-ink" htmlFor="ai-model">
        {t('ai.model')}
        <select
          id="ai-model"
          className="ui-field"
          value={model}
          onChange={(event) => setModel(event.target.value as LessonModel)}
        >
          {lessonModels.map((item) => (
            <option key={item.id} value={item.id}>
              {item.label}
            </option>
          ))}
        </select>
      </label>
      <div className="grid gap-2">
        {actions.map((task) => (
          <button
            key={task}
            type="button"
            className="ui-btn ui-btn-ghost border border-line justify-start"
            disabled={pending !== null}
            onClick={() => void run(task)}
          >
            {pending === task ? t('ai.working') : t(`ai.tasks.${task}`)}
          </button>
        ))}
      </div>
      {error ? (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : null}
      <div className="grid gap-3">
        {messages.map((message) => (
          <article key={message.id} className="grid gap-2 rounded-2xl bg-canvas p-3">
            <p className="text-sm font-medium text-muted">{message.prompt}</p>
            {message.task === 'slides' ? (
              <div className="h-80">
                <SlideDeck markdown={message.result} />
              </div>
            ) : (
              <pre className="text-sm leading-relaxed whitespace-pre-wrap text-ink">{message.result}</pre>
            )}
            <button type="button" className="ui-btn ui-btn-primary" onClick={() => onInsert(message.result)}>
              {t('ai.insert')}
            </button>
          </article>
        ))}
      </div>
    </aside>
  )
}
