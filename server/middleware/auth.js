import { supabase } from '../utils/db.js'

const isDev = process.env.NODE_ENV !== 'production'

const ADMIN_EMAILS = [
  'admin@aagekya.com',
  'admin@gmail.com',
  'demo-admin@aagekya.com',
  ...(process.env.ADMIN_EMAILS ? process.env.ADMIN_EMAILS.split(',') : [])
].map(e => e.trim().toLowerCase())

// Retrieve authenticated user from Supabase token; also fetches role from students table
export async function getAuthUser(authHeader) {
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null
  const token = authHeader.split(' ')[1]

  // Developer/Demo bypass — only active in development mode
  if (isDev) {
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

    // 1. Admin Email Whitelist check
    if (ADMIN_EMAILS.includes(email) || email.endsWith('@admin.aagekya.com')) {
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
