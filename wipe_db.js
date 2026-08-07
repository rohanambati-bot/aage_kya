/* global process */
import fs from 'fs'
import path from 'path'
import { createClient } from '@supabase/supabase-js'

const envPath = path.resolve('.env')
let envContent = ''
try { envContent = fs.readFileSync(envPath, 'utf8') } catch(e) {}
const env = {}
envContent.split('\n').forEach(line => {
  const parts = line.split('=')
  if (parts.length >= 2) {
    const key = parts[0].trim()
    const val = parts.slice(1).join('=').trim().replace(/^["']|["']$/g, '')
    env[key] = val
  }
})

const supabaseUrl = env.VITE_SUPABASE_URL || env.SUPABASE_URL
const supabaseKey = env.SUPABASE_SERVICE_ROLE_KEY || env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseKey) {
  console.log("⚠️ Missing Supabase URL or Key in .env. Skipping wipe.")
  process.exit(0)
}

const supabase = createClient(supabaseUrl, supabaseKey)

async function wipeDatabase() {
  console.log("🔥 Wiping custom database tables...")

  try {
    await supabase.from('guidance_results').delete().neq('id', '00000000-0000-0000-0000-000000000000')
    await supabase.from('mentor_applications').delete().neq('id', '00000000-0000-0000-0000-000000000000')
    await supabase.from('qa_posts').delete().neq('id', '00000000-0000-0000-0000-000000000000')
    await supabase.from('mentors').delete().neq('id', '00000000-0000-0000-0000-000000000000')
    await supabase.from('students').delete().neq('id', '00000000-0000-0000-0000-000000000000')
    
    console.log("✅ Wiped custom table records cleanly!")
  } catch (err) {
    console.error("Error wiping database:", err.message)
  }
}

wipeDatabase()
