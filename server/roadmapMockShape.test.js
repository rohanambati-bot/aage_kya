/**
 * Guards the /api/roadmap fallback contract.
 *
 * The endpoint's contract is { career_path, overview, years }. Before the LLM
 * client consolidation, an AI failure on this route silently returned
 * GUIDANCE-shaped mock data ({ summary, options, ... }), which wrote nulls into
 * the roadmaps table and shipped wrong-shaped JSON to the frontend.
 *
 * `getMockRoadmap` used to be declared INSIDE the /api/roadmap handler (so it
 * had to be string-extracted from the source here). That nesting was also a
 * live bug: the route referenced it before the declaration was reachable. It
 * now lives in `utils/guidancePrompts.js` and is imported directly, so this
 * test exercises the real exported function.
 */

import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { getMockRoadmap } from './utils/guidancePrompts.js'

const routePath = path.join(path.dirname(fileURLToPath(import.meta.url)), 'routes', 'guidance.js')
const source = readFileSync(routePath, 'utf8')

test('getMockRoadmap returns roadmap-shaped data, not guidance-shaped', () => {
  const mock = getMockRoadmap({ marks: '91' }, { path: 'Data Analyst' })

  assert.equal(mock.career_path, 'Data Analyst')
  assert.equal(typeof mock.overview, 'string')
  assert.ok(mock.overview.length > 0)
  assert.ok(Array.isArray(mock.years))
  assert.ok(mock.years.length > 0)

  // Guidance-shaped keys must NOT leak into a roadmap response.
  assert.equal(mock.options, undefined)
  assert.equal(mock.summary, undefined)
})

test('getMockRoadmap years carry the fields the frontend renders', () => {
  const mock = getMockRoadmap({}, { path: 'Architect' })
  for (const year of mock.years) {
    assert.equal(typeof year.year, 'number')
    assert.equal(typeof year.focus, 'string')
    assert.ok(Array.isArray(year.skills))
    assert.ok(Array.isArray(year.milestones))
  }
})

test('getMockRoadmap tolerates a missing option', () => {
  const mock = getMockRoadmap({}, undefined)
  assert.equal(typeof mock.career_path, 'string')
  assert.ok(Array.isArray(mock.years))
})

test('/api/roadmap falls back to getMockRoadmap, and callGemini is gone', () => {
  const routeStart = source.indexOf("router.post('/api/roadmap'")
  assert.notEqual(routeStart, -1, '/api/roadmap route not found')
  const routeEnd = source.indexOf("router.post('/api/generate-career-path'", routeStart)
  const route = source.slice(routeStart, routeEnd === -1 ? source.length : routeEnd)

  assert.ok(route.includes('callLLM('), 'roadmap route should use the shared callLLM')
  assert.ok(route.includes('getMockRoadmap(formData, option)'), 'roadmap route should fall back to getMockRoadmap')
  assert.ok(!route.includes('getMockGuidance'), 'roadmap route must not fall back to guidance-shaped mock')
  assert.ok(!source.includes('callGemini'), 'the local callGemini helper should be removed')
})
