import { isR2Configured, uploadToR2 } from './r2'
import { supabase } from './supabase'

export const isMediaUploadReady = () => Boolean(supabase) || isR2Configured

export function isFileUrl(value: string) {
  return /^https?:\/\//i.test(value.trim())
}

export async function uploadMedia(file: File, folder: 'lessons' | 'photos' | 'slides' | 'pdfs' = 'lessons'): Promise<string> {
  if (supabase) {
    const safeName = file.name.replace(/[^\w.-]+/g, '-').replace(/-+/g, '-').slice(0, 80) || 'file'
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
  return uploadToR2(file)
}
