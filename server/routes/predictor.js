import express from 'express'
import { HISTORICAL_CUTOFFS } from '../cutoffsData.js'

const router = express.Router()

// ─── Rank Predictor (Historical Cutoff Comparison) ───────────────────────────
// Data source: server/cutoffsData.js (HISTORICAL_CUTOFFS)
// These endpoints power src/components/RankPredictor.jsx.
// NOTE: Labels compare a rank against the latest stored closing rank. They are
// historical comparisons, NOT calibrated admission probabilities.

// Default category per exam, used as a fallback when the requested category
// has no rows for a given college/course.
const DEFAULT_CATEGORY = { KCET: 'GM', JEE: 'General', NEET: 'General' }

// Group flat cutoff rows into { college_name, course, trends: [{year, closing_rank}] }
// filtered by exam + category (with graceful fallback to the exam default category).
function buildCutoffGroups(exam, category) {
  const examRows = HISTORICAL_CUTOFFS.filter(
    (r) => r.exam === (exam || '').toUpperCase()
  )
  const fallbackCategory = DEFAULT_CATEGORY[(exam || '').toUpperCase()] || 'General'

  const groups = new Map()
  for (const row of examRows) {
    const key = `${row.college_name}||${row.course}`
    if (!groups.has(key)) {
      groups.set(key, {
        college_name: row.college_name,
        course: row.course,
        rowsByCategory: {},
      })
    }
    const g = groups.get(key)
    if (!g.rowsByCategory[row.category]) g.rowsByCategory[row.category] = []
    g.rowsByCategory[row.category].push(row)
  }

  const result = []
  for (const g of groups.values()) {
    // Pick requested category, else fall back to the exam default.
    let rows = g.rowsByCategory[category]
    if (!rows || rows.length === 0) rows = g.rowsByCategory[fallbackCategory]
    if (!rows || rows.length === 0) continue

    const trends = rows
      .map((r) => ({ year: r.year, closing_rank: r.closing_rank }))
      .sort((a, b) => a.year - b.year)

    result.push({
      college_name: g.college_name,
      course: g.course,
      trends,
      latest_closing_rank: trends[trends.length - 1].closing_rank,
    })
  }
  return result
}

// Classify a rank against the latest closing rank (not a probability).
function classifyLikelihood(rank, latestClosingRank) {
  if (rank <= latestClosingRank * 0.8) return 'Well within latest cutoff'
  if (rank <= latestClosingRank) return 'Within latest cutoff'
  if (rank <= latestClosingRank * 1.15) return 'Near latest cutoff'
  return 'Outside latest cutoff'
}

// GET /api/predictor/options?exam=JEE — unique colleges + courses-per-college
// (for the simulator dropdowns)
router.get('/api/predictor/options', (req, res) => {
  const exam = (req.query.exam || 'JEE').toString().toUpperCase()
  const rows = HISTORICAL_CUTOFFS.filter((r) => r.exam === exam)
  const colleges = [...new Set(rows.map((r) => r.college_name))].sort()
  const courses = [...new Set(rows.map((r) => r.course))].sort()

  // Map each college to the courses it offers, so the frontend can populate the
  // course dropdown instantly without an extra request.
  const collegeCourses = {}
  for (const r of rows) {
    if (!collegeCourses[r.college_name]) collegeCourses[r.college_name] = new Set()
    collegeCourses[r.college_name].add(r.course)
  }
  const collegeCoursesObj = {}
  for (const [c, set] of Object.entries(collegeCourses)) {
    collegeCoursesObj[c] = [...set].sort()
  }

  res.json({ exam, colleges, courses, collegeCourses: collegeCoursesObj })
})

// GET /api/predictor/predict?exam=JEE&rank=1500&category=General&state=...
// Reverse finder — returns matching college/course options for a rank.
router.get('/api/predictor/predict', (req, res) => {
  const exam = (req.query.exam || 'JEE').toString().toUpperCase()
  const category = (req.query.category || DEFAULT_CATEGORY[exam] || 'General').toString()
  const rank = parseInt(req.query.rank, 10)

  if (!rank || isNaN(rank) || rank < 1) {
    return res.status(400).json({ error: 'BAD_REQUEST', message: 'A valid positive rank is required.' })
  }

  const groups = buildCutoffGroups(exam, category)

  // Keep options that are realistically relevant to this rank (within ~2x the
  // latest closing rank), so the list stays meaningful instead of dumping every
  // college. Sort best-fit (lowest closing rank) first.
  const results = groups
    .filter((g) => rank <= g.latest_closing_rank * 2)
    .sort((a, b) => a.latest_closing_rank - b.latest_closing_rank)
    .map((g) => ({
      college_name: g.college_name,
      course: g.course,
      trends: g.trends,
      likelihood: classifyLikelihood(rank, g.latest_closing_rank),
    }))

  res.json({ exam, category, rank, results })
})

// GET /api/predictor/simulate?college=..&course=..&exam=..&rank=..&category=..
// Compare a single college/course option against the user's rank.
router.get('/api/predictor/simulate', (req, res) => {
  const exam = (req.query.exam || 'JEE').toString().toUpperCase()
  const category = (req.query.category || DEFAULT_CATEGORY[exam] || 'General').toString()
  const rank = parseInt(req.query.rank, 10)
  const college = (req.query.college || '').toString()
  const course = (req.query.course || '').toString()

  if (!rank || isNaN(rank) || rank < 1) {
    return res.status(400).json({ error: 'BAD_REQUEST', message: 'A valid positive rank is required.' })
  }
  if (!college || !course) {
    return res.status(400).json({ error: 'BAD_REQUEST', message: 'college and course are required.' })
  }

  const groups = buildCutoffGroups(exam, category)
  const match = groups.find(
    (g) => g.college_name === college && g.course === course
  )

  if (!match) {
    return res.status(404).json({ error: 'NOT_FOUND', message: 'No historical data for that college/course combination.' })
  }

  res.json({
    college: match.college_name,
    course: match.course,
    trends: match.trends,
    likelihood: classifyLikelihood(rank, match.latest_closing_rank),
  })
})

// ═══════════════════════════════════════════════════════════════════════════
//  PATHWAY ADVISOR — adaptive questionnaire + anti-hallucination recommender
//  Powers the "I don't know what to pick" discovery flow (all-India, all domains)
// ═══════════════════════════════════════════════════════════════════════════
// (classLevel resolution for the pathway flow lives in data/indiaPathways.js
// and routes/guidance.js; this router only serves the cutoff predictor.)

export default router
