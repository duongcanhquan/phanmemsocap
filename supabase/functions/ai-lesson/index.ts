import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1'

const catalog: Record<string, string[]> = {
  openai: ['gpt-4o-mini', 'gpt-4o', 'gpt-4.1-mini'],
  gemini: ['gemini-2.5-flash', 'gemini-2.5-pro', 'gemini-2.0-flash'],
  deepseek: ['deepseek-chat', 'deepseek-reasoner'],
}

const tasks = new Set(['outline', 'terms', 'quiz', 'slides'])

const instructions: Record<string, string> = {
  outline: 'Write a clear lesson outline with headings and short bullets. Use Markdown.',
  terms: 'Explain the technical terms in the lesson so a beginner can follow. Use Markdown.',
  quiz: 'Write multiple-choice questions from the lesson. Each question has 4 options and mark the correct one. Use Markdown.',
  slides:
    'Turn the lesson into slides. Return only Markdown. Separate slides with a line that contains only ---. Each slide starts with a heading and has at most 5 short bullets.',
}

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Content-Type': 'application/json',
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (request.method !== 'POST') return json({ error: 'method' }, 405)

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const publishableKey = Deno.env.get('SUPABASE_ANON_KEY') ?? Deno.env.get('SUPABASE_PUBLISHABLE_KEY')
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? Deno.env.get('SUPABASE_SECRET_KEY')
  if (!supabaseUrl || !publishableKey || !serviceKey) return json({ error: 'missing-supabase' }, 500)

  const jwt = (request.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '')
  const caller = createClient(supabaseUrl, publishableKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  const { data: userData, error: userError } = await caller.auth.getUser(jwt)
  if (userError || !userData.user) return json({ error: 'unauthorized' }, 401)

  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  const { data: profile } = await admin.from('profiles').select('role').eq('id', userData.user.id).maybeSingle()
  const role = profile?.role
  if (role !== 'superadmin' && role !== 'admin' && role !== 'teacher') return json({ error: 'forbidden' }, 403)

  const body = await request.json().catch(() => null)
  const modelId = typeof body?.model === 'string' ? body.model : ''
  const task = typeof body?.task === 'string' ? body.task : ''
  const content = typeof body?.content === 'string' ? body.content.slice(0, 12000) : ''
  const language = body?.language === 'my' || body?.language === 'bn' ? body.language : 'vi'
  const [provider, model] = modelId.split('/')
  if (!tasks.has(task) || !catalog[provider]?.includes(model)) return json({ error: 'invalid' }, 400)

  const connection = await admin.from('ai_connections').select('api_key, enabled, models, base_url').eq('provider', provider).maybeSingle()
  const row = connection.data
  if (!row?.enabled || !row.api_key || !(row.models ?? []).includes(model)) return json({ error: 'missing-gateway' }, 503)

  const languageName = language === 'my' ? 'Burmese' : language === 'bn' ? 'Bengali' : 'Vietnamese'
  const system = `${instructions[task]} Write in ${languageName}. Do not invent facts that are not supported by the lesson.`
  const user = content || 'The lesson is still empty. Draft a short beginner lesson for basic vocational training.'
  const text = provider === 'gemini'
    ? await gemini(row.api_key, model, system, user)
    : await chat(endpoint(provider, row.base_url), row.api_key, model, system, user)
  if (!text) return json({ error: 'gateway' }, 502)
  return json({ text })
})

function endpoint(provider: string, baseUrl: string | null) {
  const trimmed = baseUrl?.trim().replace(/\/$/, '') ?? ''
  if (trimmed.startsWith('https://')) return `${trimmed}/chat/completions`
  if (provider === 'deepseek') return 'https://api.deepseek.com/chat/completions'
  return 'https://api.openai.com/v1/chat/completions'
}

async function chat(url: string, apiKey: string, model: string, system: string, user: string) {
  const response = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
    }),
  })
  if (!response.ok) return ''
  const payload = await response.json()
  const text = payload?.choices?.[0]?.message?.content
  return typeof text === 'string' ? text.trim() : ''
}

async function gemini(apiKey: string, model: string, system: string, user: string) {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
    {
      method: 'POST',
      headers: { 'x-goog-api-key': apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: system }] },
        contents: [{ role: 'user', parts: [{ text: user }] }],
      }),
    },
  )
  if (!response.ok) return ''
  const payload = await response.json()
  const text = payload?.candidates?.[0]?.content?.parts?.map((part: { text?: string }) => part.text ?? '').join('')
  return typeof text === 'string' ? text.trim() : ''
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: cors })
}
