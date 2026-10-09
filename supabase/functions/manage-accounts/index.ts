import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1'

const roles = new Set(['superadmin', 'admin', 'teacher', 'student'])
const languages = new Set(['vi', 'my', 'bn'])
const studyStatuses = new Set(['studying', 'paused', 'dropped', 'withdrawn'])
const visaStatuses = new Set(['valid', 'pending', 'expired'])

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Content-Type': 'application/json',
}

type PersonInput = {
  email?: string
  password?: string
  fullName?: string
  role?: string
  language?: string
  dateOfBirth?: string
  passport?: string
  nationalId?: string
  phone?: string
  photoUrl?: string
  studyStatus?: string
  isForeign?: boolean
  visaStatus?: string
  visaExpiresOn?: string
}

type AccountBody = {
  action?: string
  userId?: string
  person?: PersonInput
  people?: PersonInput[]
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
  const callerRole = profile?.role === 'superadmin' || profile?.role === 'admin' ? profile.role : ''
  if (!callerRole) return json({ error: 'forbidden' }, 403)

  const body = (await request.json().catch(() => null)) as AccountBody | null
  const action = body?.action

  if (action === 'list') return json({ people: await listPeople(admin) })

  if (action === 'create') {
    const created = await createPerson(admin, callerRole, body?.person)
    if (created.error) return json({ error: created.error }, created.status)
    return json({ people: await listPeople(admin) })
  }

  if (action === 'import') {
    const rows = Array.isArray(body?.people) ? body.people.slice(0, 100) : []
    if (rows.length === 0) return json({ error: 'invalid-csv' }, 400)
    const failed: { email: string; error: string }[] = []
    for (const row of rows) {
      const created = await createPerson(admin, callerRole, row)
      if (created.error) failed.push({ email: cleanEmail(row?.email) || row?.fullName || '', error: created.error })
    }
    return json({ people: await listPeople(admin), failed })
  }

  if (action === 'update') {
    const userId = body?.userId ?? ''
    const person = readPerson(body?.person)
    if (!userId || !person.role) return json({ error: 'invalid' }, 400)
    const isSelf = userId === userData.user.id
    if (isSelf) {
      if (person.role !== callerRole) return json({ error: 'forbidden-role' }, 403)
    } else if (!canAssign(callerRole, person.role)) {
      return json({ error: 'forbidden-role' }, 403)
    }
    const current = await admin.from('profiles').select('role').eq('id', userId).maybeSingle()
    const currentRole = current.data?.role ?? ''
    if (!canTouch(callerRole, currentRole, isSelf)) return json({ error: 'forbidden-role' }, 403)
    if (passwordOf(body?.person) && passwordOf(body?.person).length < 8) return json({ error: 'weak-password' }, 400)
    if (await removesLastSuperadmin(admin, userId, person.role)) return json({ error: 'last-admin' }, 400)

    const saved = await admin.from('profiles').upsert(profileRow(userId, person))
    if (saved.error) return json({ error: 'save-failed' }, 400)
    const password = passwordOf(body?.person)
    if (password) {
      const updated = await admin.auth.admin.updateUserById(userId, { password })
      if (updated.error) return json({ error: 'save-failed' }, 400)
    }
    return json({ people: await listPeople(admin) })
  }

  if (action === 'delete') {
    const userId = body?.userId ?? ''
    if (!userId) return json({ error: 'invalid' }, 400)
    if (userId === userData.user.id) return json({ error: 'self-delete' }, 400)
    const current = await admin.from('profiles').select('role').eq('id', userId).maybeSingle()
    if (!canTouch(callerRole, current.data?.role ?? '', false)) return json({ error: 'forbidden-role' }, 403)
    if (await removesLastSuperadmin(admin, userId, 'student')) return json({ error: 'last-admin' }, 400)
    const removed = await admin.auth.admin.deleteUser(userId)
    if (removed.error) return json({ error: 'delete-failed' }, 400)
    return json({ people: await listPeople(admin) })
  }

  return json({ error: 'invalid' }, 400)
})

function canAssign(callerRole: string, role: string) {
  if (callerRole === 'superadmin') return role === 'admin' || role === 'teacher' || role === 'student'
  if (callerRole === 'admin') return role === 'teacher' || role === 'student'
  return false
}

function canTouch(callerRole: string, targetRole: string, isSelf: boolean) {
  if (isSelf) return true
  if (targetRole === 'superadmin') return false
  if (callerRole === 'superadmin') return targetRole === 'admin' || targetRole === 'teacher' || targetRole === 'student'
  if (callerRole === 'admin') return targetRole === 'teacher' || targetRole === 'student'
  return false
}

async function removesLastSuperadmin(admin: ReturnType<typeof createClient>, userId: string, nextRole: string) {
  const current = await admin.from('profiles').select('role').eq('id', userId).maybeSingle()
  if (current.data?.role !== 'superadmin' || nextRole === 'superadmin') return false
  const rows = await admin.from('profiles').select('id').eq('role', 'superadmin')
  return (rows.data ?? []).length <= 1
}

async function createPerson(admin: ReturnType<typeof createClient>, callerRole: string, input: PersonInput | undefined) {
  const person = readPerson(input)
  const email = cleanEmail(input?.email)
  const password = passwordOf(input)
  if (!email) return { error: 'invalid-email', status: 400 }
  if (password.length < 8) return { error: 'weak-password', status: 400 }
  if (!canAssign(callerRole, person.role)) return { error: 'forbidden-role', status: 403 }

  const created = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: person.fullName },
  })
  if (created.error || !created.data.user) {
    const message = created.error?.message.toLowerCase() ?? ''
    if (message.includes('already') || message.includes('registered') || message.includes('exists')) {
      return { error: 'email-taken', status: 409 }
    }
    return { error: 'create-failed', status: 400 }
  }
  const saved = await admin.from('profiles').upsert(profileRow(created.data.user.id, person))
  if (saved.error) return { error: 'create-failed', status: 400 }
  return { error: '', status: 200 }
}

function readPerson(input: PersonInput | undefined) {
  const role = input?.role && roles.has(input.role) ? input.role : ''
  const dateOfBirth = /^\d{4}-\d{2}-\d{2}$/.test(input?.dateOfBirth ?? '') ? input?.dateOfBirth ?? '' : ''
  return {
    fullName: (input?.fullName ?? '').trim().slice(0, 120),
    role,
    language: input?.language && languages.has(input.language) ? input.language : 'vi',
    dateOfBirth,
    passport: (input?.passport ?? '').trim().slice(0, 40),
    nationalId: (input?.nationalId ?? '').trim().slice(0, 20),
    phone: (input?.phone ?? '').trim().slice(0, 20),
    photoUrl: httpsUrl(input?.photoUrl ?? ''),
    studyStatus: studyStatuses.has(input?.studyStatus ?? '') ? input?.studyStatus ?? 'studying' : 'studying',
    isForeign: input?.isForeign === true,
    visaStatus: visaStatuses.has(input?.visaStatus ?? '') ? input?.visaStatus ?? '' : '',
    visaExpiresOn: /^\d{4}-\d{2}-\d{2}$/.test(input?.visaExpiresOn ?? '') ? input?.visaExpiresOn ?? '' : '',
  }
}

function profileRow(id: string, person: ReturnType<typeof readPerson>) {
  return {
    id,
    role: person.role,
    full_name: person.fullName || null,
    language: person.language,
    date_of_birth: person.dateOfBirth || null,
    passport: person.passport || null,
    national_id: person.nationalId || null,
    phone: person.phone || null,
    photo_url: person.photoUrl || null,
    status: person.role === 'student' ? person.studyStatus : 'active',
    is_foreign: person.role === 'student' && person.isForeign,
    visa_status: person.role === 'student' && person.isForeign ? person.visaStatus || null : null,
    visa_expires_on: person.role === 'student' && person.isForeign ? person.visaExpiresOn || null : null,
  }
}

function passwordOf(input: PersonInput | undefined) {
  return input?.password?.trim() ?? ''
}

function cleanEmail(value: string | undefined) {
  const email = value?.trim().toLowerCase() ?? ''
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : ''
}

function httpsUrl(value: string) {
  try {
    return new URL(value).protocol === 'https:' ? value : ''
  } catch {
    return ''
  }
}

async function listPeople(admin: ReturnType<typeof createClient>) {
  const users = await admin.auth.admin.listUsers({ page: 1, perPage: 200 })
  if (users.error) throw users.error
  const profiles = await admin
    .from('profiles')
    .select('id, role, full_name, language, date_of_birth, passport, national_id, phone, photo_url, status, is_foreign, visa_status, visa_expires_on')
  if (profiles.error) throw profiles.error
  const byId = new Map((profiles.data ?? []).map((row) => [row.id, row]))
  return (users.data.users ?? [])
    .map((user) => {
      const profile = byId.get(user.id)
      const role = profile?.role && roles.has(profile.role) ? profile.role : 'student'
      return {
        id: user.id,
        email: user.email ?? '',
        fullName: profile?.full_name ?? '',
        role,
        language: profile?.language && languages.has(profile.language) ? profile.language : 'vi',
        dateOfBirth: profile?.date_of_birth ?? '',
        passport: profile?.passport ?? '',
        nationalId: profile?.national_id ?? '',
        phone: profile?.phone ?? '',
        photoUrl: profile?.photo_url ?? '',
        studyStatus: studyStatuses.has(profile?.status ?? '') ? profile?.status : 'studying',
        isForeign: profile?.is_foreign === true,
        visaStatus: visaStatuses.has(profile?.visa_status ?? '') ? profile?.visa_status : '',
        visaExpiresOn: profile?.visa_expires_on ?? '',
      }
    })
    .sort((a, b) => a.fullName.localeCompare(b.fullName) || a.email.localeCompare(b.email))
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: cors })
}
