import { supabase } from './supabase'

export const messageKinds = ['note', 'grade', 'lesson', 'warning'] as const

export type MessageKind = (typeof messageKinds)[number]

export type StudentMessage = {
  id: string
  teacherName: string
  kind: MessageKind
  body: string
  createdAt: string
}

function client() {
  if (!supabase) throw new Error('missing-supabase')
  return supabase
}

function asKind(value: string): MessageKind {
  return messageKinds.includes(value as MessageKind) ? (value as MessageKind) : 'note'
}

export async function listMyMessages(): Promise<StudentMessage[]> {
  const { data, error } = await client()
    .from('student_messages')
    .select('id, teacher_name, kind, body, created_at')
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []).map(mapMessage)
}

export async function listStudentMessages(studentId: string): Promise<StudentMessage[]> {
  const { data, error } = await client()
    .from('student_messages')
    .select('id, teacher_name, kind, body, created_at')
    .eq('student_id', studentId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []).map(mapMessage)
}

export async function sendStudentMessage(studentId: string, kind: MessageKind, body: string) {
  const db = client()
  const user = await db.auth.getUser()
  if (user.error || !user.data.user) throw new Error('unauthorized')
  const profile = await db.from('profiles').select('full_name').eq('id', user.data.user.id).maybeSingle()
  const saved = await db.from('student_messages').insert({
    teacher_id: user.data.user.id,
    student_id: studentId,
    teacher_name: profile.data?.full_name ?? '',
    kind,
    body: body.trim(),
  })
  if (saved.error) throw new Error('save-failed')
}

function mapMessage(row: { id: string; teacher_name: string; kind: string; body: string; created_at: string }): StudentMessage {
  return {
    id: row.id,
    teacherName: row.teacher_name,
    kind: asKind(row.kind),
    body: row.body,
    createdAt: row.created_at,
  }
}
