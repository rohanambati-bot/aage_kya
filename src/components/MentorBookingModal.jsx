import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { useAuth } from '../context/AuthContext'
import { postMentorBook } from '../api'

const CLASS_LEVELS = ['10th', '12th', 'College']
const LANGUAGES = ['English', 'Hindi', 'Kannada', 'Tamil', 'Telugu', 'Marathi', 'Bengali', 'Other']

// "Book Mentor" request form (replaces the old Cal.com "Book Call" redirect).
// All sessions are conducted online, so there is no mode selection.
export default function MentorBookingModal({ mentor, onClose }) {
  const { session } = useAuth()

  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = ''
    }
  }, [])

  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    classLevel: '',
    areaOfInterest: '',
    preferredLanguage: '',
    preferredDate: '',
    preferredTime: '',
    guidanceQuery: '',
  })
  const [errors, setErrors] = useState({})
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')
  const [isSubmitted, setIsSubmitted] = useState(false)

  // Local YYYY-MM-DD for the date input's min attribute (avoids past dates).
  const todayStr = new Date().toISOString().slice(0, 10)

  const set = (field) => (e) => {
    setForm((prev) => ({ ...prev, [field]: e.target.value }))
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: '' }))
  }

  const validate = () => {
    const next = {}
    if (!form.name.trim()) next.name = 'Please enter your name.'
    if (!form.email.trim()) next.email = 'Please enter your email.'
    else if (!/\S+@\S+\.\S+/.test(form.email)) next.email = 'Please enter a valid email.'
    if (!form.classLevel) next.classLevel = 'Please select your current class.'
    if (!form.areaOfInterest.trim()) next.areaOfInterest = 'Please enter your area of interest.'
    if (!form.preferredLanguage) next.preferredLanguage = 'Please select a preferred language.'
    if (!form.preferredDate) next.preferredDate = 'Please pick a preferred date.'
    if (!form.preferredTime) next.preferredTime = 'Please pick a preferred time.'
    if (form.preferredDate && form.preferredTime) {
      const picked = new Date(`${form.preferredDate}T${form.preferredTime}`)
      if (Number.isNaN(picked.getTime())) {
        next.preferredDate = 'Please pick a valid date and time.'
      } else if (picked.getTime() < Date.now()) {
        next.preferredDate = 'Please pick a date and time in the future.'
      }
    }
    if (!form.guidanceQuery.trim()) next.guidanceQuery = 'Please tell us what guidance you need.'
    setErrors(next)
    return Object.keys(next).length === 0
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!validate()) return
    setSubmitting(true)
    setSubmitError('')
    try {
      // Combine the separate date + time inputs into a single ISO timestamp
      // for the backend (avoids the flaky native datetime-local widget).
      const preferredDateTime = new Date(`${form.preferredDate}T${form.preferredTime}`).toISOString()
      const res = await postMentorBook(
        {
          mentorId: mentor.id,
          contactName: form.name,
          contactEmail: form.email,
          contactPhone: form.phone,
          classLevel: form.classLevel,
          areaOfInterest: form.areaOfInterest,
          preferredLanguage: form.preferredLanguage,
          preferredDateTime,
          guidanceQuery: form.guidanceQuery,
        },
        session?.access_token
      )
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.message || 'Failed to submit booking request.')
      }
      setIsSubmitted(true)
    } catch (err) {
      setSubmitError(err.message || 'Something went wrong. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  const inputClass = (field) =>
    `w-full bg-navy-800 border rounded-xl px-4 py-2.5 text-white placeholder-gray-500 text-sm transition-all duration-200 outline-none focus:ring-2 focus:ring-saffron/40 ${
      errors[field] ? 'border-rose-500/50 focus:border-rose-500' : 'border-white/10 hover:border-white/20 focus:border-saffron/60'
    }`

  return createPortal(
    <div className="fixed inset-0 z-[9999] bg-black/80 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto animate-fade-in">
      <div className="relative w-full max-w-lg glass-card border border-white/15 p-6 md:p-8 rounded-3xl shadow-[0_25px_60px_-15px_rgba(0,0,0,0.8)] my-8">
        <button onClick={onClose} className="absolute top-4 right-4 w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-gray-400 hover:text-white transition-all">✕</button>
        {!isSubmitted ? (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="text-center mb-6">
              <div className="w-12 h-12 rounded-2xl bg-saffron/10 border border-saffron/30 flex items-center justify-center text-2xl mx-auto mb-3">📅</div>
              <h2 className="font-display text-2xl font-bold text-white">Book Mentor</h2>
              <p className="text-gray-400 text-xs mt-1">Request an online 1-on-1 session with {mentor?.name || 'this mentor'}.</p>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-300 mb-1">Full Name *</label>
              <input type="text" value={form.name} onChange={set('name')} placeholder="e.g. Rahul Sharma" className={inputClass('name')} />
              {errors.name && <p className="text-[10px] text-rose-400 mt-1">{errors.name}</p>}
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-300 mb-1">Email Address *</label>
              <input type="email" value={form.email} onChange={set('email')} placeholder="you@example.com" className={inputClass('email')} />
              {errors.email && <p className="text-[10px] text-rose-400 mt-1">{errors.email}</p>}
            </div>
            {submitError && <div className="bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs rounded-xl p-3">⚠️ {submitError}</div>}
            <button type="submit" disabled={submitting} className="w-full btn-primary py-2.5 text-xs font-semibold">
              {submitting ? 'Submitting...' : 'Confirm Session Request →'}
            </button>
          </form>
        ) : (
          <div className="text-center py-6">
            <div className="w-16 h-16 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-4xl mx-auto mb-4">✅</div>
            <h2 className="font-display text-2xl font-bold text-white mb-2">Booking Requested!</h2>
            <p className="text-gray-300 text-xs leading-relaxed max-w-sm mx-auto mb-6">
              Your mentor session has been booked successfully. Details will be shared to your registered email.
            </p>
            <button onClick={onClose} className="btn-primary px-8 py-2.5 text-xs">Done</button>
          </div>
        )}
      </div>
    </div>,
    document.body
  )
}
