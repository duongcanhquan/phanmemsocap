import { supabase } from './supabase'

export const isMediaUploadReady = () => Boolean(supabase)

export function isFileUrl(value: string) {
  return /^https?:\/\//i.test(value.trim())
}

export function httpsUrl(value: string) {
  try {
    return new URL(value).protocol === 'https:' ? value : ''
  } catch {
    return ''
  }
}

export function fileUrl(value: string) {
  try {
    const url = new URL(value.trim())
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.href : ''
  } catch {
    return ''
  }
}

function storageName(file: File, preferredName?: string) {
  const extension = file.name.includes('.') ? file.name.slice(file.name.lastIndexOf('.')) : ''
  const raw = (preferredName?.trim() || file.name.replace(/\.[^.]+$/, '') || 'file') + extension
  return raw.replace(/[^\w.-]+/g, '-').replace(/-+/g, '-').slice(0, 80) || `file${extension}`
}

/** Upload to the public Supabase `media` bucket. Never put storage secrets in VITE_*. */
export async function uploadMedia(
  file: File,
  folder: 'lessons' | 'photos' | 'slides' | 'pdfs' = 'lessons',
  preferredName?: string,
): Promise<string> {
  if (!supabase) throw new Error('storage-missing')
  const safeName = storageName(file, preferredName)
  const path = `${folder}/${crypto.randomUUID()}-${safeName}`
  const uploaded = await supabase.storage.from('media').upload(path, file, {
    contentType: file.type || 'application/octet-stream',
    upsert: false,
  })
  if (uploaded.error) throw uploaded.error
  return supabase.storage.from('media').getPublicUrl(path).data.publicUrl
}
