import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1'

const models = new Set([
  'openai/gpt-4o-mini',
  'openai/gpt-4o',
  'anthropic/claude-3.5-sonnet',
  'google/gemini-2.0-flash',
])

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
  if (request.method !== 'POST') {
    return json({ error: 'method' }, 405)
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const publishableKey = Deno.env.get('SUPABASE_ANON_KEY') ?? Deno.env.get('SUPABASE_PUBLISHABLE_KEY')
  const gatewayUrl = Deno.env.get('AI_GATEWAY_URL')
  const gatewayToken = Deno.env.get('AI_GATEWAY_TOKEN')
  if (!supabaseUrl || !publishableKey) return json({ error: 'missing-supabase' }, 500)
  if (!gatewayUrl || !gatewayToken) return json({ error: 'missing-gateway' }, 503)

  const authorization = request.headers.get('Authorization') ?? ''
  const supabase = createClient(supabaseUrl, publishableKey, {
    global: { headers: { Authorization: authorization } },
  })
  const { data: userData, error: userError } = await supabase.auth.getUser()
  if (userError || !userData.user) return json({ error: 'unauthorized' }, 401)

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', userData.user.id).maybeSingle()
  if (profile?.role !== 'admin' && profile?.role !== 'teacher') return json({ error: 'forbidden' }, 403)

  const body = await request.json().catch(() => null)
  const model = typeof body?.model === 'string' ? body.model : ''
  const task = typeof body?.task === 'string' ? body.task : ''
  const content = typeof body?.content === 'string' ? body.content.slice(0, 12000) : ''
  const language = body?.language === 'my' || body?.language === 'bn' ? body.language : 'vi'
  if (!models.has(model) || !tasks.has(task)) return json({ error: 'invalid' }, 400)

  const languageName = language === 'my' ? 'Burmese' : language === 'bn' ? 'Bengali' : 'Vietnamese'
  const response = await fetch(gatewayUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${gatewayToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      messages: [
        {
          role: 'system',
          content: `${instructions[task]} Write in ${languageName}. Do not invent facts that are not supported by the lesson.`,
        },
        { role: 'user', content: content || 'The lesson is still empty. Draft a short beginner lesson for basic vocational training.' },
      ],
    }),
  })

  if (!response.ok) return json({ error: 'gateway' }, 502)
  const payload = await response.json()
  const text = payload?.choices?.[0]?.message?.content
  if (typeof text !== 'string' || !text.trim()) return json({ error: 'empty' }, 502)
  return json({ text })
})

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: cors })
}
