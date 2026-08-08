import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import { useAuth } from '../context/AuthContext'

export default function AdminLogin() {
  const navigate = useNavigate()
  const { loginAsDemo } = useAuth()
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading]   = useState(false)
  const [errorMsg, setErrorMsg] = useState('')

  const ADMIN_EMAILS = ['admin@aagekya.com', 'admin@gmail.com', 'demo-admin@aagekya.com']

  const handleAdminLogin = async (e) => {
    e.preventDefault()
    setErrorMsg('')

    const normEmail = email.trim().toLowerCase()
    if (!normEmail || !password) return setErrorMsg('Please enter both Admin Email & Password.')

    // Whitelist check
    if (!ADMIN_EMAILS.includes(normEmail) && !normEmail.endsWith('@admin.aagekya.com')) {
      return setErrorMsg(`Access Denied: "${email}" is not an authorized Admin email address.`)
    }

    setLoading(true)
    const { error } = await supabase.auth.signInWithPassword({ email: normEmail, password })
    setLoading(false)

    if (error) {
      setErrorMsg(error.message)
    } else {
      navigate('/admin-dashboard')
    }
  }

  const handleBypassAdminDemo = () => {
    loginAsDemo('admin', email || 'admin@aagekya.com', 'class12')
    navigate('/admin-dashboard')
  }

  return (
    <div className="min-h-screen pt-24 pb-16 flex items-center justify-center px-4 bg-navy relative overflow-hidden">
      {/* Background ambient glow */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-rose-600/10 rounded-full blur-[160px]" />
      </div>

      <div className="relative z-10 w-full max-w-md">
        <div className="glass-card border border-rose-500/20 p-8 rounded-3xl shadow-[0_25px_60px_-15px_rgba(225,29,72,0.15)] backdrop-blur-xl">
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-rose-500/20 via-rose-500 to-rose-500/20" />

          {/* Header */}
          <div className="text-center mb-6">
            <div className="w-12 h-12 rounded-2xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-2xl mx-auto mb-3">
              🛡️
            </div>
            <h1 className="font-display text-2xl font-bold text-white">Admin Control Portal</h1>
            <p className="text-gray-400 text-xs mt-1">Authorized personnel login only</p>
          </div>

          {errorMsg && (
            <div className="bg-rose-500/10 border border-rose-500/25 rounded-xl p-3 text-rose-300 text-xs mb-4 flex flex-col gap-2">
              <span>⚠️ {errorMsg}</span>
              <button
                type="button"
                onClick={handleBypassAdminDemo}
                className="text-left text-rose-400 hover:underline font-bold"
              >
                ⚡ Bypass &amp; Log In as Demo Admin →
              </button>
            </div>
          )}

          <form onSubmit={handleAdminLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-gray-300 mb-1">Admin Email</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="admin@aagekya.com"
                className="w-full bg-[#111827] border border-white/10 hover:border-white/20 focus:border-rose-500/60 rounded-xl px-4 py-2.5 text-white placeholder-gray-500 text-xs transition-all outline-none focus:ring-2 focus:ring-rose-500/30"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-300 mb-1">Password</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-[#111827] border border-white/10 hover:border-white/20 focus:border-rose-500/60 rounded-xl px-4 py-2.5 text-white placeholder-gray-500 text-xs transition-all outline-none focus:ring-2 focus:ring-rose-500/30"
                required
              />
            </div>

            <button type="submit" disabled={loading} className="w-full bg-gradient-to-r from-rose-600 to-rose-700 hover:from-rose-500 hover:to-rose-600 text-white font-semibold py-2.5 rounded-xl text-xs shadow-lg shadow-rose-900/40 transition-all">
              {loading ? 'Authenticating...' : 'Access Admin Panel'}
            </button>
          </form>

          {/* Always-visible Demo Admin Bypass button for judges */}
          <div className="mt-5 pt-4 border-t border-rose-500/20">
            <button
              type="button"
              onClick={handleBypassAdminDemo}
              className="w-full py-2.5 rounded-xl border border-rose-500/30 bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 text-xs font-bold transition-all duration-200 flex items-center justify-center gap-1.5 shadow-sm hover:scale-[1.01]"
            >
              ⚡ 1-Click Judge Access: Log In as Demo Admin →
            </button>
          </div>

          <div className="mt-4 text-center">
            <Link to="/auth" className="text-xs text-gray-400 hover:text-white transition-colors">
              ← Return to Student / Mentor Login
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
