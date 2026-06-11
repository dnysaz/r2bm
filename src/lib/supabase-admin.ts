import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

if (!serviceRoleKey) {
  console.warn(
    'SUPABASE_SERVICE_ROLE_KEY not set — admin client will use anon key with RLS instead. ' +
    'Add SUPABASE_SERVICE_ROLE_KEY to your .env.local for admin-level access.'
  )
}

export const supabaseAdmin = createClient(
  supabaseUrl,
  serviceRoleKey || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)
