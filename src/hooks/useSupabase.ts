import { supabase } from '@/lib/supabase'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/supabase'

export function useSupabase(): SupabaseClient<Database> {
  return supabase
}
