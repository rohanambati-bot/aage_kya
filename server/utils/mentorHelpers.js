import { verifyLinkedInProfile } from '../engine/linkedinVerifier.js'
import { supabase, supabaseAdmin } from './db.js'

export async function verifyAndUpdateApplication(appId, linkedinUrl, applicantPayload) {
  const client = supabaseAdmin || supabase
  try {
    const vResult = await verifyLinkedInProfile(linkedinUrl, applicantPayload)

    const updatePayload = {
      verification_status: vResult.verification_status,
      verification_data: vResult,
      verified_at: vResult.verified_at,
      verification_source: 'linkedin',
      linkedin_name_match_score: vResult.linkedin_name_match_score,
    }

    const { error } = await client
      .from('mentor_applications')
      .update(updatePayload)
      .eq('id', appId)

    if (error) {
      console.warn(`[verifyAndUpdateApplication] DB update skipped or column missing for app ${appId}:`, error.message)
    }
    return vResult
  } catch (vErr) {
    console.error(`[verifyAndUpdateApplication] Failed to verify app ${appId}:`, vErr.message)
    return null
  }
}
