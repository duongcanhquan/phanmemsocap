import { supabase } from './supabase'

const imageTypes = new Map([
  ['image/jpeg', 'jpg'],
  ['image/png', 'png'],
  ['image/webp', 'webp'],
  ['image/gif', 'gif'],
])

const maxBytes = 2 * 1024 * 1024

export async function loadMyAvatar(userId: string): Promise<string> {
  if (!supabase) return ''
  const { data, error } = await supabase.from('profiles').select('avatar_url').eq('id', userId).maybeSingle()
  if (error) return ''
  return data?.avatar_url ?? ''
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
