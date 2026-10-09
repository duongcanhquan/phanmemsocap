import { supabase } from './supabase'

export const aiCatalog = [
  {
    provider: 'openai',
    labelKey: 'aiSettings.providers.openai',
    models: [
      { id: 'gpt-4o-mini', label: 'GPT-4o mini' },
      { id: 'gpt-4o', label: 'GPT-4o' },
      { id: 'gpt-4.1-mini', label: 'GPT-4.1 mini' },
    ],
  },
  {
    provider: 'gemini',
    labelKey: 'aiSettings.providers.gemini',
    models: [
      { id: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash' },
      { id: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro' },
      { id: 'gemini-2.0-flash', label: 'Gemini 2.0 Flash' },
    ],
  },
  {
    provider: 'deepseek',
    labelKey: 'aiSettings.providers.deepseek',
    models: [
      { id: 'deepseek-chat', label: 'DeepSeek Chat' },
      { id: 'deepseek-reasoner', label: 'DeepSeek Reasoner' },
    ],
  },
] as const

export type AiProvider = (typeof aiCatalog)[number]['provider']

export type AiConnection = {
  provider: AiProvider
  enabled: boolean
  hasKey: boolean
  keyHint: string
  models: string[]
}

export type LessonModel = string

export type LessonTask = 'outline' | 'terms' | 'quiz' | 'slides'

type AiPayload = {
  connections?: AiConnection[]
  text?: string
  error?: string
}

async function invoke(name: string, body: Record<string, unknown>) {
  if (!supabase) throw new Error('missing-supabase')
  const { data, error } = await supabase.functions.invoke(name, { body })
  if (error) {
    const response = 'context' in error ? (error.context as Response | undefined) : undefined
    const payload = response ? ((await response.json().catch(() => null)) as AiPayload | null) : null
    throw new Error(payload?.error || 'failed')
  }
  const payload = data as AiPayload | null
  if (payload?.error) throw new Error(payload.error)
  return payload
}

export function listAiConnections() {
  return invoke('ai-settings', { action: 'list' }).then((payload) =>
    (payload?.connections ?? []).flatMap((row) => {
      if (!row || (row.provider !== 'openai' && row.provider !== 'gemini' && row.provider !== 'deepseek')) return []
      return [{
        provider: row.provider,
        enabled: row.enabled === true,
        hasKey: row.hasKey === true,
        keyHint: typeof row.keyHint === 'string' ? row.keyHint : '',
        models: Array.isArray(row.models) ? row.models.filter((model) => typeof model === 'string') : [],
      }]
    }),
  )
}

export function saveAiConnection(input: { provider: AiProvider; apiKey: string; enabled: boolean; models: string[] }) {
  return invoke('ai-settings', { action: 'save', ...input }).then((payload) => payload?.connections ?? [])
}

export function lessonModelId(provider: string, model: string) {
  return `${provider}/${model}`
}

export async function generateLesson(input: { model: LessonModel; task: LessonTask; content: string; language: string }) {
  const payload = await invoke('ai-lesson', input)
  if (!payload?.text) throw new Error('empty')
  return payload.text
}
