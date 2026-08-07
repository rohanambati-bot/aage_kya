import assert from 'node:assert/strict'
import { readdir, readFile } from 'node:fs/promises'
import { test } from 'node:test'

const routesDir = new URL('../routes/', import.meta.url)

test('guidance mutations stay behind the server-managed Supabase client', async () => {
  const files = await readdir(routesDir)
  const sources = await Promise.all(
    files.filter(f => f.endsWith('.js')).map(f => readFile(new URL(f, routesDir), 'utf8'))
  )
  const source = sources.join('\n')

  assert.doesNotMatch(
    source,
    /client\.from\('guidance_results'\)\.(?:insert|update|delete)\(/,
    'the bearer-scoped client must never mutate server-authored guidance rows',
  )
  assert.match(source, /admin\.from\('guidance_results'\)\.insert\(/)
  assert.match(source, /admin\.from\('guidance_results'\)\.delete\(/)
  assert.match(source, /\.from\('guidance_results'\)[\s\S]*?\.update\(\{ parent_summary: parentSummaryText \}\)/)
  assert.match(source, /if \(cacheError\) throw datastoreError\('Guidance cache lookup', cacheError\)/)
  assert.match(source, /if \(guidanceWriteError\) throw datastoreError\('Guidance result write', guidanceWriteError\)/)
})
