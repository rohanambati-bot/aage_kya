import { supabase } from '../utils/db.js'

// Demo/judge bypass tokens grant admin, mentor, and student sessions with NO
// credential check. They must be opt-in, never merely "not production":
// `NODE_ENV !== 'production'` fails OPEN whenever NODE_ENV is unset or
// misspelled on a host, which would expose `demo-admin-token` publicly.
// Enabling now requires an explicit ENABLE_DEMO_LOGIN=true AND a non-production
// NODE_ENV, so a production deploy cannot switch it on by accident.
const isDev = process.env.NODE_ENV !== 'production'
const demoLoginEnabled = process.env.ENABLE_DEMO_LOGIN === 'true' && isDev

if (process.env.ENABLE_DEMO_LOGIN === 'true' && !isDev) {
  console.error('[auth] ENABLE_DEMO_LOGIN=true is ignored because NODE_ENV=production. Credential-free demo logins stay disabled.')
}

// Admin identities come from the ADMIN_EMAILS environment variable only.
//
// The previous hardcoded list included `admin@gmail.com` — an address on a
// public free-mail domain that anyone could register, sign up with, and be
// granted full admin rights over the platform. The `@admin.aagekya.com` suffix
// rule was equally unsafe: it trusted a self-asserted signup email, so anyone
// controlling any mail on that subdomain (or able to register it) became admin.
// Both are removed. Demo admin identities are dev-only, handled below.
const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || '')
  .split(',')
  .map(e => e.trim().toLowerCase())
  .filter(Boolean)

// Retrieve authenticated user from Supabase token; also fetches role from students table
export async function getAuthUser(authHeader) {
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null
  const token = authHeader.split(' ')[1]

  // Developer/Demo bypass — requires explicit ENABLE_DEMO_LOGIN=true opt-in
  if (demoLoginEnabled) {
    if (token === 'demo-student-token') {
      return {
        id: '00000000-0000-0000-0000-000000000001',
        email: 'demo-student@aagekya.com',
        role: 'student',
        user_metadata: { user_type: 'student' }
      }
    }
    if (token === 'demo-admin-token') {
      return {
        id: '00000000-0000-0000-0000-000000000002',
        email: 'demo-admin@aagekya.com',
        role: 'admin',
        user_metadata: { user_type: 'admin' }
      }
    }
    if (token === 'demo-mentor-token') {
      return {
        id: '00000000-0000-0000-0000-000000000003',
        email: 'demo-mentor@aagekya.com',
        role: 'mentor',
        user_metadata: { user_type: 'mentor' }
      }
    }
  }

  try {
    const { data: { user }, error } = await supabase.auth.getUser(token)
    if (error || !user) return null

    const email = (user.email || '').toLowerCase()

    // 1. Admin allow-list, sourced from server configuration (not user input).
    //    Requires a confirmed email so an unverified signup claiming an
    //    allow-listed address cannot gain admin rights.
    const emailConfirmed = Boolean(user.email_confirmed_at || user.confirmed_at)
    if (email && emailConfirmed && ADMIN_EMAILS.includes(email)) {
      user.role = 'admin'
      return user
    }

    // 2. Check students table profile role
    try {
      const { data: profile } = await supabase
        .from('students')
        .select('role')
        .eq('id', user.id)
        .maybeSingle()
      if (profile?.role) {
        user.role = profile.role
        return user
      }
    } catch (_) {}

    // 3. Check approved mentors table
    try {
      const { data: mentor } = await supabase
        .from('mentors')
        .select('id')
        .eq('email', email)
        .maybeSingle()
      if (mentor) {
        user.role = 'mentor'
        return user
      }
    } catch (_) {}

    user.role = 'student'
    return user
  } catch (err) {
    return null
  }
}

// Middleware: require a specific role (or any of a list of roles)
export function requireRole(...roles) {
  return async (req, res, next) => {
    const user = await getAuthUser(req.headers.authorization)
    if (!user) return res.status(401).json({ error: 'UNAUTHORIZED', message: 'Authentication required' })
    if (!roles.includes(user.role)) {
      return res.status(403).json({ error: 'FORBIDDEN', message: `Requires role: ${roles.join(' or ')}` })
    }
    req.authUser = user
    next()
  }
}

// Middleware: require any authenticated user (student, mentor, parent)
export function requireAuth() {
  return async (req, res, next) => {
    const user = await getAuthUser(req.headers.authorization)
    if (!user) return res.status(401).json({ error: 'UNAUTHORIZED', message: 'Authentication required' })
    req.authUser = user
    next()
  }
}
