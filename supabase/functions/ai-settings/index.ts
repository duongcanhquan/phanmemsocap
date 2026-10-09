import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1'

const catalog: Record<string, string[]> = {
  openai: ['gpt-4o-mini', 'gpt-4o', 'gpt-4.1-mini'],
  gemini: ['gemini-2.5-flash', 'gemini-2.5-pro', 'gemini-2.0-flash'],
  deepseek: ['deepseek-chat', 'deepseek-reasoner'],
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
  const role = profile?.role ?? ''
  const canRead = role === 'superadmin' || role === 'admin' || role === 'teacher'
  const canSave = role === 'superadmin' || role === 'admin'
  if (!canRead) return json({ error: 'forbidden' }, 403)

  const body = await request.json().catch(() => null)
  if (body?.action === 'save') {
    if (!canSave) return json({ error: 'forbidden' }, 403)
    const provider = typeof body.provider === 'string' ? body.provider : ''
    const allowed = catalog[provider]
    if (!allowed) return json({ error: 'invalid' }, 400)
    const models = Array.isArray(body.models)
      ? body.models.filter((model: unknown) => typeof model === 'string' && allowed.includes(model))
      : []
    const apiKey = typeof body.apiKey === 'string' ? body.apiKey.trim() : ''
    if (apiKey && (apiKey.length < 12 || apiKey.length > 300 || /\s/.test(apiKey))) {
      return json({ error: 'invalid-key' }, 400)
    }
    const current = await admin.from('ai_connections').select('api_key').eq('provider', provider).maybeSingle()
    const nextKey = apiKey || current.data?.api_key || null
    const saved = await admin.from('ai_connections').upsert({
      provider,
      api_key: nextKey,
      enabled: Boolean(body.enabled) && Boolean(nextKey) && models.length > 0,
      models,
      updated_at: new Date().toISOString(),
    })
    if (saved.error) return json({ error: 'save-failed' }, 400)
  } else if (body?.action !== 'list') {
    return json({ error: 'invalid' }, 400)
  }

  const rows = await admin.from('ai_connections').select('provider, api_key, enabled, models')
  if (rows.error) return json({ error: 'failed' }, 500)
  return json({
    connections: (rows.data ?? []).map((row) => ({
      provider: row.provider,
      enabled: row.enabled,
      hasKey: Boolean(row.api_key),
      keyHint: hint(row.api_key),
      models: row.models ?? [],
    })),
  })
})

function hint(key: string | null) {
  if (!key || key.length < 4) return ''
  return `••••${key.slice(-4)}`
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: cors })
}
