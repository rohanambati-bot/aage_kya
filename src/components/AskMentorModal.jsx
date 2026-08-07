import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { postMentorAsk } from '../api'

const CATEGORIES = [
  'Career Guidance',
  'Stream / Subject Choice',
  'College Admissions',
  'Exam Preparation',
  'Study Abroad',
  'Scholarships',
  'Project / Skills Help',
  'Other',
]

// "Ask Mentor" async messaging modal (replaces the old real-time "Chat Now").
// A student sends a question; the mentor replies later from their dashboard.
export default function AskMentorModal({ mentor, onClose }) {
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
    classLevel: '',
    subject: '',
    category: '',
    question: '',
  })
  const [errors, setErrors] = useState({})
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')
  const [isSubmitted, setIsSubmitted] = useState(false)

  const set = (field) => (e) => {
    setForm((prev) => ({ ...prev, [field]: e.target.value }))
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: '' }))
  }

  const validate = () => {
    const next = {}
    if (!form.name.trim()) next.name = 'Please enter your name.'
    if (!form.email.trim()) next.email = 'Please enter your email.'
    else if (!/\S+@\S+\.\S+/.test(form.email)) next.email = 'Please enter a valid email.'
    if (!form.classLevel) next.classLevel = 'Please select your class.'
    if (!form.subject.trim()) next.subject = 'Please enter a subject.'
    if (!form.category) next.category = 'Please select a category.'
    if (!form.question.trim()) next.question = 'Please type your question.'
    setErrors(next)
    return Object.keys(next).length === 0
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!validate()) return
    setSubmitting(true)
    setSubmitError('')
    try {
      const res = await postMentorAsk(
        {
          mentorId: mentor.id,
          contactName: form.name,
          contactEmail: form.email,
          classLevel: form.classLevel,
          subject: form.subject,
          category: form.category,
          question: form.question,
        },
        session?.access_token
      )
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.message || 'Failed to send your question.')
      }
      setIsSubmitted(true)
    } catch (err) {
      setSubmitError(err.message || 'Something went wrong. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return createPortal(
    <div className="fixed inset-0 z-[9999] bg-black/80 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto animate-fade-in">
      <div className="relative w-full max-w-lg glass-card border border-white/15 p-6 md:p-8 rounded-3xl shadow-[0_25px_60px_-15px_rgba(0,0,0,0.8)] my-8">
        <button onClick={onClose} className="absolute top-4 right-4 w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-gray-400 hover:text-white transition-all">✕</button>
        <div className="mb-6">
          <h3 className="font-display text-2xl font-bold text-white">Ask {mentor?.name || 'Mentor'}</h3>
          <p className="text-gray-400 text-xs mt-1">Get authentic, personalized advice directly from someone who walked this path.</p>
        </div>
        {!isSubmitted ? (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-gray-300 mb-1">Your Name</label>
              <input type="text" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="w-full bg-[#111827] border border-white/10 rounded-xl px-4 py-2 text-white text-xs" required />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-300 mb-1">Your Question</label>
              <textarea rows={4} value={form.question} onChange={e => setForm({ ...form, question: e.target.value })} placeholder="What would you like to know?" className="w-full bg-[#111827] border border-white/10 rounded-xl px-4 py-2 text-white text-xs" required />
            </div>
            {submitError && <div className="bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs rounded-xl p-3">⚠️ {submitError}</div>}
            <button type="submit" disabled={submitting} className="w-full btn-primary py-2.5 text-xs">
              {submitting ? 'Sending...' : 'Send Question →'}
            </button>
          </form>
        ) : (
          <div className="text-center py-6">
            <div className="w-12 h-12 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-2xl mx-auto mb-3">✅</div>
            <h4 className="font-display text-xl font-bold text-white mb-2">Question Sent!</h4>
            <p className="text-gray-300 text-xs mb-4">Your question has been sent to {mentor?.name}. You can track it under "My Mentor Requests".</p>
            <button onClick={onClose} className="btn-primary px-6 py-2 text-xs">Done</button>
          </div>
        )}
      </div>
    </div>,
    document.body
  )
}
