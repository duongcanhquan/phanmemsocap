import { createClient, type SupabaseClient } from '@supabase/supabase-js'

export const appRoles = ['superadmin', 'admin', 'teacher', 'student'] as const

export type AppRole = (typeof appRoles)[number]

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

type Table<Row extends Record<string, unknown>, Insert, Update = Partial<Insert>> = {
  Row: Row
  Insert: Insert
  Update: Update
  Relationships: []
}

export interface Database {
  public: {
    Tables: {
      profiles: Table<
        {
          id: string
          role: AppRole
          full_name: string | null
          language: string | null
          date_of_birth: string | null
          passport: string | null
          national_id: string | null
          photo_url: string | null
          phone: string | null
          status: string | null
          created_at: string | null
        },
        {
          id: string
          role?: AppRole
          full_name?: string | null
          language?: string | null
          date_of_birth?: string | null
          passport?: string | null
          national_id?: string | null
          photo_url?: string | null
          phone?: string | null
        }
      >
      programs: Table<
        {
          id: string
          title: Json | null
          category: string | null
          description: Json | null
          cover_image_url: string | null
          teacher_id: string | null
          is_active: boolean | null
          created_at: string | null
        },
        {
          title?: Json | null
          category?: string | null
          description?: Json | null
          cover_image_url?: string | null
          teacher_id?: string | null
          is_active?: boolean | null
        }
      >
      lessons: Table<
        {
          id: string
          program_id: string | null
          module_name: Json | null
          title: Json | null
          content_type: string | null
          content_url: string | null
          order_index: number | null
          is_published: boolean | null
          created_at: string | null
        },
        {
          program_id?: string | null
          module_name?: Json | null
          title?: Json | null
          content_type?: string | null
          content_url?: string | null
          order_index?: number | null
          is_published?: boolean | null
        }
      >
      quizzes: Table<
        {
          id: string
          lesson_id: string | null
          question: Json | null
          options: Json | null
          correct_option_index: number | null
          is_essay: boolean | null
          created_at: string | null
        },
        {
          lesson_id?: string | null
          question?: Json | null
          options?: Json | null
          correct_option_index?: number | null
          is_essay?: boolean | null
        }
      >
      quiz_submissions: Table<
        {
          id: string
          student_id: string | null
          quiz_id: string | null
          selected_option_index: number | null
          essay_answer: string | null
          is_correct: boolean | null
          score: number | null
          teacher_feedback: string | null
          submitted_at: string | null
        },
        {
          student_id?: string | null
          quiz_id?: string | null
          selected_option_index?: number | null
          essay_answer?: string | null
          is_correct?: boolean | null
          score?: number | null
          teacher_feedback?: string | null
        }
      >
      program_enrollments: Table<
        {
          id: string
          student_id: string | null
          program_id: string | null
          enrollment_date: string | null
          status: string | null
        },
        {
          student_id?: string | null
          program_id?: string | null
          status?: string | null
        }
      >
    }
    Views: Record<string, never>
    Functions: {
      get_lesson_questions: {
        Args: { lesson_id: string }
        Returns: Json
      }
      submit_lesson_quiz: {
        Args: { lesson_id: string; answers: Json }
        Returns: Json
      }
      program_lesson_state: {
        Args: { program_id: string }
        Returns: Json
      }
      school_overview: {
        Args: Record<string, never>
        Returns: Json
      }
      set_my_language: {
        Args: { next_language: string }
        Returns: undefined
      }
    }
  }
}

const projectUrl = 'https://zkpmemckzaegomwbgzag.supabase.co'
const projectPublishableKey = 'sb_publishable_8K-KEqjdSzzdCvyggyEx3w_TmbyYgaJ'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || projectUrl
const supabasePublishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || projectPublishableKey

const rememberFlag = 'phanmemsocap.remember'
const rememberedEmailKey = 'phanmemsocap.email'

export function rememberLoginEnabled() {
  try {
    return localStorage.getItem(rememberFlag) !== '0'
  } catch {
    return true
  }
}

export function rememberedEmail() {
  try {
    return rememberLoginEnabled() ? (localStorage.getItem(rememberedEmailKey) ?? '') : ''
  } catch {
    return ''
  }
}

export function rememberEmail(email: string, enabled: boolean) {
  localStorage.setItem(rememberFlag, enabled ? '1' : '0')
  if (enabled) localStorage.setItem(rememberedEmailKey, email)
  else localStorage.removeItem(rememberedEmailKey)
}

const authStorage = {
  getItem(key: string) {
    return (rememberLoginEnabled() ? localStorage : sessionStorage).getItem(key)
  },
  setItem(key: string, value: string) {
    const keep = rememberLoginEnabled() ? localStorage : sessionStorage
    const drop = keep === localStorage ? sessionStorage : localStorage
    drop.removeItem(key)
    keep.setItem(key, value)
  },
  removeItem(key: string) {
    localStorage.removeItem(key)
    sessionStorage.removeItem(key)
  },
}

export const supabase: SupabaseClient<Database> | null =
  supabaseUrl && supabasePublishableKey
    ? createClient<Database>(supabaseUrl, supabasePublishableKey, {
        auth: { storage: authStorage, persistSession: true, autoRefreshToken: true },
      })
    : null

export const isSupabaseConfigured = supabase !== null

export function isAppRole(value: string | null | undefined): value is AppRole {
  return value === 'superadmin' || value === 'admin' || value === 'teacher' || value === 'student'
}

export async function fetchProfileRole(userId: string, accessToken?: string): Promise<AppRole | null> {
  if (!supabase) {
    return null
  }

  const token = accessToken ?? (await supabase.auth.getSession()).data.session?.access_token
  if (!token) {
    return null
  }

  const headers = {
    apikey: supabasePublishableKey,
    Authorization: `Bearer ${token}`,
    Accept: 'application/json',
    'Content-Type': 'application/json',
  }
  const roleResponse = await fetch(`${supabaseUrl}/rest/v1/rpc/my_app_role`, {
    method: 'POST',
    headers,
    body: '{}',
  })
  if (roleResponse.ok) {
    const role = (await roleResponse.json()) as string | null
    if (isAppRole(role)) return role
  }

  const response = await fetch(
    `${supabaseUrl}/rest/v1/profiles?select=role&id=eq.${encodeURIComponent(userId)}`,
    { headers },
  )
  if (!response.ok) {
    return null
  }

  const rows = (await response.json()) as { role?: string }[]
  const role = rows[0]?.role
  return isAppRole(role) ? role : null
}

export async function fetchProfileLanguage(userId: string, accessToken: string): Promise<string | null> {
  const response = await fetch(
    `${supabaseUrl}/rest/v1/profiles?select=language&id=eq.${encodeURIComponent(userId)}`,
    {
      headers: {
        apikey: supabasePublishableKey,
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/json',
      },
    },
  )
  if (!response.ok) return null
  const rows = (await response.json()) as { language?: string | null }[]
  return rows[0]?.language ?? null
}
