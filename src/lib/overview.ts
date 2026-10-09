import { asLocalized, type LocalizedText } from './localized'
import { supabase, type Json } from './supabase'

export type QuietStudent = {
  id: string
  fullName: string
  programTitle: LocalizedText
  lastSeen: string | null
}

export type SchoolOverview = {
  activeStudents: number
  programs: number
  completionRate: number
  inactiveDays: number
  inactive: QuietStudent[]
}

function asObject(value: Json | null): Record<string, Json | undefined> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {}
}

export async function loadSchoolOverview(): Promise<SchoolOverview> {
  if (!supabase) throw new Error('missing-supabase')
  const { data, error } = await supabase.rpc('school_overview')
  if (error) throw error
  const row = asObject(data)
  const inactive = Array.isArray(row.inactive) ? row.inactive : []
  return {
    activeStudents: typeof row.activeStudents === 'number' ? row.activeStudents : 0,
    programs: typeof row.programs === 'number' ? row.programs : 0,
    completionRate: typeof row.completionRate === 'number' ? row.completionRate : 0,
    inactiveDays: typeof row.inactiveDays === 'number' ? row.inactiveDays : 7,
    inactive: inactive.map((item) => {
      const person = asObject(item)
      return {
        id: typeof person.id === 'string' ? person.id : '',
        fullName: typeof person.fullName === 'string' ? person.fullName : '',
        programTitle: asLocalized(person.programTitle ?? null),
        lastSeen: typeof person.lastSeen === 'string' ? person.lastSeen : null,
      }
    }),
  }
}
