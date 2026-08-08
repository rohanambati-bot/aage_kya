import { useState } from 'react'
import { useNavigate, Link, useSearchParams } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import { useAuth } from '../context/AuthContext'

export default function Auth() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const returnTo = searchParams.get('returnTo') || '/dashboard'

  const { loginAsDemo, continueAsGuest } = useAuth()
  const [tab, setTab]           = useState('password')   // 'password' | 'magic'
  const [mode, setMode]         = useState('signin')     // 'signin' | 'signup'
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm]   = useState('')
  const [userType, setUserType] = useState('student')   // student | mentor
  const [loading, setLoading]   = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const [success, setSuccess]   = useState(false)
  const [successMsg, setSuccessMsg] = useState('')

  const handleDemoLogin = (role, classLevel = 'class12') => {
    loginAsDemo(role, email || `demo-${role}@aagekya.com`, classLevel)
    if (role === 'admin') {
      navigate('/admin-dashboard')
    } else if (role === 'mentor') {
      navigate('/mentor-dashboard')
    } else {
      navigate(returnTo)
    }
  }

  const handleMagicLink = async (e) => {
    e.preventDefault()
    if (!email.trim()) return setErrorMsg('Please enter your email.')
    const normEmail = email.trim().toLowerCase()

    setLoading(true)
    setErrorMsg('')
    const { error } = await supabase.auth.signInWithOtp({
      email: normEmail,
      options: {
        emailRedirectTo: window.location.origin,
        data: { user_type: userType }
      },
    })
    setLoading(false)
    if (error) return setErrorMsg(error.message)
    setSuccess(true)
    setSuccessMsg(`Magic link sent to ${email}. Click it in your inbox to log in!`)
  }

  const handleEmailPassword = async (e) => {
    e.preventDefault()
    setErrorMsg('')
    localStorage.removeItem('aageKyaDemoSession')
    if (!email.trim() || !password)
      return setErrorMsg('Please fill in all fields.')

    const normEmail = email.trim().toLowerCase()

    if (mode === 'signup') {
      if (password.length < 6)
        return setErrorMsg('Password must be at least 6 characters.')
      if (password !== confirm)
        return setErrorMsg('Passwords do not match.')
    }

    setLoading(true)
    let error
    if (mode === 'signup') {
      const { error: e } = await supabase.auth.signUp({
        email: normEmail,
        password,
        options: {
          emailRedirectTo: window.location.origin,
          data: { user_type: userType }
        },
      })
      error = e
      if (!error) {
        setSuccess(true)
        setSuccessMsg(`Account created! Check ${email} for a confirmation link.`)
      }
    } else {
      const { error: e } = await supabase.auth.signInWithPassword({ email: normEmail, password })
      error = e
      if (!error) {
        const { data: { user } } = await supabase.auth.getUser()
        if (user) {
          const { data: dbProfile } = await supabase
            .from('students')
            .select('role')
            .eq('id', user.id)
            .maybeSingle()
          const userRole = dbProfile?.role || (userType === 'mentor' ? 'mentor' : 'student')

          if (userRole === 'admin') {
            navigate('/admin-dashboard')
          } else if (userRole === 'mentor') {
            navigate('/mentor-dashboard')
          } else {
            navigate(returnTo)
          }
        }
      }
    }
    setLoading(false)
    if (error) setErrorMsg(error.message)
  }

  return (
    <div className="min-h-screen pt-24 pb-16 flex items-center justify-center px-4 bg-navy relative overflow-hidden font-sans">
      {/* Dynamic ambient blur background */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-saffron/10 rounded-full blur-[140px] animate-float-slow" />
        <div className="absolute bottom-10 right-10 w-[400px] h-[400px] bg-blue-600/10 rounded-full blur-[120px]" />
      </div>

      <div className="relative z-10 w-full max-w-md">
        <div className="glass-card border border-white/15 p-8 rounded-3xl shadow-[0_25px_60px_-15px_rgba(0,0,0,0.8)] backdrop-blur-xl">
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-saffron/20 via-saffron to-saffron/20" />

          {/* Header */}
          <div className="text-center mb-6">
            <Link to="/" className="inline-flex items-center gap-2 mb-4">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-saffron to-saffron-dark flex items-center justify-center text-white font-bold font-display shadow-lg shadow-saffron/20">
                AK
              </div>
              <span className="font-display font-bold text-xl text-white">Aage Kya?</span>
            </Link>
            <h1 className="font-display text-2xl font-bold text-white mt-1">
              {mode === 'signup' ? 'Create your account' : 'Welcome back'}
            </h1>
            <p className="text-gray-400 text-xs mt-1">Access personalized guidance, roadmaps &amp; mentor connections</p>
          </div>

          {/* User Type selector */}
          <div className="grid grid-cols-2 gap-2 bg-white/5 p-1 rounded-xl mb-5">
            <button
              type="button"
              onClick={() => setUserType('student')}
              className={`py-2 rounded-lg text-xs font-semibold transition-all ${
                userType === 'student' ? 'bg-saffron text-white shadow-md' : 'text-gray-400 hover:text-white'
              }`}
            >
              🎓 Student / Aspirant
            </button>
            <button
              type="button"
              onClick={() => setUserType('mentor')}
              className={`py-2 rounded-lg text-xs font-semibold transition-all ${
                userType === 'mentor' ? 'bg-saffron text-white shadow-md' : 'text-gray-400 hover:text-white'
              }`}
            >
              🌟 Mentor
            </button>
          </div>

          {/* Auth Tab switcher */}
          <div className="flex bg-white/5 rounded-xl p-1 mb-5">
            <button
              onClick={() => { setErrorMsg(''); setTab('password') }}
              className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                tab === 'password' ? 'bg-white/15 text-white' : 'text-gray-400 hover:text-white'
              }`}
            >
              Email &amp; Password
            </button>
            <button
              onClick={() => { setErrorMsg(''); setTab('magic') }}
              className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                tab === 'magic' ? 'bg-white/15 text-white' : 'text-gray-400 hover:text-white'
              }`}
            >
              Magic Link
            </button>
          </div>

          {/* Success state */}
          {success ? (
            <div className="text-center py-6">
              <div className="w-16 h-16 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-3xl mx-auto mb-4">
                ✉️
              </div>
              <h2 className="font-display text-xl font-bold text-white mb-2">Check your email!</h2>
              <p className="text-gray-300 text-xs leading-relaxed max-w-xs mx-auto mb-6">{successMsg}</p>
              <button onClick={() => navigate(returnTo)} className="btn-primary px-8 py-2.5 text-xs w-full">
                Continue to App
              </button>
            </div>
          ) : (
            <>
              {errorMsg && (
                <div className="bg-rose-500/10 border border-rose-500/25 rounded-xl p-3 text-rose-300 text-xs mb-4 flex flex-col gap-2">
                  <span>⚠️ {errorMsg}</span>
                  <button
                    type="button"
                    onClick={() => handleDemoLogin(userType)}
                    className="text-left text-saffron hover:underline font-bold"
                  >
                    ⚡ Bypass &amp; enter instant demo as {userType === 'mentor' ? 'Mentor' : 'Student'} →
                  </button>
                </div>
              )}

              {tab === 'magic' ? (
                <form onSubmit={handleMagicLink} className="space-y-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-300 mb-1">Email address</label>
                    <input
                      type="email"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      placeholder="you@example.com"
                      className="w-full bg-[#111827] border border-white/10 hover:border-white/20 focus:border-saffron/60 rounded-xl px-4 py-2.5 text-white placeholder-gray-500 text-xs transition-all outline-none focus:ring-2 focus:ring-saffron/30"
                      required
                    />
                  </div>
                  <button type="submit" disabled={loading} className="btn-primary w-full py-2.5 text-xs font-semibold">
                    {loading ? 'Sending link...' : '✨ Send Magic Link'}
                  </button>
                </form>
              ) : (
                <form onSubmit={handleEmailPassword} className="space-y-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-300 mb-1">Email address</label>
                    <input
                      type="email"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      placeholder="you@example.com"
                      className="w-full bg-[#111827] border border-white/10 hover:border-white/20 focus:border-saffron/60 rounded-xl px-4 py-2.5 text-white placeholder-gray-500 text-xs transition-all outline-none focus:ring-2 focus:ring-saffron/30"
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
                      className="w-full bg-[#111827] border border-white/10 hover:border-white/20 focus:border-saffron/60 rounded-xl px-4 py-2.5 text-white placeholder-gray-500 text-xs transition-all outline-none focus:ring-2 focus:ring-saffron/30"
                      required
                    />
                  </div>

                  {mode === 'signup' && (
                    <div>
                      <label className="block text-xs font-medium text-gray-300 mb-1">Confirm Password</label>
                      <input
                        type="password"
                        value={confirm}
                        onChange={e => setConfirm(e.target.value)}
                        placeholder="••••••••"
                        className="w-full bg-[#111827] border border-white/10 hover:border-white/20 focus:border-saffron/60 rounded-xl px-4 py-2.5 text-white placeholder-gray-500 text-xs transition-all outline-none focus:ring-2 focus:ring-saffron/30"
                        required
                      />
                    </div>
                  )}

                  <button type="submit" disabled={loading} className="btn-primary w-full py-2.5 text-xs font-semibold">
                    {loading ? 'Processing...' : mode === 'signup' ? 'Create Account' : 'Sign In'}
                  </button>
                </form>
              )}

              {/* Mode switch */}
              <div className="mt-5 pt-4 border-t border-white/10 text-center flex justify-between items-center text-xs">
                <span className="text-gray-400">
                  {mode === 'signup' ? 'Already have an account?' : "Don't have an account?"}
                </span>
                <button
                  type="button"
                  onClick={() => { setErrorMsg(''); setMode(mode === 'signup' ? 'signin' : 'signup') }}
                  className="text-saffron font-bold hover:underline"
                >
                  {mode === 'signup' ? 'Sign In' : 'Sign Up'}
                </button>
              </div>

              {/* Admin login shortcut */}
              <div className="mt-4 text-center">
                <Link to="/admin-login" className="text-[11px] text-gray-500 hover:text-gray-300 transition-colors">
                  🛡️ Admin Portal Login →
                </Link>
              </div>

              {/* Always-Visible Demo Sandbox Bypass Section for Judges */}
              <div className="mt-6 pt-5 border-t border-white/10">
                <div className="relative mb-4 flex items-center justify-center">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-saffron/20" />
                  </div>
                  <span className="relative z-10 px-3 bg-[#0d1424] text-[10px] font-bold text-saffron uppercase tracking-wider rounded-full border border-saffron/30 py-0.5">
                    ⚡ Instant Demo Sandbox (1-Click Judge Access)
                  </span>
                </div>

                <div className="space-y-2">
                  <button
                    type="button"
                    onClick={async () => {
                      await continueAsGuest()
                      navigate(returnTo)
                    }}
                    className="w-full py-2.5 rounded-xl border border-sky-500/30 bg-sky-500/10 hover:bg-sky-500/20 text-sky-300 text-xs font-bold transition-all duration-200 flex items-center justify-center gap-2 shadow-sm hover:scale-[1.01]"
                  >
                    🚀 Continue as Guest (No Login Required)
                  </button>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => handleDemoLogin('student', 'class10')}
                      className="py-2.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 text-xs font-semibold transition-all duration-200 flex items-center justify-center gap-1 hover:scale-[1.01]"
                    >
                      ⚡ Student (10th)
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDemoLogin('student', 'class12')}
                      className="py-2.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 text-xs font-semibold transition-all duration-200 flex items-center justify-center gap-1 hover:scale-[1.01]"
                    >
                      ⚡ Student (12th)
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => handleDemoLogin('mentor')}
                      className="py-2.5 rounded-xl border border-indigo-500/30 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-300 text-xs font-semibold transition-all duration-200 flex items-center justify-center gap-1 hover:scale-[1.01]"
                    >
                      ⚡ Mentor Demo
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDemoLogin('admin')}
                      className="py-2.5 rounded-xl border border-rose-500/30 bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 text-xs font-semibold transition-all duration-200 flex items-center justify-center gap-1 hover:scale-[1.01]"
                    >
                      🛡️ Admin Demo
                    </button>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
