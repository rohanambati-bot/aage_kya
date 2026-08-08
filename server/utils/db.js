import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.SUPABASE_URL || 'https://your-project-ref.supabase.co'
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || 'your-supabase-anon-key'

export let supabase = null
export let supabaseAdmin = null
try {
  supabase = createClient(supabaseUrl, supabaseAnonKey)
  // Admin Supabase client (service role key — bypasses RLS for aggregate queries)
  // SUPABASE_SERVICE_ROLE_KEY is optional; analytics endpoint disabled without it.
  supabaseAdmin = process.env.SUPABASE_SERVICE_ROLE_KEY
    ? createClient(supabaseUrl, process.env.SUPABASE_SERVICE_ROLE_KEY, {
        auth: { persistSession: false },
      })
    : null
} catch (err) {
  console.warn(`[startup] Supabase client not initialized: ${err.message}. DB-backed features will be disabled.`)
}

// Server-authored rows (guidance_results, roadmaps) are written with the
// service-role admin client — NEVER the user's bearer-scoped client — so a
// student token can never forge or tamper with AI-authored guidance. Falls
// back to the anon client only when no service role key is configured (dev).
export const guidanceWriter = () => supabaseAdmin || supabase

export function isSupabaseConfigured() {
  return supabaseUrl && 
         !supabaseUrl.includes('your-supabase') && 
         !supabaseUrl.includes('your-project-ref') && 
         supabaseUrl !== 'https://your-project-ref.supabase.co'
}

// Consistent error for datastore failures so callers can fail loudly instead
// of silently swallowing DB errors.
export function datastoreError(context, cause) {
  const err = new Error(`${context} failed: ${cause?.message || 'unknown datastore error'}`)
  err.code = 'DATASTORE_ERROR'
  err.cause = cause
  return err
}

const isDev = process.env.NODE_ENV !== 'production'
// Mirrors server/middleware/auth.js: the demo tokens hand back an RLS-bypassing
// service-role client, so they must be explicitly opted into rather than
// enabled by the absence of NODE_ENV=production.
const demoLoginEnabled = process.env.ENABLE_DEMO_LOGIN === 'true' && isDev

const DEMO_TOKENS = new Set(['demo-student-token', 'demo-admin-token', 'demo-mentor-token'])

// User-scoped Supabase client helper to respect Row Level Security (RLS)
export function getSupabaseClient(authHeader) {
  if (authHeader) {
    const token = authHeader.split(' ')[1]
    if (demoLoginEnabled && DEMO_TOKENS.has(token)) {
      return supabaseAdmin || createClient(supabaseUrl, supabaseAnonKey)
    }
    return createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: {
          Authorization: authHeader,
        },
      },
    })
  }
  return createClient(supabaseUrl, supabaseAnonKey)
}

// Resilient student profile upsert (prunes missing columns dynamically)
export async function resilientUpsertStudent(client, studentData) {
  let { error } = await client.from('students').upsert(studentData)
  if (error && (error.code === 'PGRST204' || error.code === '42703' || error.message?.includes('class_level'))) {
    const allowedKeys = [
      'id', 'full_name', 'state', 'board', 'stream', 'marks', 
      'income_range', 'first_gen_college', 'preferred_cities', 
      'interests', 'biggest_fear', 'updated_at', 'role'
    ]
    const prunedData = {}
    for (const key of allowedKeys) {
      if (studentData[key] !== undefined) {
        prunedData[key] = studentData[key]
      }
    }
    const { error: retryError } = await client.from('students').upsert(prunedData)
    if (retryError) throw retryError
  } else if (error) {
    throw error
  }
}
