/**
 * Deterministic fallback chat responder.
 *
 * Used by POST /api/chat when the LLM is unavailable (no key, rate limited, or
 * provider outage). Previously this lived as dead code inside
 * `routes/notifications.js` while `routes/chat.js` referenced it as a free
 * variable, which threw a ReferenceError on every AI failure.
 */
export function getMockChatResponse(messages, profile) {
  const lastMsg = (messages?.[messages.length - 1]?.content || '').toLowerCase()
  let response = "That's an interesting question! Can you tell me more about your current stream and what interests you?"
  let handoff = false
  let handoff_reason = ''

  if (profile) {
    const name = profile.full_name ? ` ${profile.full_name}` : ''
    const stream = profile.stream || 'your selected stream'
    const classLevel = profile.class_level === 'class10' ? 'Class 10' : profile.class_level === 'class12' ? 'Class 12' : 'school'

    if (lastMsg.includes('engineering') || lastMsg.includes('btech') || lastMsg.includes('b.tech') || lastMsg.includes('computer')) {
      if (profile.class_level === 'class12' && (profile.stream === 'Science' || profile.stream === 'Science (PCM)')) {
        response = `Hey${name}, since you are in Class 12 Science (marks: ${profile.marks || 'N/A'}, state: ${profile.state || 'N/A'}), engineering is a great path. You should prepare for exams like JEE and KCET/COMEDK. Your preferred admission mode is ${profile.preferred_admission || 'KCET'}.`
      } else {
        response = `Hi${name}, you mentioned you are in ${classLevel} with ${stream} stream. Typically, engineering requires Science (PCM) in Class 12. Let me know if you want to know about other options!`
      }
    } else if (lastMsg.includes('commerce') || lastMsg.includes('ca') || lastMsg.includes('bba')) {
      response = `Hi${name}, since you are in ${classLevel} and interested in Commerce/CA, you should focus on Accounting and Economics. We recommend checking BBA or B.Com programs in your preferred cities.`
    } else if (lastMsg.includes('scholarship') || lastMsg.includes('fee') || lastMsg.includes('cost')) {
      response = `Hi${name}, based on your profile (State: ${profile.state || 'N/A'}, Marks: ${profile.marks || 'N/A'}), we suggest checking the Scholarships tab on your Dashboard to see matching national and state benefits.`
    } else {
      response = `Hey${name}, based on your ${classLevel} ${stream} profile, how else can I help guide your education planning?`
    }
  } else {
    if (lastMsg.includes('engineering') || lastMsg.includes('btech') || lastMsg.includes('b.tech') || lastMsg.includes('computer')) {
      response = 'Engineering (especially Computer Science) is highly popular. For high-quality, honest advice tailored to you, please fill out our Onboarding form so I know your class board, marks, and state.'
      handoff = true
      handoff_reason = 'Need student board and marks to suggest realistic engineering options.'
    } else if (lastMsg.includes('commerce') || lastMsg.includes('ca') || lastMsg.includes('bba')) {
      response = 'Commerce fields like CA, BBA, and finance offer amazing opportunities. I can give you a personalized 4-year roadmap if you complete the Onboarding profile first.'
      handoff = true
      handoff_reason = 'Requires family income range and preferred cities to tailor finance options.'
    } else if (lastMsg.includes('scholarship') || lastMsg.includes('fee') || lastMsg.includes('cost')) {
      response = 'We have mapped several state-specific and national scholarships in our database. Complete the onboarding so we can filter ones matching your family income!'
      handoff = true
      handoff_reason = 'Requires family income range and state to filter scholarships.'
    }
  }

  return { message: response, handoff, handoff_reason }
}
