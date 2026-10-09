import { isAppRole, supabase, type AppRole } from './supabase'

export type AccountPerson = {
  id: string
  email: string
  fullName: string
  role: AppRole
  language: string
  dateOfBirth: string
  passport: string
  nationalId: string
  phone: string
  photoUrl: string
}

export type AccountInput = {
  email: string
  password?: string
  fullName: string
  role: AppRole
  language: string
  dateOfBirth: string
  passport: string
  nationalId: string
  phone: string
  photoUrl: string
}

export type ImportFailure = {
  email: string
  error: string
}

type AccountAction =
  | { action: 'list' }
  | { action: 'create'; person: AccountInput }
  | { action: 'update'; userId: string; person: AccountInput }
  | { action: 'delete'; userId: string }
  | { action: 'import'; people: AccountInput[] }

type AccountPayload = {
  people?: AccountPerson[]
  failed?: ImportFailure[]
  error?: string
}

async function callAccounts(body: AccountAction) {
  if (!supabase) throw new Error('missing-supabase')
  const { data, error } = await supabase.functions.invoke('manage-accounts', { body })
  if (error) {
    const response = 'context' in error ? (error.context as Response | undefined) : undefined
    const payload = response ? ((await response.json().catch(() => null)) as AccountPayload | null) : null
    throw new Error(payload?.error || 'failed')
  }
  const payload = data as AccountPayload | null
  if (payload?.error) throw new Error(payload.error)
  return {
    people: (payload?.people ?? []).filter((person) => isAppRole(person.role)),
    failed: payload?.failed ?? [],
  }
}

export function listAccounts() {
  return callAccounts({ action: 'list' }).then((result) => result.people)
}

export function createAccount(person: AccountInput) {
  return callAccounts({ action: 'create', person }).then((result) => result.people)
}

export function updateAccount(userId: string, person: AccountInput) {
  return callAccounts({ action: 'update', userId, person }).then((result) => result.people)
}

export function deleteAccount(userId: string) {
  return callAccounts({ action: 'delete', userId }).then((result) => result.people)
}

export function importAccounts(people: AccountInput[]) {
  return callAccounts({ action: 'import', people })
}

export async function changeOwnPassword(password: string) {
  if (!supabase) throw new Error('missing-supabase')
  const { error } = await supabase.auth.updateUser({ password })
  if (error) throw new Error('weak-password')
}

export function rolesFor(caller: AppRole | null): AppRole[] {
  if (caller === 'superadmin') return ['admin', 'teacher', 'student']
  if (caller === 'admin') return ['teacher', 'student']
  return []
}

export function canEditPerson(caller: AppRole | null, person: AccountPerson, selfId: string | undefined) {
  if (person.id === selfId) return true
  if (caller === 'superadmin') return person.role !== 'superadmin'
  if (caller === 'admin') return person.role === 'teacher' || person.role === 'student'
  return false
}

export const accountCsvHeader = 'email,password,full_name,date_of_birth,passport,national_id,phone,photo_url'

export function parseAccountCsv(text: string, role: AppRole): AccountInput[] {
  const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/).map((line) => line.trim()).filter(Boolean)
  if (lines.length < 2) throw new Error('invalid-csv')
  const header = splitCsvLine(lines[0]).map((cell) => cell.trim().toLowerCase())
  const index = new Map(header.map((name, position) => [name, position]))
  if (!index.has('email') || !index.has('full_name')) throw new Error('invalid-csv')
  return lines.slice(1).map((line) => {
    const cells = splitCsvLine(line)
    const cell = (name: string) => cells[index.get(name) ?? -1]?.trim() ?? ''
    return {
      email: cell('email'),
      password: cell('password'),
      fullName: cell('full_name'),
      role,
      language: 'vi',
      dateOfBirth: cell('date_of_birth'),
      passport: cell('passport'),
      nationalId: cell('national_id'),
      phone: cell('phone'),
      photoUrl: cell('photo_url'),
    }
  })
}

function splitCsvLine(line: string) {
  const cells: string[] = []
  let current = ''
  let quoted = false
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index]
    if (char === '"') {
      if (quoted && line[index + 1] === '"') {
        current += '"'
        index += 1
      } else {
        quoted = !quoted
      }
    } else if (char === ',' && !quoted) {
      cells.push(current)
      current = ''
    } else {
      current += char
    }
  }
  cells.push(current)
  return cells
}
