import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

export type CloudProvider = 'aws' | 'azure'

export interface CloudConnection {
  id: string
  user_id: string
  provider: CloudProvider
  credentials: Record<string, string>
  created_at: string
}

export interface ZippyFile {
  id: string
  user_id: string
  filename: string
  size: number
  mime_type: string
  aws_key: string | null
  azure_blob: string | null
  uploaded_at: string
}
