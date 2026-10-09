interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string
  readonly VITE_SUPABASE_PUBLISHABLE_KEY: string
  readonly VITE_R2_ACCOUNT_ID: string
  readonly VITE_R2_ACCESS_KEY_ID: string
  readonly VITE_R2_SECRET_ACCESS_KEY: string
  readonly VITE_R2_BUCKET: string
  readonly VITE_R2_PUBLIC_URL: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
