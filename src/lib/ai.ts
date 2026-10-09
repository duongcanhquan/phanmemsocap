import { supabase } from './supabase'

export const lessonModels = [
  { id: 'openai/gpt-4o-mini', label: 'GPT-4o mini' },
  { id: 'openai/gpt-4o', label: 'GPT-4o' },
  { id: 'anthropic/claude-3.5-sonnet', label: 'Claude 3.5 Sonnet' },
  { id: 'google/gemini-2.0-flash', label: 'Gemini 2.0 Flash' },
] as const

export type LessonModel = (typeof lessonModels)[number]['id']

export type LessonTask = 'outline' | 'terms' | 'quiz' | 'slides'

export async function generateLesson(input: { model: LessonModel; task: LessonTask; content: string; language: string }) {
  if (!supabase) throw new Error('missing-supabase')
  const { data, error } = await supabase.functions.invoke('ai-lesson', { body: input })
  if (error) throw error
  const payload = data as { text?: string; error?: string } | null
  if (!payload?.text) throw new Error(payload?.error || 'empty')
  return payload.text
}
