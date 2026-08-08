import { useState, useEffect, useRef } from 'react'
import { NavLink, Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import SearchBar from './SearchBar'

export default function Navbar() {
  const { user, profile, signOut, loginAsDemo, continueAsGuest } = useAuth()

  const onboardingLink = '/onboarding'
  const resultLink = profile?.class_level === 'class10' ? '/class10/result' : '/result'

  const isAdminUser = profile?.role === 'admin'
  const isMentorUser = profile?.role === 'mentor'

  const navLinks = isAdminUser
    ? [{ to: '/admin-dashboard', label: 'Admin', icon: '🔑' }]
    : isMentorUser
    ? [{ to: '/mentor-dashboard', label: 'Mentor Hub', icon: '🌟' }]
    : [
        { to: '/',           label: 'Home',       icon: '🏠' },
        { to: '/explore',    label: 'Explore',    icon: '🎯' },
        { to: onboardingLink, label: 'Get Started', icon: '🚀' },
        { to: '/career-pipeline', label: 'Careers', icon: '🎓' },
        { to: '/mentors',    label: 'Mentors',    icon: '🌟' },
      ]

  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [demoDropdownOpen, setDemoDropdownOpen] = useState(false)
  const dropdownRef = useRef(null)
  const demoDropdownRef = useRef(null)
  const navigate = useNavigate()

  // Close dropdowns on outside click
  useEffect(() => {
    const handler = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setDropdownOpen(false)
      }
      if (demoDropdownRef.current && !demoDropdownRef.current.contains(e.target)) {
        setDemoDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const handleSignOut = async () => {
    setDropdownOpen(false)
    await signOut()
    navigate('/')
  }

  const initials = user?.email?.[0]?.toUpperCase() ?? '?'
  const isMentor = profile?.role === 'mentor'
  const isAdmin = profile?.role === 'admin'

  return (
    <div className="fixed bottom-6 inset-x-0 z-50 flex justify-center items-center pointer-events-none font-sans px-2">
      <nav className="pointer-events-auto max-w-[98vw] sm:max-w-fit animate-slide-up">
        {/* Floating dock with glassmorphism */}
        <div className="relative flex items-center gap-1.5 sm:gap-2 px-3.5 py-2 bg-[#0D1424]/90 backdrop-blur-2xl border border-sky-400/30 rounded-full shadow-[0_20px_50px_rgba(0,0,0,0.6)] hover:border-sky-300/60 transition-all duration-300">
          
          {/* Brand Logo Pill */}
          <Link 
            to={isAdminUser ? '/admin-dashboard' : isMentorUser ? '/mentor-dashboard' : '/'} 
            className="flex items-center gap-2 pl-1.5 pr-3 py-1 rounded-full bg-sky-500/10 hover:bg-sky-500/20 border border-sky-400/30 transition-all duration-200 hover:scale-105"
          >
            <div className="w-5 h-5 rounded-full bg-gradient-to-br from-blue-500 to-rose-500 flex items-center justify-center text-white font-black text-[9px] font-display shadow-sm">
              AK
            </div>
            <span className="text-white font-black text-xs hidden md:inline font-display tracking-tight">Aage Kya?</span>
          </Link>

          {/* Navigation Tabs */}
          <div className="flex items-center gap-1">
            {navLinks.map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                end={link.to === '/'}
                className={({ isActive }) =>
                  `relative flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all duration-200 ${
                    isActive
                      ? 'text-white bg-gradient-to-r from-blue-600/30 via-indigo-600/30 to-rose-600/30 border border-sky-400/40 font-black shadow-[0_0_15px_rgba(56,189,248,0.3)]'
                      : 'text-slate-300 hover:text-white hover:bg-white/10'
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    <span className="text-sm leading-none">{link.icon}</span>
                    <span className="hidden sm:inline">{link.label}</span>
                    {isActive && (
                      <span className="absolute -top-0.5 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-sky-300 animate-pulse" />
                    )}
                  </>
                )}
              </NavLink>
            ))}
          </div>

          {/* Search Trigger */}
          <SearchBar isCompact />

          {/* 1-Click Demo Login Dropup */}
          {!user && (
            <div className="relative" ref={demoDropdownRef}>
              <button
                onClick={() => setDemoDropdownOpen(!demoDropdownOpen)}
                className="flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-black bg-gradient-to-r from-sky-400/20 to-rose-400/20 border border-sky-300/30 text-sky-200 hover:text-white transition-all duration-200 hover:scale-105"
              >
                <span>⚡ Demo</span>
              </button>

              {demoDropdownOpen && (
                <div className="absolute right-0 bottom-full mb-3 w-60 max-h-[75vh] overflow-y-auto bg-[#141D33]/95 backdrop-blur-2xl rounded-2xl border border-sky-400/40 shadow-2xl animate-scale-in z-50 p-2 space-y-1">
                  <div className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-sky-300 border-b border-white/10 mb-1">
                    ⚡ 1-Click Judge Access
                  </div>
                  <button
                    onClick={() => { setDemoDropdownOpen(false); loginAsDemo('student', 'demo-student-10th@aagekya.com', 'class10'); navigate('/dashboard'); }}
                    className="flex items-center gap-2 w-full px-3 py-2 rounded-xl text-xs font-semibold text-emerald-300 bg-emerald-500/10 hover:bg-emerald-500/20 text-left transition-colors"
                  >
                    <span>🎓</span> <span>Student Demo (10th)</span>
                  </button>
                  <button
                    onClick={() => { setDemoDropdownOpen(false); loginAsDemo('student', 'demo-student-12th@aagekya.com', 'class12'); navigate('/dashboard'); }}
                    className="flex items-center gap-2 w-full px-3 py-2 rounded-xl text-xs font-semibold text-emerald-300 bg-emerald-500/10 hover:bg-emerald-500/20 text-left transition-colors"
                  >
                    <span>🎓</span> <span>Student Demo (12th)</span>
                  </button>
                  <button
                    onClick={() => { setDemoDropdownOpen(false); loginAsDemo('mentor'); navigate('/mentor-dashboard'); }}
                    className="flex items-center gap-2 w-full px-3 py-2 rounded-xl text-xs font-semibold text-indigo-300 bg-indigo-500/10 hover:bg-indigo-500/20 text-left transition-colors"
                  >
                    <span>🧭</span> <span>Mentor Demo</span>
                  </button>
                  <button
                    onClick={() => { setDemoDropdownOpen(false); loginAsDemo('admin'); navigate('/admin-dashboard'); }}
                    className="flex items-center gap-2 w-full px-3 py-2 rounded-xl text-xs font-semibold text-rose-300 bg-rose-500/10 hover:bg-rose-500/20 text-left transition-colors"
                  >
                    <span>🛡️</span> <span>Admin Demo</span>
                  </button>
                  <button
                    onClick={async () => { setDemoDropdownOpen(false); await continueAsGuest(); navigate('/explore'); }}
                    className="flex items-center gap-2 w-full px-3 py-2 rounded-xl text-xs font-semibold text-sky-300 bg-sky-500/10 hover:bg-sky-500/20 text-left transition-colors"
                  >
                    <span>🚀</span> <span>Guest Mode</span>
                  </button>
                </div>
              )}
            </div>
          )}

          {/* User Account / Sign In Dropup */}
          {user ? (
            <div className="relative" ref={dropdownRef}>
              <button
                onClick={() => setDropdownOpen(!dropdownOpen)}
                className="flex items-center gap-1.5 bg-white/10 hover:bg-white/20 border border-white/15 rounded-full px-2.5 py-1 transition-all duration-200 hover:scale-105"
              >
                <div className="w-5 h-5 rounded-full bg-gradient-to-br from-blue-500 to-rose-500 flex items-center justify-center text-white text-[10px] font-black">
                  {initials}
                </div>
                <span className="text-slate-200 text-xs font-semibold max-w-[75px] truncate hidden md:inline">{user.email}</span>
              </button>

              {dropdownOpen && (
                <div className="absolute right-0 bottom-full mb-3 w-60 max-h-[75vh] overflow-y-auto bg-[#141D33]/95 backdrop-blur-2xl rounded-2xl border border-sky-400/40 shadow-2xl animate-scale-in z-50 p-2 space-y-1">
                  <div className="px-3 py-2 border-b border-white/10">
                    <p className="text-white text-xs font-bold truncate">{user.email}</p>
                    <p className="text-slate-400 text-[10px] capitalize mt-0.5">
                      {isAdmin ? '🔑 Admin' : isMentor ? '🌟 Mentor' : '🎓 Student'}
                    </p>
                  </div>
                  {!isAdmin && !isMentor && (
                    <Link to="/dashboard" onClick={() => setDropdownOpen(false)} className="flex items-center gap-2 w-full px-3 py-2 rounded-xl text-xs text-slate-300 hover:text-white hover:bg-white/10 transition-colors">
                      👤 Dashboard
                    </Link>
                  )}
                  {isAdmin && (
                    <Link to="/admin-dashboard" onClick={() => setDropdownOpen(false)} className="flex items-center gap-2 w-full px-3 py-2 rounded-xl text-xs text-slate-300 hover:text-white hover:bg-white/10 transition-colors">
                      🔑 Admin Dashboard
                    </Link>
                  )}
                  {isMentor && (
                    <Link to="/mentor-dashboard" onClick={() => setDropdownOpen(false)} className="flex items-center gap-2 w-full px-3 py-2 rounded-xl text-xs text-slate-300 hover:text-white hover:bg-white/10 transition-colors">
                      🌟 Mentor Dashboard
                    </Link>
                  )}
                  {!isAdmin && !isMentor && (
                    <Link to={resultLink} onClick={() => setDropdownOpen(false)} className="flex items-center gap-2 w-full px-3 py-2 rounded-xl text-xs text-slate-300 hover:text-white hover:bg-white/10 transition-colors">
                      🧭 My Results
                    </Link>
                  )}
                  <button onClick={handleSignOut} className="flex items-center gap-2 w-full px-3 py-2 rounded-xl text-xs text-rose-400 hover:bg-rose-500/10 transition-colors">
                    🚪 Sign Out
                  </button>
                </div>
              )}
            </div>
          ) : (
            <Link
              to="/auth"
              className="btn-primary text-xs py-1.5 px-4 rounded-full font-black shadow-md hover:scale-105 transition-all"
            >
              Sign In
            </Link>
          )}
        </div>
      </nav>
    </div>
  )
}
