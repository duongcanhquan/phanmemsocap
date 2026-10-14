import { isR2Configured, uploadToR2 } from './r2'
import { supabase } from './supabase'

export const isMediaUploadReady = () => Boolean(supabase) || isR2Configured

export function isFileUrl(value: string) {
  return /^https?:\/\//i.test(value.trim())
}

function storageName(file: File, preferredName?: string) {
  const extension = file.name.includes('.') ? file.name.slice(file.name.lastIndexOf('.')) : ''
  const raw = (preferredName?.trim() || file.name.replace(/\.[^.]+$/, '') || 'file') + extension
  return raw.replace(/[^\w.-]+/g, '-').replace(/-+/g, '-').slice(0, 80) || `file${extension}`
}

export async function uploadMedia(
  file: File,
  folder: 'lessons' | 'photos' | 'slides' | 'pdfs' = 'lessons',
  preferredName?: string,
): Promise<string> {
  const safeName = storageName(file, preferredName)
  if (supabase) {
    const path = `${folder}/${crypto.randomUUID()}-${safeName}`
    const uploaded = await supabase.storage.from('media').upload(path, file, {
      contentType: file.type || 'application/octet-stream',
      upsert: false,
    })
    if (!uploaded.error) {
      return supabase.storage.from('media').getPublicUrl(path).data.publicUrl
    }
    if (!isR2Configured) throw uploaded.error
  }
  if (!isR2Configured) throw new Error('storage-missing')
  return uploadToR2(file, preferredName)
}
