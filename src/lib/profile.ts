import { supabase } from './supabase'

const imageTypes = new Map([
  ['image/jpeg', 'jpg'],
  ['image/png', 'png'],
  ['image/webp', 'webp'],
  ['image/gif', 'gif'],
])

const maxBytes = 2 * 1024 * 1024

export type MyProfile = {
  fullName: string
  avatarUrl: string
  photoUrl: string
  role: string
  dateOfBirth: string
  nationality: string
  phone: string
  nationalId: string
  passport: string
  studyStatus: string
  isForeign: boolean
  visaStatus: string
  visaExpiresOn: string
}

const emptyProfile: MyProfile = {
  fullName: '',
  avatarUrl: '',
  photoUrl: '',
  role: '',
  dateOfBirth: '',
  nationality: '',
  phone: '',
  nationalId: '',
  passport: '',
  studyStatus: '',
  isForeign: false,
  visaStatus: '',
  visaExpiresOn: '',
}

export async function loadMyProfile(userId: string): Promise<MyProfile> {
  if (!supabase) return emptyProfile
  const full = await supabase
    .from('profiles')
    .select('full_name, avatar_url, photo_url, role, date_of_birth, nationality, phone, national_id, passport, status, is_foreign, visa_status, visa_expires_on')
    .eq('id', userId)
    .maybeSingle()
  const row = full.error
    ? await supabase.from('profiles').select('full_name, avatar_url, photo_url, role, date_of_birth, phone, national_id, passport, status, is_foreign, visa_status, visa_expires_on').eq('id', userId).maybeSingle()
    : full
  if (row.error || !row.data) return emptyProfile
  const data = row.data as MyProfileRow
  return {
    fullName: data.full_name ?? '',
    avatarUrl: data.avatar_url ?? '',
    photoUrl: data.photo_url ?? '',
    role: data.role ?? '',
    dateOfBirth: data.date_of_birth ?? '',
    nationality: data.nationality ?? '',
    phone: data.phone ?? '',
    nationalId: data.national_id ?? '',
    passport: data.passport ?? '',
    studyStatus: data.status ?? '',
    isForeign: data.is_foreign === true,
    visaStatus: data.visa_status ?? '',
    visaExpiresOn: data.visa_expires_on ?? '',
  }
}

type MyProfileRow = {
  full_name?: string | null
  avatar_url?: string | null
  photo_url?: string | null
  role?: string | null
  date_of_birth?: string | null
  nationality?: string | null
  phone?: string | null
  national_id?: string | null
  passport?: string | null
  status?: string | null
  is_foreign?: boolean | null
  visa_status?: string | null
  visa_expires_on?: string | null
}

export async function loadMyAvatar(userId: string): Promise<string> {
  const profile = await loadMyProfile(userId)
  return profile.avatarUrl
}

export async function saveMyAvatar(userId: string, file: File): Promise<string> {
  if (!supabase) throw new Error('missing-supabase')
  const extension = imageTypes.get(file.type)
  if (!extension) throw new Error('icon-type')
  if (file.size > maxBytes) throw new Error('icon-big')
  const path = `${userId}/${crypto.randomUUID()}.${extension}`
  const uploaded = await supabase.storage.from('avatars').upload(path, file, { contentType: file.type })
  if (uploaded.error) throw new Error('icon-failed')
  const url = supabase.storage.from('avatars').getPublicUrl(path).data.publicUrl
  const saved = await supabase.rpc('set_my_avatar', { next_url: url })
  if (saved.error) throw new Error('icon-failed')
  return url
}

export async function clearMyAvatar(): Promise<void> {
  if (!supabase) throw new Error('missing-supabase')
  const saved = await supabase.rpc('set_my_avatar', { next_url: '' })
  if (saved.error) throw new Error('icon-failed')
}
